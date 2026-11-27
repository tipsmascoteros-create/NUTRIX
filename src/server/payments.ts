import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Stripe from 'stripe';
import type {
  EntitlementStatus,
  PaymentConfigStatus,
  PlanType,
  ServerEntitlementResponse,
} from '../types/nutrix.js';

const BASIC_PRICE_BRL = 19;
const PREMIUM_PRICE_BRL = 37;
const HOTMART_OFFER_BASIC = '726sm43a';
const HOTMART_OFFER_PREMIUM = 'cq053m7c';

const processedWebhookEvents = new Set<string>();

export interface HotmartEntitlementRecord {
  email: string;
  buyerName: string;
  plan: PlanType;
  status: EntitlementStatus;
  offerCode: string;
  transaction: string;
  lastEvent: string;
  updatedAt: string;
}

const HOTMART_STORE_PATH = path.resolve(process.cwd(), '.nutrix-hotmart-entitlements.json');
const hotmartEntitlements = new Map<string, HotmartEntitlementRecord>();

function loadHotmartStore(): void {
  try {
    if (!fs.existsSync(HOTMART_STORE_PATH)) return;
    const raw = fs.readFileSync(HOTMART_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, HotmartEntitlementRecord>;
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (key && value && typeof value.email === 'string') {
          hotmartEntitlements.set(key.toLowerCase(), value);
        }
      }
    }
  } catch (err) {
    console.warn('Unable to load local Hotmart entitlement cache:', err);
  }
}

function persistHotmartStore(): void {
  try {
    const obj: Record<string, HotmartEntitlementRecord> = {};
    for (const [key, value] of hotmartEntitlements.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(HOTMART_STORE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    // Non-fatal on read-only container filesystems; in-memory map remains active
    console.warn('Unable to persist local Hotmart entitlement cache:', err);
  }
}

loadHotmartStore();

let hotmartOAuthCache: { token: string; expiresAt: number } | null = null;

export type CheckoutPlanTier = 'basic' | 'premium';

export function getPaymentConfigStatus(): PaymentConfigStatus {
  const missingHotmart: string[] = [];
  if (!process.env.HOTMART_HOTTOK) missingHotmart.push('HOTMART_HOTTOK');

  const missingStripe: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missingStripe.push('STRIPE_SECRET_KEY');
  if (!process.env.STRIPE_PRICE_ID_BASIC) missingStripe.push('STRIPE_PRICE_ID_BASIC');
  if (!process.env.STRIPE_PRICE_ID_PREMIUM) missingStripe.push('STRIPE_PRICE_ID_PREMIUM');
  if (!process.env.STRIPE_WEBHOOK_SECRET) missingStripe.push('STRIPE_WEBHOOK_SECRET');

  const missingMp: string[] = [];
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) missingMp.push('MERCADOPAGO_ACCESS_TOKEN');
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) missingMp.push('MERCADOPAGO_WEBHOOK_SECRET');

  return {
    hotmartWebhookConfigured: Boolean(process.env.HOTMART_HOTTOK),
    hotmartApiConfigured: Boolean(
      process.env.HOTMART_CLIENT_ID &&
        process.env.HOTMART_CLIENT_SECRET &&
        process.env.HOTMART_BASIC_TOKEN,
    ),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PREMIUM),
    stripeBasicConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_BASIC),
    mercadoPagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
    basicPriceBrl: BASIC_PRICE_BRL,
    priceBrl: PREMIUM_PRICE_BRL,
    missingEnvVars: {
      hotmart: missingHotmart,
      stripe: missingStripe,
      mercadoPago: missingMp,
    },
  };
}

export async function getStripeClient(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: StripeCtor } = await import('stripe');
  return new StripeCtor(key);
}

export async function createStripeCheckoutSession(params: {
  uid: string;
  email: string;
  appUrl: string;
  plan?: CheckoutPlanTier;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const plan: CheckoutPlanTier = params.plan === 'basic' ? 'basic' : 'premium';
  const stripe = await getStripeClient();
  const priceId =
    plan === 'basic' ? process.env.STRIPE_PRICE_ID_BASIC : process.env.STRIPE_PRICE_ID_PREMIUM;
  if (!stripe || !priceId) {
    const envVarName = plan === 'basic' ? 'STRIPE_PRICE_ID_BASIC' : 'STRIPE_PRICE_ID_PREMIUM';
    const priceLabel = plan === 'basic' ? 'R$ 19,00/mês' : 'R$ 37,00/mês';
    throw new Error(
      `Stripe não configurado para este plano. Configure STRIPE_SECRET_KEY e ${envVarName} (assinatura recorrente ${priceLabel} em BRL) nas variáveis de ambiente.`,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.email,
    client_reference_id: params.uid,
    line_items: [{ price: priceId, quantity: 1 }],
    locale: 'pt-BR',
    subscription_data: {
      metadata: { nutrixUid: params.uid, plan },
    },
    metadata: { nutrixUid: params.uid, plan },
    success_url: `${params.appUrl}/?checkout=sucesso&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.appUrl}/?checkout=cancelado`,
  });

  if (!session.url) {
    throw new Error('Stripe não retornou uma URL de checkout válida.');
  }

  return { checkoutUrl: session.url, sessionId: session.id };
}

export async function createMercadoPagoSubscription(params: {
  uid: string;
  email: string;
  appUrl: string;
  plan?: CheckoutPlanTier;
}): Promise<{ checkoutUrl: string; preapprovalId: string }> {
  const plan: CheckoutPlanTier = params.plan === 'basic' ? 'basic' : 'premium';
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'Mercado Pago não configurado. Configure MERCADOPAGO_ACCESS_TOKEN nas variáveis de ambiente para ativar assinaturas recorrentes em reais.',
    );
  }

  const amountBrl = plan === 'basic' ? BASIC_PRICE_BRL : PREMIUM_PRICE_BRL;
  const reason =
    plan === 'basic'
      ? 'NUTRIX Básico — Assinatura Mensal'
      : 'NUTRIX Premium — Assinatura Mensal';

  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason,
      external_reference: `${params.uid}:${plan}`,
      payer_email: params.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amountBrl,
        currency_id: 'BRL',
      },
      back_url: `${params.appUrl}/?checkout=mercadopago&plan=${plan}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao criar assinatura no Mercado Pago: ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as { id: string; init_point: string };
  return { checkoutUrl: data.init_point, preapprovalId: data.id };
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<{ status: string }> {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error('Stripe não configurado no servidor.');
  }
  const canceled = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return { status: canceled.status };
}

export async function verifyAndDeduplicateStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<{ duplicate: boolean; event: Stripe.Event }> {
  const stripe = await getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) {
    throw new Error('Assinatura ou segredo do webhook Stripe ausente.');
  }
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  if (processedWebhookEvents.has(event.id)) {
    return { duplicate: true, event };
  }
  processedWebhookEvents.add(event.id);
  if (processedWebhookEvents.size > 5000) {
    const first = processedWebhookEvents.values().next().value;
    if (first) processedWebhookEvents.delete(first);
  }
  return { duplicate: false, event };
}

export function verifyMercadoPagoWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !params.xSignature || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(',').map((kv) => {
      const [k, v] = kv.trim().split('=');
      return [k, v];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId};request-id:${params.xRequestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function markMercadoPagoEventProcessed(eventId: string): boolean {
  if (processedWebhookEvents.has(`mp_${eventId}`)) return false;
  processedWebhookEvents.add(`mp_${eventId}`);
  return true;
}

export function verifyHotmartWebhookToken(hottokHeader: string | undefined): boolean {
  const expected = process.env.HOTMART_HOTTOK;
  if (!expected || !hottokHeader) return false;
  const a = Buffer.from(hottokHeader.trim());
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function markHotmartEventProcessed(eventId: string): boolean {
  if (!eventId) return true;
  if (processedWebhookEvents.has(`hm_${eventId}`)) return false;
  processedWebhookEvents.add(`hm_${eventId}`);
  if (processedWebhookEvents.size > 5000) {
    const first = processedWebhookEvents.values().next().value;
    if (first) processedWebhookEvents.delete(first);
  }
  return true;
}

function resolvePlanFromHotmartOffer(offerCode: string, planName: string, priceValue: number): PlanType {
  const cleanOffer = offerCode.trim().toLowerCase();
  if (cleanOffer === HOTMART_OFFER_PREMIUM) return 'premium';
  if (cleanOffer === HOTMART_OFFER_BASIC) return 'free';
  if (planName.toLowerCase().includes('premium')) return 'premium';
  if (planName.toLowerCase().includes('básico') || planName.toLowerCase().includes('basico')) return 'free';
  return priceValue >= 30 ? 'premium' : 'free';
}

export function processHotmartWebhookEvent(body: unknown): {
  processed: boolean;
  action: 'activated' | 'revoked' | 'ignored';
  record?: HotmartEntitlementRecord;
} {
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const event = String(payload.event || '').trim().toUpperCase();
  const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) as Record<string, unknown>;
  const buyer = (data.buyer && typeof data.buyer === 'object' ? data.buyer : {}) as Record<string, unknown>;
  const subscriber = (data.subscriber && typeof data.subscriber === 'object' ? data.subscriber : {}) as Record<string, unknown>;
  const purchase = (data.purchase && typeof data.purchase === 'object' ? data.purchase : {}) as Record<string, unknown>;
  const offer = (purchase.offer && typeof purchase.offer === 'object' ? purchase.offer : {}) as Record<string, unknown>;
  const price = (purchase.price && typeof purchase.price === 'object' ? purchase.price : {}) as Record<string, unknown>;
  const subscription = (data.subscription && typeof data.subscription === 'object' ? data.subscription : {}) as Record<string, unknown>;
  const subPlan = (subscription.plan && typeof subscription.plan === 'object' ? subscription.plan : {}) as Record<string, unknown>;

  const rawEmail = String(buyer.email || subscriber.email || payload.email || '').trim().toLowerCase().slice(0, 254);
  if (!rawEmail || !rawEmail.includes('@')) {
    return { processed: false, action: 'ignored' };
  }

  const buyerName = String(buyer.name || subscriber.name || payload.name || '').trim().slice(0, 120);
  const offerCode = String(offer.code || payload.off || '').trim().slice(0, 40);
  const planName = String(subPlan.name || '').trim().slice(0, 80);
  const priceValue = Number(price.value || 0);
  const transaction = String(purchase.transaction || subscription.subscriber_code || payload.transaction || '').trim().slice(0, 80);

  const activateEvents = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'SWITCH_PLAN']);
  const refundEvents = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']);
  const cancelEvents = new Set([
    'SUBSCRIPTION_CANCELLATION',
    'PURCHASE_CANCELED',
    'PURCHASE_EXPIRED',
    'PURCHASE_DELAYED',
    'PURCHASE_PROTEST',
  ]);

  const existing = hotmartEntitlements.get(rawEmail);
  const resolvedPlan =
    offerCode || planName || priceValue > 0
      ? resolvePlanFromHotmartOffer(offerCode, planName, priceValue)
      : existing?.plan || 'free';

  let nextStatus: EntitlementStatus | null = null;
  let action: 'activated' | 'revoked' | 'ignored' = 'ignored';

  if (activateEvents.has(event)) {
    nextStatus = 'active';
    action = 'activated';
  } else if (refundEvents.has(event)) {
    nextStatus = 'refunded';
    action = 'revoked';
  } else if (cancelEvents.has(event)) {
    nextStatus = 'canceled';
    action = 'revoked';
  }

  if (!nextStatus) {
    return { processed: true, action: 'ignored' };
  }

  const record: HotmartEntitlementRecord = {
    email: rawEmail,
    buyerName: buyerName || existing?.buyerName || '',
    plan: resolvedPlan,
    status: nextStatus,
    offerCode: offerCode || existing?.offerCode || '',
    transaction: transaction || existing?.transaction || '',
    lastEvent: event,
    updatedAt: new Date().toISOString(),
  };

  hotmartEntitlements.set(rawEmail, record);
  persistHotmartStore();

  return { processed: true, action, record };
}

async function getHotmartApiAccessToken(): Promise<string | null> {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basicToken = process.env.HOTMART_BASIC_TOKEN;
  if (!clientId || !clientSecret || !basicToken) return null;

  if (hotmartOAuthCache && Date.now() < hotmartOAuthCache.expiresAt - 60_000) {
    return hotmartOAuthCache.token;
  }

  try {
    const tokenUrl = new URL('https://api-sec-vlc.hotmart.com/security/oauth/token');
    tokenUrl.searchParams.set('grant_type', 'client_credentials');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);

    const authHeader = basicToken.startsWith('Basic ') ? basicToken : `Basic ${basicToken}`;
    const res = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    hotmartOAuthCache = {
      token: json.access_token,
      expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    };
    return json.access_token;
  } catch (err) {
    console.warn('Hotmart API token fetch failed:', err);
    return null;
  }
}

export async function lookupHotmartEntitlementForEmail(
  email: string,
): Promise<ServerEntitlementResponse> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { active: false, plan: null, status: 'none', provider: 'none', source: 'none' };
  }

  const cached = hotmartEntitlements.get(normalized);
  if (cached) {
    return {
      active: cached.status === 'active',
      plan: cached.plan,
      status: cached.status,
      provider: 'hotmart',
      transaction: cached.transaction,
      source: 'webhook',
      updatedAt: cached.updatedAt,
    };
  }

  // Optional live check via official Hotmart Developers Subscriptions API
  const accessToken = await getHotmartApiAccessToken();
  if (accessToken) {
    try {
      const apiUrl = `https://developers.hotmart.com/payments/api/v1/subscriptions?subscriber_email=${encodeURIComponent(normalized)}&status=ACTIVE`;
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          items?: Array<{
            status?: string;
            subscriber?: { name?: string; email?: string; code?: string };
            plan?: { name?: string; offer_code?: string };
            price?: { value?: number };
          }>;
        };
        const activeSub = (json.items || []).find(
          (item) => String(item.status || '').toUpperCase() === 'ACTIVE',
        );
        if (activeSub) {
          const offerCode = String(activeSub.plan?.offer_code || '');
          const planName = String(activeSub.plan?.name || '');
          const priceValue = Number(activeSub.price?.value || 0);
          const resolvedPlan = resolvePlanFromHotmartOffer(offerCode, planName, priceValue);
          const record: HotmartEntitlementRecord = {
            email: normalized,
            buyerName: String(activeSub.subscriber?.name || '').slice(0, 120),
            plan: resolvedPlan,
            status: 'active',
            offerCode: offerCode.slice(0, 40),
            transaction: String(activeSub.subscriber?.code || '').slice(0, 80),
            lastEvent: 'HOTMART_API_ACTIVE',
            updatedAt: new Date().toISOString(),
          };
          hotmartEntitlements.set(normalized, record);
          persistHotmartStore();
          return {
            active: true,
            plan: resolvedPlan,
            status: 'active',
            provider: 'hotmart',
            transaction: record.transaction,
            source: 'hotmart_api',
            updatedAt: record.updatedAt,
          };
        }
      }
    } catch (err) {
      console.warn('Hotmart live subscription check failed:', err);
    }
  }

  return { active: false, plan: null, status: 'none', provider: 'none', source: 'none' };
}

export function listRecentHotmartWebhookEntitlements(): HotmartEntitlementRecord[] {
  return [...hotmartEntitlements.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
