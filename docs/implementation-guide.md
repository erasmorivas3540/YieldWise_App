# YieldWise — Implementation Guide

## Architecture Overview
The application is structured into clearly separated functional layers:

```
src/
├── algorithms/
│   ├── portionCalculator.ts   # Scaling math, mass conversions, pantry deduction
│   ├── yieldCalculator.ts     # Edible yield ppm, waste extraction, unit costs
│   └── budgetOptimizer.ts     # Bounded integer solver & Smart Budget mode
├── components/                # Modular React components for each step
├── pages/HomePage.tsx         # Responsive UI state coordinator
├── services/demoData.ts       # Authored synthetic test meals
└── types/index.ts             # Strongly typed domain contracts
server/
├── routes/api.ts              # Express API endpoints (/api/v1)
└── services/geminiParser.ts   # Server-side Gemini 3.8 Flash SDK integration
tests/                         # Vitest automated unit & golden fixture tests
```

## Units and Dimensional Safety
- **Canonical Mass**: Stored internally as integer milligrams (`mg`) to avoid binary floating-point roundoff errors.
- **Canonical Count**: Stored as integer units for items retaining discrete identity (e.g., eggs).
- **Currency**: Stored as integer US cents (`cents`) across all algorithms and schemas.
- **Edible Yield**: Represented in parts-per-million (`ppm`) where 1,000,000 ppm = 100% usable food.
- **Conversion Constants**:
  - `1 lb = 453.59237 g` (exact avoirdupois)
  - `1 oz = 28.349523125 g`
  - `1 kg = 1,000,000 mg`

## Server Integration
The server runs an Express application mounting Vite middlewares in development and serving static assets in production on port 3000:
- `POST /api/v1/recipes/parse`: Drafts ingredients from meal text via Gemini 3.8 Flash.
- `POST /api/v1/requirements/scale`: Scales recipe requirements.
- `POST /api/v1/optimize`: Unbudgeted package optimizer.
- `POST /api/v1/budget/optimize`: Smart Budget Mode global solver.
- `GET /api/v1/health`: Server health and AI configuration status.
