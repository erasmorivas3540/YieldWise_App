import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
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
  onConfirmRequirement,
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
      canonicalStr = dimension === 'count' ? String(Math.floor(parsed)) : String(Math.round(parsed * 1000)); // input in grams => mg
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
          sourceLabel: 'User pantry inventory',
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Review Ingredient Requirements</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Scaled to {recipe.targetServings} servings using deterministic integer math. Subtract ingredients you already have at home.
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 w-fit">
            Serving Multiplier: {recipe.targetServings}×
          </span>
        </div>

        {/* Requirements Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3 px-3">Ingredient</th>
                <th className="py-3 px-3">Per Serving</th>
                <th className="py-3 px-3">Scaled Target</th>
                <th className="py-3 px-3">Home Pantry (g or count)</th>
                <th className="py-3 px-3">Net Required</th>
                <th className="py-3 px-3 text-right">Data Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
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
                  <tr key={req.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-medium text-slate-200">
                      <div>{req.displayName}</div>
                      <div className="text-[11px] text-slate-500 capitalize">
                        {req.state.replace('_', ' ')} • {req.foodForm}
                      </div>
                      {scaled?.warnings && scaled.warnings.length > 0 && (
                        <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{scaled.warnings[0]}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {req.baseAmount} {req.baseUnit}
                    </td>

                    <td className="py-3 px-3 font-semibold text-white">
                      {scaled
                        ? formatCanonicalQuantity(scaled.rawTargetCanonical, req.dimension, req.baseUnit)
                        : '—'}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
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
                          className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-[11px] text-slate-500">
                          {req.dimension === 'count' ? 'count' : 'g'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {scaled ? (
                        scaled.requiredCanonical === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Covered by pantry</span>
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-400">
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

                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{req.provenance.type}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Informational callout on math guarantee */}
        <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-300">
              Deterministic Math & Dimension Safety:
            </p>
            <p>
              Target amounts use ceiling integer arithmetic (<code className="text-slate-300">ceil(base * servings / baseServings)</code>) to ensure you never run short of raw edible mass. Trimming losses (stems, bone, skin) are computed during package comparison.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Recipe</span>
          </button>

          <button
            onClick={onNext}
            disabled={hasBlockers}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm text-white shadow-sm transition"
          >
            <span>Set Budget & Priorities</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
