import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
} from 'lucide-react';
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
    subtitle: 'Despensa, validades e orçamento semanal em uma tela.',
    renderContent: () => (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#F5F7F5] p-2.5 border border-[#E5ECE8]">
            <p className="text-[10px] text-[#52635B]">Na despensa</p>
            <p className="font-mono text-base font-bold text-[#111B17] tabular-nums mt-0.5">18</p>
            <p className="text-[10px] text-[#173D32]">itens ativos</p>
          </div>
          <div className="rounded-xl bg-[#F5F7F5] p-2.5 border border-[#E5ECE8]">
            <p className="text-[10px] text-[#52635B]">Vencem logo</p>
            <p className="font-mono text-base font-bold text-amber-700 tabular-nums mt-0.5">3</p>
            <p className="text-[10px] text-amber-800">prioridade</p>
          </div>
          <div className="rounded-xl bg-[#F5F7F5] p-2.5 border border-[#E5ECE8]">
            <p className="text-[10px] text-[#52635B]">Orçamento</p>
            <p className="font-mono text-sm font-bold text-[#173D32] tabular-nums mt-0.5">
              R$&nbsp;142
            </p>
            <p className="text-[10px] text-[#52635B]">de R$&nbsp;200</p>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3">
          <p className="text-[10px] font-semibold text-amber-900">
            Zero Desperdício · Usar primeiro
          </p>
          <p className="text-xs font-medium text-[#111B17] mt-0.5">
            Peito de frango (450g) e Brócolis vencem em 2 dias
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[#E5ECE8] p-2.5 bg-white">
          <FoodImage
            imageKey="frango"
            alt="Prato sugerido no painel NUTRIX"
            className="w-14 h-14 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] text-[#52635B]">Sugestão de hoje · 20 min</p>
            <p className="text-xs font-semibold text-[#111B17] truncate">
              Frango grelhado com arroz e brócolis
            </p>
            <p className="text-[11px] font-mono text-[#173D32] tabular-nums mt-0.5">
              442 kcal · 52g prot · R$&nbsp;7,75/porção
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'pantry',
    stepTag: '02 · Minha Despensa',
    title: 'Estoque e validades sob controle',
    subtitle: 'Quantidades em unidades brasileiras e alertas claros.',
    renderContent: () => (
      <div className="space-y-2">
        {[
          {
            name: 'Peito de frango',
            qty: '450 g',
            loc: 'Geladeira',
            state: 'Vence em 2 dias',
            tone: 'text-amber-800',
          },
          {
            name: 'Brócolis ninja',
            qty: '1 un',
            loc: 'Geladeira',
            state: 'Vence amanhã',
            tone: 'text-amber-800',
          },
          {
            name: 'Arroz branco tipo 1',
            qty: '1,8 kg',
            loc: 'Despensa',
            state: 'Disponível',
            tone: 'text-[#173D32]',
          },
          {
            name: 'Ovos de galinha',
            qty: '4 un',
            loc: 'Geladeira',
            state: 'Estoque baixo',
            tone: 'text-[#52635B]',
          },
          {
            name: 'Azeite extra virgem',
            qty: '350 ml',
            loc: 'Despensa',
            state: 'R$ 34,90',
            tone: 'text-[#173D32]',
          },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-[#F5F7F5] border border-[#E5ECE8]"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#111B17] truncate">{item.name}</p>
              <p className="text-[10px] text-[#52635B]">
                {item.loc} · <span className={`font-medium ${item.tone}`}>{item.state}</span>
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[#111B17] tabular-nums whitespace-nowrap shrink-0">
              {item.qty}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'photo',
    stepTag: '03 · Foto da Geladeira',
    title: 'Identifique alimentos por foto',
    subtitle: 'Você revisa e confirma cada item antes de salvar.',
    renderContent: () => (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-[#DCE4DF] h-28">
          <FoodImage
            imageKey="pantry"
            alt="Leitura de ingredientes pela foto da geladeira no NUTRIX"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F2B23]/80 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white">
            <span className="inline-flex items-center gap-1 font-medium">
              <Camera className="w-3 h-3 text-[#C3F28B]" />
              <span>4 ingredientes identificados</span>
            </span>
            <span className="font-mono text-[#C3F28B]">Confirmar itens</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {[
            { name: 'Tomate italiano', detail: '4 un · Confiança alta' },
            { name: 'Ovos inteiros', detail: '12 un · Confirmar quantidade' },
            { name: 'Cenoura crua', detail: '3 un · Confiança alta' },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7F5] border border-[#E5ECE8]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded bg-[#173D32] text-[#C3F28B] flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </span>
                <span className="text-xs font-medium text-[#111B17] truncate">{item.name}</span>
              </div>
              <span className="text-[10px] text-[#52635B] whitespace-nowrap shrink-0">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'chef',
    stepTag: '04 · Chef NUTRIX',
    title: 'Receitas com macros e custo real',
    subtitle: 'Feitas com o que você já tem e ajuste de porções.',
    renderContent: () => (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-[#DCE4DF] h-28">
          <FoodImage
            imageKey="omelete"
            alt="Receita personalizada gerada no Chef NUTRIX"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F2B23]/80 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white">
            <span className="font-semibold">Omelete cremosa de tomate e queijo</span>
            <span className="font-mono text-[#C3F28B] whitespace-nowrap">12 min</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { label: 'Calorias', val: '318', unit: 'kcal' },
            { label: 'Proteína', val: '24g', unit: 'porção' },
            { label: 'Carboid.', val: '9g', unit: 'porção' },
            { label: 'Fibras', val: '3,2g', unit: 'porção' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-[#F5F7F5] border border-[#E5ECE8] py-2 px-1">
              <p className="text-[9px] text-[#52635B]">{m.label}</p>
              <p className="font-mono text-xs font-bold text-[#111B17] tabular-nums mt-0.5">
                {m.val}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] px-3 py-2 rounded-xl bg-[#173D32] text-white">
          <span>100% ingredientes da despensa</span>
          <span className="font-mono font-semibold text-[#C3F28B] tabular-nums">
            R$&nbsp;5,40/porção
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'planner',
    stepTag: '05 · Planejador & Compras',
    title: 'Semana inteira e lista enxuta',
    subtitle: 'Desconta automaticamente o que já existe na sua casa.',
    renderContent: () => (
      <div className="space-y-2.5">
        <div className="rounded-xl bg-[#F5F7F5] border border-[#E5ECE8] p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#52635B]">
            <span className="font-semibold text-[#173D32]">Cardápio · Quarta-feira</span>
            <span className="font-mono tabular-nums">1.840 kcal/dia</span>
          </div>
          {[
            { meal: 'Café', name: 'Ovos mexidos com mamão e aveia' },
            { meal: 'Almoço', name: 'Bowl de frango, arroz e brócolis' },
            { meal: 'Jantar', name: 'Salteado de legumes com proteína' },
          ].map((row) => (
            <div key={row.meal} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#52635B] w-12 shrink-0">{row.meal}</span>
              <span className="text-[#111B17] font-medium truncate flex-1">{row.name}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#DCE4DF] bg-white p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-[#173D32]">
            Lista de compras inteligente (só o que falta)
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#111B17]">
            <span>Limão tahiti · 4 un</span>
            <span className="text-[10px] text-[#52635B]">Hortifrúti</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#111B17]">
            <span>Aveia em flocos · 250 g</span>
            <span className="text-[10px] text-[#52635B]">Grãos</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#52635B] line-through">
            <span>Peito de frango</span>
            <span className="no-underline text-[10px] text-[#173D32] font-medium">
              Já na despensa
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'economy',
    stepTag: '06 · Nutrição & Economia',
    title: 'Economia real no supermercado',
    subtitle: 'Acompanhe gastos semanais e evite jogar comida fora.',
    renderContent: () => (
      <div className="space-y-3">
        <div className="rounded-xl bg-[#173D32] text-white p-3.5">
          <p className="text-[10px] text-[#C3F28B]">Economia acumulada evitando desperdício</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-2xl font-bold tabular-nums">R$&nbsp;186,40</span>
            <span className="text-[11px] text-white/80">este mês</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#F5F7F5] border border-[#E5ECE8] p-3 space-y-2">
          <p className="text-[10px] font-semibold text-[#111B17]">
            Substituições econômicas sugeridas
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#455750]">Filé de frango → Sobrecoxa s/ osso</span>
            <span className="font-mono text-[#173D32] font-semibold">-24%</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#455750]">Salmão → Filé de tilápia</span>
            <span className="font-mono text-[#173D32] font-semibold">-42%</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[#E5ECE8] p-2.5 bg-white">
          <FoodImage
            imageKey="veggie"
            alt="Refeição nutritiva e econômica no NUTRIX"
            className="w-12 h-12 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] text-[#52635B]">Média semanal</p>
            <p className="text-xs font-semibold text-[#111B17] truncate">
              Custo médio de R$&nbsp;8,90 por refeição
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

function ScreenCard({
  slide,
  onSelect,
}: {
  slide: ScreenSlide;
  onSelect: (slide: ScreenSlide) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slide)}
      aria-label={`Ampliar tela ${slide.title}`}
      className="group text-left w-[285px] sm:w-[330px] lg:w-[360px] shrink-0 rounded-2xl bg-white text-[#111B17] border border-white/15 overflow-hidden transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-[#C3F28B]"
    >
      {/* Realistic compact app frame header */}
      <div className="bg-[#0F2B23] text-white px-4 py-2.5 flex items-center justify-between gap-2">
        <span className="font-display text-xs font-bold tracking-tight text-white">NUTRIX</span>
        <span className="text-[11px] font-medium text-[#C3F28B] truncate">{slide.stepTag}</span>
      </div>

      {/* Screen Title + Live UI Preview */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div>
          <h3 className="font-display text-base font-bold text-[#111B17] leading-snug">
            {slide.title}
          </h3>
          <p className="text-xs text-[#52635B] mt-0.5 leading-relaxed">{slide.subtitle}</p>
        </div>

        <div>{slide.renderContent()}</div>
      </div>
    </button>
  );
}

export function AppShowcaseCarousel() {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<ScreenSlide | null>(null);
  const manualScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollManual = (direction: 'left' | 'right') => {
    if (!isPaused) setIsPaused(true);
    window.requestAnimationFrame(() => {
      const container = manualScrollRef.current;
      if (!container) return;
      const offset = direction === 'right' ? 340 : -340;
      container.scrollBy({ left: offset, behavior: 'smooth' });
    });
  };

  return (
    <div>
      {/* Controls Bar */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <p className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
            Veja o NUTRIX por dentro
          </p>
          <p className="font-sans text-sm sm:text-base font-normal text-white/85 leading-tight mt-0.5">
            (passe o mouse ou toque em qualquer tela para ampliar).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollManual('left')}
            aria-label="Tela anterior"
            className="w-10 h-10 rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="h-10 px-3.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-[#C3F28B]" />
                <span>Continuar</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-[#C3F28B]" />
                <span>Pausar</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => scrollManual('right')}
            aria-label="Próxima tela"
            className="w-10 h-10 rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel Viewport */}
      <div className="relative w-full overflow-hidden">
        {/* Soft Edge Fade Masks on Desktop */}
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-28 z-10 bg-gradient-to-r from-[#173D32] to-transparent"
        />
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-28 z-10 bg-gradient-to-l from-[#173D32] to-transparent"
        />

        {isPaused ? (
          /* Manual Swipe / Scroll Mode when user pauses or uses arrows */
          <div
            ref={manualScrollRef}
            className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar px-5 sm:px-10 py-2 snap-x snap-mandatory"
          >
            {APP_SLIDES.map((slide) => (
              <div key={slide.id} className="snap-start shrink-0">
                <ScreenCard slide={slide} onSelect={setSelectedSlide} />
              </div>
            ))}
          </div>
        ) : (
          /* Seamless Infinite Horizontal Marquee (Mobile + Desktop) */
          <div className="nutrix-marquee-track py-2">
            <div className="flex gap-4 sm:gap-6 pr-4 sm:pr-6">
              {APP_SLIDES.map((slide) => (
                <ScreenCard key={`a_${slide.id}`} slide={slide} onSelect={setSelectedSlide} />
              ))}
            </div>
            <div className="flex gap-4 sm:gap-6 pr-4 sm:pr-6" aria-hidden="true">
              {APP_SLIDES.map((slide) => (
                <ScreenCard key={`b_${slide.id}`} slide={slide} onSelect={setSelectedSlide} />
              ))}
            </div>
          </div>
        )}
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
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#52635B]">{selectedSlide.subtitle}</p>
              {selectedSlide.renderContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
