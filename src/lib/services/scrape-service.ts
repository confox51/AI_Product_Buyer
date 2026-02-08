import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { jsonCompletion } from "@/lib/openai";
import type { ProductCandidate, SpecItem } from "@/lib/types";

interface ExtractedProduct {
  title: string;
  price: number | null;
  currency: string;
  deliveryEstimate: string | null;
  deliveryDays: number | null;
  variants: string[];
  imageUrl: string | null;
  inStock: boolean;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractRetailerName(domain: string): string {
  const map: Record<string, string> = {
    "amazon.com": "Amazon",
    "walmart.com": "Walmart",
    "nike.com": "Nike",
    "nordstrom.com": "Nordstrom",
    "macys.com": "Macy's",
    "dickssportinggoods.com": "Dick's Sporting Goods",
    "rei.com": "REI",
    "target.com": "Target",
    "zappos.com": "Zappos",
    "bestbuy.com": "Best Buy",
    "adidas.com": "Adidas",
    "underarmour.com": "Under Armour",
  };
  return map[domain] ?? domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
}

// --- URL Classification ---

const PRODUCT_URL_PATTERNS: Record<string, RegExp[]> = {
  "amazon.com": [/\/dp\//, /\/gp\/product\//],
  "walmart.com": [/\/ip\//],
  "nike.com": [/\/t\//],
  "nordstrom.com": [/\/s\//],
  "macys.com": [/\/product\//],
  "dickssportinggoods.com": [/\/p\//],
  "rei.com": [/\/product\//],
  "target.com": [/\/p\//],
  "zappos.com": [/\/p\//],
  "bestbuy.com": [/\/site\/[^/]+\/\d+\.p/],
  "adidas.com": [/\/[A-Z0-9]{6,}\.html/],
  "underarmour.com": [/\/p\//],
};

const CATALOG_URL_PATTERNS: Record<string, RegExp[]> = {
  "amazon.com": [/\/s\?/, /\/s\//],
  "walmart.com": [/\/search/, /\/browse\//],
  "nike.com": [/\/w\//],
  "nordstrom.com": [/\/sr\?/, /\/c\//],
  "macys.com": [/\/shop\//],
  "dickssportinggoods.com": [/\/c\//],
  "rei.com": [/\/c\//,/\/search/],
  "target.com": [/\/s\?/, /\/c\//],
  "zappos.com": [/\/search/, /\/filters\//],
  "bestbuy.com": [/\/searchpage/, /\/site\/searchpage/],
  "adidas.com": [/\/search/, /\/[a-z-]+$/],
  "underarmour.com": [/\/c\//],
};

export function classifyUrl(url: string): "product" | "catalog" | "unknown" {
  const domain = extractDomain(url);

  const productPatterns = PRODUCT_URL_PATTERNS[domain];
  if (productPatterns?.some((p) => p.test(url))) {
    return "product";
  }

  const catalogPatterns = CATALOG_URL_PATTERNS[domain];
  if (catalogPatterns?.some((p) => p.test(url))) {
    return "catalog";
  }

  return "unknown";
}

// --- Catalog Link Extraction ---

export function extractProductLinksFromCatalog(
  markdownContent: string,
  sourceUrl: string
): { url: string; title: string }[] {
  const sourceDomain = extractDomain(sourceUrl);
  const links: { url: string; title: string }[] = [];
  const seen = new Set<string>();

  // Match markdown links: [title](url)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(markdownContent)) !== null) {
    const title = match[1];
    const url = match[2];
    const linkDomain = extractDomain(url);

    if (linkDomain !== sourceDomain) continue;
    if (seen.has(url)) continue;
    if (classifyUrl(url) === "catalog") continue;

    // Prefer links classified as "product", also accept "unknown" with deep paths
    const pathParts = new URL(url).pathname.split("/").filter(Boolean);
    if (classifyUrl(url) === "product" || pathParts.length >= 2) {
      seen.add(url);
      links.push({ url, title });
    }
  }

  return links.slice(0, 3);
}

// --- Catalog Content Detection ---

export function detectCatalogFromContent(markdownContent: string): boolean {
  const lower = markdownContent.toLowerCase();
  const signals = [
    /search results/i,
    /showing \d+ results/i,
    /\d+ items? found/i,
    /sort by/i,
    /filter by/i,
    /refine your search/i,
  ];

  const matchCount = signals.filter((s) => s.test(lower)).length;
  return matchCount >= 2;
}

// --- Markdown-based Extraction (for Tavily rawContent) ---

export async function extractFromMarkdown(
  markdown: string,
  url: string,
  itemSpec: SpecItem
): Promise<ProductCandidate | null> {
  const truncated = markdown.slice(0, 15000);

  try {
    const result = await jsonCompletion<ExtractedProduct>([
      {
        role: "system",
        content: `Extract product information from this markdown page content. Return JSON with: title (string), price (number or null), currency (string), deliveryEstimate (string or null), deliveryDays (number or null), variants (string[]), imageUrl (string or null), inStock (boolean). The product should be a single product related to: "${itemSpec.name}". If the page contains multiple products (a listing/search page) or no clear single product, return {"title":"","price":null} to indicate failure.`,
      },
      {
        role: "user",
        content: `URL: ${url}\n\nPage content (markdown):\n${truncated}`,
      },
    ]);

    if (!result || !result.title || !result.price) {
      return null;
    }

    const domain = extractDomain(url);

    return {
      id: uuidv4(),
      title: result.title,
      price: result.price,
      currency: result.currency ?? "USD",
      deliveryEstimate: result.deliveryEstimate,
      deliveryDays: result.deliveryDays,
      variants: result.variants ?? [],
      retailerName: extractRetailerName(domain),
      retailerDomain: domain,
      productUrl: url,
      imageUrl: result.imageUrl,
      inStock: result.inStock ?? true,
      scores: { cost: 0, delivery: 0, preference: 0, coherence: 0, total: 0 },
      explanation: "",
    };
  } catch {
    return null;
  }
}

// --- Existing extraction functions (kept as fallbacks) ---

function tryCheerioExtraction(
  html: string,
  _url: string
): ExtractedProduct | null {
  const $ = cheerio.load(html);

  // Try JSON-LD first
  const jsonLdScripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const data = JSON.parse($(jsonLdScripts[i]).html() ?? "");
      const product = Array.isArray(data)
        ? data.find((d) => d["@type"] === "Product")
        : data["@type"] === "Product"
          ? data
          : null;

      if (product) {
        const offers = product.offers ?? product.offer;
        const price = offers?.price ?? offers?.lowPrice ?? offers?.[0]?.price;
        return {
          title: product.name ?? "",
          price: price ? parseFloat(price) : null,
          currency: offers?.priceCurrency ?? "USD",
          deliveryEstimate: null,
          deliveryDays: null,
          variants: [],
          imageUrl: typeof product.image === "string" ? product.image : product.image?.[0] ?? null,
          inStock: offers?.availability
            ? !offers.availability.includes("OutOfStock")
            : true,
        };
      }
    } catch {
      // continue to next extraction method
    }
  }

  // Try Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");

  // Try common price patterns
  let price: number | null = null;
  const priceSelectors = [
    '[data-price]',
    '.price',
    '.product-price',
    '#price',
    '.a-price .a-offscreen',
    '[itemprop="price"]',
    '.price-current',
  ];

  for (const sel of priceSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.attr("content") ?? el.attr("data-price") ?? el.text();
      const match = text?.match(/[\d,]+\.?\d*/);
      if (match) {
        price = parseFloat(match[0].replace(/,/g, ""));
        break;
      }
    }
  }

  const title =
    ogTitle ??
    $('meta[name="title"]').attr("content") ??
    $("h1").first().text().trim() ??
    $("title").text().trim();

  if (title && price) {
    return {
      title,
      price,
      currency: "USD",
      deliveryEstimate: null,
      deliveryDays: null,
      variants: [],
      imageUrl: ogImage ?? null,
      inStock: true,
    };
  }

  return null;
}

async function llmExtraction(
  html: string,
  url: string,
  itemSpec: SpecItem
): Promise<ExtractedProduct | null> {
  // Truncate HTML to fit in context
  const truncated = html.slice(0, 15000);

  try {
    const result = await jsonCompletion<{
      title: string;
      price: number | null;
      currency: string;
      deliveryEstimate: string | null;
      deliveryDays: number | null;
      variants: string[];
      imageUrl: string | null;
      inStock: boolean;
    }>([
      {
        role: "system",
        content: `Extract product information from this HTML page. Return JSON with: title (string), price (number or null), currency (string), deliveryEstimate (string or null), deliveryDays (number or null), variants (string[]), imageUrl (string or null), inStock (boolean). The product should be related to: "${itemSpec.name}".`,
      },
      {
        role: "user",
        content: `URL: ${url}\n\nHTML content:\n${truncated}`,
      },
    ]);

    return result;
  } catch {
    return null;
  }
}

export async function fetchProductPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

export async function extractProductCandidate(
  html: string,
  url: string,
  itemSpec: SpecItem
): Promise<ProductCandidate | null> {
  // Try Cheerio first, then LLM fallback
  let extracted = tryCheerioExtraction(html, url);

  if (!extracted || !extracted.price) {
    extracted = await llmExtraction(html, url, itemSpec);
  }

  if (!extracted || !extracted.title || !extracted.price) {
    return null;
  }

  const domain = extractDomain(url);

  return {
    id: uuidv4(),
    title: extracted.title,
    price: extracted.price,
    currency: extracted.currency ?? "USD",
    deliveryEstimate: extracted.deliveryEstimate,
    deliveryDays: extracted.deliveryDays,
    variants: extracted.variants,
    retailerName: extractRetailerName(domain),
    retailerDomain: domain,
    productUrl: url,
    imageUrl: extracted.imageUrl,
    inStock: extracted.inStock,
    scores: { cost: 0, delivery: 0, preference: 0, coherence: 0, total: 0 },
    explanation: "",
  };
}
