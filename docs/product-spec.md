# YieldWise — Product Specification

## Executive Summary
YieldWise is an explainable grocery portion, food trimming yield, and discrete package budget optimizer designed for home cooks preparing dinners for 1–12 servings.

Unlike generic shopping list apps, YieldWise bridges the dimensional gap:
1. **Recipe Requirements**: scaled by serving count with ceiling arithmetic.
2. **Edible Yields vs Trimming Loss**: accounts for bone, peel, stems, and preparation states (raw edible vs cooked edible vs count).
3. **Discrete Package Solver**: compares actual shelf packages (e.g., 500g vs 1000g packs) using bounded integer enumeration to minimize checkout dollars or leftover food.
4. **Smart Budget Mode (v1.1)**: enforces a hard USD budget ceiling, strictly protecting user-confirmed essential ingredients and including optional ingredients lexicographically by priority.

## Core Tenets
- **Deterministic Math**: Serving scaling, unit conversions, yield factors, package combinations, and financial totals are computed strictly in tested TypeScript code. No LLM computes arithmetic or selects packages.
- **AI as Draft Assistant Only**: Server-side Gemini 3.8 Flash extracts or suggests ingredient drafts from natural language; user confirmation is required before optimization.
- **Data Provenance**: All sample yields and prices are labeled as `DEMO_ASSUMPTION` or `USER_CONFIRMED`.
- **Honest Statuses**: If essentials exceed the budget, an exact shortfall is displayed; no incomplete plan is represented as complete.

## User Flow
1. **Plan Dinner**: Enter title, set servings (1–12), add ingredients or paste a meal description for AI draft extraction.
2. **Review Requirements**: Inspect scaled targets in canonical integer milligrams or counts, convert cooked targets to raw equivalents, and deduct pantry items.
3. **Set Budget & Priorities**: Configure hard USD budget and tag ingredients as Essential, High, Medium, or Low priority.
4. **Compare Packages**: Enter available grocery SKUs with net amounts, shelf prices, and trimming yields (ppm).
5. **Optimized Cart**: Review recommended purchase counts, provided edible yields, expected leftovers, and export sanitized CSV or JSON.
