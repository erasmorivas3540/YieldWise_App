import { GroceryPackage, MassUnit, QuantityDimension } from '../types';
import { canonicalMgToUnit, massToCanonicalMg } from './portionCalculator';

export interface EvaluatedPackage {
  package: GroceryPackage;
  usableCanonicalCapacity: number; // integer mg or whole count
  asPurchasedCanonical: number;
  wasteCanonical: number;
  effectiveCostPerKgCents?: number;
  effectiveCostPerLbCents?: number;
  isValid: boolean;
  exclusionReason?: string;
}

/**
 * Calculates the usable raw edible capacity of a package based on its gross weight and edible yield.
 * Spec §5.4: usableRawEdibleMg = floor(packageAsPurchasedMg * edibleYieldPpm / 1_000_000)
 */
export function evaluatePackageUsability(pkg: GroceryPackage): EvaluatedPackage {
  if (pkg.priceCents === null || pkg.priceCents < 0) {
    return {
      package: pkg,
      usableCanonicalCapacity: 0,
      asPurchasedCanonical: 0,
      wasteCanonical: 0,
      isValid: false,
      exclusionReason: 'MISSING_OR_INVALID_PRICE',
    };
  }

  if (!pkg.formCompatible) {
    return {
      package: pkg,
      usableCanonicalCapacity: 0,
      asPurchasedCanonical: 0,
      wasteCanonical: 0,
      isValid: false,
      exclusionReason: 'FORM_INCOMPATIBLE',
    };
  }

  if (pkg.dimension === 'count') {
    const countVal = parseFloat(pkg.packAmount);
    if (isNaN(countVal) || countVal <= 0) {
      return {
        package: pkg,
        usableCanonicalCapacity: 0,
        asPurchasedCanonical: 0,
        wasteCanonical: 0,
        isValid: false,
        exclusionReason: 'INVALID_COUNT_AMOUNT',
      };
    }
    const countInt = Math.floor(countVal);
    return {
      package: pkg,
      usableCanonicalCapacity: countInt,
      asPurchasedCanonical: countInt,
      wasteCanonical: 0,
      isValid: true,
    };
  }

  // Mass package evaluation
  let grossMg = 0;
  try {
    grossMg = massToCanonicalMg(pkg.packAmount, pkg.packUnit);
  } catch (err: any) {
    return {
      package: pkg,
      usableCanonicalCapacity: 0,
      asPurchasedCanonical: 0,
      wasteCanonical: 0,
      isValid: false,
      exclusionReason: 'INVALID_MASS_UNIT_OR_AMOUNT',
    };
  }

  const yieldPpm = pkg.edibleYieldPpm ?? 1000000;
  if (yieldPpm <= 0 || yieldPpm > 1000000) {
    return {
      package: pkg,
      usableCanonicalCapacity: 0,
      asPurchasedCanonical: grossMg,
      wasteCanonical: 0,
      isValid: false,
      exclusionReason: 'INVALID_YIELD_PPM',
    };
  }

  // Usable formula: floor(grossMg * yieldPpm / 1_000_000)
  const usableMg = Math.floor((grossMg * yieldPpm) / 1000000);
  if (usableMg <= 0) {
    return {
      package: pkg,
      usableCanonicalCapacity: 0,
      asPurchasedCanonical: grossMg,
      wasteCanonical: grossMg,
      isValid: false,
      exclusionReason: 'ZERO_USABLE_CAPACITY',
    };
  }

  const wasteMg = grossMg - usableMg;

  // Effective cost per kg and lb in integer cents
  const usableKg = usableMg / 1000000;
  const effectiveCostPerKgCents = Math.round(pkg.priceCents / usableKg);
  const usableLb = canonicalMgToUnit(usableMg, 'lb');
  const effectiveCostPerLbCents = Math.round(pkg.priceCents / usableLb);

  return {
    package: pkg,
    usableCanonicalCapacity: usableMg,
    asPurchasedCanonical: grossMg,
    wasteCanonical: wasteMg,
    effectiveCostPerKgCents,
    effectiveCostPerLbCents,
    isValid: true,
  };
}

/**
 * Format canonical milligrams or count to readable string
 */
export function formatCanonicalQuantity(
  canonicalVal: number,
  dimension: QuantityDimension = 'mass',
  preferredUnit: MassUnit | string = 'g'
): string {
  if (dimension === 'count') {
    return `${canonicalVal} count`;
  }
  if (preferredUnit === 'lb') {
    const lbs = canonicalMgToUnit(canonicalVal, 'lb');
    return `${lbs.toFixed(2)} lb`;
  }
  if (preferredUnit === 'oz') {
    const oz = canonicalMgToUnit(canonicalVal, 'oz');
    return `${oz.toFixed(1)} oz`;
  }
  if (preferredUnit === 'kg' || canonicalVal >= 1000000) {
    const kg = canonicalMgToUnit(canonicalVal, 'kg');
    return `${kg.toFixed(2)} kg`;
  }
  const grams = canonicalMgToUnit(canonicalVal, 'g');
  return `${Math.round(grams)} g`;
}
