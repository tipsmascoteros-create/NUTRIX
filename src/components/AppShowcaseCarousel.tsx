import { useState } from 'react';
import { X } from 'lucide-react';
import { FoodImage } from './FoodImage.tsx';

interface ScreenSlide {
  id: string;
  stepTag: string;
  title: string;
  subtitle: string;
  renderContent: () => React.ReactNode;
}

const APP_SLIDES: ScreenSlide[] = [
  {
    id: 'dashboard',
    stepTag: '01 · Painel Inicial',
    title: 'Visão completa da sua cozinha',
    subtitle: 'Despensa, validades e orçamento em uma tela.',
    renderContent: () => (
      <>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-[#F5F7F5] p-1.5 border border-[#E5ECE8]">
            <p className="text-[9px] text-[#52635B] truncate">Despensa</p>
            <p className="font-mono text-sm font-bold text-[#111B17] tabular-nums">18</p>
            <p className="text-[9px] text-[#173D32]">itens</p>
          </div>
          <div className="rounded-lg bg-[#F5F7F5] p-1.5 border border-[#E5ECE8]">
            <p className="text-[9px] text-[#52635B] truncate">Validade</p>
            <p className="font-mono text-sm font-bold text-amber-700 tabular-nums">3</p>
            <p className="text-[9px] text-amber-800">prioridade</p>
          </div>
          <div className="rounded-lg bg-[#F5F7F5] p-1.5 border border-[#E5ECE8]">
            <p className="text-[9px] text-[#52635B] truncate">Orçamento</p>
            <p className="font-mono text-xs font-bold text-[#173D32] tabular-nums">R$&nbsp;142</p>
            <p className="text-[9px] text-[#52635B]">de R$&nbsp;200</p>
          </div>
        </div>

        <p className="rounded-lg bg-amber-50 border border-amber-200/80 p-2 text-[11px] font-medium text-[#111B17] leading-tight">
          <span className="block text-[9px] font-semibold text-amber-900 mb-0.5">
            Zero Desperdício · Usar primeiro
          </span>
          Peito de frango (450g) e Brócolis vencem em 2 dias
        </p>

        <div className="flex items-center gap-2 rounded-lg border border-[#E5ECE8] p-2 bg-white">
          <FoodImage
            imageKey="frango"
            alt="Prato sugerido no painel NUTRIX"
            className="w-10 h-10 rounded-md object-cover shrink-0"
          />
          <p className="min-w-0 text-[11px] font-semibold text-[#111B17] truncate">
            <span className="block text-[9px] font-normal text-[#52635B]">Sugestão · 20 min</span>
            Frango grelhado com arroz e brócolis
            <span className="block text-[10px] font-mono font-normal text-[#173D32] tabular-nums">
              442 kcal · R$&nbsp;7,75/porção
            </span>
          </p>
        </div>
      </>
    ),
  },
  {
    id: 'pantry',
    stepTag: '02 · Minha Despensa',
    title: 'Estoque e validades sob controle',
    subtitle: 'Quantidades e alertas claros do que vence logo.',
    renderContent: () => (
      <>
        {[
          {
            name: 'Peito de frango',
            qty: '450 g',
            meta: 'Geladeira · Vence em 2 dias',
            tone: 'text-amber-800',
          },
          {
            name: 'Brócolis ninja',
            qty: '1 un',
            meta: 'Geladeira · Vence amanhã',
            tone: 'text-amber-800',
          },
          {
            name: 'Arroz branco tipo 1',
            qty: '1,8 kg',
            meta: 'Despensa · Disponível',
            tone: 'text-[#173D32]',
          },
          {
            name: 'Ovos de galinha',
            qty: '4 un',
            meta: 'Geladeira · Estoque baixo',
            tone: 'text-[#52635B]',
          },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-[#F5F7F5] border border-[#E5ECE8]"
          >
            <p className="min-w-0 text-[11px] font-semibold text-[#111B17] truncate">
              {item.name}
              <span className={`block text-[9px] font-medium truncate ${item.tone}`}>
                {item.meta}
              </span>
            </p>
            <span className="font-mono text-[11px] font-semibold text-[#111B17] tabular-nums whitespace-nowrap shrink-0">
              {item.qty}
            </span>
          </div>
        ))}
      </>
    ),
  },
  {
    id: 'photo',
    stepTag: '03 · Foto da Geladeira',
    title: 'Identifique alimentos por foto',
    subtitle: 'Revise e confirme cada item antes de salvar.',
    renderContent: () => (
      <>
        <div className="relative rounded-lg overflow-hidden border border-[#DCE4DF] h-20">
          <FoodImage
            imageKey="pantry"
            alt="Leitura de ingredientes pela foto da geladeira no NUTRIX"
            className="w-full h-full object-cover"
          />
          <p className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 bg-gradient-to-t from-[#0F2B23]/85 to-transparent flex items-center justify-between text-[9px] text-white">
            <span className="font-medium">4 itens identificados</span>
            <span className="font-mono text-[#C3F28B]">Confirmar</span>
          </p>
        </div>

        {[
          { name: 'Tomate italiano', detail: '4 un' },
          { name: 'Ovos inteiros', detail: '12 un' },
          { name: 'Cenoura crua', detail: '3 un' },
        ].map((item) => (
          <p
            key={item.name}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F7F5] border border-[#E5ECE8] text-[11px]"
          >
            <span className="text-[10px] font-bold text-[#173D32]" aria-hidden="true">
              ✓
            </span>
            <span className="font-medium text-[#111B17] truncate">{item.name}</span>
            <span className="ml-auto text-[10px] font-mono text-[#52635B] whitespace-nowrap shrink-0">
              {item.detail}
            </span>
          </p>
        ))}
      </>
    ),
  },
  {
    id: 'chef',
    stepTag: '04 · Chef NUTRIX',
    title: 'Receitas com macros e custo real',
    subtitle: 'Com o que você já tem e ajuste de porções.',
    renderContent: () => (
      <>
        <div className="relative rounded-lg overflow-hidden border border-[#DCE4DF] h-20">
          <FoodImage
            imageKey="omelete"
            alt="Receita personalizada gerada no Chef NUTRIX"
            className="w-full h-full object-cover"
          />
          <p className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 bg-gradient-to-t from-[#0F2B23]/85 to-transparent flex items-center justify-between text-[9px] text-white gap-2">
            <span className="font-semibold truncate">Omelete cremosa de tomate</span>
            <span className="font-mono text-[#C3F28B] whitespace-nowrap">12 min</span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'Kcal', val: '318' },
            { label: 'Prot.', val: '24g' },
            { label: 'Carb.', val: '9g' },
            { label: 'Fibras', val: '3,2g' },
          ].map((m) => (
            <p
              key={m.label}
              className="rounded-md bg-[#F5F7F5] border border-[#E5ECE8] py-1.5 px-1 font-mono text-[11px] font-bold text-[#111B17] tabular-nums"
            >
              <span className="block font-sans text-[8px] font-normal text-[#52635B]">
                {m.label}
              </span>
              {m.val}
            </p>
          ))}
        </div>

        <p className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded-lg bg-[#173D32] text-white">
          <span className="truncate">100% da despensa</span>
          <span className="font-mono font-semibold text-[#C3F28B] tabular-nums whitespace-nowrap">
            R$&nbsp;5,40/porção
          </span>
        </p>
      </>
    ),
  },
  {
    id: 'planner',
    stepTag: '05 · Planejador & Compras',
    title: 'Semana inteira e lista enxuta',
    subtitle: 'Desconta o que já existe na sua despensa.',
    renderContent: () => (
      <>
        <div className="rounded-lg bg-[#F5F7F5] border border-[#E5ECE8] p-2 space-y-1">
          <p className="flex items-center justify-between text-[9px] text-[#52635B]">
            <span className="font-semibold text-[#173D32]">Cardápio · Quarta</span>
            <span className="font-mono tabular-nums">1.840 kcal</span>
          </p>
          {[
            { meal: 'Café', name: 'Ovos mexidos e aveia' },
            { meal: 'Almoço', name: 'Frango, arroz e brócolis' },
            { meal: 'Jantar', name: 'Legumes salteados' },
          ].map((row) => (
            <p key={row.meal} className="flex items-center gap-2 text-[10px]">
              <span className="text-[#52635B] w-10 shrink-0">{row.meal}</span>
              <span className="text-[#111B17] font-medium truncate flex-1">{row.name}</span>
            </p>
          ))}
        </div>

        <div className="rounded-lg border border-[#DCE4DF] bg-white p-2 space-y-1">
          <p className="text-[9px] font-semibold text-[#173D32]">Lista de compras (só o que falta)</p>
          <p className="flex items-center justify-between text-[10px] text-[#111B17]">
            <span>Limão tahiti · 4 un</span>
            <span className="text-[9px] text-[#52635B]">Hortifrúti</span>
          </p>
          <p className="flex items-center justify-between text-[10px] text-[#52635B] line-through">
            <span>Peito de frango</span>
            <span className="no-underline text-[9px] text-[#173D32] font-medium">Na despensa</span>
          </p>
        </div>
      </>
    ),
  },
  {
    id: 'economy',
    stepTag: '06 · Nutrição & Economia',
    title: 'Economia real no supermercado',
    subtitle: 'Acompanhe gastos e evite jogar comida fora.',
    renderContent: () => (
      <>
        <p className="rounded-lg bg-[#173D32] text-white p-2.5">
          <span className="block text-[9px] text-[#C3F28B]">Economia evitando desperdício</span>
          <span className="flex items-baseline justify-between mt-0.5">
            <span className="font-mono text-lg font-bold tabular-nums">R$&nbsp;186,40</span>
            <span className="text-[10px] text-white/80">este mês</span>
          </span>
        </p>

        <div className="rounded-lg bg-[#F5F7F5] border border-[#E5ECE8] p-2 space-y-1">
          <p className="text-[9px] font-semibold text-[#111B17]">Substituições econômicas</p>
          <p className="flex items-center justify-between text-[10px] gap-1">
            <span className="text-[#455750] truncate">Filé → Sobrecoxa s/ osso</span>
            <span className="font-mono text-[#173D32] font-semibold shrink-0">-24%</span>
          </p>
          <p className="flex items-center justify-between text-[10px] gap-1">
            <span className="text-[#455750] truncate">Salmão → Filé de tilápia</span>
            <span className="font-mono text-[#173D32] font-semibold shrink-0">-42%</span>
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#E5ECE8] p-2 bg-white">
          <FoodImage
            imageKey="veggie"
            alt="Refeição nutritiva e econômica no NUTRIX"
            className="w-9 h-9 rounded-md object-cover shrink-0"
          />
          <p className="min-w-0 text-[11px] font-semibold text-[#111B17] truncate">
            <span className="block text-[9px] font-normal text-[#52635B]">Média semanal</span>
            R$&nbsp;8,90 por refeição
          </p>
        </div>
      </>
    ),
  },
];

function ScreenCard({
  slide,
  onSelect,
  isDuplicate = false,
}: {
  slide: ScreenSlide;
  onSelect: (slide: ScreenSlide) => void;
  isDuplicate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slide)}
      aria-label={`Ampliar tela ${slide.title}`}
      aria-hidden={isDuplicate || undefined}
      tabIndex={isDuplicate ? -1 : undefined}
      className="group text-left w-[225px] sm:w-[248px] lg:w-[260px] mr-3.5 sm:mr-4 shrink-0 rounded-xl bg-white text-[#111B17] border border-white/15 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#C3F28B]"
    >
      <p className="bg-[#0F2B23] text-white px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="font-display text-[11px] font-bold tracking-tight text-white">NUTRIX</span>
        <span className="text-[10px] font-medium text-[#C3F28B] truncate">{slide.stepTag}</span>
      </p>

      <div className="p-3 sm:p-3.5 space-y-2">
        <h3 className="font-display text-[13px] font-bold text-[#111B17] leading-snug">
          {slide.title}
        </h3>
        <p className="text-[11px] text-[#52635B] !mt-0.5 leading-snug">{slide.subtitle}</p>
        {slide.renderContent()}
      </div>
    </button>
  );
}

export function AppShowcaseCarousel() {
  const [selectedSlide, setSelectedSlide] = useState<ScreenSlide | null>(null);

  return (
    <>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-5">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight text-balance max-w-3xl">
          Veja como fica mais fácil organizar sua alimentação com o NUTRIX.
        </h2>
        <p className="mt-2 text-sm sm:text-base text-white/85 leading-[1.35] max-w-2xl">
          Conheça as ferramentas que ajudam você a transformar os ingredientes da sua cozinha em
          refeições, planejamento e economia.
        </p>
      </div>

      {/* Carousel Viewport */}
      <div className="relative w-full overflow-hidden">
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-28 z-10 bg-gradient-to-r from-[#173D32] to-transparent"
        />
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-28 z-10 bg-gradient-to-l from-[#173D32] to-transparent"
        />

        <div className="nutrix-marquee-track py-1.5">
          {APP_SLIDES.map((slide) => (
            <ScreenCard key={`a_${slide.id}`} slide={slide} onSelect={setSelectedSlide} />
          ))}
          {APP_SLIDES.map((slide) => (
            <ScreenCard
              key={`b_${slide.id}`}
              slide={slide}
              onSelect={setSelectedSlide}
              isDuplicate
            />
          ))}
        </div>
      </div>

      {/* Enlarged Screen Inspection Modal */}
      {selectedSlide && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Prévia da tela ${selectedSlide.title}`}
          onClick={() => setSelectedSlide(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white text-[#111B17] border border-[#DCE4DF] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#173D32] text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-[#C3F28B] font-medium">{selectedSlide.stepTag}</p>
                <p className="font-display text-base font-bold">{selectedSlide.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlide(null)}
                aria-label="Fechar prévia"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2.5">
              <p className="text-xs text-[#52635B]">{selectedSlide.subtitle}</p>
              {selectedSlide.renderContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
