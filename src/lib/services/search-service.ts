import tavily from "@/lib/tavily";
import type { SpecItem } from "@/lib/types";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  retailerDomain: string;
  rawContent: string | null;
  score: number;
}

const RETAILER_ALLOWLIST = [
  "amazon.com",
  "walmart.com",
  "nike.com",
  "nordstrom.com",
  "macys.com",
  "dickssportinggoods.com",
  "rei.com",
  "target.com",
  "zappos.com",
  "bestbuy.com",
  "adidas.com",
  "underarmour.com",
];

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "";
  }
}

function buildSearchQuery(item: SpecItem): string {
  return item.name;
}

export async function searchProductsForItem(
  item: SpecItem
): Promise<SearchResult[]> {
  const query = buildSearchQuery(item);
  console.log("[Search] Item:", item.name, "| Query:", query);

  const response = await tavily.search(query, {
    searchDepth: "advanced",
    includeRawContent: "markdown",
    maxResults: 10,
    includeDomains: RETAILER_ALLOWLIST,
  });

  const results: SearchResult[] = (response.results ?? []).map(
    (r: { title: string; url: string; content: string; rawContent?: string | null; score: number }) => ({
      title: r.title,
      url: r.url,
      description: r.content,
      retailerDomain: extractDomain(r.url),
      rawContent: r.rawContent ?? null,
      score: r.score,
    })
  );

  console.log("[Search] Tavily returned", results.length, "results");
  if (results.length > 0) {
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.score.toFixed(2)}] ${r.title} | ${r.url}`);
    });
    if (results.length > 5) console.log(`  ... and ${results.length - 5} more`);
  }

  // Check retailer diversity
  const uniqueRetailers = new Set(results.map((r) => r.retailerDomain));

  if (uniqueRetailers.size < 3 && results.length > 0) {
    const missingRetailers = RETAILER_ALLOWLIST.filter(
      (r) => !uniqueRetailers.has(r)
    );
    const supplementaryDomains = missingRetailers.slice(0, 3);
    console.log("[Search] Fewer than 3 retailers; running supplementary search for", supplementaryDomains);

    try {
      const supplementary = await tavily.search(item.name + " buy online", {
        searchDepth: "basic",
        includeRawContent: "markdown",
        maxResults: 6,
        includeDomains: supplementaryDomains,
      });

      const extraResults = (supplementary.results ?? []).map(
        (r: { title: string; url: string; content: string; rawContent?: string | null; score: number }) => ({
          title: r.title,
          url: r.url,
          description: r.content,
          retailerDomain: extractDomain(r.url),
          rawContent: r.rawContent ?? null,
          score: r.score,
        })
      );
      console.log("[Search] Supplementary returned", extraResults.length, "results");
      results.push(...extraResults);
    } catch (err) {
      console.warn("[Search] Supplementary search failed:", err);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  console.log("[Search] Final results for", item.name, ":", deduped.length, "URLs");
  return deduped;
}
