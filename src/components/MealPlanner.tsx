import React, { useRef, useState } from 'react';
import { Plus, Trash2, ArrowRight, Sparkles, Image, Link as LinkIcon, Type, X, Upload } from 'lucide-react';
import { IngredientRequirement, Recipe } from '../types';
import { DEMO_MEALS } from '../services/demoData';

interface MealPlannerProps {
  recipe: Recipe;
  onUpdateRecipe: (updated: Recipe) => void;
  onLoadDemo: (demoId: string) => void;
  onNext: () => void;
  aiConfigured: boolean;
}

type InputMode = 'text' | 'screenshot' | 'link';

export const MealPlanner: React.FC<MealPlannerProps> = ({
  recipe,
  onUpdateRecipe,
  onLoadDemo,
  onNext,
  aiConfigured,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [aiText, setAiText] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState<string>('image/jpeg');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessNote, setParseSuccessNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // File upload for screenshot
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setParseError('Please upload an image file (PNG, JPEG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setParseError('Image size must be under 8 MB.');
      return;
    }

    setParseError(null);
    setScreenshotMime(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setScreenshotPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  // Submit AI extraction based on active mode
  const handleExtractRecipe = async () => {
    setIsParsing(true);
    setParseError(null);
    setParseSuccessNote(null);

    try {
      let body: any = { preferredServings: recipe.targetServings };

      if (inputMode === 'text') {
        if (!aiText.trim()) throw new Error('Please enter a meal name or paste recipe text.');
        body.text = aiText.trim();
      } else if (inputMode === 'screenshot') {
        if (!screenshotPreview) throw new Error('Please select or upload a recipe screenshot first.');
        body.imageBase64 = screenshotPreview;
        body.mimeType = screenshotMime;
      } else if (inputMode === 'link') {
        if (!recipeUrl.trim()) throw new Error('Please enter a valid recipe website link.');
        body.url = recipeUrl.trim();
      }

      const res = await fetch('/api/v1/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to extract recipe.');
      }

      onUpdateRecipe(data.draft);
      setParseSuccessNote(`Recipe "${data.draft.title}" loaded with ${data.draft.requirements.length} ingredients.`);
      if (inputMode === 'text') setAiText('');
      if (inputMode === 'link') setRecipeUrl('');
    } catch (err: any) {
      setParseError(err.message || 'Recipe extraction failed.');
    } finally {
      setIsParsing(false);
    }
  };

  const isValid =
    recipe.title.trim().length > 0 &&
    recipe.requirements.length > 0 &&
    recipe.requirements.every((r) => r.displayName.trim().length > 0 && parseFloat(r.baseAmount) > 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header & Demo Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Plan Dinner</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Add ingredients manually, upload a recipe screenshot, or import from a web link.
          </p>
        </div>

        {/* Sample Meal Shortcuts */}
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span className="text-stone-400">Sample:</span>
          {DEMO_MEALS.map((d, i) => (
            <React.Fragment key={d.id}>
              {i > 0 && <span className="text-stone-300">·</span>}
              <button
                onClick={() => onLoadDemo(d.id)}
                className="hover:text-[#3E4F32] hover:underline underline-offset-2 transition"
              >
                {d.name.split(',')[0].split('&')[0].trim()}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Smart Recipe Import Module (Text / Screenshot / Link) */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#3E4F32]" />
            <span>Fast Recipe Import</span>
          </span>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] border border-stone-200 rounded-lg p-0.5 w-fit">
            <button
              type="button"
              onClick={() => { setInputMode('text'); setParseError(null); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                inputMode === 'text'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Type className="w-3 h-3" />
              <span>Meal Name / Text</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode('screenshot'); setParseError(null); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                inputMode === 'screenshot'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Image className="w-3 h-3" />
              <span>Screenshot</span>
            </button>
            <button
              type="button"
              onClick={() => { setInputMode('link'); setParseError(null); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                inputMode === 'link'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>Recipe Link</span>
            </button>
          </div>
        </div>

        {/* Mode 1: Text / Meal Name Input */}
        {inputMode === 'text' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtractRecipe()}
              placeholder="e.g. 'Chicken, rice and broccoli for 6' or paste ingredient list..."
              className="flex-1 bg-[#FAF8F5] border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#3E4F32] transition"
            />
            <button
              onClick={handleExtractRecipe}
              disabled={isParsing || !aiText.trim()}
              className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-xs font-medium text-white transition flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isParsing ? 'Drafting...' : 'Draft Recipe'}</span>
            </button>
          </div>
        )}

        {/* Mode 2: Screenshot / Photo Upload */}
        {inputMode === 'screenshot' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />

            {screenshotPreview ? (
              <div className="flex items-center gap-4 p-3 bg-[#FAF8F5] border border-stone-200 rounded-lg">
                <img
                  src={screenshotPreview}
                  alt="Recipe screenshot"
                  className="w-16 h-16 object-cover rounded border border-stone-300"
                />
                <div className="flex-1 text-xs text-stone-600">
                  <span className="font-semibold text-stone-900 block">Screenshot ready</span>
                  <span className="text-[11px] text-stone-500">Gemini 3.8 Flash will extract ingredients and quantities.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScreenshotPreview(null)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 transition"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExtractRecipe}
                    disabled={isParsing}
                    className="px-3.5 py-1.5 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 text-xs font-medium text-white transition whitespace-nowrap"
                  >
                    {isParsing ? 'Extracting...' : 'Extract Recipe'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                }}
                className="border border-dashed border-stone-300 hover:border-[#3E4F32] bg-[#FAF8F5] rounded-lg p-5 text-center cursor-pointer transition group"
              >
                <Upload className="w-5 h-5 mx-auto text-stone-400 group-hover:text-[#3E4F32] mb-1.5 transition" />
                <p className="text-xs text-stone-700 font-medium">
                  Click to upload or drag & drop a screenshot of a recipe
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Supports cookbook photos, phone screenshots, or ingredient labels (PNG, JPEG, WebP)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mode 3: Recipe URL Link */}
        {inputMode === 'link' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExtractRecipe()}
              placeholder="e.g. https://www.example.com/recipes/baked-chicken"
              className="flex-1 bg-[#FAF8F5] border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#3E4F32] transition font-mono"
            />
            <button
              onClick={handleExtractRecipe}
              disabled={isParsing || !recipeUrl.trim()}
              className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-xs font-medium text-white transition flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>{isParsing ? 'Fetching...' : 'Fetch Recipe'}</span>
            </button>
          </div>
        )}

        {/* Status / Feedback messages */}
        {parseError && (
          <div className="text-xs text-rose-600 bg-rose-50/60 border border-rose-200 rounded-lg p-2.5">
            {parseError}
          </div>
        )}
        {parseSuccessNote && (
          <div className="text-xs text-[#3E4F32] bg-[#FAF8F5] border border-stone-200 rounded-lg p-2.5">
            {parseSuccessNote}
          </div>
        )}
      </div>

      {/* Recipe Meta: Title & Servings */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-8">
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Recipe Name
            </label>
            <input
              type="text"
              value={recipe.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Chicken, Rice & Broccoli Dinner"
              className="w-full bg-[#FAF8F5] border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 font-medium placeholder-stone-400 focus:outline-none focus:border-[#3E4F32] transition"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Target Servings (1–12)
            </label>
            <div className="flex items-center border border-stone-200 bg-[#FAF8F5] rounded-lg p-1">
              <button
                type="button"
                onClick={() => handleServingChange(recipe.targetServings - 1)}
                disabled={recipe.targetServings <= 1}
                className="w-8 h-8 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 disabled:opacity-30 font-medium transition flex items-center justify-center text-sm"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="12"
                value={recipe.targetServings}
                onChange={(e) => handleServingChange(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-transparent text-center font-mono font-semibold text-stone-900 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleServingChange(recipe.targetServings + 1)}
                disabled={recipe.targetServings >= 12}
                className="w-8 h-8 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 disabled:opacity-30 font-medium transition flex items-center justify-center text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients List */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Base Ingredients</h2>
            <p className="text-xs text-stone-500">Amounts per 1 serving</p>
          </div>
          <button
            onClick={handleAddIngredient}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-2">
          {recipe.requirements.map((req) => (
            <div
              key={req.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-[#FAF8F5] border border-stone-200/80 rounded-lg items-center"
            >
              <div className="sm:col-span-5">
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
                  placeholder="Ingredient name (e.g. Chicken Breast)"
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#3E4F32]"
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={req.baseAmount}
                  onChange={(e) => handleUpdateIngredient(req.id, { baseAmount: e.target.value })}
                  placeholder="Amount"
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 font-mono focus:outline-none focus:border-[#3E4F32]"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={req.baseUnit}
                  onChange={(e) =>
                    handleUpdateIngredient(req.id, {
                      baseUnit: e.target.value,
                      dimension: e.target.value === 'count' ? 'count' : 'mass',
                    })
                  }
                  className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-[#3E4F32]"
                >
                  <option value="g">grams (g)</option>
                  <option value="kg">kilograms (kg)</option>
                  <option value="oz">ounces (oz)</option>
                  <option value="lb">pounds (lb)</option>
                  <option value="count">count</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={req.state}
                  onChange={(e) =>
                    handleUpdateIngredient(req.id, {
                      state: e.target.value as any,
                    })
                  }
                  className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-[#3E4F32]"
                >
                  <option value="raw_edible">Raw edible</option>
                  <option value="cooked_edible">Cooked target</option>
                  <option value="as_purchased">As purchased</option>
                  <option value="count">Count unit</option>
                </select>
              </div>

              <div className="sm:col-span-1 flex justify-end">
                <button
                  onClick={() => handleRemoveIngredient(req.id)}
                  title="Remove item"
                  className="p-1 text-stone-400 hover:text-stone-700 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Next */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <span className="text-xs text-stone-500 font-mono tabular-nums">
            {recipe.requirements.length} item{recipe.requirements.length === 1 ? '' : 's'} · {recipe.targetServings} servings
          </span>

          <button
            onClick={onNext}
            disabled={!isValid}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3E4F32] hover:bg-[#34422A] disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs text-white shadow-xs transition"
          >
            <span>Review Requirements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
