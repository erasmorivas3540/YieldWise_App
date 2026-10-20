import React from 'react';
import { RotateCcw } from 'lucide-react';

export const APP_DISPLAY_NAME = 'YieldWise';

export type StepId = 'plan' | 'review' | 'budget' | 'packages' | 'results';

interface NavbarProps {
  currentStep: StepId;
  onSelectStep: (step: StepId) => void;
  onReset: () => void;
  aiConfigured: boolean;
  totalCostCents?: number | null;
  budgetMode: boolean;
  budgetCents?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  onSelectStep,
  onReset,
  totalCostCents,
  budgetMode,
  budgetCents,
}) => {
  const steps: { id: StepId; label: string; number: number }[] = [
    { id: 'plan', label: 'Plan', number: 1 },
    { id: 'review', label: 'Requirements', number: 2 },
    { id: 'budget', label: 'Budget', number: 3 },
    { id: 'packages', label: 'Packages', number: 4 },
    { id: 'results', label: 'Cart', number: 5 },
  ];

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-stone-900 tracking-tight text-base">
              {APP_DISPLAY_NAME}
            </span>
            <span className="text-stone-400 font-light hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-xs text-stone-500 font-normal hidden sm:inline">
              Grocery Portion & Budget Optimizer
            </span>
          </div>

          {/* Step Nav */}
          <nav className="flex items-center gap-1 sm:gap-4">
            {steps.map((s) => {
              const isActive = currentStep === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectStep(s.id)}
                  className={`text-xs transition-colors py-1 px-1.5 sm:px-2 rounded flex items-center gap-1 ${
                    isActive
                      ? 'text-[#3E4F32] font-semibold border-b-2 border-[#3E4F32]'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <span className="text-[11px] font-mono text-stone-400">{s.number}.</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Cart Metric & Reset */}
          <div className="flex items-center gap-3">
            {totalCostCents !== undefined && totalCostCents !== null && (
              <div className="text-xs text-stone-600 font-mono tabular-nums hidden md:block">
                <span>Est: </span>
                <span className="font-semibold text-stone-900">${(totalCostCents / 100).toFixed(2)}</span>
                {budgetMode && budgetCents !== undefined && (
                  <span className="text-stone-400"> / ${(budgetCents / 100).toFixed(2)}</span>
                )}
              </div>
            )}

            <button
              onClick={onReset}
              title="Reset to default recipe"
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
