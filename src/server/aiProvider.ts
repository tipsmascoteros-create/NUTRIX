import type { GoogleGenAI } from '@google/genai';
import { calculateRecipeNutrition, findTacoFood } from '../data/tacoDatabase.js';
import type {
  EconomyTipResult,
  MealPlanDay,
  PantryItem,
  RecipeImageKey,
  RecipeIngredient,
  RecognizedIngredient,
  SavedRecipe,
  UserProfile,
} from '../types/nutrix.js';

export interface GenerateRecipesInput {
  pantryItems: PantryItem[];
  profile: Partial<UserProfile>;
  customPrompt?: string;
  filters: string[];
  servings: number;
  maxPrepTimeMin?: number;
  onlyAvailableIngredients: boolean;
  prioritizeExpiring: boolean;
  count?: number;
}

export interface GeneratedRecipePayload
  extends Omit<SavedRecipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {}

export interface NutrixAIProvider {
  readonly providerName: string;
  generateRecipes(input: GenerateRecipesInput): Promise<GeneratedRecipePayload[]>;
  recognizeIngredientsFromPhoto(
    base64Data: string,
    mimeType: string,
  ): Promise<{ items: RecognizedIngredient[]; safetyNote: string }>;
  generateWeeklyMealPlan(input: {
    pantryItems: PantryItem[];
    profile: Partial<UserProfile>;
    servings: number;
    weekKey: string;
  }): Promise<{ days: MealPlanDay[]; totalEstimatedCostBrl: number }>;
  analyzeEconomy(input: {
    pantryItems: PantryItem[];
    profile: Partial<UserProfile>;
    spentThisWeekBrl: number;
  }): Promise<EconomyTipResult>;
}

export class GeminiProviderError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GeminiProviderError';
    this.statusCode = statusCode;
  }
}

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function extractUpstreamErrorInfo(error: unknown): { code?: number; status?: string; message: string } {
  const errObj = (error && typeof error === 'object' ? error : {}) as {
    status?: number | string;
    code?: number | string;
    message?: string;
  };
  let rawMessage = error instanceof Error ? error.message : String(error ?? '');
  let code = typeof errObj.status === 'number' ? errObj.status : typeof errObj.code === 'number' ? errObj.code : undefined;
  let status = typeof errObj.status === 'string' ? errObj.status : undefined;

  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { code?: number; status?: string; message?: string };
      };
      if (parsed.error) {
        if (typeof parsed.error.code === 'number') code = parsed.error.code;
        if (typeof parsed.error.status === 'string') status = parsed.error.status;
        if (typeof parsed.error.message === 'string') rawMessage = parsed.error.message;
      }
    } catch {
      // Keep original message
    }
  }

  return { code, status, message: rawMessage };
}

function isRetryableOverload(info: { code?: number; status?: string; message: string }): boolean {
  if (info.code === 503 || info.code === 500 || info.code === 504) return true;
  if (info.status === 'UNAVAILABLE' || info.status === 'INTERNAL' || info.status === 'DEADLINE_EXCEEDED') {
    return true;
  }
  return /high demand|overloaded|unavailable|temporarily|timeout|econnreset|etimedout|fetch failed/i.test(
    info.message,
  );
}

function isRateLimitError(info: { code?: number; status?: string; message: string }): boolean {
  return info.code === 429 || info.status === 'RESOURCE_EXHAUSTED' || /quota|rate limit|resource_exhausted/i.test(info.message);
}

function toFriendlyProviderError(error: unknown): GeminiProviderError {
  if (error instanceof GeminiProviderError) return error;
  const info = extractUpstreamErrorInfo(error);

  if (info.message.includes('GEMINI_API_KEY')) {
    return new GeminiProviderError('GEMINI_API_KEY não configurada no servidor.', 502);
  }
  if (isRetryableOverload(info)) {
    return new GeminiProviderError(
      'O serviço está com pico temporário de demanda neste momento. Aguarde alguns segundos e tente novamente.',
      503,
    );
  }
  if (isRateLimitError(info)) {
    return new GeminiProviderError(
      'Limite momentâneo de solicitações atingido. Aguarde cerca de 1 minuto e tente novamente.',
      429,
    );
  }
  if (
    info.code === 403 ||
    info.status === 'PERMISSION_DENIED' ||
    /API_KEY_INVALID|API key not valid/i.test(info.message)
  ) {
    return new GeminiProviderError(
      'Chave de API inválida ou sem permissão. Verifique GEMINI_API_KEY nas configurações do servidor.',
      502,
    );
  }

  return new GeminiProviderError(
    'Não foi possível concluir a geração agora. Tente novamente em alguns instantes.',
    502,
  );
}

async function callWithFallback<T>(runForModel: (model: string) => Promise<T>): Promise<T> {
  const attempts: Array<{ model: string; delayAfterMs: number }> = [
    { model: PRIMARY_MODEL, delayAfterMs: 900 },
    { model: PRIMARY_MODEL, delayAfterMs: 1400 },
    { model: FALLBACK_MODEL, delayAfterMs: 1400 },
    { model: FALLBACK_MODEL, delayAfterMs: 0 },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const { model, delayAfterMs } = attempts[i];
    try {
      return await runForModel(model);
    } catch (error) {
      lastError = error;
      const info = extractUpstreamErrorInfo(error);
      const retryable = isRetryableOverload(info);
      const rateLimited = isRateLimitError(info);

      if (!retryable && !rateLimited) {
        throw toFriendlyProviderError(error);
      }

      // If primary model hits rate limit, jump straight to fallback model
      if (rateLimited && model === PRIMARY_MODEL) {
        i = 1; // Next iteration will be index 2 (FALLBACK_MODEL)
      }

      if (i < attempts.length - 1 && delayAfterMs > 0) {
        await new Promise((r) => setTimeout(r, delayAfterMs));
      }
    }
  }

  throw toFriendlyProviderError(lastError);
}

function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseModelJson<T>(raw: string | undefined, fallback: string): T {
  const cleaned = (raw ?? fallback)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned || fallback) as T;
}

function computeIngredientCostFromUserPantry(
  ingName: string,
  gramsEstimate: number,
  pantryItems: PantryItem[],
): { inPantry: boolean; estimatedCostBrl: number; priceSource: 'user' | 'none' } {
  const normIng = normalizeName(ingName);
  const matchedPantry = pantryItems.find((p) => {
    if (p.status !== 'available' || p.quantity <= 0) return false;
    const normP = normalizeName(p.name);
    return normP.includes(normIng) || normIng.includes(normP);
  });

  if (!matchedPantry) {
    return { inPantry: false, estimatedCostBrl: 0, priceSource: 'none' };
  }

  if (matchedPantry.purchasePriceBrl > 0) {
    // Convert pantry purchase unit quantity to approximate grams for proportional cost
    const unitQty = Math.max(1, matchedPantry.priceUnitQty || matchedPantry.quantity || 1);
    let totalGramsBought = unitQty;
    if (matchedPantry.unit === 'kg' || matchedPantry.unit === 'L') {
      totalGramsBought = unitQty * 1000;
    } else if (matchedPantry.unit === 'un') {
      const taco = findTacoFood(matchedPantry.name);
      totalGramsBought = unitQty * (taco?.defaultGramsPerUnit ?? 100);
    } else if (matchedPantry.unit === 'pacote') {
      totalGramsBought = unitQty * 500;
    } else if (matchedPantry.unit === 'colher') {
      totalGramsBought = unitQty * 15;
    } else if (matchedPantry.unit === 'xicara') {
      totalGramsBought = unitQty * 160;
    }

    const ratio = Math.min(1, Math.max(0.02, gramsEstimate / Math.max(1, totalGramsBought)));
    const proportionalCost = Number((matchedPantry.purchasePriceBrl * ratio).toFixed(2));
    return { inPantry: true, estimatedCostBrl: proportionalCost, priceSource: 'user' };
  }

  return { inPantry: true, estimatedCostBrl: 0, priceSource: 'none' };
}

function chooseImageKey(title: string, tags: string[]): RecipeImageKey {
  const combined = normalizeName(`${title} ${tags.join(' ')}`);
  if (combined.includes('omelete') || combined.includes('ovo') || combined.includes('crepioca') || combined.includes('panqueca')) {
    return 'omelete';
  }
  if (combined.includes('vegan') || combined.includes('vegetar') || combined.includes('abobora') || combined.includes('feijao') || combined.includes('salada')) {
    return 'veggie';
  }
  if (combined.includes('frango') || combined.includes('carne') || combined.includes('peixe') || combined.includes('arroz') || combined.includes('bowl')) {
    return 'frango';
  }
  return 'hero';
}

export class GeminiAIProvider implements NutrixAIProvider {
  readonly providerName = 'gemini-4-hydrogen';

  private async getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no servidor.');
    }
    const { GoogleGenAI: GoogleGenAICtor, ThinkingLevel, Type } = await import('@google/genai');
    const ai: GoogleGenAI = new GoogleGenAICtor({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    return { ai, ThinkingLevel, Type };
  }

  async generateRecipes(input: GenerateRecipesInput): Promise<GeneratedRecipePayload[]> {
    const { ai, ThinkingLevel, Type } = await this.getClient();
    const availablePantry = input.pantryItems.filter((i) => i.status === 'available' && i.quantity > 0);
    const todayIso = new Date().toISOString().slice(0, 10);

    const expiringItems = availablePantry
      .filter((i) => i.expiryDate && i.expiryDate <= new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10))
      .map((i) => `${i.name} (vence em ${i.expiryDate})`);

    const pantrySummary = availablePantry
      .map((i) => `${i.name}: ${i.quantity} ${i.unit}${i.expiryDate ? ` (validade: ${i.expiryDate})` : ''}`)
      .join('; ');

    const recipeCount = Math.min(3, Math.max(1, input.count ?? 2));

    const prompt = `
Você é o Chef IA do NUTRIX, uma plataforma brasileira de inteligência alimentar.
Gere exatamente ${recipeCount} receitas práticas, saborosas e adaptadas à culinária brasileira cotidiana.

CONTEXTO DO USUÁRIO:
- Ingredientes disponíveis na despensa: ${pantrySummary || 'Nenhum ingrediente cadastrado (sugira receitas brasileiras práticas com ingredientes acessíveis)'}
- Alimentos próximos do vencimento (priorizar se possível): ${expiringItems.join(', ') || 'Nenhum'}
- Número de porções desejado: ${input.servings}
- Tempo máximo de preparo: ${input.maxPrepTimeMin ? `${input.maxPrepTimeMin} minutos` : 'Flexível'}
- Usar SOMENTE ingredientes disponíveis: ${input.onlyAvailableIngredients ? 'SIM (permita apenas sal, água e temperos básicos se indispensável)' : 'Priorizar os disponíveis, mas pode sugerir poucos complementos claramente listados'}
- Priorizar aproveitamento de vencimento: ${input.prioritizeExpiring ? 'SIM' : 'Normal'}
- Filtros selecionados: ${input.filters.join(', ') || 'Nenhum'}
- Pedido específico do usuário: ${input.customPrompt || 'Sem pedido extra'}
- Objetivo alimentar: ${input.profile.goal || 'Comer de maneira mais equilibrada'}
- Restrições alimentares (RESPEITAR RIGOROSAMENTE): ${(input.profile.restrictions || []).join(', ') || 'Nenhuma'}
- Alergias (NUNCA INCLUIR): ${(input.profile.allergies || []).join(', ') || 'Nenhuma'}
- Alimentos que o usuário não gosta: ${(input.profile.dislikes || []).join(', ') || 'Nenhum'}
- Ingredientes preferidos aprendidos: ${(input.profile.favoriteIngredients || []).join(', ') || 'Ainda em aprendizado'}
- Orçamento semanal informado: ${input.profile.weeklyBudgetBrl ? `R$ ${input.profile.weeklyBudgetBrl}` : 'Não informado'}
- Data atual: ${todayIso}

REGRAS OBRIGATÓRIAS:
1. Escreva tudo em Português do Brasil (PT-BR) natural e claro.
2. Para CADA ingrediente, informe "gramsEstimate" realista em gramas correspondente à quantidade total na receita (usaremos esse peso para o cálculo nutricional determinístico na tabela TACO/TBCA).
3. Não invente preços de supermercado nem promessas médicas.
4. Use unidades brasileiras (g, kg, ml, un, colher de sopa, xícara).
5. Inclua passo a passo objetivo, substituições econômicas reais e sugestões de acompanhamento.
`.trim();

    const response = await callWithFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Você é um especialista em gastronomia brasileira cotidiana e organização alimentar. Retorne estritamente JSON válido seguindo o schema solicitado.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                prepTimeMin: { type: Type.INTEGER },
                difficulty: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                ingredients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      gramsEstimate: { type: Type.NUMBER },
                    },
                    required: ['name', 'quantity', 'unit', 'gramsEstimate'],
                  },
                },
                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                substitutions: { type: Type.ARRAY, items: { type: Type.STRING } },
                sideDishes: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['title', 'description', 'prepTimeMin', 'difficulty', 'tags', 'ingredients', 'steps', 'substitutions', 'sideDishes'],
            },
          },
        },
      }),
    );

    const parsed = parseModelJson<Array<{
      title: string;
      description: string;
      prepTimeMin: number;
      difficulty: string;
      tags: string[];
      ingredients: Array<{ name: string; quantity: number; unit: string; gramsEstimate: number }>;
      steps: string[];
      substitutions: string[];
      sideDishes: string[];
    }>>(response.text, '[]');

    return parsed.slice(0, 3).map((rec) => {
      const servings = Math.max(1, Math.min(24, Number(input.servings) || 2));
      const enrichedIngredients: RecipeIngredient[] = (rec.ingredients || []).slice(0, 30).map((ing) => {
        const grams = Math.max(1, Math.round(Number(ing.gramsEstimate) || 50));
        const costInfo = computeIngredientCostFromUserPantry(ing.name, grams, availablePantry);
        const taco = findTacoFood(ing.name);
        return {
          name: String(ing.name).slice(0, 100),
          quantity: Number(ing.quantity) || 1,
          unit: String(ing.unit || 'g').slice(0, 20),
          gramsEstimate: grams,
          inPantry: costInfo.inPantry,
          estimatedCostBrl: costInfo.estimatedCostBrl,
          priceSource: costInfo.priceSource,
          tacoMatched: Boolean(taco),
        };
      });

      const missingIngredients = enrichedIngredients
        .filter((i) => !i.inPantry)
        .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
        .slice(0, 15);

      const { perServing } = calculateRecipeNutrition(enrichedIngredients, servings);
      const hasUserPrices = enrichedIngredients.some((i) => i.priceSource === 'user');
      const totalCostBrl = Number(
        enrichedIngredients.reduce((acc, item) => acc + item.estimatedCostBrl, 0).toFixed(2),
      );
      const costPerServingBrl = Number((totalCostBrl / servings).toFixed(2));

      const rawDiff = rec.difficulty;
      const difficulty: 'Fácil' | 'Média' | 'Elaborada' =
        rawDiff === 'Média' || rawDiff === 'Elaborada' ? rawDiff : 'Fácil';

      return {
        title: String(rec.title || 'Receita NUTRIX').slice(0, 160),
        description: String(rec.description || '').slice(0, 600),
        imageKey: chooseImageKey(rec.title || '', rec.tags || []),
        prepTimeMin: Math.max(5, Math.min(240, Math.round(Number(rec.prepTimeMin) || 25))),
        difficulty,
        servings,
        tags: (rec.tags || []).map((t) => String(t).slice(0, 40)).slice(0, 10),
        ingredients: enrichedIngredients,
        missingIngredients,
        steps: (rec.steps || []).map((s) => String(s).slice(0, 360)).slice(0, 20),
        substitutions: (rec.substitutions || []).map((s) => String(s).slice(0, 200)).slice(0, 10),
        sideDishes: (rec.sideDishes || []).map((s) => String(s).slice(0, 120)).slice(0, 8),
        nutritionPerServing: perServing,
        totalCostBrl,
        costPerServingBrl,
        hasUserPrices,
        isFavorite: false,
        timesCooked: 0,
        rating: 0,
        lastCookedAt: '',
      };
    });
  }

  async recognizeIngredientsFromPhoto(
    base64Data: string,
    mimeType: string,
  ): Promise<{ items: RecognizedIngredient[]; safetyNote: string }> {
    const { ai, ThinkingLevel, Type } = await this.getClient();

    const response = await callWithFallback((model) =>
      ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Analise esta fotografia de geladeira, bancada, despensa ou alimentos individuais.
Identifique SOMENTE ingredientes realmente visíveis na imagem (em Português do Brasil).
REGRAS DE PRECISÃO:
1. Não invente itens que não estejam claramente visíveis.
2. Classifique a confiança como "alta", "media" ou "baixa".
3. Sempre marque "quantityNeedsConfirmation": true se o peso ou quantidade exata não puder ser medida com segurança pela imagem.
4. Sugira a categoria entre: carnes, frutas, verduras, graos, laticinios, temperos, massas, enlatados, congelados, outros.
5. Sugira a unidade entre: g, kg, ml, L, un, colher, xicara, pacote.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    confidence: { type: Type.STRING },
                    suggestedCategory: { type: Type.STRING },
                    suggestedQuantity: { type: Type.NUMBER },
                    suggestedUnit: { type: Type.STRING },
                    quantityNeedsConfirmation: { type: Type.BOOLEAN },
                    notes: { type: Type.STRING },
                  },
                  required: [
                    'name',
                    'confidence',
                    'suggestedCategory',
                    'suggestedQuantity',
                    'suggestedUnit',
                    'quantityNeedsConfirmation',
                    'notes',
                  ],
                },
              },
              safetyNote: { type: Type.STRING },
            },
            required: ['items', 'safetyNote'],
          },
        },
      }),
    );

    const parsed = parseModelJson<{
      items?: RecognizedIngredient[];
      safetyNote?: string;
    }>(response.text, '{}');

    const validCategories = new Set([
      'carnes',
      'frutas',
      'verduras',
      'graos',
      'laticinios',
      'temperos',
      'massas',
      'enlatados',
      'congelados',
      'outros',
    ]);
    const validUnits = new Set(['g', 'kg', 'ml', 'L', 'un', 'colher', 'xicara', 'pacote']);

    const items: RecognizedIngredient[] = (parsed.items || []).slice(0, 20).map((item) => {
      const confidence =
        item.confidence === 'alta' || item.confidence === 'media' || item.confidence === 'baixa'
          ? item.confidence
          : 'media';
      return {
        name: String(item.name || '').slice(0, 100),
        confidence,
        suggestedCategory: (validCategories.has(item.suggestedCategory) ? item.suggestedCategory : 'outros') as RecognizedIngredient['suggestedCategory'],
        suggestedQuantity: Math.max(1, Number(item.suggestedQuantity) || 1),
        suggestedUnit: (validUnits.has(item.suggestedUnit) ? item.suggestedUnit : 'un') as RecognizedIngredient['suggestedUnit'],
        quantityNeedsConfirmation: Boolean(item.quantityNeedsConfirmation),
        notes: String(item.notes || '').slice(0, 160),
        selected: confidence === 'alta',
      };
    });

    return {
      items,
      safetyNote:
        parsed.safetyNote ||
        'Confira cada item, quantidade e estado de conservação antes de adicionar à sua despensa.',
    };
  }

  async generateWeeklyMealPlan(input: {
    pantryItems: PantryItem[];
    profile: Partial<UserProfile>;
    servings: number;
    weekKey: string;
  }): Promise<{ days: MealPlanDay[]; totalEstimatedCostBrl: number }> {
    const { ai, ThinkingLevel, Type } = await this.getClient();
    const available = input.pantryItems
      .filter((p) => p.status === 'available' && p.quantity > 0)
      .map((p) => `${p.name} (${p.quantity} ${p.unit}${p.expiryDate ? `, vence ${p.expiryDate}` : ''})`)
      .join(', ');

    const slotSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        prepTimeMin: { type: Type.INTEGER },
        ingredientsList: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              gramsEstimate: { type: Type.NUMBER },
            },
            required: ['name', 'gramsEstimate'],
          },
        },
      },
      required: ['title', 'prepTimeMin', 'ingredientsList'],
    };

    const response = await callWithFallback((model) =>
      ai.models.generateContent({
        model,
        contents: `Monte um planejamento alimentar semanal brasileiro completo (Segunda a Domingo) para ${input.servings} pessoa(s).
Despensa atual: ${available || 'Despensa vazia — use alimentos brasileiros acessíveis do dia a dia'}.
Objetivo: ${input.profile.goal || 'Comer de maneira mais equilibrada'}.
Restrições: ${(input.profile.restrictions || []).join(', ') || 'Nenhuma'}.
Alergias (NUNCA incluir): ${(input.profile.allergies || []).join(', ') || 'Nenhuma'}.
Alimentos que não gosta: ${(input.profile.dislikes || []).join(', ') || 'Nenhum'}.
Orçamento semanal: ${input.profile.weeklyBudgetBrl ? `R$ ${input.profile.weeklyBudgetBrl}` : 'Econômico'}.

Priorize aproveitar os alimentos da despensa e reaproveitar bases culinárias ao longo da semana para economizar tempo e dinheiro.
Informe os principais ingredientes com peso estimado em gramas por porção em cada refeição para cálculo TACO/TBCA.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dayKey: { type: Type.STRING },
                dayLabel: { type: Type.STRING },
                breakfast: slotSchema,
                lunch: slotSchema,
                snack: slotSchema,
                dinner: slotSchema,
              },
              required: ['dayKey', 'dayLabel', 'breakfast', 'lunch', 'snack', 'dinner'],
            },
          },
        },
      }),
    );

    const rawDays = parseModelJson<Array<{
      dayKey: string;
      dayLabel: string;
      breakfast: { title: string; prepTimeMin: number; ingredientsList: Array<{ name: string; gramsEstimate: number }> };
      lunch: { title: string; prepTimeMin: number; ingredientsList: Array<{ name: string; gramsEstimate: number }> };
      snack: { title: string; prepTimeMin: number; ingredientsList: Array<{ name: string; gramsEstimate: number }> };
      dinner: { title: string; prepTimeMin: number; ingredientsList: Array<{ name: string; gramsEstimate: number }> };
    }>>(response.text, '[]');

    const availablePantry = input.pantryItems.filter((i) => i.status === 'available');
    let totalCost = 0;

    const enrichSlot = (slot: {
      title: string;
      prepTimeMin: number;
      ingredientsList: Array<{ name: string; gramsEstimate: number }>;
    }) => {
      const ings: RecipeIngredient[] = (slot.ingredientsList || []).map((i) => {
        const grams = Math.max(10, Number(i.gramsEstimate) || 80);
        const cost = computeIngredientCostFromUserPantry(i.name, grams * input.servings, availablePantry);
        return {
          name: i.name,
          quantity: grams,
          unit: 'g',
          gramsEstimate: grams,
          inPantry: cost.inPantry,
          estimatedCostBrl: cost.estimatedCostBrl,
          priceSource: cost.priceSource,
          tacoMatched: Boolean(findTacoFood(i.name)),
        };
      });
      const { perServing } = calculateRecipeNutrition(ings, 1);
      const slotCost = Number(ings.reduce((acc, x) => acc + x.estimatedCostBrl, 0).toFixed(2));
      totalCost += slotCost;
      return {
        title: String(slot.title || 'Refeição equilibrada').slice(0, 120),
        recipeId: '',
        calories: perServing.calories,
        proteinG: perServing.proteinG,
        carbsG: perServing.carbsG,
        fatG: perServing.fatG,
        estimatedCostBrl: slotCost,
        prepTimeMin: Math.max(5, Math.min(120, Math.round(Number(slot.prepTimeMin) || 20))),
        ingredientsList: ings.map((i) => i.name).slice(0, 8),
      };
    };

    const days: MealPlanDay[] = rawDays.slice(0, 7).map((d, idx) => ({
      dayKey: d.dayKey || `day_${idx + 1}`,
      dayLabel: d.dayLabel || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][idx],
      breakfast: enrichSlot(d.breakfast),
      lunch: enrichSlot(d.lunch),
      snack: enrichSlot(d.snack),
      dinner: enrichSlot(d.dinner),
    }));

    return { days, totalEstimatedCostBrl: Number(totalCost.toFixed(2)) };
  }

  async analyzeEconomy(input: {
    pantryItems: PantryItem[];
    profile: Partial<UserProfile>;
    spentThisWeekBrl: number;
  }): Promise<EconomyTipResult> {
    const { ai, ThinkingLevel, Type } = await this.getClient();
    const itemsList = input.pantryItems
      .filter((p) => p.status === 'available')
      .map((p) => `${p.name} (${p.quantity} ${p.unit}, preço pago: ${p.purchasePriceBrl > 0 ? `R$ ${p.purchasePriceBrl}` : 'não informado'}, validade: ${p.expiryDate || 'não informada'})`)
      .join('; ');

    const response = await callWithFallback((model) =>
      ai.models.generateContent({
        model,
        contents: `Analise a despensa e o orçamento alimentar brasileiro deste usuário e forneça recomendações práticas de economia e aproveitamento sem desperdício.
Despensa: ${itemsList || 'Sem itens cadastrados'}.
Orçamento semanal: R$ ${input.profile.weeklyBudgetBrl || 0}.
Gasto registrado na semana: R$ ${input.spentThisWeekBrl.toFixed(2)}.
Objetivo: ${input.profile.goal || 'Economizar na alimentação'}.

REGRAS:
- Não invente preços específicos de supermercados.
- Sugira substituições econômicas brasileiras realistas (ex.: proteína de maior rendimento, cortes sazonais, leguminosas, aproveitamento integral de talos/cascas).
- Inclua orientações práticas de segurança alimentar e armazenamento.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              substitutions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['original', 'suggestion', 'reason'],
                },
              },
              zeroWasteActions: { type: Type.ARRAY, items: { type: Type.STRING } },
              budgetAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['summary', 'substitutions', 'zeroWasteActions', 'budgetAdvice'],
          },
        },
      }),
    );

    return parseModelJson<EconomyTipResult>(response.text, '{}');
  }
}

export const nutrixAI: NutrixAIProvider = new GeminiAIProvider();
