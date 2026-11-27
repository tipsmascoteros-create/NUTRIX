import { auth } from './firebase.ts';

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (user) {
    // Token retrieved directly in memory, never stored in localStorage
    const token = await user.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let fallbackMessage = `Erro na requisição (${res.status}).`;
    if (res.status === 405) {
      fallbackMessage =
        'Rota da API não disponível neste servidor (405). Atualize o deploy na Vercel com a pasta /api e configure GEMINI_API_KEY nas variáveis de ambiente.';
    } else if (res.status === 504) {
      fallbackMessage =
        'O servidor demorou para responder (504). Tente novamente em alguns segundos.';
    }
    const message =
      typeof data?.error === 'string' && data.error
        ? data.error
        : fallbackMessage;
    throw new Error(message);
  }
  return data as T;
}
