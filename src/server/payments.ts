import crypto from 'crypto';
import Stripe from 'stripe';
import type { PaymentConfigStatus } from '../types/nutrix.ts';

const BASIC_PRICE_BRL = 19;
const PREMIUM_PRICE_BRL = 37;
const processedWebhookEvents = new Set<string>();

export type CheckoutPlanTier = 'basic' | 'premium';

export function getPaymentConfigStatus(): PaymentConfigStatus {
  const missingStripe: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missingStripe.push('STRIPE_SECRET_KEY');
  if (!process.env.STRIPE_PRICE_ID_BASIC) missingStripe.push('STRIPE_PRICE_ID_BASIC');
  if (!process.env.STRIPE_PRICE_ID_PREMIUM) missingStripe.push('STRIPE_PRICE_ID_PREMIUM');
  if (!process.env.STRIPE_WEBHOOK_SECRET) missingStripe.push('STRIPE_WEBHOOK_SECRET');

  const missingMp: string[] = [];
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) missingMp.push('MERCADOPAGO_ACCESS_TOKEN');
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) missingMp.push('MERCADOPAGO_WEBHOOK_SECRET');

  return {
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PREMIUM),
    stripeBasicConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_BASIC),
    mercadoPagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
    basicPriceBrl: BASIC_PRICE_BRL,
    priceBrl: PREMIUM_PRICE_BRL,
    missingEnvVars: {
      stripe: missingStripe,
      mercadoPago: missingMp,
    },
  };
}

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function createStripeCheckoutSession(params: {
  uid: string;
  email: string;
  appUrl: string;
  plan?: CheckoutPlanTier;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const plan: CheckoutPlanTier = params.plan === 'basic' ? 'basic' : 'premium';
  const stripe = getStripeClient();
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
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe não configurado no servidor.');
  }
  const canceled = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return { status: canceled.status };
}

export function verifyAndDeduplicateStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): { duplicate: boolean; event: Stripe.Event } {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) {
    throw new Error('Assinatura ou segredo do webhook Stripe ausente.');
  }
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  if (processedWebhookEvents.has(event.id)) {
    return { duplicate: true, event };
  }
  processedWebhookEvents.add(event.id);
  // Keep set bounded in memory
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
