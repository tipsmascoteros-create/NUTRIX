import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  Crown,
  LayoutDashboard,
  LogOut,
  Package,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ChefAiModule } from './components/ChefAiModule.tsx';
import { DashboardHome, type WorkspaceTab } from './components/DashboardHome.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { LegalModal, type LegalTab } from './components/LegalModal.tsx';
import { MealPlannerModule } from './components/MealPlannerModule.tsx';
import { NutritionEconomyModule } from './components/NutritionEconomyModule.tsx';
import { OnboardingModal } from './components/OnboardingModal.tsx';
import { PantryModule } from './components/PantryModule.tsx';
import { ProfileAccountModule } from './components/ProfileAccountModule.tsx';
import { UpgradeModal } from './components/UpgradeModal.tsx';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  logoutUser,
  OperationType,
} from './lib/firebase.ts';
import { getCurrentIsoWeekKey } from './lib/formatters.ts';
import {
  ensureUserProfile,
  getAppConfig,
  logAnalyticsEvent,
} from './lib/nutrixService.ts';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type EconomyEntry,
  type NutritionLog,
  type PantryItem,
  type SavedRecipe,
  type ShoppingItem,
  type UserProfile,
  type WeeklyMealPlan,
} from './types/nutrix.ts';

function NutrixWorkspace() {
  const [authReady, setAuthReady] = useState(false);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);

  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [economyEntries, setEconomyEntries] = useState<EconomyEntry[]>([]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [prioritizeExpiringInChef, setPrioritizeExpiringInChef] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [pendingPlanIntent, setPendingPlanIntent] = useState<'basic' | 'premium' | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [upgradeInitialPlan, setUpgradeInitialPlan] = useState<'basic' | 'premium'>('premium');
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const isAdmin = Boolean(
    fbUser?.emailVerified &&
      (fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL || profile?.role === 'admin'),
  );

  // 1. Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        setProfile(null);
        setPantry([]);
        setRecipes([]);
        setMealPlan(null);
        setShoppingList([]);
        setNutritionLogs([]);
        setEconomyEntries([]);
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified) {
        setAuthReady(true);
        return;
      }

      try {
        const [ensured, appCfg] = await Promise.all([
          ensureUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
          }),
          getAppConfig(),
        ]);
        setProfile(ensured);
        setConfig(appCfg);
        if (pendingPlanIntent && ensured.plan === 'free') {
          setUpgradeInitialPlan(pendingPlanIntent);
          setUpgradeReason(
            pendingPlanIntent === 'basic'
              ? 'Finalize sua assinatura do NUTRIX Básico (R$ 19,00/mês) ou conheça o Premium (R$ 37,00/mês) com todos os módulos liberados.'
              : 'Finalize sua assinatura do NUTRIX Premium (R$ 37,00/mês) para liberar todos os módulos desde o primeiro dia.',
          );
          setPendingPlanIntent(null);
        }
      } catch (err) {
        console.error('Failed to bootstrap profile:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [pendingPlanIntent]);

  // 2. Real-time Firestore listeners (STRICTLY attached only when authenticated & verified)
  useEffect(() => {
    if (!authReady || !fbUser || !fbUser.emailVerified || !profile) return;
    const uid = fbUser.uid;
    const weekId = getCurrentIsoWeekKey().replace(/[^a-zA-Z0-9_-]/g, '_');

    const getMillis = (val: unknown): number => {
      if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
        return (val as { toMillis: () => number }).toMillis();
      }
      if (typeof val === 'string') {
        const t = Date.parse(val);
        return Number.isNaN(t) ? 0 : t;
      }
      return 0;
    };
    const sortDesc = <T extends { createdAt?: unknown }>(arr: T[]): T[] =>
      [...arr].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    const unsubs = [
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) setProfile(snap.data() as UserProfile);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, 'pantry'), where('userId', '==', uid)),
        (snap) => {
          setPantry(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PantryItem, 'id'>) })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/pantry`),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, 'recipes'), where('userId', '==', uid)),
        (snap) => {
          setRecipes(
            sortDesc(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedRecipe, 'id'>) })),
            ),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/recipes`),
      ),
      onSnapshot(
        doc(db, 'users', uid, 'mealPlans', weekId),
        (snap) => {
          setMealPlan(
            snap.exists()
              ? ({ id: snap.id, ...(snap.data() as Omit<WeeklyMealPlan, 'id'>) })
              : null,
          );
        },
        (err) =>
          handleFirestoreError(err, OperationType.GET, `users/${uid}/mealPlans/${weekId}`),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, 'shoppingList'), where('userId', '==', uid)),
        (snap) => {
          setShoppingList(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShoppingItem, 'id'>) })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/shoppingList`),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, 'nutritionLogs'), where('userId', '==', uid)),
        (snap) => {
          setNutritionLogs(
            sortDesc(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NutritionLog, 'id'>) })),
            ),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/nutritionLogs`),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, 'purchases'), where('userId', '==', uid)),
        (snap) => {
          setEconomyEntries(
            sortDesc(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EconomyEntry, 'id'>) })),
            ),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/purchases`),
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, fbUser, profile?.uid]);

  const openUpgrade = (reason: string, initialPlan: 'basic' | 'premium' = 'premium') => {
    setUpgradeInitialPlan(initialPlan);
    setUpgradeReason(reason);
    if (profile) {
      void logAnalyticsEvent({
        userId: profile.uid,
        eventName: 'premium_clicked',
        plan: profile.plan,
        metadata: reason.slice(0, 200),
        analyticsConsent: profile.analyticsConsent,
      });
    }
  };

  // Loading boot state
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F7F5] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-bold text-[#173D32]">NUTRIX</p>
          <p className="text-xs text-[#52635B]">Carregando sua cozinha inteligente...</p>
        </div>
      </div>
    );
  }

  // Signed-in via email/password but awaiting email verification
  if (fbUser && !fbUser.emailVerified) {
    return (
      <div className="min-h-screen bg-[#F5F7F5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#DCE4DF] rounded-2xl p-8 text-center space-y-4">
          <p className="font-display text-2xl font-bold text-[#173D32]">NUTRIX</p>
          <h1 className="font-display text-xl font-semibold text-[#111B17]">
            Confirme seu e-mail para continuar
          </h1>
          <p className="text-sm text-[#455750] leading-relaxed">
            Enviamos um link de verificação para <strong>{fbUser.email}</strong>. Por segurança e
            proteção dos seus dados (LGPD), confirme seu e-mail e clique abaixo para entrar.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-[#173D32] text-white text-sm font-semibold"
            >
              Já confirmei meu e-mail
            </button>
            <button
              type="button"
              onClick={() => logoutUser()}
              className="w-full py-2.5 rounded-xl border border-[#DCE4DF] text-xs font-medium text-[#52635B]"
            >
              Sair desta conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Public Landing Page when signed out
  if (!fbUser || !profile) {
    return (
      <>
        <LandingPage
          onStartBasic={() => {
            setPendingPlanIntent('basic');
            setAuthModalMode('register');
            setAuthModalOpen(true);
          }}
          onStartPremium={() => {
            setPendingPlanIntent('premium');
            setAuthModalMode('register');
            setAuthModalOpen(true);
          }}
          onOpenLogin={() => {
            setPendingPlanIntent(null);
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
          onOpenLegal={(tab) => setLegalTab(tab)}
        />
        <AuthModal
          open={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onOpenLegal={(tab) => setLegalTab(tab)}
        />
        <LegalModal tab={legalTab} onClose={() => setLegalTab(null)} onChangeTab={setLegalTab} />
      </>
    );
  }

  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    shortLabel: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'dashboard', label: 'Painel Inicial', shortLabel: 'Início', icon: LayoutDashboard },
    { id: 'pantry', label: 'Minha Despensa', shortLabel: 'Despensa', icon: Package },
    { id: 'chef', label: 'Chef', shortLabel: 'Chef', icon: ChefHat },
    { id: 'planner', label: 'Planejador & Compras', shortLabel: 'Semana', icon: CalendarDays },
    { id: 'nutrition_economy', label: 'Nutrição & Economia', shortLabel: 'Economia', icon: BarChart3 },
    { id: 'account', label: 'Conta & LGPD', shortLabel: 'Conta', icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Administração', shortLabel: 'Admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#111B17] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-[#173D32] text-white flex-col justify-between p-5 sticky top-0 h-screen">
        <div>
          <div className="px-2 pb-6 border-b border-white/15">
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              NUTRIX
            </span>
            <p className="text-[11px] text-[#C3F28B] mt-0.5">Sua alimentação, mais inteligente.</p>
          </div>

          <nav className="mt-5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'chef') setPrioritizeExpiringInChef(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#C3F28B] text-[#173D32] font-semibold'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/15">
          {profile.plan === 'free' && (
            <button
              type="button"
              onClick={() =>
                openUpgrade(
                  'Evolua para o NUTRIX Premium (R$ 37,00/mês) e desbloqueie foto da geladeira, despensa ilimitada, planejador semanal e análise econômica.',
                )
              }
              className="w-full p-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C3F28B]">
                <Crown className="w-4 h-4" />
                <span>NUTRIX Premium</span>
              </div>
              <p className="text-[11px] text-white/80 mt-1">
                Desbloquear todos os recursos por R$ {config.premiumPriceBrl},00/mês
              </p>
            </button>
          )}

          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{profile.displayName}</p>
              <p className="text-[11px] text-white/70 truncate">
                {profile.plan === 'premium' ? 'Plano Premium' : 'Plano Básico'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logoutUser()}
              aria-label="Sair"
              className="p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Mobile Header (keeps sticky footprint strictly <= 15% of viewport) */}
        <header className="lg:hidden sticky top-0 z-30 h-13 bg-[#173D32] text-white px-4 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight">NUTRIX</span>
          <div className="flex items-center gap-3">
            {profile.plan === 'free' && (
              <button
                type="button"
                onClick={() => openUpgrade('Desbloqueie o NUTRIX Premium por R$ 37,00/mês.')}
                className="px-3 py-1 rounded-lg bg-[#C3F28B] text-[#173D32] text-xs font-bold whitespace-nowrap"
              >
                Premium
              </button>
            )}
            <button
              type="button"
              onClick={() => logoutUser()}
              aria-label="Sair"
              className="p-1.5 text-white/80"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardHome
              profile={profile}
              config={config}
              pantry={pantry}
              recipes={recipes}
              mealPlan={mealPlan}
              shoppingList={shoppingList}
              nutritionLogs={nutritionLogs}
              economyEntries={economyEntries}
              onNavigate={setActiveTab}
              onOpenUpgrade={openUpgrade}
              onQuickCookExpiring={() => {
                setPrioritizeExpiringInChef(true);
                setActiveTab('chef');
              }}
            />
          )}

          {activeTab === 'pantry' && (
            <PantryModule
              profile={profile}
              config={config}
              pantry={pantry}
              onOpenUpgrade={openUpgrade}
            />
          )}

          {activeTab === 'chef' && (
            <ChefAiModule
              profile={profile}
              config={config}
              pantry={pantry}
              recipes={recipes}
              initialPrioritizeExpiring={prioritizeExpiringInChef}
              onOpenUpgrade={openUpgrade}
            />
          )}

          {activeTab === 'planner' && (
            <MealPlannerModule
              profile={profile}
              config={config}
              pantry={pantry}
              recipes={recipes}
              mealPlan={mealPlan}
              shoppingList={shoppingList}
              onOpenUpgrade={openUpgrade}
            />
          )}

          {activeTab === 'nutrition_economy' && (
            <NutritionEconomyModule
              profile={profile}
              pantry={pantry}
              recipes={recipes}
              nutritionLogs={nutritionLogs}
              economyEntries={economyEntries}
              onOpenUpgrade={openUpgrade}
              onCookExpiring={() => {
                setPrioritizeExpiringInChef(true);
                setActiveTab('chef');
              }}
            />
          )}

          {activeTab === 'account' && (
            <ProfileAccountModule
              profile={profile}
              onOpenUpgrade={openUpgrade}
              onOpenLegal={(tab) => setLegalTab(tab)}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminPanel config={config} onConfigUpdated={setConfig} />
          )}
        </main>

        {/* Compact Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#DCE4DF] h-14 px-2 flex items-center justify-around">
          {navItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                  active ? 'text-[#173D32] font-bold' : 'text-[#6B7D75]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="whitespace-nowrap">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Modals */}
      {!profile.onboardingCompleted && (
        <OnboardingModal profile={profile} onComplete={() => {}} />
      )}

      <UpgradeModal
        open={upgradeReason !== null}
        reason={upgradeReason || undefined}
        initialPlan={upgradeInitialPlan}
        profile={profile}
        basicPriceBrl={19}
        priceBrl={config.premiumPriceBrl}
        onClose={() => setUpgradeReason(null)}
      />

      <LegalModal tab={legalTab} onClose={() => setLegalTab(null)} onChangeTab={setLegalTab} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NutrixWorkspace />
    </ErrorBoundary>
  );
}
