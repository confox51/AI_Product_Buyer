import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { searchProductsForItem } from "./search-service";
import { fetchProductPage, extractProductCandidate } from "./scrape-service";
import { scoreCandidates, runCoherencePass } from "./ranking-service";
import type { ShoppingSpec, ProductCandidate, ItemRunResult } from "@/lib/types";

const MAX_FETCH_PER_ITEM = 5;
const SEARCH_DELAY_MS = 1100; // slightly over 1s to respect Brave burst limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPipeline(
  spec: ShoppingSpec,
  maxItems?: number
): Promise<ItemRunResult[]> {
  const items = spec.items.slice(0, maxItems ?? 8);
  const results: ItemRunResult[] = [];
  const allTopPicks: { itemName: string; candidate: ProductCandidate }[] = [];

  // Process items sequentially to respect Brave rate limits
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Rate limit delay between searches
    if (i > 0) {
      await sleep(SEARCH_DELAY_MS);
    }

    // 1. Search
    const searchResults = await searchProductsForItem(item);
    const searchQuery = item.name; // simplified for trace

    // 2. Fetch & Extract (top N results across >= 3 retailers)
    const candidates: ProductCandidate[] = [];
    const retailersSeen = new Set<string>();
    const urlsToFetch = [];

    // Prioritize diversity: pick URLs from different retailers first
    for (const result of searchResults) {
      if (urlsToFetch.length >= MAX_FETCH_PER_ITEM) break;
      if (!retailersSeen.has(result.retailerDomain)) {
        urlsToFetch.push(result);
        retailersSeen.add(result.retailerDomain);
      }
    }
    // Fill remaining slots
    for (const result of searchResults) {
      if (urlsToFetch.length >= MAX_FETCH_PER_ITEM) break;
      if (!urlsToFetch.includes(result)) {
        urlsToFetch.push(result);
      }
    }

    // Fetch pages in parallel (these are product pages, not Brave API)
    const fetchPromises = urlsToFetch.map(async (result) => {
      const html = await fetchProductPage(result.url);
      if (!html) return null;
      return extractProductCandidate(html, result.url, item);
    });

    const extracted = await Promise.all(fetchPromises);
    for (const candidate of extracted) {
      if (candidate) {
        candidates.push(candidate);
      }
    }

    // 3. Score & Rank
    const ranked = await scoreCandidates(
      item,
      candidates,
      spec.deliveryDeadline,
      allTopPicks.map((p) => p.candidate)
    );

    console.log(
      "[RunManager]",
      item.name,
      "| search:",
      searchResults.length,
      "| fetch:",
      urlsToFetch.length,
      "| extracted:",
      candidates.length,
      "| ranked:",
      ranked.length
    );
    if (candidates.length === 0 && urlsToFetch.length > 0) {
      console.log(
        "[RunManager] No candidates extracted for",
        item.name,
        "— URLs were likely category/listing pages, not product pages"
      );
    }

    // Track top pick for coherence pass
    if (ranked.length > 0) {
      allTopPicks.push({ itemName: item.name, candidate: ranked[0] });
    }

    // 4. Persist run
    const runId = uuidv4();
    await query(
      `INSERT INTO item_runs (id, item_id, version, brave_query, results_json, ranked_candidates_json, trace_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        runId,
        item.id,
        1,
        searchQuery,
        JSON.stringify(searchResults),
        JSON.stringify(ranked),
        `Searched for "${searchQuery}", found ${searchResults.length} results, extracted ${candidates.length} candidates, ranked top ${ranked.length}`,
      ]
    );

    results.push({
      itemId: item.id,
      itemName: item.name,
      candidates: ranked,
      query: searchQuery,
    });
  }

  // 5. Cross-item coherence pass
  if (allTopPicks.length > 1) {
    await runCoherencePass(allTopPicks);
  }

  console.log("[RunManager] Pipeline complete. Returning", results.length, "item results.");
  return results;
}
