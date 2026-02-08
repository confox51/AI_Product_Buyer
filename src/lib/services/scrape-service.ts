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
