import React from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Check } from 'lucide-react';
import { scaleRequirement } from '../algorithms/portionCalculator';
import { formatCanonicalQuantity } from '../algorithms/yieldCalculator';
import { Recipe, VerifiedPantryEntry } from '../types';

interface RequirementsReviewProps {
  recipe: Recipe;
  verifiedPantry: VerifiedPantryEntry[];
  onUpdatePantry: (entries: VerifiedPantryEntry[]) => void;
  onConfirmRequirement: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const RequirementsReview: React.FC<RequirementsReviewProps> = ({
  recipe,
  verifiedPantry,
  onUpdatePantry,
  onNext,
  onBack,
}) => {
  const scaledRequirements = recipe.requirements.map((req) =>
    scaleRequirement(req, recipe.targetServings, verifiedPantry)
  );

  const handlePantryChange = (requirementId: string, amountStr: string, dimension: 'mass' | 'count') => {
    const parsed = parseFloat(amountStr);
    let canonicalStr = '0';
    if (!isNaN(parsed) && parsed > 0) {
      canonicalStr = dimension === 'count' ? String(Math.floor(parsed)) : String(Math.round(parsed * 1000));
    }

    const filtered = verifiedPantry.filter((p) => p.ingredientRequirementId !== requirementId);
    if (parsed > 0) {
      filtered.push({
        ingredientRequirementId: requirementId,
        usableCanonicalQuantity: canonicalStr,
        dimension,
        foodForm: 'verified',
        provenance: {
          type: 'USER_CONFIRMED',
          sourceLabel: 'Pantry inventory',
          observedAt: new Date().toISOString(),
          confirmedByUser: true,
        },
        confirmedByUser: true,
      });
    }
    onUpdatePantry(filtered);
  };

  const hasBlockers = scaledRequirements.some((s) => Boolean(s.blocker));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Review Requirements</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Portions scaled to {recipe.targetServings} servings. Deduct any ingredients already in your pantry.
          </p>
        </div>
        <span className="text-xs font-mono text-stone-500">
          Scale: {recipe.targetServings}×
        </span>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-[#FAF8F5] text-stone-600 font-medium">
                <th className="py-2.5 px-4">Ingredient</th>
                <th className="py-2.5 px-3">Base</th>
                <th className="py-2.5 px-3">Scaled Target</th>
                <th className="py-2.5 px-3">Pantry Offset</th>
                <th className="py-2.5 px-3 font-semibold text-stone-900">Net Required</th>
                <th className="py-2.5 px-4 text-right">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-800">
              {recipe.requirements.map((req) => {
                const scaled = scaledRequirements.find((s) => s.id === req.id);
                const matchingPantry = verifiedPantry.find(
                  (p) => p.ingredientRequirementId === req.id
                );
                const pantryDisplay = matchingPantry
                  ? req.dimension === 'count'
                    ? matchingPantry.usableCanonicalQuantity
                    : String(Math.round(parseFloat(matchingPantry.usableCanonicalQuantity) / 1000))
                  : '';

                return (
                  <tr key={req.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900">{req.displayName}</div>
                      <div className="text-[11px] text-stone-500 capitalize">
                        {req.state.replace('_', ' ')}
                      </div>
                      {scaled?.warnings && scaled.warnings.length > 0 && (
                        <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>{scaled.warnings[0]}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-stone-600">
                      {req.baseAmount} {req.baseUnit}
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums font-medium text-stone-900">
                      {scaled
                        ? formatCanonicalQuantity(scaled.rawTargetCanonical, req.dimension, req.baseUnit)
                        : '—'}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={pantryDisplay}
                          onChange={(e) =>
                            handlePantryChange(
                              req.id,
                              e.target.value,
                              req.dimension === 'count' ? 'count' : 'mass'
                            )
                          }
                          placeholder="0"
                          className="w-16 bg-[#FAF8F5] border border-stone-200 rounded px-2 py-1 text-xs font-mono text-stone-900 focus:outline-none focus:border-[#3E4F32]"
                        />
                        <span className="text-[11px] text-stone-500">
                          {req.dimension === 'count' ? 'ct' : 'g'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {scaled ? (
                        scaled.requiredCanonical === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#3E4F32] font-medium">
                            <Check className="w-3 h-3" />
                            <span>Pantry covered</span>
                          </span>
                        ) : (
                          <span className="font-mono tabular-nums font-semibold text-[#3E4F32]">
                            {formatCanonicalQuantity(
                              scaled.requiredCanonical,
                              req.dimension,
                              req.baseUnit
                            )}
                          </span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-4 text-right text-[11px] text-stone-500">
                      <span>{req.provenance.type === 'USER_CONFIRMED' ? 'Confirmed' : 'Sample'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 bg-[#FAF8F5] border-t border-stone-200">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Recipe</span>
          </button>

          <button
            onClick={onNext}
            disabled={hasBlockers}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 font-medium text-xs text-white transition shadow-xs"
          >
            <span>Set Budget & Priorities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
