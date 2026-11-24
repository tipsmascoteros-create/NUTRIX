import { X } from 'lucide-react';

export type LegalTab = 'privacidade' | 'termos' | 'contato';

interface LegalModalProps {
  tab: LegalTab | null;
  onClose: () => void;
  onChangeTab: (tab: LegalTab) => void;
}

export function LegalModal({ tab, onClose, onChangeTab }: LegalModalProps) {
  if (!tab) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Informações legais e privacidade NUTRIX"
    >
      <div className="bg-white border border-[#DCE4DF] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5ECE8]">
          <div className="flex items-center gap-1 bg-[#F5F7F5] p-1 rounded-xl">
            {(
              [
                ['privacidade', 'Política de Privacidade (LGPD)'],
                ['termos', 'Termos de Uso'],
                ['contato', 'Contato'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === key
                    ? 'bg-white text-[#173D32] shadow-xs'
                    : 'text-[#52635B] hover:text-[#111B17]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-[#52635B] hover:text-[#111B17] hover:bg-[#F5F7F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto text-sm text-[#32433C] leading-relaxed space-y-4">
          {tab === 'privacidade' && (
            <>
              <h3 className="font-display text-xl font-semibold text-[#111B17]">
                Política de Privacidade e Proteção de Dados (LGPD)
              </h3>
              <p>
                O <strong>NUTRIX</strong> trata seus dados pessoais em conformidade com a Lei Geral de
                Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD). Coletamos apenas os dados
                estritamente necessários para autenticação, personalização de receitas, cálculo
                nutricional e organização da sua despensa.
              </p>
              <h4 className="font-semibold text-[#111B17]">1. Proteção Especial de Dados Sensíveis</h4>
              <p>
                Informações relacionadas à saúde, alergias, restrições alimentares, peso e altura são
                tratadas como dados pessoais sensíveis (Art. 11 da LGPD), armazenadas com isolamento
                estrito por conta autenticada e nunca compartilhadas com terceiros para fins
                publicitários.
              </p>
              <h4 className="font-semibold text-[#111B17]">2. Pagamentos e Dados Financeiros</h4>
              <p>
                O NUTRIX <strong>não armazena dados completos de cartões de crédito</strong>. Todas as
                assinaturas recorrentes são processadas diretamente por gateways certificados (Stripe
                ou Mercado Pago) via criptografia de ponta a ponta.
              </p>
              <h4 className="font-semibold text-[#111B17]">3. Seus Direitos como Titular</h4>
              <p>
                A qualquer momento, na aba <strong>Conta e Privacidade</strong>, você pode consultar,
                editar, exportar todos os seus dados em formato JSON estruturado, revogar consentimento
                de analytics ou excluir permanentemente sua conta e histórico completo.
              </p>
            </>
          )}

          {tab === 'termos' && (
            <>
              <h3 className="font-display text-xl font-semibold text-[#111B17]">
                Termos de Uso do NUTRIX
              </h3>
              <p>
                Ao utilizar o NUTRIX, você concorda com as condições de uso da plataforma de
                inteligência alimentar e organização doméstica.
              </p>
              <h4 className="font-semibold text-[#111B17]">1. Aviso Nutricional e Segurança Alimentar</h4>
              <p>
                O NUTRIX é uma ferramenta de organização culinária e estimativa nutricional baseada em
                referências nutricionais de alimentos brasileiros. O aplicativo{' '}
                <strong>não realiza diagnósticos médicos</strong>, não substitui consulta com
                nutricionista ou médico e não promete resultados clínicos ou de emagrecimento.
                Sempre verifique o aspecto, cheiro e conservação dos alimentos antes do consumo,
                independentemente da data de validade cadastrada.
              </p>
              <h4 className="font-semibold text-[#111B17]">2. Planos Básico e Premium</h4>
              <p>
                O plano <strong>NUTRIX Básico (R$ 19,00/mês)</strong> oferece assinatura mensal acessível
                com até 30 ingredientes ativos na despensa, 12 receitas por semana no Chef, lista de
                compras integrada e histórico das últimas 15 receitas. O plano{' '}
                <strong>NUTRIX Premium (R$ 37,00/mês)</strong> libera recursos ilimitados, reconhecimento
                por fotografia, alertas de validade, planejador semanal automático, economia inteligente
                e painel Zero Desperdício. Ambos os planos são recorrentes, podem ser cancelados a
                qualquer momento sem multa e são ativados exclusivamente mediante confirmação segura do
                provedor de pagamentos.
              </p>
            </>
          )}

          {tab === 'contato' && (
            <>
              <h3 className="font-display text-xl font-semibold text-[#111B17]">
                Atendimento e Encarregado de Dados (DPO)
              </h3>
              <p>
                Precisa de suporte com sua conta, assinatura Premium ou solicitações relacionadas à
                LGPD? Nossa equipe atende usuários em todo o Brasil.
              </p>
              <div className="bg-[#F5F7F5] border border-[#DCE4DF] rounded-xl p-4 space-y-2 text-sm">
                <p>
                  <strong>Suporte comercial e técnico:</strong> suporte@nutrix.com.br
                </p>
                <p>
                  <strong>Privacidade e LGPD (DPO):</strong> privacidade@nutrix.com.br
                </p>
                <p>
                  <strong>Operação:</strong> NUTRIX Tecnologia Alimentar Ltda. — Brasil
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
