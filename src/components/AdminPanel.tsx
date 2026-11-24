import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Webhook,
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
import { apiFetch } from '../lib/apiClient.ts';
import { formatBrl } from '../lib/formatters.ts';
import {
  adminDeleteEntitlement,
  adminUpdateUserPlan,
  adminUpsertEntitlementByEmail,
  fetchAllEntitlementsForAdmin,
  fetchAllUsersForAdmin,
  fetchAnalyticsEventsForAdmin,
  saveAppConfig,
} from '../lib/nutrixService.ts';
import type {
  AnalyticsEventRecord,
  AppConfig,
  PaymentConfigStatus,
  PlanType,
  SubscriptionEntitlement,
  UserProfile,
} from '../types/nutrix.ts';

interface HotmartWebhookRecordView {
  email: string;
  buyerName: string;
  plan: PlanType;
  status: 'active' | 'canceled' | 'refunded';
  offerCode: string;
  transaction: string;
  lastEvent: string;
  updatedAt: string;
}

interface AdminPanelProps {
  config: AppConfig;
  onConfigUpdated: (next: AppConfig) => void;
}

export function AdminPanel({ config, onConfigUpdated }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [entitlements, setEntitlements] = useState<SubscriptionEntitlement[]>([]);
  const [webhookRecords, setWebhookRecords] = useState<HotmartWebhookRecordView[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);

  // Manual Hotmart / Email access grant form
  const [grantEmail, setGrantEmail] = useState('');
  const [grantName, setGrantName] = useState('');
  const [grantPlan, setGrantPlan] = useState<PlanType>('free');
  const [grantTransaction, setGrantTransaction] = useState('');
  const [granting, setGranting] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${origin}/api/webhooks/hotmart`;
  const postPurchaseUrl = `${origin}/?acesso=hotmart`;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, e, ent, hm] = await Promise.all([
        fetchAllUsersForAdmin(),
        fetchAnalyticsEventsForAdmin(),
        fetchAllEntitlementsForAdmin(),
        apiFetch<{ items: HotmartWebhookRecordView[]; config: PaymentConfigStatus }>(
          '/api/admin/hotmart-entitlements',
        ).catch(() => null),
      ]);
      setUsers(u);
      setEvents(e);
      setEntitlements(ent);
      if (hm) {
        setWebhookRecords(hm.items || []);
        setPaymentConfig(hm.config || null);
      }
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
    const activeEntitlements = entitlements.filter((ent) => ent.status === 'active');
    const activePremium = activeEntitlements.filter((ent) => ent.plan === 'premium').length;
    const activeBasic = activeEntitlements.filter((ent) => ent.plan === 'free').length;

    const userDirectActive = users.filter((u) => u.subscriptionStatus === 'active');
    const premiumUsers = Math.max(
      activePremium,
      userDirectActive.filter((u) => u.plan === 'premium').length,
    );
    const basicUsers = Math.max(
      activeBasic,
      userDirectActive.filter((u) => u.plan === 'free').length,
    );
    const activeSubs = premiumUsers + basicUsers;
    const canceledSubs =
      events.filter((e) => e.eventName === 'subscription_canceled').length +
      entitlements.filter((e) => e.status !== 'active').length;
    const mrrBrl = basicUsers * 19 + premiumUsers * config.premiumPriceBrl;
    const conversionPct =
      activeSubs > 0 ? Number(((premiumUsers / activeSubs) * 100).toFixed(1)) : 0;
    const aiErrors = events.filter((e) => e.eventName === 'ai_error');
    const aiUsageEvents = events.filter((e) =>
      ['first_recipe_generated', 'photo_scan_used', 'meal_plan_generated'].includes(e.eventName),
    ).length;
    return {
      totalUsers,
      basicUsers,
      premiumUsers,
      activeSubs,
      canceledSubs,
      mrrBrl,
      conversionPct,
      aiErrors,
      aiUsageEvents,
    };
  }, [users, events, entitlements, config.premiumPriceBrl]);

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

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${label} copiada para a área de transferência.`);
    } catch {
      setFeedback(`${label}: ${value}`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setFeedback('');
    try {
      await saveAppConfig({
        freeMaxIngredients: Number(draftConfig.freeMaxIngredients) || 30,
        freeWeeklyRecipes: Number(draftConfig.freeWeeklyRecipes) || 12,
        freeHistoryLimit: Number(draftConfig.freeHistoryLimit) || 15,
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

  const handleGrantByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim() || !grantEmail.includes('@')) {
      setError('Informe um e-mail de comprador válido.');
      return;
    }
    setGranting(true);
    setError('');
    setFeedback('');
    try {
      await adminUpsertEntitlementByEmail({
        email: grantEmail,
        buyerName: grantName,
        plan: grantPlan,
        status: 'active',
        provider: grantTransaction.trim() ? 'hotmart' : 'admin',
        hotmartTransaction: grantTransaction,
      });
      setFeedback(
        `Acesso ${grantPlan === 'premium' ? 'PREMIUM' : 'BÁSICO'} liberado para ${grantEmail.trim().toLowerCase()}.`,
      );
      setGrantEmail('');
      setGrantName('');
      setGrantTransaction('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao liberar acesso.');
    } finally {
      setGranting(false);
    }
  };

  const handleSyncWebhookToFirestore = async (rec: HotmartWebhookRecordView) => {
    setError('');
    try {
      await adminUpsertEntitlementByEmail({
        email: rec.email,
        buyerName: rec.buyerName,
        plan: rec.plan,
        status: rec.status,
        provider: 'hotmart',
        hotmartOfferCode: rec.offerCode,
        hotmartTransaction: rec.transaction,
      });
      setFeedback(`Assinatura de ${rec.email} salva permanentemente no banco de dados.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar assinatura.');
    }
  };

  const handleToggleEntitlementStatus = async (ent: SubscriptionEntitlement) => {
    const nextStatus = ent.status === 'active' ? 'canceled' : 'active';
    await adminUpsertEntitlementByEmail({
      email: ent.email,
      buyerName: ent.buyerName,
      plan: ent.plan,
      status: nextStatus,
      provider: ent.provider,
      hotmartOfferCode: ent.hotmartOfferCode,
      hotmartTransaction: ent.hotmartTransaction,
    });
    setFeedback(
      `Acesso de ${ent.email} alterado para ${nextStatus === 'active' ? 'ATIVO' : 'CANCELADO'}.`,
    );
    await loadData();
  };

  const handleSwitchEntitlementPlan = async (ent: SubscriptionEntitlement) => {
    const nextPlan: PlanType = ent.plan === 'premium' ? 'free' : 'premium';
    await adminUpsertEntitlementByEmail({
      email: ent.email,
      buyerName: ent.buyerName,
      plan: nextPlan,
      status: ent.status,
      provider: ent.provider,
      hotmartTransaction: ent.hotmartTransaction,
    });
    setFeedback(
      `Plano de ${ent.email} alterado para ${nextPlan === 'premium' ? 'PREMIUM' : 'BÁSICO'}.`,
    );
    await loadData();
  };

  const handleRemoveEntitlement = async (ent: SubscriptionEntitlement) => {
    await adminDeleteEntitlement(ent.id);
    setFeedback(`Registro de acesso de ${ent.email} removido.`);
    await loadData();
  };

  const handleSetUserSubscription = async (
    user: UserProfile,
    plan: PlanType,
    status: UserProfile['subscriptionStatus'],
  ) => {
    await adminUpdateUserPlan(
      user.uid,
      plan,
      status,
      status === 'active' ? 'hotmart' : 'none',
    );
    setFeedback(
      `Conta ${user.email} atualizada: ${plan === 'premium' ? 'PREMIUM' : 'BÁSICO'} (${status}).`,
    );
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

      {/* Business KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Contas cadastradas</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.totalUsers}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5 tabular-nums">
            Básico: {stats.basicUsers} · Premium: {stats.premiumUsers}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">MRR estimado</p>
          <p className="font-mono text-2xl font-bold text-[#173D32] tabular-nums mt-1">
            {formatBrl(stats.mrrBrl)}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            {stats.activeSubs} assinatura(s) ativa(s)
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Mix Premium</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.conversionPct}%
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            Cancelados: {stats.canceledSubs}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Eventos do Chef</p>
          <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-1">
            {stats.aiUsageEvents}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">
            Total eventos: {events.length}
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-4">
          <p className="text-xs text-[#52635B]">Erros registrados</p>
          <p className="font-mono text-2xl font-bold text-red-700 tabular-nums mt-1">
            {stats.aiErrors.length}
          </p>
          <p className="text-[11px] text-[#52635B] mt-0.5">Últimos 400 eventos</p>
        </div>
      </div>

      {/* Hotmart Integration & Email Access Provisioning */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-[#111B17] inline-flex items-center gap-2">
              <Webhook className="w-4 h-4 text-[#173D32]" />
              <span>Integração Hotmart</span>
            </h2>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                paymentConfig?.hotmartWebhookConfigured
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {paymentConfig?.hotmartWebhookConfigured ? 'Hottok ativo' : 'Configurar Hottok'}
            </span>
          </div>

          <p className="text-xs text-[#52635B] leading-relaxed">
            Configure estas duas URLs no seu produto da Hotmart (<strong>H108637126O</strong>) para
            que os compradores entrem com o mesmo e-mail da compra e tenham o plano liberado
            automaticamente.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#32433C] mb-1">
                1. URL do Webhook na Hotmart (Ferramentas → Webhook)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-3 py-2 font-mono text-[11px] rounded-xl border border-[#DCE4DF] bg-[#F5F7F5]"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy(webhookUrl, 'URL do Webhook')}
                  className="p-2 rounded-xl border border-[#DCE4DF] hover:bg-[#F5F7F5] text-[#173D32]"
                  title="Copiar URL do Webhook"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-[#52635B] mt-1">
                Oferta <code className="font-mono">726sm43a</code> = Básico (R$ 19) · Oferta{' '}
                <code className="font-mono">cq053m7c</code> = Premium (R$ 37)
              </p>
            </div>

            <div>
              <label className="block font-semibold text-[#32433C] mb-1">
                2. Link pós-compra / Área externa (Página de obrigado)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={postPurchaseUrl}
                  className="flex-1 px-3 py-2 font-mono text-[11px] rounded-xl border border-[#DCE4DF] bg-[#F5F7F5]"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy(postPurchaseUrl, 'Link pós-compra')}
                  className="p-2 rounded-xl border border-[#DCE4DF] hover:bg-[#F5F7F5] text-[#173D32]"
                  title="Copiar link pós-compra"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F7F5] border border-[#E5ECE8] text-[11px] text-[#455750] space-y-1">
              <p>
                <strong>Webhook (HOTMART_HOTTOK):</strong>{' '}
                {paymentConfig?.hotmartWebhookConfigured ? 'Configurado' : 'Pendente no ambiente'}
              </p>
              <p>
                <strong>Consulta API Hotmart (opcional):</strong>{' '}
                {paymentConfig?.hotmartApiConfigured ? 'Ativa em tempo real' : 'Desativada'}
              </p>
            </div>
          </div>
        </div>

        {/* Grant Access By Email Form */}
        <form
          onSubmit={handleGrantByEmail}
          className="lg:col-span-7 bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-[#111B17] inline-flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#173D32]" />
              <span>Liberar acesso por e-mail (Hotmart / Manual)</span>
            </h2>
            <p className="text-xs text-[#52635B] mt-1">
              Libere ou atualize o plano de qualquer comprador antes mesmo de ele criar a conta.
              Assim que entrar com esse e-mail, o acesso abre automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                E-mail do comprador *
              </label>
              <input
                type="email"
                required
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="comprador@email.com.br"
                className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">Nome (opcional)</label>
              <input
                type="text"
                value={grantName}
                onChange={(e) => setGrantName(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4DF]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">Plano liberado</label>
              <select
                value={grantPlan}
                onChange={(e) => setGrantPlan(e.target.value as PlanType)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4DF] bg-white"
              >
                <option value="free">NUTRIX Básico (R$ 19,00/mês)</option>
                <option value="premium">NUTRIX Premium (R$ 37,00/mês)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#32433C] mb-1">
                Código transação Hotmart (opcional)
              </label>
              <input
                type="text"
                value={grantTransaction}
                onChange={(e) => setGrantTransaction(e.target.value)}
                placeholder="Ex.: HP1234567890"
                className="w-full px-3 py-2.5 font-mono rounded-xl border border-[#DCE4DF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={granting}
            className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Plus className="w-4 h-4 text-[#C3F28B]" />
            <span>{granting ? 'Liberando...' : 'Liberar acesso agora'}</span>
          </button>

          {/* Live Webhook Arrivals (if any) */}
          {webhookRecords.length > 0 && (
            <div className="pt-3 border-t border-[#E5ECE8] space-y-2">
              <p className="text-xs font-semibold text-[#173D32]">
                Eventos recentes recebidos via Webhook Hotmart ({webhookRecords.length})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {webhookRecords.map((rec) => {
                  const alreadySaved = entitlements.some(
                    (e) => e.email === rec.email && e.status === rec.status && e.plan === rec.plan,
                  );
                  return (
                    <div
                      key={`${rec.email}_${rec.updatedAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F5F7F5] text-[11px]"
                    >
                      <div>
                        <span className="font-semibold text-[#111B17]">{rec.email}</span>
                        <span className="text-[#52635B] ml-2">
                          {rec.plan === 'premium' ? 'PREMIUM' : 'BÁSICO'} · {rec.status} ·{' '}
                          {rec.lastEvent}
                        </span>
                      </div>
                      {alreadySaved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Salvo</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSyncWebhookToFirestore(rec)}
                          className="px-2.5 py-1 rounded-lg bg-[#173D32] text-white font-semibold"
                        >
                          Salvar permanente
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Firestore Entitlements Table */}
      <div className="bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[#E5ECE8]">
          <h2 className="font-display text-lg font-semibold text-[#111B17]">
            Acessos liberados por e-mail ({entitlements.length})
          </h2>
          <p className="text-xs text-[#52635B] mt-0.5">
            Registros permanentes no banco de dados. Qualquer cliente listado como ativo entra
            direto no NUTRIX com o plano correspondente.
          </p>
        </div>
        {entitlements.length === 0 ? (
          <div className="p-6 text-xs text-[#52635B]">
            Nenhum acesso cadastrado manualmente ainda. Use o formulário acima ou aguarde compras
            aprovadas pelo webhook da Hotmart.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F7F5] text-[#52635B] border-b border-[#E5ECE8]">
                  <th className="py-3 px-4">Comprador</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Origem / Transação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5ECE8]">
                {entitlements.map((ent) => (
                  <tr key={ent.id} className="hover:bg-[#F5F7F5]/50">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#111B17]">{ent.email}</p>
                      {ent.buyerName && <p className="text-[#52635B]">{ent.buyerName}</p>}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#173D32]">
                      {ent.plan === 'premium' ? 'PREMIUM' : 'BÁSICO'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          ent.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {ent.status === 'active'
                          ? 'Ativo'
                          : ent.status === 'refunded'
                            ? 'Reembolsado'
                            : 'Cancelado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#52635B] font-mono text-[11px]">
                      {ent.provider}
                      {ent.hotmartTransaction ? ` · ${ent.hotmartTransaction}` : ''}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleSwitchEntitlementPlan(ent)}
                          className="px-2.5 py-1 rounded-lg border border-[#DCE4DF] text-[#173D32] font-medium hover:bg-[#F5F7F5]"
                        >
                          {ent.plan === 'premium' ? 'Mudar p/ Básico' : 'Mudar p/ Premium'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleEntitlementStatus(ent)}
                          className="px-2.5 py-1 rounded-lg border border-[#DCE4DF] text-[#111B17] font-medium hover:bg-[#F5F7F5]"
                        >
                          {ent.status === 'active' ? 'Revogar' : 'Reativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveEntitlement(ent)}
                          aria-label="Remover acesso"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                Teto técnico diário
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
              <span>Habilitar Planejador Semanal</span>
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

      {/* Registered Users Table */}
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
                <th className="py-3 px-4 text-right">Controle de acesso</th>
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
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSetUserSubscription(u, 'free', 'active')}
                        className="px-2.5 py-1 rounded-lg border border-[#DCE4DF] text-[#173D32] font-medium hover:bg-[#F5F7F5]"
                      >
                        Ativar Básico
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetUserSubscription(u, 'premium', 'active')}
                        className="px-2.5 py-1 rounded-lg bg-[#173D32] text-white font-medium hover:bg-[#0F2B23]"
                      >
                        Ativar Premium
                      </button>
                      {u.subscriptionStatus === 'active' && (
                        <button
                          type="button"
                          onClick={() => void handleSetUserSubscription(u, u.plan, 'canceled')}
                          className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50"
                        >
                          Suspender
                        </button>
                      )}
                    </div>
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
            Erros recentes registrados
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
