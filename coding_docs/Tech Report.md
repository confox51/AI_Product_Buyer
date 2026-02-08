# Tech Report

## 1. Problem & Challenge

Online shopping across multiple retailers is fragmented and time-consuming — consumers must manually search, compare prices, read reviews, and juggle separate carts and checkouts. There's no unified way to describe what you need in natural language and have an agent do the legwork for you.

## 2. Target Audience

Busy consumers who shop across multiple retailers and want to save time comparing products, prices, and delivery options.

## 3. Solution & Core Features

A conversational AI agent that captures your shopping needs through chat, searches across 12+ retailers in real time, and ranks products with a transparent weighted scoring system (cost, delivery, preference match, cross-item coherence). It manages a unified multi-store cart and simulates a single checkout flow across all retailers.

## 4. Unique Selling Proposition (USP)

Unlike traditional comparison tools, our agent understands natural language briefs, allocates your budget across items, and scores products with full transparency — you see exactly why each product ranks where it does. The cross-item coherence scoring ensures your purchases work well together, not just individually.

## 5. Implementation & Technology

Built with Next.js 16, React 19, and TypeScript on the frontend, powered by OpenAI GPT-5 for conversation and ranking, Tavily for real-time web search and page extraction, and Neon serverless Postgres for persistence. A hybrid extraction pipeline (Tavily markdown, Cheerio JSON-LD, LLM fallback) streams live progress over SSE across a 7-service backend architecture.

## 6. Results & Impact

The agent reduces a multi-hour, multi-tab shopping session into a single conversational flow that delivers ranked, explainable product recommendations in minutes. It enforces retailer diversity, respects budget constraints, and gives users full visibility into the decision-making process.
