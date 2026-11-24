import { useState } from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { updateUserProfileFields } from '../lib/nutrixService.ts';
import { NUTRITION_GOALS, type UserProfile } from '../types/nutrix.ts';

interface OnboardingModalProps {
  profile: UserProfile;
  onComplete: () => void;
}

const COMMON_RESTRICTIONS = [
  'Sem lactose',
  'Sem glúten',
  'Vegetariano',
  'Vegano',
  'Baixo sódio',
  'Sem carne suína',
];

const COMMON_ALLERGIES = [
  'Amendoim',
  'Castanhas',
  'Leite / Proteína do leite',
  'Ovos',
  'Frutos do mar / Camarão',
  'Soja',
  'Trigo',
];

export function OnboardingModal({ profile, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [weightKg, setWeightKg] = useState(profile.weightKg ? String(profile.weightKg) : '');
  const [goal, setGoal] = useState(profile.goal || NUTRITION_GOALS[0]);
  const [activityLevel, setActivityLevel] = useState(profile.activityLevel || 'Moderado');
  const [mealsPerDay, setMealsPerDay] = useState(profile.mealsPerDay || 4);
  const [weeklyBudgetBrl, setWeeklyBudgetBrl] = useState(String(profile.weeklyBudgetBrl || 200));
  const [restrictions, setRestrictions] = useState<string[]>(profile.restrictions || []);
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [dislikesText, setDislikesText] = useState((profile.dislikes || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleItem = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter((i) => i !== value) : [...list, value]);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const weekly = Math.max(0, Number(weeklyBudgetBrl) || 0);
      const dislikes = dislikesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);

      await updateUserProfileFields(profile.uid, {
        displayName: displayName.trim() || profile.displayName,
        age: Number(age) || 0,
        heightCm: Number(heightCm) || 0,
        weightKg: Number(weightKg) || 0,
        goal,
        activityLevel,
        mealsPerDay,
        weeklyBudgetBrl: weekly,
        monthlyBudgetBrl: Number((weekly * 4.3).toFixed(0)),
        restrictions,
        allergies,
        dislikes,
        onboardingCompleted: true,
        lgpdConsentAt: new Date().toISOString().slice(0, 30),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Configuração do perfil nutricional NUTRIX"
    >
      <div className="bg-white border border-[#DCE4DF] rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-[#52635B]">Etapa {step} de 3 · Perfil alimentar</p>
            <h2 className="font-display text-2xl font-semibold text-[#111B17] mt-1">
              Personalize o seu NUTRIX
            </h2>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-[#173D32]' : 'bg-[#E5ECE8]'}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">Seu nome</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] focus:border-[#173D32] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-2">
                Qual é o seu principal objetivo alimentar hoje?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NUTRITION_GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                      goal === g
                        ? 'border-[#173D32] bg-[#173D32] text-white'
                        : 'border-[#DCE4DF] text-[#24342D] hover:bg-[#F5F7F5]'
                    }`}
                  >
                    <span>{g}</span>
                    {goal === g && <Check className="w-3.5 h-3.5 text-[#C3F28B] shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">Idade</label>
                <input
                  type="number"
                  min={14}
                  max={110}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ex: 32"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF] tabular-nums outline-none focus:border-[#173D32]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">
                  Altura cm (opcional)
                </label>
                <input
                  type="number"
                  min={100}
                  max={240}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="Ex: 170"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF] tabular-nums outline-none focus:border-[#173D32]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">
                  Peso kg (opcional)
                </label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="Ex: 72"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#DCE4DF] tabular-nums outline-none focus:border-[#173D32]"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-2">
                Restrições alimentares
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_RESTRICTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleItem(restrictions, setRestrictions, item)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      restrictions.includes(item)
                        ? 'bg-[#173D32] text-white border-[#173D32]'
                        : 'bg-white text-[#32433C] border-[#DCE4DF] hover:bg-[#F5F7F5]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-2">
                Alergias (o Chef nunca incluirá estes ingredientes)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleItem(allergies, setAllergies, item)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      allergies.includes(item)
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-white text-[#32433C] border-[#DCE4DF] hover:bg-[#F5F7F5]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Alimentos que você não gosta (separados por vírgula)
              </label>
              <input
                type="text"
                value={dislikesText}
                onChange={(e) => setDislikesText(e.target.value)}
                placeholder="Ex: coentro, fígado, jiló, berinjela"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] outline-none focus:border-[#173D32]"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">
                  Refeições por dia
                </label>
                <select
                  value={mealsPerDay}
                  onChange={(e) => setMealsPerDay(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} refeições por dia
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#32433C] mb-1">
                  Atividade física (opcional)
                </label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-white outline-none focus:border-[#173D32]"
                >
                  <option value="Sedentário">Sedentário</option>
                  <option value="Leve">Leve (1–2x/semana)</option>
                  <option value="Moderado">Moderado (3–4x/semana)</option>
                  <option value="Intenso">Intenso (5x+/semana)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">
                Orçamento semanal estimado com alimentação (R$)
              </label>
              <input
                type="number"
                min={0}
                step={10}
                value={weeklyBudgetBrl}
                onChange={(e) => setWeeklyBudgetBrl(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] tabular-nums outline-none focus:border-[#173D32]"
              />
              <p className="text-xs text-[#52635B] mt-1">
                Usamos esse valor apenas para ajudar você a controlar gastos e escolher receitas que
                cabem no seu bolso.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7F5] border border-[#DCE4DF] flex items-start gap-3 text-xs text-[#32433C] leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-[#173D32] shrink-0 mt-0.5" />
              <p>
                <strong>Orientação importante:</strong> o NUTRIX não realiza diagnósticos médicos, não
                prescreve dietas clínicas e não promete resultados de emagrecimento. Em caso de
                condições clínicas, alergias severas ou necessidades nutricionais específicas, procure
                acompanhamento de nutricionista ou médico.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[#E5ECE8] flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl border border-[#DCE4DF] text-sm font-medium text-[#32433C] hover:bg-[#F5F7F5]"
            >
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="text-xs text-[#52635B] hover:text-[#173D32] underline"
            >
              Configurar depois
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-medium hover:bg-[#0F2B23] transition-colors"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold hover:bg-[#0F2B23] transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando perfil...' : 'Concluir e abrir painel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
