import { describe, expect, it } from 'vitest';
import {
  canonicalMgToUnit,
  GRAMS_PER_POUND,
  massToCanonicalMg,
  poundsToGrams,
  scaleRequirement,
} from '../src/algorithms/portionCalculator';
import { IngredientRequirement } from '../src/types';

describe('portionCalculator', () => {
  it('converts 1 lb to exactly 453.59237 g without treating grams as pounds', () => {
    const grams = poundsToGrams(1);
    expect(grams).toBe(453.59237);
    expect(grams).toBe(GRAMS_PER_POUND);
  });

  it('correctly converts standard metric and imperial units to canonical milligrams', () => {
    expect(massToCanonicalMg('1', 'g')).toBe(1000);
    expect(massToCanonicalMg('1', 'kg')).toBe(1000000);
    expect(massToCanonicalMg('100', 'mg')).toBe(100);
    expect(massToCanonicalMg('1', 'oz')).toBe(28350);
  });

  it('scales ingredients accurately for 6 servings', () => {
    // 170 g * 6 = 1020 g
    // 75 g * 6 = 450 g
    // 120 g * 6 = 720 g
    const chickenReq: IngredientRequirement = {
      id: 'chk',
      canonicalIngredientId: 'chicken',
      displayName: 'Chicken Breast',
      foodForm: 'raw_boneless',
      dimension: 'mass',
      state: 'raw_edible',
      baseAmount: '170',
      baseUnit: 'g',
      baseServings: 1,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const riceReq: IngredientRequirement = {
      id: 'rc',
      canonicalIngredientId: 'rice',
      displayName: 'Rice',
      foodForm: 'dry_grain',
      dimension: 'mass',
      state: 'raw_edible',
      baseAmount: '75',
      baseUnit: 'g',
      baseServings: 1,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const broccoliReq: IngredientRequirement = {
      id: 'brc',
      canonicalIngredientId: 'broccoli',
      displayName: 'Broccoli',
      foodForm: 'raw_edible_trimmed',
      dimension: 'mass',
      state: 'raw_edible',
      baseAmount: '120',
      baseUnit: 'g',
      baseServings: 1,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const chickenScaled = scaleRequirement(chickenReq, 6);
    expect(chickenScaled.requiredCanonical).toBe(1020000); // 1020 g in mg

    const riceScaled = scaleRequirement(riceReq, 6);
    expect(riceScaled.requiredCanonical).toBe(450000); // 450 g in mg

    const broccoliScaled = scaleRequirement(broccoliReq, 6);
    expect(broccoliScaled.requiredCanonical).toBe(720000); // 720 g in mg
  });

  it('converts cooked_edible to raw_edible with factor 1.25', () => {
    // 500 g cooked target with factor 1.25 => 625 g raw edible
    const cookedReq: IngredientRequirement = {
      id: 'cooked_meat',
      canonicalIngredientId: 'meat',
      displayName: 'Cooked Meat',
      foodForm: 'cooked',
      dimension: 'mass',
      state: 'cooked_edible',
      baseAmount: '500',
      baseUnit: 'g',
      baseServings: 1,
      rawPerCookedPpm: 1250000, // 1.25 in ppm
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const scaled = scaleRequirement(cookedReq, 1);
    expect(scaled.requiredCanonical).toBe(625000); // 625 g
  });

  it('blocks unsupported volume conversion without explicit density', () => {
    const volumeReq: IngredientRequirement = {
      id: 'oil',
      canonicalIngredientId: 'olive_oil',
      displayName: 'Olive Oil',
      foodForm: 'liquid',
      dimension: 'volume',
      state: 'raw_edible',
      baseAmount: '2',
      baseUnit: 'cups',
      baseServings: 1,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const scaled = scaleRequirement(volumeReq, 4);
    expect(scaled.blocker).toBe('UNSUPPORTED_VOLUME_CONVERSION');
  });

  it('deducts verified pantry quantities in canonical units', () => {
    const req: IngredientRequirement = {
      id: 'chk',
      canonicalIngredientId: 'chicken',
      displayName: 'Chicken',
      foodForm: 'raw_boneless',
      dimension: 'mass',
      state: 'raw_edible',
      baseAmount: '170',
      baseUnit: 'g',
      baseServings: 1,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const scaled = scaleRequirement(req, 6, [
      {
        ingredientRequirementId: 'chk',
        usableCanonicalQuantity: '500000', // 500g in pantry
        dimension: 'mass',
        foodForm: 'raw_boneless',
        provenance: { type: 'USER_CONFIRMED', sourceLabel: 'pantry', confirmedByUser: true },
        confirmedByUser: true,
      },
    ]);

    expect(scaled.rawTargetCanonical).toBe(1020000);
    expect(scaled.pantryCanonical).toBe(500000);
    expect(scaled.requiredCanonical).toBe(520000);
  });
});
