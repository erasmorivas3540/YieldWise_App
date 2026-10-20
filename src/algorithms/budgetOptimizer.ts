import {
  BudgetItemResult,
  BudgetOptimizationRequest,
  BudgetOptimizationResult,
  BudgetResultStatus,
  GroceryPackage,
  IngredientPlanResult,
  OptimizationObjective,
  OptimizationOptions,
  OptimizationResult,
  PurchaseSelection,
  Recipe,
  VerifiedPantryEntry,
} from '../types';
import { scaleRequirement } from './portionCalculator';
import { evaluatePackageUsability, EvaluatedPackage } from './yieldCalculator';

export const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  objective: 'lowest_checkout_cost',
  maxSkuOptionsPerIngredient: 4,
  maxPacksPerSku: 12,
  maxCombinationsPerIngredient: 100000,
};

/**
 * Deterministic stable tie-break string for package selections
 */
function stableSkuTieBreak(vector: number[], packages: EvaluatedPackage[]): string {
  return vector
    .map((count, idx) => `${packages[idx].package.id}:${count}`)
    .sort()
    .join('|');
}

/**
 * Optimizes package purchase for a single ingredient requirement
 */
export function optimizeIngredient(
  ingredientId: string,
  requiredCanonical: number,
  packages: GroceryPackage[],
  objective: OptimizationObjective = 'lowest_checkout_cost',
  options: Partial<OptimizationOptions> = {}
): IngredientPlanResult {
  const maxSkus = options.maxSkuOptionsPerIngredient ?? DEFAULT_OPTIMIZATION_OPTIONS.maxSkuOptionsPerIngredient;
  const maxPacks = options.maxPacksPerSku ?? DEFAULT_OPTIMIZATION_OPTIONS.maxPacksPerSku;
  const maxCombos = options.maxCombinationsPerIngredient ?? DEFAULT_OPTIMIZATION_OPTIONS.maxCombinationsPerIngredient;

  // Evaluate all packages
  const evaluated = packages.map(evaluatePackageUsability);
  const eligible = evaluated.filter((ep) => ep.isValid);
  const excluded = evaluated
    .filter((ep) => !ep.isValid)
    .map((ep) => ({
      packageId: ep.package.id,
      reasonCode: ep.exclusionReason || 'INVALID',
    }));

  const warnings: string[] = [];

  // If requirement is 0 (e.g. 100% covered by pantry)
  if (requiredCanonical === 0) {
    return {
      ingredientId,
      status: 'optimal_within_limits',
      requiredCanonicalQuantity: '0',
      providedCanonicalQuantity: '0',
      leftoverCanonicalQuantity: '0',
      selections: [],
      ingredientCostCents: 0,
      consideredPackageIds: eligible.map((e) => e.package.id),
      excluded,
      warnings,
      explanation: 'Fully covered by verified pantry stock. No purchase needed.',
    };
  }

  // If no eligible packages exist
  if (eligible.length === 0) {
    return {
      ingredientId,
      status: 'missing_input',
      requiredCanonicalQuantity: requiredCanonical.toString(),
      selections: [],
      consideredPackageIds: [],
      excluded,
      warnings: ['No valid, verified, and compatible packages available.'],
      explanation: 'No valid package options available for this ingredient.',
    };
  }

  // Check SKU limit
  if (eligible.length > maxSkus) {
    return {
      ingredientId,
      status: 'out_of_solver_limits',
      requiredCanonicalQuantity: requiredCanonical.toString(),
      selections: [],
      consideredPackageIds: eligible.map((e) => e.package.id),
      excluded,
      warnings: [`Eligible package count (${eligible.length}) exceeds maximum limit of ${maxSkus}.`],
      explanation: 'Too many package options for bounded solver.',
    };
  }

  // Pre-check if maximum capacity across all SKUs within pack limits can satisfy requirement
  const maxTheoreticalCapacity = eligible.reduce(
    (sum, ep) => sum + maxPacks * ep.usableCanonicalCapacity,
    0
  );
  if (maxTheoreticalCapacity < requiredCanonical) {
    return {
      ingredientId,
      status: 'out_of_solver_limits',
      requiredCanonicalQuantity: requiredCanonical.toString(),
      selections: [],
      consideredPackageIds: eligible.map((e) => e.package.id),
      excluded,
      warnings: [
        `Requirement of ${requiredCanonical} exceeds the maximum purchase capacity (${maxTheoreticalCapacity}) within ${maxPacks} packs per SKU.`,
      ],
      explanation: 'Requirement exceeds solver search bounds.',
    };
  }

  // Exact Bounded Enumeration
  const skuCount = eligible.length;
  let bestVector: number[] | null = null;
  let bestRanking: (number | string)[] | null = null;
  let combinationsChecked = 0;

  // Helper for generating combinations 0..maxPacks
  const currentVector = new Array(skuCount).fill(0);

  function search(idx: number): boolean {
    if (idx === skuCount) {
      combinationsChecked++;
      if (combinationsChecked > maxCombos) {
        return false; // cap reached
      }

      // Check capacity
      let capacity = 0;
      let cost = 0;
      let totalPacks = 0;
      for (let j = 0; j < skuCount; j++) {
        const count = currentVector[j];
        if (count > 0) {
          capacity += count * eligible[j].usableCanonicalCapacity;
          cost += count * (eligible[j].package.priceCents || 0);
          totalPacks += count;
        }
      }

      if (capacity >= requiredCanonical) {
        const leftover = capacity - requiredCanonical;
        const tieBreak = stableSkuTieBreak(currentVector, eligible);

        const ranking: (number | string)[] =
          objective === 'lowest_checkout_cost'
            ? [cost, leftover, totalPacks, tieBreak]
            : [leftover, cost, totalPacks, tieBreak];

        if (bestRanking === null || isBetterRanking(ranking, bestRanking)) {
          bestRanking = ranking;
          bestVector = [...currentVector];
        }
      }
      return true;
    }

    for (let c = 0; c <= maxPacks; c++) {
      currentVector[idx] = c;
      const keepGoing = search(idx + 1);
      if (!keepGoing) return false;
    }
    return true;
  }

  const completed = search(0);

  if (!completed && bestVector === null) {
    return {
      ingredientId,
      status: 'out_of_solver_limits',
      requiredCanonicalQuantity: requiredCanonical.toString(),
      selections: [],
      consideredPackageIds: eligible.map((e) => e.package.id),
      excluded,
      warnings: ['Combination search cap reached without finding a verified solution.'],
      explanation: 'Search exceeded combination cap.',
    };
  }

  if (bestVector === null) {
    return {
      ingredientId,
      status: 'infeasible',
      requiredCanonicalQuantity: requiredCanonical.toString(),
      selections: [],
      consideredPackageIds: eligible.map((e) => e.package.id),
      excluded,
      warnings: ['No combination of packages can cover this requirement.'],
      explanation: 'Infeasible package combination.',
    };
  }

  // Format winning purchase selections
  const selections: PurchaseSelection[] = [];
  let providedCapacity = 0;
  let totalCostCents = 0;

  for (let j = 0; j < skuCount; j++) {
    const count = (bestVector as number[])[j];
    if (count > 0) {
      const pkg = eligible[j];
      const usable = count * pkg.usableCanonicalCapacity;
      const cost = count * (pkg.package.priceCents || 0);
      providedCapacity += usable;
      totalCostCents += cost;
      selections.push({
        packageId: pkg.package.id,
        count,
        usableQuantity: usable.toString(),
        costCents: cost,
      });
    }
  }

  const leftover = Math.max(0, providedCapacity - requiredCanonical);

  let explanation = '';
  if (objective === 'lowest_checkout_cost') {
    explanation = `Selected ${selections.map((s) => `${s.count}× ${packages.find((p) => p.id === s.packageId)?.displayName}`).join(' + ')} for lowest checkout cost ($${(totalCostCents / 100).toFixed(2)}) providing ${providedCapacity} canonical units with ${leftover} leftover.`;
  } else {
    explanation = `Selected ${selections.map((s) => `${s.count}× ${packages.find((p) => p.id === s.packageId)?.displayName}`).join(' + ')} to minimize leftover (${leftover} canonical units) at $${(totalCostCents / 100).toFixed(2)}.`;
  }

  return {
    ingredientId,
    status: 'optimal_within_limits',
    requiredCanonicalQuantity: requiredCanonical.toString(),
    providedCanonicalQuantity: providedCapacity.toString(),
    leftoverCanonicalQuantity: leftover.toString(),
    selections,
    ingredientCostCents: totalCostCents,
    consideredPackageIds: eligible.map((e) => e.package.id),
    excluded,
    warnings,
    explanation,
  };
}

function isBetterRanking(a: (number | string)[], b: (number | string)[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

/**
 * Optimizes purchase across all recipe ingredients without budget constraints (v1.0 baseline)
 */
export function optimizeRecipe(
  recipe: Recipe,
  packages: GroceryPackage[],
  options: OptimizationOptions = DEFAULT_OPTIMIZATION_OPTIONS,
  pantryEntries: VerifiedPantryEntry[] = []
): OptimizationResult {
  const scaledList = recipe.requirements.map((req) =>
    scaleRequirement(req, recipe.targetServings, pantryEntries)
  );

  const ingredientPlans: IngredientPlanResult[] = [];
  let totalKnownCostCents = 0;
  let hasBlocked = false;
  let hasMissing = false;

  for (const scaled of scaledList) {
    if (scaled.blocker) {
      hasBlocked = true;
      ingredientPlans.push({
        ingredientId: scaled.id,
        status: 'missing_input',
        requiredCanonicalQuantity: scaled.requiredCanonical.toString(),
        selections: [],
        consideredPackageIds: [],
        excluded: [],
        warnings: scaled.warnings,
        explanation: `Blocked: ${scaled.blocker}`,
      });
      continue;
    }

    const matchingPkgs = packages.filter(
      (p) => p.canonicalIngredientId === scaled.canonicalIngredientId
    );

    const plan = optimizeIngredient(
      scaled.id,
      scaled.requiredCanonical,
      matchingPkgs,
      options.objective,
      options
    );

    ingredientPlans.push(plan);

    if (plan.status !== 'optimal_within_limits') {
      if (plan.status === 'out_of_solver_limits' || plan.status === 'infeasible') {
        hasBlocked = true;
      } else {
        hasMissing = true;
      }
    } else {
      totalKnownCostCents += plan.ingredientCostCents || 0;
    }
  }

  const status = hasBlocked ? 'blocked' : hasMissing ? 'partial' : 'complete';
  const costPerServingCents = Math.round(totalKnownCostCents / (recipe.targetServings || 1));

  return {
    schemaVersion: '1.0',
    recipeId: recipe.id,
    targetServings: recipe.targetServings,
    objective: options.objective,
    status,
    currency: 'USD',
    totalKnownCostCents,
    costPerServingCents,
    ingredientPlans,
    assumptions: recipe.requirements.map((r) => r.provenance),
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Smart Budget Mode v1.1 authoritative optimization algorithm.
 * Follows YieldWise_Budget_Mode_Spec.md Section 5.
 */
export function optimizeBudget(request: BudgetOptimizationRequest): BudgetOptimizationResult {
  const { recipe, verifiedPantry, packages, options } = request;
  const budgetCents = options.budgetCents;

  // Validate budget cents
  if (
    !Number.isInteger(budgetCents) ||
    budgetCents < 0 ||
    budgetCents > (options.maxIngredients * 10000 || 30000)
  ) {
    throw new Error('BUDGET_INVALID_AMOUNT');
  }

  // Validate priorities: each recipe requirement must have a confirmed priority
  const priorityMap = new Map<string, { priority: string; confirmed: boolean }>();
  for (const pref of options.priorities) {
    priorityMap.set(pref.ingredientRequirementId, {
      priority: pref.priority,
      confirmed: pref.confirmedByUser,
    });
  }

  for (const req of recipe.requirements) {
    const pref = priorityMap.get(req.id);
    if (!pref) {
      const err: any = new Error('Missing confirmed priority for ingredient requirement');
      err.code = 'MISSING_CONFIRMED_PRIORITY';
      throw err;
    }
    if (!pref.confirmed) {
      const err: any = new Error(`Priority for ingredient ${req.displayName} not confirmed by user`);
      err.code = 'PRIORITY_NOT_CONFIRMED';
      throw err;
    }
  }

  // Step 1: Scale requirements and calculate lowest_checkout_cost full bundles for each ingredient
  interface IngredientBundleEvaluation {
    req: ReturnType<typeof scaleRequirement>;
    priority: 'essential' | 'high' | 'medium' | 'low';
    plan: IngredientPlanResult;
    minCostCents: number;
    usableCapacity: number;
    leftoverCanonical: number;
    totalPackages: number;
    isPantryCovered: boolean;
  }

  const evaluations: IngredientBundleEvaluation[] = [];
  const dataWarnings: string[] = [];
  let blockedReason: 'out_of_solver_limits' | 'blocked_missing_input' | null = null;

  for (const req of recipe.requirements) {
    const scaled = scaleRequirement(req, recipe.targetServings, verifiedPantry);
    const pref = priorityMap.get(req.id)!;
    const priority = pref.priority as 'essential' | 'high' | 'medium' | 'low';

    if (scaled.blocker) {
      blockedReason = 'blocked_missing_input';
      dataWarnings.push(`Ingredient ${req.displayName} has blocker: ${scaled.blocker}`);
      continue;
    }

    const matchingPkgs = packages.filter(
      (p) => p.canonicalIngredientId === req.canonicalIngredientId
    );

    const isPantryCovered = scaled.requiredCanonical === 0;

    const plan = optimizeIngredient(
      req.id,
      scaled.requiredCanonical,
      matchingPkgs,
      'lowest_checkout_cost',
      {
        maxSkuOptionsPerIngredient: options.maxSkuOptionsPerIngredient,
        maxPacksPerSku: options.maxPacksPerSku,
        maxCombinationsPerIngredient: options.maxCombinationsPerIngredient,
      }
    );

    if (plan.status === 'out_of_solver_limits') {
      blockedReason = 'out_of_solver_limits';
      dataWarnings.push(`Ingredient ${req.displayName} exceeded solver limits.`);
    } else if (plan.status !== 'optimal_within_limits' && !isPantryCovered) {
      blockedReason = 'blocked_missing_input';
      dataWarnings.push(`Ingredient ${req.displayName} has missing price, yield, or compatible package.`);
    }

    const totalPackages = plan.selections.reduce((sum, s) => sum + s.count, 0);
    const leftover = parseInt(plan.leftoverCanonicalQuantity || '0', 10);
    const cost = plan.ingredientCostCents ?? 0;
    const usable = parseInt(plan.providedCanonicalQuantity || '0', 10);

    evaluations.push({
      req: scaled,
      priority,
      plan,
      minCostCents: cost,
      usableCapacity: usable,
      leftoverCanonical: leftover,
      totalPackages,
      isPantryCovered,
    });
  }

  // If any ingredient calculation failed solver limits or missing inputs
  if (blockedReason) {
    return {
      schemaVersion: '1.1',
      calculationVersion: '1.1.0',
      recipeId: recipe.id,
      targetServings: recipe.targetServings,
      status: blockedReason,
      budgetCents,
      spentCents: null,
      remainingCents: null,
      cheapestEssentialCostCents: null,
      shortfallCents: null,
      fullRecipeCostCents: null,
      items: evaluations.map((e) => ({
        requirementId: e.req.id,
        priority: e.priority,
        status: 'blocked',
        selections: [],
        costCents: null,
        reasonCode: e.plan.status,
        requiredCanonicalQuantity: e.req.requiredCanonical.toString(),
        fulfilledCanonicalQuantity: '0',
        leftoverCanonicalQuantity: '0',
        explanation: e.plan.explanation || 'Requirement blocked',
      })),
      isAdaptedRecipe: false,
      allPricesVerified: false,
      optimalWithinDeclaredBounds: false,
      dataWarnings,
      assumptions: recipe.requirements.map((r) => r.provenance),
      calculatedAt: new Date().toISOString(),
    };
  }

  // Step 2: Separate essentials and optional items
  const essentials = evaluations.filter((e) => e.priority === 'essential');
  const optionals = evaluations.filter((e) => e.priority !== 'essential' && !e.isPantryCovered);
  const pantryCoveredOptionals = evaluations.filter(
    (e) => e.priority !== 'essential' && e.isPantryCovered
  );

  const cheapestEssentialCostCents = essentials.reduce((sum, e) => sum + e.minCostCents, 0);
  const fullRecipeCostCents = evaluations.reduce((sum, e) => sum + e.minCostCents, 0);

  // Check if essentials exceed budget
  if (cheapestEssentialCostCents > budgetCents) {
    const shortfallCents = cheapestEssentialCostCents - budgetCents;
    return {
      schemaVersion: '1.1',
      calculationVersion: '1.1.0',
      recipeId: recipe.id,
      targetServings: recipe.targetServings,
      status: 'essential_over_budget',
      budgetCents,
      spentCents: null,
      remainingCents: null,
      cheapestEssentialCostCents,
      shortfallCents,
      fullRecipeCostCents,
      items: evaluations.map((e) => ({
        requirementId: e.req.id,
        priority: e.priority,
        status: e.priority === 'essential' ? 'included' : 'omitted_optional',
        selections: e.plan.selections,
        costCents: e.minCostCents,
        reasonCode: e.priority === 'essential' ? 'ESSENTIAL_EXCEEDS_BUDGET' : 'OMITTED_DUE_TO_ESSENTIAL_SHORTFALL',
        requiredCanonicalQuantity: e.req.requiredCanonical.toString(),
        fulfilledCanonicalQuantity: e.usableCapacity.toString(),
        leftoverCanonicalQuantity: e.leftoverCanonical.toString(),
        explanation:
          e.priority === 'essential'
            ? `Essential ingredient ($${(e.minCostCents / 100).toFixed(2)}) contributes to budget shortfall of $${(shortfallCents / 100).toFixed(2)}.`
            : 'Omitted because essential ingredients exceed budget ceiling.',
      })),
      isAdaptedRecipe: true,
      allPricesVerified: true,
      optimalWithinDeclaredBounds: true,
      dataWarnings,
      assumptions: recipe.requirements.map((r) => r.provenance),
      calculatedAt: new Date().toISOString(),
    };
  }

  // Discretionary budget for optional items
  const discretionaryBudget = budgetCents - cheapestEssentialCostCents;

  // Step 3: Exact 0/1 subset enumeration for optional ingredients (up to 12 => 2^12 = 4096 subsets)
  const optionalCount = optionals.length;
  const totalSubsets = 1 << optionalCount;

  interface SubsetCandidate {
    chosenIndices: number[];
    spent: number;
    ranking: (number | string)[];
  }

  let bestCandidate: SubsetCandidate | null = null;

  for (let mask = 0; mask < totalSubsets; mask++) {
    let subsetCost = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let totalLeftover = 0;
    let totalPacks = 0;
    const chosenIndices: number[] = [];

    for (let i = 0; i < optionalCount; i++) {
      if ((mask & (1 << i)) !== 0) {
        const item = optionals[i];
        subsetCost += item.minCostCents;
        chosenIndices.push(i);
        if (item.priority === 'high') highCount++;
        else if (item.priority === 'medium') mediumCount++;
        else if (item.priority === 'low') lowCount++;
        totalLeftover += item.leftoverCanonical;
        totalPacks += item.totalPackages;
      }
    }

    if (subsetCost > discretionaryBudget) continue;

    // Stable tie break based on chosen ingredient IDs sorted
    const stableIdTieBreak = chosenIndices
      .map((idx) => optionals[idx].req.id)
      .sort()
      .join('|');

    // Spec §5.1: Maximize lexicographical tuple:
    // [countHigh, countMedium, countLow, -totalSpent, -totalLeftover, -totalPackages, deterministicIdTieBreak]
    const ranking: (number | string)[] = [
      highCount,
      mediumCount,
      lowCount,
      -subsetCost,
      -totalLeftover,
      -totalPacks,
      stableIdTieBreak,
    ];

    if (bestCandidate === null || isLexicographicallyGreater(ranking, bestCandidate.ranking)) {
      bestCandidate = {
        chosenIndices,
        spent: subsetCost,
        ranking,
      };
    }
  }

  const chosenOptionalSet = new Set<string>();
  if (bestCandidate) {
    for (const idx of bestCandidate.chosenIndices) {
      chosenOptionalSet.add(optionals[idx].req.id);
    }
  }

  // Total spent across essentials + chosen optional items
  const totalSpentCents = cheapestEssentialCostCents + (bestCandidate?.spent ?? 0);
  const remainingCents = budgetCents - totalSpentCents;

  const items: BudgetItemResult[] = [];
  let anyOmitted = false;

  for (const evalItem of evaluations) {
    if (evalItem.isPantryCovered) {
      items.push({
        requirementId: evalItem.req.id,
        priority: evalItem.priority,
        status: 'covered_by_pantry',
        selections: [],
        costCents: 0,
        reasonCode: 'COVERED_BY_PANTRY',
        requiredCanonicalQuantity: '0',
        fulfilledCanonicalQuantity: '0',
        leftoverCanonicalQuantity: '0',
        explanation: 'Requirement fully covered by verified pantry stock.',
      });
      continue;
    }

    if (evalItem.priority === 'essential') {
      items.push({
        requirementId: evalItem.req.id,
        priority: 'essential',
        status: 'included',
        selections: evalItem.plan.selections,
        costCents: evalItem.minCostCents,
        reasonCode: 'ESSENTIAL_PROTECTED',
        requiredCanonicalQuantity: evalItem.req.requiredCanonical.toString(),
        fulfilledCanonicalQuantity: evalItem.usableCapacity.toString(),
        leftoverCanonicalQuantity: evalItem.leftoverCanonical.toString(),
        explanation: `Essential ingredient fully protected ($${(evalItem.minCostCents / 100).toFixed(2)}).`,
      });
    } else {
      const isChosen = chosenOptionalSet.has(evalItem.req.id);
      if (isChosen) {
        items.push({
          requirementId: evalItem.req.id,
          priority: evalItem.priority,
          status: 'included',
          selections: evalItem.plan.selections,
          costCents: evalItem.minCostCents,
          reasonCode: 'OPTIONAL_SELECTED_WITHIN_BUDGET',
          requiredCanonicalQuantity: evalItem.req.requiredCanonical.toString(),
          fulfilledCanonicalQuantity: evalItem.usableCapacity.toString(),
          leftoverCanonicalQuantity: evalItem.leftoverCanonical.toString(),
          explanation: `Optional ingredient (${evalItem.priority} priority) selected within available budget.`,
        });
      } else {
        anyOmitted = true;
        items.push({
          requirementId: evalItem.req.id,
          priority: evalItem.priority,
          status: 'omitted_optional',
          selections: [],
          costCents: 0,
          reasonCode: 'OPTIONAL_OMITTED_EXCEEDS_BUDGET',
          requiredCanonicalQuantity: evalItem.req.requiredCanonical.toString(),
          fulfilledCanonicalQuantity: '0',
          leftoverCanonicalQuantity: '0',
          explanation: `Omitted because full requirement package ($${(evalItem.minCostCents / 100).toFixed(2)}) exceeds remaining discretionary budget.`,
        });
      }
    }
  }

  // Spec §8.8 / Acceptance Case budget-only-essentials:
  // "A meal with only essential ingredients and budget above cost is complete and must not be marked adapted."
  const isAdaptedRecipe = anyOmitted;
  const status: BudgetResultStatus = isAdaptedRecipe
    ? 'adapted_within_budget'
    : 'complete_original_within_budget';

  return {
    schemaVersion: '1.1',
    calculationVersion: '1.1.0',
    recipeId: recipe.id,
    targetServings: recipe.targetServings,
    status,
    budgetCents,
    spentCents: totalSpentCents,
    remainingCents,
    cheapestEssentialCostCents,
    shortfallCents: null,
    fullRecipeCostCents,
    items,
    isAdaptedRecipe,
    allPricesVerified: true,
    optimalWithinDeclaredBounds: true,
    dataWarnings,
    assumptions: recipe.requirements.map((r) => r.provenance),
    calculatedAt: new Date().toISOString(),
  };
}

function isLexicographicallyGreater(a: (number | string)[], b: (number | string)[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}
