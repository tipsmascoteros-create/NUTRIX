import { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, ShieldCheck, X } from 'lucide-react';
import {
  buildHotmartCheckoutUrl,
  trackPlanCheckoutClick,
  type CheckoutPlan,
} from '../lib/checkoutLinks.ts';
import { logAnalyticsEvent } from '../lib/nutrixService.ts';
import type { UserProfile } from '../types/nutrix.ts';

interface UpgradeModalProps {
  open: boolean;
  reason?: string;
  initialPlan?: CheckoutPlan;
  profile: UserProfile | null;
  basicPriceBrl?: number;
  priceBrl?: number;
  onClose: () => void;
}

const BASIC_HIGHLIGHTS = [
  'Perfil alimentar completo com alergias, restrições e orçamento',
  'Até 30 ingredientes ativos organizados na sua despensa',
  'Até 12 receitas personalizadas por semana no Chef',
  'Calorias, proteínas, carboidratos, gorduras e fibras por porção',
  'Ajuste dinâmico de porções, favoritos e lista de ingredientes',
  'Lista de compras integrada e histórico das últimas 15 receitas',
];

const PREMIUM_HIGHLIGHTS = [
  'Despensa e geladeira ilimitadas com alertas de vencimento',
  'Reconhecimento de ingredientes por fotografia com confirmação',
  'Geração ampliada de receitas no Chef adaptadas ao seu perfil',
  'Análise nutricional completa com micronutrientes e histórico ilimitado',
  'Planejador semanal automático (café, almoço, lanche e jantar)',
  'Lista de compras inteligente descontando o que você já tem em casa',
  'Controle de orçamento alimentar, custo por porção e substituições econômicas',
  'Painel Zero Desperdício e memória adaptativa de preferências',
];

export function UpgradeModal({
  open,
  reason,
  initialPlan = 'premium',
  profile,
  basicPriceBrl = 19,
  priceBrl = 37,
  onClose,
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>(initialPlan);

  useEffect(() => {
    if (!open) return;
    setSelectedPlan(initialPlan);
  }, [open, initialPlan]);

  if (!open) return null;

  const isPremiumSelected = selectedPlan === 'premium';
  const activePrice = isPremiumSelected ? priceBrl : basicPriceBrl;
  const activeHighlights = isPremiumSelected ? PREMIUM_HIGHLIGHTS : BASIC_HIGHLIGHTS;
  const checkoutHref = buildHotmartCheckoutUrl(selectedPlan, {
    email: profile?.email,
    name: profile?.displayName,
  });

  const handleCheckoutClick = () => {
    trackPlanCheckoutClick(selectedPlan);
    if (profile) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'checkout_started',
        plan: profile.plan,
        metadata: `provider:hotmart;target:${selectedPlan};reason:${reason || 'upgrade_modal'}`,
        analyticsConsent: profile.analyticsConsent,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Escolher assinatura NUTRIX"
    >
      <div className="bg-white border border-[#DCE4DF] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-[#173D32] text-white p-6 sm:p-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-5 right-5 p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Plan Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-white/10 border border-white/15 mb-4">
            <button
              type="button"
              onClick={() => setSelectedPlan('basic')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedPlan === 'basic'
                  ? 'bg-[#C3F28B] text-[#173D32]'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              NUTRIX Básico · R$&nbsp;{basicPriceBrl},00/mês
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan('premium')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedPlan === 'premium'
                  ? 'bg-[#C3F28B] text-[#173D32]'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              NUTRIX Premium · R$&nbsp;{priceBrl},00/mês
            </button>
          </div>

          <p className="text-xs font-medium text-[#C3F28B] mb-1.5">
            {isPremiumSelected
              ? 'NUTRIX Premium · Mais escolhido · Assinatura recorrente mensal'
              : 'NUTRIX Básico · Essencial para o dia a dia · Menos de R$ 0,65/dia'}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-balance">
            {isPremiumSelected
              ? 'Organize sua alimentação e economize todos os meses'
              : 'Comece com praticidade gastando pouco por mês'}
          </h2>
          {reason && (
            <p className="text-sm text-white/85 mt-2 leading-relaxed">{reason}</p>
          )}
          <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-4xl font-bold tabular-nums text-[#C3F28B] whitespace-nowrap shrink-0">
              R$&nbsp;{activePrice.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-sm text-white/80">/ mês · cancele quando quiser</span>
          </div>
          {!isPremiumSelected && (
            <p className="text-xs text-[#C3F28B]/90 mt-2">
              Por apenas R$ {(priceBrl - basicPriceBrl).toFixed(2).replace('.', ',')} a mais por mês
              no Premium, você libera foto da geladeira, despensa ilimitada e planejador semanal.
            </p>
          )}
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeHighlights.map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm text-[#24342D]">
                <Check className="w-4 h-4 text-[#173D32] shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E5ECE8] pt-5 space-y-3.5">
            <a
              href={checkoutHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCheckoutClick}
              className="w-full py-3.5 px-5 rounded-xl bg-[#173D32] text-white font-semibold text-sm sm:text-base hover:bg-[#0F2B23] transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap"
            >
              <CreditCard className="w-4 h-4 text-[#C3F28B]" />
              <span>
                {isPremiumSelected
                  ? `Assinar NUTRIX Premium — R$ ${priceBrl},00/mês`
                  : `Assinar NUTRIX Básico — R$ ${basicPriceBrl},00/mês`}
              </span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>

            <div className="flex items-center gap-2 text-xs text-[#52635B]">
              <ShieldCheck className="w-4 h-4 text-[#173D32] shrink-0" />
              <span>
                Pagamento recorrente seguro via Hotmart (Cartão ou Pix). Nenhum dado de cartão é
                armazenado no NUTRIX e você pode cancelar quando quiser.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
