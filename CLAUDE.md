# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered agentic commerce platform for a 24-hour hackathon (HackNation, VC Track). Users describe shopping needs conversationally, and an AI agent discovers products across multiple retailers, ranks them transparently, manages a combined cart, and orchestrates simulated checkout.

**Current status:** Pre-implementation (architecture docs only). No source code, build config, or tests exist yet.

## Planned Tech Stack

- **Framework:** Next.js (App Router) + TypeScript, deployed on Vercel
- **Styling:** Tailwind CSS
- **LLM:** OpenAI SDK (conversational brief, preference/coherence scoring, explanations)
- **Search:** Brave Search API with concurrency control (1-second burst limit)
- **Scraping:** Node fetch + Cheerio, LLM fallback for extraction
- **Database:** Neon PostgreSQL

## Architecture

Three-phase user flow: **Conversational Brief & Discovery** -> **Combined Cart** -> **Simulated Checkout**

Six core backend services:
- `SpecService` — captures user intent, allocates budget across items
- `SearchService` — Brave API adapter with retailer diversity (enforces >= 3 retailers via supplementary `site:` queries)
- `ScrapeService` — extracts `ProductCandidate` structs from product pages
- `RankingService` — transparent weighted scoring: cost (30%), delivery (25%), preference (30%), coherence (15%). Cost and delivery are deterministic; preference and coherence are LLM-scored
- `CartService` — multi-retailer cart with swap/remove/lock/reoptimize
- `CheckoutService` — generates per-retailer simulated checkout plans

`RunManager` handles concurrency control and retry logic for Brave rate limits.

## Key Design Files

- `Agentic Commerce.md` — project goals, features, constraints, and scenario options
- `Technical Architecture.md` — full v0 spec: stack, services, data model, API routes, scoring formula, implementation plan

## Key Constraints

- Minimum 3 retailers for product discovery
- Checkout is simulated only (no real transactions)
- All products conform to the `ProductCandidate` TypeScript interface (see Technical Architecture.md)
- Ranking must be transparent with explainable scores, not a black-box LLM response
