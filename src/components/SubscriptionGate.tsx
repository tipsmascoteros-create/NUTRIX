import { ArrowRight, Check, Crown, Lock, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  buildHotmartCheckoutUrl,
  trackPlanCheckoutClick,
} from '../lib/checkoutLinks.ts';
import type { LegalTab } from './LegalModal.tsx';
import type { UserProfile } from '../types/nutrix.ts';

interface SubscriptionGateProps {
  profile: UserProfile;
  checking: boolean;
  statusMessage?: string;
  wasRevoked?: boolean;
  onRecheckAccess: () => Promise<void>;
  onLogout: () => void;
  onOpenLegal: (tab: LegalTab) => void;
}

export function SubscriptionGate({
  profile,
  checking,
  statusMessage,
  wasRevoked = false,
  onRecheckAccess,
  onLogout,
  onOpenLegal,
}: SubscriptionGateProps) {
  const buyer = { email: profile.email, name: profile.displayName };

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#111B17] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#173D32] text-white px-4 sm:px-8 h-16 flex items-center justify-between">
        <div>
          <span className="font-display text-xl font-bold tracking-tight">NUTRIX</span>
          <span className="hidden sm:inline text-xs text-[#C3F28B] ml-3">
            Sua alimentação, mais inteligente.
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden md:inline text-white/80 truncate max-w-[220px]">
            {profile.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Trocar conta</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Status Banner */}
        <div className="bg-white border border-[#DCE4DF] rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#173D32]/10 text-[#173D32] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2 max-w-2xl mx-auto">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17]">
              {wasRevoked
                ? 'Sua assinatura NUTRIX não está ativa no momento'
                : 'Ative sua assinatura para acessar o NUTRIX'}
            </h1>
            <p className="text-sm sm:text-base text-[#455750] leading-relaxed">
              Não encontramos uma assinatura ativa vinculada ao e-mail{' '}
              <strong className="text-[#111B17]">{profile.email}</strong>. Escolha seu plano abaixo
              para liberar o acesso imediato pela Hotmart.
            </p>
          </div>

          {/* Already Bought Check */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => void onRecheckAccess()}
              className="px-5 py-3 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors inline-flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 text-[#C3F28B] ${checking ? 'animate-spin' : ''}`} />
              <span>
                {checking
                  ? 'Verificando assinatura...'
                  : 'Já realizei o pagamento na Hotmart — Verificar acesso'}
              </span>
            </button>
          </div>

          {statusMessage && (
            <p className="text-xs text-[#455750] bg-[#F5F7F5] border border-[#DCE4DF] rounded-xl px-4 py-2.5 max-w-xl mx-auto">
              {statusMessage}
            </p>
          )}

          <p className="text-xs text-[#52635B] max-w-xl mx-auto">
            Importante: utilize no NUTRIX o <strong>mesmo e-mail informado na Hotmart</strong> para
            que sua assinatura seja reconhecida automaticamente. Se comprou com outro e-mail, clique
            em <strong>Trocar conta</strong> no canto superior direito.
          </p>
        </div>

        {/* Plans Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* NUTRIX BÁSICO */}
          <div className="bg-white border border-[#DCE4DF] rounded-3xl p-7 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-5 border-b border-[#E5ECE8]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#52635B]">
                    Plano Essencial
                  </p>
                  <h2 className="font-display text-2xl font-bold text-[#111B17] mt-1">
                    NUTRIX Básico
                  </h2>
                </div>
                <div className="text-right whitespace-nowrap shrink-0">
                  <span className="font-mono text-2xl sm:text-3xl font-bold text-[#111B17] tabular-nums whitespace-nowrap">
                    R$&nbsp;19,00
                  </span>
                  <span className="text-xs text-[#52635B] whitespace-nowrap"> /mês</span>
                </div>
              </div>

              <p className="text-sm text-[#455750] mt-4">
                Ideal para organizar sua rotina na cozinha, controlar até 30 ingredientes e cozinhar
                melhor todos os dias gastando pouco.
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-[#32433C]">
                {[
                  'Até 30 ingredientes ativos na despensa',
                  'Até 12 receitas personalizadas por semana com o Chef',
                  'Calorias, proteínas, carboidratos, gorduras e fibras',
                  'Ajuste dinâmico de porções e receitas favoritas',
                  'Histórico das últimas 15 receitas preparadas',
                  'Lista de compras integrada às suas receitas',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#173D32] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={buildHotmartCheckoutUrl('basic', buyer)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPlanCheckoutClick('basic')}
              className="mt-7 w-full py-3.5 px-5 rounded-xl border-2 border-[#173D32] text-[#173D32] font-semibold text-sm hover:bg-[#173D32] hover:text-white transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>Assinar NUTRIX Básico — R$&nbsp;19,00/mês</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* NUTRIX PREMIUM */}
          <div className="bg-[#173D32] text-white rounded-3xl p-7 flex flex-col justify-between border border-[#173D32]">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-5 border-b border-white/15">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#C3F28B] inline-flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Mais escolhido</span>
                  </p>
                  <h2 className="font-display text-2xl font-bold text-white mt-1">
                    NUTRIX Premium
                  </h2>
                </div>
                <div className="text-right whitespace-nowrap shrink-0">
                  <span className="font-mono text-2xl sm:text-3xl font-bold text-[#C3F28B] tabular-nums whitespace-nowrap">
                    R$&nbsp;37,00
                  </span>
                  <span className="text-xs text-white/75 whitespace-nowrap"> /mês</span>
                </div>
              </div>

              <p className="text-sm text-white/85 mt-4">
                A experiência completa para economizar nas compras, zerar o desperdício e planejar a
                semana inteira sem esforço.
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-white/95">
                {[
                  'Despensa e geladeira ilimitadas com alertas de validade',
                  'Reconhecimento de ingredientes por fotografia da geladeira',
                  'Geração ampliada de receitas no Chef + histórico ilimitado',
                  'Análise nutricional completa com micronutrientes',
                  'Planejador semanal automático + lista descontando a despensa',
                  'Custo por porção, substituições econômicas e painel Zero Desperdício',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#C3F28B] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={buildHotmartCheckoutUrl('premium', buyer)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPlanCheckoutClick('premium')}
              className="mt-7 w-full py-3.5 px-5 rounded-xl bg-[#C3F28B] text-[#173D32] font-bold text-sm hover:bg-[#b5e976] transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>Desbloquear NUTRIX Premium — R$&nbsp;37,00/mês</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Trust Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-[#52635B]">
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#173D32]" />
            <span>Pagamento 100% seguro processado pela Hotmart · Sem fidelidade</span>
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenLegal('termos')}
              className="hover:text-[#173D32] underline"
            >
              Termos de Uso
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacidade')}
              className="hover:text-[#173D32] underline"
            >
              Privacidade (LGPD)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
