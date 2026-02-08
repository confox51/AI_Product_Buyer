import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { updateItemInSpec } from "@/lib/services/spec-service";
import { searchProductsForItem } from "@/lib/services/search-service";
import { fetchProductPage, extractProductCandidate } from "@/lib/services/scrape-service";
import { scoreCandidates } from "@/lib/services/ranking-service";
import { v4 as uuidv4 } from "uuid";
import type { ProductCandidate, ShoppingSpec } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { specId, itemId, feedback } = await request.json();

    // Update item constraints
    const updatedItem = await updateItemInSpec(specId, itemId, feedback);

    // Get spec for deadline info
    const specRows = await query("SELECT spec_json FROM specs WHERE id = $1", [specId]);
    const spec = specRows[0]?.spec_json as ShoppingSpec | undefined;

    // Re-run search pipeline for this item
    const searchResults = await searchProductsForItem(updatedItem);

    // Fetch & extract
    const candidates: ProductCandidate[] = [];
    const toFetch = searchResults.slice(0, 5);

    for (const result of toFetch) {
      const html = await fetchProductPage(result.url);
      if (!html) continue;
      const candidate = await extractProductCandidate(html, result.url, updatedItem);
      if (candidate) candidates.push(candidate);
    }

    // Score
    const ranked = await scoreCandidates(
      updatedItem,
      candidates,
      spec?.deliveryDeadline ?? null
    );

    // Persist run
    const runId = uuidv4();
    await query(
      `INSERT INTO item_runs (id, item_id, version, brave_query, results_json, ranked_candidates_json, trace_text)
       VALUES ($1, $2, (SELECT COALESCE(MAX(version), 0) + 1 FROM item_runs WHERE item_id = $3), $4, $5, $6, $7)`,
      [
        runId,
        itemId,
        itemId,
        updatedItem.name,
        JSON.stringify(searchResults),
        JSON.stringify(ranked),
        `Refined search for "${updatedItem.name}" with feedback: "${feedback}"`,
      ]
    );

    return NextResponse.json({
      item: updatedItem,
      candidates: ranked,
    });
  } catch (error) {
    console.error("Refine item error:", error);
    return NextResponse.json(
      { error: "Failed to refine item" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
