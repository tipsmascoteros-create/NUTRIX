import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Leaf,
  Plus,
  ShieldAlert,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { findTacoFood, searchTacoFoods } from '../data/tacoDatabase.ts';
import { apiFetch } from '../lib/apiClient.ts';
import { formatBrl, formatDateBr, getExpiryStatus, getTodayIso } from '../lib/formatters.ts';
import {
  addEconomyEntry,
  addNutritionLog,
  deleteEconomyEntry,
  deleteNutritionLog,
  updateUserProfileFields,
} from '../lib/nutrixService.ts';
import {
  MEAL_TYPE_LABELS,
  type EconomyEntry,
  type EconomyTipResult,
  type MealType,
  type NutritionLog,
  type PantryItem,
  type SavedRecipe,
  type UserProfile,
} from '../types/nutrix.ts';

interface NutritionEconomyModuleProps {
  profile: UserProfile;
  pantry: PantryItem[];
  recipes: SavedRecipe[];
  nutritionLogs: NutritionLog[];
  economyEntries: EconomyEntry[];
  onOpenUpgrade: (reason: string) => void;
  onCookExpiring: () => void;
}

export function NutritionEconomyModule({
  profile,
  pantry,
  recipes,
  nutritionLogs,
  economyEntries,
  onOpenUpgrade,
  onCookExpiring,
}: NutritionEconomyModuleProps) {
  const isPremium = profile.plan === 'premium';
  const [subTab, setSubTab] = useState<'nutrition' | 'economy' | 'zerowaste'>('nutrition');

  // Quick manual nutrition log (TACO-backed)
  const [foodQuery, setFoodQuery] = useState('');
  const [foodGrams, setFoodGrams] = useState('150');
  const [mealType, setMealType] = useState<MealType>('almoco');

  // Budget & purchase entry
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState(String(profile.weeklyBudgetBrl || 200));
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(
    String(profile.monthlyBudgetBrl || 800),
  );
  const [purchaseItem, setPurchaseItem] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // AI Economy tips
  const [economyTips, setEconomyTips] = useState<EconomyTipResult | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);
  const [tipError, setTipError] = useState('');
  const [feedback, setFeedback] = useState('');

  const foodSuggestions = useMemo(
    () => (foodQuery.trim().length >= 2 ? searchTacoFoods(foodQuery, 5) : []),
    [foodQuery],
  );

  // Real 7-day nutrition chart data
  const weeklyNutritionChart = useMemo(() => {
    const days: Array<{ date: string; label: string; calorias: number; proteinas: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dayLogs = nutritionLogs.filter((l) => l.date === iso);
      days.push({
        date: iso,
        label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
        calorias: dayLogs.reduce((s, l) => s + l.calories, 0),
        proteinas: Math.round(dayLogs.reduce((s, l) => s + l.proteinG, 0)),
      });
    }
    return days;
  }, [nutritionLogs]);

  // Economy calculations from real records
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const spent7d = economyEntries
    .filter((e) => e.type === 'purchase' && e.date >= sevenDaysAgo)
    .reduce((s, e) => s + e.amountBrl, 0);
  const spent30d = economyEntries
    .filter((e) => e.type === 'purchase' && e.date >= thirtyDaysAgo)
    .reduce((s, e) => s + e.amountBrl, 0);
  const savedWasteTotal = economyEntries
    .filter((e) => e.type === 'saved_waste')
    .reduce((s, e) => s + e.amountBrl, 0);
  const discardedTotal = economyEntries
    .filter((e) => e.type === 'discarded')
    .reduce((s, e) => s + e.amountBrl, 0);

  const availablePantry = pantry.filter((p) => p.status === 'available' && p.quantity > 0);
  const expiringList = useMemo(() => {
    return availablePantry
      .map((item) => ({
        item,
        expiry: getExpiryStatus(item.expiryDate),
        taco: findTacoFood(item.name),
      }))
      .filter((x) => x.expiry.state === 'expired' || x.expiry.state === 'expiring_soon')
      .sort((a, b) => (a.expiry.daysLeft ?? 99) - (b.expiry.daysLeft ?? 99));
  }, [availablePantry]);

  const handleLogTacoFood = async (e: React.FormEvent) => {
    e.preventDefault();
    const matched = findTacoFood(foodQuery);
    const grams = Math.max(1, Number(foodGrams) || 100);
    if (!matched) {
      setFeedback('Selecione um alimento da lista de sugestões para registrar os nutrientes.');
      return;
    }
    const factor = grams / 100;
    await addNutritionLog(profile.uid, {
      date: getTodayIso(),
      mealType,
      title: `${matched.name} (${grams}g)`,
      recipeId: '',
      servings: 1,
      calories: Math.round(matched.calories * factor),
      proteinG: Number((matched.proteinG * factor).toFixed(1)),
      carbsG: Number((matched.carbsG * factor).toFixed(1)),
      fatG: Number((matched.fatG * factor).toFixed(1)),
      fiberG: Number((matched.fiberG * factor).toFixed(1)),
      sodiumMg: Math.round(matched.sodiumMg * factor),
      costBrl: 0,
    });
    setFoodQuery('');
    setFeedback(`${matched.name} (${grams}g) registrado no diário nutricional.`);
  };

  const handleSaveBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfileFields(profile.uid, {
      weeklyBudgetBrl: Math.max(0, Number(weeklyBudgetInput) || 0),
      monthlyBudgetBrl: Math.max(0, Number(monthlyBudgetInput) || 0),
    });
    setFeedback('Orçamentos semanal e mensal atualizados.');
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseItem.trim() || !purchaseAmount) return;
    await addEconomyEntry(profile.uid, {
      type: 'purchase',
      itemName: purchaseItem.trim(),
      category: 'compras',
      amountBrl: Math.max(0, Number(purchaseAmount) || 0),
      quantity: 1,
      unit: 'un',
      date: getTodayIso(),
      notes: purchaseNotes.trim(),
    });
    setPurchaseItem('');
    setPurchaseAmount('');
    setPurchaseNotes('');
    setFeedback('Compra registrada no seu controle de orçamento.');
  };

  const handleRunEconomyAi = async () => {
    setTipError('');
    if (!isPremium) {
      onOpenUpgrade(
        'As sugestões personalizadas de substituições econômicas e otimização do orçamento alimentar estão disponíveis no NUTRIX Premium.',
      );
      return;
    }
    setLoadingTips(true);
    try {
      const res = await apiFetch<EconomyTipResult>('/api/ai/economy-tips', {
        method: 'POST',
        body: JSON.stringify({
          pantryItems: availablePantry,
          profile,
          spentThisWeekBrl: spent7d,
        }),
      });
      setEconomyTips(res);
    } catch (err) {
      setTipError(err instanceof Error ? err.message : 'Erro ao gerar análise econômica.');
    } finally {
      setLoadingTips(false);
    }
  };

  const recipesWithCost = recipes
    .filter((r) => r.hasUserPrices && r.costPerServingBrl > 0)
    .sort((a, b) => a.costPerServingBrl - b.costPerServingBrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#52635B]">
            Módulos 4, 6 e 7 · Dados reais da sua conta
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Nutrição, Economia & Zero Desperdício
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4DF] rounded-xl self-start">
          {(
            [
              ['nutrition', 'Nutrição', BarChart3],
              ['economy', 'Economia (R$)', Wallet],
              ['zerowaste', 'Zero Desperdício', Leaf],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubTab(key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                subTab === key
                  ? 'bg-[#173D32] text-white'
                  : 'text-[#455750] hover:text-[#111B17]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
          {feedback}
        </div>
      )}

      {/* TAB 1: NUTRITION HISTORY */}
      {subTab === 'nutrition' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#111B17]">
                  Evolução nutricional dos últimos 7 dias
                </h2>
                <p className="text-xs text-[#52635B]">
                  Calorias (kcal) e proteínas (g) reais registradas a partir das suas refeições.
                </p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyNutritionChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5ECE8" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#52635B' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#52635B' }} />
                  <Tooltip />
                  <Bar dataKey="calorias" name="Calorias (kcal)" fill="#173D32" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="proteinas" name="Proteínas (g)" fill="#C3F28B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick TACO Meal Logger */}
          <form
            onSubmit={handleLogTacoFood}
            className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-[#111B17]">
              Registrar alimento consumido
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <div className="md:col-span-5">
                <input
                  type="text"
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  placeholder="Digite um alimento (ex: Frango, Arroz, Banana, Ovo...)"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
                />
                {foodSuggestions.length > 0 && (
                  <div className="mt-1 bg-white border border-[#DCE4DF] rounded-xl divide-y divide-[#E5ECE8]">
                    {foodSuggestions.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFoodQuery(f.name)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F7F5] flex justify-between"
                      >
                        <span>{f.name}</span>
                        <span className="font-mono text-[#52635B] tabular-nums">
                          {f.calories} kcal / 100g
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  min={1}
                  value={foodGrams}
                  onChange={(e) => setFoodGrams(e.target.value)}
                  placeholder="Gramas"
                  className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
              </div>
              <div className="md:col-span-3">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white"
                >
                  {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((k) => (
                    <option key={k} value={k}>
                      {MEAL_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#C3F28B]" />
                  <span>Registrar</span>
                </button>
              </div>
            </div>
          </form>

          {/* Logs List */}
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-[#111B17] mb-4">
              Histórico recente de refeições ({nutritionLogs.length})
            </h3>
            {nutritionLogs.length === 0 ? (
              <p className="text-sm text-[#52635B]">
                Nenhuma refeição registrada ainda. Marque uma receita como preparada no Chef ou
                registre um alimento acima.
              </p>
            ) : (
              <div className="divide-y divide-[#E5ECE8]">
                {nutritionLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-[#111B17] truncate">{log.title}</p>
                      <p className="text-xs text-[#52635B]">
                        {formatDateBr(log.date)} · {MEAL_TYPE_LABELS[log.mealType]}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs tabular-nums text-[#32433C]">
                        {log.calories} kcal · P {log.proteinG}g · C {log.carbsG}g · G {log.fatG}g
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteNutritionLog(profile.uid, log.id)}
                        className="p-1 text-[#6B7D75] hover:text-red-700"
                        aria-label="Excluir registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SMART ECONOMY */}
      {subTab === 'economy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
              <p className="text-xs text-[#52635B]">Orçamento semanal</p>
              <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
                {formatBrl(profile.weeklyBudgetBrl || 0)}
              </p>
              <p className="text-xs text-[#52635B] mt-1 tabular-nums">
                Utilizado (7d): {formatBrl(spent7d)} · Restante:{' '}
                <strong className="text-[#173D32]">
                  {formatBrl(Math.max(0, (profile.weeklyBudgetBrl || 0) - spent7d))}
                </strong>
              </p>
            </div>
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
              <p className="text-xs text-[#52635B]">Orçamento mensal</p>
              <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
                {formatBrl(profile.monthlyBudgetBrl || 0)}
              </p>
              <p className="text-xs text-[#52635B] mt-1 tabular-nums">
                Utilizado (30d): {formatBrl(spent30d)}
              </p>
            </div>
            <div className="bg-[#173D32] text-white rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs text-[#C3F28B]">Substituições econômicas inteligentes</p>
                <p className="text-xs text-white/85 mt-1">
                  Analise seus ingredientes e descubra trocas que preservam proteína e reduzem
                  gastos.
                </p>
              </div>
              <button
                type="button"
                disabled={loadingTips}
                onClick={handleRunEconomyAi}
                className="mt-3 px-4 py-2 rounded-xl bg-[#C3F28B] text-[#173D32] text-xs font-bold hover:bg-[#B1E872] self-start"
              >
                {loadingTips
                  ? 'Analisando...'
                  : isPremium
                    ? 'Gerar análise de economia'
                    : 'Economizar com inteligência (Premium)'}
              </button>
            </div>
          </div>

          {tipError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {tipError}
            </div>
          )}

          {economyTips && (
            <div className="bg-white border-2 border-[#173D32] rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-lg font-semibold text-[#111B17]">
                Relatório personalizado de economia alimentar
              </h3>
              <p className="text-sm text-[#32433C] leading-relaxed">{economyTips.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#F5F7F5] space-y-2">
                  <p className="font-semibold text-[#111B17]">Substituições econômicas sugeridas</p>
                  {economyTips.substitutions.map((s, idx) => (
                    <p key={idx} className="text-[#32433C]">
                      <strong>{s.original}</strong> → <strong>{s.suggestion}</strong>: {s.reason}
                    </p>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-[#F5F7F5] space-y-2">
                  <p className="font-semibold text-[#111B17]">Ações imediatas no orçamento</p>
                  {economyTips.budgetAdvice.map((b, idx) => (
                    <p key={idx} className="text-[#32433C]">
                      • {b}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Edit Budget */}
            <form
              onSubmit={handleSaveBudgets}
              className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-display text-base font-semibold text-[#111B17]">
                Definir orçamento alimentar (R$)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#32433C] mb-1">
                    Orçamento semanal (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={weeklyBudgetInput}
                    onChange={(e) => setWeeklyBudgetInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#32433C] mb-1">
                    Orçamento mensal (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={20}
                    value={monthlyBudgetInput}
                    onChange={(e) => setMonthlyBudgetInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold"
              >
                Salvar metas de orçamento
              </button>
            </form>

            {/* Register Purchase */}
            <form
              onSubmit={handleAddPurchase}
              className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-display text-base font-semibold text-[#111B17]">
                Registrar compra de supermercado / feira
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={purchaseItem}
                  onChange={(e) => setPurchaseItem(e.target.value)}
                  placeholder="Ex: Feira da semana"
                  className="sm:col-span-2 px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF]"
                />
                <input
                  type="number"
                  required
                  min={0.01}
                  step="0.01"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="Valor R$"
                  className="px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
                />
              </div>
              <input
                type="text"
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="Observação opcional (ex: hortifruti e carnes)"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#DCE4DF]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold"
              >
                Registrar gasto
              </button>
            </form>
          </div>

          {/* Recipe Cost Comparison (Only Real User Prices) */}
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-[#111B17] mb-2">
              Comparativo de receitas por custo por porção
            </h3>
            <p className="text-xs text-[#52635B] mb-4">
              Calculado exclusivamente com base nos preços reais que você informou na sua despensa
              (nunca inventamos preços de supermercado).
            </p>
            {recipesWithCost.length === 0 ? (
              <p className="text-sm text-[#52635B]">
                Informe o preço pago nos ingredientes da sua despensa e gere receitas no Chef
                para comparar automaticamente o custo por porção.
              </p>
            ) : (
              <div className="divide-y divide-[#E5ECE8]">
                {recipesWithCost.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#111B17]">{r.title}</span>
                    <span className="font-mono text-xs tabular-nums text-[#173D32] font-semibold">
                      {formatBrl(r.costPerServingBrl)} / porção ({formatBrl(r.totalCostBrl)} total)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ZERO WASTE */}
      {subTab === 'zerowaste' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
              <p className="text-xs text-[#52635B]">Valor aproveitado (desperdício evitado)</p>
              <p className="font-mono text-2xl font-bold text-[#173D32] tabular-nums mt-1">
                {formatBrl(savedWasteTotal)}
              </p>
            </div>
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
              <p className="text-xs text-[#52635B]">Alimentos descartados registrados</p>
              <p className="font-mono text-2xl font-bold text-red-700 tabular-nums mt-1">
                {formatBrl(discardedTotal)}
              </p>
            </div>
            <div className="bg-white border border-[#DCE4DF] rounded-2xl p-5">
              <p className="text-xs text-[#52635B]">Itens com prioridade de consumo</p>
              <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums mt-1">
                {expiringList.length}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F7F5] border border-[#DCE4DF] flex items-start gap-3 text-xs text-[#32433C]">
            <ShieldAlert className="w-4 h-4 text-[#173D32] shrink-0 mt-0.5" />
            <p>
              <strong>Segurança alimentar em primeiro lugar:</strong> não considere um alimento
              próprio para consumo apenas porque a data de validade ainda não terminou. Verifique
              sempre odor, cor, textura, integridade da embalagem e refrigeração adequada.
            </p>
          </div>

          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-[#111B17]">
                Alimentos que precisam ser utilizados primeiro
              </h3>
              {expiringList.length > 0 && (
                <button
                  type="button"
                  onClick={onCookExpiring}
                  className="px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23]"
                >
                  Gerar receitas para aproveitar agora
                </button>
              )}
            </div>

            {expiringList.length === 0 ? (
              <p className="text-sm text-[#52635B]">
                Nenhum alimento próximo do vencimento no momento. Continue cadastrando datas de
                validade na despensa para receber alertas inteligentes.
              </p>
            ) : (
              <div className="divide-y divide-[#E5ECE8]">
                {expiringList.map(({ item, expiry, taco }) => (
                  <div key={item.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-sm text-[#111B17] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        {item.name} ({item.quantity} {item.unit})
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          expiry.state === 'expired' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {expiry.label}
                      </span>
                    </div>
                    {taco?.storageTip && (
                      <p className="text-xs text-[#52635B]">
                        Conservação: {taco.storageTip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Economy / Waste Log */}
          <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-[#111B17] mb-3">
              Registros recentes de compras e aproveitamento
            </h3>
            {economyEntries.length === 0 ? (
              <p className="text-sm text-[#52635B]">Nenhum registro ainda.</p>
            ) : (
              <div className="divide-y divide-[#E5ECE8]">
                {economyEntries.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-[#111B17]">{entry.itemName}</span>
                      <span className="text-[#52635B]">
                        {' '}
                        ·{' '}
                        {entry.type === 'purchase'
                          ? 'Compra'
                          : entry.type === 'saved_waste'
                            ? 'Aproveitado'
                            : 'Descartado'}{' '}
                        · {formatDateBr(entry.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-semibold tabular-nums text-[#111B17]">
                        {formatBrl(entry.amountBrl)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteEconomyEntry(profile.uid, entry.id)}
                        className="p-1 text-[#6B7D75] hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
