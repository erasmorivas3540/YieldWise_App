import { describe, expect, it } from 'vitest';
import { evaluatePackageUsability } from '../src/algorithms/yieldCalculator';
import { GroceryPackage } from '../src/types';

describe('yieldCalculator', () => {
  it('1000 g at 80% yield provides exactly 800 g raw edible', () => {
    const pkg: GroceryPackage = {
      id: 'brc-1000',
      canonicalIngredientId: 'broccoli',
      displayName: 'Broccoli 1kg',
      foodForm: 'raw_whole',
      dimension: 'mass',
      packAmount: '1000',
      packUnit: 'g',
      priceCents: 460,
      edibleYieldPpm: 800000, // 80%
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const res = evaluatePackageUsability(pkg);
    expect(res.isValid).toBe(true);
    expect(res.usableCanonicalCapacity).toBe(800000); // 800 g in mg
    expect(res.wasteCanonical).toBe(200000); // 200 g trim waste
  });

  it('500 g at 80% yield provides exactly 400 g raw edible', () => {
    const pkg: GroceryPackage = {
      id: 'brc-500',
      canonicalIngredientId: 'broccoli',
      displayName: 'Broccoli 500g',
      foodForm: 'raw_whole',
      dimension: 'mass',
      packAmount: '500',
      packUnit: 'g',
      priceCents: 250,
      edibleYieldPpm: 800000, // 80%
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const res = evaluatePackageUsability(pkg);
    expect(res.isValid).toBe(true);
    expect(res.usableCanonicalCapacity).toBe(400000); // 400 g in mg
    expect(res.wasteCanonical).toBe(100000); // 100 g trim waste
  });

  it('1600 g bone-in chicken at 60% yield provides 960 g (insufficient for 1020 g), at 65% provides 1040 g', () => {
    const pkg60: GroceryPackage = {
      id: 'chk-bonein-60',
      canonicalIngredientId: 'chicken',
      displayName: 'Bone-in Chicken 60%',
      foodForm: 'raw_bonein',
      dimension: 'mass',
      packAmount: '1600',
      packUnit: 'g',
      priceCents: 950,
      edibleYieldPpm: 600000, // 60%
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'confirmed',
    };

    const res60 = evaluatePackageUsability(pkg60);
    expect(res60.usableCanonicalCapacity).toBe(960000); // 960 g < 1020 g

    const pkg65: GroceryPackage = {
      ...pkg60,
      id: 'chk-bonein-65',
      edibleYieldPpm: 650000, // 65%
    };

    const res65 = evaluatePackageUsability(pkg65);
    expect(res65.usableCanonicalCapacity).toBe(1040000); // 1040 g >= 1020 g
  });

  it('excludes incompatible packages until explicitly marked formCompatible', () => {
    const pkg: GroceryPackage = {
      id: 'chk-bonein-unconfirmed',
      canonicalIngredientId: 'chicken',
      displayName: 'Bone-in Chicken',
      foodForm: 'raw_bonein',
      dimension: 'mass',
      packAmount: '1600',
      packUnit: 'g',
      priceCents: 950,
      edibleYieldPpm: 650000,
      formCompatible: false, // NOT confirmed
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'draft',
    };

    const res = evaluatePackageUsability(pkg);
    expect(res.isValid).toBe(false);
    expect(res.exclusionReason).toBe('FORM_INCOMPATIBLE');
  });

  it('rejects missing price and invalid trim yield > 100%', () => {
    const noPricePkg: GroceryPackage = {
      id: 'noprice',
      canonicalIngredientId: 'chicken',
      displayName: 'Free Chicken',
      foodForm: 'raw_boneless',
      dimension: 'mass',
      packAmount: '500',
      packUnit: 'g',
      priceCents: null,
      edibleYieldPpm: 1000000,
      formCompatible: true,
      provenance: { type: 'DEMO_ASSUMPTION', sourceLabel: 'test', confirmedByUser: true },
      reviewStatus: 'draft',
    };
    expect(evaluatePackageUsability(noPricePkg).isValid).toBe(false);

    const overYieldPkg: GroceryPackage = {
      ...noPricePkg,
      priceCents: 500,
      edibleYieldPpm: 1200000, // > 100%
    };
    expect(evaluatePackageUsability(overYieldPkg).isValid).toBe(false);
  });
});
