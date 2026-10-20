import { GoogleGenAI, Type } from '@google/genai';
import { GroceryPackage } from '../../src/types';

export interface ExtractPackagesImageRequest {
  imageBase64: string;
  mimeType?: string;
  canonicalIngredientId: string;
  ingredientName: string;
}

export interface ExtractPackagesUrlRequest {
  url: string;
  canonicalIngredientId: string;
  ingredientName: string;
}

export interface ExtractedPackageDraft {
  displayName: string;
  packAmount: string;
  packUnit: 'g' | 'kg' | 'oz' | 'lb' | 'count';
  priceCents: number;
  edibleYieldPercent: number; // e.g. 100 or 65
  foodForm: string;
  detectedPriceNote?: string;
}

export interface ExtractPackagesResponse {
  packages: GroceryPackage[];
  notes: string[];
  sourceLabel: string;
}

/**
 * Extracts grocery package offerings from a shelf photo or price tag image using Gemini 3.8 Flash
 */
export async function extractPackagesFromImage(
  req: ExtractPackagesImageRequest
): Promise<ExtractPackagesResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const cleanBase64 = req.imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
  const mimeType = req.mimeType || 'image/jpeg';

  const imagePart = {
    inlineData: {
      mimeType,
      data: cleanBase64,
    },
  };

  const textPart = {
    text: `You are looking at a grocery store shelf photo, meat counter, or product price tags for "${req.ingredientName}".
Identify all distinct available package options or selections visible in the photo.
For each package:
- Extract the package title or cut description (e.g. "Boneless Skinless Chicken Breast", "Bone-in Split Breasts Family Pack").
- Extract the net package weight/amount and standard unit ('g', 'kg', 'oz', 'lb', or 'count').
- Extract the package total price in integer cents (e.g. $11.49 => 1149). If only a per-pound price and package weight are given, compute total package price in cents = Math.round(pricePerLb * weightLbs * 100).
- Estimate the edible yield percentage after bone/skin/stem trimming (e.g., boneless raw meat: 100%, bone-in meat: 65%, whole unpeeled vegetables: 80%).
- State whether the food is boneless or bone-in in foodForm.`,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      systemInstruction: `You are an expert grocery shelf price and package extractor for home shoppers.
Return only schema-conformant JSON.
Extract every legible package selection and price tag.
If a price is missing or illegible, do not invent arbitrary numbers; set priceCents to null or omit the package.
All package prices must be integers in US cents.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          packages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                displayName: { type: Type.STRING, description: 'Package or cut name' },
                packAmount: { type: Type.STRING, description: 'Net weight/amount number string, e.g. 500, 1.5, 2.2' },
                packUnit: { type: Type.STRING, description: 'g, kg, oz, lb, or count' },
                priceCents: { type: Type.INTEGER, description: 'Total shelf price in cents' },
                edibleYieldPercent: { type: Type.INTEGER, description: 'Expected usable edible % after trimming (1..100)' },
                foodForm: { type: Type.STRING, description: 'e.g. raw_boneless, raw_bonein' },
                detectedPriceNote: { type: Type.STRING, description: 'Source reading note, e.g. $5.99/lb on 1.8 lb pack' },
              },
              required: ['displayName', 'packAmount', 'packUnit', 'priceCents', 'edibleYieldPercent', 'foodForm'],
            },
          },
          notes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['packages', 'notes'],
      },
    },
  });

  const rawJson = response.text?.trim() || '{}';
  const parsed = JSON.parse(rawJson);

  const packages: GroceryPackage[] = (parsed.packages || []).map((p: ExtractedPackageDraft, idx: number) => {
    const isBoneIn = p.foodForm.toLowerCase().includes('bone') || p.displayName.toLowerCase().includes('bone');
    const yieldPpm = Math.max(10000, Math.min(1000000, (p.edibleYieldPercent || (isBoneIn ? 65 : 100)) * 10000));

    return {
      id: `pkg-scan-${Date.now()}-${idx}`,
      canonicalIngredientId: req.canonicalIngredientId,
      displayName: p.displayName || `${req.ingredientName} Shelf Pack ${idx + 1}`,
      foodForm: p.foodForm || (isBoneIn ? 'raw_bonein' : 'raw_boneless'),
      dimension: p.packUnit === 'count' ? 'count' : 'mass',
      packAmount: String(p.packAmount || '500'),
      packUnit: (['g', 'kg', 'oz', 'lb', 'count'].includes(p.packUnit) ? p.packUnit : 'g') as any,
      priceCents: typeof p.priceCents === 'number' ? Math.max(0, p.priceCents) : null,
      edibleYieldPpm: yieldPpm,
      formCompatible: true,
      provenance: {
        type: 'USER_CONFIRMED',
        sourceLabel: 'Extracted from in-store shelf photo',
        observedAt: new Date().toISOString(),
        note: p.detectedPriceNote,
        confirmedByUser: true,
      },
      reviewStatus: 'confirmed',
    };
  });

  return {
    packages,
    notes: parsed.notes || [],
    sourceLabel: 'In-Store Shelf Photo',
  };
}

/**
 * Extracts product options and prices from a store product or catalog URL using Gemini 3.8 Flash
 */
export async function extractPackagesFromStoreUrl(
  req: ExtractPackagesUrlRequest
): Promise<ExtractPackagesResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('AI_NOT_CONFIGURED');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url);
  } catch {
    throw new Error('Invalid URL format. Please provide a full web address (e.g. https://www.store.com/item/chicken).');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS store links are supported.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('169.254.')
  ) {
    throw new Error('Private or local addresses cannot be fetched.');
  }

  let htmlText = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 YieldWise/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`The grocery store website responded with status ${res.status}.`);
    }

    htmlText = await res.text();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out while connecting to the store website.');
    }
    throw new Error(
      `Could not access this store website link (${err.message || 'connection failed'}). You can take a photo of the shelf or enter the price manually.`
    );
  }

  // Extract JSON-LD product metadata or OpenGraph tags if present
  const jsonLdMatch = htmlText.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let jsonLdContent = '';
  if (jsonLdMatch) {
    for (const tag of jsonLdMatch) {
      const content = tag.replace(/<\/?script[^>]*>/gi, '').trim();
      if (content.includes('"Product"') || content.includes('"price"') || content.includes('"offers"')) {
        jsonLdContent = content;
        break;
      }
    }
  }

  const sanitizedHtml = htmlText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const textToAnalyze = jsonLdContent
    ? `Store Product JSON-LD Metadata:\n${jsonLdContent.slice(0, 5000)}\n\nPage Text:\n${sanitizedHtml.slice(0, 5000)}`
    : sanitizedHtml.slice(0, 8000);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `Extract product grocery package size, net weight, shelf price, and food form from this grocery store website text for the item "${req.ingredientName}":
"""
${textToAnalyze}
"""
URL: ${parsedUrl.hostname}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction: `You are an expert grocery store product and price extraction component.
Extract the package title, net weight/size, total price in US cents (integer), and food preparation form (e.g. raw_boneless, raw_bonein).
If multiple sizes/options are on the page, extract up to 4 options.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          packages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                displayName: { type: Type.STRING, description: 'Product title' },
                packAmount: { type: Type.STRING, description: 'Package weight or count number' },
                packUnit: { type: Type.STRING, description: 'g, kg, oz, lb, or count' },
                priceCents: { type: Type.INTEGER, description: 'Price in cents' },
                edibleYieldPercent: { type: Type.INTEGER, description: 'Edible yield percentage (e.g. 100 or 65)' },
                foodForm: { type: Type.STRING, description: 'raw_boneless, raw_bonein, etc.' },
                detectedPriceNote: { type: Type.STRING, description: 'Note on price or size' },
              },
              required: ['displayName', 'packAmount', 'packUnit', 'priceCents', 'edibleYieldPercent', 'foodForm'],
            },
          },
          notes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['packages', 'notes'],
      },
    },
  });

  const rawJson = response.text?.trim() || '{}';
  const parsed = JSON.parse(rawJson);

  const packages: GroceryPackage[] = (parsed.packages || []).map((p: ExtractedPackageDraft, idx: number) => {
    const isBoneIn = p.foodForm.toLowerCase().includes('bone') || p.displayName.toLowerCase().includes('bone');
    const yieldPpm = Math.max(10000, Math.min(1000000, (p.edibleYieldPercent || (isBoneIn ? 65 : 100)) * 10000));

    return {
      id: `pkg-url-${Date.now()}-${idx}`,
      canonicalIngredientId: req.canonicalIngredientId,
      displayName: p.displayName || `${req.ingredientName} Store Item ${idx + 1}`,
      foodForm: p.foodForm || (isBoneIn ? 'raw_bonein' : 'raw_boneless'),
      dimension: p.packUnit === 'count' ? 'count' : 'mass',
      packAmount: String(p.packAmount || '500'),
      packUnit: (['g', 'kg', 'oz', 'lb', 'count'].includes(p.packUnit) ? p.packUnit : 'g') as any,
      priceCents: typeof p.priceCents === 'number' ? Math.max(0, p.priceCents) : null,
      edibleYieldPpm: yieldPpm,
      formCompatible: true,
      provenance: {
        type: 'USER_CONFIRMED',
        sourceLabel: `Imported from ${parsedUrl.hostname}`,
        observedAt: new Date().toISOString(),
        note: p.detectedPriceNote,
        confirmedByUser: true,
      },
      reviewStatus: 'confirmed',
    };
  });

  return {
    packages,
    notes: parsed.notes || [],
    sourceLabel: parsedUrl.hostname,
  };
}
