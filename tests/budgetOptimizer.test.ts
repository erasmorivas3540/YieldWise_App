import { describe, expect, it } from 'vitest';
import { optimizeIngredient, optimizeRecipe } from '../src/algorithms/budgetOptimizer';
import { DEMO_MEALS } from '../src/services/demoData';
import { GroceryPackage } from '../src/types';

describe('budgetOptimizer - unbudgeted optimization (v1.0 baseline)', () => {
  const chickenPkgs: GroceryPackage[] = [
    {
      id: 'chicken-600',
      canonicalIngredientId: 'chicken',
      displayName: 'Chicken 600g',
      foodForm: 'raw_boneless',
      dimension: 'mass',
      packAmount: '600',
      packUnit: 'g',
      priceCents: 660,
      edibleYieldPpm: 1000000,
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    },
    {
      id: 'chicken-1200',
      canonicalIngredientId: 'chicken',
      displayName: 'Chicken 1200g',
      foodForm: 'raw_boneless',
      dimension: 'mass',
      packAmount: '1200',
      packUnit: 'g',
      priceCents: 1200,
      edibleYieldPpm: 1000000,
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    },
  ];

  it('one $12.00 1200 g chicken pack beats two $6.60 600 g packs for required 1020 g', () => {
    const plan = optimizeIngredient('chk', 1020000, chickenPkgs, 'lowest_checkout_cost');
    expect(plan.status).toBe('optimal_within_limits');
    expect(plan.ingredientCostCents).toBe(1200); // $12.00 vs $13.20 (2x 6.60)
    expect(plan.selections).toHaveLength(1);
    expect(plan.selections[0].packageId).toBe('chicken-1200');
    expect(plan.selections[0].count).toBe(1);
    expect(plan.leftoverCanonicalQuantity).toBe('180000'); // 180g leftover
  });

  it('450 g rice requirement selects one 500 g $2.20 pack rather than 1000 g $3.90 pack', () => {
    const ricePkgs: GroceryPackage[] = [
      {
        id: 'rice-500',
        canonicalIngredientId: 'rice',
        displayName: 'Rice 500g',
        foodForm: 'dry_grain',
        dimension: 'mass',
        packAmount: '500',
        packUnit: 'g',
        priceCents: 220,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'rice-1000',
        canonicalIngredientId: 'rice',
        displayName: 'Rice 1000g',
        foodForm: 'dry_grain',
        dimension: 'mass',
        packAmount: '1000',
        packUnit: 'g',
        priceCents: 390,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    const plan = optimizeIngredient('rc', 450000, ricePkgs, 'lowest_checkout_cost');
    expect(plan.status).toBe('optimal_within_limits');
    expect(plan.ingredientCostCents).toBe(220); // $2.20
    expect(plan.selections[0].packageId).toBe('rice-500');
    expect(plan.selections[0].count).toBe(1);
    expect(plan.leftoverCanonicalQuantity).toBe('50000'); // 50g leftover
  });

  it('720 g broccoli post-trim requirement chooses one 1000 g pack ($4.60) rather than two 500 g packs ($5.00)', () => {
    const broccoliPkgs: GroceryPackage[] = [
      {
        id: 'broccoli-500',
        canonicalIngredientId: 'broccoli',
        displayName: 'Broccoli 500g',
        foodForm: 'raw_whole',
        dimension: 'mass',
        packAmount: '500',
        packUnit: 'g',
        priceCents: 250,
        edibleYieldPpm: 800000, // 80% yield -> 400g usable
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'broccoli-1000',
        canonicalIngredientId: 'broccoli',
        displayName: 'Broccoli 1000g',
        foodForm: 'raw_whole',
        dimension: 'mass',
        packAmount: '1000',
        packUnit: 'g',
        priceCents: 460,
        edibleYieldPpm: 800000, // 80% yield -> 800g usable
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    const plan = optimizeIngredient('brc', 720000, broccoliPkgs, 'lowest_checkout_cost');
    expect(plan.status).toBe('optimal_within_limits');
    expect(plan.ingredientCostCents).toBe(460); // $4.60
    expect(plan.selections[0].packageId).toBe('broccoli-1000');
    expect(plan.selections[0].count).toBe(1);
    expect(plan.leftoverCanonicalQuantity).toBe('80000'); // 80g leftover
  });

  it('exact MVP demo dinner for 6 optimizes to exactly $18.80 ($3.13 per serving)', () => {
    const demo = DEMO_MEALS[0];
    const result = optimizeRecipe(demo.recipe, demo.packages, {
      objective: 'lowest_checkout_cost',
      maxSkuOptionsPerIngredient: 4,
      maxPacksPerSku: 12,
      maxCombinationsPerIngredient: 100000,
    });

    expect(result.status).toBe('complete');
    expect(result.totalKnownCostCents).toBe(1880); // $18.80
    expect(result.costPerServingCents).toBe(313); // $3.13 rounded

    // Verify per-ingredient selections
    const chickenPlan = result.ingredientPlans.find((p) => p.ingredientId === 'chicken-req');
    expect(chickenPlan?.ingredientCostCents).toBe(1200);
    expect(chickenPlan?.selections[0].packageId).toBe('chicken-1200');

    const ricePlan = result.ingredientPlans.find((p) => p.ingredientId === 'rice-req');
    expect(ricePlan?.ingredientCostCents).toBe(220);
    expect(ricePlan?.selections[0].packageId).toBe('rice-500');

    const broccoliPlan = result.ingredientPlans.find((p) => p.ingredientId === 'broccoli-req');
    expect(broccoliPlan?.ingredientCostCents).toBe(460);
    expect(broccoliPlan?.selections[0].packageId).toBe('broccoli-1000');
  });

  it('tied cost selects lower leftover, and tied leftover selects fewer packages', () => {
    const pkgs: GroceryPackage[] = [
      {
        id: 'pkg-a',
        canonicalIngredientId: 'herb',
        displayName: 'Herb A (50g for $2)',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '50',
        packUnit: 'g',
        priceCents: 200,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-b',
        canonicalIngredientId: 'herb',
        displayName: 'Herb B (60g for $2)',
        foodForm: 'fresh',
        dimension: 'mass',
        packAmount: '60',
        packUnit: 'g',
        priceCents: 200,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    // Need 45g. Both cost $2.00 (200c).
    // pkg-a gives 50g -> 5g leftover.
    // pkg-b gives 60g -> 15g leftover.
    // Lowest checkout cost tie-break prioritizes lower leftover => selects pkg-a
    const plan = optimizeIngredient('herb-req', 45000, pkgs, 'lowest_checkout_cost');
    expect(plan.selections[0].packageId).toBe('pkg-a');
    expect(plan.leftoverCanonicalQuantity).toBe('5000');
  });

  it('least_estimated_leftover objective changes selections to minimize leftovers', () => {
    const pkgs: GroceryPackage[] = [
      {
        id: 'pkg-cheap-more-leftover',
        canonicalIngredientId: 'spice',
        displayName: 'Spice Large (100g, $3.00)',
        foodForm: 'powder',
        dimension: 'mass',
        packAmount: '100',
        packUnit: 'g',
        priceCents: 300,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
      {
        id: 'pkg-expensive-exact',
        canonicalIngredientId: 'spice',
        displayName: 'Spice Exact (50g, $4.00)',
        foodForm: 'powder',
        dimension: 'mass',
        packAmount: '50',
        packUnit: 'g',
        priceCents: 400,
        edibleYieldPpm: 1000000,
        formCompatible: true,
        provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
        reviewStatus: 'confirmed',
      },
    ];

    // Need 50g
    // Under lowest_checkout_cost: chooses 100g for $3.00 (50g leftover)
    const costPlan = optimizeIngredient('spice-req', 50000, pkgs, 'lowest_checkout_cost');
    expect(costPlan.selections[0].packageId).toBe('pkg-cheap-more-leftover');
    expect(costPlan.ingredientCostCents).toBe(300);

    // Under least_estimated_leftover: chooses 50g for $4.00 (0g leftover)
    const leftoverPlan = optimizeIngredient('spice-req', 50000, pkgs, 'least_estimated_leftover');
    expect(leftoverPlan.selections[0].packageId).toBe('pkg-expensive-exact');
    expect(leftoverPlan.ingredientCostCents).toBe(400);
    expect(leftoverPlan.leftoverCanonicalQuantity).toBe('0');
  });
});
