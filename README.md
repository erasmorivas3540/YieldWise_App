# YieldWise — Grocery Portions, Trimming Yields & Budget Optimizer

YieldWise is an intelligent, deterministic grocery requirement and grocery package optimizer for home cooks preparing dinners for 1 to 12 servings.

## Features
- **Deterministic Quantity Scaling**: Scales base ingredient portions accurately with integer milligrams and ceiling arithmetic (`ceil(q0 * s1 / s0)`).
- **Trimming Loss & Preparation Yields**: Distinguishes gross as-purchased packaging from edible raw/cooked food (e.g. broccoli stalks, bone-in chicken trim loss).
- **Package Selection Solver**: Evaluates real grocery packages (e.g. 500g vs 1000g packs) using bounded integer enumeration to find the minimum out-of-pocket checkout cost or the least leftover food.
- **Smart Budget Mode (v1.1)**: Enforces a hard USD budget ceiling. Protects user-confirmed essential ingredients and prioritizes optional items by user importance tiers (High > Medium > Low).
- **Adapted Meal Disclosures**: Honest, transparent reporting when optional items must be excluded to stay within budget, or an exact shortfall warning if essentials exceed the budget.
- **AI Recipe Draft Assistant**: Optional natural language recipe parsing using server-side Gemini 3.8 Flash; all AI suggestions are marked as drafts and require user review.
- **Full Privacy & Manual-First**: Complete functionality works locally without an account or an AI API key.
- **Formula-Safe Exports**: Export optimized shopping plans to sanitized CSV or structured JSON.

## Quick Start

### Installation
```bash
npm install
```

### Running the App
```bash
npm run dev
```
The full-stack application will start on `http://localhost:3000`.

### Running Automated Tests
```bash
npm test
```
Executes all unit tests and 16 golden acceptance fixtures in `tests/`.

### Building for Production
```bash
npm run build
npm start
```

## Documentation
- [Product Specification](docs/product-spec.md)
- [Implementation Guide](docs/implementation-guide.md)
- [Smart Budget Mode Mathematical Spec](docs/budget-optimization.md)
- [System Architecture](docs/architecture.md)

## Repository Layout
```
├── README.md
├── docs/
│   ├── product-spec.md
│   ├── implementation-guide.md
│   ├── budget-optimization.md
│   └── architecture.md
├── src/
│   ├── algorithms/
│   │   ├── portionCalculator.ts
│   │   ├── yieldCalculator.ts
│   │   └── budgetOptimizer.ts
│   ├── components/
│   │   ├── BudgetSettings.tsx
│   │   ├── MealPlanner.tsx
│   │   ├── Navbar.tsx
│   │   ├── PackageComparator.tsx
│   │   ├── RequirementsReview.tsx
│   │   └── ResultsCart.tsx
│   ├── pages/
│   │   └── HomePage.tsx
│   ├── services/
│   │   └── demoData.ts
│   └── types/
│       └── index.ts
├── server/
│   ├── routes/
│   │   └── api.ts
│   └── services/
│       └── geminiParser.ts
├── tests/
│   ├── budgetOptimizer.test.ts
│   ├── goldenFixtures.test.ts
│   ├── portionCalculator.test.ts
│   └── yieldCalculator.test.ts
├── server.ts
├── package.json
└── vite.config.ts
```

## Disclaimer
YieldWise is an independent experimental prototype. Prices and yields in the demo catalog are illustrative assumptions, not live store quotes or official USDA endorsements.
