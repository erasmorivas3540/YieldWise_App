import React from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, Tag, Percent, Scale, HelpCircle, AlertCircle, Check } from 'lucide-react';
import { evaluatePackageUsability } from '../algorithms/yieldCalculator';
import { GroceryPackage, Recipe } from '../types';

interface PackageComparatorProps {
  recipe: Recipe;
  packages: GroceryPackage[];
  onUpdatePackages: (updated: GroceryPackage[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PackageComparator: React.FC<PackageComparatorProps> = ({
  recipe,
  packages,
  onUpdatePackages,
  onNext,
  onBack,
}) => {
  const handleUpdatePackage = (pkgId: string, updates: Partial<GroceryPackage>) => {
    const updated = packages.map((p) => {
      if (p.id === pkgId) {
        return { ...p, ...updates };
      }
      return p;
    });
    onUpdatePackages(updated);
  };

  const handleAddPackage = (canonicalIngredientId: string) => {
    const req = recipe.requirements.find((r) => r.canonicalIngredientId === canonicalIngredientId);
    const newPkg: GroceryPackage = {
      id: `pkg-${Date.now()}`,
      canonicalIngredientId,
      displayName: `${req?.displayName || 'Ingredient'} Package`,
      foodForm: req?.foodForm || 'standard',
      dimension: req?.dimension === 'count' ? 'count' : 'mass',
      packAmount: '500',
      packUnit: req?.baseUnit === 'count' ? 'count' : 'g',
      priceCents: 300,
      edibleYieldPpm: 1000000,
      formCompatible: true,
      provenance: {
        type: 'USER_CONFIRMED',
        sourceLabel: 'User-entered package',
        observedAt: new Date().toISOString(),
        confirmedByUser: true,
      },
      reviewStatus: 'confirmed',
    };

    onUpdatePackages([...packages, newPkg]);
  };

  const handleRemovePackage = (pkgId: string) => {
    const filtered = packages.filter((p) => p.id !== pkgId);
    onUpdatePackages(filtered);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white">Compare Grocery Packages & Trimming Yields</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Input package sizes, shelf prices, and estimated trimming yields. The optimizer considers these real discrete options.
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 w-fit">
            Discrete Package Integer Solver
          </span>
        </div>

        {/* Ingredients & Packages Blocks */}
        <div className="space-y-8">
          {recipe.requirements.map((req) => {
            const matchingPkgs = packages.filter(
              (p) => p.canonicalIngredientId === req.canonicalIngredientId
            );

            return (
              <div
                key={req.id}
                className="bg-slate-950 border border-slate-800/90 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{req.displayName}</h3>
                    <p className="text-xs text-slate-400">
                      Required edible target: {req.baseAmount} {req.baseUnit} × {recipe.targetServings} servings
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddPackage(req.canonicalIngredientId)}
                    disabled={matchingPkgs.length >= 4}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Package Option ({matchingPkgs.length}/4)</span>
                  </button>
                </div>

                {matchingPkgs.length === 0 ? (
                  <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>No packages configured for this ingredient. Please add at least one package.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchingPkgs.map((pkg) => {
                      const evaluation = evaluatePackageUsability(pkg);
                      const yieldPct = pkg.edibleYieldPpm ? (pkg.edibleYieldPpm / 10000).toFixed(0) : '100';

                      return (
                        <div
                          key={pkg.id}
                          className={`p-4 rounded-xl border transition ${
                            evaluation.isValid
                              ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                              : 'bg-rose-950/10 border-rose-900/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <input
                              type="text"
                              value={pkg.displayName}
                              onChange={(e) =>
                                handleUpdatePackage(pkg.id, { displayName: e.target.value })
                              }
                              placeholder="Package Title"
                              className="font-semibold text-xs sm:text-sm text-slate-200 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none w-full"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePackage(pkg.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Package Controls */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                                Net Weight / Amount
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  min="1"
                                  value={pkg.packAmount}
                                  onChange={(e) =>
                                    handleUpdatePackage(pkg.id, { packAmount: e.target.value })
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                                />
                                <span className="text-slate-400 font-medium">{pkg.packUnit}</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                                Shelf Price ($ USD)
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={pkg.priceCents !== null ? (pkg.priceCents / 100).toFixed(2) : ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    handleUpdatePackage(pkg.id, {
                                      priceCents: isNaN(val) ? null : Math.round(val * 100),
                                    });
                                  }}
                                  placeholder="0.00"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            {pkg.dimension === 'mass' && (
                              <div className="col-span-2 mt-1">
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="text-slate-400">Edible Trim Yield:</span>
                                  <span className="font-bold text-emerald-400">{yieldPct}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    step="1"
                                    value={yieldPct}
                                    onChange={(e) =>
                                      handleUpdatePackage(pkg.id, {
                                        edibleYieldPpm: parseInt(e.target.value, 10) * 10000,
                                      })
                                    }
                                    className="w-full accent-emerald-500"
                                  />
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                                  <span>20% (heavy loss)</span>
                                  <span>100% (boneless/trimmed)</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Usable Capacity Preview */}
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Usable Food Yield:</span>
                            <span className="font-semibold text-slate-200">
                              {evaluation.isValid
                                ? pkg.dimension === 'count'
                                  ? `${evaluation.usableCanonicalCapacity} count`
                                  : `${Math.round(evaluation.usableCanonicalCapacity / 1000)} g edible`
                                : '0 (Invalid input)'}
                            </span>
                          </div>

                          {/* Form Compatibility Switch (e.g. bone-in chicken) */}
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Include in solver:</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pkg.formCompatible}
                                onChange={(e) =>
                                  handleUpdatePackage(pkg.id, {
                                    formCompatible: e.target.checked,
                                  })
                                }
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>

                          {!pkg.formCompatible && (
                            <div className="mt-1.5 text-[10px] text-amber-400">
                              Excluded from optimization until confirmed compatible.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Budget & Priorities</span>
          </button>

          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs sm:text-sm text-white shadow-md transition"
          >
            <span>Optimize Purchase</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
