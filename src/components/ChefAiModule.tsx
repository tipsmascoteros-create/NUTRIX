import { useMemo, useState } from 'react';
import {
  Check,
  ChefHat,
  Clock,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { apiFetch } from '../lib/apiClient.ts';
import { formatBrl, getCurrentIsoWeekKey, getTodayIso } from '../lib/formatters.ts';
import {
  addNutritionLog,
  addShoppingItem,
  deleteSavedRecipe,
  incrementWeeklyRecipeCounter,
  logAnalyticsEvent,
  saveGeneratedRecipe,
  updateRecipeFeedback,
  updateUserProfileFields,
} from '../lib/nutrixService.ts';
import { FoodImage } from './FoodImage.tsx';
import type {
  AppConfig,
  MealType,
  PantryItem,
  SavedRecipe,
  UserProfile,
} from '../types/nutrix.ts';

interface ChefAiModuleProps {
  profile: UserProfile;
  config: AppConfig;
  pantry: PantryItem[];
  recipes: SavedRecipe[];
  initialPrioritizeExpiring?: boolean;
  onOpenUpgrade: (reason: string) => void;
}

const RECIPE_FILTERS = [
  'Até 15 minutos',
  'Até 30 minutos',
  'Econômicas',
  'Ricas em proteínas',
  'Baixas em calorias',
  'Equilibradas',
  'Vegetarianas',
  'Sem lactose',
  'Sem glúten',
  'Poucos ingredientes',
  'Aproveitamento de sobras',
];

const QUICK_PROMPTS = [
  {
    label: 'Usar só o que tenho',
    prompt: 'Crie uma receita prática usando somente os ingredientes disponíveis na minha despensa.',
    onlyAvailable: true,
    expiring: false,
  },
  {
    label: 'Bastante proteína',
    prompt: 'Quero uma refeição brasileira rica em proteínas para ajudar na saciedade.',
    onlyAvailable: false,
    expiring: false,
  },
  {
    label: 'Algo econômico',
    prompt: 'Preciso preparar uma refeição saborosa e econômica que renda bem.',
    onlyAvailable: false,
    expiring: false,
  },
  {
    label: 'Aproveitar vencendo',
    prompt: 'Quero aproveitar prioritariamente os alimentos que estão mais próximos de vencer.',
    onlyAvailable: false,
    expiring: true,
  },
  {
    label: 'Só tenho 15 min',
    prompt: 'Tenho apenas 15 minutos para cozinhar algo saudável e rápido.',
    onlyAvailable: false,
    expiring: false,
  },
];

const MACRO_COLORS = ['#173D32', '#649F5E', '#C3F28B'];

export function ChefAiModule({
  profile,
  config,
  pantry,
  recipes,
  initialPrioritizeExpiring = false,
  onOpenUpgrade,
}: ChefAiModuleProps) {
  const isPremium = profile.plan === 'premium';
  const currentWeek = getCurrentIsoWeekKey();
  const weeklyUsed =
    profile.weeklyRecipesResetAt === currentWeek ? profile.weeklyRecipesCount : 0;
  const remainingFree = Math.max(0, config.freeWeeklyRecipes - weeklyUsed);

  const [customPrompt, setCustomPrompt] = useState(
    initialPrioritizeExpiring
      ? 'Quero aproveitar prioritariamente os alimentos que estão perto de vencer.'
      : '',
  );
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    initialPrioritizeExpiring ? ['Aproveitamento de sobras'] : [],
  );
  const [servings, setServings] = useState(2);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [prioritizeExpiring, setPrioritizeExpiring] = useState(initialPrioritizeExpiring);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(recipes[0]?.id || null);
  const [viewServings, setViewServings] = useState<number | null>(null);
  const [logMealType, setLogMealType] = useState<MealType>('almoco');

  const visibleRecipes = useMemo(
    () => (isPremium ? recipes : recipes.slice(0, config.freeHistoryLimit)),
    [recipes, isPremium, config.freeHistoryLimit],
  );

  const selectedRecipe = useMemo(() => {
    return visibleRecipes.find((r) => r.id === activeRecipeId) || visibleRecipes[0] || null;
  }, [visibleRecipes, activeRecipeId]);

  const displayServings = viewServings ?? selectedRecipe?.servings ?? 2;
  const scaleFactor = selectedRecipe ? displayServings / Math.max(1, selectedRecipe.servings) : 1;

  const toggleFilter = (filter: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setToast('');

    if (!isPremium && weeklyUsed >= config.freeWeeklyRecipes) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'free_limit_reached',
        plan: profile.plan,
        metadata: 'chef_weekly_recipes_limit',
        analyticsConsent: profile.analyticsConsent,
      });
      onOpenUpgrade(
        `Você já utilizou ${weeklyUsed} das suas ${config.freeWeeklyRecipes} receitas do plano Básico desta semana. Evolua para o NUTRIX Premium para gerar receitas sem limites no dia a dia.`,
      );
      return;
    }

    setGenerating(true);
    try {
      const maxPrepTimeMin = selectedFilters.includes('Até 15 minutos')
        ? 15
        : selectedFilters.includes('Até 30 minutos')
          ? 30
          : undefined;

      const res = await apiFetch<{
        recipes: Array<Omit<SavedRecipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;
      }>('/api/ai/recipes', {
        method: 'POST',
        body: JSON.stringify({
          pantryItems: pantry.filter((p) => p.status === 'available'),
          profile,
          customPrompt,
          filters: selectedFilters,
          servings,
          maxPrepTimeMin,
          onlyAvailableIngredients: onlyAvailable,
          prioritizeExpiring,
          count: isPremium ? 2 : 1,
        }),
      });

      let firstNewId: string | null = null;
      for (const rec of res.recipes) {
        const id = await saveGeneratedRecipe(profile.uid, rec);
        if (!firstNewId) firstNewId = id;
      }

      await incrementWeeklyRecipeCounter(profile);

      if (recipes.length === 0) {
        void logAnalyticsEvent({
          userId: profile.uid,
          eventName: 'first_recipe_generated',
          plan: profile.plan,
          metadata: res.recipes[0]?.title || '',
          analyticsConsent: profile.analyticsConsent,
        });
      }

      if (firstNewId) {
        setActiveRecipeId(firstNewId);
        setViewServings(null);
      }
      setToast(`${res.recipes.length} nova(s) receita(s) criada(s) com cálculo nutricional completo!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar receitas.';
      setError(msg);
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'ai_error',
        plan: profile.plan,
        metadata: `recipes:${msg.slice(0, 200)}`,
        analyticsConsent: profile.analyticsConsent,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkCooked = async (recipe: SavedRecipe) => {
    const nut = recipe.nutritionPerServing;
    await updateRecipeFeedback(profile.uid, recipe.id, {
      timesCooked: recipe.timesCooked + 1,
      lastCookedAt: new Date().toISOString().slice(0, 30),
    });

    await addNutritionLog(profile.uid, {
      date: getTodayIso(),
      mealType: logMealType,
      title: recipe.title,
      recipeId: recipe.id,
      servings: 1,
      calories: nut.calories,
      proteinG: nut.proteinG,
      carbsG: nut.carbsG,
      fatG: nut.fatG,
      fiberG: nut.fiberG,
      sodiumMg: nut.sodiumMg,
      costBrl: recipe.costPerServingBrl,
    });

    // Adaptive learning: remember top 2 primary ingredients from cooked recipes
    const learned = recipe.ingredients
      .slice(0, 2)
      .map((i) => i.name.split(' (')[0])
      .filter((n) => !profile.favoriteIngredients.includes(n));
    if (learned.length > 0) {
      await updateUserProfileFields(profile.uid, {
        favoriteIngredients: [...profile.favoriteIngredients, ...learned].slice(0, 20),
      });
    }

    setToast(`"${recipe.title}" registrada no seu histórico nutricional de hoje!`);
  };

  const handleAddMissingToShopping = async (recipe: SavedRecipe) => {
    const missing = recipe.ingredients.filter((i) => !i.inPantry);
    if (missing.length === 0) {
      setToast('Você já tem todos os ingredientes desta receita na despensa!');
      return;
    }
    for (const ing of missing) {
      await addShoppingItem(profile.uid, {
        name: ing.name,
        category: 'outros',
        quantity: Number((ing.quantity * scaleFactor).toFixed(1)),
        unit: ing.unit,
        estimatedPriceBrl: 0,
        priceSource: 'none',
        checked: false,
        source: 'recipe',
      });
    }
    setToast(`${missing.length} ingrediente(s) faltante(s) enviado(s) para sua Lista de Compras.`);
  };

  const macroChartData = useMemo(() => {
    if (!selectedRecipe) return [];
    const n = selectedRecipe.nutritionPerServing;
    return [
      { name: 'Proteínas', value: Math.round(n.proteinG * 4) },
      { name: 'Carboidratos', value: Math.round(n.carbsG * 4) },
      { name: 'Gorduras', value: Math.round(n.fatG * 9) },
    ].filter((d) => d.value > 0);
  }, [selectedRecipe]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#52635B]">
            Módulos 3, 4 e 10 · Chef + Nutrição Detalhada + Memória Adaptativa
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Chef NUTRIX — Gerador Inteligente de Receitas
          </h1>
          <p className="text-sm text-[#455750] mt-1">
            {isPremium
              ? 'Geração ampliada ativa · Respeitando suas alergias, despensa e preferências.'
              : `Você já utilizou ${weeklyUsed} das suas ${config.freeWeeklyRecipes} receitas desta semana no plano Básico (${remainingFree} restante(s)).`}
          </p>
        </div>
      </div>

      {/* Generator Controls */}
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-5"
      >
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setCustomPrompt(q.prompt);
                setOnlyAvailable(q.onlyAvailable);
                setPrioritizeExpiring(q.expiring);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#F5F7F5] border border-[#DCE4DF] text-xs font-medium text-[#173D32] hover:border-[#173D32] transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <label className="block text-xs font-medium text-[#32433C] mb-1.5">
              O que você gostaria de preparar agora? (O Chef já lê sua despensa automaticamente)
            </label>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ex: Tenho frango, arroz, ovos, tomate e cenoura. Quero um almoço prático..."
              className="w-full px-4 py-3 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[#32433C] mb-1.5">Porções</label>
            <select
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full px-3.5 py-3 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'pessoa' : 'pessoas'}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={generating}
              className="w-full py-3 px-4 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap"
            >
              <ChefHat className="w-4 h-4 text-[#C3F28B]" />
              <span>{generating ? 'Criando...' : 'Gerar receitas'}</span>
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {RECIPE_FILTERS.map((f) => {
              const active = selectedFilters.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#173D32] text-white border-[#173D32]'
                      : 'bg-white text-[#455750] border-[#DCE4DF] hover:bg-[#F5F7F5]'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-[#32433C]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="rounded accent-[#173D32]"
              />
              <span>Usar somente ingredientes da minha despensa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prioritizeExpiring}
                onChange={(e) => setPrioritizeExpiring(e.target.checked)}
                className="rounded accent-[#173D32]"
              />
              <span>Priorizar alimentos próximos do vencimento</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
        {toast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
            {toast}
          </div>
        )}
      </form>

      {/* Recipes Split View */}
      {visibleRecipes.length === 0 ? (
        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-10 text-center space-y-2">
          <p className="font-display text-lg font-semibold text-[#111B17]">
            Nenhuma receita gerada ainda
          </p>
          <p className="text-sm text-[#52635B] max-w-md mx-auto">
            Clique em &ldquo;Gerar receitas&rdquo; acima para receber sugestões personalizadas com
            calorias, macronutrientes e modo de preparo passo a passo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left History List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#52635B] px-1">
              <span>
                Histórico ({visibleRecipes.length}
                {!isPremium ? `/${config.freeHistoryLimit} Básico` : ''})
              </span>
              {!isPremium && recipes.length > config.freeHistoryLimit && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenUpgrade(
                      `No plano Básico você visualiza as últimas ${config.freeHistoryLimit} receitas. Evolua para o Premium para acessar todo o seu histórico ilimitado.`,
                    )
                  }
                  className="text-[#173D32] font-semibold hover:underline"
                >
                  Ver histórico completo
                </button>
              )}
            </div>

            {visibleRecipes.map((rec) => {
              const isSelected = selectedRecipe?.id === rec.id;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    setActiveRecipeId(rec.id);
                    setViewServings(null);
                  }}
                  className={`w-full text-left rounded-2xl border p-3.5 transition-colors flex gap-3.5 items-center ${
                    isSelected
                      ? 'bg-[#173D32] text-white border-[#173D32]'
                      : 'bg-white text-[#111B17] border-[#DCE4DF] hover:border-[#173D32]'
                  }`}
                >
                  <FoodImage
                    imageKey={rec.imageKey}
                    alt={rec.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-sm truncate">{rec.title}</p>
                    <p
                      className={`text-xs font-mono tabular-nums mt-1 ${
                        isSelected ? 'text-[#C3F28B]' : 'text-[#52635B]'
                      }`}
                    >
                      {rec.nutritionPerServing.calories} kcal · {rec.nutritionPerServing.proteinG}g P ·{' '}
                      {rec.prepTimeMin} min
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        isSelected ? 'text-white/75' : 'text-[#52635B]'
                      }`}
                    >
                      {rec.difficulty} · {rec.isFavorite ? 'Favorita · ' : ''}
                      Preparada {rec.timesCooked}x
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detailed Recipe Card */}
          {selectedRecipe && (
            <div className="lg:col-span-8 bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden">
              <div className="relative h-56 sm:h-64">
                <FoodImage
                  imageKey={selectedRecipe.imageKey}
                  alt={selectedRecipe.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F2B23]/85 via-[#0F2B23]/25 to-transparent" />
                <div className="absolute bottom-5 left-6 right-6 text-white">
                  <p className="text-xs text-[#C3F28B] font-medium">
                    {selectedRecipe.difficulty} · {selectedRecipe.prepTimeMin} min ·{' '}
                    {selectedRecipe.tags.slice(0, 3).join(' · ')}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1">
                    {selectedRecipe.title}
                  </h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-sm text-[#455750] leading-relaxed">
                  {selectedRecipe.description}
                </p>

                {/* Action Bar: Portion Scaler, Favorite, Rating, Delete */}
                <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-[#E5ECE8]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[#52635B]">Porções:</span>
                    <button
                      type="button"
                      aria-label="Menos porções"
                      onClick={() => setViewServings(Math.max(1, displayServings - 1))}
                      className="w-8 h-8 rounded-lg border border-[#DCE4DF] flex items-center justify-center hover:bg-[#F5F7F5]"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-sm font-bold tabular-nums w-6 text-center">
                      {displayServings}
                    </span>
                    <button
                      type="button"
                      aria-label="Mais porções"
                      onClick={() => setViewServings(Math.min(16, displayServings + 1))}
                      className="w-8 h-8 rounded-lg border border-[#DCE4DF] flex items-center justify-center hover:bg-[#F5F7F5]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 mr-2" aria-label="Avaliar receita">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            updateRecipeFeedback(profile.uid, selectedRecipe.id, { rating: star })
                          }
                          className="p-1"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              star <= selectedRecipe.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-[#CBD5CF]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateRecipeFeedback(profile.uid, selectedRecipe.id, {
                          isFavorite: !selectedRecipe.isFavorite,
                        })
                      }
                      className={`px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 ${
                        selectedRecipe.isFavorite
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'border-[#DCE4DF] text-[#32433C] hover:bg-[#F5F7F5]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${selectedRecipe.isFavorite ? 'fill-red-600' : ''}`}
                      />
                      <span>{selectedRecipe.isFavorite ? 'Favorita' : 'Favoritar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteSavedRecipe(profile.uid, selectedRecipe.id)}
                      aria-label="Excluir receita"
                      className="p-2 rounded-xl border border-[#DCE4DF] text-[#52635B] hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Log Cooked + Shopping CTA */}
                <div className="bg-[#F5F7F5] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <select
                      value={logMealType}
                      onChange={(e) => setLogMealType(e.target.value as MealType)}
                      className="px-3 py-2 text-xs rounded-lg border border-[#DCE4DF] bg-white"
                    >
                      <option value="cafe">Café da manhã</option>
                      <option value="almoco">Almoço</option>
                      <option value="lanche">Lanche</option>
                      <option value="jantar">Jantar</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMarkCooked(selectedRecipe)}
                      className="px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Utensils className="w-3.5 h-3.5 text-[#C3F28B]" />
                      <span>Preparei esta receita</span>
                    </button>
                  </div>

                  {selectedRecipe.missingIngredients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddMissingToShopping(selectedRecipe)}
                      className="px-3.5 py-2 rounded-xl border border-[#173D32] bg-white text-[#173D32] text-xs font-semibold hover:bg-[#F5F7F5] inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>
                        Enviar {selectedRecipe.missingIngredients.length} faltante(s) para compras
                      </span>
                    </button>
                  )}
                </div>

                {/* Module 4 — Nutrition & Cost Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 h-44">
                    {macroChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macroChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={44}
                            outerRadius={68}
                            paddingAngle={3}
                          >
                            {macroChartData.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={MACRO_COLORS[index % MACRO_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => `${v ?? 0} kcal`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#52635B]">
                        Sem macros suficientes para gráfico
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-7 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[11px] text-[#52635B]">Kcal / porção</p>
                        <p className="font-mono text-lg font-bold text-[#173D32] tabular-nums">
                          {selectedRecipe.nutritionPerServing.calories}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#52635B]">Proteínas</p>
                        <p className="font-mono text-lg font-bold text-[#111B17] tabular-nums">
                          {selectedRecipe.nutritionPerServing.proteinG}g
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#52635B]">Carboidratos</p>
                        <p className="font-mono text-lg font-bold text-[#111B17] tabular-nums">
                          {selectedRecipe.nutritionPerServing.carbsG}g
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#52635B]">Gorduras</p>
                        <p className="font-mono text-lg font-bold text-[#111B17] tabular-nums">
                          {selectedRecipe.nutritionPerServing.fatG}g
                        </p>
                      </div>
                    </div>

                    {isPremium ? (
                      <div className="pt-2 border-t border-[#E5ECE8] text-xs text-[#32433C] space-y-1.5 font-mono tabular-nums">
                        <p>
                          Fibras: {selectedRecipe.nutritionPerServing.fiberG}g · Gord. saturada:{' '}
                          {selectedRecipe.nutritionPerServing.saturatedFatG ?? '—'}g · Açúcares:{' '}
                          {selectedRecipe.nutritionPerServing.sugarG ?? '—'}g
                        </p>
                        <p>
                          Sódio: {selectedRecipe.nutritionPerServing.sodiumMg}mg · Cálcio:{' '}
                          {selectedRecipe.nutritionPerServing.calciumMg ?? '—'}mg · Ferro:{' '}
                          {selectedRecipe.nutritionPerServing.ironMg ?? '—'}mg · Vit. C:{' '}
                          {selectedRecipe.nutritionPerServing.vitaminCMg ?? '—'}mg · Potássio:{' '}
                          {selectedRecipe.nutritionPerServing.potassiumMg ?? '—'}mg
                        </p>
                        <p className="font-sans text-[#173D32] font-semibold">
                          Custo estimado:{' '}
                          {selectedRecipe.hasUserPrices
                            ? `${formatBrl(selectedRecipe.costPerServingBrl)}/porção (${formatBrl(selectedRecipe.totalCostBrl * scaleFactor)} total)`
                            : 'Informe o preço pago na despensa para calcular o custo real.'}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[#E5ECE8] space-y-2 text-xs">
                        <p className="font-mono tabular-nums text-[#32433C]">
                          Fibras: {selectedRecipe.nutritionPerServing.fiberG}g por porção
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[#52635B]">
                            Micronutrientes detalhados e custo por porção disponíveis no Premium.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenUpgrade(
                                'Veja micronutrientes completos (sódio, ferro, cálcio, potássio, vitamina C) e o custo real por porção em todas as receitas no NUTRIX Premium.',
                              )
                            }
                            className="font-semibold text-[#173D32] hover:underline whitespace-nowrap"
                          >
                            Desbloquear
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-[#52635B]">
                      Fonte: {selectedRecipe.nutritionPerServing.sourceLabel}. Total da receita (
                      {displayServings} porções):{' '}
                      <span className="font-mono tabular-nums">
                        {Math.round(selectedRecipe.nutritionPerServing.calories * displayServings)} kcal
                      </span>
                      .
                    </p>
                  </div>
                </div>

                {/* Ingredients & Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E5ECE8]">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#111B17] mb-3">
                      Ingredientes ({displayServings} porções)
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {selectedRecipe.ingredients.map((ing, i) => (
                        <li
                          key={`${ing.name}_${i}`}
                          className="flex items-start justify-between gap-2 text-[#24342D]"
                        >
                          <span className="flex items-start gap-2">
                            <Check
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                ing.inPantry ? 'text-[#173D32]' : 'text-amber-600'
                              }`}
                            />
                            <span>
                              {ing.name}{' '}
                              <span className="text-xs text-[#52635B]">
                                ({ing.inPantry ? 'na despensa' : 'faltante'})
                              </span>
                            </span>
                          </span>
                          <span className="font-mono text-xs tabular-nums text-[#52635B] shrink-0">
                            {Number((ing.quantity * scaleFactor).toFixed(1))} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-display text-base font-semibold text-[#111B17] mb-3">
                      Modo de preparo
                    </h3>
                    <ol className="space-y-2.5 text-sm text-[#24342D]">
                      {selectedRecipe.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="font-mono text-xs font-semibold text-[#173D32] mt-0.5 tabular-nums">
                            {String(i + 1).padStart(2, '0')}.
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Substitutions & Side Dishes */}
                {(selectedRecipe.substitutions.length > 0 ||
                  selectedRecipe.sideDishes.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E5ECE8] text-xs text-[#32433C]">
                    <div className="p-4 rounded-xl bg-[#F5F7F5]">
                      <p className="font-semibold text-[#111B17] mb-1.5">
                        Possíveis substituições econômicas
                      </p>
                      <ul className="space-y-1">
                        {selectedRecipe.substitutions.map((s, idx) => (
                          <li key={idx}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-[#F5F7F5]">
                      <p className="font-semibold text-[#111B17] mb-1.5">
                        Sugestões de acompanhamento
                      </p>
                      <ul className="space-y-1">
                        {selectedRecipe.sideDishes.map((s, idx) => (
                          <li key={idx}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-[#52635B] pt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Valores nutricionais são referência informativa e não substituem orientação de
                    nutricionista.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
