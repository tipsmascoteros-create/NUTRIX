import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { findTacoFood, searchTacoFoods } from '../data/tacoDatabase.ts';
import { apiFetch } from '../lib/apiClient.ts';
import { formatBrl, getExpiryStatus, getTodayIso } from '../lib/formatters.ts';
import {
  addEconomyEntry,
  addPantryItem,
  deletePantryItem,
  logAnalyticsEvent,
  updatePantryItem,
} from '../lib/nutrixService.ts';
import {
  PANTRY_CATEGORY_LABELS,
  STORAGE_LOCATION_LABELS,
  type AppConfig,
  type MeasureUnit,
  type PantryCategory,
  type PantryItem,
  type RecognizedIngredient,
  type StorageLocation,
  type UserProfile,
} from '../types/nutrix.ts';

interface PantryModuleProps {
  profile: UserProfile;
  config: AppConfig;
  pantry: PantryItem[];
  onOpenUpgrade: (reason: string) => void;
}

const CATEGORIES = Object.keys(PANTRY_CATEGORY_LABELS) as PantryCategory[];
const UNITS: MeasureUnit[] = ['g', 'kg', 'ml', 'L', 'un', 'colher', 'xicara', 'pacote'];
const LOCATIONS = Object.keys(STORAGE_LOCATION_LABELS) as StorageLocation[];

export function PantryModule({
  profile,
  config,
  pantry,
  onOpenUpgrade,
}: PantryModuleProps) {
  const isPremium = profile.plan === 'premium';
  const activeItems = useMemo(
    () => pantry.filter((i) => i.status === 'available' && i.quantity > 0),
    [pantry],
  );
  const reachedFreeLimit = !isPremium && activeItems.length >= config.freeMaxIngredients;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [tacoKey, setTacoKey] = useState('custom');
  const [category, setCategory] = useState<PantryCategory>('verduras');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<MeasureUnit>('un');
  const [minThreshold, setMinThreshold] = useState('0');
  const [purchasePriceBrl, setPurchasePriceBrl] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>('geladeira');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Module 2 — Photo Recognition states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<RecognizedIngredient[] | null>(null);
  const [scanSafetyNote, setScanSafetyNote] = useState('');
  const [scanError, setScanError] = useState('');

  const suggestions = useMemo(() => {
    if (!name.trim() || name.trim().length < 2) return [];
    return searchTacoFoods(name, 6);
  }, [name]);

  const sortedFilteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeItems
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (q && !item.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const expA = getExpiryStatus(a.expiryDate);
        const expB = getExpiryStatus(b.expiryDate);
        const rank = { expired: 0, expiring_soon: 1, fresh: 2, none: 3 };
        if (rank[expA.state] !== rank[expB.state]) return rank[expA.state] - rank[expB.state];
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [activeItems, categoryFilter, searchQuery]);

  const resetForm = () => {
    setEditingItem(null);
    setName('');
    setTacoKey('custom');
    setCategory('verduras');
    setQuantity('1');
    setUnit('un');
    setMinThreshold('0');
    setPurchasePriceBrl('');
    setExpiryDate('');
    setStorageLocation('geladeira');
    setError('');
  };

  const openEdit = (item: PantryItem) => {
    setEditingItem(item);
    setName(item.name);
    setTacoKey(item.tacoKey);
    setCategory(item.category);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setMinThreshold(String(item.minThreshold));
    setPurchasePriceBrl(item.purchasePriceBrl > 0 ? String(item.purchasePriceBrl) : '');
    setExpiryDate(item.expiryDate);
    setStorageLocation(item.storageLocation);
    setShowForm(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Informe o nome do ingrediente.');
      return;
    }
    if (!editingItem && reachedFreeLimit) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'free_limit_reached',
        plan: profile.plan,
        metadata: 'pantry_10_limit',
        analyticsConsent: profile.analyticsConsent,
      });
      onOpenUpgrade(
        `Você atingiu o limite de ${config.freeMaxIngredients} ingredientes ativos do NUTRIX Básico. No NUTRIX Premium sua despensa e geladeira são ilimitadas com alertas de validade.`,
      );
      return;
    }

    setSaving(true);
    try {
      const qtyNum = Math.max(0.1, Number(quantity) || 1);
      const priceNum = Math.max(0, Number(purchasePriceBrl) || 0);
      const matchedTaco = findTacoFood(name);

      if (editingItem) {
        await updatePantryItem(profile.uid, editingItem.id, {
          name: name.trim(),
          tacoKey: tacoKey !== 'custom' ? tacoKey : matchedTaco?.key || 'custom',
          category,
          quantity: qtyNum,
          unit,
          minThreshold: Math.max(0, Number(minThreshold) || 0),
          purchasePriceBrl: priceNum,
          priceUnitQty: qtyNum,
          expiryDate,
          storageLocation,
        });
        setFeedback(`"${name.trim()}" atualizado na despensa.`);
      } else {
        await addPantryItem(profile.uid, {
          name: name.trim(),
          tacoKey: tacoKey !== 'custom' ? tacoKey : matchedTaco?.key || 'custom',
          category,
          quantity: qtyNum,
          unit,
          minThreshold: Math.max(0, Number(minThreshold) || 0),
          purchasePriceBrl: priceNum,
          priceUnitQty: qtyNum,
          expiryDate,
          storageLocation,
          status: 'available',
        });

        // Also register purchase price into Economy log when provided
        if (priceNum > 0) {
          await addEconomyEntry(profile.uid, {
            type: 'purchase',
            itemName: name.trim(),
            category,
            amountBrl: priceNum,
            quantity: qtyNum,
            unit,
            date: getTodayIso(),
            notes: 'Cadastro na despensa',
          });
        }

        if (activeItems.length === 0) {
          void logAnalyticsEvent({
            userId: profile.uid,
            eventName: 'first_ingredient_added',
            plan: profile.plan,
            metadata: name.trim(),
            analyticsConsent: profile.analyticsConsent,
          });
        }
        setFeedback(`"${name.trim()}" adicionado à sua despensa.`);
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar ingrediente.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkOutcome = async (item: PantryItem, outcome: 'consumed' | 'discarded') => {
    await updatePantryItem(profile.uid, item.id, { status: outcome });
    const exp = getExpiryStatus(item.expiryDate);
    if (outcome === 'consumed' && (exp.state === 'expiring_soon' || item.purchasePriceBrl > 0)) {
      await addEconomyEntry(profile.uid, {
        type: 'saved_waste',
        itemName: item.name,
        category: item.category,
        amountBrl: item.purchasePriceBrl,
        quantity: item.quantity,
        unit: item.unit,
        date: getTodayIso(),
        notes: 'Aproveitado antes de vencer',
      });
    } else if (outcome === 'discarded') {
      await addEconomyEntry(profile.uid, {
        type: 'discarded',
        itemName: item.name,
        category: item.category,
        amountBrl: item.purchasePriceBrl,
        quantity: item.quantity,
        unit: item.unit,
        date: getTodayIso(),
        notes: 'Descartado da despensa',
      });
    }
    setFeedback(
      outcome === 'consumed'
        ? `"${item.name}" marcado como aproveitado!`
        : `"${item.name}" registrado como descartado no painel Zero Desperdício.`,
    );
  };

  // Module 2 — Photo Recognition Handler
  const handleTriggerPhotoScan = () => {
    if (!isPremium) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'premium_clicked',
        plan: profile.plan,
        metadata: 'photo_recognition_gate',
        analyticsConsent: profile.analyticsConsent,
      });
      onOpenUpgrade(
        'O reconhecimento de ingredientes por fotografia está disponível no NUTRIX Premium. Fotografe sua geladeira ou bancada e adicione tudo com confirmação rápida.',
      );
      return;
    }
    if (!config.enablePhotoRecognition) {
      setScanError('O reconhecimento por foto está temporariamente pausado pelo administrador.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError('');
    setScanning(true);
    setScanResults(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
        reader.readAsDataURL(file);
      });

      const [header, base64Data] = dataUrl.split(',');
      const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const res = await apiFetch<{ items: RecognizedIngredient[]; safetyNote: string }>(
        '/api/ai/recognize-photo',
        {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64Data, mimeType }),
        },
      );

      setScanResults(res.items);
      setScanSafetyNote(res.safetyNote);
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'photo_scan_used',
        plan: profile.plan,
        metadata: `detected:${res.items.length}`,
        analyticsConsent: profile.analyticsConsent,
      });
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Não foi possível analisar a fotografia.',
      );
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmScannedItems = async () => {
    if (!scanResults) return;
    const toAdd = scanResults.filter((i) => i.selected && i.name.trim());
    if (toAdd.length === 0) {
      setScanError('Selecione pelo menos um ingrediente confirmado para adicionar.');
      return;
    }

    setSaving(true);
    try {
      for (const item of toAdd) {
        const matched = findTacoFood(item.name);
        await addPantryItem(profile.uid, {
          name: item.name.trim(),
          tacoKey: matched?.key || 'custom',
          category: item.suggestedCategory,
          quantity: Math.max(0.1, Number(item.suggestedQuantity) || 1),
          unit: item.suggestedUnit,
          minThreshold: 0,
          purchasePriceBrl: 0,
          priceUnitQty: Math.max(0.1, Number(item.suggestedQuantity) || 1),
          expiryDate: '',
          storageLocation: 'geladeira',
          status: 'available',
        });
      }
      setFeedback(`${toAdd.length} ingrediente(s) confirmado(s) e adicionado(s) à despensa.`);
      setScanResults(null);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Erro ao salvar itens reconhecidos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#52635B]">
            Módulos 1 e 2 · Controle completo da sua cozinha
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
            Minha Despensa Inteligente
          </h1>
          <p className="text-sm text-[#455750] mt-1">
            {isPremium
              ? `${activeItems.length} ingrediente(s) ativo(s) · Controle ilimitado com alertas de validade`
              : `${activeItems.length} de ${config.freeMaxIngredients} ingredientes ativos no plano Básico`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhotoSelected}
            className="hidden"
          />
          <button
            type="button"
            disabled={scanning}
            onClick={handleTriggerPhotoScan}
            className="px-4 py-2.5 rounded-xl border border-[#173D32] bg-white text-[#173D32] text-sm font-semibold hover:bg-[#F5F7F5] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>
              {scanning
                ? 'Analisando foto...'
                : isPremium
                  ? 'Reconhecer por foto'
                  : 'Reconhecer por foto (Premium)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (reachedFreeLimit) {
                onOpenUpgrade(
                  `Você atingiu o limite de ${config.freeMaxIngredients} ingredientes do plano Básico. Desbloqueie despensa ilimitada no NUTRIX Premium.`,
                );
                return;
              }
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#C3F28B]" />
            <span>Adicionar ingrediente</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between gap-3">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="Fechar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {scanError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {scanError}
        </div>
      )}

      {/* Photo Recognition Confirmation Panel */}
      {scanResults && (
        <div className="bg-white border-2 border-[#173D32] rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#173D32]">
                Reconhecimento por Foto · Confirmação obrigatória
              </p>
              <h2 className="font-display text-lg font-semibold text-[#111B17] mt-0.5">
                Revise os {scanResults.length} ingrediente(s) identificados antes de salvar
              </h2>
              <p className="text-xs text-[#52635B] mt-1">{scanSafetyNote}</p>
            </div>
            <button
              type="button"
              onClick={() => setScanResults(null)}
              className="p-1.5 rounded-lg text-[#52635B] hover:bg-[#F5F7F5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {scanResults.length === 0 ? (
            <p className="text-sm text-[#455750]">
              Nenhum ingrediente pôde ser identificado com segurança nesta imagem. Tente fotografar
              com mais iluminação.
            </p>
          ) : (
            <div className="space-y-2.5">
              {scanResults.map((item, idx) => (
                <div
                  key={`${item.name}_${idx}`}
                  className="p-3.5 rounded-xl bg-[#F5F7F5] border border-[#DCE4DF] grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <label className="md:col-span-4 flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(item.selected)}
                      onChange={(e) => {
                        const next = [...scanResults];
                        next[idx] = { ...item, selected: e.target.checked };
                        setScanResults(next);
                      }}
                      className="rounded accent-[#173D32]"
                    />
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const next = [...scanResults];
                        next[idx] = { ...item, name: e.target.value };
                        setScanResults(next);
                      }}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#DCE4DF] bg-white"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      value={item.suggestedQuantity}
                      onChange={(e) => {
                        const next = [...scanResults];
                        next[idx] = {
                          ...item,
                          suggestedQuantity: Number(e.target.value) || 1,
                          quantityNeedsConfirmation: false,
                        };
                        setScanResults(next);
                      }}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums rounded-lg border border-[#DCE4DF] bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={item.suggestedUnit}
                      onChange={(e) => {
                        const next = [...scanResults];
                        next[idx] = { ...item, suggestedUnit: e.target.value as MeasureUnit };
                        setScanResults(next);
                      }}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-[#DCE4DF] bg-white"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4 text-xs text-[#52635B]">
                    <span
                      className={
                        item.confidence === 'alta'
                          ? 'text-emerald-800 font-medium'
                          : item.confidence === 'media'
                            ? 'text-amber-800 font-medium'
                            : 'text-red-700 font-medium'
                      }
                    >
                      Confiança {item.confidence}
                    </span>
                    {item.quantityNeedsConfirmation && ' · Confirme o peso/qtd'}
                    {item.notes && ` · ${item.notes}`}
                  </div>
                </div>
              ))}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScanResults(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE4DF] text-xs font-medium text-[#32433C]"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmScannedItems}
                  className="px-5 py-2 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-[#C3F28B]" />
                  <span>{saving ? 'Salvando...' : 'Confirmar e adicionar à despensa'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSaveItem}
          className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#111B17]">
              {editingItem ? 'Editar ingrediente' : 'Novo ingrediente na despensa'}
            </h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="p-1.5 rounded-lg text-[#52635B] hover:bg-[#F5F7F5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 relative">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Nome do alimento (com busca inteligente de ingredientes)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setTacoKey('custom');
                }}
                placeholder="Ex: Peito de frango, Arroz, Tomate, Brócolis..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
              {suggestions.length > 0 && tacoKey === 'custom' && (
                <div className="mt-1 bg-white border border-[#DCE4DF] rounded-xl shadow-md divide-y divide-[#E5ECE8] max-h-44 overflow-y-auto">
                  {suggestions.map((food) => (
                    <button
                      key={food.key}
                      type="button"
                      onClick={() => {
                        setName(food.name);
                        setTacoKey(food.key);
                        setCategory(food.category);
                        setUnit(food.defaultUnit);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F7F5] flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-[#111B17]">{food.name}</span>
                      <span className="font-mono text-[11px] text-[#52635B] tabular-nums">
                        {food.calories} kcal/100g · {food.source}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#32433C] mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PantryCategory)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PANTRY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#32433C] mb-1">Quantidade</label>
              <input
                type="number"
                required
                min={0.1}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#32433C] mb-1">Unidade</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as MeasureUnit)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Preço pago (R$, opcional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={purchasePriceBrl}
                onChange={(e) => setPurchasePriceBrl(e.target.value)}
                placeholder="Ex: 18.90"
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Data de validade (opcional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Local de armazenamento
              </label>
              <select
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value as StorageLocation)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {STORAGE_LOCATION_LABELS[loc]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Alerta estoque mínimo
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                placeholder="Ex: 2"
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] text-sm font-medium text-[#32433C]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] disabled:opacity-60"
            >
              {saving ? 'Salvando...' : editingItem ? 'Salvar alterações' : 'Adicionar à despensa'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B7D75] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ingrediente na despensa..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
        >
          <option value="all">Todas as categorias ({activeItems.length})</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {PANTRY_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Pantry Table */}
      <div className="bg-white border border-[#DCE4DF] rounded-2xl overflow-hidden">
        {sortedFilteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="font-display text-lg font-semibold text-[#111B17]">
              {activeItems.length === 0
                ? 'Sua despensa está vazia'
                : 'Nenhum ingrediente encontrado neste filtro'}
            </p>
            <p className="text-sm text-[#52635B] max-w-md mx-auto">
              Cadastre os alimentos que você já tem em casa (como frango, arroz, ovos, tomate e
              cenoura) para o Chef criar receitas sob medida.
            </p>
            {activeItems.length === 0 && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23]"
              >
                Cadastrar primeiro ingrediente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5ECE8] text-xs font-medium text-[#52635B] bg-[#F5F7F5]/60">
                  <th className="py-3 px-4">Ingrediente</th>
                  <th className="py-3 px-4">Local / Categoria</th>
                  <th className="py-3 px-4 text-right">Estoque</th>
                  <th className="py-3 px-4 text-right">Preço pago</th>
                  <th className="py-3 px-4">Validade</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5ECE8] text-sm">
                {sortedFilteredItems.map((item) => {
                  const exp = getExpiryStatus(item.expiryDate);
                  const lowStock = item.minThreshold > 0 && item.quantity <= item.minThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-[#F5F7F5]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-[#111B17]">{item.name}</p>
                        {lowStock && (
                          <p className="text-xs text-amber-700 font-medium mt-0.5">
                            Estoque baixo (mínimo: {item.minThreshold} {item.unit})
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#52635B]">
                        {STORAGE_LOCATION_LABELS[item.storageLocation]} ·{' '}
                        {PANTRY_CATEGORY_LABELS[item.category]}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#111B17]">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#32433C]">
                        {item.purchasePriceBrl > 0 ? formatBrl(item.purchasePriceBrl) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums">
                        {exp.state === 'expired' ? (
                          <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {exp.label}
                          </span>
                        ) : exp.state === 'expiring_soon' ? (
                          <span className="text-amber-700 font-semibold">{exp.label}</span>
                        ) : (
                          <span className="text-[#52635B]">{exp.label}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMarkOutcome(item, 'consumed')}
                            title="Marcar como aproveitado/consumido"
                            className="px-2 py-1 rounded-lg text-xs font-medium text-[#173D32] hover:bg-[#E7F3E2]"
                          >
                            Usei
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkOutcome(item, 'discarded')}
                            title="Registrar descarte no painel Zero Desperdício"
                            className="px-2 py-1 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-50"
                          >
                            Descarte
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Editar ${item.name}`}
                            className="p-1.5 rounded-lg text-[#52635B] hover:text-[#111B17] hover:bg-[#F5F7F5]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePantryItem(profile.uid, item.id)}
                            aria-label={`Excluir ${item.name}`}
                            className="p-1.5 rounded-lg text-[#52635B] hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
