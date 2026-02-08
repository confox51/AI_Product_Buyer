import type { SpecItem } from "@/lib/types";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  retailerDomain: string;
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

const NEGATIVE_KEYWORDS = "-pinterest -reddit -youtube -tiktok -instagram -facebook";

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "";
  }
}

function buildSearchQuery(item: SpecItem): string {
  const parts: string[] = [];

  if (item.constraints.keywords?.length) {
    parts.push(item.constraints.keywords.join(" "));
  } else {
    parts.push(item.name);
  }

  if (item.constraints.brand?.length) {
    parts.push(item.constraints.brand[0]);
  }
  if (item.constraints.color?.length) {
    parts.push(item.constraints.color[0]);
  }
  if (item.constraints.size) {
    parts.push(`size ${item.constraints.size}`);
  }

  parts.push("buy online");
  parts.push(NEGATIVE_KEYWORDS);

  return parts.join(" ");
}

async function callBraveSearch(
  queryText: string,
  count: number = 10
): Promise<{ web?: { results?: BraveResult[] }; status?: number }> {
  const params = new URLSearchParams({
    q: queryText,
    count: String(count),
    country: "us",
    search_lang: "en",
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_API_KEY!,
      },
    }
  );

  if (response.status === 429) {
    const resetAfter = response.headers.get("X-RateLimit-Reset");
    const waitMs = resetAfter ? parseInt(resetAfter) * 1000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return callBraveSearch(queryText, count);
  }

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }

  return response.json();
}

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export async function searchProductsForItem(
  item: SpecItem
): Promise<SearchResult[]> {
  const mainQuery = buildSearchQuery(item);
  const data = await callBraveSearch(mainQuery);

  const results: SearchResult[] = (data.web?.results ?? []).map(
    (r: BraveResult) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      retailerDomain: extractDomain(r.url),
    })
  );

  // Check retailer diversity
  const uniqueRetailers = new Set(results.map((r) => r.retailerDomain));

  if (uniqueRetailers.size < 3) {
    const missingRetailers = RETAILER_ALLOWLIST.filter(
      (r) => !uniqueRetailers.has(r)
    );

    // Run supplementary site: queries for up to 3 missing retailers
    const supplementaryQueries = missingRetailers.slice(0, 3).map((retailer) =>
      callBraveSearch(`site:${retailer} ${item.name}`, 3)
    );

    // Sequential to respect rate limits
    for (const queryPromise of supplementaryQueries) {
      const supplementary = await queryPromise;
      const extraResults = (supplementary.web?.results ?? []).map(
        (r: BraveResult) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          retailerDomain: extractDomain(r.url),
        })
      );
      results.push(...extraResults);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
