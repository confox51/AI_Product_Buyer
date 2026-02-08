import { jsonCompletion, chatCompletion, SPEC_AND_RANKING_MODEL } from "@/lib/openai";
import type { ProductCandidate, CandidateScores, SpecItem } from "@/lib/types";

const WEIGHTS = {
  cost: 0.3,
  delivery: 0.25,
  preference: 0.3,
  coherence: 0.15,
};

function computeCostScore(price: number, itemBudget: number): number {
  if (itemBudget <= 0) return 0.5;
  const score = 1 - price / itemBudget;
  return Math.max(0, Math.min(1, score));
}

function computeDeliveryScore(
  deliveryDays: number | null,
  deadlineDays: number | null
): number {
  if (deliveryDays === null) return 0.5; // unknown = neutral
  if (deadlineDays === null) return 0.8; // no deadline = slight boost
  if (deliveryDays <= deadlineDays) return 1.0;
  const overage = deliveryDays - deadlineDays;
  return Math.max(0, 1 - overage / 5);
}

function getDaysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export async function scoreCandidates(
  itemSpec: SpecItem,
  candidates: ProductCandidate[],
  deliveryDeadline: string | null,
  otherTopPicks?: ProductCandidate[]
): Promise<ProductCandidate[]> {
  if (candidates.length === 0) return [];

  const deadlineDays = getDaysUntilDeadline(deliveryDeadline);

  // Compute deterministic scores
  for (const candidate of candidates) {
    candidate.scores.cost = computeCostScore(
      candidate.price,
      itemSpec.budgetAllocation
    );
    candidate.scores.delivery = computeDeliveryScore(
      candidate.deliveryDays,
      deadlineDays
    );
  }

  // LLM-scored dimensions (batch)
  const llmScores = await jsonCompletion<{
    scores: { candidateId: string; preference: number; coherence: number }[];
  }>(
    [
      {
        role: "system",
        content: `You are scoring product candidates for a shopper. For each candidate, assign:
- preference: 0-1 score for how well it matches the user's stated preferences
- coherence: 0-1 score for how well it fits with the other items they're buying

Return JSON: { "scores": [{ "candidateId": "...", "preference": 0.X, "coherence": 0.X }] }`,
      },
      {
        role: "user",
        content: `Item spec: ${itemSpec.name}
Constraints: ${JSON.stringify(itemSpec.constraints)}

Candidates:
${candidates.map((c) => `- ID: ${c.id}, Title: ${c.title}, Price: $${c.price}, Retailer: ${c.retailerName}, Variants: ${c.variants.join(", ")}`).join("\n")}

${otherTopPicks?.length ? `Other items in the shopping list (for coherence scoring):\n${otherTopPicks.map((p) => `- ${p.title} ($${p.price}) from ${p.retailerName}`).join("\n")}` : "No other items selected yet."}`,
        },
    ],
    { model: SPEC_AND_RANKING_MODEL }
  );

  for (const candidate of candidates) {
    const llm = llmScores.scores.find((s) => s.candidateId === candidate.id);
    candidate.scores.preference = llm?.preference ?? 0.5;
    candidate.scores.coherence = llm?.coherence ?? 0.5;

    candidate.scores.total =
      WEIGHTS.cost * candidate.scores.cost +
      WEIGHTS.delivery * candidate.scores.delivery +
      WEIGHTS.preference * candidate.scores.preference +
      WEIGHTS.coherence * candidate.scores.coherence;
  }

  // Sort by total score descending
  candidates.sort((a, b) => b.scores.total - a.scores.total);

  // Generate explanations for top 3
  const top3 = candidates.slice(0, 3);
  for (const candidate of top3) {
    candidate.explanation = await explainRanking(candidate, candidate.scores, itemSpec);
  }

  return top3;
}

export async function runCoherencePass(
  allTopPicks: { itemName: string; candidate: ProductCandidate }[]
): Promise<{ itemName: string; candidate: ProductCandidate }[]> {
  if (allTopPicks.length <= 1) return allTopPicks;

  const coherenceResult = await jsonCompletion<{
    adjustments: { candidateId: string; coherence: number }[];
  }>(
    [
      {
        role: "system",
        content: `You are evaluating a set of shopping items for coherence (do they go well together?). For each item, provide an adjusted coherence score 0-1. Penalize clashing styles, colors, or mismatched formality levels. Return JSON: { "adjustments": [{ "candidateId": "...", "coherence": 0.X }] }`,
    },
    {
      role: "user",
      content: `Selected items:\n${allTopPicks.map((p) => `- ${p.itemName}: ${p.candidate.title} ($${p.candidate.price}) from ${p.candidate.retailerName}, Variants: ${p.candidate.variants.join(", ")}`).join("\n")}`,
    },
  ],
    { model: SPEC_AND_RANKING_MODEL }
  );

  for (const pick of allTopPicks) {
    const adj = coherenceResult.adjustments.find(
      (a) => a.candidateId === pick.candidate.id
    );
    if (adj) {
      pick.candidate.scores.coherence = adj.coherence;
      pick.candidate.scores.total =
        WEIGHTS.cost * pick.candidate.scores.cost +
        WEIGHTS.delivery * pick.candidate.scores.delivery +
        WEIGHTS.preference * pick.candidate.scores.preference +
        WEIGHTS.coherence * pick.candidate.scores.coherence;
    }
  }

  return allTopPicks;
}

async function explainRanking(
  candidate: ProductCandidate,
  scores: CandidateScores,
  itemSpec: SpecItem
): Promise<string> {
  return chatCompletion(
    [
      {
        role: "system",
        content:
          "Generate a concise 1-2 sentence explanation for why this product ranks where it does. Reference specific scores. Be specific and helpful.",
      },
      {
        role: "user",
        content: `Item: ${itemSpec.name}\nProduct: ${candidate.title} ($${candidate.price}) from ${candidate.retailerName}\nScores — Cost: ${scores.cost.toFixed(2)}, Delivery: ${scores.delivery.toFixed(2)}, Preference: ${scores.preference.toFixed(2)}, Coherence: ${scores.coherence.toFixed(2)}, Total: ${scores.total.toFixed(2)}`,
      },
    ],
    { model: SPEC_AND_RANKING_MODEL, maxTokens: 150 }
  );
}
