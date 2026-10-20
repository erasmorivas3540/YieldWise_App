import { Router } from 'express';
import { optimizeBudget, optimizeRecipe } from '../../src/algorithms/budgetOptimizer';
import { scaleRequirement } from '../../src/algorithms/portionCalculator';
import { BudgetOptimizationRequest, OptimizationOptions, Recipe } from '../../src/types';
import { parseRecipeFromUrl, parseRecipeWithGemini } from '../services/geminiParser';
import { extractPackagesFromImage, extractPackagesFromStoreUrl } from '../services/packageExtractor';

export const apiRouter = Router();

/**
 * Health check endpoint
 */
apiRouter.get('/health', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const aiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  res.json({
    ok: true,
    version: '1.1',
    appName: 'YieldWise',
    aiConfigured,
  });
});

/**
 * AI recipe draft extraction
 */
apiRouter.post('/recipes/parse', async (req, res) => {
  try {
    const { text, imageBase64, mimeType, url, preferredServings } = req.body;

    if (url && typeof url === 'string') {
      const result = await parseRecipeFromUrl(url.trim(), preferredServings);
      return res.json(result);
    }

    if (imageBase64 && typeof imageBase64 === 'string') {
      const result = await parseRecipeWithGemini({
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
        preferredServings,
      });
      return res.json(result);
    }

    if (text && typeof text === 'string' && text.trim().length > 0) {
      if (text.length > 20000) {
        return res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Recipe text exceeds character limit.',
        });
      }
      const result = await parseRecipeWithGemini({ text, preferredServings });
      return res.json(result);
    }

    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Please provide either a meal name/recipe text, an image screenshot, or a recipe URL.',
    });
  } catch (err: any) {
    if (err.message === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'AI_NOT_CONFIGURED',
        message: 'Gemini API key is not configured. Manual entry flow is fully available.',
      });
    }
    console.error('Recipe parse error:', err);
    res.status(500).json({
      error: 'PARSER_ERROR',
      message: err.message || 'Failed to parse recipe.',
    });
  }
});

/**
 * Pure requirement scaling endpoint
 */
apiRouter.post('/requirements/scale', (req, res) => {
  try {
    const { recipe, servings, verifiedPantry } = req.body;
    if (!recipe || !Array.isArray(recipe.requirements)) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid recipe object provided.',
      });
    }

    const targetServings = typeof servings === 'number' ? servings : recipe.targetServings || 4;
    const pantry = Array.isArray(verifiedPantry) ? verifiedPantry : [];

    const scaled = recipe.requirements.map((reqItem: any) =>
      scaleRequirement(reqItem, targetServings, pantry)
    );

    res.json({
      recipeId: recipe.id,
      targetServings,
      requirements: scaled,
      calculatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(422).json({
      error: 'SCALING_ERROR',
      message: err.message || 'Failed to scale requirements.',
    });
  }
});

/**
 * Standard unbudgeted optimization endpoint
 */
apiRouter.post('/optimize', (req, res) => {
  try {
    const { recipe, packages, options, verifiedPantry } = req.body;
    if (!recipe || !Array.isArray(recipe.requirements)) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Valid recipe is required.',
      });
    }
    if (!Array.isArray(packages)) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Packages list must be an array.',
      });
    }

    const optOptions: OptimizationOptions = {
      objective: options?.objective === 'least_estimated_leftover' ? 'least_estimated_leftover' : 'lowest_checkout_cost',
      maxSkuOptionsPerIngredient: options?.maxSkuOptionsPerIngredient || 4,
      maxPacksPerSku: options?.maxPacksPerSku || 12,
      maxCombinationsPerIngredient: options?.maxCombinationsPerIngredient || 100000,
    };

    const result = optimizeRecipe(recipe, packages, optOptions, verifiedPantry || []);
    res.json(result);
  } catch (err: any) {
    res.status(422).json({
      error: 'OPTIMIZATION_ERROR',
      message: err.message || 'Optimization calculation failed.',
    });
  }
});

/**
 * Smart Budget Mode v1.1 endpoint
 */
apiRouter.post('/budget/optimize', (req, res) => {
  try {
    const budgetRequest = req.body as BudgetOptimizationRequest;

    if (!budgetRequest || !budgetRequest.recipe || !budgetRequest.options) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        code: 'INVALID_REQUEST_BODY',
        message: 'BudgetOptimizationRequest body is incomplete.',
      });
    }

    const { options } = budgetRequest;

    if (typeof options.budgetCents !== 'number' || !Number.isInteger(options.budgetCents) || options.budgetCents < 0) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        code: 'INVALID_BUDGET_CENTS',
        message: 'Budget must be a non-negative integer in cents.',
      });
    }

    if (!Array.isArray(options.priorities)) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        code: 'MISSING_CONFIRMED_PRIORITY',
        message: 'Priorities array must be provided for all requirements.',
      });
    }

    const result = optimizeBudget(budgetRequest);
    res.json(result);
  } catch (err: any) {
    if (err.code) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        code: err.code,
        message: err.message,
      });
    }
    res.status(422).json({
      error: 'BUDGET_OPTIMIZATION_ERROR',
      code: 'EXECUTION_FAILED',
      message: err.message || 'Budget optimization failed.',
    });
  }
});

/**
 * Extract package offerings from an in-store shelf photo
 */
apiRouter.post('/packages/extract-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType, canonicalIngredientId, ingredientName } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Image data is required.',
      });
    }

    const result = await extractPackagesFromImage({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      canonicalIngredientId: canonicalIngredientId || 'ingredient',
      ingredientName: ingredientName || 'ingredient',
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'AI_NOT_CONFIGURED',
        message: 'Gemini API key is not configured for shelf photo analysis.',
      });
    }
    console.error('Shelf photo extraction error:', err);
    res.status(500).json({
      error: 'EXTRACTION_ERROR',
      message: err.message || 'Failed to extract package selections from photo.',
    });
  }
});

/**
 * Extract package offerings from a grocery store product page URL
 */
apiRouter.post('/packages/extract-url', async (req, res) => {
  try {
    const { url, canonicalIngredientId, ingredientName } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: 'Store URL is required.',
      });
    }

    const result = await extractPackagesFromStoreUrl({
      url: url.trim(),
      canonicalIngredientId: canonicalIngredientId || 'ingredient',
      ingredientName: ingredientName || 'ingredient',
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'AI_NOT_CONFIGURED',
        message: 'Gemini API key is not configured.',
      });
    }
    console.error('Store URL extraction error:', err);
    res.status(500).json({
      error: 'EXTRACTION_ERROR',
      message: err.message || 'Failed to extract package from store URL.',
    });
  }
});
