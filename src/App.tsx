import { lazy, Suspense, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { LegalModal, type LegalTab } from './components/LegalModal.tsx';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.tsx'));

function shouldBootAuthImmediately(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('acesso') === 'hotmart' ||
      params.get('hotmart') === '1' ||
      params.get('checkout') === 'sucesso'
    ) {
      return true;
    }
    return window.localStorage.getItem('nutrix_has_session') === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [authActivated, setAuthActivated] = useState<boolean>(() => shouldBootAuthImmediately());
  const [initialAuthIntent, setInitialAuthIntent] = useState<{
    openModal: boolean;
    mode: 'login' | 'register';
  }>({ openModal: false, mode: 'login' });
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  if (authActivated) {
    return (
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#F5F7F5] flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="font-display text-2xl font-bold text-[#173D32]">NUTRIX</p>
                <p className="text-xs text-[#52635B]">Carregando sua conta...</p>
              </div>
            </div>
          }
        >
          <AuthenticatedApp
            initialOpenAuthModal={initialAuthIntent.openModal}
            initialAuthMode={initialAuthIntent.mode}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LandingPage
        onStartBasic={() => {
          setInitialAuthIntent({ openModal: true, mode: 'register' });
          setAuthActivated(true);
        }}
        onStartPremium={() => {
          setInitialAuthIntent({ openModal: true, mode: 'register' });
          setAuthActivated(true);
        }}
        onOpenLogin={() => {
          setInitialAuthIntent({ openModal: true, mode: 'login' });
          setAuthActivated(true);
        }}
        onOpenLegal={(tab) => setLegalTab(tab)}
      />
      <LegalModal tab={legalTab} onClose={() => setLegalTab(null)} onChangeTab={setLegalTab} />
    </ErrorBoundary>
  );
}
