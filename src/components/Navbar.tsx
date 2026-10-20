import React from 'react';
import { ChefHat, Sparkles, RefreshCw, ShoppingCart, DollarSign, Layers, CheckCircle2 } from 'lucide-react';

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
  aiConfigured,
  totalCostCents,
  budgetMode,
  budgetCents,
}) => {
  const steps: { id: StepId; label: string; number: number }[] = [
    { id: 'plan', label: '1. Plan Dinner', number: 1 },
    { id: 'review', label: '2. Review Requirements', number: 2 },
    { id: 'budget', label: '3. Budget & Priorities', number: 3 },
    { id: 'packages', label: '4. Compare Packages', number: 4 },
    { id: 'results', label: '5. Optimized Cart', number: 5 },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Provisional Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">{APP_DISPLAY_NAME}</span>
                <span className="text-[10px] uppercase font-semibold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                  Demo v1.1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Grocery Portions, Trimming Yields & Budget Optimizer
              </p>
            </div>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-3">
            {aiConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Draft Ready</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <span>Deterministic Manual Mode</span>
              </span>
            )}

            {totalCostCents !== undefined && totalCostCents !== null && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Est. Total:</span>
                <span className="font-bold text-emerald-400">${(totalCostCents / 100).toFixed(2)}</span>
                {budgetMode && budgetCents !== undefined && (
                  <span className="text-slate-400">
                    / ${(budgetCents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={onReset}
              title="Reset plan"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <nav className="flex overflow-x-auto py-2 border-t border-slate-800/80 gap-1 sm:gap-2 no-scrollbar">
          {steps.map((s) => {
            const isActive = currentStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectStep(s.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
