import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { jsonCompletion, SPEC_AND_RANKING_MODEL } from "@/lib/openai";
import type { ShoppingSpec, SpecItem, Message } from "@/lib/types";

interface SpecExtractionResult {
  budget: number;
  deliveryDeadline: string | null;
  preferences: {
    style?: string;
    occasion?: string;
    gender?: string;
    ageGroup?: string;
  };
  mustHaves: string[];
  niceToHaves: string[];
  items: {
    name: string;
    category?: string;
    brand?: string[];
    color?: string[];
    size?: string;
    style?: string;
    mustHaves?: string[];
    niceToHaves?: string[];
    keywords?: string[];
  }[];
}

export async function createSpecFromChat(
  sessionId: string,
  messages: Message[]
): Promise<ShoppingSpec> {
  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const extracted = await jsonCompletion<SpecExtractionResult>(
    [
      {
        role: "system",
        content: `You are a shopping spec extractor. Given a conversation between a user and a shopping assistant, extract a structured shopping specification. Return JSON with:
- budget: total budget in USD (number)
- deliveryDeadline: ISO date string or null
- preferences: { style?, occasion?, gender?, ageGroup? }
- mustHaves: string[] of absolute requirements
- niceToHaves: string[] of nice-to-have features
- items: array of individual items to find, each with:
  - name: descriptive name
  - category: product category
  - brand: preferred brands array or empty
  - color: preferred colors array or empty
  - size: size string or empty
  - style: style description
  - mustHaves: item-specific requirements
  - niceToHaves: item-specific nice-to-haves
  - keywords: search keywords

Extract ALL items mentioned in the conversation. Be specific about constraints.`,
      },
      ...chatMessages,
    ],
    { model: SPEC_AND_RANKING_MODEL }
  );

  const specId = uuidv4();
  const spec: ShoppingSpec = {
    id: specId,
    sessionId,
    budget: extracted.budget,
    deliveryDeadline: extracted.deliveryDeadline,
    preferences: extracted.preferences,
    mustHaves: extracted.mustHaves,
    niceToHaves: extracted.niceToHaves,
    items: [],
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  await query(
    "INSERT INTO specs (id, session_id, spec_json, status) VALUES ($1, $2, $3, $4)",
    [specId, sessionId, JSON.stringify(spec), "draft"]
  );

  const items: SpecItem[] = [];
  for (const item of extracted.items) {
    const itemId = uuidv4();
    const specItem: SpecItem = {
      id: itemId,
      specId,
      name: item.name,
      constraints: {
        category: item.category,
        brand: item.brand,
        color: item.color,
        size: item.size,
        style: item.style,
        mustHaves: item.mustHaves,
        niceToHaves: item.niceToHaves,
        keywords: item.keywords,
      },
      budgetAllocation: 0,
      locked: false,
    };
    items.push(specItem);

    await query(
      "INSERT INTO items (id, spec_id, name, constraints_json, budget_allocation) VALUES ($1, $2, $3, $4, $5)",
      [itemId, specId, item.name, JSON.stringify(specItem.constraints), 0]
    );
  }

  spec.items = items;
  spec.items = await allocateBudget(spec);
  spec.status = "finalized";

  await query("UPDATE specs SET spec_json = $1, status = $2 WHERE id = $3", [
    JSON.stringify(spec),
    "finalized",
    specId,
  ]);

  return spec;
}

export async function allocateBudget(
  spec: ShoppingSpec
): Promise<SpecItem[]> {
  if (spec.items.length === 0) return spec.items;

  const allocations = await jsonCompletion<{
    allocations: { name: string; percentage: number }[];
  }>(
    [
      {
        role: "system",
        content: `You are a budget allocation assistant. Given a shopping list and total budget, distribute the budget across items based on typical category pricing. Return JSON: { "allocations": [{ "name": "item name", "percentage": 0.XX }] }. Percentages must sum to 1.0.`,
    },
    {
      role: "user",
      content: `Total budget: $${spec.budget}\nItems:\n${spec.items.map((i) => `- ${i.name} (${i.constraints.category ?? "general"})`).join("\n")}`,
    },
  ],
    { model: SPEC_AND_RANKING_MODEL }
  );

  return spec.items.map((item) => {
    const alloc = allocations.allocations.find(
      (a) =>
        a.name.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(a.name.toLowerCase())
    );
    const percentage = alloc?.percentage ?? 1 / spec.items.length;
    const budgetAllocation = Math.round(spec.budget * percentage * 100) / 100;

    query(
      "UPDATE items SET budget_allocation = $1 WHERE id = $2",
      [budgetAllocation, item.id]
    );

    return { ...item, budgetAllocation };
  });
}

export async function updateItemInSpec(
  specId: string,
  itemId: string,
  feedback: string
): Promise<SpecItem> {
  const rows = await query("SELECT * FROM items WHERE id = $1", [itemId]);
  const existing = rows[0];
  if (!existing) throw new Error(`Item ${itemId} not found`);

  const updated = await jsonCompletion<{
    name: string;
    constraints: SpecItem["constraints"];
  }>(
    [
      {
        role: "system",
        content: `You are updating a shopping item's constraints based on user feedback. Return JSON with "name" and "constraints" (category, brand[], color[], size, style, mustHaves[], niceToHaves[], keywords[]).`,
    },
    {
      role: "user",
      content: `Current item: ${existing.name}\nCurrent constraints: ${JSON.stringify(existing.constraints_json)}\nUser feedback: ${feedback}`,
    },
  ],
    { model: SPEC_AND_RANKING_MODEL }
  );

  const specItem: SpecItem = {
    id: itemId,
    specId,
    name: updated.name,
    constraints: updated.constraints,
    budgetAllocation: Number(existing.budget_allocation),
    locked: existing.locked as boolean,
  };

  await query(
    "UPDATE items SET name = $1, constraints_json = $2 WHERE id = $3",
    [updated.name, JSON.stringify(updated.constraints), itemId]
  );

  return specItem;
}
