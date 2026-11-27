import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from './apiApp.ts';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!cachedApp) {
      cachedApp = createApiApp();
    }
    return cachedApp(req as never, res as never);
  } catch (error) {
    console.error('NUTRIX serverless handler error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno no servidor NUTRIX.',
      }),
    );
  }
}
