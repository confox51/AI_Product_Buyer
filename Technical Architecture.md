You've given enough to lock the technical architecture; now I'll flesh it out.

## Recommended stack (v0)

- **Frontend / backend**
  - Next.js (App Router) + TypeScript on Vercel.
  - Basic Tailwind for layout; no heavy UI library.
- **Backend pieces**
  - OpenAI SDK for:
    - Conversational brief + spec JSON.
    - Per‑item candidate extraction + natural‑language explanations.
  - Brave Search API (web search endpoint) for SERP.
  - **Concurrency Control:** `RunManager` to handle Brave's 1-second burst limit.
  - Node `fetch`‑based HTML fetcher + light parsing (Cheerio or similar).
- **Data**
  - One Postgres instance (**Neon** recommended for "DB only", or Supabase) for:
    - Session metadata.
    - Stored specs, candidate items, and cart state.
    - JSON traces per run.

We'll define a small "SearchService" interface so Brave can later be swapped for Tavily or Perplexity without changing the orchestrator.

## Key implications (Brave + 8 items)

- **Rate Limits:** Brave enforces a per‑second burst limit via a 1‑second sliding window (returns `429`).
- **Concurrency:** With 8 items, naive parallel searches will hit the limit. We will use a `RunManager` with `SEARCH_CONCURRENCY = 1` initially (configurable) and backoff/retry logic using `X-RateLimit-Reset`.
- **Query Refinement:** We will aggressively use Brave search operators (`site:`, `-`, `OR`, `lang:`, `loc:`) to exclude junk (e.g., `-pinterest -etsy`) and target product pages.
- **Retailer Diversity:** To guarantee ≥ 3 retailers, the `SearchService` will deduplicate results by domain and, if fewer than 3 retailers are represented, run follow‑up queries with `site:` targeting under‑represented retailers from a configurable allowlist (e.g., Amazon, Nike, Walmart, Dick's, Macy's, Nordstrom).

## High‑level architecture

### 1. Frontend flow

Three‑pane layout: left = **chat**, right = **items + traces** (discovery phase) → **cart** (cart phase) → **checkout** (checkout phase).

**Phase A — Conversational brief + discovery:**

1. User chats their shopping brief (e.g., Super Bowl outfit, $150, delivered by Friday).
2. Agent captures structured constraints: **budget**, **delivery deadline**, **preferences** (style, size, brand, color), and **must‑haves vs nice‑to‑haves**.
3. When the agent has enough info, it proposes a **plan summary** (items + constraints) and asks for confirmation.
4. On confirmation:
   - Frontend calls `/api/run-plan` with the finalized spec ID.
   - **Settings:** UI includes a "Max items" control (default 8, stored in localStorage) sent to the backend.
   - Right pane switches to "Searching…" view with **max 8 rows**.
5. As backend completes search for each item, right pane updates:
   - **Top 3 products** per item with title, price, delivery estimate, retailer name, short explanation, and "Open product" link.
   - Each candidate shows its **score breakdown** (cost, delivery, preference, coherence).
   - Collapsible "Trace" section with high‑level steps.

**Phase B — Combined cart:**

6. User selects one candidate per item (or accepts the top‑ranked default). Each selection calls `/api/cart/add`.
7. Right pane switches to **cart view** showing:
   - All selected items grouped by retailer.
   - Per‑item: name, price, delivery estimate, retailer, variant selected.
   - **Cart totals:** total cost, budget remaining, latest delivery date.
   - Budget warning if total exceeds the spec budget.
8. User can modify the cart:
   - **Swap:** pick a different candidate from the ranked alternatives for any item.
   - **Remove:** drop an item entirely.
   - **Refine:** chat "Make the jersey white" → `/api/refine-item` re‑runs that item's search pipeline; new candidates replace old ones.
   - **Lock:** mark an item as final so the agent won't change it during re‑optimization.
   - After any modification, the agent re‑evaluates budget allocation and may suggest swaps for unlocked items to stay within budget.

**Phase C — Simulated checkout:**

9. User clicks "Proceed to checkout" → right pane shows the **checkout view**.
10. User enters **payment info + shipping address once** in a single form.
11. The agent generates a **per‑retailer checkout plan**: for each retailer in the cart, a step‑by‑step breakdown showing:
    - Items being purchased from that retailer.
    - Autofill preview (which fields get filled with what values).
    - Simulated order confirmation with order ID, estimated delivery, and subtotal.
12. A final **order summary** shows all simulated orders, grand total, and expected delivery timeline.

### 2. Backend orchestrator (fixed pipeline)

Core services:

- `SpecService`
  - `createSpecFromChat(messages) -> spec JSON (items[], constraints{ budget, deliveryDeadline, preferences })`.
  - `updateItemInSpec(specId, itemId, userFeedbackText) -> new item spec`.
  - `allocateBudget(spec) -> per‑item budget targets` — distributes total budget across items based on category norms.
- `RunManager`
  - Handles concurrency (default 1) and retries.
  - `MAX_ITEMS = request.maxItems ?? 8`.
- `SearchService` (Brave adapter)
  - `searchProductsForItem(itemSpec) -> SERP results[]`.
  - **Retailer diversity:** Deduplicates by domain. If < 3 unique retailers after initial search, runs supplementary `site:`‑scoped queries.
- `ScrapeService`
  - `fetchProductPage(url) -> ProductCandidate`.
  - Extracts structured fields via Cheerio + LLM fallback.
- `RankingService`
  - `scoreCandidates(itemSpec, candidates[]) -> scoredCandidates[]` — applies the scoring formula (see below).
  - `explainRanking(topCandidate, scores) -> natural‑language explanation`.
- `CartService`
  - `addToCart(sessionId, itemId, candidateId) -> cart`.
  - `removeFromCart(sessionId, itemId) -> cart`.
  - `swapInCart(sessionId, itemId, newCandidateId) -> cart`.
  - `getCartSummary(sessionId) -> { items[], totalCost, budgetRemaining, latestDelivery, retailerBreakdown }`.
  - `reoptimize(sessionId) -> suggested swaps[]` — for unlocked items, suggests cheaper/faster alternatives if cart exceeds budget or misses delivery deadline.
- `CheckoutService`
  - `generateCheckoutPlan(cart, paymentInfo, shippingAddress) -> CheckoutPlan`.
  - Groups cart items by retailer.
  - Produces per‑retailer step-by-step autofill preview (simulated form fields + values).
  - Generates simulated order confirmations (order ID, subtotal, estimated delivery).
  - Returns a combined order summary.

### 3. Structured product schema

Every candidate extracted by `ScrapeService` conforms to:

```typescript
interface ProductCandidate {
  id: string;
  title: string;
  price: number;                    // USD
  currency: string;
  deliveryEstimate: string | null;  // e.g. "3-5 business days", "By Feb 9"
  deliveryDays: number | null;      // parsed numeric for scoring
  variants: string[];               // e.g. ["Size M", "Red", "White"]
  retailerName: string;             // e.g. "Nike", "Amazon"
  retailerDomain: string;           // e.g. "nike.com"
  productUrl: string;
  imageUrl: string | null;
  inStock: boolean;
  scores: CandidateScores;
  explanation: string;              // natural‑language "why this ranks here"
}

interface CandidateScores {
  cost: number;          // 0–1, lower price relative to budget = higher
  delivery: number;      // 0–1, meets deadline = 1, late = penalized
  preference: number;    // 0–1, match to stated preferences
  coherence: number;     // 0–1, compatibility with other selected items
  total: number;         // weighted composite
}
```

### 4. Transparent ranking engine

Ranking is a **computable, weighted scoring formula** — not a pure LLM black box.

**Scoring dimensions (per candidate):**

| Dimension | Weight (default) | How it's computed |
|---|---|---|
| **Cost** | 0.30 | `1 - (price / itemBudget)`. Capped at 0 if over budget. |
| **Delivery** | 0.25 | `1.0` if `deliveryDays <= daysUntilDeadline`, else `max(0, 1 - (overage / 5))`. |
| **Preference** | 0.30 | LLM‑scored 0–1 based on match to user's stated preferences (style, brand, color, size). |
| **Coherence** | 0.15 | LLM‑scored 0–1 based on compatibility with other items already in cart / top picks. |

`totalScore = Σ(weight_i × score_i)`

The LLM is used **only** for the preference and coherence dimensions, which require subjective judgment. Cost and delivery are computed deterministically from extracted product data.

**Set coherence pass:** After all items are individually ranked, a cross‑item coherence evaluation runs. The LLM reviews the top picks as a set and adjusts coherence scores (e.g., clashing colors penalized). This triggers re‑ranking only if it changes the #1 pick for any item.

**Explanation:** For the #1‑ranked candidate, the agent produces: *"Ranked #1 because: lowest price in budget (cost: 0.9), arrives 2 days early (delivery: 1.0), exact color match (preference: 0.85), pairs well with the selected jacket (coherence: 0.8)."*

### 5. Pipeline per item (managed by RunManager)

1. **Build Query:** specific phrases (team, item) + negative keywords (`-pinterest -reddit`).
2. **Search:** Call Brave `web/search` (`country=us`, `search_lang=en`). Handle `429` retry.
3. **Retailer check:** If < 3 unique retailer domains in results, run supplementary `site:` queries against the retailer allowlist.
4. **Filter:** Take top results, filter non‑products. Drop out‑of‑stock where detectable from SERP snippets.
5. **Fetch + Extract:**
   - Fetch HTML for **top 5** candidate URLs (across ≥ 3 retailers).
   - Extract structured `ProductCandidate` fields via Cheerio selectors + LLM fallback for ambiguous pages.
   - **Delivery deadline filter:** Drop candidates where `deliveryDays` exceeds deadline (if deadline is set and delivery info is available).
6. **Score:**
   - Compute cost and delivery scores deterministically.
   - Call LLM for preference and coherence scores (batch call with item spec + all candidates).
   - Compute `totalScore` via weighted formula.
   - Sort descending. Keep **top 3**.
7. **Persist:** Save run log (`item_runs`) and send scored results to frontend.

### 6. Data model (MVP)

- `sessions`: `id`, `created_at`, `title`.
- `messages`: `id`, `session_id`, `role`, `content`, `created_at`.
- `specs`: `id`, `session_id`, `spec_json` (includes `budget`, `deliveryDeadline`, `preferences`, `mustHaves`, `niceToHaves`), `status`, `created_at`.
- `items`: `id`, `spec_id`, `name`, `constraints_json`, `budget_allocation`, `locked`.
- `item_runs`: `id`, `item_id`, `version`, `brave_query`, `results_json`, `ranked_candidates_json` (array of `ProductCandidate`), `trace_text`, `created_at`.
- `carts`: `id`, `session_id`, `status` (`active` | `checked_out`), `created_at`, `updated_at`.
- `cart_items`: `id`, `cart_id`, `item_id`, `candidate_id`, `candidate_snapshot_json` (denormalized `ProductCandidate`), `locked`, `added_at`.
- `checkout_plans`: `id`, `cart_id`, `payment_info_json` (simulated — no real card data stored), `shipping_address_json`, `retailer_plans_json` (per‑retailer step breakdown), `order_summary_json`, `created_at`.

### 7. API routes

- `/api/chat` — conversational brief; agent extracts constraints.
- `/api/finalize-spec` — lock the spec and trigger budget allocation.
- `/api/run-plan` — kick off the search + rank pipeline for all items.
- `/api/refine-item` — re‑run search for a single item with updated constraints.
- `/api/cart/add` — add a ranked candidate to the cart.
- `/api/cart/remove` — remove an item from the cart.
- `/api/cart/swap` — swap a cart item for a different candidate.
- `/api/cart/summary` — get cart totals, budget status, delivery timeline.
- `/api/cart/reoptimize` — agent suggests swaps for unlocked items to fit budget/deadline.
- `/api/checkout/start` — accept payment + address, generate per‑retailer checkout plan.
- `/api/checkout/summary` — return the full simulated order summary.

## Concrete implementation plan

1. **Pick DB**: **Neon** (Postgres).
2. **Build scaffolding**:
   - Next.js routes: all endpoints listed in section 7.
   - Core modules: `SpecService`, `BraveSearchService`, `ScrapeService`, `RankingService`, `CartService`, `CheckoutService`, `RunManager` (concurrency+retry).
3. **Add structured extraction**:
   - Cheerio selectors for common product page patterns (price, delivery, variants).
   - LLM fallback for pages that don't match known patterns.
   - Enforce `ProductCandidate` schema on all extracted data.
4. **Build scoring engine**:
   - Deterministic cost + delivery scoring.
   - LLM‑assisted preference + coherence scoring.
   - Weighted composite + set coherence pass.
5. **Build cart**:
   - Cart data model + `CartService` CRUD.
   - Cart UI: item list, retailer grouping, totals, budget indicator.
   - Swap / remove / lock interactions.
   - Re‑optimization endpoint.
6. **Build checkout flow**:
   - Single payment + address form (simulated, no real data persisted).
   - `CheckoutService` generates per‑retailer autofill plans.
   - Simulated order confirmations.
   - Combined order summary view.
7. **Add minimal persistence**:
   - Store `spec_json`, `item_runs`, `cart`, and `checkout_plan` so refresh doesn't lose state.
