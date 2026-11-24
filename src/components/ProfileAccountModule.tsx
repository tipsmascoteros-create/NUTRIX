import { useState } from 'react';
import { deleteUser } from 'firebase/auth';
import { CreditCard, Download, ExternalLink, ShieldCheck, Trash2, X } from 'lucide-react';
import { auth, logoutUser } from '../lib/firebase.ts';
import {
  deleteAllUserDataLgpd,
  exportUserDataLgpd,
  updateUserProfileFields,
} from '../lib/nutrixService.ts';
import { NUTRITION_GOALS, type UserProfile } from '../types/nutrix.ts';
import type { LegalTab } from './LegalModal.tsx';

interface ProfileAccountModuleProps {
  profile: UserProfile;
  onOpenUpgrade: (reason: string) => void;
  onOpenLegal: (tab: LegalTab) => void;
}

export function ProfileAccountModule({
  profile,
  onOpenUpgrade,
  onOpenLegal,
}: ProfileAccountModuleProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [goal, setGoal] = useState(profile.goal);
  const [age, setAge] = useState(String(profile.age || ''));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm || ''));
  const [weightKg, setWeightKg] = useState(String(profile.weightKg || ''));
  const [mealsPerDay, setMealsPerDay] = useState(profile.mealsPerDay || 4);
  const [restrictionsText, setRestrictionsText] = useState(profile.restrictions.join(', '));
  const [allergiesText, setAllergiesText] = useState(profile.allergies.join(', '));
  const [dislikesText, setDislikesText] = useState(profile.dislikes.join(', '));
  const [favorites, setFavorites] = useState<string[]>(profile.favoriteIngredients);
  const [analyticsConsent, setAnalyticsConsent] = useState(profile.analyticsConsent);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const splitClean = (v: string) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

      await updateUserProfileFields(profile.uid, {
        displayName: displayName.trim() || profile.displayName,
        goal,
        age: Number(age) || 0,
        heightCm: Number(heightCm) || 0,
        weightKg: Number(weightKg) || 0,
        mealsPerDay,
        restrictions: splitClean(restrictionsText),
        allergies: splitClean(allergiesText),
        dislikes: splitClean(dislikesText),
        favoriteIngredients: favorites,
        analyticsConsent,
      });
      setFeedback('Perfil nutricional e preferências atualizados com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportLgpd = async () => {
    try {
      const data = await exportUserDataLgpd(profile.uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutrix-dados-lgpd-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback('Seus dados pessoais foram exportados em formato JSON (LGPD).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar dados.');
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    try {
      await deleteAllUserDataLgpd(profile.uid);
      if (auth.currentUser) {
        await deleteUser(auth.currentUser).catch(async () => {
          await logoutUser();
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Para concluir a exclusão da autenticação, faça login novamente e tente de novo.',
      );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium text-[#52635B]">
          Módulos 5, 10 e 12 · Perfil, Assinatura e Conformidade LGPD
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111B17] mt-1">
          Minha Conta & Privacidade
        </h1>
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

      {/* Subscription Card */}
      <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#52635B]">
            <CreditCard className="w-4 h-4 text-[#173D32]" />
            <span>Plano atual da assinatura</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#111B17]">
            {profile.plan === 'premium'
              ? 'NUTRIX Premium (R$ 37,00/mês)'
              : 'NUTRIX Básico (R$ 19,00/mês)'}
          </h2>
          <p className="text-xs text-[#52635B]">
            Status:{' '}
            {profile.subscriptionStatus === 'active'
              ? profile.subscriptionProvider === 'hotmart'
                ? 'Assinatura ativa via Hotmart'
                : 'Assinatura ativa'
              : 'Assinatura pendente de confirmação'}{' '}
            · Conta: {profile.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {profile.plan === 'free' && (
            <button
              type="button"
              onClick={() =>
                onOpenUpgrade(
                  'Evolua para o NUTRIX Premium (R$ 37,00/mês) e desbloqueie foto da geladeira, despensa ilimitada e planejador semanal.',
                )
              }
              className="px-4 py-2.5 rounded-xl bg-[#173D32] text-white text-xs font-semibold hover:bg-[#0F2B23] whitespace-nowrap"
            >
              Evoluir para Premium
            </button>
          )}
          <a
            href="https://consumer.hotmart.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] text-[#173D32] text-xs font-semibold hover:bg-[#F5F7F5] whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <span>Gerenciar ou cancelar na Hotmart</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Nutritional Profile & Adaptive Memory */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-5"
      >
        <h2 className="font-display text-lg font-semibold text-[#111B17]">
          Perfil alimentar & Memória adaptativa
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">Nome</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">
              Objetivo principal
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white"
            >
              {NUTRITION_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">Idade</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">Altura (cm)</label>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">Peso (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">Refeições/dia</label>
            <input
              type="number"
              min={1}
              max={8}
              value={mealsPerDay}
              onChange={(e) => setMealsPerDay(Number(e.target.value) || 4)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-[#DCE4DF]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">
              Restrições (vírgula)
            </label>
            <input
              type="text"
              value={restrictionsText}
              onChange={(e) => setRestrictionsText(e.target.value)}
              placeholder="Sem lactose, sem glúten"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">
              Alergias (vírgula)
            </label>
            <input
              type="text"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="Amendoim, camarão"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">
              Não gosta (vírgula)
            </label>
            <input
              type="text"
              value={dislikesText}
              onChange={(e) => setDislikesText(e.target.value)}
              placeholder="Coentro, fígado"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF]"
            />
          </div>
        </div>

        {/* Adaptive Learned Ingredients */}
        <div className="pt-2 border-t border-[#E5ECE8]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[#32433C]">
              Ingredientes preferidos aprendidos pelo NUTRIX ({favorites.length})
            </p>
            {favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setFavorites([])}
                className="text-xs text-red-700 hover:underline"
              >
                Limpar memória
              </button>
            )}
          </div>
          {favorites.length === 0 ? (
            <p className="text-xs text-[#52635B]">
              Conforme você prepara e favorita receitas, o NUTRIX registra suas preferências aqui e
              você pode editar ou remover qualquer item quando quiser.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {favorites.map((ing) => (
                <button
                  key={ing}
                  type="button"
                  onClick={() => setFavorites(favorites.filter((f) => f !== ing))}
                  className="px-2.5 py-1 rounded-lg bg-[#F5F7F5] border border-[#DCE4DF] text-xs text-[#24342D] inline-flex items-center gap-1.5 hover:border-red-300"
                >
                  <span>{ing}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-xs text-[#455750] pt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={analyticsConsent}
            onChange={(e) => setAnalyticsConsent(e.target.checked)}
            className="mt-0.5 rounded accent-[#173D32]"
          />
          <span>
            Autorizo o registro anônimo de métricas de uso e melhoria do produto (você pode revogar
            a qualquer momento conforme a LGPD).
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar perfil e preferências'}
        </button>
      </form>

      {/* LGPD Privacy & Account Governance */}
      <div className="bg-white border border-[#DCE4DF] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#173D32]" />
          <h2 className="font-display text-lg font-semibold text-[#111B17]">
            Privacidade e Direitos do Titular (LGPD)
          </h2>
        </div>
        <p className="text-xs text-[#455750] leading-relaxed">
          Seus dados alimentares, alergias e histórico são isolados à sua conta. Você pode exportar
          uma cópia completa em JSON ou solicitar exclusão definitiva de todos os registros.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportLgpd}
            className="px-4 py-2.5 rounded-xl border border-[#173D32] text-[#173D32] text-xs font-semibold hover:bg-[#F5F7F5] inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Exportar meus dados (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenLegal('privacidade')}
            className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] text-[#32433C] text-xs font-medium hover:bg-[#F5F7F5]"
          >
            Ler Política de Privacidade
          </button>

          <button
            type="button"
            onClick={() => onOpenLegal('termos')}
            className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] text-[#32433C] text-xs font-medium hover:bg-[#F5F7F5]"
          >
            Ler Termos de Uso
          </button>
        </div>

        <div className="pt-4 border-t border-[#E5ECE8]">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-semibold text-red-700 hover:underline inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir minha conta e apagar todos os meus dados permanentemente</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
              <p className="text-xs text-red-900 font-medium">
                Esta ação apaga permanentemente seu perfil, despensa, receitas, planejamentos, lista
                de compras e histórico nutricional. Não pode ser desfeita.
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold"
                >
                  Confirmar exclusão definitiva
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-900"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
