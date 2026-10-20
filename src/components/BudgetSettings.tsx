import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { IngredientPriority, Recipe } from '../types';

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
      setInputError('Budget exceeds pilot cap ($300.00).');
      return;
    }

    setInputError(null);
    onUpdateBudgetCents(Math.round(parsed * 100));
  };

  const allPrioritiesConfirmed = recipe.requirements.every((r) => Boolean(priorities[r.id]));
  const isValid = !budgetMode || (!inputError && allPrioritiesConfirmed);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Budget & Priorities</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure a spending ceiling and specify which items must not be omitted.
          </p>
        </div>
      </div>

      {/* Mode Segmented Toggle */}
      <div className="bg-white border border-stone-200 rounded-xl p-1.5 flex gap-1 shadow-xs max-w-md">
        <button
          type="button"
          onClick={() => onToggleBudgetMode(false)}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
            !budgetMode
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          No Budget Limit
        </button>
        <button
          type="button"
          onClick={() => onToggleBudgetMode(true)}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition ${
            budgetMode
              ? 'bg-[#3E4F32] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Spend Within Budget
        </button>
      </div>

      {budgetMode ? (
        <div className="space-y-6">
          {/* Budget Field */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Maximum Grocery Checkout Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400 font-mono text-sm">
                  $
                </span>
                <input
                  type="text"
                  value={budgetInput}
                  onChange={(e) => handleBudgetInputChange(e.target.value)}
                  placeholder="16.00"
                  className={`w-full bg-[#FAF8F5] border ${
                    inputError ? 'border-rose-400' : 'border-stone-200'
                  } rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-semibold text-stone-900 focus:outline-none focus:border-[#3E4F32]`}
                />
              </div>
              {inputError && (
                <div className="text-[11px] text-rose-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{inputError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ingredient Priorities */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Ingredient Priorities</h2>
                <p className="text-xs text-stone-500">
                  Essentials are never omitted. Optionals are included by rank if the budget allows.
                </p>
              </div>
              <button
                type="button"
                onClick={onMarkAllEssential}
                className="text-xs text-stone-600 hover:text-stone-900 hover:underline underline-offset-2 transition"
              >
                Mark all essential
              </button>
            </div>

            <div className="space-y-2">
              {recipe.requirements.map((req) => {
                const currentPriority = priorities[req.id] || 'essential';

                return (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#FAF8F5] border border-stone-200/80 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-xs text-stone-900">{req.displayName}</span>
                      <span className="text-[11px] text-stone-500 ml-1.5 font-mono">
                        ({req.baseAmount} {req.baseUnit})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-md p-0.5">
                      {(['essential', 'high', 'medium', 'low'] as IngredientPriority[]).map((p) => {
                        const isSelected = currentPriority === p;
                        const labels: Record<IngredientPriority, string> = {
                          essential: 'Essential',
                          high: 'High',
                          medium: 'Med',
                          low: 'Low',
                        };

                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => onUpdatePriority(req.id, p)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                              isSelected
                                ? p === 'essential'
                                  ? 'bg-[#3E4F32] text-white shadow-xs'
                                  : 'bg-stone-800 text-white shadow-xs'
                                : 'text-stone-500 hover:text-stone-800'
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

            <div className="text-[11px] text-stone-500 pt-2 border-t border-stone-100">
              Omitted optional items are marked as an <span className="text-stone-700 font-medium">Adapted meal</span> so you always know what was left out.
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs text-xs text-stone-600">
          The optimizer will purchase sufficient whole packages for 100% of the recipe requirements at lowest checkout price.
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Requirements</span>
        </button>

        <button
          onClick={onNext}
          disabled={!isValid}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 font-medium text-xs text-white transition shadow-xs"
        >
          <span>Compare Packages</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
