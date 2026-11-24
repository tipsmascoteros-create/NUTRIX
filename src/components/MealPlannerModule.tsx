import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Edit3,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { findTacoFood } from '../data/tacoDatabase.ts';
import { apiFetch } from '../lib/apiClient.ts';
import { formatBrl, getCurrentIsoWeekKey } from '../lib/formatters.ts';
import {
  addPantryItem,
  addShoppingItem,
  deleteShoppingItem,
  logAnalyticsEvent,
  saveWeeklyMealPlan,
  toggleShoppingItem,
} from '../lib/nutrixService.ts';
import {
  PANTRY_CATEGORY_LABELS,
  type AppConfig,
  type MealPlanDay,
  type MealSlot,
  type PantryCategory,
  type PantryItem,
  type SavedRecipe,
  type ShoppingItem,
  type UserProfile,
  type WeeklyMealPlan,
} from '../types/nutrix.ts';

interface MealPlannerModuleProps {
  profile: UserProfile;
  config: AppConfig;
  pantry: PantryItem[];
  recipes: SavedRecipe[];
  mealPlan: WeeklyMealPlan | null;
  shoppingList: ShoppingItem[];
  onOpenUpgrade: (reason: string) => void;
}

const DEFAULT_DAYS: MealPlanDay[] = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
].map((dayLabel, idx) => ({
  dayKey: `day_${idx + 1}`,
  dayLabel,
  breakfast: { title: 'A definir', recipeId: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, estimatedCostBrl: 0, prepTimeMin: 10 },
  lunch: { title: 'A definir', recipeId: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, estimatedCostBrl: 0, prepTimeMin: 25 },
  snack: { title: 'A definir', recipeId: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, estimatedCostBrl: 0, prepTimeMin: 5 },
  dinner: { title: 'A definir', recipeId: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0, estimatedCostBrl: 0, prepTimeMin: 20 },
}));

export function MealPlannerModule({
  profile,
  config,
  pantry,
  recipes,
  mealPlan,
  shoppingList,
  onOpenUpgrade,
}: MealPlannerModuleProps) {
  const isPremium = profile.plan === 'premium';
  const weekKey = getCurrentIsoWeekKey();

  const [activeSubTab, setActiveSubTab] = useState<'planner' | 'shopping'>('planner');
  const [servings, setServings] = useState(mealPlan?.servings || 2);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Editing a specific meal slot
  const [editingSlot, setEditingSlot] = useState<{
    dayIdx: number;
    slotKey: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    slot: MealSlot;
  } | null>(null);

  // Manual shopping item form
  const [shopName, setShopName] = useState('');
  const [shopQty, setShopQty] = useState('1');
  const [shopUnit, setShopUnit] = useState('un');
  const [shopCategory, setShopCategory] = useState<PantryCategory>('verduras');
  const [shopPrice, setShopPrice] = useState('');

  const days = mealPlan?.days && mealPlan.days.length > 0 ? mealPlan.days : DEFAULT_DAYS;

  const handleGenerateWeeklyPlan = async () => {
    setError('');
    setFeedback('');
    if (!isPremium) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'premium_clicked',
        plan: profile.plan,
        metadata: 'weekly_planner_ai',
        analyticsConsent: profile.analyticsConsent,
      });
      onOpenUpgrade(
        'O Planejador Alimentar Semanal automático está disponível no NUTRIX Premium. Organize café, almoço, lanche e jantar considerando sua despensa e orçamento em segundos.',
      );
      return;
    }

    if (!config.enableWeeklyPlanner) {
      setError('O gerador de planejamento semanal está temporariamente pausado pelo administrador.');
      return;
    }

    setGenerating(true);
    try {
      const res = await apiFetch<{ days: MealPlanDay[]; totalEstimatedCostBrl: number }>(
        '/api/ai/meal-plan',
        {
          method: 'POST',
          body: JSON.stringify({
            pantryItems: pantry.filter((p) => p.status === 'available'),
            profile,
            servings,
            weekKey,
          }),
        },
      );

      await saveWeeklyMealPlan(
        profile.uid,
        weekKey,
        servings,
        res.days,
        res.totalEstimatedCostBrl,
      );

      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'meal_plan_generated',
        plan: profile.plan,
        metadata: `week:${weekKey};servings:${servings}`,
        analyticsConsent: profile.analyticsConsent,
      });
      setFeedback('Planejamento alimentar semanal gerado e salvo com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar planejamento semanal.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSlotEdit = async () => {
    if (!editingSlot) return;
    const nextDays = days.map((d, idx) =>
      idx === editingSlot.dayIdx ? { ...d, [editingSlot.slotKey]: editingSlot.slot } : d,
    );
    const totalCost = nextDays.reduce(
      (sum, d) =>
        sum +
        d.breakfast.estimatedCostBrl +
        d.lunch.estimatedCostBrl +
        d.snack.estimatedCostBrl +
        d.dinner.estimatedCostBrl,
      0,
    );
    await saveWeeklyMealPlan(profile.uid, weekKey, servings, nextDays, Number(totalCost.toFixed(2)));
    setEditingSlot(null);
    setFeedback('Refeição atualizada no seu calendário semanal.');
  };

  const handleSwapDays = async (idxA: number, idxB: number) => {
    if (idxB < 0 || idxB >= days.length) return;
    const copy = [...days];
    const mealsA = {
      breakfast: copy[idxA].breakfast,
      lunch: copy[idxA].lunch,
      snack: copy[idxA].snack,
      dinner: copy[idxA].dinner,
    };
    copy[idxA] = {
      ...copy[idxA],
      breakfast: copy[idxB].breakfast,
      lunch: copy[idxB].lunch,
      snack: copy[idxB].snack,
      dinner: copy[idxB].dinner,
    };
    copy[idxB] = { ...copy[idxB], ...mealsA };
    await saveWeeklyMealPlan(
      profile.uid,
      weekKey,
      servings,
      copy,
      mealPlan?.totalEstimatedCostBrl || 0,
    );
    setFeedback(`Cardápio reorganizado entre ${copy[idxA].dayLabel} e ${copy[idxB].dayLabel}.`);
  };

  // Module 9: Automatically generate shopping list subtracting existing pantry stock
  const handleSyncShoppingFromPlan = async () => {
    if (!isPremium) {
      onOpenUpgrade(
        'A geração automática da Lista de Compras Inteligente descontando sua despensa faz parte do NUTRIX Premium.',
      );
      return;
    }

    const availableNames = pantry
      .filter((p) => p.status === 'available' && p.quantity > 0)
      .map((p) => p.name.toLowerCase());
    const existingShopNames = new Set(shoppingList.map((s) => s.name.toLowerCase()));

    const neededMap = new Map<string, number>();
    for (const day of days) {
      const slots = [day.breakfast, day.lunch, day.snack, day.dinner];
      for (const slot of slots) {
        for (const ingName of slot.ingredientsList || []) {
          const lower = ingName.toLowerCase().trim();
          if (!lower) continue;
          const alreadyInPantry = availableNames.some(
            (pName) => pName.includes(lower) || lower.includes(pName),
          );
          if (!alreadyInPantry && !existingShopNames.has(lower)) {
            neededMap.set(ingName, (neededMap.get(ingName) || 0) + 1);
          }
        }
      }
    }

    if (neededMap.size === 0) {
      setFeedback('Nenhum ingrediente faltante novo encontrado fora da sua despensa atual.');
      setActiveSubTab('shopping');
      return;
    }

    for (const [name, occurrences] of neededMap.entries()) {
      const taco = findTacoFood(name);
      await addShoppingItem(profile.uid, {
        name,
        category: taco?.category || 'outros',
        quantity: occurrences * servings,
        unit: taco?.defaultUnit || 'un',
        estimatedPriceBrl: 0,
        priceSource: 'none',
        checked: false,
        source: 'meal_plan',
      });
    }

    setFeedback(
      `${neededMap.size} item(ns) faltante(s) adicionado(s) à Lista de Compras (itens da despensa foram descontados).`,
    );
    setActiveSubTab('shopping');
  };

  const handleAddManualShopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;
    const price = Math.max(0, Number(shopPrice) || 0);
    await addShoppingItem(profile.uid, {
      name: shopName.trim(),
      category: shopCategory,
      quantity: Math.max(0.1, Number(shopQty) || 1),
      unit: shopUnit,
      estimatedPriceBrl: price,
      priceSource: price > 0 ? 'user' : 'none',
      checked: false,
      source: 'manual',
    });
    setShopName('');
    setShopQty('1');
    setShopPrice('');
  };

  const handleMoveCheckedToPantry = async () => {
    const bought = shoppingList.filter((i) => i.checked);
    if (bought.length === 0) return;

    const activePantryCount = pantry.filter((p) => p.status === 'available').length;
    if (!isPremium && activePantryCount + bought.length > config.freeMaxIngredients) {
      onOpenUpgrade(
        `Mover ${bought.length} itens ultrapassa o limite de ${config.freeMaxIngredients} ingredientes ativos do plano Básico.`,
      );
      return;
    }

    for (const item of bought) {
      const taco = findTacoFood(item.name);
      await addPantryItem(profile.uid, {
        name: item.name,
        tacoKey: taco?.key || 'custom',
        category: (item.category as PantryCategory) || 'outros',
        quantity: item.quantity,
        unit: (['g', 'kg', 'ml', 'L', 'un', 'colher', 'xicara', 'pacote'].includes(item.unit)
          ? item.unit
          : 'un') as PantryItem['unit'],
        minThreshold: 0,
        purchasePriceBrl: item.estimatedPriceBrl,
        priceUnitQty: item.quantity,
        expiryDate: '',
        storageLocation: 'despensa',
        status: 'available',
      });
      await deleteShoppingItem(profile.uid, item.id);
    }
    setFeedback(`${bought.length} produto(s) comprado(s) movido(s) para sua despensa!`);
  };

  const groupedShopping = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of shoppingList) {
      const cat = item.category || 'outros';
      const arr = groups.get(cat) || [];
      arr.push(item);
      groups.set(cat, arr);
    }
    return Array.from(groups.entries());
  }, [shoppingList]);

  const shoppingTotalBrl = shoppingList.reduce((acc, i) => acc + i.estimatedPriceBrl, 0);
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#52635B]">
            Módulos 8 e 9 · Semana {weekKey}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Planejador Semanal & Lista de Compras
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4DF] rounded-xl self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('planner')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeSubTab === 'planner'
                ? 'bg-[#173D32] text-white'
                : 'text-[#455750] hover:text-[#111B17]'
            }`}
          >
            Calendário semanal
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('shopping')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeSubTab === 'shopping'
                ? 'bg-[#173D32] text-white'
                : 'text-[#455750] hover:text-[#111B17]'
            }`}
          >
            Lista de compras ({shoppingList.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {activeSubTab === 'planner' ? (
        <div className="space-y-5">
          {/* Controls */}
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-[#32433C]">Pessoas:</label>
              <select
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="px-3 py-2 text-xs rounded-xl border border-[#DCE4DF] bg-white"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'pessoa' : 'pessoas'}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#52635B]">
                Orçamento semanal alvo: {formatBrl(profile.weeklyBudgetBrl || 0)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSyncShoppingFromPlan}
                className="px-4 py-2.5 rounded-xl border border-[#173D32] text-[#173D32] text-xs font-semibold hover:bg-[#F5F7F5] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Gerar lista de compras</span>
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateWeeklyPlan}
                className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#C3F28B]" />
                <span>
                  {generating
                    ? 'Montando semana...'
                    : isPremium
                      ? 'Gerar semana automática'
                      : 'Gerar semana automática (Premium)'}
                </span>
              </button>
            </div>
          </div>

          {/* 7-Day Visual Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {days.map((day, dayIdx) => (
              <div
                key={day.dayKey}
                className="bg-white border border-[#DCE4DF] rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5ECE8]">
                    <h3 className="font-display font-semibold text-base text-[#111B17]">
                      {day.dayLabel}
                    </h3>
                    {dayIdx < days.length - 1 && (
                      <button
                        type="button"
                        title={`Trocar com ${days[dayIdx + 1].dayLabel}`}
                        onClick={() => handleSwapDays(dayIdx, dayIdx + 1)}
                        className="p-1.5 rounded-lg text-[#52635B] hover:text-[#173D32] hover:bg-[#F5F7F5]"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {(
                      [
                        ['breakfast', 'Café da manhã'],
                        ['lunch', 'Almoço'],
                        ['snack', 'Lanche'],
                        ['dinner', 'Jantar'],
                      ] as const
                    ).map(([slotKey, label]) => {
                      const slot = day[slotKey];
                      return (
                        <div
                          key={slotKey}
                          className="p-2.5 rounded-xl bg-[#F5F7F5]/75 hover:bg-[#F5F7F5] transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-[#52635B]">{label}</span>
                            <button
                              type="button"
                              onClick={() => setEditingSlot({ dayIdx, slotKey, slot: { ...slot } })}
                              className="p-1 rounded text-[#52635B] hover:text-[#173D32]"
                              aria-label={`Editar ${label} de ${day.dayLabel}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-[#111B17] mt-0.5 line-clamp-2">
                            {slot.title}
                          </p>
                          {slot.calories > 0 && (
                            <p className="text-[11px] font-mono tabular-nums text-[#52635B] mt-1">
                              {slot.calories} kcal · {slot.proteinG}g P · {slot.prepTimeMin}m
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#E5ECE8] flex items-center justify-between text-[11px] font-mono tabular-nums text-[#52635B]">
                  <span>Total dia</span>
                  <span className="font-semibold text-[#173D32]">
                    {day.breakfast.calories +
                      day.lunch.calories +
                      day.snack.calories +
                      day.dinner.calories}{' '}
                    kcal
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* MODULE 9 — SMART SHOPPING LIST */
        <div className="space-y-5">
          <form
            onSubmit={handleAddManualShopping}
            className="bg-white border border-[#DCE4DF] rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Adicionar produto à lista
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex: Peito de frango, Azeite, Maçã..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#32433C] mb-1">Categoria</label>
              <select
                value={shopCategory}
                onChange={(e) => setShopCategory(e.target.value as PantryCategory)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[#DCE4DF] bg-white"
              >
                {(Object.keys(PANTRY_CATEGORY_LABELS) as PantryCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {PANTRY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#32433C] mb-1">Qtd / Un</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={shopQty}
                  onChange={(e) => setShopQty(e.target.value)}
                  className="w-1/2 px-2.5 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
                <input
                  type="text"
                  value={shopUnit}
                  onChange={(e) => setShopUnit(e.target.value)}
                  className="w-1/2 px-2.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF]"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Preço ref. (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={shopPrice}
                onChange={(e) => setShopPrice(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#C3F28B]" />
                <span>Incluir</span>
              </button>
            </div>
          </form>

          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-[#455750] space-y-1">
              <p>
                Marcados como comprados:{' '}
                <strong className="font-mono text-[#111B17] tabular-nums">
                  {checkedCount}/{shoppingList.length}
                </strong>{' '}
                · Total informado:{' '}
                <strong className="font-mono text-[#173D32] tabular-nums">
                  {formatBrl(shoppingTotalBrl)}
                </strong>
              </p>
              <p>Orçamento semanal definido: {formatBrl(profile.weeklyBudgetBrl || 0)}</p>
            </div>

            {checkedCount > 0 && (
              <button
                type="button"
                onClick={handleMoveCheckedToPantry}
                className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Check className="w-4 h-4 text-[#C3F28B]" />
                <span>Enviar {checkedCount} comprado(s) para Despensa</span>
              </button>
            )}
          </div>

          {groupedShopping.length === 0 ? (
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-10 text-center text-sm text-[#52635B]">
              Sua lista de compras está limpa. Adicione itens manualmente ou gere a partir do
              Planejador Semanal ou do Chef.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedShopping.map(([cat, items]) => (
                <div key={cat} className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
                  <h3 className="font-display text-sm font-semibold text-[#173D32] pb-2.5 mb-2.5 border-b border-[#E5ECE8]">
                    {PANTRY_CATEGORY_LABELS[cat as PantryCategory] || cat} ({items.length})
                  </h3>
                  <ul className="space-y-2.5">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) =>
                              toggleShoppingItem(profile.uid, item.id, e.target.checked)
                            }
                            className="rounded accent-[#173D32]"
                          />
                          <span
                            className={`truncate ${
                              item.checked ? 'line-through text-[#899992]' : 'text-[#111B17]'
                            }`}
                          >
                            {item.name}
                          </span>
                        </label>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-xs tabular-nums text-[#52635B]">
                            {item.quantity} {item.unit}
                            {item.estimatedPriceBrl > 0
                              ? ` · ${formatBrl(item.estimatedPriceBrl)}`
                              : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteShoppingItem(profile.uid, item.id)}
                            aria-label={`Remover ${item.name}`}
                            className="p-1 text-[#6B7D75] hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Meal Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE4DF] rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-[#111B17]">
                Substituir refeição · {days[editingSlot.dayIdx].dayLabel}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="p-1.5 rounded-lg text-[#52635B] hover:bg-[#F5F7F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recipes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">
                  Ou escolha uma receita salva do Chef
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = recipes.find((r) => r.id === e.target.value);
                    if (!found) return;
                    setEditingSlot({
                      ...editingSlot,
                      slot: {
                        title: found.title,
                        recipeId: found.id,
                        calories: found.nutritionPerServing.calories,
                        proteinG: found.nutritionPerServing.proteinG,
                        carbsG: found.nutritionPerServing.carbsG,
                        fatG: found.nutritionPerServing.fatG,
                        estimatedCostBrl: found.costPerServingBrl,
                        prepTimeMin: found.prepTimeMin,
                        ingredientsList: found.ingredients.map((i) => i.name),
                      },
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DCE4DF] bg-white"
                >
                  <option value="">Selecionar receita salva...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.nutritionPerServing.calories} kcal)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Nome da refeição
              </label>
              <input
                type="text"
                value={editingSlot.slot.title}
                onChange={(e) =>
                  setEditingSlot({
                    ...editingSlot,
                    slot: { ...editingSlot.slot, title: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">Calorias</label>
                <input
                  type="number"
                  min={0}
                  value={editingSlot.slot.calories}
                  onChange={(e) =>
                    setEditingSlot({
                      ...editingSlot,
                      slot: { ...editingSlot.slot, calories: Number(e.target.value) || 0 },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">Proteína (g)</label>
                <input
                  type="number"
                  min={0}
                  value={editingSlot.slot.proteinG}
                  onChange={(e) =>
                    setEditingSlot({
                      ...editingSlot,
                      slot: { ...editingSlot.slot, proteinG: Number(e.target.value) || 0 },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">Tempo (min)</label>
                <input
                  type="number"
                  min={1}
                  value={editingSlot.slot.prepTimeMin}
                  onChange={(e) =>
                    setEditingSlot({
                      ...editingSlot,
                      slot: { ...editingSlot.slot, prepTimeMin: Number(e.target.value) || 15 },
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE4DF] text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSlotEdit}
                className="px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold"
              >
                Salvar refeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
