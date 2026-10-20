import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, DollarSign, ShieldAlert, Sparkles, AlertCircle, Check, Info } from 'lucide-react';
import { IngredientBudgetPreference, IngredientPriority, Recipe } from '../types';

interface BudgetSettingsProps {
  recipe: Recipe;
  budgetMode: boolean;
  budgetCents: number;
  priorities: Record<string, IngredientPriority>;
  onToggleBudgetMode: (enabled: boolean) => void;
  onUpdateBudgetCents: (cents: number) => void;
  onUpdatePriority: (reqId: string, priority: IngredientPriority) => void;
  onMarkAllEssential: () => void;
  onNext: () => void;
  onBack: () => void;
}

export const BudgetSettings: React.FC<BudgetSettingsProps> = ({
  recipe,
  budgetMode,
  budgetCents,
  priorities,
  onToggleBudgetMode,
  onUpdateBudgetCents,
  onUpdatePriority,
  onMarkAllEssential,
  onNext,
  onBack,
}) => {
  const [budgetInput, setBudgetInput] = useState((budgetCents / 100).toFixed(2));
  const [inputError, setInputError] = useState<string | null>(null);

  const handleBudgetInputChange = (val: string) => {
    setBudgetInput(val);

    if (!val.trim()) {
      setInputError('Budget cannot be empty.');
      return;
    }

    const parts = val.split('.');
    if (parts.length > 2) {
      setInputError('Invalid decimal format.');
      return;
    }
    if (parts.length === 2 && parts[1].length > 2) {
      setInputError('Budget cannot have more than two decimal places (cents).');
      return;
    }

    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) {
      setInputError('Budget must be a positive number.');
      return;
    }

    if (parsed > 300) {
      setInputError('Budget exceeds maximum pilot cap ($300.00).');
      return;
    }

    setInputError(null);
    onUpdateBudgetCents(Math.round(parsed * 100));
  };

  const allPrioritiesConfirmed = recipe.requirements.every((r) => Boolean(priorities[r.id]));
  const isValid = !budgetMode || (!inputError && allPrioritiesConfirmed);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Smart Budget & Ingredient Priorities</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Set an unyielding grocery budget ceiling. Protect your essential ingredients and let the deterministic solver fit whole packages of optional ingredients by priority.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 p-1.5 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => onToggleBudgetMode(false)}
            className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-sm font-semibold transition text-center ${
              !budgetMode
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            No Budget Limit (Full Recipe Purchase)
          </button>
          <button
            type="button"
            onClick={() => onToggleBudgetMode(true)}
            className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-sm font-semibold transition text-center ${
              budgetMode
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Spend Within My Budget (Smart Budget Mode)
          </button>
        </div>

        {budgetMode ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Budget Input Field */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Maximum Grocery Checkout Subtotal (USD)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-lg">
                  $
                </span>
                <input
                  type="text"
                  value={budgetInput}
                  onChange={(e) => handleBudgetInputChange(e.target.value)}
                  placeholder="16.00"
                  className={`w-full bg-slate-900 border ${
                    inputError ? 'border-rose-500' : 'border-slate-700'
                  } rounded-xl pl-8 pr-4 py-2.5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500`}
                />
              </div>

              {inputError ? (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{inputError}</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Pre-tax hard ceiling. Packages are indivisible; YieldWise will never suggest buying a partial grocery pack.
                </p>
              )}
            </div>

            {/* Ingredient Priorities */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Ingredient Importance Ranking</h3>
                  <p className="text-xs text-slate-400">
                    Essential items will never be omitted. If the budget cannot cover all essentials, a shortfall warning will be generated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onMarkAllEssential}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition w-fit"
                >
                  Mark All as Essential
                </button>
              </div>

              <div className="space-y-2">
                {recipe.requirements.map((req) => {
                  const currentPriority = priorities[req.id] || 'essential';

                  return (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl"
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-200">{req.displayName}</div>
                        <div className="text-xs text-slate-500">
                          {req.baseAmount} {req.baseUnit} per serving
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(['essential', 'high', 'medium', 'low'] as IngredientPriority[]).map((p) => {
                          const isSelected = currentPriority === p;
                          const labels: Record<IngredientPriority, string> = {
                            essential: "Essential (Don't omit)",
                            high: 'High Priority',
                            medium: 'Medium',
                            low: 'Low',
                          };

                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => onUpdatePriority(req.id, p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                isSelected
                                  ? p === 'essential'
                                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                                    : 'bg-indigo-600 text-white shadow-sm font-semibold'
                                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              {labels[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Disclosure box */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-300">Adapted Meal Notice: </span>
                If an optional ingredient cannot fit within your budget, YieldWise marks the result as an{' '}
                <span className="text-amber-300 font-medium">Adapted meal</span>. Omitted ingredients are explicitly declared so you can decide if the simplified dinner meets your plans.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Standard Unconstrained Mode</h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              YieldWise will find the optimal combination of packages to fulfill 100% of the recipe requirements at the lowest total checkout cost, or with the least estimated leftover food.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Requirements</span>
          </button>

          <button
            onClick={onNext}
            disabled={!isValid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm text-white shadow-sm transition"
          >
            <span>Compare Available Packages</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
