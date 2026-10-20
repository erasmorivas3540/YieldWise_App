# Minimalist Redesign: Warm Natural Palette & Streamlined Flow

A minimalist aesthetic and information-architecture overhaul for YieldWise, adopting a warm natural palette with soft beige surfaces, olive accents, clean zero-pill typography, and a distraction-free 5-step flow without visual clutter.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Phase 1 Clarification:**
> - **Visual Aesthetic**: Warm natural neutral theme with soft beige canvas, stone surfaces, and restrained olive green accents.
> - **Workflow Structure**: Preserve the clear 5-step progression (`Plan` → `Requirements` → `Budget` → `Packages` → `Cart`) while stripping away verbose text blocks, decorative banners, and redundant helper paragraphs.

---

## 1. Overview & Core Concept

- **What It Does**: YieldWise calculates exact grocery portions from raw vs. cooked recipe requirements, accounts for trimming yields (bone, skin, stems), and finds the lowest-cost combination of discrete grocery packages within an optional hard budget.
- **Target Audience**: Home cooks and budget-conscious grocery planners seeking rapid, trustworthy portion math without clutter.
- **Core Value Delivered**: Fast, quiet, calm interaction with high density, clear contrast, and instant recalculated results.

---

## 2. User Experience & Visual Design

### Aesthetic Direction & Mood
- **Style**: Quiet utilitarian minimalism inspired by artisanal cookbooks and high-end editorial tools.
- **Atmosphere**: Warm linen and oatmeal tones that feel organic and kitchen-native, avoiding harsh clinical grays and dark neon gaming aesthetics.

### Color Tokens & Palette
- **Canvas (60%)**: Warm off-white / soft beige (`bg-[#FAF8F5]` / `bg-stone-50`).
- **Surfaces & Containers (30%)**: Pure chalk white cards (`bg-white`) bordered with delicate warm sand lines (`border-stone-200`).
- **Accents & Active States (10%)**: Deep olive green (`bg-[#435334]` / `text-[#435334]` or rich `emerald-900`) for primary CTAs and active states, with warm ochre/amber (`amber-700`) strictly reserved for adapted recipe disclosures.
- **Typography**: Deep charcoal body text (`text-stone-900` / `text-stone-800`), muted metadata in stone (`text-stone-500`).

### Zero-Pill & Editorial Typography
- **Headings**: Clean sans-serif display typography with balanced wrap (`text-wrap: balance`).
- **Metadata**: Unboxed inline text separated by subtle middots (`·`), eradicating static colored capsule badges.
- **Numbers & Prices**: Strictly tabular numerals (`tabular-nums font-mono`) for prices, serving counters, and mass quantities.

### Layout & Component Density
- **Top Bar**: Minimalist 3-zone header with clean wordmark, step sequence indicator (`1 Plan · 2 Scaled · 3 Budget · 4 Packages · 5 Cart`), and current cost counter.
- **Screen 1 (Plan)**: Compact recipe title input, direct 1–12 serving stepper, tight ingredient rows, and one quiet sample loader dropdown. AI draft option presented as a subtle inline input rather than a large card.
- **Screen 2 (Requirements)**: Clean tabular view of per-serving vs. total target, optional pantry offset input, and net required mass without noisy explanation blocks.
- **Screen 3 (Budget & Priorities)**: Single-line hard budget input in USD and a sleek priority segmented selector (`Essential · High · Med · Low`) per item.
- **Screen 4 (Packages)**: Compact product list with net mass, shelf price, and a minimal percentage yield slider.
- **Screen 5 (Cart)**: Crisp 4-metric summary grid (Budget, Spent, Leftover, Per-Serving), clear package shopping list with rationales, and sanitized CSV/JSON download buttons.

---

## 3. Key Product Decisions & Trade-Offs

- **Preserving 5 Discrete Steps vs. All-in-One Dashboard**:
  - *Chosen Approach*: Keep the 5-step sequence with immediate click navigation between any completed step.
  - *Why*: Allows cooks to focus on one logical task at a time (portions, then budget, then shelf packages) without vertical cognitive overload, honoring user feedback.
- **Trimming Verbose Banners**:
  - *Chosen Approach*: Remove decorative hero banners, lengthy paragraphs explaining arithmetic, and secondary callouts.
  - *Why*: Cooks need clarity and quick decision-making; deterministic guarantees and data provenance are preserved in quiet tooltips and clean footer notes.
- **Strict Zero Regression on Algorithms**:
  - *Chosen Approach*: Zero changes to the mathematical logic in `portionCalculator.ts`, `yieldCalculator.ts`, or `budgetOptimizer.ts`. All 33 Vitest acceptance tests remain authoritative and untouched.

---

## 4. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                          YieldWise Client                              │
│                                                                        │
│   Navbar (Wordmark · 5-Step Text Nav · Live Est. Badge)                │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Screen Views (Clean Warm Minimalist Styling):                  │   │
│   │                                                                │   │
│   │  [1. MealPlanner]       Compact title, servings & ingredient rows│   │
│   │         ↓                                                      │   │
│   │  [2. RequirementsReview] Scaled target, pantry input & net req │   │
│   │         ↓                                                      │   │
│   │  [3. BudgetSettings]     $ Cap & Essential/High/Med/Low tiers  │   │
│   │         ↓                                                      │   │
│   │  [4. PackageComparator]  Shelf SKUs, price, yield %, toggle    │   │
│   │         ↓                                                      │   │
│   │  [5. ResultsCart]        Spent/Leftover KPIs & shopping list   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ Deterministic React State & REST API
┌─────────────────────────────────v──────────────────────────────────────┐
│                    Algorithms Core & Backend Server                    │
│                                                                        │
│  src/algorithms/portionCalculator.ts  (Integer mg portion scaling)     │
│  src/algorithms/yieldCalculator.ts    (Trim yield ppm & usable mass)   │
│  src/algorithms/budgetOptimizer.ts    (Bounded solver & budget mode)   │
│  server.ts + server/routes/api.ts     (Express /api/v1 endpoints)      │
└────────────────────────────────────────────────────────────────────────┘
```

### File Modification Scope
1. `src/index.css`: Configure warm neutral theme variables and body styling.
2. `src/components/Navbar.tsx`: Restyle with clean text-based step navigation and zero-pill status counters.
3. `src/components/MealPlanner.tsx`: Remove giant hero box; present compact recipe inputs, clean demo selector, and quiet AI draft input.
4. `src/components/RequirementsReview.tsx`: Clean tabular layout, remove explanatory callout boxes, enhance row legibility.
5. `src/components/BudgetSettings.tsx`: Streamlined budget input, quiet segmented priority controls, concise adapted meal badge.
6. `src/components/PackageComparator.tsx`: Compact package rows with clean tabular numbers and subtle yield slider.
7. `src/components/ResultsCart.tsx`: Concise metric grid, elegant shopping list, formula-sanitized CSV/JSON export.
8. `src/pages/HomePage.tsx`: Set warm natural canvas background and clean footer.
