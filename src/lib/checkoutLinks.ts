export type CheckoutPlan = 'basic' | 'premium';

export const HOTMART_CHECKOUT_URLS: Record<CheckoutPlan, string> = {
  basic: 'https://pay.hotmart.com/H108637126O?off=726sm43a&checkoutMode=10',
  premium: 'https://pay.hotmart.com/H108637126O?off=cq053m7c&checkoutMode=10',
};

export const PLAN_PRICES_BRL: Record<CheckoutPlan, number> = {
  basic: 19,
  premium: 37,
};

/**
 * Builds the Hotmart checkout URL and safely pre-fills buyer email/name when signed in.
 */
export function buildHotmartCheckoutUrl(
  plan: CheckoutPlan,
  buyer?: { email?: string; name?: string },
): string {
  const url = new URL(HOTMART_CHECKOUT_URLS[plan]);
  if (buyer?.email) {
    url.searchParams.set('email', buyer.email.trim());
  }
  if (buyer?.name) {
    url.searchParams.set('name', buyer.name.trim());
  }
  return url.toString();
}

/**
 * Fires standard Meta Pixel InitiateCheckout event for the chosen plan.
 */
export function trackPlanCheckoutClick(plan: CheckoutPlan): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      content_name: plan === 'basic' ? 'NUTRIX Plano Básico' : 'NUTRIX Plano Premium',
      content_category: 'subscription',
      currency: 'BRL',
      value: PLAN_PRICES_BRL[plan],
    });
  }
}
