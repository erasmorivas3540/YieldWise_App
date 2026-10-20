import { describe, expect, it } from 'vitest';
import { optimizeBudget } from '../src/algorithms/budgetOptimizer';
import { DEMO_MEALS } from '../src/services/demoData';
import {
  BudgetOptimizationRequest,
  GroceryPackage,
  IngredientBudgetPreference,
  Recipe,
  VerifiedPantryEntry,
} from '../src/types';

describe('Smart Budget Mode - Authoritative Golden Acceptance Tests', () => {
  const getDemoSetup = () => {
    const demo = DEMO_MEALS[0];
    const recipe: Recipe = JSON.parse(JSON.stringify(demo.recipe));
    const packages: GroceryPackage[] = JSON.parse(JSON.stringify(demo.packages));
    const verifiedPantry: VerifiedPantryEntry[] = [];
    return { recipe, packages, verifiedPantry };
  };

  it('Case 1: budget-full-1880 - funds complete meal within budget', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1880,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('complete_original_within_budget');
    expect(res.spentCents).toBe(1880);
    expect(res.remainingCents).toBe(0);
    expect(res.isAdaptedRecipe).toBe(false);

    const includedIds = res.items.filter((i) => i.status === 'included').map((i) => i.requirementId);
    expect(includedIds).toContain('chicken-req');
    expect(includedIds).toContain('rice-req');
    expect(includedIds).toContain('broccoli-req');
  });

  it('Case 2: budget-adapted-1600 - protects essentials, omits optional, marks adapted', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('adapted_within_budget');
    expect(res.spentCents).toBe(1420); // chicken 1200 + rice 220
    expect(res.remainingCents).toBe(180);
    expect(res.isAdaptedRecipe).toBe(true);

    const includedIds = res.items.filter((i) => i.status === 'included').map((i) => i.requirementId);
    expect(includedIds).toContain('chicken-req');
    expect(includedIds).toContain('rice-req');

    const omittedIds = res.items.filter((i) => i.status === 'omitted_optional').map((i) => i.requirementId);
    expect(omittedIds).toContain('broccoli-req');
  });

  it('Case 3: budget-shortfall-1400 - essentials exceed budget, honest shortfall reported', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1400,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('essential_over_budget');
    expect(res.cheapestEssentialCostCents).toBe(1420);
    expect(res.shortfallCents).toBe(20);
    expect(res.spentCents).toBeNull();
  });

  it('Case 4: budget-everything-essential-1600 - all essential with 1600 budget produces 280 shortfall', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'essential', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('essential_over_budget');
    expect(res.cheapestEssentialCostCents).toBe(1880);
    expect(res.shortfallCents).toBe(280);
    expect(res.spentCents).toBeNull();
  });

  it('Case 5: budget-pantry-chicken - pantry chicken offsets requirement and covers essential', () => {
    const { recipe, packages } = getDemoSetup();
    const verifiedPantry: VerifiedPantryEntry[] = [
      {
        ingredientRequirementId: 'chicken-req',
        usableCanonicalQuantity: '1020000', // fully covers 1020g requirement
        dimension: 'mass',
        foodForm: 'raw_boneless',
        provenance: { type: 'USER_CONFIRMED', sourceLabel: 'pantry', confirmedByUser: true },
        confirmedByUser: true,
      },
    ];

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 700,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('complete_original_within_budget');
    expect(res.spentCents).toBe(680); // rice 220 + broccoli 460
    expect(res.remainingCents).toBe(20);

    const pantryItem = res.items.find((i) => i.requirementId === 'chicken-req');
    expect(pantryItem?.status).toBe('covered_by_pantry');
  });

  it('Case 6: budget-zero-all-pantry - $0.00 budget is valid when all items covered by pantry', () => {
    const { recipe, packages } = getDemoSetup();
    const verifiedPantry: VerifiedPantryEntry[] = [
      {
        ingredientRequirementId: 'chicken-req',
        usableCanonicalQuantity: '1020000',
        dimension: 'mass',
        foodForm: 'raw_boneless',
        provenance: { type: 'USER_CONFIRMED', sourceLabel: 'pantry', confirmedByUser: true },
        confirmedByUser: true,
      },
      {
        ingredientRequirementId: 'rice-req',
        usableCanonicalQuantity: '450000',
        dimension: 'mass',
        foodForm: 'dry_grain',
        provenance: { type: 'USER_CONFIRMED', sourceLabel: 'pantry', confirmedByUser: true },
        confirmedByUser: true,
      },
      {
        ingredientRequirementId: 'broccoli-req',
        usableCanonicalQuantity: '720000',
        dimension: 'mass',
        foodForm: 'raw_edible_trimmed',
        provenance: { type: 'USER_CONFIRMED', sourceLabel: 'pantry', confirmedByUser: true },
        confirmedByUser: true,
      },
    ];

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 0,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('complete_original_within_budget');
    expect(res.spentCents).toBe(0);
    expect(res.remainingCents).toBe(0);
    expect(res.items.every((i) => i.status === 'covered_by_pantry')).toBe(true);
  });

  it('Case 7: budget-invalid-priority - missing priority throws MISSING_CONFIRMED_PRIORITY', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    // Missing broccoli priority
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    expect(() => optimizeBudget(req)).toThrowError();
    try {
      optimizeBudget(req);
    } catch (err: any) {
      expect(err.code).toBe('MISSING_CONFIRMED_PRIORITY');
    }
  });

  it('Case 8: budget-missing-essential-price - blocks optimization when essential price missing', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    // Set chicken packages price to null
    for (const p of packages) {
      if (p.canonicalIngredientId === 'chicken') {
        p.priceCents = null;
      }
    }

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('blocked_missing_input');
    expect(res.spentCents).toBeNull();
  });

  it('Case 9: budget-missing-optional-price - blocks optimization when optional price missing', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    // Set broccoli packages price to null
    for (const p of packages) {
      if (p.canonicalIngredientId === 'broccoli') {
        p.priceCents = null;
      }
    }

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('blocked_missing_input');
    expect(res.optimalWithinDeclaredBounds).toBe(false);
  });

  it('Case 10: budget-requirement-beyond-solver-cap - reports out_of_solver_limits', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    // Huge rice requirement: 200,000,000 mg (200 kg)
    recipe.requirements.find((r) => r.id === 'rice-req')!.baseAmount = '33333333';

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 30000,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('out_of_solver_limits');
  });

  it('Case 11: budget-tier-high-beats-low - high priority ($2.50) beats low ($0.75) within $9.50', () => {
    // Pasta ($4.00, essential), Sauce ($3.00, essential), Veg ($2.50, high), Herbs ($0.75, low)
    const recipe: Recipe = {
      id: 'pasta-dinner',
      title: 'Pasta Dinner',
      targetServings: 1,
      source: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      requirements: [
        {
          id: 'pasta',
          canonicalIngredientId: 'pasta',
          displayName: 'Pasta',
          foodForm: 'dry',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '500',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'sauce',
          canonicalIngredientId: 'sauce',
          displayName: 'Sauce',
          foodForm: 'jar',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '400',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'vegetables',
          canonicalIngredientId: 'veg',
          displayName: 'Vegetables',
          foodForm: 'fresh',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '300',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'herbs',
          canonicalIngredientId: 'herbs',
          displayName: 'Herbs',
          foodForm: 'fresh',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '20',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
      ],
    };

    const packages: GroceryPackage[] = [
      {
        id: 'pkg-pasta',
        canonicalIngredientId: 'pasta',
        displayName: 'Pasta 500g',
        foodForm: 'dry',
        dimension: 'mass',
        packAmount: '500',
        packUnit: 'g',
        priceCents: 400,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-sauce',
        canonicalIngredientId: 'sauce',
        displayName: 'Sauce Jar',
        foodForm: 'jar',
        dimension: 'mass',
        packAmount: '400',
        packUnit: 'g',
        priceCents: 300,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-veg',
        canonicalIngredientId: 'veg',
        displayName: 'Vegetables Mix',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '300',
        packUnit: 'g',
        priceCents: 250,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-herbs',
        canonicalIngredientId: 'herbs',
        displayName: 'Fresh Herbs',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '20',
        packUnit: 'g',
        priceCents: 75,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'pasta', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'sauce', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'vegetables', priority: 'high', confirmedByUser: true },
      { ingredientRequirementId: 'herbs', priority: 'low', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry: [],
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 950,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('adapted_within_budget');
    expect(res.spentCents).toBe(950); // 400 + 300 + 250
    expect(res.remainingCents).toBe(0);

    const included = res.items.filter((i) => i.status === 'included').map((i) => i.requirementId);
    expect(included).toEqual(['pasta', 'sauce', 'vegetables']);
    const omitted = res.items.filter((i) => i.status === 'omitted_optional').map((i) => i.requirementId);
    expect(omitted).toEqual(['herbs']);
  });

  it('Case 12: budget-unaffordable-high-low-fits - when high cannot fit, low is selected', () => {
    // Same pasta dinner but budget is $9.00 (900c).
    // Essentials = 400 + 300 = 700. Remaining discretionary = 200.
    // Veg ($2.50) cannot fit (250 > 200). Herbs ($0.75) fits (75 <= 200).
    // Total spent = 700 + 75 = 775. Remaining = 900 - 775 = 125.
    const recipe: Recipe = {
      id: 'pasta-dinner',
      title: 'Pasta Dinner',
      targetServings: 1,
      source: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      requirements: [
        {
          id: 'pasta',
          canonicalIngredientId: 'pasta',
          displayName: 'Pasta',
          foodForm: 'dry',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '500',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'sauce',
          canonicalIngredientId: 'sauce',
          displayName: 'Sauce',
          foodForm: 'jar',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '400',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'vegetables',
          canonicalIngredientId: 'veg',
          displayName: 'Vegetables',
          foodForm: 'fresh',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '300',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'herbs',
          canonicalIngredientId: 'herbs',
          displayName: 'Herbs',
          foodForm: 'fresh',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '20',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
      ],
    };

    const packages: GroceryPackage[] = [
      {
        id: 'pkg-pasta',
        canonicalIngredientId: 'pasta',
        displayName: 'Pasta 500g',
        foodForm: 'dry',
        dimension: 'mass',
        packAmount: '500',
        packUnit: 'g',
        priceCents: 400,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-sauce',
        canonicalIngredientId: 'sauce',
        displayName: 'Sauce Jar',
        foodForm: 'jar',
        dimension: 'mass',
        packAmount: '400',
        packUnit: 'g',
        priceCents: 300,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-veg',
        canonicalIngredientId: 'veg',
        displayName: 'Vegetables Mix',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '300',
        packUnit: 'g',
        priceCents: 250,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-herbs',
        canonicalIngredientId: 'herbs',
        displayName: 'Fresh Herbs',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '20',
        packUnit: 'g',
        priceCents: 75,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'pasta', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'sauce', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'vegetables', priority: 'high', confirmedByUser: true },
      { ingredientRequirementId: 'herbs', priority: 'low', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry: [],
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 900,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('adapted_within_budget');
    expect(res.spentCents).toBe(775);
    expect(res.remainingCents).toBe(125);

    const included = res.items.filter((i) => i.status === 'included').map((i) => i.requirementId);
    expect(included).toEqual(['pasta', 'sauce', 'herbs']);
    const omitted = res.items.filter((i) => i.status === 'omitted_optional').map((i) => i.requirementId);
    expect(omitted).toEqual(['vegetables']);
  });

  it('Case 13: budget-only-essentials - meal with only essentials within budget is not marked adapted', () => {
    const recipe: Recipe = {
      id: 'simple-bake',
      title: 'Simple Bake',
      targetServings: 1,
      source: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      requirements: [
        {
          id: 'flour',
          canonicalIngredientId: 'flour',
          displayName: 'Flour',
          foodForm: 'dry',
          dimension: 'mass',
          state: 'raw_edible',
          baseAmount: '500',
          baseUnit: 'g',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
        {
          id: 'eggs',
          canonicalIngredientId: 'eggs',
          displayName: 'Eggs',
          foodForm: 'whole',
          dimension: 'count',
          state: 'count',
          baseAmount: '6',
          baseUnit: 'count',
          baseServings: 1,
          provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
          reviewStatus: 'confirmed',
        },
      ],
    };

    const packages: GroceryPackage[] = [
      {
        id: 'pkg-flour',
        canonicalIngredientId: 'flour',
        displayName: 'Flour 1kg',
        foodForm: 'dry',
        dimension: 'mass',
        packAmount: '1000',
        packUnit: 'g',
        priceCents: 220,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-eggs',
        canonicalIngredientId: 'eggs',
        displayName: 'Carton 6 Eggs',
        foodForm: 'whole',
        dimension: 'count',
        packAmount: '6',
        packUnit: 'count',
        priceCents: 350,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'flour', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'eggs', priority: 'essential', confirmedByUser: true },
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry: [],
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1000,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res = optimizeBudget(req);
    expect(res.status).toBe('complete_original_within_budget');
    expect(res.spentCents).toBe(570); // 220 + 350
    expect(res.remainingCents).toBe(430);
    expect(res.isAdaptedRecipe).toBe(false);
  });

  it('Case 14: budget-price-as-cents validation helper', () => {
    // Tests input string parsing: rejects > 2 decimals or negative
    const validateBudgetInput = (inputStr: string) => {
      const parts = inputStr.split('.');
      if (parts.length > 2) return { ok: false, code: 'INVALID_DECIMAL_FORMAT' };
      if (parts.length === 2 && parts[1].length > 2) {
        return { ok: false, code: 'BUDGET_HAS_MORE_THAN_TWO_DECIMALS' };
      }
      const num = parseFloat(inputStr);
      if (isNaN(num) || num < 0) return { ok: false, code: 'INVALID_NUMBER' };
      return { ok: true, cents: Math.round(num * 100) };
    };

    expect(validateBudgetInput('12.345')).toEqual({
      ok: false,
      code: 'BUDGET_HAS_MORE_THAN_TWO_DECIMALS',
    });
    expect(validateBudgetInput('16.00')).toEqual({ ok: true, cents: 1600 });
    expect(validateBudgetInput('16')).toEqual({ ok: true, cents: 1600 });
  });

  it('Case 15: budget-priority-unconfirmed - unconfirmed priority throws PRIORITY_NOT_CONFIRMED', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: false }, // UNCONFIRMED
    ];

    const req: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    expect(() => optimizeBudget(req)).toThrowError();
    try {
      optimizeBudget(req);
    } catch (err: any) {
      expect(err.code).toBe('PRIORITY_NOT_CONFIRMED');
    }
  });

  it('Case 16: budget-client-edit-invalidates-result - changing budget from 1600 to 1880 updates status', () => {
    const { recipe, packages, verifiedPantry } = getDemoSetup();
    const priorities: IngredientBudgetPreference[] = [
      { ingredientRequirementId: 'chicken-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'rice-req', priority: 'essential', confirmedByUser: true },
      { ingredientRequirementId: 'broccoli-req', priority: 'high', confirmedByUser: true },
    ];

    const req1600: BudgetOptimizationRequest = {
      schemaVersion: '1.1',
      recipe,
      packages,
      verifiedPantry,
      options: {
        mode: 'prioritize_ingredients',
        budgetCents: 1600,
        priorities,
        maxIngredients: 12,
        maxSkuOptionsPerIngredient: 4,
        maxPacksPerSku: 12,
        maxCombinationsPerIngredient: 100000,
      },
    };

    const res1600 = optimizeBudget(req1600);
    expect(res1600.status).toBe('adapted_within_budget');
    expect(res1600.spentCents).toBe(1420);

    // Edit budget to 1880
    const req1880: BudgetOptimizationRequest = {
      ...req1600,
      options: {
        ...req1600.options,
        budgetCents: 1880,
      },
    };

    const res1880 = optimizeBudget(req1880);
    expect(res1880.status).toBe('complete_original_within_budget');
    expect(res1880.spentCents).toBe(1880);
  });
});
