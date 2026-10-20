import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, Camera, Link as LinkIcon, Sparkles, X, Check, AlertCircle } from 'lucide-react';
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
  // Modal / drawer state for in-store shelf extraction & URL import
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'camera' | 'url' | null>(null);
  const [storeUrlInput, setStoreUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Staged packages detected by AI for review before adding
  const [detectedPackages, setDetectedPackages] = useState<GroceryPackage[]>([]);
  const [selectedDetectedIds, setSelectedDetectedIds] = useState<Set<string>>(new Set());

  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      displayName: `${req?.displayName || 'Ingredient'} Pack`,
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

  // Open camera/shelf scanner for a specific ingredient
  const handleOpenScanner = (reqId: string) => {
    setActiveReqId(reqId);
    setModalType('camera');
    setExtractionError(null);
    setDetectedPackages([]);
    setSelectedDetectedIds(new Set());
    cameraInputRef.current?.click();
  };

  // Open store website URL importer for a specific ingredient
  const handleOpenUrlImporter = (reqId: string) => {
    setActiveReqId(reqId);
    setModalType('url');
    setStoreUrlInput('');
    setExtractionError(null);
    setDetectedPackages([]);
    setSelectedDetectedIds(new Set());
  };

  // Process shelf photo via AI
  const handlePhotoCaptured = async (file: File) => {
    if (!activeReqId) return;
    const req = recipe.requirements.find((r) => r.id === activeReqId);
    if (!req) return;

    setIsExtracting(true);
    setExtractionError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const res = await fetch('/api/v1/packages/extract-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
            canonicalIngredientId: req.canonicalIngredientId,
            ingredientName: req.displayName,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to extract package info from photo.');
        }

        if (!data.packages || data.packages.length === 0) {
          throw new Error('No legible package prices were detected in the photo. Please try closer or enter manually.');
        }

        setDetectedPackages(data.packages);
        setSelectedDetectedIds(new Set(data.packages.map((p: GroceryPackage) => p.id)));
      } catch (err: any) {
        setExtractionError(err.message || 'Failed to analyze shelf photo.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Process store link via AI
  const handleExtractFromUrl = async () => {
    if (!activeReqId || !storeUrlInput.trim()) return;
    const req = recipe.requirements.find((r) => r.id === activeReqId);
    if (!req) return;

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const res = await fetch('/api/v1/packages/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: storeUrlInput.trim(),
          canonicalIngredientId: req.canonicalIngredientId,
          ingredientName: req.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to extract product from store website.');
      }

      if (!data.packages || data.packages.length === 0) {
        throw new Error('No product prices found on this page.');
      }

      setDetectedPackages(data.packages);
      setSelectedDetectedIds(new Set(data.packages.map((p: GroceryPackage) => p.id)));
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to extract from store website.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Add selected detected packages to the ingredient comparison
  const handleCommitDetectedPackages = () => {
    if (!activeReqId) return;
    const req = recipe.requirements.find((r) => r.id === activeReqId);
    if (!req) return;

    const toAdd = detectedPackages.filter((p) => selectedDetectedIds.has(p.id));
    if (toAdd.length === 0) return;

    // Filter existing packages for this ingredient and keep up to 4 total
    const existing = packages.filter((p) => p.canonicalIngredientId === req.canonicalIngredientId);
    const combined = [...existing, ...toAdd].slice(0, 4);

    const otherPackages = packages.filter((p) => p.canonicalIngredientId !== req.canonicalIngredientId);
    onUpdatePackages([...otherPackages, ...combined]);

    // Close modal
    setModalType(null);
    setActiveReqId(null);
    setDetectedPackages([]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hidden camera input supporting mobile direct camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handlePhotoCaptured(e.target.files[0]);
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Compare Packages</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure shelf package sizes, prices, and yields. Use shelf photos or store links to grab live in-store prices.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {recipe.requirements.map((req) => {
          const matchingPkgs = packages.filter(
            (p) => p.canonicalIngredientId === req.canonicalIngredientId
          );

          return (
            <div
              key={req.id}
              className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">{req.displayName}</h2>
                  <span className="text-[11px] text-stone-500 font-mono">
                    Target: {req.baseAmount} {req.baseUnit} × {recipe.targetServings} servings
                  </span>
                </div>

                {/* Quick In-Store Extraction Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenScanner(req.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-stone-200 hover:border-[#3E4F32] text-xs font-medium text-stone-700 transition"
                    title="Take photo of shelf price tags or meat counter"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#3E4F32]" />
                    <span>Scan Shelf Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenUrlImporter(req.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-stone-200 hover:border-[#3E4F32] text-xs font-medium text-stone-700 transition"
                    title="Import price from a grocery store website"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-stone-600" />
                    <span>Store Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddPackage(req.canonicalIngredientId)}
                    disabled={matchingPkgs.length >= 4}
                    className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Manual ({matchingPkgs.length}/4)</span>
                  </button>
                </div>
              </div>

              {matchingPkgs.length === 0 ? (
                <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded text-xs text-stone-600">
                  No packages configured for this ingredient yet. Snap a photo of the shelf, enter a store URL, or add a package manually.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matchingPkgs.map((pkg) => {
                    const evaluation = evaluatePackageUsability(pkg);
                    const yieldPct = pkg.edibleYieldPpm ? (pkg.edibleYieldPpm / 10000).toFixed(0) : '100';

                    return (
                      <div
                        key={pkg.id}
                        className={`p-3.5 rounded-lg border transition ${
                          evaluation.isValid
                            ? 'bg-[#FAF8F5] border-stone-200/90'
                            : 'bg-rose-50/50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <input
                            type="text"
                            value={pkg.displayName}
                            onChange={(e) =>
                              handleUpdatePackage(pkg.id, { displayName: e.target.value })
                            }
                            placeholder="Package Name"
                            className="text-xs font-semibold text-stone-900 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-[#3E4F32] focus:outline-none w-full"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePackage(pkg.id)}
                            className="text-stone-400 hover:text-stone-700 p-0.5 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Amount & Price inputs */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-stone-500 uppercase font-medium block mb-1">
                              Net Weight
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={pkg.packAmount}
                                onChange={(e) =>
                                  handleUpdatePackage(pkg.id, { packAmount: e.target.value })
                                }
                                className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs font-mono text-stone-900 focus:outline-none focus:border-[#3E4F32]"
                              />
                              <span className="text-[11px] text-stone-500">{pkg.packUnit}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-500 uppercase font-medium block mb-1">
                              Shelf Price
                            </span>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-stone-400 font-mono text-[11px]">
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
                                className="w-full bg-white border border-stone-200 rounded pl-5 pr-2 py-1 text-xs font-mono text-stone-900 focus:outline-none focus:border-[#3E4F32]"
                              />
                            </div>
                          </div>

                          {pkg.dimension === 'mass' && (
                            <div className="col-span-2 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-stone-600 mb-1">
                                <span>Edible Trim Yield:</span>
                                <span className="font-mono font-medium text-stone-900">{yieldPct}%</span>
                              </div>
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
                                className="w-full accent-[#3E4F32] h-1.5"
                              />
                            </div>
                          )}
                        </div>

                        {/* Usable preview & include toggle */}
                        <div className="mt-2.5 pt-2 border-t border-stone-200 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500 font-mono">
                            Yields:{' '}
                            <strong className="font-semibold text-stone-900">
                              {evaluation.isValid
                                ? pkg.dimension === 'count'
                                  ? `${evaluation.usableCanonicalCapacity} ct`
                                  : `${Math.round(evaluation.usableCanonicalCapacity / 1000)} g edible`
                                : '0'}
                            </strong>
                          </span>

                          <label className="flex items-center gap-1.5 cursor-pointer text-stone-600">
                            <input
                              type="checkbox"
                              checked={pkg.formCompatible}
                              onChange={(e) =>
                                handleUpdatePackage(pkg.id, {
                                  formCompatible: e.target.checked,
                                })
                              }
                              className="accent-[#3E4F32] w-3.5 h-3.5 rounded"
                            />
                            <span>Include</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* In-Store Extraction Modal / Review Drawer */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-stone-200 max-w-lg w-full p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3E4F32]" />
                <h3 className="font-semibold text-sm text-stone-900">
                  {modalType === 'camera' ? 'Shelf Photo Price Scanner' : 'Store Website Product Link'}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* URL Input Form */}
            {modalType === 'url' && detectedPackages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-stone-600">
                  Paste the web link of a grocery product (e.g. from Kroger, Walmart, Safeway, Whole Foods, or any store):
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={storeUrlInput}
                    onChange={(e) => setStoreUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExtractFromUrl()}
                    placeholder="https://www.store.com/item/chicken-breast"
                    className="flex-1 bg-[#FAF8F5] border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-[#3E4F32]"
                  />
                  <button
                    onClick={handleExtractFromUrl}
                    disabled={isExtracting || !storeUrlInput.trim()}
                    className="px-3.5 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 text-xs font-medium text-white transition whitespace-nowrap"
                  >
                    {isExtracting ? 'Analyzing...' : 'Fetch Price'}
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isExtracting && (
              <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                <div className="w-6 h-6 border-2 border-[#3E4F32] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Analyzing price tags, net weights, and cut options with AI...</p>
              </div>
            )}

            {/* Error Message */}
            {extractionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{extractionError}</span>
              </div>
            )}

            {/* Detected Packages Review List */}
            {detectedPackages.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-stone-600">
                  Detected {detectedPackages.length} package option{detectedPackages.length === 1 ? '' : 's'}. Select which ones to add to your ingredient comparison:
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detectedPackages.map((pkg) => {
                    const isSelected = selectedDetectedIds.has(pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => {
                          const next = new Set(selectedDetectedIds);
                          if (next.has(pkg.id)) next.delete(pkg.id);
                          else next.add(pkg.id);
                          setSelectedDetectedIds(next);
                        }}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected ? 'bg-[#FAF8F5] border-[#3E4F32]' : 'bg-white border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-[#3E4F32] w-4 h-4 rounded"
                          />
                          <div>
                            <span className="font-semibold text-stone-900 block">{pkg.displayName}</span>
                            <span className="text-[11px] text-stone-500 font-mono">
                              {pkg.packAmount} {pkg.packUnit} · ~{pkg.edibleYieldPpm ? (pkg.edibleYieldPpm / 10000).toFixed(0) : '100'}% edible yield
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono font-semibold text-stone-900">
                          {pkg.priceCents !== null ? `$${(pkg.priceCents / 100).toFixed(2)}` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                  <button
                    onClick={() => setModalType(null)}
                    className="text-xs text-stone-500 hover:text-stone-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitDetectedPackages}
                    disabled={selectedDetectedIds.size === 0}
                    className="px-4 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 text-xs font-semibold text-white transition shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Add {selectedDetectedIds.size} Package{selectedDetectedIds.size === 1 ? '' : 's'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Budget</span>
        </button>

        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] font-medium text-xs text-white transition shadow-xs"
        >
          <span>Calculate Optimized Cart</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
