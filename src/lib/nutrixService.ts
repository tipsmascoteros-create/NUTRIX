import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  DEFAULT_APP_CONFIG,
  type AnalyticsEventName,
  type AnalyticsEventRecord,
  type AppConfig,
  type EconomyEntry,
  type EntitlementStatus,
  type MealPlanDay,
  type NutritionLog,
  type PantryItem,
  type PlanType,
  type SavedRecipe,
  type ShoppingItem,
  type SubscriptionEntitlement,
  type SubscriptionProvider,
  type UserProfile,
  type WeeklyMealPlan,
} from '../types/nutrix.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import { getCurrentIsoWeekKey } from './formatters.ts';

function generateSafeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampStringList(arr: string[] | undefined, maxItems: number, maxLen = 60): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s).trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

// --- Analytics & Conversion Tracking (LGPD Consent-Aware) ---
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export async function logAnalyticsEvent(params: {
  userId: string;
  eventName: AnalyticsEventName;
  plan: PlanType;
  metadata?: string;
  analyticsConsent?: boolean;
}) {
  const eventId = generateSafeId('evt');
  const path = `analyticsEvents/${eventId}`;
  try {
    await setDoc(doc(db, 'analyticsEvents', eventId), {
      userId: params.userId,
      eventName: params.eventName,
      plan: params.plan,
      metadata: (params.metadata || '').slice(0, 400),
      createdAt: serverTimestamp(),
    });

    // Optional GA4 / Meta Pixel dispatch ONLY when user consented under LGPD
    if (params.analyticsConsent) {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', params.eventName, { plan: params.plan });
      }
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        const isBasicTarget = (params.metadata || '').includes('target:basic');
        const value = isBasicTarget ? 19 : 37;
        if (params.eventName === 'signup_completed') {
          window.fbq('track', 'CompleteRegistration', { content_name: 'NUTRIX' });
        } else if (params.eventName === 'checkout_started') {
          window.fbq('track', 'InitiateCheckout', { currency: 'BRL', value });
        } else if (params.eventName === 'payment_approved') {
          window.fbq('track', 'Purchase', { currency: 'BRL', value });
        }
        window.fbq('trackCustom', params.eventName, { plan: params.plan });
      }
    }
  } catch (error) {
    // Non-blocking for user UX, but logged for diagnostics
    console.warn('Analytics event failed:', path, error);
  }
}

// --- User Profile ---
export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', params.uid);
  const path = `users/${params.uid}`;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const weekKey = getCurrentIsoWeekKey();
    const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: params.uid,
      email: (params.email || '').slice(0, 254),
      displayName: (params.displayName || params.email.split('@')[0] || 'Usuário NUTRIX').slice(0, 120),
      plan: 'free',
      role: 'user',
      subscriptionStatus: 'none',
      subscriptionProvider: 'none',
      subscriptionRenewsAt: '',
      age: 0,
      heightCm: 0,
      weightKg: 0,
      goal: 'Comer de maneira mais equilibrada',
      activityLevel: 'Moderado',
      mealsPerDay: 4,
      weeklyBudgetBrl: 200,
      monthlyBudgetBrl: 800,
      restrictions: [],
      allergies: [],
      dislikes: [],
      favoriteIngredients: [],
      onboardingCompleted: false,
      lgpdConsentAt: new Date().toISOString().slice(0, 30),
      analyticsConsent: true,
      weeklyRecipesCount: 0,
      weeklyRecipesResetAt: weekKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    await logAnalyticsEvent({
      userId: params.uid,
      eventName: 'signup_completed',
      plan: 'free',
      metadata: 'google_or_email_signup',
      analyticsConsent: true,
    });
    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'age'
      | 'heightCm'
      | 'weightKg'
      | 'goal'
      | 'activityLevel'
      | 'mealsPerDay'
      | 'weeklyBudgetBrl'
      | 'monthlyBudgetBrl'
      | 'restrictions'
      | 'allergies'
      | 'dislikes'
      | 'favoriteIngredients'
      | 'onboardingCompleted'
      | 'lgpdConsentAt'
      | 'analyticsConsent'
    >
  >,
) {
  const path = `users/${uid}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.displayName !== undefined) clean.displayName = String(updates.displayName).slice(0, 120);
  if (updates.age !== undefined) clean.age = Math.max(0, Math.min(120, Number(updates.age) || 0));
  if (updates.heightCm !== undefined) clean.heightCm = Math.max(0, Math.min(260, Number(updates.heightCm) || 0));
  if (updates.weightKg !== undefined) clean.weightKg = Math.max(0, Math.min(400, Number(updates.weightKg) || 0));
  if (updates.goal !== undefined) clean.goal = String(updates.goal).slice(0, 80);
  if (updates.activityLevel !== undefined) clean.activityLevel = String(updates.activityLevel).slice(0, 60);
  if (updates.mealsPerDay !== undefined) clean.mealsPerDay = Math.max(1, Math.min(8, Number(updates.mealsPerDay) || 4));
  if (updates.weeklyBudgetBrl !== undefined) clean.weeklyBudgetBrl = Math.max(0, Math.min(50000, Number(updates.weeklyBudgetBrl) || 0));
  if (updates.monthlyBudgetBrl !== undefined) clean.monthlyBudgetBrl = Math.max(0, Math.min(200000, Number(updates.monthlyBudgetBrl) || 0));
  if (updates.restrictions !== undefined) clean.restrictions = clampStringList(updates.restrictions, 15);
  if (updates.allergies !== undefined) clean.allergies = clampStringList(updates.allergies, 15);
  if (updates.dislikes !== undefined) clean.dislikes = clampStringList(updates.dislikes, 20);
  if (updates.favoriteIngredients !== undefined) clean.favoriteIngredients = clampStringList(updates.favoriteIngredients, 20);
  if (updates.onboardingCompleted !== undefined) clean.onboardingCompleted = Boolean(updates.onboardingCompleted);
  if (updates.lgpdConsentAt !== undefined) clean.lgpdConsentAt = String(updates.lgpdConsentAt).slice(0, 40);
  if (updates.analyticsConsent !== undefined) clean.analyticsConsent = Boolean(updates.analyticsConsent);

  try {
    await updateDoc(doc(db, 'users', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function incrementWeeklyRecipeCounter(profile: UserProfile) {
  const path = `users/${profile.uid}`;
  const currentWeek = getCurrentIsoWeekKey();
  const nextCount = profile.weeklyRecipesResetAt === currentWeek ? profile.weeklyRecipesCount + 1 : 1;
  try {
    await updateDoc(doc(db, 'users', profile.uid), {
      weeklyRecipesCount: nextCount,
      weeklyRecipesResetAt: currentWeek,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Pantry CRUD ---
export async function addPantryItem(
  uid: string,
  item: Omit<PantryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = generateSafeId('pan');
  const path = `users/${uid}/pantry/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'pantry', id), {
      userId: uid,
      name: item.name.trim().slice(0, 120),
      tacoKey: (item.tacoKey || 'custom').slice(0, 80),
      category: item.category,
      quantity: Math.max(0, Math.min(100000, Number(item.quantity) || 0)),
      unit: item.unit,
      minThreshold: Math.max(0, Math.min(100000, Number(item.minThreshold) || 0)),
      purchasePriceBrl: Math.max(0, Math.min(10000, Number(item.purchasePriceBrl) || 0)),
      priceUnitQty: Math.max(0, Math.min(100000, Number(item.priceUnitQty) || Number(item.quantity) || 1)),
      expiryDate: (item.expiryDate || '').slice(0, 20),
      storageLocation: item.storageLocation,
      status: item.status || 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePantryItem(
  uid: string,
  itemId: string,
  updates: Partial<Omit<PantryItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
) {
  const path = `users/${uid}/pantry/${itemId}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) clean.name = updates.name.trim().slice(0, 120);
  if (updates.tacoKey !== undefined) clean.tacoKey = updates.tacoKey.slice(0, 80);
  if (updates.category !== undefined) clean.category = updates.category;
  if (updates.quantity !== undefined) clean.quantity = Math.max(0, Math.min(100000, Number(updates.quantity) || 0));
  if (updates.unit !== undefined) clean.unit = updates.unit;
  if (updates.minThreshold !== undefined) clean.minThreshold = Math.max(0, Math.min(100000, Number(updates.minThreshold) || 0));
  if (updates.purchasePriceBrl !== undefined) clean.purchasePriceBrl = Math.max(0, Math.min(10000, Number(updates.purchasePriceBrl) || 0));
  if (updates.priceUnitQty !== undefined) clean.priceUnitQty = Math.max(0, Math.min(100000, Number(updates.priceUnitQty) || 0));
  if (updates.expiryDate !== undefined) clean.expiryDate = updates.expiryDate.slice(0, 20);
  if (updates.storageLocation !== undefined) clean.storageLocation = updates.storageLocation;
  if (updates.status !== undefined) clean.status = updates.status;

  try {
    await updateDoc(doc(db, 'users', uid, 'pantry', itemId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePantryItem(uid: string, itemId: string) {
  const path = `users/${uid}/pantry/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'pantry', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Recipes CRUD ---
export async function saveGeneratedRecipe(
  uid: string,
  recipe: Omit<SavedRecipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = generateSafeId('rec');
  const path = `users/${uid}/recipes/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'recipes', id), {
      userId: uid,
      title: recipe.title.slice(0, 160),
      description: recipe.description.slice(0, 600),
      imageKey: recipe.imageKey,
      prepTimeMin: Math.max(1, Math.min(480, Math.round(recipe.prepTimeMin))),
      difficulty: recipe.difficulty,
      servings: Math.max(1, Math.min(24, Math.round(recipe.servings))),
      tags: clampStringList(recipe.tags, 10, 40),
      ingredients: recipe.ingredients.slice(0, 30),
      missingIngredients: clampStringList(recipe.missingIngredients, 15, 120),
      steps: clampStringList(recipe.steps, 20, 360),
      substitutions: clampStringList(recipe.substitutions, 10, 200),
      sideDishes: clampStringList(recipe.sideDishes, 8, 120),
      nutritionPerServing: recipe.nutritionPerServing,
      totalCostBrl: Math.max(0, Math.min(5000, Number(recipe.totalCostBrl) || 0)),
      costPerServingBrl: Math.max(0, Math.min(5000, Number(recipe.costPerServingBrl) || 0)),
      hasUserPrices: Boolean(recipe.hasUserPrices),
      isFavorite: Boolean(recipe.isFavorite),
      timesCooked: Number(recipe.timesCooked) || 0,
      rating: Math.max(0, Math.min(5, Number(recipe.rating) || 0)),
      lastCookedAt: (recipe.lastCookedAt || '').slice(0, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRecipeFeedback(
  uid: string,
  recipeId: string,
  updates: Partial<Pick<SavedRecipe, 'isFavorite' | 'timesCooked' | 'rating' | 'lastCookedAt'>>,
) {
  const path = `users/${uid}/recipes/${recipeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'recipes', recipeId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavedRecipe(uid: string, recipeId: string) {
  const path = `users/${uid}/recipes/${recipeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'recipes', recipeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Weekly Meal Plan ---
export async function saveWeeklyMealPlan(
  uid: string,
  weekKey: string,
  servings: number,
  days: MealPlanDay[],
  totalEstimatedCostBrl: number,
) {
  const safeWeekId = weekKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${uid}/mealPlans/${safeWeekId}`;
  const ref = doc(db, 'users', uid, 'mealPlans', safeWeekId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        servings: Math.max(1, Math.min(12, servings)),
        days: days.slice(0, 7),
        totalEstimatedCostBrl: Math.max(0, Number(totalEstimatedCostBrl) || 0),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        weekKey: safeWeekId,
        servings: Math.max(1, Math.min(12, servings)),
        days: days.slice(0, 7),
        totalEstimatedCostBrl: Math.max(0, Number(totalEstimatedCostBrl) || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Shopping List ---
export async function addShoppingItem(
  uid: string,
  item: Omit<ShoppingItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = generateSafeId('shop');
  const path = `users/${uid}/shoppingList/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'shoppingList', id), {
      userId: uid,
      name: item.name.trim().slice(0, 120),
      category: (item.category || 'outros').slice(0, 40),
      quantity: Math.max(0, Math.min(100000, Number(item.quantity) || 1)),
      unit: (item.unit || 'un').slice(0, 20),
      estimatedPriceBrl: Math.max(0, Math.min(10000, Number(item.estimatedPriceBrl) || 0)),
      priceSource: item.priceSource || 'none',
      checked: Boolean(item.checked),
      source: item.source || 'manual',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleShoppingItem(uid: string, itemId: string, checked: boolean) {
  const path = `users/${uid}/shoppingList/${itemId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'shoppingList', itemId), {
      checked,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteShoppingItem(uid: string, itemId: string) {
  const path = `users/${uid}/shoppingList/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'shoppingList', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Nutrition Logs ---
export async function addNutritionLog(
  uid: string,
  entry: Omit<NutritionLog, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const id = generateSafeId('nut');
  const path = `users/${uid}/nutritionLogs/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'nutritionLogs', id), {
      userId: uid,
      date: entry.date.slice(0, 20),
      mealType: entry.mealType,
      title: entry.title.slice(0, 160),
      recipeId: (entry.recipeId || '').slice(0, 128),
      servings: Math.max(0.25, Math.min(20, Number(entry.servings) || 1)),
      calories: Math.max(0, Math.min(10000, Math.round(entry.calories))),
      proteinG: Math.max(0, Math.min(1000, Number(entry.proteinG.toFixed(1)))),
      carbsG: Math.max(0, Math.min(1500, Number(entry.carbsG.toFixed(1)))),
      fatG: Math.max(0, Math.min(1000, Number(entry.fatG.toFixed(1)))),
      fiberG: Math.max(0, Math.min(300, Number(entry.fiberG.toFixed(1)))),
      sodiumMg: Math.max(0, Math.min(20000, Math.round(entry.sodiumMg))),
      costBrl: Math.max(0, Math.min(5000, Number(entry.costBrl.toFixed(2)))),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteNutritionLog(uid: string, logId: string) {
  const path = `users/${uid}/nutritionLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'nutritionLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Economy & Zero Waste Entries ---
export async function addEconomyEntry(
  uid: string,
  entry: Omit<EconomyEntry, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const id = generateSafeId('eco');
  const path = `users/${uid}/purchases/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'purchases', id), {
      userId: uid,
      type: entry.type,
      itemName: entry.itemName.trim().slice(0, 120),
      category: (entry.category || 'outros').slice(0, 40),
      amountBrl: Math.max(0, Math.min(50000, Number(entry.amountBrl) || 0)),
      quantity: Math.max(0, Math.min(100000, Number(entry.quantity) || 1)),
      unit: (entry.unit || 'un').slice(0, 20),
      date: entry.date.slice(0, 20),
      notes: (entry.notes || '').slice(0, 240),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteEconomyEntry(uid: string, entryId: string) {
  const path = `users/${uid}/purchases/${entryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'purchases', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Global App Config ---
export async function getAppConfig(): Promise<AppConfig> {
  const path = 'appConfig/plans';
  try {
    const snap = await getDoc(doc(db, 'appConfig', 'plans'));
    if (snap.exists()) {
      return snap.data() as AppConfig;
    }
    return DEFAULT_APP_CONFIG;
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export async function saveAppConfig(config: Omit<AppConfig, 'updatedAt'>) {
  const path = 'appConfig/plans';
  try {
    await setDoc(doc(db, 'appConfig', 'plans'), {
      ...config,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Admin Queries ---
export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAnalyticsEventsForAdmin(): Promise<AnalyticsEventRecord[]> {
  const path = 'analyticsEvents';
  try {
    const snap = await getDocs(
      query(collection(db, 'analyticsEvents'), orderBy('createdAt', 'desc'), limit(400)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AnalyticsEventRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminUpdateUserPlan(
  targetUid: string,
  plan: PlanType,
  subscriptionStatus: UserProfile['subscriptionStatus'],
  subscriptionProvider?: SubscriptionProvider,
) {
  const path = `users/${targetUid}`;
  const payload: Record<string, unknown> = {
    plan,
    subscriptionStatus,
    updatedAt: serverTimestamp(),
  };
  if (subscriptionProvider) {
    payload.subscriptionProvider = subscriptionProvider;
  }
  try {
    await updateDoc(doc(db, 'users', targetUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Subscription Entitlements (Hotmart & Admin Email-Based Access) ---
function emailToSafeEntitlementId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const slug = normalized
    .replace(/@/g, '_at_')
    .replace(/\./g, '_dot_')
    .replace(/[^a-z0-9_-]/g, '_');
  return `ent_${slug}`.slice(0, 120);
}

export async function fetchMyFirestoreEntitlement(
  email: string,
): Promise<SubscriptionEntitlement | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const path = 'entitlements';
  try {
    const snap = await getDocs(
      query(collection(db, 'entitlements'), where('email', '==', normalized), limit(5)),
    );
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SubscriptionEntitlement, 'id'>),
    }));
    const active = docs.find((d) => d.status === 'active');
    return active || docs[0];
  } catch (error) {
    console.warn('Entitlement lookup warning:', path, error);
    return null;
  }
}

export async function fetchAllEntitlementsForAdmin(): Promise<SubscriptionEntitlement[]> {
  const path = 'entitlements';
  try {
    const snap = await getDocs(query(collection(db, 'entitlements'), limit(300)));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SubscriptionEntitlement, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminUpsertEntitlementByEmail(params: {
  email: string;
  buyerName?: string;
  plan: PlanType;
  status: EntitlementStatus;
  provider?: 'hotmart' | 'admin';
  hotmartOfferCode?: string;
  hotmartTransaction?: string;
}): Promise<string> {
  const normalizedEmail = params.email.trim().toLowerCase().slice(0, 254);
  const id = emailToSafeEntitlementId(normalizedEmail);
  const ref = doc(db, 'entitlements', id);
  const path = `entitlements/${id}`;
  try {
    const existing = await getDoc(ref);
    const offerCode =
      (params.hotmartOfferCode || '').trim().slice(0, 40) ||
      (params.plan === 'premium' ? 'cq053m7c' : '726sm43a');

    if (existing.exists()) {
      await updateDoc(ref, {
        email: normalizedEmail,
        buyerName: (params.buyerName || '').trim().slice(0, 120),
        plan: params.plan,
        status: params.status,
        provider: params.provider || 'hotmart',
        hotmartOfferCode: offerCode,
        hotmartTransaction: (params.hotmartTransaction || '').trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        email: normalizedEmail,
        buyerName: (params.buyerName || '').trim().slice(0, 120),
        plan: params.plan,
        status: params.status,
        provider: params.provider || 'hotmart',
        hotmartOfferCode: offerCode,
        hotmartTransaction: (params.hotmartTransaction || '').trim().slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminDeleteEntitlement(entitlementId: string): Promise<void> {
  const path = `entitlements/${entitlementId}`;
  try {
    await deleteDoc(doc(db, 'entitlements', entitlementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- LGPD Compliance: Full Data Export & Permanent Account Deletion ---
export async function exportUserDataLgpd(uid: string) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  const subcollections = ['pantry', 'recipes', 'mealPlans', 'shoppingList', 'nutritionLogs', 'purchases'] as const;
  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    lawReference: 'LGPD — Lei nº 13.709/2018 (Portabilidade e Acesso aos Dados)',
    profile: userSnap.exists() ? userSnap.data() : null,
  };

  for (const sub of subcollections) {
    const snap = await getDocs(query(collection(db, 'users', uid, sub), where('userId', '==', uid)));
    result[sub] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return result;
}

export async function deleteAllUserDataLgpd(uid: string) {
  const subcollections = ['pantry', 'recipes', 'mealPlans', 'shoppingList', 'nutritionLogs', 'purchases'] as const;
  for (const sub of subcollections) {
    const snap = await getDocs(query(collection(db, 'users', uid, sub), where('userId', '==', uid)));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
  await deleteDoc(doc(db, 'users', uid));
}
