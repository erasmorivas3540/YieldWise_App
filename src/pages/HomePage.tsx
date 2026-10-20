import React, { useEffect, useState } from 'react';
import { optimizeBudget, optimizeRecipe } from '../algorithms/budgetOptimizer';
import { BudgetSettings } from '../components/BudgetSettings';
import { MealPlanner } from '../components/MealPlanner';
import { Navbar, StepId } from '../components/Navbar';
import { PackageComparator } from '../components/PackageComparator';
import { RequirementsReview } from '../components/RequirementsReview';
import { ResultsCart } from '../components/ResultsCart';
import { DEMO_MEALS } from '../services/demoData';
import {
  BudgetOptimizationResult,
  GroceryPackage,
  IngredientPriority,
  OptimizationObjective,
  OptimizationResult,
  Recipe,
  VerifiedPantryEntry,
} from '../types';

export const HomePage: React.FC = () => {
  // Initial default: Demo 1 (Chicken, Rice, Broccoli)
  const defaultDemo = DEMO_MEALS[0];

  const [currentStep, setCurrentStep] = useState<StepId>('plan');
  const [recipe, setRecipe] = useState<Recipe>(defaultDemo.recipe);
  const [packages, setPackages] = useState<GroceryPackage[]>(defaultDemo.packages);
  const [verifiedPantry, setVerifiedPantry] = useState<VerifiedPantryEntry[]>([]);

  // Budget mode state
  const [budgetMode, setBudgetMode] = useState<boolean>(true);
  const [budgetCents, setBudgetCents] = useState<number>(defaultDemo.suggestedBudgetCents || 1600);
  const [priorities, setPriorities] = useState<Record<string, IngredientPriority>>(
    defaultDemo.suggestedPriorities || {
      'chicken-req': 'essential',
      'rice-req': 'essential',
      'broccoli-req': 'high',
    }
  );

  // Unbudgeted objective
  const [objective, setObjective] = useState<OptimizationObjective>('lowest_checkout_cost');

  // Solver outputs
  const [unbudgetedResult, setUnbudgetedResult] = useState<OptimizationResult | null>(null);
  const [budgetResult, setBudgetResult] = useState<BudgetOptimizationResult | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);

  // Check health / AI status
  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => {
        setAiConfigured(Boolean(data.aiConfigured));
      })
      .catch(() => {
        setAiConfigured(false);
      });
  }, []);

  // Recalculate results whenever inputs change
  useEffect(() => {
    try {
      // 1. Unbudgeted recipe run
      const unbudgeted = optimizeRecipe(recipe, packages, {
        objective,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      }, verifiedPantry);
      setUnbudgetedResult(unbudgeted);

      // 2. Budget mode run (if all ingredients have priorities)
      const hasAllPriorities = recipe.requirements.every((r) => Boolean(priorities[r.id]));
      if (hasAllPriorities) {
        const priorityPrefs = recipe.requirements.map((r) => ({
          ingredientRequirementId: r.id,
          priority: priorities[r.id] || 'essential',
          confirmedByUser: true,
        }));

        const bRes = optimizeBudget({
          schemaVersion: '1.1',
          recipe,
          packages,
          verifiedPantry,
          options: {
            mode: 'prioritize_ingredients',
            budgetCents,
            priorities: priorityPrefs,
            maxIngredients: 12,
            maxSkuOptionsPerIngredient: 4,
            maxPacksPerSku: 12,
            maxCombinationsPerIngredient: 100000,
          },
        });
        setBudgetResult(bRes);
      }
    } catch (err) {
      console.error('Calculation error:', err);
    }
  }, [recipe, packages, verifiedPantry, budgetCents, priorities, objective, budgetMode]);

  const handleLoadDemo = (demoId: string) => {
    const demo = DEMO_MEALS.find((d) => d.id === demoId);
    if (!demo) return;
    setRecipe(demo.recipe);
    setPackages(demo.packages);
    setVerifiedPantry(demo.verifiedPantry || []);
    setPriorities(demo.suggestedPriorities || {});
    if (demo.suggestedBudgetCents) {
      setBudgetCents(demo.suggestedBudgetCents);
    }
    setCurrentStep('plan');
  };

  const handleReset = () => {
    handleLoadDemo('demo-chicken-rice-broccoli');
  };

  const handleUpdatePriority = (reqId: string, priority: IngredientPriority) => {
    setPriorities((prev) => ({
      ...prev,
      [reqId]: priority,
    }));
  };

  const handleMarkAllEssential = () => {
    const allEssential: Record<string, IngredientPriority> = {};
    for (const r of recipe.requirements) {
      allEssential[r.id] = 'essential';
    }
    setPriorities(allEssential);
  };

  const handleExploreFewerServings = (newServings: number) => {
    setRecipe((prev) => ({
      ...prev,
      targetServings: Math.max(1, newServings),
    }));
    setCurrentStep('results');
  };

  const displayedCostCents = budgetMode
    ? budgetResult?.spentCents
    : unbudgetedResult?.totalKnownCostCents;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
        onReset={handleReset}
        aiConfigured={aiConfigured}
        totalCostCents={displayedCostCents}
        budgetMode={budgetMode}
        budgetCents={budgetCents}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'plan' && (
          <MealPlanner
            recipe={recipe}
            onUpdateRecipe={setRecipe}
            onLoadDemo={handleLoadDemo}
            onNext={() => setCurrentStep('review')}
            aiConfigured={aiConfigured}
          />
        )}

        {currentStep === 'review' && (
          <RequirementsReview
            recipe={recipe}
            verifiedPantry={verifiedPantry}
            onUpdatePantry={setVerifiedPantry}
            onConfirmRequirement={(id) => {}}
            onNext={() => setCurrentStep('budget')}
            onBack={() => setCurrentStep('plan')}
          />
        )}

        {currentStep === 'budget' && (
          <BudgetSettings
            recipe={recipe}
            budgetMode={budgetMode}
            budgetCents={budgetCents}
            priorities={priorities}
            onToggleBudgetMode={setBudgetMode}
            onUpdateBudgetCents={setBudgetCents}
            onUpdatePriority={handleUpdatePriority}
            onMarkAllEssential={handleMarkAllEssential}
            onNext={() => setCurrentStep('packages')}
            onBack={() => setCurrentStep('review')}
          />
        )}

        {currentStep === 'packages' && (
          <PackageComparator
            recipe={recipe}
            packages={packages}
            onUpdatePackages={setPackages}
            onNext={() => setCurrentStep('results')}
            onBack={() => setCurrentStep('budget')}
          />
        )}

        {currentStep === 'results' && (
          <ResultsCart
            recipe={recipe}
            packages={packages}
            budgetMode={budgetMode}
            unbudgetedResult={unbudgetedResult}
            budgetResult={budgetResult}
            objective={objective}
            onChangeObjective={setObjective}
            onExploreFewerServings={handleExploreFewerServings}
            onBack={() => setCurrentStep('packages')}
            onStartOver={handleReset}
          />
        )}
      </main>

      {/* Disclaimers Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p>
            YieldWise is an independent grocery portion & budget optimization prototype. Pre-tax prices are user-supplied or from clearly labeled synthetic demo data. Not live store prices or official USDA endorsements.
          </p>
          <p className="text-[11px] text-slate-600">
            Trimming yields are demo assumptions or user-verified factors. Excludes local sales tax, bottle deposits, and delivery fees.
          </p>
        </div>
      </footer>
    </div>
  );
};
