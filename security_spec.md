# NUTRIX Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict PII & Health Data Isolation (LGPD)**: Every `/users/{userId}` document and all subcollections (`pantry`, `recipes`, `mealPlans`, `shoppingList`, `nutritionLogs`, `purchases`) are strictly private to the authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) or an authorized administrator (`isAdmin()`).
2. **Parent Master Gate**: Every subcollection write under `/users/{userId}/*` verifies that `/users/{userId}` exists (`exists(...)`) and that `incoming().userId == userId == request.auth.uid`.
3. **Zero Privilege Escalation / Payment Integrity**: On `/users/{userId}` creation, a regular user MUST set `plan == 'free'`, `role == 'user'`, `subscriptionStatus == 'none'`, `subscriptionProvider == 'none'`. On update, regular users are strictly blocked from modifying `plan`, `role`, `subscriptionStatus`, `subscriptionProvider`, `subscriptionRenewsAt`, `uid`, or `createdAt` via `affectedKeys().hasOnly(...)`.
4. **Temporal & Schema Integrity**: Every document enforces exact `hasAll` + `hasOnly` keys on create, bounded string `.size()` limits, bounded array `.size()` limits, `isValidId()` regex guards on document IDs, and server timestamps (`request.time`).
5. **Admin Governance**: Admin access requires verified email matching the bootstrapped operator or an explicit `/admins/{uid}` record. Only admins may read `/analyticsEvents`, update `/appConfig`, or update user plans/roles.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Upgrade to Premium on Create**: `POST /users/u1` with `{ ..., plan: "premium", subscriptionStatus: "active" }`.
2. **Self-Upgrade to Premium on Update**: `PATCH /users/u1` modifying `plan: "premium"` as owner `u1`.
3. **Self-Assign Admin Role**: `POST /users/u1` with `{ ..., role: "admin" }`.
4. **Shadow Field Injection**: `PATCH /users/u1/pantry/p1` injecting ghost field `isVerified: true`.
5. **Cross-Tenant PII Read**: Authenticated user `u2` executing `GET /users/u1`.
6. **Cross-Tenant Pantry Injection**: User `u2` writing to `/users/u1/pantry/p99` with `userId: "u1"`.
7. **Unverified Admin Email Spoof**: Request with `token.email == "sangarvall@gmail.com"` and `email_verified: false` reading `/analyticsEvents`.
8. **ID Poisoning**: Creating `/users/u1/pantry/<1.5KB junk string>` violating `isValidId()`.
9. **Client Timestamp Forgery**: Creating `/users/u1/pantry/p2` with client-supplied `createdAt != request.time`.
10. **Immutable Field Tampering**: Updating `/users/u1/recipes/r1` to alter `createdAt` or `userId`.
11. **Array Exhaustion (Denial of Wallet)**: Updating `/users/u1` with `allergies` array of 500 elements.
12. **Unauthorized Config Mutation**: Non-admin user `u1` updating `/appConfig/plans` to set `freeWeeklyRecipes: 9999`.
