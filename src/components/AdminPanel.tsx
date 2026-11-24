import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Shield } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBrl } from '../lib/formatters.ts';
import {
  adminUpdateUserPlan,
  fetchAllUsersForAdmin,
  fetchAnalyticsEventsForAdmin,
  saveAppConfig,
} from '../lib/nutrixService.ts';
import type { AnalyticsEventRecord, AppConfig, UserProfile } from '../types/nutrix.ts';

interface AdminPanelProps {
  config: AppConfig;
  onConfigUpdated: (next: AppConfig) => void;
}

export function AdminPanel({ config, onConfigUpdated }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, e] = await Promise.all([
        fetchAllUsersForAdmin(),
        fetchAnalyticsEventsForAdmin(),
      ]);
      setUsers(u);
      setEvents(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const premiumUsers = users.filter((u) => u.plan === 'premium').length;
    const freeUsers = totalUsers - premiumUsers;
    const activeSubs = users.filter(
      (u) => u.plan === 'premium' && u.subscriptionStatus === 'active',
    ).length;
    const canceledSubs = events.filter((e) => e.eventName === 'subscription_canceled').length;
    const mrrBrl = activeSubs * config.premiumPriceBrl;
    const conversionPct =
      totalUsers > 0 ? Number(((premiumUsers / totalUsers) * 100).toFixed(1)) : 0;
    const aiErrors = events.filter((e) => e.eventName === 'ai_error');
    const aiUsageEvents = events.filter((e) =>
      ['first_recipe_generated', 'photo_scan_used', 'meal_plan_generated'].includes(e.eventName),
    ).length;
    return {
      totalUsers,
      freeUsers,
      premiumUsers,
      activeSubs,
      canceledSubs,
      mrrBrl,
      conversionPct,
      aiErrors,
      aiUsageEvents,
    };
  }, [users, events, config.premiumPriceBrl]);

  const funnelData = useMemo(() => {
    const counts = (name: AnalyticsEventRecord['eventName']) =>
      events.filter((e) => e.eventName === name).length;
    return [
      { etapa: 'Cadastros', total: counts('signup_completed') },
      { etapa: '1º Ingred.', total: counts('first_ingredient_added') },
      { etapa: '1ª Receita', total: counts('first_recipe_generated') },
      { etapa: 'Limite Bás.', total: counts('free_limit_reached') },
      { etapa: 'Clique Prem.', total: counts('premium_clicked') },
      { etapa: 'Checkout', total: counts('checkout_started') },
      { etapa: 'Pagos', total: counts('payment_approved') },
    ];
  }, [events]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setFeedback('');
    try {
      await saveAppConfig({
        freeMaxIngredients: Number(draftConfig.freeMaxIngredients) || 10,
        freeWeeklyRecipes: Number(draftConfig.freeWeeklyRecipes) || 3,
        freeHistoryLimit: Number(draftConfig.freeHistoryLimit) || 3,
        premiumPriceBrl: Number(draftConfig.premiumPriceBrl) || 37,
        premiumDailyAiCap: Number(draftConfig.premiumDailyAiCap) || 60,
        enablePhotoRecognition: draftConfig.enablePhotoRecognition,
        enableWeeklyPlanner: draftConfig.enableWeeklyPlanner,
      });
      onConfigUpdated(draftConfig);
      setFeedback('Limites de planos e funcionalidades atualizados em tempo real.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleUserPlan = async (user: UserProfile) => {
    const nextPlan = user.plan === 'premium' ? 'free' : 'premium';
    const nextStatus = nextPlan === 'premium' ? 'active' : 'none';
    await adminUpdateUserPlan(user.uid, nextPlan, nextStatus);
    setFeedback(`Plano de ${user.email} alterado para ${nextPlan.toUpperCase()}.`);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#173D32] inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Acesso administrativo verificado</span>
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Painel Administrativo NUTRIX
          </h1>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 rounded-xl border border-[#DCE4DF] bg-white text-xs font-semibold text-[#173D32] hover:bg-[#F5F7F5] inline-flex items-center gap-1.5 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar indicadores</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Business KPI Grid (Real Firestore Aggregates) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Usuários totais</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.totalUsers}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5 tabular-nums">
            Básico: {stats.freeUsers} · Premium: {stats.premiumUsers}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">MRR (Receita mensal)</p>
          <p className="font-mono text-2xl font-bold text-[#173D32] tabular-nums mt-1">
            {formatBrl(stats.mrrBrl)}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            {stats.activeSubs} assinatura(s) ativa(s)
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Upgrade Básico → Prem</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.conversionPct}%
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            Cancelamentos: {stats.canceledSubs}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Eventos de IA registrados</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.aiUsageEvents}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            Total eventos: {events.length}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Erros de IA/App</p>
          <p className="font-mono text-2xl font-bold text-red-700 tabular-nums mt-1">
            {stats.aiErrors.length}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">Últimos 400 eventos</p>
        </div>
      </div>

      {/* Funnel Chart + Plan Limits Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#DCE4DF] rounded-2xl p-6">
          <h2 className="font-display text-lg font-semibold text-[#111B17] mb-1">
            Funil de conversão e ativação
          </h2>
          <p className="text-xs text-[#52635B] mb-4">
            Acompanhe onde os usuários avançam ou abandonam o fluxo.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5ECE8" />
                <XAxis dataKey="etapa" tick={{ fontSize: 11, fill: '#52635B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#52635B' }} />
                <Tooltip />
                <Bar dataKey="total" name="Eventos" fill="#173D32" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <form
          onSubmit={handleSaveConfig}
          className="lg:col-span-5 bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-[#111B17]">
            Configurar limites e módulos
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                Básico: Máx. ingredientes
              </label>
              <input
                type="number"
                min={1}
                value={draftConfig.freeMaxIngredients}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, freeMaxIngredients: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                Básico: Receitas/semana
              </label>
              <input
                type="number"
                min={1}
                value={draftConfig.freeWeeklyRecipes}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, freeWeeklyRecipes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                Preço Premium (R$)
              </label>
              <input
                type="number"
                min={1}
                value={draftConfig.premiumPriceBrl}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, premiumPriceBrl: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                Teto técnico IA/dia
              </label>
              <input
                type="number"
                min={5}
                value={draftConfig.premiumDailyAiCap}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, premiumDailyAiCap: Number(e.target.value) })
                }
                className="w-full px-3 py-2 font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs text-[#32433C]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.enablePhotoRecognition}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, enablePhotoRecognition: e.target.checked })
                }
                className="rounded accent-[#173D32]"
              />
              <span>Habilitar Reconhecimento por Foto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.enableWeeklyPlanner}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, enableWeeklyPlanner: e.target.checked })
                }
                className="rounded accent-[#173D32]"
              />
              <span>Habilitar Planejador Semanal com IA</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="w-full py-2.5 px-4 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-[#C3F28B]" />
            <span>{savingConfig ? 'Salvando...' : 'Salvar configurações globais'}</span>
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[#E5ECE8]">
          <h2 className="font-display text-lg font-semibold text-[#111B17]">
            Usuários cadastrados ({users.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F7F5] text-[#52635B] border-b border-[#E5ECE8]">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Assinatura</th>
                <th className="py-3 px-4 text-right">Receitas/sem</th>
                <th className="py-3 px-4 text-right">Ação admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5ECE8]">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-[#F5F7F5]/50">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#111B17]">{u.displayName}</p>
                    <p className="text-[#52635B]">{u.email}</p>
                  </td>
                  <td className="py-3 px-4 font-mono uppercase font-semibold text-[#173D32]">
                    {u.plan === 'premium' ? 'PREMIUM' : 'BÁSICO'}
                  </td>
                  <td className="py-3 px-4 text-[#52635B]">{u.subscriptionStatus}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {u.weeklyRecipesCount}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleUserPlan(u)}
                      className="px-3 py-1.5 rounded-lg border border-[#DCE4DF] text-[#173D32] font-medium hover:bg-[#F5F7F5]"
                    >
                      {u.plan === 'premium' ? 'Alterar p/ Básico' : 'Conceder Premium'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Errors Log */}
      {stats.aiErrors.length > 0 && (
        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6">
          <h3 className="font-display text-base font-semibold text-[#111B17] mb-3">
            Erros recentes de IA / Aplicação
          </h3>
          <ul className="space-y-2 text-xs font-mono text-red-800">
            {stats.aiErrors.slice(0, 10).map((err) => (
              <li key={err.id} className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                [{err.userId.slice(0, 8)}] {err.metadata}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
