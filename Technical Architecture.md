You’ve given enough to lock the technical architecture; now I’ll flesh it out.

## Recommended stack (v0)

- **Frontend / backend**
  - Next.js (App Router) + TypeScript on Vercel.
  - Basic Tailwind for layout; no heavy UI library.
- **Backend pieces**
  - OpenAI SDK for:
    - Conversational brief + spec JSON.
    - Per‑item ranking + natural‑language explanations. vercel
  - Brave Search API (web search endpoint) for SERP. brave
  - **Concurrency Control:** `RunManager` to handle Brave's 1-second burst limit.
  - Node `fetch`‑based HTML fetcher + light parsing (Cheerio or similar).
- **Data**
  - One Postgres instance (**Neon** recommended for "DB only", or Supabase) for:
    - Session metadata.
    - Stored specs and candidate items.
    - JSON traces per run.

We’ll define a small “SearchService” interface so Brave can later be swapped for Tavily or Perplexity without changing the orchestrator. api-dashboard.search.brave

## Key implications (Brave + 8 items)

- **Rate Limits:** Brave enforces a per‑second burst limit via a 1‑second sliding window (returns `429`).
- **Concurrency:** With 8 items, naive parallel searches will hit the limit. We will use a `RunManager` with `SEARCH_CONCURRENCY = 1` initially (configurable) and backoff/retry logic using `X-RateLimit-Reset`.
- **Query Refinement:** We will aggressively use Brave search operators (`site:`, `-`, `OR`, `lang:`, `loc:`) to exclude junk (e.g., `-pinterest -etsy`) and target product pages.

## High‑level architecture

### 1. Frontend flow

Left pane = **chat**, right pane = **items + traces**.

1. User chats their Super Bowl outfit brief.
2. When the agent thinks it has enough info, it proposes a **plan summary** (items + constraints) and asks for confirmation.
3. On confirmation:
   - Frontend calls `/api/run-plan` with the finalized spec ID.
   - **Settings:** UI includes a "Max items" control (default 8, stored in localStorage) sent to the backend.
   - Right pane switches to “Searching…” view with **max 8 rows**.
4. As backend completes search for each item, right pane updates:
   - **Top 3 products** with title, price, short explanation, “Open product” link.
   - Collapsible “Trace” section with high‑level steps.
5. User can:
   - Accept items and click “Yes, let’s buy these” → summary page with all items + links.
   - Or refine: “Make the jersey white, everything else is good.”
     - Frontend calls `/api/refine-item` with updated item spec.
     - Only that item’s search pipeline re‑runs.

### 2. Backend orchestrator (fixed pipeline)

Core services:

- `SpecService`
  - `createSpecFromChat(messages) -> spec JSON (items[], constraints)`.
  - `updateItemInSpec(specId, itemId, userFeedbackText) -> new item spec`.
- `RunManager`
  - Handles concurrency (default 1) and retries.
  - `MAX_ITEMS = request.maxItems ?? 8`.
- `SearchService` (Brave adapter)
  - `searchProductsForItem(itemSpec) -> SERP results[]`.
- `ScrapeService`
  - `fetchProductPage(url) -> { html, extractedFields? }`.
- `RankingService`
  - `rankCandidates(itemSpec, candidatesWithContent) -> rankedCandidates[] + trace`.

Pipeline per item (managed by RunManager):

1. **Build Query:** specific phrases (team, item) + negative keywords (`-pinterest -reddit`).
2. **Search:** Call Brave `web/search` (`country=us`, `search_lang=en`). Handle `429` retry.
3. **Filter:** Take top results, filter non-products.
4. **Fetch:**
   - Fetch HTML for **Top 2** candidate URLs.
   - If SERP is weak, fetch 3.
5. **Rank (LLM):**
   - Call OpenAI with item spec and candidate HTML/snippets.
   - Produce structured `rankedCandidates[]` (Top 3) and concise **trace**.
6. **Persist:** Save run log and send results to frontend.

### 3. Data model (MVP)

- `sessions`: `id`, `created_at`, `title`.
- `messages`: `id`, `session_id`, `role`, `content`, `created_at`.
- `specs`: `id`, `session_id`, `spec_json`, `status`, `created_at`.
- `items`: `id`, `spec_id`, `name`, `constraints_json`, `locked`.
- `item_runs`: `id`, `item_id`, `version`, `brave_query`, `results_json`, `ranked_candidates_json`, `trace_text`, `created_at`.

## Concrete implementation plan

1. **Pick DB**: **Neon** (Postgres).
2. **Build scaffolding**:
   - Next.js routes: `/api/chat`, `/api/finalize-spec`, `/api/run-plan`, `/api/refine-item`.
   - Core modules: `SpecService`, `BraveSearchService`, `FetchHtmlService`, `RankingService`, `RunManager` (concurrency+retry).
3. **Add minimal persistence**:
   - Store `spec_json` and each `item_run` (latest only) so refresh doesn’t lose the right pane.