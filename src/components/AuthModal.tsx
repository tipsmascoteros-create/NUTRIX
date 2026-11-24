import { useState } from 'react';
import { ArrowRight, Lock, Mail, User, X } from 'lucide-react';
import {
  registerWithEmail,
  resetUserPassword,
  signInWithEmail,
  signInWithGoogle,
} from '../lib/firebase.ts';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  fromHotmartPurchase?: boolean;
  onClose: () => void;
  onOpenLegal: (tab: 'privacidade' | 'termos') => void;
}

export function AuthModal({
  open,
  initialMode = 'register',
  fromHotmartPurchase = false,
  onClose,
  onOpenLegal,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLgpd, setAcceptedLgpd] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!open) return null;

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    if (mode === 'register' && !acceptedLgpd) {
      setError('Aceite os Termos de Uso e a Política de Privacidade (LGPD) para criar sua conta.');
      return;
    }
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível autenticar com Google.';
      setError(
        msg.includes('popup-closed-by-user')
          ? 'Login cancelado. Clique novamente para entrar com sua conta Google.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'reset') {
        await resetUserPassword(email);
        setInfo('Enviamos um link de recuperação de senha para o seu e-mail.');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }

      if (mode === 'register') {
        if (!acceptedLgpd) {
          setError('É necessário concordar com a Política de Privacidade (LGPD).');
          setLoading(false);
          return;
        }
        await registerWithEmail(name, email, password);
        setInfo(
          'Conta criada! Enviamos um link de verificação para o seu e-mail. Confirme seu e-mail e recarregue para liberar o acesso completo.',
        );
      } else {
        await signInWithEmail(email, password);
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar.';
      if (msg.includes('operation-not-allowed')) {
        setError(
          'O login por e-mail/senha precisa ser ativado no Firebase Console (Authentication > Sign-in method). Você já pode entrar imediatamente usando sua conta Google acima.',
        );
      } else if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setError('E-mail ou senha incorretos. Verifique seus dados ou recupere sua senha.');
      } else if (msg.includes('email-already-in-use')) {
        setError('Este e-mail já possui uma conta cadastrada. Faça login.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Acesso à conta NUTRIX"
    >
      <div className="bg-white border border-[#DCE4DF] rounded-2xl max-w-md w-full p-6 sm:p-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-5 right-5 p-2 rounded-lg text-[#52635B] hover:text-[#111B17] hover:bg-[#F5F7F5]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="font-display text-lg font-bold tracking-tight text-[#173D32]">
            NUTRIX
          </span>
          <h2 className="font-display text-2xl font-semibold text-[#111B17] mt-2">
            {mode === 'login'
              ? 'Entrar na sua cozinha inteligente'
              : mode === 'register'
                ? 'Crie sua conta no NUTRIX'
                : 'Recuperar acesso'}
          </h2>
          <p className="text-sm text-[#52635B] mt-1">
            {mode === 'reset'
              ? 'Informe seu e-mail cadastrado para receber o link de redefinição.'
              : 'Planos Básico (R$ 19,00/mês) e Premium (R$ 37,00/mês), sem fidelidade.'}
          </p>
        </div>

        {mode !== 'reset' && (
          <div
            className={`mb-5 p-3.5 rounded-xl border text-xs leading-relaxed ${
              fromHotmartPurchase
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-[#F5F7F5] border-[#DCE4DF] text-[#32433C]'
            }`}
          >
            <strong className="font-semibold text-[#173D32]">
              {fromHotmartPurchase ? 'Compra confirmada na Hotmart? ' : 'Já assinou na Hotmart? '}
            </strong>
            Entre ou crie sua conta usando o <strong>mesmo e-mail da compra</strong> para liberar
            seu plano automaticamente.
          </div>
        )}

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full py-3 px-4 rounded-xl bg-[#173D32] text-white font-medium text-sm hover:bg-[#0F2B23] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              <span>Continuar com Google</span>
              <ArrowRight className="w-4 h-4 text-[#C3F28B]" />
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-[#E5ECE8] flex-1" />
              <span className="text-xs text-[#52635B]">ou com e-mail</span>
              <div className="h-px bg-[#E5ECE8] flex-1" />
            </div>
          </>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">Nome</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#6B7D75] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como prefere ser chamado?"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-[#F5F7F5]/60 focus:bg-white focus:border-[#173D32] outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#32433C] mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B7D75] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com.br"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-[#F5F7F5]/60 focus:bg-white focus:border-[#173D32] outline-none"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[#32433C] mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7D75] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#DCE4DF] bg-[#F5F7F5]/60 focus:bg-white focus:border-[#173D32] outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-[#52635B] pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedLgpd}
                onChange={(e) => setAcceptedLgpd(e.target.checked)}
                className="mt-0.5 rounded accent-[#173D32]"
              />
              <span>
                Concordo com os{' '}
                <button
                  type="button"
                  onClick={() => onOpenLegal('termos')}
                  className="underline text-[#173D32] font-medium"
                >
                  Termos de Uso
                </button>{' '}
                e com o tratamento dos meus dados alimentares conforme a{' '}
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacidade')}
                  className="underline text-[#173D32] font-medium"
                >
                  Política de Privacidade (LGPD)
                </button>
                .
              </span>
            </label>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl border border-[#173D32] text-[#173D32] font-medium text-sm hover:bg-[#F5F7F5] transition-colors disabled:opacity-60"
          >
            {loading
              ? 'Processando...'
              : mode === 'login'
                ? 'Entrar com e-mail'
                : mode === 'register'
                  ? 'Criar conta com e-mail'
                  : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E5ECE8] flex items-center justify-between text-xs text-[#52635B]">
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setInfo('');
                }}
                className="hover:text-[#173D32] underline"
              >
                Esqueci minha senha
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setInfo('');
                }}
                className="font-semibold text-[#173D32] hover:underline"
              >
                Criar conta
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setInfo('');
              }}
              className="font-semibold text-[#173D32] hover:underline ml-auto"
            >
              Já tenho conta — Entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
