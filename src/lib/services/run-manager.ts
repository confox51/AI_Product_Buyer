import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import tavily from "@/lib/tavily";
import { searchProductsForItem } from "./search-service";
import type { SearchResult } from "./search-service";
import {
  classifyUrl,
  extractFromMarkdown,
  extractProductLinksFromCatalog,
  detectCatalogFromContent,
} from "./scrape-service";
import { scoreCandidates, runCoherencePass } from "./ranking-service";
import type { ShoppingSpec, ProductCandidate, ItemRunResult } from "@/lib/types";

const MAX_URLS_PER_ITEM = 5;
const MAX_CATALOG_EXTRACT_URLS = 6;

export async function runPipeline(
  spec: ShoppingSpec,
  maxItems?: number
): Promise<ItemRunResult[]> {
  const items = spec.items.slice(0, maxItems ?? 8);
  const results: ItemRunResult[] = [];
  const allTopPicks: { itemName: string; candidate: ProductCandidate }[] = [];

  for (const item of items) {
    // 1. Search (Tavily returns rawContent with results)
    const searchResults = await searchProductsForItem(item);

    // 2. Select up to MAX_URLS_PER_ITEM (prioritize retailer diversity, then score)
    const selected = selectUrls(searchResults, MAX_URLS_PER_ITEM);

    // 3. Classify each URL
    const productUrls: SearchResult[] = [];
    const catalogUrls: SearchResult[] = [];

    for (const result of selected) {
      const type = classifyUrl(result.url);
      if (type === "catalog") {
        catalogUrls.push(result);
      } else {
        // "product" and "unknown" go to Phase A
        productUrls.push(result);
      }
    }

    console.log(
      `[RunManager] classified: ${productUrls.length} product/unknown, ${catalogUrls.length} catalog`
    );

    const candidates: ProductCandidate[] = [];

    // Phase A: Product/Unknown URLs — extract directly from rawContent
    const phaseAPromises = productUrls.map(async (result) => {
      if (!result.rawContent) return null;

      const candidate = await extractFromMarkdown(
        result.rawContent,
        result.url,
        item
      );

      // If extraction failed on "unknown" URL, check if it's actually a catalog
      if (!candidate && classifyUrl(result.url) === "unknown") {
        if (detectCatalogFromContent(result.rawContent)) {
          console.log(`[RunManager] Reclassified unknown → catalog: ${result.url}`);
          catalogUrls.push(result);
        }
      }

      return candidate;
    });

    const phaseAResults = await Promise.all(phaseAPromises);
    for (const candidate of phaseAResults) {
      if (candidate) candidates.push(candidate);
    }

    // Phase B: Catalog URLs — extract product links, then fetch via Tavily Extract
    const allProductLinks: { url: string; title: string }[] = [];

    for (const result of catalogUrls) {
      if (!result.rawContent) continue;

      const links = extractProductLinksFromCatalog(result.rawContent, result.url);
      if (links.length > 0) {
        console.log(
          `[RunManager] Catalog ${result.url} yielded ${links.length} product links`
        );
        allProductLinks.push(...links);
      }
    }

    // Deduplicate and cap product links
    const seenUrls = new Set(candidates.map((c) => c.productUrl));
    const uniqueLinks = allProductLinks.filter((l) => {
      if (seenUrls.has(l.url)) return false;
      seenUrls.add(l.url);
      return true;
    });
    const linksToExtract = uniqueLinks.slice(0, MAX_CATALOG_EXTRACT_URLS);

    if (linksToExtract.length > 0) {
      console.log(
        `[RunManager] Extracting ${linksToExtract.length} product links via Tavily Extract`
      );

      try {
        const extractResponse = await tavily.extract(
          linksToExtract.map((l) => l.url)
        );

        const phaseBPromises = (extractResponse.results ?? []).map(
          async (extracted: { url: string; rawContent: string }) => {
            if (!extracted.rawContent) return null;
            return extractFromMarkdown(extracted.rawContent, extracted.url, item);
          }
        );

        const phaseBResults = await Promise.all(phaseBPromises);
        for (const candidate of phaseBResults) {
          if (candidate) candidates.push(candidate);
        }
      } catch (err) {
        console.warn("[RunManager] Tavily Extract failed:", err);
      }
    }

    // 4. Score & Rank
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
      "| selected:",
      selected.length,
      "| extracted:",
      candidates.length,
      "| ranked:",
      ranked.length
    );

    // Track top pick for coherence pass
    if (ranked.length > 0) {
      allTopPicks.push({ itemName: item.name, candidate: ranked[0] });
    }

    // 5. Persist run
    const runId = uuidv4();
    const searchQuery = item.name;
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

  // 6. Cross-item coherence pass
  if (allTopPicks.length > 1) {
    await runCoherencePass(allTopPicks);
  }

  console.log("[RunManager] Pipeline complete. Returning", results.length, "item results.");
  return results;
}

function selectUrls(results: SearchResult[], max: number): SearchResult[] {
  const selected: SearchResult[] = [];
  const retailersSeen = new Set<string>();

  // First pass: one per retailer (diversity)
  for (const result of results) {
    if (selected.length >= max) break;
    if (!retailersSeen.has(result.retailerDomain)) {
      selected.push(result);
      retailersSeen.add(result.retailerDomain);
    }
  }

  // Second pass: fill remaining by score
  for (const result of results) {
    if (selected.length >= max) break;
    if (!selected.includes(result)) {
      selected.push(result);
    }
  }

  return selected;
}
