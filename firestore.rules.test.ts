/**
 * NUTRIX Firestore Security Rules Verification Spec (Phase 0 TDD)
 * Validates that all 12 Dirty Dozen adversarial payloads are denied
 * and legitimate owner/admin operations satisfy all Eight Pillars.
 */
export interface SecurityTestCase {
  id: string;
  name: string;
  actor: { uid: string; email: string; email_verified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Self-Upgrade to Premium on User Create',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'create',
    path: '/users/user_a',
    payload: { uid: 'user_a', plan: 'premium', role: 'user', subscriptionStatus: 'active' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Self-Upgrade to Premium on User Update',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'update',
    path: '/users/user_a',
    payload: { plan: 'premium' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Self-Assign Admin Role on Create',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'create',
    path: '/users/user_a',
    payload: { uid: 'user_a', plan: 'free', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Shadow Ghost Field Injection in Pantry',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'update',
    path: '/users/user_a/pantry/item_1',
    payload: { quantity: 2, isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Cross-Tenant User PII Read',
    actor: { uid: 'user_b', email: 'b@nutrix.br', email_verified: true },
    operation: 'get',
    path: '/users/user_a',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Cross-Tenant Pantry Write',
    actor: { uid: 'user_b', email: 'b@nutrix.br', email_verified: true },
    operation: 'create',
    path: '/users/user_a/pantry/item_99',
    payload: { userId: 'user_a', name: 'Arroz' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Unverified Admin Email Spoof',
    actor: { uid: 'spoof_1', email: 'sangarvall@gmail.com', email_verified: false },
    operation: 'list',
    path: '/analyticsEvents',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Document ID Poisoning (>128 chars)',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'create',
    path: `/users/user_a/pantry/${'x'.repeat(200)}`,
    payload: { userId: 'user_a', name: 'Tomate' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Client Timestamp Forgery',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'create',
    path: '/users/user_a/pantry/item_2',
    payload: { userId: 'user_a', name: 'Frango', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Immutable Owner/CreatedAt Tampering',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'update',
    path: '/users/user_a/recipes/rec_1',
    payload: { userId: 'user_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Array Size Exhaustion Attack',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'update',
    path: '/users/user_a',
    payload: { allergies: Array.from({ length: 100 }, (_, i) => `item_${i}`) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Non-Admin Global Config Mutation',
    actor: { uid: 'user_a', email: 'a@nutrix.br', email_verified: true },
    operation: 'update',
    path: '/appConfig/plans',
    payload: { freeWeeklyRecipes: 9999 },
    expected: 'PERMISSION_DENIED',
  },
];
