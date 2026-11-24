import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChefHat,
  Package,
  ShoppingCart,
  TrendingDown,
  Utensils,
} from 'lucide-react';
import { formatBrl, getCurrentIsoWeekKey, getExpiryStatus, getTodayIso } from '../lib/formatters.ts';
import type {
  AppConfig,
  EconomyEntry,
  NutritionLog,
  PantryItem,
  SavedRecipe,
  ShoppingItem,
  UserProfile,
  WeeklyMealPlan,
} from '../types/nutrix.ts';

export type WorkspaceTab =
  | 'dashboard'
  | 'pantry'
  | 'chef'
  | 'planner'
  | 'nutrition_economy'
  | 'account'
  | 'admin';

interface DashboardHomeProps {
  profile: UserProfile;
  config: AppConfig;
  pantry: PantryItem[];
  recipes: SavedRecipe[];
  mealPlan: WeeklyMealPlan | null;
  shoppingList: ShoppingItem[];
  nutritionLogs: NutritionLog[];
  economyEntries: EconomyEntry[];
  onNavigate: (tab: WorkspaceTab) => void;
  onOpenUpgrade: (reason: string) => void;
  onQuickCookExpiring: () => void;
}

export function DashboardHome({
  profile,
  config,
  pantry,
  recipes,
  mealPlan,
  shoppingList,
  nutritionLogs,
  economyEntries,
  onNavigate,
  onOpenUpgrade,
  onQuickCookExpiring,
}: DashboardHomeProps) {
  const isPremium = profile.plan === 'premium';
  const todayIso = getTodayIso();
  const currentWeek = getCurrentIsoWeekKey();
  const weeklyUsed =
    profile.weeklyRecipesResetAt === currentWeek ? profile.weeklyRecipesCount : 0;

  const availablePantry = useMemo(
    () => pantry.filter((i) => i.status === 'available' && i.quantity > 0),
    [pantry],
  );

  const expiringItems = useMemo(() => {
    return availablePantry
      .map((item) => ({ item, expiry: getExpiryStatus(item.expiryDate) }))
      .filter((x) => x.expiry.state === 'expiring_soon' || x.expiry.state === 'expired')
      .sort((a, b) => (a.expiry.daysLeft ?? 99) - (b.expiry.daysLeft ?? 99));
  }, [availablePantry]);

  const lowStockItems = useMemo(
    () => availablePantry.filter((i) => i.minThreshold > 0 && i.quantity <= i.minThreshold),
    [availablePantry],
  );

  const todayNutrition = useMemo(() => {
    const todays = nutritionLogs.filter((l) => l.date === todayIso);
    return {
      count: todays.length,
      calories: todays.reduce((s, l) => s + l.calories, 0),
      proteinG: Number(todays.reduce((s, l) => s + l.proteinG, 0).toFixed(1)),
      carbsG: Number(todays.reduce((s, l) => s + l.carbsG, 0).toFixed(1)),
      fatG: Number(todays.reduce((s, l) => s + l.fatG, 0).toFixed(1)),
    };
  }, [nutritionLogs, todayIso]);

  const economySummary = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const weeklyPurchases = economyEntries
      .filter((e) => e.type === 'purchase' && e.date >= sevenDaysAgo)
      .reduce((s, e) => s + e.amountBrl, 0);
    const savedWaste = economyEntries
      .filter((e) => e.type === 'saved_waste')
      .reduce((s, e) => s + e.amountBrl, 0);
    return { weeklyPurchases, savedWaste };
  }, [economyEntries]);

  // Adaptive Memory insight derived from real saved recipes & preferences
  const adaptiveInsight = useMemo(() => {
    if (recipes.length === 0) return null;
    const avgPrep = Math.round(
      recipes.reduce((s, r) => s + r.prepTimeMin, 0) / recipes.length,
    );
    const topFavs = profile.favoriteIngredients.slice(0, 2);
    if (topFavs.length > 0) {
      return `Percebemos que você prefere receitas com ${topFavs.join(' e ')} e tempo médio de ${avgPrep} minutos.`;
    }
    return `Seu tempo médio de preparo registrado é de ${avgPrep} minutos em ${recipes.length} receita(s).`;
  }, [recipes, profile.favoriteIngredients]);

  const todayPlanDay = useMemo(() => {
    if (!mealPlan || mealPlan.days.length === 0) return null;
    // JS getDay(): 0 Sun, 1 Mon ... 6 Sat -> map to 0=Mon..6=Sun
    const jsDay = new Date().getDay();
    const index = jsDay === 0 ? 6 : jsDay - 1;
    return mealPlan.days[index] || mealPlan.days[0];
  }, [mealPlan]);

  const pendingShopping = shoppingList.filter((s) => !s.checked);
  const weeklyBudget = profile.weeklyBudgetBrl || 0;
  const remainingBudget = Math.max(0, weeklyBudget - economySummary.weeklyPurchases);
  const budgetPct =
    weeklyBudget > 0 ? Math.min(100, Math.round((economySummary.weeklyPurchases / weeklyBudget) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header Greeting & Quick Launch */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#52635B]">
            Painel inicial · {isPremium ? 'NUTRIX Premium' : 'NUTRIX Básico'} · Objetivo: {profile.goal}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Olá, {profile.displayName.split(' ')[0]}
          </h1>
          {adaptiveInsight && (
            <p className="text-sm text-[#455750] mt-1">{adaptiveInsight}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('pantry')}
            className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] bg-white text-[#173D32] text-sm font-medium hover:bg-[#F5F7F5] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Package className="w-4 h-4" />
            <span>Adicionar ingrediente</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('chef')}
            className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <ChefHat className="w-4 h-4 text-[#C3F28B]" />
            <span>Abrir Chef</span>
          </button>
        </div>
      </div>

      {/* Basic Plan Usage & Value Conversion Strip */}
      {!isPremium && (
        <div className="bg-[#173D32] text-white rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-[#C3F28B]">
              Resumo do seu NUTRIX Básico (R$&nbsp;19,00/mês)
            </p>
            <p className="text-sm sm:text-base font-medium">
              Você já utilizou{' '}
              <span className="font-mono font-bold text-[#C3F28B] tabular-nums">
                {weeklyUsed} de {config.freeWeeklyRecipes}
              </span>{' '}
              receitas desta semana e cadastrou{' '}
              <span className="font-mono font-bold text-[#C3F28B] tabular-nums">
                {availablePantry.length} de {config.freeMaxIngredients}
              </span>{' '}
              ingredientes ativos.
            </p>
            <p className="text-xs text-white/80">
              Por apenas R$ 18,00 a mais no Premium (R$ {config.premiumPriceBrl},00/mês), você
              desbloqueia reconhecimento por foto, despensa ilimitada, alertas de vencimento,
              planejador semanal e calculadora de custos.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenUpgrade(
                'Desbloqueie todos os recursos do NUTRIX: despensa ilimitada, reconhecimento por fotografia, planejamento semanal automático e análise econômica completa.',
              )
            }
            className="px-5 py-3 rounded-xl bg-[#C3F28B] text-[#173D32] font-bold text-sm hover:bg-[#B1E872] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>Desbloquear todos os recursos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Zero-Waste / Expiring Alert */}
      {expiringItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Você tem {expiringItems.length} alimento(s) que precisam de atenção:{' '}
                {expiringItems
                  .slice(0, 3)
                  .map((e) => `${e.item.name} (${e.expiry.label})`)
                  .join(', ')}
                .
              </p>
              <p className="text-xs text-amber-900/80 mt-1">
                Sempre verifique cor, cheiro e textura antes de consumir, mesmo dentro da data de
                validade.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onQuickCookExpiring}
            className="px-4 py-2.5 rounded-xl bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950 transition-colors whitespace-nowrap shrink-0"
          >
            Aproveitar em receitas agora
          </button>
        </div>
      )}

      {/* 4-Column KPI Row (Connected strictly to real Firestore data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52635B]">
            <span>Despensa ativa</span>
            <Package className="w-4 h-4 text-[#173D32]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-2">
            {availablePantry.length}
            {!isPremium && (
              <span className="text-sm font-normal text-[#52635B]">
                /{config.freeMaxIngredients}
              </span>
            )}
          </p>
          <p className="text-xs text-[#52635B] mt-1">
            {lowStockItems.length > 0
              ? `${lowStockItems.length} item(ns) com estoque baixo`
              : expiringItems.length > 0
                ? `${expiringItems.length} próximo(s) do vencimento`
                : 'Estoque organizado'}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52635B]">
            <span>Nutrição de hoje</span>
            <Utensils className="w-4 h-4 text-[#173D32]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-2">
            {todayNutrition.calories} <span className="text-sm font-normal">kcal</span>
          </p>
          <p className="text-xs font-mono tabular-nums text-[#52635B] mt-1">
            P {todayNutrition.proteinG}g · C {todayNutrition.carbsG}g · G {todayNutrition.fatG}g
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52635B]">
            <span>Orçamento semanal</span>
            <TrendingDown className="w-4 h-4 text-[#173D32]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-2">
            {weeklyBudget > 0 ? formatBrl(remainingBudget) : 'Não definido'}
          </p>
          <div className="mt-2">
            <div className="h-1.5 w-full bg-[#E5ECE8] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${budgetPct > 90 ? 'bg-red-600' : 'bg-[#173D32]'}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="text-xs text-[#52635B] mt-1 tabular-nums">
              Gasto 7d: {formatBrl(economySummary.weeklyPurchases)} de {formatBrl(weeklyBudget)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52635B]">
            <span>Desperdício evitado</span>
            <ShoppingCart className="w-4 h-4 text-[#173D32]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#173D32] tabular-nums mt-2">
            {formatBrl(economySummary.savedWaste)}
          </p>
          <p className="text-xs text-[#52635B] mt-1">
            Lista de compras: {pendingShopping.length} pendente(s)
          </p>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Planned Meals */}
        <div className="lg:col-span-7 bg-white border border-[#DCE4DF] rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#111B17]">
                Refeições planejadas para hoje
              </h2>
              <p className="text-xs text-[#52635B]">
                {todayPlanDay ? `${todayPlanDay.dayLabel} · Semana ${mealPlan?.weekKey}` : 'Planejador semanal'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="text-xs font-semibold text-[#173D32] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Abrir planejador</span>
            </button>
          </div>

          {todayPlanDay ? (
            <div className="divide-y divide-[#E5ECE8]">
              {(
                [
                  ['Café da manhã', todayPlanDay.breakfast],
                  ['Almoço', todayPlanDay.lunch],
                  ['Lanche', todayPlanDay.snack],
                  ['Jantar', todayPlanDay.dinner],
                ] as const
              ).map(([label, slot]) => (
                <div key={label} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-[#52635B]">{label}</p>
                    <p className="text-sm font-medium text-[#111B17] truncate">{slot.title}</p>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-[#455750] shrink-0">
                    <p>{slot.calories} kcal</p>
                    <p className="text-[#52635B]">{slot.proteinG}g prot · {slot.prepTimeMin} min</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-[#455750]">
                Você ainda não montou seu planejamento alimentar desta semana.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23]"
              >
                {isPremium ? 'Gerar semana automática' : 'Conhecer Planejador Semanal'}
              </button>
            </div>
          )}
        </div>

        {/* Recent Recipes & Shopping Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-lg font-semibold text-[#111B17]">
                Últimas receitas do Chef
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('chef')}
                className="text-xs font-semibold text-[#173D32] hover:underline whitespace-nowrap"
              >
                Ver todas
              </button>
            </div>

            {recipes.length > 0 ? (
              <div className="divide-y divide-[#E5ECE8]">
                {recipes.slice(0, 3).map((rec) => (
                  <div key={rec.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111B17] truncate">{rec.title}</p>
                      <p className="text-xs text-[#52635B] font-mono tabular-nums mt-0.5">
                        {rec.nutritionPerServing.calories} kcal · {rec.nutritionPerServing.proteinG}g prot ·{' '}
                        {rec.prepTimeMin} min
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('chef')}
                      className="text-xs font-medium text-[#173D32] hover:underline shrink-0"
                    >
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-[#455750]">
                  Nenhuma receita gerada ainda. Informe seus ingredientes e peça uma sugestão ao Chef.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('chef')}
                  className="px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23]"
                >
                  Gerar primeira receita
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-display text-lg font-semibold text-[#111B17]">
                Lista de compras pendente
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="text-xs font-semibold text-[#173D32] hover:underline whitespace-nowrap"
              >
                Gerenciar
              </button>
            </div>

            {pendingShopping.length > 0 ? (
              <ul className="space-y-2 text-sm text-[#24342D]">
                {pendingShopping.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>
                    <span className="font-mono text-xs text-[#52635B] tabular-nums shrink-0">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#52635B]">
                Nenhum item pendente na sua lista de compras.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
