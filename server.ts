import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nutrixAI } from './src/server/aiProvider.ts';
import {
  cancelStripeSubscription,
  createMercadoPagoSubscription,
  createStripeCheckoutSession,
  getPaymentConfigStatus,
  markHotmartEventProcessed,
  markMercadoPagoEventProcessed,
  verifyAndDeduplicateStripeWebhook,
  verifyHotmartWebhookToken,
  verifyMercadoPagoWebhookSignature,
} from './src/server/payments.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
const firebaseConfig = fs.existsSync(firebaseConfigPath)
  ? (JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as { projectId?: string })
  : {};

// Initialize Firebase Admin ONLY for ID token verification (requires no IAM role)
if (firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id') {
  if (!getApps().length) {
    initializeApp({ projectId: firebaseConfig.projectId });
  }
}

const adminAuth = getApps().length ? getAuth(getApp()) : null;

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

// Technical daily AI usage safeguard per user (transparent protection against abuse)
const dailyAiUsage = new Map<string, { date: string; count: number }>();
const DEFAULT_DAILY_AI_CAP = 60;

function checkAndIncrementAiCap(uid: string): { allowed: boolean; count: number; limit: number } {
  const today = new Date().toISOString().slice(0, 10);
  const current = dailyAiUsage.get(uid);
  if (!current || current.date !== today) {
    dailyAiUsage.set(uid, { date: today, count: 1 });
    return { allowed: true, count: 1, limit: DEFAULT_DAILY_AI_CAP };
  }
  if (current.count >= DEFAULT_DAILY_AI_CAP) {
    return { allowed: false, count: current.count, limit: DEFAULT_DAILY_AI_CAP };
  }
  current.count += 1;
  return { allowed: true, count: current.count, limit: DEFAULT_DAILY_AI_CAP };
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
    return;
  }
  if (!adminAuth) {
    res.status(503).json({ error: 'Serviço de autenticação indisponível no servidor.' });
    return;
  }
  const idToken = authHeader.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Stripe Webhook MUST receive raw body for cryptographic signature validation
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const signature = Array.isArray(sig) ? sig[0] : sig;
      const { duplicate, event } = verifyAndDeduplicateStripeWebhook(req.body as Buffer, signature);

      if (duplicate) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }

      // Structured handling of verified subscription lifecycle events
      switch (event.type) {
        case 'checkout.session.completed':
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
        case 'customer.subscription.deleted':
        case 'customer.subscription.updated':
          console.info(`[Stripe Webhook] Verified event ${event.type} (${event.id})`);
          break;
        default:
          break;
      }

      res.status(200).json({ received: true, eventType: event.type });
    } catch (error) {
      console.error('Stripe webhook verification error:', error);
      res.status(400).json({ error: 'Assinatura de webhook inválida.' });
    }
  });

  app.use(express.json({ limit: '10mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nutrix-api', status: 'operational' });
  });

  // Payment configuration readiness (never exposes secrets)
  app.get('/api/payments/config', (_req, res) => {
    res.json(getPaymentConfigStatus());
  });

  // Create real recurring BRL checkout (Stripe or Mercado Pago) — NEVER simulates payments
  app.post('/api/payments/checkout', requireAuth, async (req: AuthRequest, res) => {
    try {
      const provider = req.body?.provider === 'mercadopago' ? 'mercadopago' : 'stripe';
      const plan = req.body?.plan === 'basic' ? 'basic' : 'premium';
      const uid = req.user!.uid;
      const email = req.user!.email || '';
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

      if (!email) {
        res.status(400).json({ error: 'E-mail verificado obrigatório para assinatura.' });
        return;
      }

      if (provider === 'mercadopago') {
        const result = await createMercadoPagoSubscription({ uid, email, appUrl, plan });
        res.json({ provider: 'mercadopago', plan, checkoutUrl: result.checkoutUrl, id: result.preapprovalId });
        return;
      }

      const result = await createStripeCheckoutSession({ uid, email, appUrl, plan });
      res.json({ provider: 'stripe', plan, checkoutUrl: result.checkoutUrl, id: result.sessionId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao iniciar checkout recorrente.';
      res.status(400).json({ error: msg, paymentConfig: getPaymentConfigStatus() });
    }
  });

  // Cancel recurring subscription
  app.post('/api/payments/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const subscriptionId = typeof req.body?.subscriptionId === 'string' ? req.body.subscriptionId.trim() : '';
      if (!subscriptionId) {
        res.status(400).json({
          error: 'Nenhuma assinatura ativa vinculada ao provedor de pagamentos foi encontrada para cancelamento.',
        });
        return;
      }
      const result = await cancelStripeSubscription(subscriptionId);
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Falha ao cancelar assinatura.';
      res.status(400).json({ error: msg });
    }
  });

  // Mercado Pago verified webhook with idempotency
  app.post('/api/webhooks/mercadopago', (req, res) => {
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;
    const dataId = String(req.body?.data?.id || req.query['data.id'] || '');
    const eventId = String(req.body?.id || dataId || '');

    if (!verifyMercadoPagoWebhookSignature({ xSignature, xRequestId, dataId })) {
      res.status(401).json({ error: 'Assinatura HMAC do Mercado Pago inválida.' });
      return;
    }

    if (eventId && !markMercadoPagoEventProcessed(eventId)) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    console.info(`[Mercado Pago Webhook] Verified notification ${eventId}`);
    res.status(200).json({ received: true });
  });

  // Hotmart verified webhook (X-HOTMART-HOTTOK) with idempotency
  app.post('/api/webhooks/hotmart', (req, res) => {
    const rawHeader = req.headers['x-hotmart-hottok'];
    const hottok = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!verifyHotmartWebhookToken(hottok)) {
      res.status(401).json({ error: 'Token X-HOTMART-HOTTOK inválido ou ausente.' });
      return;
    }

    const eventId = String(req.body?.id || req.body?.data?.purchase?.transaction || '');
    const eventType = String(req.body?.event || '');

    if (eventId && !markHotmartEventProcessed(eventId)) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    console.info(`[Hotmart Webhook] Verified event ${eventType} (${eventId})`);
    res.status(200).json({ received: true, event: eventType });
  });

  // --- AI Routes (Protected by Firebase Auth + Technical Usage Cap) ---

  app.post('/api/ai/recipes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cap = checkAndIncrementAiCap(req.user!.uid);
      if (!cap.allowed) {
        res.status(429).json({
          error: `Limite técnico diário de proteção de IA atingido (${cap.limit} gerações hoje). Tente novamente amanhã.`,
        });
        return;
      }

      const {
        pantryItems = [],
        profile = {},
        customPrompt = '',
        filters = [],
        servings = 2,
        maxPrepTimeMin,
        onlyAvailableIngredients = false,
        prioritizeExpiring = false,
        count = 2,
      } = req.body || {};

      const recipes = await nutrixAI.generateRecipes({
        pantryItems: Array.isArray(pantryItems) ? pantryItems : [],
        profile,
        customPrompt: typeof customPrompt === 'string' ? customPrompt.slice(0, 400) : '',
        filters: Array.isArray(filters) ? filters.map(String).slice(0, 12) : [],
        servings: Math.max(1, Math.min(20, Number(servings) || 2)),
        maxPrepTimeMin: maxPrepTimeMin ? Number(maxPrepTimeMin) : undefined,
        onlyAvailableIngredients: Boolean(onlyAvailableIngredients),
        prioritizeExpiring: Boolean(prioritizeExpiring),
        count: Math.min(3, Math.max(1, Number(count) || 2)),
      });

      res.json({ recipes, dailyUsage: { count: cap.count, limit: cap.limit } });
    } catch (error) {
      console.error('AI /api/ai/recipes error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao gerar receitas com o Chef IA.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/recognize-photo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cap = checkAndIncrementAiCap(req.user!.uid);
      if (!cap.allowed) {
        res.status(429).json({
          error: `Limite técnico diário de IA atingido (${cap.limit} requisições). Tente novamente amanhã.`,
        });
        return;
      }

      const { imageBase64, mimeType } = req.body || {};
      if (typeof imageBase64 !== 'string' || !imageBase64.length) {
        res.status(400).json({ error: 'Imagem não enviada.' });
        return;
      }
      const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const safeMime = allowedMimes.has(mimeType) ? mimeType : 'image/jpeg';

      const result = await nutrixAI.recognizeIngredientsFromPhoto(imageBase64, safeMime);
      res.json(result);
    } catch (error) {
      console.error('AI /api/ai/recognize-photo error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao analisar fotografia.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/meal-plan', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cap = checkAndIncrementAiCap(req.user!.uid);
      if (!cap.allowed) {
        res.status(429).json({
          error: `Limite técnico diário de IA atingido (${cap.limit} requisições).`,
        });
        return;
      }

      const { pantryItems = [], profile = {}, servings = 2, weekKey = '' } = req.body || {};
      const result = await nutrixAI.generateWeeklyMealPlan({
        pantryItems: Array.isArray(pantryItems) ? pantryItems : [],
        profile,
        servings: Math.max(1, Math.min(12, Number(servings) || 2)),
        weekKey: String(weekKey).slice(0, 20),
      });

      res.json(result);
    } catch (error) {
      console.error('AI /api/ai/meal-plan error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao gerar planejamento semanal.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/economy-tips', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cap = checkAndIncrementAiCap(req.user!.uid);
      if (!cap.allowed) {
        res.status(429).json({
          error: `Limite técnico diário de IA atingido (${cap.limit} requisições).`,
        });
        return;
      }

      const { pantryItems = [], profile = {}, spentThisWeekBrl = 0 } = req.body || {};
      const result = await nutrixAI.analyzeEconomy({
        pantryItems: Array.isArray(pantryItems) ? pantryItems : [],
        profile,
        spentThisWeekBrl: Number(spentThisWeekBrl) || 0,
      });

      res.json(result);
    } catch (error) {
      console.error('AI /api/ai/economy-tips error:', error);
      const message = error instanceof Error ? error.message : 'Erro ao analisar economia doméstica.';
      res.status(502).json({ error: message });
    }
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NUTRIX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal NUTRIX server error:', err);
  process.exit(1);
});
