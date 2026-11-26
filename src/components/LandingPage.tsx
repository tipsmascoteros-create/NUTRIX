import { useState } from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import {
  HOTMART_CHECKOUT_URLS,
  trackPlanCheckoutClick,
} from '../lib/checkoutLinks.ts';
import { AppShowcaseCarousel } from './AppShowcaseCarousel.tsx';
import { FoodImage } from './FoodImage.tsx';
import type { LegalTab } from './LegalModal.tsx';

interface LandingPageProps {
  onStartBasic: () => void;
  onStartPremium: () => void;
  onOpenLogin: () => void;
  onOpenLegal: (tab: LegalTab) => void;
}

const PROBLEMS = [
  {
    num: '1.',
    title: 'Você abre a geladeira e não sabe o que preparar.',
    desc: 'Tem ingredientes, mas falta ideia de como combiná-los para montar uma refeição.',
  },
  {
    num: '2.',
    title: 'Você compra alimentos e acaba desperdiçando.',
    desc: 'Verduras, frutas e outros ingredientes ficam esquecidos até perderem a validade.',
  },
  {
    num: '3.',
    title: 'O dinheiro parece desaparecer no supermercado.',
    desc: 'Você compra, compra e nem sempre consegue entender quanto está gastando com cada refeição.',
  },
  {
    num: '4.',
    title: 'Você quer comer melhor, mas falta tempo.',
    desc: 'Entre trabalho, casa e compromissos, planejar a alimentação acaba ficando para depois.',
  },
  {
    num: '5.',
    title: 'Você quer equilibrar melhor suas refeições.',
    desc: 'Mas calcular calorias, proteínas e outros nutrientes manualmente é cansativo.',
  },
  {
    num: '6.',
    title: 'Decidir o que cozinhar virou uma tarefa diária.',
    desc: 'Todos os dias a mesma pergunta: o que vamos comer hoje?',
  },
];

const DIFFERENTIATORS = [
  {
    num: '01.',
    title: 'Descubra o que preparar com o que você já tem',
    desc: 'Encontre sugestões de receitas usando os ingredientes disponíveis na sua geladeira e despensa.',
    highlights: 'Receitas personalizadas, filtros por tempo, preferências e restrições alimentares.',
    image: '/src/assets/images/nutrix_pillar_recipes_1795728732783.jpg',
    imageAlt: 'Preparo de receita caseira com ingredientes frescos da geladeira e despensa',
  },
  {
    num: '02.',
    title: 'Tenha sua despensa sempre sob controle',
    desc: 'Saiba o que você tem em casa, acompanhe quantidades e receba alertas sobre alimentos próximos do vencimento.',
    highlights: 'Controle de estoque, fotografia de ingredientes e alertas de validade.',
    image: '/src/assets/images/nutrix_pillar_pantry_1795728734045.jpg',
    imageAlt: 'Despensa organizada com potes de grãos, cereais e cestas de alimentos frescos',
  },
  {
    num: '03.',
    title: 'Entenda melhor o que coloca no prato',
    desc: 'Consulte calorias, proteínas, carboidratos, gorduras, fibras e outros nutrientes das suas receitas.',
    highlights: 'Informações nutricionais e ajuste de porções.',
    image: '/src/assets/images/nutrix_pillar_nutrition_1795728734450.jpg',
    imageAlt: 'Prato nutritivo e equilibrado com proteína, arroz com cenoura, brócolis, batata-doce e abacate',
  },
  {
    num: '04.',
    title: 'Planeje suas refeições e compras com facilidade',
    desc: 'Organize café da manhã, almoço, lanche e jantar e gere uma lista de compras considerando o que já existe na sua despensa.',
    highlights: 'Planejamento semanal e lista de compras integrada.',
    image: '/src/assets/images/nutrix_pillar_planner_1795728735763.jpg',
    imageAlt: 'Marmitas de vidro organizadas para a semana ao lado de sacola com vegetais frescos',
  },
  {
    num: '05.',
    title: 'Aproveite melhor seu dinheiro e evite desperdícios',
    desc: 'Acompanhe o custo das refeições, organize seu orçamento e encontre alternativas econômicas para seus ingredientes.',
    highlights: 'Custo por porção, orçamento semanal e sistema Zero Desperdício.',
    image: '/src/assets/images/nutrix_pillar_economy_1795728736928.jpg',
    imageAlt: 'Cesta de feira com legumes, verduras, ovos e ervas frescas para compras econômicas sem desperdício',
  },
];

const FAQS = [
  {
    q: 'O que é o NUTRIX?',
    a: 'O NUTRIX é uma plataforma de organização alimentar que ajuda você a descobrir receitas com os ingredientes que tem em casa, controlar sua despensa, acompanhar informações nutricionais, planejar refeições e organizar seus gastos com alimentação.',
  },
  {
    q: 'Preciso entender de nutrição para usar o NUTRIX?',
    a: 'Não. A plataforma foi pensada para facilitar sua rotina, apresentando sugestões de receitas e informações nutricionais de forma organizada e prática.',
  },
  {
    q: 'Como funcionam as sugestões de receitas?',
    a: 'Você informa os ingredientes disponíveis e suas preferências. A plataforma utiliza essas informações para apresentar sugestões de receitas compatíveis com o que você tem em casa e com os filtros disponíveis.',
  },
  {
    q: 'Posso usar o NUTRIX pelo celular?',
    a: 'Sim, desde que a versão disponibilizada da plataforma seja compatível com seu dispositivo e navegador. Você poderá acessar sua conta sem precisar utilizar um computador.',
  },
  {
    q: 'Qual a diferença entre o Básico e o Premium?',
    a: 'O Básico oferece as ferramentas essenciais para organizar sua alimentação. O Premium amplia os recursos, incluindo reconhecimento de ingredientes por fotografia, despensa ilimitada, planejamento semanal automático e funcionalidades adicionais.',
  },
  {
    q: 'Posso cancelar minha assinatura?',
    a: 'Sim. Você pode solicitar o cancelamento conforme as condições apresentadas no momento da contratação, sem precisar manter a assinatura indefinidamente.',
  },
  {
    q: 'As informações nutricionais são precisas?',
    a: 'Os valores são estimativas calculadas a partir dos ingredientes, quantidades e dados nutricionais utilizados pela plataforma. Podem variar conforme marcas, preparações e porções. Não substituem uma avaliação nutricional profissional.',
  },
  {
    q: 'Como funciona o reconhecimento de ingredientes por fotografia?',
    a: 'Você fotografa os alimentos da geladeira ou bancada. O NUTRIX apresenta os itens identificados para que você revise e confirme antes de salvá-los.',
  },
  {
    q: 'Meus dados estão protegidos?',
    a: 'Consulte nossa Política de Privacidade para conhecer as medidas de proteção e o tratamento dos seus dados pessoais.',
  },
];

export function LandingPage({
  onOpenLogin,
  onOpenLegal,
}: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#111B17]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#173D32]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#inicio"
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            NUTRIX
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/80">
            <a href="#como-funciona" className="hover:text-[#C3F28B] transition-colors whitespace-nowrap shrink-0">
              Como funciona
            </a>
            <a href="#recursos" className="hover:text-[#C3F28B] transition-colors whitespace-nowrap shrink-0">
              Recursos
            </a>
            <a href="#planos" className="hover:text-[#C3F28B] transition-colors whitespace-nowrap shrink-0">
              Planos
            </a>
            <a href="#duvidas" className="hover:text-[#C3F28B] transition-colors whitespace-nowrap shrink-0">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-sm font-semibold text-white hover:text-[#C3F28B] transition-colors whitespace-nowrap shrink-0"
            >
              Entrar
            </button>
            <a
              href="#planos"
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#C3F28B] text-[#0F2B23] text-xs sm:text-sm font-semibold hover:bg-[#B1E872] transition-colors whitespace-nowrap shrink-0"
            >
              Começar agora
            </a>
          </div>
        </div>
      </header>

      {/* SEÇÃO 1 — HERO */}
      <section id="inicio" className="max-w-7xl mx-auto px-5 sm:px-8 pt-5 pb-12 lg:pt-8 lg:pb-16">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-tight text-[#111B17] leading-[1.12] text-balance max-w-3xl">
            Chega de abrir a geladeira e não saber o que preparar!
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
          <p className="mt-6 text-base sm:text-lg italic text-[#455750] leading-[1.35] max-w-2xl">
            <strong className="font-bold text-[#111B17]">Conheça o NUTRIX</strong>: a plataforma
            que ajuda você a descobrir receitas com o que já tem em casa, organizar sua despensa,
            planejar suas refeições e economizar nas compras
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
          <div className="max-w-3xl">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111B17] leading-tight text-balance">
              Você também sente que organizar a alimentação dá mais trabalho do que deveria?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#455750] leading-snug max-w-2xl">
              Se todos os dias você enfrenta alguma dessas situações, saiba que não precisa
              continuar fazendo tudo do jeito mais difícil.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {PROBLEMS.map((problem) => (
              <div
                key={problem.num}
                className="pt-3.5 border-t border-[#E1E8E4] flex items-baseline gap-2.5"
              >
                <span className="font-mono text-xs font-semibold text-[#173D32] tabular-nums shrink-0">
                  {problem.num}
                </span>
                <div className="space-y-1">
                  <p className="text-sm sm:text-[15px] font-semibold text-[#111B17] leading-snug">
                    {problem.title}
                  </p>
                  <p className="text-sm text-[#455750] leading-snug">{problem.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-[#F5F7F5] border border-[#DCE4DF] px-5 py-4 sm:px-7 sm:py-5">
            <p className="font-display text-base sm:text-lg font-semibold text-[#173D32] leading-snug text-center max-w-3xl mx-auto">
              E se você pudesse organizar tudo isso em um só lugar, sem depender de planilhas,
              anotações espalhadas ou improvisos todos os dias?
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3 — APRESENTAÇÃO DA SOLUÇÃO */}
      <section id="recursos" className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 pb-12 lg:pt-16 lg:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111B17] leading-tight text-balance">
            Conheça o NUTRIX: muito mais do que receitas, uma nova forma de organizar sua
            alimentação.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#455750] leading-[1.4] max-w-2xl mx-auto">
            O NUTRIX é uma plataforma inteligente que ajuda você a aproveitar melhor os alimentos
            que já tem em casa, descobrir novas receitas, acompanhar informações nutricionais,
            planejar suas refeições e controlar seus gastos.
          </p>
        </div>

        <div className="mt-7 max-w-4xl mx-auto overflow-hidden rounded-2xl border border-[#DCE4DF] bg-white">
          <FoodImage
            imageKey="pantry"
            alt="Geladeira organizada para aproveitamento inteligente de ingredientes"
            className="w-full h-60 sm:h-80 lg:h-[420px] object-cover block"
          />
        </div>

        <p className="mt-6 text-sm sm:text-base font-medium text-[#173D32] leading-[1.4] max-w-2xl mx-auto text-center">
          Tudo conectado em um só lugar, para que você tenha mais praticidade na cozinha, menos
          desperdício e mais controle sobre sua alimentação.
        </p>
      </section>

      {/* SEÇÃO 4 — PRÉVIA DO APP POR DENTRO (CARROSSEL DINÂMICO) */}
      <section id="como-funciona" className="bg-[#173D32] text-white py-7 lg:py-9 overflow-hidden">
        {/* Carrossel horizontal responsivo com telas reais do NUTRIX por dentro */}
        <AppShowcaseCarousel />
      </section>

      {/* SEÇÃO 5 — DIFERENCIAIS (5 pilares ilustrados em grid editorial) */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          {DIFFERENTIATORS.map((item, idx) => {
            const isBottomWide = idx >= 3;
            return (
              <article
                key={item.num}
                className={`bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden flex flex-col ${
                  isBottomWide
                    ? 'lg:col-span-3 lg:flex-row'
                    : 'lg:col-span-2'
                }`}
              >
                <div
                  className={
                    isBottomWide
                      ? 'w-full aspect-[16/10] lg:aspect-auto lg:w-[44%] shrink-0 overflow-hidden bg-[#EEF2EF]'
                      : 'w-full aspect-[16/10] shrink-0 overflow-hidden bg-[#EEF2EF]'
                  }
                >
                  <img
                    src={item.image}
                    alt={item.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover block"
                  />
                </div>
                <div className="p-5 sm:p-6 flex flex-col justify-between gap-3.5 flex-1">
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-[#173D32] font-semibold">{item.num}</p>
                    <h3 className="font-display text-lg font-bold text-[#111B17] leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#455750] leading-snug">{item.desc}</p>
                  </div>
                  <p className="pt-3 border-t border-[#E8EFEA] text-xs font-medium text-[#173D32] leading-snug">
                    {item.highlights}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 6 — BLOCO EMOCIONAL */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-14 lg:pb-20">
        <div className="rounded-3xl bg-[#173D32] text-white px-6 py-9 sm:px-12 sm:py-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-[2.15rem] font-bold leading-tight text-balance text-center">
              Imagine ter sua alimentação muito mais organizada todos os dias
            </h2>

            <ul className="mt-7 space-y-3.5 text-sm sm:text-base text-white/95">
              {[
                'Saber o que preparar sem ficar horas pensando.',
                'Aproveitar melhor os alimentos que já comprou.',
                'Ter suas refeições planejadas com mais facilidade.',
                'Conhecer melhor os nutrientes do que você come.',
                'Fazer compras com mais planejamento e controle.',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 leading-snug">
                  <Check className="w-5 h-5 text-[#C3F28B] shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <p className="mt-7 pt-5 border-t border-white/15 font-display text-lg sm:text-xl font-bold text-[#C3F28B] text-center leading-snug">
              Tudo isso pode começar com o NUTRIX.
            </p>
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
            <p className="mt-3 text-base text-[#455750] leading-snug">
              Organize sua rotina a partir de{' '}
              <strong className="font-bold text-[#111B17]">
                menos de R$&nbsp;0,65 por dia no plano Básico
              </strong>{' '}
              ou libere toda a automação do{' '}
              <strong className="font-bold text-[#111B17]">
                NUTRIX Premium por menos de R$&nbsp;1,25 por dia.
              </strong>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* BÁSICO */}
            <div className="border border-[#C5D5CC] rounded-2xl p-7 sm:p-9 bg-[#E7EFEA] shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-[#3D5248]">
                  Essencial para o dia a dia · Menos de R$ 0,65 por dia
                </p>
                <h3 className="font-display text-2xl font-bold text-[#111B17] mt-1">
                  NUTRIX BÁSICO
                </h3>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display text-4xl font-bold tabular-nums text-[#111B17] whitespace-nowrap shrink-0">
                    R$&nbsp;19,00
                  </span>
                  <span className="text-sm text-[#3D5248]">/ mês · cancele quando quiser</span>
                </div>

                <ul className="mt-7 space-y-3 text-sm text-[#1D2E27]">
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
                className="mt-8 w-full py-3.5 px-5 rounded-xl bg-white border border-[#173D32] text-[#173D32] font-semibold text-sm hover:bg-[#173D32] hover:text-white transition-colors block text-center"
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
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-8 lg:pb-10">
        <div className="bg-[#173D32] text-white rounded-3xl p-7 sm:p-11 lg:p-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {[
              {
                title: 'Acesse pelo celular',
                desc: 'Organize sua alimentação diretamente pelo celular, sem depender de planilhas.',
              },
              {
                title: 'Seus dados com proteção',
                desc: 'Consulte nossa Política de Privacidade e saiba como suas informações são tratadas.',
              },
              {
                title: 'Assinatura transparente',
                desc: 'Conheça as condições do seu plano, os valores e as regras de cancelamento antes de contratar.',
              },
              {
                title: 'Tudo em um só lugar',
                desc: 'Receitas, despensa, planejamento e informações nutricionais integrados.',
              },
            ].map((item) => (
              <div key={item.title} className="border-t border-white/15 pt-4 space-y-1.5">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#C3F28B] leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-white/85 leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-7 border-t border-white/15 flex flex-col sm:flex-row items-center justify-center gap-3.5">
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
      <footer className="bg-[#173D32] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-center">
          <div className="flex flex-nowrap items-center justify-center gap-2.5 sm:gap-5 text-[11px] sm:text-xs font-medium text-white/85 whitespace-nowrap">
            <button
              type="button"
              onClick={() => onOpenLegal('termos')}
              className="hover:text-[#C3F28B] transition-colors"
            >
              Termos de Uso
            </button>
            <span aria-hidden="true" className="text-white/35">
              ·
            </span>
            <button
              type="button"
              onClick={() => onOpenLegal('privacidade')}
              className="hover:text-[#C3F28B] transition-colors"
            >
              Política de Privacidade (LGPD)
            </button>
            <span aria-hidden="true" className="text-white/35">
              ·
            </span>
            <button
              type="button"
              onClick={() => onOpenLegal('contato')}
              className="hover:text-[#C3F28B] transition-colors"
            >
              Contato
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
