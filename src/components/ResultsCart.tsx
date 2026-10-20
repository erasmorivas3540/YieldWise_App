import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  Info,
  HelpCircle,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { formatCanonicalQuantity } from '../algorithms/yieldCalculator';
import {
  BudgetOptimizationResult,
  GroceryPackage,
  OptimizationObjective,
  OptimizationResult,
  Recipe,
} from '../types';

interface ResultsCartProps {
  recipe: Recipe;
  packages: GroceryPackage[];
  budgetMode: boolean;
  unbudgetedResult: OptimizationResult | null;
  budgetResult: BudgetOptimizationResult | null;
  objective: OptimizationObjective;
  onChangeObjective: (obj: OptimizationObjective) => void;
  onExploreFewerServings: (servings: number) => void;
  onBack: () => void;
  onStartOver: () => void;
}

export const ResultsCart: React.FC<ResultsCartProps> = ({
  recipe,
  packages,
  budgetMode,
  unbudgetedResult,
  budgetResult,
  objective,
  onChangeObjective,
  onExploreFewerServings,
  onBack,
  onStartOver,
}) => {
  // Export CSV safely escaping spreadsheet formulas (=, +, -, @)
  const handleExportCsv = () => {
    let rows: string[][] = [];
    rows.push(['Ingredient', 'Required', 'Package Recommendation', 'Count', 'Provided', 'Leftover', 'Cost (USD)', 'Status / Rationale']);

    if (budgetMode && budgetResult) {
      for (const item of budgetResult.items) {
        const req = recipe.requirements.find((r) => r.id === item.requirementId);
        const name = req?.displayName || item.requirementId;
        const requiredStr = formatCanonicalQuantity(
          parseInt(item.requiredCanonicalQuantity, 10),
          req?.dimension || 'mass',
          req?.baseUnit
        );
        const selectionsStr = item.selections
          .map((s) => `${s.count}x ${packages.find((p) => p.id === s.packageId)?.displayName || s.packageId}`)
          .join(' + ') || 'None';
        const countStr = item.selections.reduce((sum, s) => sum + s.count, 0).toString();
        const providedStr = formatCanonicalQuantity(
          parseInt(item.fulfilledCanonicalQuantity, 10),
          req?.dimension || 'mass',
          req?.baseUnit
        );
        const leftoverStr = formatCanonicalQuantity(
          parseInt(item.leftoverCanonicalQuantity, 10),
          req?.dimension || 'mass',
          req?.baseUnit
        );
        const costStr = item.costCents !== null ? `$${(item.costCents / 100).toFixed(2)}` : 'N/A';

        rows.push([name, requiredStr, selectionsStr, countStr, providedStr, leftoverStr, costStr, item.explanation]);
      }
    } else if (unbudgetedResult) {
      for (const plan of unbudgetedResult.ingredientPlans) {
        const req = recipe.requirements.find((r) => r.id === plan.ingredientId);
        const name = req?.displayName || plan.ingredientId;
        const requiredStr = formatCanonicalQuantity(
          parseInt(plan.requiredCanonicalQuantity, 10),
          req?.dimension || 'mass',
          req?.baseUnit
        );
        const selectionsStr = plan.selections
          .map((s) => `${s.count}x ${packages.find((p) => p.id === s.packageId)?.displayName || s.packageId}`)
          .join(' + ') || 'None';
        const countStr = plan.selections.reduce((sum, s) => sum + s.count, 0).toString();
        const providedStr = plan.providedCanonicalQuantity
          ? formatCanonicalQuantity(parseInt(plan.providedCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)
          : '0';
        const leftoverStr = plan.leftoverCanonicalQuantity
          ? formatCanonicalQuantity(parseInt(plan.leftoverCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)
          : '0';
        const costStr = plan.ingredientCostCents !== undefined ? `$${(plan.ingredientCostCents / 100).toFixed(2)}` : 'N/A';

        rows.push([name, requiredStr, selectionsStr, countStr, providedStr, leftoverStr, costStr, plan.explanation]);
      }
    }

    // Sanitize cells to prevent CSV formula injection
    const sanitizeCell = (cell: string) => {
      const trimmed = cell.trim();
      if (/^[=+\-@\t\r]/.test(trimmed)) {
        return `"'${trimmed.replace(/"/g, '""')}"`;
      }
      return `"${trimmed.replace(/"/g, '""')}"`;
    };

    const csvContent = rows.map((r) => r.map(sanitizeCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `yieldwise-shopping-plan-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const payload = budgetMode ? budgetResult : unbudgetedResult;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `yieldwise-plan-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Status Banners */}
      {budgetMode && budgetResult && (
        <div>
          {budgetResult.status === 'complete_original_within_budget' && (
            <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 flex items-start gap-3 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-emerald-300">
                  Complete Original Meal Within Budget
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5">
                  All essential and requested optional ingredients fit within your ${(budgetResult.budgetCents / 100).toFixed(2)} budget ceiling.
                </p>
              </div>
            </div>
          )}

          {budgetResult.status === 'adapted_within_budget' && (
            <div className="p-5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-amber-300">
                  Adapted Meal — Some Optional Ingredients Excluded
                </h3>
                <p className="text-xs sm:text-sm text-amber-200/90 mt-0.5">
                  Essentials are fully protected. Some optional ingredients were omitted because whole packages exceed the ${(budgetResult.budgetCents / 100).toFixed(2)} ceiling.
                </p>
              </div>
            </div>
          )}

          {budgetResult.status === 'essential_over_budget' && (
            <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 flex items-start gap-3 shadow-sm">
              <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-rose-300">
                  Essential Ingredients Exceed Budget Ceiling
                </h3>
                <p className="text-xs sm:text-sm text-rose-200/90 mt-0.5">
                  Minimum cost for essential packages is{' '}
                  <span className="font-bold underline">
                    ${((budgetResult.cheapestEssentialCostCents || 0) / 100).toFixed(2)}
                  </span>
                  , exceeding your ${(budgetResult.budgetCents / 100).toFixed(2)} budget by{' '}
                  <span className="font-bold">
                    ${((budgetResult.shortfallCents || 0) / 100).toFixed(2)}
                  </span>
                  . No feasible cart can be created without exceeding your limit.
                </p>

                {recipe.targetServings > 1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => onExploreFewerServings(recipe.targetServings - 1)}
                      className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-xs font-semibold text-white transition"
                    >
                      Explore {recipe.targetServings - 1} Servings
                    </button>
                    <span className="text-xs text-rose-300/80">Recalculates packages afresh</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {budgetResult.status === 'blocked_missing_input' && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-amber-600/50 text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-base text-white">Missing Input or Unpriced Packages</h3>
                <p className="text-xs text-slate-300 mt-1">
                  At least one required ingredient has missing package pricing, unverified yield, or no compatible package. Please edit packages before solving.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Results Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6">
        {/* Header & Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {budgetMode && budgetResult ? (
            <>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Budget Ceiling</span>
                <span className="text-2xl font-bold text-white mt-1 block">
                  ${(budgetResult.budgetCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Checkout Total</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  {budgetResult.spentCents !== null ? `$${(budgetResult.spentCents / 100).toFixed(2)}` : '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Remaining Change</span>
                <span className="text-2xl font-bold text-slate-200 mt-1 block">
                  {budgetResult.remainingCents !== null ? `$${(budgetResult.remainingCents / 100).toFixed(2)}` : '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Full Recipe Total</span>
                <span className="text-2xl font-bold text-slate-400 mt-1 block">
                  {budgetResult.fullRecipeCostCents !== null ? `$${(budgetResult.fullRecipeCostCents / 100).toFixed(2)}` : '—'}
                </span>
              </div>
            </>
          ) : unbudgetedResult ? (
            <>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Estimated Cost</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  ${(unbudgetedResult.totalKnownCostCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Cost Per Serving</span>
                <span className="text-2xl font-bold text-slate-200 mt-1 block">
                  ${(unbudgetedResult.costPerServingCents / 100).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500">For {unbudgetedResult.targetServings} servings</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Ingredients Fulfilled</span>
                <span className="text-2xl font-bold text-white mt-1 block">
                  {unbudgetedResult.ingredientPlans.filter((p) => p.status === 'optimal_within_limits').length} / {unbudgetedResult.ingredientPlans.length}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Optimization Goal</span>
                <span className="text-xs font-semibold text-emerald-400 mt-2 block capitalize">
                  {objective.replace(/_/g, ' ')}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Objective Switcher (Unbudgeted mode) */}
        {!budgetMode && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-300">Optimization Priority:</span>
              <p className="text-[11px] text-slate-400">
                {objective === 'lowest_checkout_cost'
                  ? 'Minimizes cash out of pocket at checkout (lexicographical: cost > leftover > pack count).'
                  : 'Minimizes expected excess usable mass in your pantry (may cost slightly more at checkout).'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeObjective('lowest_checkout_cost')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  objective === 'lowest_checkout_cost'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Lowest Checkout Cost
              </button>
              <button
                type="button"
                onClick={() => onChangeObjective('least_estimated_leftover')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  objective === 'least_estimated_leftover'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Least Leftover
              </button>
            </div>
          </div>
        )}

        {/* Detailed Item List */}
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            Package Purchase Recommendations
          </h3>

          <div className="space-y-3">
            {budgetMode && budgetResult ? (
              budgetResult.items.map((item) => {
                const req = recipe.requirements.find((r) => r.id === item.requirementId);
                const isIncluded = item.status === 'included';
                const isPantry = item.status === 'covered_by_pantry';
                const isOmitted = item.status === 'omitted_optional';

                return (
                  <div
                    key={item.requirementId}
                    className={`p-4 rounded-xl border ${
                      isOmitted
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : isPantry
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{req?.displayName}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                              item.priority === 'essential'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {item.priority}
                          </span>
                          {isOmitted && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                              Omitted to Fit Budget
                            </span>
                          )}
                          {isPantry && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                              Covered by Pantry
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Required edible mass:{' '}
                          {formatCanonicalQuantity(
                            parseInt(item.requiredCanonicalQuantity, 10),
                            req?.dimension || 'mass',
                            req?.baseUnit
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-white">
                          {item.costCents !== null ? `$${(item.costCents / 100).toFixed(2)}` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Selections breakdown */}
                    {isIncluded && item.selections.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-300">
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Buy Packages</span>
                          {item.selections.map((s) => {
                            const pkg = packages.find((p) => p.id === s.packageId);
                            return (
                              <div key={s.packageId} className="font-semibold text-emerald-400">
                                {s.count}× {pkg?.displayName} (${((pkg?.priceCents || 0) / 100).toFixed(2)})
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-slate-300">
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Coverage & Leftover</span>
                          <div>
                            Yields{' '}
                            {formatCanonicalQuantity(
                              parseInt(item.fulfilledCanonicalQuantity, 10),
                              req?.dimension || 'mass',
                              req?.baseUnit
                            )}{' '}
                            (
                            {formatCanonicalQuantity(
                              parseInt(item.leftoverCanonicalQuantity, 10),
                              req?.dimension || 'mass',
                              req?.baseUnit
                            )}{' '}
                            leftover)
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 text-[11px] text-slate-400 italic">
                      {item.explanation}
                    </div>
                  </div>
                );
              })
            ) : unbudgetedResult ? (
              unbudgetedResult.ingredientPlans.map((plan) => {
                const req = recipe.requirements.find((r) => r.id === plan.ingredientId);

                return (
                  <div
                    key={plan.ingredientId}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-white">{req?.displayName}</div>
                        <div className="text-xs text-slate-400">
                          Required edible target:{' '}
                          {formatCanonicalQuantity(
                            parseInt(plan.requiredCanonicalQuantity, 10),
                            req?.dimension || 'mass',
                            req?.baseUnit
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-emerald-400">
                          {plan.ingredientCostCents !== undefined
                            ? `$${(plan.ingredientCostCents / 100).toFixed(2)}`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {plan.selections.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Recommended Purchase
                          </span>
                          {plan.selections.map((s) => {
                            const pkg = packages.find((p) => p.id === s.packageId);
                            return (
                              <div key={s.packageId} className="font-semibold text-slate-200">
                                {s.count}× {pkg?.displayName} (${((pkg?.priceCents || 0) / 100).toFixed(2)})
                              </div>
                            );
                          })}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Usable Yield & Leftover
                          </span>
                          <div className="text-slate-300">
                            Provides{' '}
                            {plan.providedCanonicalQuantity
                              ? formatCanonicalQuantity(
                                  parseInt(plan.providedCanonicalQuantity, 10),
                                  req?.dimension || 'mass',
                                  req?.baseUnit
                                )
                              : '0'}
                            {plan.leftoverCanonicalQuantity && (
                              <span className="text-slate-400">
                                {' '}
                                ({formatCanonicalQuantity(
                                  parseInt(plan.leftoverCanonicalQuantity, 10),
                                  req?.dimension || 'mass',
                                  req?.baseUnit
                                )}{' '}
                                leftover)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 italic">
                      {plan.explanation}
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>

        {/* Export & Actions Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition w-full sm:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Edit Packages or Budget</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCsv}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-200 border border-slate-700 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJson}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-200 border border-slate-700 transition"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onStartOver}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs sm:text-sm text-white transition text-center"
            >
              New Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
