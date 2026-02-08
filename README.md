# AI Product Buyer

An AI-powered agentic commerce platform that lets users describe shopping needs conversationally, then discovers products across multiple retailers, ranks them transparently, manages a combined cart, and orchestrates simulated checkout — all in one seamless experience.

Built for **HackNation** (VC Track, 24-hour hackathon).

## The Problem

Online shopping is fragmented. Buying a complete outfit or planning an event means bouncing between dozens of tabs, comparing prices and delivery times, and repeating checkout flows for every retailer. Search engines help you *find* products — but they don't help you **get everything bought**.

## The Solution

Users describe what they need in plain language. An AI agent takes over from there:

1. **Understands intent** — captures budget, deadlines, preferences, and must-haves through conversation
2. **Discovers products** — searches across 3+ retailers using web search and product page extraction
3. **Ranks transparently** — scores every candidate on cost, delivery, preference match, and set coherence using a deterministic weighted formula (not a black-box LLM response)
4. **Builds a combined cart** — one cart spanning multiple retailers with swap, remove, lock, and re-optimize controls
5. **Simulates checkout** — generates per-retailer checkout plans with autofill previews and order confirmations

## Demo Scenarios

| Scenario | Prompt |
|---|---|
| **Super Bowl Party Outfit** | "I need a full outfit (head-to-toe) in team style, budget $150, delivered by Friday." |
| **Skiing Outfit** | "Downhill skiing outfit, warm and waterproof, size M, budget $400, delivery within 5 days." |
| **Hackathon Host Kit** | "I'm hosting a hackathon for 60 people — figure out what I need and buy it at the best price." |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) + TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| LLM | [OpenAI SDK](https://platform.openai.com/) — conversational brief, preference/coherence scoring, explanations |
| Search | [Tavily API](https://tavily.com/) — web search for product discovery |
| Scraping | Node `fetch` + [Cheerio](https://cheerio.js.org/) with LLM fallback for structured extraction |
| Database | [Neon](https://neon.tech/) (serverless PostgreSQL) |
| Deployment | [Vercel](https://vercel.com/) |

## Architecture

### Three-Phase User Flow

```
Conversational Brief & Discovery  →  Combined Cart  →  Simulated Checkout
```

**Phase A — Discovery:** User chats their shopping brief. The agent extracts structured constraints, proposes a plan, then searches and ranks products in real time (up to 8 items, top 3 candidates each).

**Phase B — Cart:** User selects candidates (or accepts top-ranked defaults). Cart shows items grouped by retailer with totals, budget tracking, and delivery estimates. Users can swap, remove, lock items, or refine via chat.

**Phase C — Checkout:** User enters payment and shipping info once. The agent generates per-retailer checkout plans with autofill previews and simulated order confirmations.

### Backend Services

| Service | Responsibility |
|---|---|
| `SpecService` | Captures user intent from chat, produces structured shopping spec, allocates budget across items |
| `SearchService` | Tavily adapter with retailer diversity — guarantees >= 3 retailers via supplementary queries |
| `ScrapeService` | Fetches product pages, extracts `ProductCandidate` structs via Cheerio + LLM fallback |
| `RankingService` | Transparent weighted scoring (cost 30%, delivery 25%, preference 30%, coherence 15%) |
| `CartService` | Multi-retailer cart with add/remove/swap/lock/reoptimize |
| `CheckoutService` | Generates per-retailer simulated checkout plans and order summaries |
| `RunManager` | Concurrency control and retry logic for search rate limits |

### Ranking Formula

Products are scored on four dimensions with a transparent, explainable formula:

| Dimension | Weight | Method |
|---|---|---|
| **Cost** | 0.30 | `1 - (price / itemBudget)` — deterministic |
| **Delivery** | 0.25 | `1.0` if on time, penalized if late — deterministic |
| **Preference** | 0.30 | LLM-scored match to user's stated preferences |
| **Coherence** | 0.15 | LLM-scored compatibility with other items in the set |

`totalScore = Σ(weight × score)` — Cost and delivery are computed deterministically; only preference and coherence use LLM judgment.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys for OpenAI, Tavily, and Neon

### Environment Variables

Create a `.env.local` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key
TAVILY_API_KEY=your_tavily_api_key
DATABASE_URL=your_neon_database_url
```

### Installation

```bash
# Install dependencies
npm install

# Initialize the database (run once after setting DATABASE_URL)
# Visit http://localhost:3000/api/init-db after starting the dev server

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── chat/               # Conversational brief
│   │   ├── finalize-spec/      # Lock spec & allocate budget
│   │   ├── run-plan/           # Kick off search + rank pipeline
│   │   ├── refine-item/        # Re-run search for a single item
│   │   ├── cart/               # add, remove, swap, summary, reoptimize
│   │   ├── checkout/           # start, summary
│   │   └── init-db/            # Database initialization
│   ├── page.tsx                # Main app page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── chat/                   # Chat panel & message bubbles
│   ├── discovery/              # Product discovery & candidate cards
│   ├── cart/                   # Cart panel, items, & summary
│   ├── checkout/               # Checkout form, retailer plans, order summary
│   └── ui/                     # Shared UI (phase indicator, score breakdown)
└── lib/
    ├── services/               # Core business logic
    │   ├── spec-service.ts
    │   ├── search-service.ts
    │   ├── scrape-service.ts
    │   ├── ranking-service.ts
    │   ├── cart-service.ts
    │   ├── checkout-service.ts
    │   └── run-manager.ts
    ├── db.ts                   # Neon database client
    ├── openai.ts               # OpenAI client
    ├── tavily.ts               # Tavily client
    ├── schema.sql              # Database schema
    └── types.ts                # TypeScript interfaces
```

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | POST | Send message, agent extracts shopping constraints |
| `/api/finalize-spec` | POST | Lock the shopping spec and trigger budget allocation |
| `/api/run-plan` | POST | Start search + rank pipeline for all items (SSE stream) |
| `/api/refine-item` | POST | Re-run search for a single item with updated constraints |
| `/api/cart/add` | POST | Add a ranked candidate to the cart |
| `/api/cart/remove` | POST | Remove an item from the cart |
| `/api/cart/swap` | POST | Swap a cart item for a different candidate |
| `/api/cart/summary` | GET | Get cart totals, budget status, delivery timeline |
| `/api/cart/reoptimize` | POST | Agent suggests swaps to fit budget/deadline |
| `/api/checkout/start` | POST | Submit payment + address, generate checkout plan |
| `/api/checkout/summary` | GET | Get full simulated order summary |

## Key Design Decisions

- **Transparent ranking over black-box LLM** — Scores are a weighted formula with deterministic components, not just "the LLM said so"
- **Multi-retailer diversity enforced** — If initial search returns < 3 retailers, supplementary queries automatically fire
- **Simulated checkout only** — No real transactions; demonstrates the full agentic flow safely
- **Structured product schema** — Every product candidate conforms to the `ProductCandidate` TypeScript interface for consistency

## License

This project was built for the HackNation hackathon.
