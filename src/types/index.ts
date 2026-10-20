export type MassUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb';
export type QuantityDimension = 'mass' | 'count' | 'volume';
export type QuantityState = 'raw_edible' | 'as_purchased' | 'cooked_edible' | 'count';
export type SourceType = 'USER_CONFIRMED' | 'DEMO_ASSUMPTION' | 'REFERENCE' | 'AI_DRAFT';

export interface Provenance {
  type: SourceType;
  sourceLabel: string;
  referenceUrl?: string;
  sourceVersion?: string;
  observedAt?: string; // ISO-8601
  note?: string;
  confirmedByUser: boolean;
}

export interface IngredientRequirement {
  id: string;
  canonicalIngredientId: string;
  displayName: string;
  foodForm: string; // e.g. raw_boneless, dry_grain
  dimension: QuantityDimension;
  state: QuantityState;
  baseAmount: string; // decimal in baseUnit
  baseUnit: string; // g, lb, count, etc.
  baseServings: number; // 1-12
  rawPerCookedPpm?: number; // if cooked_edible -> raw_edible, documented
  volumeDensityGPerMl?: number; // if volume -> mass conversion verified
  provenance: Provenance;
  reviewStatus: 'draft' | 'confirmed' | 'blocked';
}

export interface Recipe {
  id: string;
  title: string;
  targetServings: number; // 1-12
  requirements: IngredientRequirement[];
  source: Provenance;
}

export interface GroceryPackage {
  id: string;
  canonicalIngredientId: string;
  displayName: string;
  foodForm: string;
  dimension: 'mass' | 'count';
  packAmount: string; // decimal as purchased
  packUnit: 'g' | 'kg' | 'oz' | 'lb' | 'count';
  priceCents: number | null; // integer >= 0, null if unentered
  edibleYieldPpm?: number; // 1..1_000_000 for mass, absent for count
  formCompatible: boolean; // true only for reviewed comparability
  provenance: Provenance;
  reviewStatus: 'draft' | 'confirmed' | 'blocked';
}

export type OptimizationObjective = 'lowest_checkout_cost' | 'least_estimated_leftover';

export interface OptimizationOptions {
  objective: OptimizationObjective;
  maxSkuOptionsPerIngredient: number;
  maxPacksPerSku: number;
  maxCombinationsPerIngredient: number;
}

export interface PurchaseSelection {
  packageId: string;
  count: number;
  usableQuantity: string; // canonical integer as decimal string
  costCents: number;
}

export interface IngredientPlanResult {
  ingredientId: string;
  status: 'optimal_within_limits' | 'missing_input' | 'out_of_solver_limits' | 'infeasible';
  requiredCanonicalQuantity: string;
  providedCanonicalQuantity?: string;
  leftoverCanonicalQuantity?: string;
  selections: PurchaseSelection[];
  ingredientCostCents?: number;
  consideredPackageIds: string[];
  excluded: { packageId: string; reasonCode: string }[];
  warnings: string[];
  explanation: string;
}

export interface OptimizationResult {
  schemaVersion: '1.0';
  recipeId: string;
  targetServings: number;
  objective: OptimizationObjective;
  status: 'complete' | 'partial' | 'blocked';
  currency: 'USD';
  totalKnownCostCents: number;
  costPerServingCents: number;
  ingredientPlans: IngredientPlanResult[];
  assumptions: Provenance[];
  calculatedAt: string;
}

// v1.1 Smart Budget Mode types
export type IngredientPriority = 'essential' | 'high' | 'medium' | 'low';
export type BudgetMode = 'off' | 'prioritize_ingredients';

export interface IngredientBudgetPreference {
  ingredientRequirementId: string;
  priority: IngredientPriority;
  confirmedByUser: boolean;
}

export interface BudgetOptimizationOptions {
  mode: 'prioritize_ingredients';
  budgetCents: number; // safe integer, 0..30000 for pilot MVP
  priorities: IngredientBudgetPreference[];
  maxIngredients: number;
  maxSkuOptionsPerIngredient: number;
  maxPacksPerSku: number;
  maxCombinationsPerIngredient: number;
}

export interface VerifiedPantryEntry {
  ingredientRequirementId: string;
  usableCanonicalQuantity: string; // integer mg or count as decimal string
  dimension: 'mass' | 'count';
  foodForm: string;
  provenance: Provenance;
  confirmedByUser: boolean;
}

export interface BudgetOptimizationRequest {
  schemaVersion: '1.1';
  recipe: Recipe;
  verifiedPantry: VerifiedPantryEntry[];
  packages: GroceryPackage[];
  options: BudgetOptimizationOptions;
}

export type BudgetResultStatus =
  | 'complete_original_within_budget'
  | 'adapted_within_budget'
  | 'essential_over_budget'
  | 'blocked_missing_input'
  | 'out_of_solver_limits';

export interface BudgetItemResult {
  requirementId: string;
  priority: IngredientPriority;
  status: 'included' | 'covered_by_pantry' | 'omitted_optional' | 'blocked';
  selections: PurchaseSelection[];
  costCents: number | null;
  reasonCode: string;
  requiredCanonicalQuantity: string;
  fulfilledCanonicalQuantity: string;
  leftoverCanonicalQuantity: string;
  explanation: string;
}

export interface BudgetOptimizationResult {
  schemaVersion: '1.1';
  calculationVersion: string;
  recipeId: string;
  targetServings: number;
  status: BudgetResultStatus;
  budgetCents: number;
  spentCents: number | null;
  remainingCents: number | null;
  cheapestEssentialCostCents: number | null;
  shortfallCents: number | null;
  fullRecipeCostCents: number | null;
  items: BudgetItemResult[];
  isAdaptedRecipe: boolean;
  allPricesVerified: boolean;
  optimalWithinDeclaredBounds: boolean;
  dataWarnings: string[];
  assumptions: Provenance[];
  calculatedAt: string;
}

export interface DemoMeal {
  id: string;
  name: string;
  description: string;
  targetServings: number;
  recipe: Recipe;
  packages: GroceryPackage[];
  verifiedPantry: VerifiedPantryEntry[];
  suggestedPriorities: Record<string, IngredientPriority>;
  suggestedBudgetCents?: number;
}
