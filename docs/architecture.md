# YieldWise — System Architecture

## Component Interaction Diagram

```
+------------------------------------------------------------------+
|                   Browser Client (React + TypeScript)            |
|                                                                  |
|   [MealPlanner]  -->  [RequirementsReview]  -->  [BudgetSettings]  |
|                                                          |       |
|   [ResultsCart]  <--  [PackageComparator]   <------------+       |
+---------------------------------+--------------------------------+
                                  |
            HTTP REST API (/api/v1)
                                  |
+---------------------------------v--------------------------------+
|                 Full-Stack Server (server.ts / Express)          |
|                                                                  |
|  POST /api/v1/recipes/parse ----> GeminiParserService            |
|                                     |-- @google/genai SDK        |
|                                     |-- gemini-3.8-flash         |
|                                     +-- Structured JSON Draft    |
|                                                                  |
|  POST /api/v1/requirements/scale -> portionCalculator.ts         |
|  POST /api/v1/optimize -----------> budgetOptimizer.ts           |
|  POST /api/v1/budget/optimize ----> budgetOptimizer.ts           |
|  GET  /api/v1/health                                             |
+---------------------------------+--------------------------------+
                                  |
              Pure Standalone Core Algorithms
                                  |
+---------------------------------v--------------------------------+
|  src/algorithms/portionCalculator.ts                             |
|    - Integer canonical milligram conversions                     |
|    - Ceiling serving scaling: ceil(base * servings / baseServ)   |
|    - Cooked-to-raw conversions: ceil(cooked * ppm / 1e6)         |
|    - Verified pantry deductions                                  |
|                                                                  |
|  src/algorithms/yieldCalculator.ts                               |
|    - Usable capacity: floor(gross * yieldPpm / 1e6)              |
|    - Trim waste extraction & effective price per usable kg/lb    |
|                                                                  |
|  src/algorithms/budgetOptimizer.ts                               |
|    - Discrete package bounded enumeration (0..12 packs per SKU)  |
|    - Lexicographical rankings                                    |
|    - Smart Budget Mode exact 0/1 optional subset solver          |
+------------------------------------------------------------------+
```

## Security & Privacy Guardrails
1. **No Client-Exposed API Keys**: The `GEMINI_API_KEY` is kept server-side only and accessed via `process.env.GEMINI_API_KEY`.
2. **Deterministic Computation**: Calculations, financial sums, and pack optimizations are performed strictly in TypeScript, not by an LLM.
3. **CSV Formula Injection Sanitization**: All exported cells beginning with `=`, `+`, `-`, or `@` are safely prefixed with single quotes and wrapped in quotes.
4. **Input Validation**: Request payloads are validated for array length, non-negative integer cents, and character caps.
