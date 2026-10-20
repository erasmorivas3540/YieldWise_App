import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, ArrowRight, BookOpen, AlertCircle, Users, Check } from 'lucide-react';
import { IngredientRequirement, Recipe } from '../types';
import { DEMO_MEALS } from '../services/demoData';

interface MealPlannerProps {
  recipe: Recipe;
  onUpdateRecipe: (updated: Recipe) => void;
  onLoadDemo: (demoId: string) => void;
  onNext: () => void;
  aiConfigured: boolean;
}

export const MealPlanner: React.FC<MealPlannerProps> = ({
  recipe,
  onUpdateRecipe,
  onLoadDemo,
  onNext,
  aiConfigured,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const handleServingChange = (newVal: number) => {
    const clamped = Math.max(1, Math.min(12, newVal));
    onUpdateRecipe({
      ...recipe,
      targetServings: clamped,
    });
  };

  const handleTitleChange = (title: string) => {
    onUpdateRecipe({ ...recipe, title });
  };

  const handleAddIngredient = () => {
    const newReq: IngredientRequirement = {
      id: `req-${Date.now()}`,
      canonicalIngredientId: `ing_${Date.now()}`,
      displayName: '',
      foodForm: 'raw_edible',
      dimension: 'mass',
      state: 'raw_edible',
      baseAmount: '100',
      baseUnit: 'g',
      baseServings: 1,
      provenance: {
        type: 'USER_CONFIRMED',
        sourceLabel: 'User manual entry',
        observedAt: new Date().toISOString(),
        confirmedByUser: true,
      },
      reviewStatus: 'confirmed',
    };

    onUpdateRecipe({
      ...recipe,
      requirements: [...recipe.requirements, newReq],
    });
  };

  const handleUpdateIngredient = (id: string, updates: Partial<IngredientRequirement>) => {
    const updated = recipe.requirements.map((r) => {
      if (r.id === id) {
        return { ...r, ...updates };
      }
      return r;
    });
    onUpdateRecipe({ ...recipe, requirements: updated });
  };

  const handleRemoveIngredient = (id: string) => {
    const filtered = recipe.requirements.filter((r) => r.id !== id);
    onUpdateRecipe({ ...recipe, requirements: filtered });
  };

  const handleParseWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setAiNotice(null);

    try {
      const res = await fetch('/api/v1/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiPrompt,
          preferredServings: recipe.targetServings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to parse recipe');
      }

      onUpdateRecipe(data.draft);
      if (data.isAiSuggested) {
        setAiNotice('Amounts were estimated by AI based on typical portions. Please review and verify all weights below.');
      }
    } catch (err: any) {
      setParseError(err.message || 'AI parsing unavailable. You can enter ingredients manually below.');
    } finally {
      setIsParsing(false);
    }
  };

  const isValid =
    recipe.title.trim().length > 0 &&
    recipe.requirements.length > 0 &&
    recipe.requirements.every((r) => r.displayName.trim().length > 0 && parseFloat(r.baseAmount) > 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero / Introduction */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            Meal Planning Math Made Deterministic
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Buy enough for dinner — without guessing.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            Scale meal portions, account for vegetable stems & bone trim loss, and calculate the cheapest grocery cart combination of real, discrete package sizes.
          </p>

          {/* Quick Demo Loader Cards */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Or explore an authored demo dinner:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DEMO_MEALS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onLoadDemo(d.id)}
                  className="text-left p-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-emerald-500/50 transition group"
                >
                  <div className="font-semibold text-xs sm:text-sm text-slate-200 group-hover:text-emerald-300 line-clamp-1">
                    {d.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {d.targetServings} servings • {d.recipe.requirements.length} ingredients
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Parsing Assist (Optional) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Draft Ingredient List with AI (Optional)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {aiConfigured ? 'Gemini 3.8 Flash Ready' : 'Deterministic Mode (Manual Entry)'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Paste a recipe, ingredients, or a meal description (e.g. <span className="text-slate-300 italic">&ldquo;Chicken, rice and broccoli for 6&rdquo;</span>). All AI suggestions are marked as drafts and must be reviewed.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleParseWithAi()}
            placeholder="e.g., Salmon with roasted asparagus and baby potatoes for 4 people..."
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            onClick={handleParseWithAi}
            disabled={isParsing || !aiPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm text-white transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isParsing ? (
              <span>Drafting...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Draft with AI</span>
              </>
            )}
          </button>
        </div>

        {parseError && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {aiNotice && (
          <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span>{aiNotice}</span>
          </div>
        )}
      </div>

      {/* Recipe Details Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Recipe / Meal Title
            </label>
            <input
              type="text"
              value={recipe.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., Saturday Dinner with Friends"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm sm:text-base font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Servings Counter (1 to 12) */}
          <div className="sm:w-56">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Target Servings (1–12)</span>
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleServingChange(recipe.targetServings - 1)}
                disabled={recipe.targetServings <= 1}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold transition flex items-center justify-center text-sm"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="12"
                value={recipe.targetServings}
                onChange={(e) => handleServingChange(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-transparent text-center font-bold text-white text-base focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleServingChange(recipe.targetServings + 1)}
                disabled={recipe.targetServings >= 12}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold transition flex items-center justify-center text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Ingredients Table / List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Base Ingredients</h3>
              <p className="text-xs text-slate-400">
                Amounts entered here represent the portion per {recipe.requirements[0]?.baseServings || 1} serving(s).
              </p>
            </div>
            <button
              onClick={handleAddIngredient}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ingredient</span>
            </button>
          </div>

          {recipe.requirements.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl p-6">
              <p className="text-sm text-slate-400 mb-3">No ingredients added yet.</p>
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white"
              >
                Add Your First Ingredient
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recipe.requirements.map((req, idx) => (
                <div
                  key={req.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl items-center"
                >
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase md:hidden mb-1">
                      Ingredient Name
                    </label>
                    <input
                      type="text"
                      value={req.displayName}
                      onChange={(e) =>
                        handleUpdateIngredient(req.id, {
                          displayName: e.target.value,
                          canonicalIngredientId:
                            req.canonicalIngredientId ||
                            e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                        })
                      }
                      placeholder="e.g. Boneless Chicken Breast"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase md:hidden mb-1">
                      Per-Serving Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={req.baseAmount}
                      onChange={(e) => handleUpdateIngredient(req.id, { baseAmount: e.target.value })}
                      placeholder="170"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase md:hidden mb-1">
                      Unit
                    </label>
                    <select
                      value={req.baseUnit}
                      onChange={(e) =>
                        handleUpdateIngredient(req.id, {
                          baseUnit: e.target.value,
                          dimension: e.target.value === 'count' ? 'count' : 'mass',
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="g">grams (g)</option>
                      <option value="kg">kilograms (kg)</option>
                      <option value="oz">ounces (oz)</option>
                      <option value="lb">pounds (lb)</option>
                      <option value="count">count / pieces</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase md:hidden mb-1">
                      Prep State
                    </label>
                    <select
                      value={req.state}
                      onChange={(e) =>
                        handleUpdateIngredient(req.id, {
                          state: e.target.value as any,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="raw_edible">Raw (edible trimmed)</option>
                      <option value="cooked_edible">Cooked (edible target)</option>
                      <option value="as_purchased">As-purchased gross</option>
                      <option value="count">Count units</option>
                    </select>
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      onClick={() => handleRemoveIngredient(req.id)}
                      title="Delete ingredient"
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Next Step */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {recipe.requirements.length} ingredient(s) ready for {recipe.targetServings} servings.
          </div>
          <button
            onClick={onNext}
            disabled={!isValid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm text-white shadow-sm transition"
          >
            <span>Review Scaling & Pantry</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
