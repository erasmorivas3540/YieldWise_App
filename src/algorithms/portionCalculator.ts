import { IngredientRequirement, MassUnit, VerifiedPantryEntry } from '../types';

/**
 * Standard mass conversion constants according to Spec Section 5.1
 * 1 g = 1,000 mg
 * 1 kg = 1,000,000 mg
 * 1 oz = 28.349523125 g
 * 1 lb = 453.59237 g
 */
export const GRAMS_PER_POUND = 453.59237;
export const GRAMS_PER_OUNCE = 28.349523125;
export const MG_PER_GRAM = 1000;
export const MG_PER_KG = 1000000;
export const MG_PER_POUND = 453592.37;
export const MG_PER_OUNCE = 28349.523125;

/**
 * Exact conversion from pounds to grams according to Spec §5.1:
 * "Quantity in grams = quantity in pounds * 453.59237"
 */
export function poundsToGrams(pounds: number): number {
  return pounds * GRAMS_PER_POUND;
}

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OUNCE;
}

export interface ScaledRequirement {
  id: string;
  canonicalIngredientId: string;
  displayName: string;
  dimension: 'mass' | 'count';
  rawTargetCanonical: number; // integer mg or whole count
  pantryCanonical: number; // integer mg or whole count deducted
  requiredCanonical: number; // rawTargetCanonical - pantryCanonical
  displayUnit: string;
  warnings: string[];
  blocker?: string;
}

/**
 * Convert quantity string in a given unit to integer canonical milligrams
 */
export function massToCanonicalMg(amountStr: string, unit: MassUnit | string): number {
  const parsed = parseFloat(amountStr);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid mass amount: "${amountStr}"`);
  }

  const normalizedUnit = unit.toLowerCase().trim();
  let mg = 0;

  switch (normalizedUnit) {
    case 'mg':
      mg = Math.round(parsed);
      break;
    case 'g':
    case 'gram':
    case 'grams':
      mg = Math.round(parsed * MG_PER_GRAM);
      break;
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      mg = Math.round(parsed * MG_PER_KG);
      break;
    case 'oz':
    case 'ounce':
    case 'ounces':
      mg = Math.round(parsed * MG_PER_OUNCE);
      break;
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      mg = Math.round(parsed * MG_PER_POUND);
      break;
    default:
      throw new Error(`Unsupported mass unit: "${unit}"`);
  }

  if (mg > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Mass value exceeds safe integer limit`);
  }

  return mg;
}

/**
 * Converts canonical milligrams to a target mass unit (e.g. grams or pounds)
 */
export function canonicalMgToUnit(mg: number, targetUnit: MassUnit): number {
  switch (targetUnit) {
    case 'mg':
      return mg;
    case 'g':
      return mg / MG_PER_GRAM;
    case 'kg':
      return mg / MG_PER_KG;
    case 'oz':
      return mg / MG_PER_OUNCE;
    case 'lb':
      return mg / MG_PER_POUND;
    default:
      return mg / MG_PER_GRAM;
  }
}

/**
 * Scale base ingredient requirements to target servings (1-12)
 * and apply verified pantry deductions.
 */
export function scaleRequirement(
  req: IngredientRequirement,
  targetServings: number,
  pantryEntries: VerifiedPantryEntry[] = []
): ScaledRequirement {
  const warnings: string[] = [];

  if (targetServings < 1 || targetServings > 12 || !Number.isInteger(targetServings)) {
    return {
      id: req.id,
      canonicalIngredientId: req.canonicalIngredientId,
      displayName: req.displayName,
      dimension: req.dimension === 'count' ? 'count' : 'mass',
      rawTargetCanonical: 0,
      pantryCanonical: 0,
      requiredCanonical: 0,
      displayUnit: req.baseUnit,
      warnings: ['Servings must be an integer between 1 and 12.'],
      blocker: 'INVALID_SERVINGS',
    };
  }

  if (req.dimension === 'volume') {
    // Spec §5.1: Unsupported volume->mass transformation without verified density
    if (!req.volumeDensityGPerMl || req.volumeDensityGPerMl <= 0) {
      return {
        id: req.id,
        canonicalIngredientId: req.canonicalIngredientId,
        displayName: req.displayName,
        dimension: 'mass',
        rawTargetCanonical: 0,
        pantryCanonical: 0,
        requiredCanonical: 0,
        displayUnit: req.baseUnit,
        warnings: [
          `Volume unit "${req.baseUnit}" cannot be converted to mass without a verified food density. Please input weight in grams/ounces or provide density.`,
        ],
        blocker: 'UNSUPPORTED_VOLUME_CONVERSION',
      };
    }
  }

  let baseCanonical = 0;
  if (req.dimension === 'count') {
    const parsedCount = parseFloat(req.baseAmount);
    if (isNaN(parsedCount) || parsedCount < 0) {
      return {
        id: req.id,
        canonicalIngredientId: req.canonicalIngredientId,
        displayName: req.displayName,
        dimension: 'count',
        rawTargetCanonical: 0,
        pantryCanonical: 0,
        requiredCanonical: 0,
        displayUnit: 'count',
        warnings: [`Invalid count amount "${req.baseAmount}"`],
        blocker: 'INVALID_AMOUNT',
      };
    }
    baseCanonical = Math.round(parsedCount);
  } else {
    try {
      baseCanonical = massToCanonicalMg(req.baseAmount, req.baseUnit);
    } catch (e: any) {
      return {
        id: req.id,
        canonicalIngredientId: req.canonicalIngredientId,
        displayName: req.displayName,
        dimension: 'mass',
        rawTargetCanonical: 0,
        pantryCanonical: 0,
        requiredCanonical: 0,
        displayUnit: req.baseUnit,
        warnings: [e.message || 'Failed to convert unit to mass'],
        blocker: 'INVALID_UNIT_OR_AMOUNT',
      };
    }
  }

  // Scaling formula: target = ceil(q0 * s1 / s0)
  const baseServings = req.baseServings || 1;
  let targetCanonical = Math.ceil((baseCanonical * targetServings) / baseServings);

  // If cooked_edible target, convert to raw_edible using rawPerCookedPpm
  if (req.state === 'cooked_edible') {
    if (!req.rawPerCookedPpm || req.rawPerCookedPpm <= 0) {
      return {
        id: req.id,
        canonicalIngredientId: req.canonicalIngredientId,
        displayName: req.displayName,
        dimension: req.dimension === 'count' ? 'count' : 'mass',
        rawTargetCanonical: 0,
        pantryCanonical: 0,
        requiredCanonical: 0,
        displayUnit: req.baseUnit,
        warnings: [
          'Cooked edible requirement requires a documented raw-to-cooked conversion factor (rawPerCookedPpm).',
        ],
        blocker: 'MISSING_COOKED_CONVERSION',
      };
    }
    // rawEdibleRequiredMg = ceil(targetCookedMg * rawPerCookedPpm / 1_000_000)
    targetCanonical = Math.ceil((targetCanonical * req.rawPerCookedPpm) / 1000000);
  }

  // Subtract verified pantry in compatible state and unit
  let pantryCanonical = 0;
  const matchingPantry = pantryEntries.find(
    (p) => p.ingredientRequirementId === req.id && p.confirmedByUser
  );

  if (matchingPantry) {
    const parsedPantry = parseFloat(matchingPantry.usableCanonicalQuantity);
    if (!isNaN(parsedPantry) && parsedPantry > 0) {
      pantryCanonical = Math.round(parsedPantry);
    }
  }

  const requiredCanonical = Math.max(0, targetCanonical - pantryCanonical);

  return {
    id: req.id,
    canonicalIngredientId: req.canonicalIngredientId,
    displayName: req.displayName,
    dimension: req.dimension === 'count' ? 'count' : 'mass',
    rawTargetCanonical: targetCanonical,
    pantryCanonical,
    requiredCanonical,
    displayUnit: req.baseUnit,
    warnings,
  };
}
