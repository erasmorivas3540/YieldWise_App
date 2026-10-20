import React from 'react';
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  XCircle,
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Status Indicator */}
      <div className="pb-2 border-b border-stone-200">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">Optimized Cart</h1>
        {budgetMode && budgetResult ? (
          <div className="text-xs mt-1">
            {budgetResult.status === 'complete_original_within_budget' && (
              <span className="text-[#3E4F32] font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Complete meal within ${(budgetResult.budgetCents / 100).toFixed(2)} budget ceiling.</span>
              </span>
            )}
            {budgetResult.status === 'adapted_within_budget' && (
              <span className="text-amber-800 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Adapted meal: essentials protected; some optional items excluded to meet ${(budgetResult.budgetCents / 100).toFixed(2)} budget.</span>
              </span>
            )}
            {budgetResult.status === 'essential_over_budget' && (
              <div className="text-rose-700 font-medium space-y-1">
                <div className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Essential packages cost ${((budgetResult.cheapestEssentialCostCents || 0) / 100).toFixed(2)}, exceeding budget by ${((budgetResult.shortfallCents || 0) / 100).toFixed(2)}.
                  </span>
                </div>
                {recipe.targetServings > 1 && (
                  <button
                    onClick={() => onExploreFewerServings(recipe.targetServings - 1)}
                    className="text-xs text-stone-800 underline underline-offset-2 hover:text-black font-semibold"
                  >
                    Explore recalculation for {recipe.targetServings - 1} servings
                  </button>
                )}
              </div>
            )}
            {budgetResult.status === 'blocked_missing_input' && (
              <span className="text-rose-600 font-medium">
                Missing price or yield for one or more items.
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-stone-500 mt-0.5">
            Full recipe package fulfillment ({objective === 'lowest_checkout_cost' ? 'lowest checkout cost' : 'least leftover'}).
          </p>
        )}
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {budgetMode && budgetResult ? (
          <>
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Budget</span>
              <span className="text-base font-semibold font-mono text-stone-900 mt-0.5 block tabular-nums">
                ${(budgetResult.budgetCents / 100).toFixed(2)}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Spent</span>
              <span className="text-base font-semibold font-mono text-[#3E4F32] mt-0.5 block tabular-nums">
                {budgetResult.spentCents !== null ? `$${(budgetResult.spentCents / 100).toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Remaining</span>
              <span className="text-base font-semibold font-mono text-stone-700 mt-0.5 block tabular-nums">
                {budgetResult.remainingCents !== null ? `$${(budgetResult.remainingCents / 100).toFixed(2)}` : '—'}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Full Recipe</span>
              <span className="text-base font-semibold font-mono text-stone-500 mt-0.5 block tabular-nums">
                {budgetResult.fullRecipeCostCents !== null ? `$${(budgetResult.fullRecipeCostCents / 100).toFixed(2)}` : '—'}
              </span>
            </div>
          </>
        ) : unbudgetedResult ? (
          <>
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Total Cost</span>
              <span className="text-base font-semibold font-mono text-[#3E4F32] mt-0.5 block tabular-nums">
                ${(unbudgetedResult.totalKnownCostCents / 100).toFixed(2)}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Per Serving</span>
              <span className="text-base font-semibold font-mono text-stone-800 mt-0.5 block tabular-nums">
                ${(unbudgetedResult.costPerServingCents / 100).toFixed(2)}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Items Fulfilled</span>
              <span className="text-base font-semibold font-mono text-stone-800 mt-0.5 block tabular-nums">
                {unbudgetedResult.ingredientPlans.filter((p) => p.status === 'optimal_within_limits').length} / {unbudgetedResult.ingredientPlans.length}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-stone-500 uppercase font-medium block">Objective</span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => onChangeObjective('lowest_checkout_cost')}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    objective === 'lowest_checkout_cost' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  Cost
                </button>
                <button
                  type="button"
                  onClick={() => onChangeObjective('least_estimated_leftover')}
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    objective === 'least_estimated_leftover' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  Leftover
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Package Shopping List */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Shopping Recommendations
          </h2>
          <span className="text-[11px] font-mono text-stone-400">
            {recipe.targetServings} Servings
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {budgetMode && budgetResult ? (
            budgetResult.items.map((item) => {
              const req = recipe.requirements.find((r) => r.id === item.requirementId);
              const isIncluded = item.status === 'included';
              const isPantry = item.status === 'covered_by_pantry';
              const isOmitted = item.status === 'omitted_optional';

              return (
                <div
                  key={item.requirementId}
                  className={`p-4 transition-colors ${
                    isOmitted ? 'bg-stone-50/50 opacity-60' : 'hover:bg-stone-50/40'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-stone-900">{req?.displayName}</span>
                      <span className="text-stone-300">·</span>
                      <span className="text-[11px] text-stone-500 capitalize">{item.priority}</span>
                      {isOmitted && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-[11px] text-amber-800 font-medium">Omitted</span>
                        </>
                      )}
                      {isPantry && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-[11px] text-[#3E4F32] font-medium">Pantry covered</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs font-mono tabular-nums font-semibold text-stone-900">
                      {item.costCents !== null ? `$${(item.costCents / 100).toFixed(2)}` : '—'}
                    </div>
                  </div>

                  {isIncluded && item.selections.length > 0 && (
                    <div className="mt-2 text-xs text-stone-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-medium text-[#3E4F32]">
                        {item.selections.map((s) => {
                          const pkg = packages.find((p) => p.id === s.packageId);
                          return `${s.count}× ${pkg?.displayName || s.packageId}`;
                        }).join(' + ')}
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-500 font-mono text-[11px]">
                        Provides {formatCanonicalQuantity(parseInt(item.fulfilledCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)}
                        {parseInt(item.leftoverCanonicalQuantity, 10) > 0 && (
                          <span> ({formatCanonicalQuantity(parseInt(item.leftoverCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)} leftover)</span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-stone-400">
                    {item.explanation}
                  </div>
                </div>
              );
            })
          ) : unbudgetedResult ? (
            unbudgetedResult.ingredientPlans.map((plan) => {
              const req = recipe.requirements.find((r) => r.id === plan.ingredientId);

              return (
                <div key={plan.ingredientId} className="p-4 hover:bg-stone-50/40 transition-colors">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="font-semibold text-xs text-stone-900">{req?.displayName}</span>
                      <span className="text-stone-300 mx-1.5">·</span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        Need {formatCanonicalQuantity(parseInt(plan.requiredCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)}
                      </span>
                    </div>

                    <div className="text-xs font-mono tabular-nums font-semibold text-stone-900">
                      {plan.ingredientCostCents !== undefined
                        ? `$${(plan.ingredientCostCents / 100).toFixed(2)}`
                        : '—'}
                    </div>
                  </div>

                  {plan.selections.length > 0 && (
                    <div className="mt-2 text-xs text-stone-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-medium text-[#3E4F32]">
                        {plan.selections.map((s) => {
                          const pkg = packages.find((p) => p.id === s.packageId);
                          return `${s.count}× ${pkg?.displayName || s.packageId}`;
                        }).join(' + ')}
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-500 font-mono text-[11px]">
                        Yields {plan.providedCanonicalQuantity ? formatCanonicalQuantity(parseInt(plan.providedCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit) : '0'}
                        {plan.leftoverCanonicalQuantity && parseInt(plan.leftoverCanonicalQuantity, 10) > 0 && (
                          <span> ({formatCanonicalQuantity(parseInt(plan.leftoverCanonicalQuantity, 10), req?.dimension || 'mass', req?.baseUnit)} leftover)</span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-stone-400">
                    {plan.explanation}
                  </div>
                </div>
              );
            })
          ) : null}
        </div>
      </div>

      {/* Export & Actions Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit Packages</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#3E4F32]" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition"
          >
            <FileText className="w-3.5 h-3.5 text-[#3E4F32]" />
            <span>JSON</span>
          </button>
          <button
            onClick={onStartOver}
            className="px-3.5 py-1.5 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] text-xs font-medium text-white transition shadow-xs"
          >
            New Plan
          </button>
        </div>
      </div>
    </div>
  );
};
