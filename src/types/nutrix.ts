export type PlanType = 'free' | 'premium';
export type UserRole = 'user' | 'admin';
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';
export type SubscriptionProvider = 'none' | 'stripe' | 'mercadopago';

export type PantryCategory =
  | 'carnes'
  | 'frutas'
  | 'verduras'
  | 'graos'
  | 'laticinios'
  | 'temperos'
  | 'massas'
  | 'enlatados'
  | 'congelados'
  | 'outros';

export type MeasureUnit = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'colher' | 'xicara' | 'pacote';
export type StorageLocation = 'geladeira' | 'despensa' | 'freezer' | 'bancada';
export type PantryStatus = 'available' | 'consumed' | 'discarded';
export type MealType = 'cafe' | 'almoco' | 'lanche' | 'jantar';
export type RecipeImageKey = 'frango' | 'omelete' | 'veggie' | 'hero';

export type AnalyticsEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'first_ingredient_added'
  | 'first_recipe_generated'
  | 'free_limit_reached'
  | 'premium_clicked'
  | 'checkout_started'
  | 'payment_approved'
  | 'subscription_canceled'
  | 'photo_scan_used'
  | 'meal_plan_generated'
  | 'ai_error';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  plan: PlanType;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionProvider: SubscriptionProvider;
  subscriptionRenewsAt: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: string;
  activityLevel: string;
  mealsPerDay: number;
  weeklyBudgetBrl: number;
  monthlyBudgetBrl: number;
  restrictions: string[];
  allergies: string[];
  dislikes: string[];
  favoriteIngredients: string[];
  onboardingCompleted: boolean;
  lgpdConsentAt: string;
  analyticsConsent: boolean;
  weeklyRecipesCount: number;
  weeklyRecipesResetAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  tacoKey: string;
  category: PantryCategory;
  quantity: number;
  unit: MeasureUnit;
  minThreshold: number;
  purchasePriceBrl: number;
  priceUnitQty: number;
  expiryDate: string; // YYYY-MM-DD or ''
  storageLocation: StorageLocation;
  status: PantryStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  gramsEstimate: number;
  inPantry: boolean;
  estimatedCostBrl: number;
  priceSource: 'user' | 'none';
  tacoMatched: boolean;
}

export interface NutritionBreakdown {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG: number | null;
  fiberG: number;
  sugarG: number | null;
  sodiumMg: number;
  calciumMg: number | null;
  ironMg: number | null;
  vitaminCMg: number | null;
  potassiumMg: number | null;
  sourceLabel: string;
  isEstimate: boolean;
  matchedRatio: number;
}

export interface SavedRecipe {
  id: string;
  userId: string;
  title: string;
  description: string;
  imageKey: RecipeImageKey;
  prepTimeMin: number;
  difficulty: 'Fácil' | 'Média' | 'Elaborada';
  servings: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  missingIngredients: string[];
  steps: string[];
  substitutions: string[];
  sideDishes: string[];
  nutritionPerServing: NutritionBreakdown;
  totalCostBrl: number;
  costPerServingBrl: number;
  hasUserPrices: boolean;
  isFavorite: boolean;
  timesCooked: number;
  rating: number;
  lastCookedAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MealSlot {
  title: string;
  recipeId: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimatedCostBrl: number;
  prepTimeMin: number;
  ingredientsList?: string[];
}

export interface MealPlanDay {
  dayKey: string;
  dayLabel: string;
  breakfast: MealSlot;
  lunch: MealSlot;
  snack: MealSlot;
  dinner: MealSlot;
}

export interface WeeklyMealPlan {
  id: string;
  userId: string;
  weekKey: string;
  servings: number;
  days: MealPlanDay[];
  totalEstimatedCostBrl: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ShoppingItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedPriceBrl: number;
  priceSource: 'user' | 'estimate' | 'none';
  checked: boolean;
  source: 'meal_plan' | 'recipe' | 'manual';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  mealType: MealType;
  title: string;
  recipeId: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  costBrl: number;
  createdAt?: unknown;
}

export interface EconomyEntry {
  id: string;
  userId: string;
  type: 'purchase' | 'saved_waste' | 'discarded';
  itemName: string;
  category: string;
  amountBrl: number;
  quantity: number;
  unit: string;
  date: string;
  notes: string;
  createdAt?: unknown;
}

export interface AnalyticsEventRecord {
  id: string;
  userId: string;
  eventName: AnalyticsEventName;
  plan: PlanType;
  metadata: string;
  createdAt?: unknown;
}

export interface AppConfig {
  freeMaxIngredients: number;
  freeWeeklyRecipes: number;
  freeHistoryLimit: number;
  premiumPriceBrl: number;
  premiumDailyAiCap: number;
  enablePhotoRecognition: boolean;
  enableWeeklyPlanner: boolean;
  updatedAt?: unknown;
}

export interface RecognizedIngredient {
  name: string;
  confidence: 'alta' | 'media' | 'baixa';
  suggestedCategory: PantryCategory;
  suggestedQuantity: number;
  suggestedUnit: MeasureUnit;
  quantityNeedsConfirmation: boolean;
  notes: string;
  selected?: boolean;
}

export interface PaymentConfigStatus {
  stripeConfigured: boolean;
  stripeBasicConfigured: boolean;
  mercadoPagoConfigured: boolean;
  basicPriceBrl: number;
  priceBrl: number;
  missingEnvVars: {
    stripe: string[];
    mercadoPago: string[];
  };
}

export interface EconomyTipResult {
  summary: string;
  substitutions: {
    original: string;
    suggestion: string;
    reason: string;
  }[];
  zeroWasteActions: string[];
  budgetAdvice: string[];
}

export const PANTRY_CATEGORY_LABELS: Record<PantryCategory, string> = {
  carnes: 'Carnes e proteínas',
  frutas: 'Frutas',
  verduras: 'Verduras e legumes',
  graos: 'Grãos e cereais',
  laticinios: 'Laticínios',
  temperos: 'Temperos',
  massas: 'Massas',
  enlatados: 'Enlatados',
  congelados: 'Congelados',
  outros: 'Outros',
};

export const STORAGE_LOCATION_LABELS: Record<StorageLocation, string> = {
  geladeira: 'Geladeira',
  despensa: 'Despensa',
  freezer: 'Freezer',
  bancada: 'Bancada / Fruteira',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  cafe: 'Café da manhã',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
};

export const NUTRITION_GOALS = [
  'Comer de maneira mais equilibrada',
  'Melhorar a qualidade da alimentação',
  'Organizar a rotina alimentar',
  'Aumentar o consumo de proteínas',
  'Controlar a ingestão calórica',
  'Economizar na alimentação',
] as const;

export const DEFAULT_APP_CONFIG: AppConfig = {
  freeMaxIngredients: 30,
  freeWeeklyRecipes: 12,
  freeHistoryLimit: 15,
  premiumPriceBrl: 37,
  premiumDailyAiCap: 60,
  enablePhotoRecognition: true,
  enableWeeklyPlanner: true,
};
