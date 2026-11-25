import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Minus, Plus } from 'lucide-react';
import { calculateRecipeNutrition } from '../data/tacoDatabase.ts';
import {
  HOTMART_CHECKOUT_URLS,
  trackPlanCheckoutClick,
} from '../lib/checkoutLinks.ts';
import { formatBrl } from '../lib/formatters.ts';
import { AppShowcaseCarousel } from './AppShowcaseCarousel.tsx';
import { FoodImage } from './FoodImage.tsx';
import type { LegalTab } from './LegalModal.tsx';
import type { RecipeIngredient } from '../types/nutrix.ts';

interface LandingPageProps {
  onStartBasic: () => void;
  onStartPremium: () => void;
  onOpenLogin: () => void;
  onOpenLegal: (tab: LegalTab) => void;
}

const DEMO_BASE_INGREDIENTS: RecipeIngredient[] = [
  { name: 'Peito de frango sem pele', quantity: 300, unit: 'g', gramsEstimate: 300, inPantry: true, estimatedCostBrl: 8.4, priceSource: 'user', tacoMatched: true },
  { name: 'Arroz branco tipo 1 (cozido)', quantity: 240, unit: 'g', gramsEstimate: 240, inPantry: true, estimatedCostBrl: 1.6, priceSource: 'user', tacoMatched: true },
  { name: 'Ovo de galinha inteiro', quantity: 2, unit: 'un', gramsEstimate: 100, inPantry: true, estimatedCostBrl: 2.1, priceSource: 'user', tacoMatched: true },
  { name: 'Tomate cru', quantity: 2, unit: 'un', gramsEstimate: 200, inPantry: true, estimatedCostBrl: 1.8, priceSource: 'user', tacoMatched: true },
  { name: 'Cenoura crua', quantity: 1, unit: 'un', gramsEstimate: 100, inPantry: true, estimatedCostBrl: 0.85, priceSource: 'user', tacoMatched: true },
  { name: 'Azeite de oliva extra virgem', quantity: 1, unit: 'colher', gramsEstimate: 13, inPantry: true, estimatedCostBrl: 0.75, priceSource: 'user', tacoMatched: true },
];

const PROBLEMS = [
  'Abre a geladeira no fim do dia e não faz ideia do que preparar com o que tem.',
  'Compra verduras, frutas e proteínas que acabam estragando e indo para o lixo.',
  'Não consegue enxergar quanto realmente gasta por semana e por refeição.',
  'Quer se alimentar melhor na rotina, mas trava na falta de tempo e organização.',
  'Tem dificuldade para equilibrar proteínas, carboidratos e calorias sem planilhas.',
  'Perde minutos preciosos todos os dias decidindo o almoço e o jantar.',
];

const DIFFERENTIATORS = [
  {
    num: '01.',
    title: 'Receitas inteligentes',
    desc: 'Sugestões reais a partir dos ingredientes da sua casa, respeitando tempo, restrições e alergias.',
  },
  {
    num: '02.',
    title: 'Reconhecimento por fotografia',
    desc: 'Fotografe sua geladeira ou bancada e confirme os alimentos detectados antes de cadastrar na despensa.',
  },
  {
    num: '03.',
    title: 'Análise nutricional completa',
    desc: 'Calorias, proteínas, carboidratos, gorduras, fibras, sódio e micronutrientes calculados por peso real.',
  },
  {
    num: '04.',
    title: 'Economia alimentar de verdade',
    desc: 'Acompanhe seu orçamento semanal em reais, custo por porção e substituições econômicas sem preços inventados.',
  },
  {
    num: '05.',
    title: 'Gestão completa da despensa',
    desc: 'Controle quantidades, unidades brasileiras, local de armazenamento e alertas de estoque baixo.',
  },
  {
    num: '06.',
    title: 'Sistema Zero Desperdício',
    desc: 'Priorize alimentos próximos do vencimento com receitas de aproveitamento e dicas de conservação.',
  },
  {
    num: '07.',
    title: 'Planejamento alimentar semanal',
    desc: 'Organize café da manhã, almoço, lanche e jantar da semana inteira em minutos.',
  },
  {
    num: '08.',
    title: 'Lista de compras inteligente',
    desc: 'Gerada automaticamente a partir do seu cardápio, descontando tudo o que já existe na despensa.',
  },
  {
    num: '09.',
    title: 'Memória adaptativa',
    desc: 'Aprende seus pratos favoritos, tempo médio de preparo e ingredientes preferidos com transparência total.',
  },
];

const FAQS = [
  {
    q: 'O que é o NUTRIX?',
    a: 'O NUTRIX é uma plataforma brasileira de organização alimentar que reúne gestão de despensa, Chef pessoal, cálculo nutricional detalhado, controle de orçamento, zero desperdício e planejamento semanal em um só lugar.',
  },
  {
    q: 'Como funcionam as sugestões de receitas e cardápios?',
    a: 'O NUTRIX analisa os alimentos disponíveis na sua casa, suas preferências, alergias e tempo disponível para criar receitas e cardápios práticos. Já os valores nutricionais são calculados de forma precisa a partir da nossa base nutricional brasileira, informando claramente quando houver estimativa.',
  },
  {
    q: 'Qual plano devo escolher para começar?',
    a: 'O NUTRIX Básico (R$ 19,00/mês) já entrega tudo o que você precisa para organizar até 30 ingredientes na despensa, gerar até 12 receitas por semana, acompanhar calorias, macros e fibras e montar sua lista de compras gastando menos de R$ 0,65 por dia. Se você quer automação completa com foto da geladeira, alertas de validade e planejamento semanal automático, o NUTRIX Premium (R$ 37,00/mês) é a melhor escolha.',
  },
  {
    q: 'Qual a diferença entre Básico e Premium?',
    a: 'O plano Básico (R$ 19,00/mês) cobre a rotina essencial com 30 ingredientes ativos, 12 receitas semanais e histórico das últimas 15 receitas. O NUTRIX Premium (R$ 37,00/mês) libera despensa ilimitada, alertas de validade, reconhecimento por foto, geração ampliada de receitas, análise de micronutrientes, planejador semanal automático, lista de compras descontando a despensa, economia alimentar avançada e painel Zero Desperdício.',
  },
  {
    q: 'Posso cancelar minha assinatura?',
    a: 'Sim. A assinatura Premium é mensal e recorrente, sem fidelidade. Você pode solicitar o cancelamento a qualquer momento direto na área da sua conta.',
  },
  {
    q: 'As informações nutricionais são precisas?',
    a: 'Utilizamos uma base nutricional brasileira estruturada com valores proporcionais ao peso de cada ingrediente. Quando algum item não consta na base, sinalizamos claramente como estimativa e nunca inventamos nutrientes ausentes.',
  },
  {
    q: 'Posso utilizar pelo celular?',
    a: 'Sim. Toda a experiência do NUTRIX foi projetada para funcionar com fluidez no computador e no celular, incluindo uso da lista de compras direto no supermercado e envio de fotos pela câmera.',
  },
  {
    q: 'Como funciona o reconhecimento de ingredientes?',
    a: 'No plano Premium, você tira ou envia uma foto da geladeira, bancada ou despensa. O sistema lista os alimentos identificados com nível de confiança e sempre pede sua confirmação de itens e quantidades antes de salvar.',
  },
  {
    q: 'Meus dados estão protegidos?',
    a: 'Sim. Seguimos a LGPD (Lei nº 13.709/2018), isolando seus dados alimentares e de saúde por conta autenticada, sem armazenar números de cartão e oferecendo exportação completa e exclusão de conta a qualquer momento.',
  },
];

export function LandingPage({
  onStartBasic,
  onStartPremium,
  onOpenLogin,
  onOpenLegal,
}: LandingPageProps) {
  const [demoServings, setDemoServings] = useState(2);
  const [selectedDemoIngredients, setSelectedDemoIngredients] = useState<string[]>([
    'Peito de frango sem pele',
    'Arroz branco tipo 1 (cozido)',
    'Ovo de galinha inteiro',
    'Tomate cru',
    'Cenoura crua',
    'Azeite de oliva extra virgem',
  ]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeDemoItems = useMemo(
    () => DEMO_BASE_INGREDIENTS.filter((i) => selectedDemoIngredients.includes(i.name)),
    [selectedDemoIngredients],
  );

  const demoNutrition = useMemo(
    () => calculateRecipeNutrition(activeDemoItems, demoServings).perServing,
    [activeDemoItems, demoServings],
  );

  const demoTotalCost = useMemo(
    () => activeDemoItems.reduce((acc, i) => acc + i.estimatedCostBrl, 0),
    [activeDemoItems],
  );

  const toggleDemoIng = (name: string) => {
    setSelectedDemoIngredients((prev) =>
      prev.includes(name)
        ? prev.length > 1
          ? prev.filter((x) => x !== name)
          : prev
        : [...prev, name],
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#111B17]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#F5F7F5]/95 backdrop-blur-md border-b border-[#E1E8E4]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#inicio"
            className="font-display text-xl font-bold tracking-tight text-[#173D32] whitespace-nowrap shrink-0"
          >
            NUTRIX
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#32433C]">
            <a href="#como-funciona" className="hover:text-[#173D32] transition-colors whitespace-nowrap shrink-0">
              Como funciona
            </a>
            <a href="#recursos" className="hover:text-[#173D32] transition-colors whitespace-nowrap shrink-0">
              Recursos
            </a>
            <a href="#demonstracao" className="hover:text-[#173D32] transition-colors whitespace-nowrap shrink-0">
              Demonstração
            </a>
            <a href="#planos" className="hover:text-[#173D32] transition-colors whitespace-nowrap shrink-0">
              Planos
            </a>
            <a href="#duvidas" className="hover:text-[#173D32] transition-colors whitespace-nowrap shrink-0">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-sm font-semibold text-[#173D32] hover:underline whitespace-nowrap shrink-0"
            >
              Entrar
            </button>
            <a
              href="#planos"
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#173D32] text-white text-xs sm:text-sm font-semibold hover:bg-[#0F2B23] transition-colors whitespace-nowrap shrink-0"
            >
              Começar agora
            </a>
          </div>
        </div>
      </header>

      {/* SEÇÃO 1 — HERO */}
      <section id="inicio" className="max-w-7xl mx-auto px-5 sm:px-8 pt-5 pb-12 lg:pt-8 lg:pb-16">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <p className="text-sm font-medium text-[#173D32] mb-2.5">
            Sua alimentação, mais inteligente.
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-tight text-[#111B17] leading-[1.12] text-balance max-w-3xl">
            Descubra o que preparar, coma melhor e economize usando os ingredientes que você já tem
          </h1>
          <div className="mt-7 w-full max-w-3xl overflow-hidden rounded-2xl border border-[#DCE4DF] bg-white">
            <img
              src="https://i.postimg.cc/7hYYRmMH/Diseno-sin-titulo-2026-11-25T085727-460-(1).png"
              alt="Prévia do NUTRIX organizando sua alimentação, receitas e economia doméstica"
              referrerPolicy="no-referrer"
              loading="eager"
              className="w-full h-auto block"
            />
          </div>
          <p className="mt-7 text-base sm:text-lg text-[#455750] leading-relaxed max-w-2xl">
            Com o NUTRIX,{' '}
            <strong className="font-bold text-[#111B17]">
              você transforma os alimentos que já tem em casa em refeições equilibradas
            </strong>
            , acompanha informações nutricionais detalhadas, organiza suas compras e ganha
            praticidade e economia no dia a dia.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#planos"
              className="px-6 py-3.5 rounded-xl bg-[#173D32] text-white font-semibold text-sm sm:text-base hover:bg-[#0F2B23] transition-colors inline-flex items-center justify-center gap-2.5 whitespace-nowrap"
            >
              <span>VER PLANOS E COMEÇAR</span>
              <ArrowRight className="w-4 h-4 text-[#C3F28B]" />
            </a>
            <span className="text-xs text-[#52635B]">
              A partir de R$&nbsp;19,00/mês · Cancele quando quiser
            </span>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2 — IDENTIFICAÇÃO DO PROBLEMA */}
      <section className="bg-white border-y border-[#E1E8E4] py-10 lg:py-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#52635B] mb-1.5">O desafio na cozinha brasileira</p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111B17] text-balance">
              Você também passa por isso todos os dias?
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {PROBLEMS.map((problem, idx) => (
              <div key={problem} className="pt-3 border-t border-[#E1E8E4] flex items-baseline gap-3">
                <span className="font-mono text-xs font-semibold text-[#173D32] tabular-nums shrink-0">
                  0{idx + 1}
                </span>
                <p className="text-sm sm:text-[15px] text-[#1E2D27] leading-snug">{problem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 3 — APRESENTAÇÃO DA SOLUÇÃO */}
      <section id="recursos" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 lg:py-24">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-medium text-[#173D32] mb-2">Cinco pilares integrados</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#111B17] text-balance">
            Conheça o NUTRIX: sua cozinha trabalhando com inteligência.
          </h2>
          <p className="mt-3 text-base text-[#455750] leading-relaxed">
            Não é mais um aplicativo de receitas soltas. O NUTRIX conhece seus alimentos, seu
            orçamento e seus objetivos nutricionais para decidir junto com você.
          </p>
        </div>

        {/* Asymmetric Bento Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden flex flex-col">
            <FoodImage
              imageKey="pantry"
              alt="Geladeira organizada para reconhecimento inteligente de ingredientes"
              className="w-full h-64 sm:h-72 object-cover"
            />
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-xs text-[#52635B]">Despensa Inteligente · Zero Desperdício</p>
                <h3 className="font-display text-2xl font-semibold text-[#111B17] mt-1.5">
                  Controle o que tem em casa: manualmente ou por fotografia
                </h3>
                <p className="text-sm text-[#455750] mt-2 leading-relaxed">
                  Cadastre quantidades, preços pagos e validades. O NUTRIX destaca automaticamente o
                  que precisa ser consumido primeiro e sugere receitas antes que o alimento estrague.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#173D32] text-white rounded-2xl overflow-hidden flex flex-col justify-between">
            <FoodImage
              imageKey="frango"
              alt="Prato brasileiro equilibrado com frango, arroz com cenoura e brócolis"
              className="w-full h-56 object-cover"
            />
            <div className="p-6 sm:p-8">
              <p className="text-xs text-[#C3F28B]">Chef · Nutrição detalhada</p>
              <h3 className="font-display text-2xl font-semibold mt-1.5">
                Receitas prontas com calorias, macros e custo por porção
              </h3>
              <p className="text-sm text-white/80 mt-2 leading-relaxed">
                Filtre por até 15 minutos, alta proteína, econômicas, sem lactose, sem glúten ou
                aproveitamento de sobras — sempre respeitando suas alergias.
              </p>
            </div>
          </div>
        </div>

        {/* SEÇÃO 4 — DIFERENCIAIS (9 pilares em grid editorial) */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {DIFFERENTIATORS.map((item) => (
            <div key={item.num} className="space-y-2">
              <p className="font-mono text-xs text-[#173D32] font-semibold">{item.num}</p>
              <h3 className="font-display text-lg font-semibold text-[#111B17]">{item.title}</h3>
              <p className="text-sm text-[#455750] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 5 — COMO FUNCIONA */}
      <section id="como-funciona" className="bg-[#173D32] text-white py-16 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#C3F28B] mb-2">Simples desde o primeiro minuto</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
              Como o NUTRIX organiza sua rotina em três etapas
            </h2>
          </div>
        </div>

        {/* Carrossel horizontal responsivo com telas reais do NUTRIX por dentro */}
        <AppShowcaseCarousel />

        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Informe os alimentos que você tem',
                desc: 'Adicione manualmente com busca inteligente de ingredientes ou fotografe sua geladeira no Premium.',
              },
              {
                step: '02',
                title: 'Conte suas preferências e objetivos',
                desc: 'Informe alergias, restrições, orçamento semanal em reais e se deseja mais proteína, equilíbrio ou economia.',
              },
              {
                step: '03',
                title: 'Receba sugestões, planeje e economize',
                desc: 'Gere receitas personalizadas, monte o cardápio da semana e leve uma lista de compras enxuta ao supermercado.',
              },
            ].map((item) => (
              <div key={item.step} className="border-t border-white/20 pt-6">
                <span className="font-mono text-2xl font-semibold text-[#C3F28B] tabular-nums">
                  {item.step}
                </span>
                <h3 className="font-display text-xl font-semibold mt-3">{item.title}</h3>
                <p className="text-sm text-white/80 mt-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO 6 — DEMONSTRAÇÃO INTERATIVA REAL */}
      <section id="demonstracao" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 lg:py-24">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-medium text-[#173D32] mb-2">Simulação interativa em tempo real</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#111B17] text-balance">
            Veja o NUTRIX em ação com ingredientes comuns
          </h2>
          <p className="mt-3 text-base text-[#455750]">
            Ative ou desative ingredientes abaixo e ajuste as porções para ver o cálculo nutricional
            por porção e o custo proporcional baseado em valores de exemplo.
          </p>
        </div>

        <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div>
              <p className="text-xs font-medium text-[#52635B] mb-2.5">
                Ingredientes na sua cozinha (clique para alternar)
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_BASE_INGREDIENTS.map((ing) => {
                  const active = selectedDemoIngredients.includes(ing.name);
                  return (
                    <button
                      key={ing.name}
                      type="button"
                      onClick={() => toggleDemoIng(ing.name)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[#173D32] text-white border-[#173D32]'
                          : 'bg-[#F5F7F5] text-[#455750] border-[#DCE4DF] hover:border-[#173D32]'
                      }`}
                    >
                      {ing.name.split(' (')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E5ECE8]">
              <span className="text-sm font-medium text-[#111B17]">Porções da receita</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Diminuir porções"
                  onClick={() => setDemoServings((s) => Math.max(1, s - 1))}
                  className="w-8 h-8 rounded-lg border border-[#DCE4DF] flex items-center justify-center hover:bg-[#F5F7F5]"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-base font-semibold tabular-nums w-6 text-center">
                  {demoServings}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar porções"
                  onClick={() => setDemoServings((s) => Math.min(6, s + 1))}
                  className="w-8 h-8 rounded-lg border border-[#DCE4DF] flex items-center justify-center hover:bg-[#F5F7F5]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5ECE8]">
              <FoodImage
                imageKey="frango"
                alt="Exemplo de prato sugerido com frango, arroz, ovos, tomate e cenoura"
                className="w-full h-48 object-cover rounded-xl"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs text-[#52635B]">
                Receita sugerida · 25 min · Dificuldade Fácil · {demoServings} porção(ões)
              </p>
              <h3 className="font-display text-2xl font-semibold text-[#111B17] mt-1">
                Frango grelhado com arroz colorido de cenoura, ovos mexidos e vinagrete
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-[#E5ECE8]">
              <div>
                <p className="text-xs text-[#52635B]">Calorias / porção</p>
                <p className="font-mono text-2xl font-bold text-[#173D32] tabular-nums mt-0.5">
                  {demoNutrition.calories} kcal
                </p>
              </div>
              <div>
                <p className="text-xs text-[#52635B]">Proteínas</p>
                <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-0.5">
                  {demoNutrition.proteinG}g
                </p>
              </div>
              <div>
                <p className="text-xs text-[#52635B]">Carboidratos</p>
                <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-0.5">
                  {demoNutrition.carbsG}g
                </p>
              </div>
              <div>
                <p className="text-xs text-[#52635B]">Gorduras</p>
                <p className="font-mono text-2xl font-bold text-[#111B17] tabular-nums mt-0.5">
                  {demoNutrition.fatG}g
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-[#F5F7F5]">
                <p className="text-xs font-medium text-[#52635B]">Micronutrientes por porção</p>
                <div className="mt-2 space-y-1 font-mono text-xs tabular-nums text-[#24342D]">
                  <p>Fibras: {demoNutrition.fiberG}g · Sódio: {demoNutrition.sodiumMg}mg</p>
                  <p>
                    Ferro: {demoNutrition.ironMg ?? '—'}mg · Cálcio: {demoNutrition.calciumMg ?? '—'}mg
                  </p>
                  <p>
                    Potássio: {demoNutrition.potassiumMg ?? '—'}mg · Vitamina C:{' '}
                    {demoNutrition.vitaminCMg ?? '—'}mg
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F7F5]">
                <p className="text-xs font-medium text-[#52635B]">
                  Custo ilustrativo (com preços informados pelo usuário)
                </p>
                <p className="font-mono text-xl font-bold text-[#173D32] tabular-nums mt-1.5">
                  {formatBrl(demoTotalCost / demoServings)}{' '}
                  <span className="text-xs font-normal text-[#52635B]">por porção</span>
                </p>
                <p className="text-xs text-[#52635B] mt-1">
                  Total estimado: {formatBrl(demoTotalCost)} · No seu painel, o cálculo usa seus
                  preços reais de compra.
                </p>
              </div>
            </div>

            <a
              href="#planos"
              className="px-5 py-3 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors inline-flex items-center gap-2"
            >
              <span>Usar com os ingredientes da minha casa</span>
              <ArrowRight className="w-4 h-4 text-[#C3F28B]" />
            </a>
          </div>
        </div>
      </section>

      {/* SEÇÃO 7 — PLANOS */}
      <section id="planos" className="bg-white border-y border-[#E1E8E4] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-medium text-[#173D32] mb-2">Transparência total</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#111B17] text-balance">
              Escolha o plano ideal para a sua cozinha
            </h2>
            <p className="mt-3 text-base text-[#455750]">
              Organize sua rotina a partir de menos de R$ 0,65 por dia no plano Básico ou libere
              toda a automação do NUTRIX Premium por menos de R$ 1,25 por dia.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* BÁSICO */}
            <div className="border border-[#DCE4DF] rounded-2xl p-7 sm:p-9 bg-[#F5F7F5]/60 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-[#52635B]">
                  Essencial para o dia a dia · Menos de R$ 0,65 por dia
                </p>
                <h3 className="font-display text-2xl font-bold text-[#111B17] mt-1">
                  NUTRIX BÁSICO
                </h3>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display text-4xl font-bold tabular-nums text-[#111B17] whitespace-nowrap shrink-0">
                    R$&nbsp;19,00
                  </span>
                  <span className="text-sm text-[#52635B]">/ mês · cancele quando quiser</span>
                </div>

                <ul className="mt-7 space-y-3 text-sm text-[#24342D]">
                  {[
                    'Perfil alimentar completo com alergias, restrições e orçamento',
                    'Até 30 ingredientes ativos organizados na sua despensa',
                    'Até 12 receitas personalizadas por semana no Chef',
                    'Calorias, proteínas, carboidratos, gorduras e fibras por porção',
                    'Ajuste dinâmico de porções, favoritos e avaliação de receitas',
                    'Lista de compras integrada aos ingredientes faltantes',
                    'Histórico completo das últimas 15 receitas salvas',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#173D32] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={HOTMART_CHECKOUT_URLS.basic}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPlanCheckoutClick('basic')}
                className="mt-8 w-full py-3.5 px-5 rounded-xl border border-[#173D32] text-[#173D32] font-semibold text-sm hover:bg-white transition-colors block text-center"
              >
                ASSINAR NUTRIX BÁSICO
              </a>
            </div>

            {/* PREMIUM */}
            <div className="border-2 border-[#173D32] rounded-2xl p-7 sm:p-9 bg-[#173D32] text-white flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-[#C3F28B]">
                  Mais escolhido · Experiência completa sem limites
                </p>
                <h3 className="font-display text-2xl font-bold mt-1">NUTRIX PREMIUM</h3>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display text-4xl font-bold tabular-nums text-[#C3F28B] whitespace-nowrap shrink-0">
                    R$&nbsp;37,00
                  </span>
                  <span className="text-sm text-white/80">/ mês · cancele quando quiser</span>
                </div>

                <ul className="mt-7 space-y-3 text-sm text-white/95">
                  {[
                    'Tudo do plano Básico, com geração ampliada de receitas no Chef',
                    'Reconhecimento de ingredientes por fotografia (geladeira e bancada)',
                    'Despensa ilimitada com alertas inteligentes de validade',
                    'Análise nutricional completa com micronutrientes e histórico ilimitado',
                    'Planejamento alimentar semanal automático (café, almoço, lanche e jantar)',
                    'Lista de compras automática descontando o estoque da despensa',
                    'Calculadora de custo por porção e substituições econômicas inteligentes',
                    'Painel Zero Desperdício e memória adaptativa de preferências',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#C3F28B] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={HOTMART_CHECKOUT_URLS.premium}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPlanCheckoutClick('premium')}
                className="mt-8 w-full py-3.5 px-5 rounded-xl bg-[#C3F28B] text-[#173D32] font-bold text-sm hover:bg-[#B1E872] transition-colors block text-center"
              >
                QUERO MEU NUTRIX PREMIUM
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 8 — PERGUNTAS FREQUENTES */}
      <section id="duvidas" className="max-w-4xl mx-auto px-5 sm:px-8 py-16 lg:py-24">
        <div className="mb-10">
          <p className="text-xs font-medium text-[#173D32] mb-2">Dúvidas frequentes</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#111B17]">
            Perguntas respondidas com clareza
          </h2>
        </div>

        <div className="divide-y divide-[#DCE4DF] border-y border-[#DCE4DF]">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="font-display text-base sm:text-lg font-semibold text-[#111B17]">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#173D32] shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm text-[#455750] leading-relaxed pr-8">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 9 — CTA FINAL */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
        <div className="bg-[#173D32] text-white rounded-3xl p-8 sm:p-14 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-balance max-w-2xl mx-auto">
            Sua alimentação pode ser muito mais simples.
          </h2>
          <p className="mt-4 text-base text-white/80 max-w-xl mx-auto">
            Comece com o que você já tem na cozinha e descubra tudo o que o NUTRIX pode fazer pela
            sua rotina, sua saúde e seu orçamento.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href={HOTMART_CHECKOUT_URLS.basic}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPlanCheckoutClick('basic')}
              className="px-6 py-3.5 rounded-xl border border-white/30 text-white font-semibold text-sm sm:text-base hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              Assinar Básico · R$&nbsp;19,00/mês
            </a>
            <a
              href={HOTMART_CHECKOUT_URLS.premium}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPlanCheckoutClick('premium')}
              className="px-7 py-3.5 rounded-xl bg-[#C3F28B] text-[#173D32] font-bold text-sm sm:text-base hover:bg-[#B1E872] transition-colors inline-flex items-center gap-2.5 whitespace-nowrap"
            >
              <span>QUERO MEU NUTRIX PREMIUM</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#DCE4DF] bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-sm text-[#52635B]">
          <div>
            <span className="font-display text-lg font-bold text-[#173D32]">NUTRIX</span>
            <p className="text-xs mt-1">
              NUTRIX Tecnologia Alimentar Ltda. · Sua alimentação, mais inteligente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => onOpenLegal('termos')}
              className="hover:text-[#173D32]"
            >
              Termos de Uso
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacidade')}
              className="hover:text-[#173D32]"
            >
              Política de Privacidade (LGPD)
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('contato')}
              className="hover:text-[#173D32]"
            >
              Contato
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
