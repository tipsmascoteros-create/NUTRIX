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
    const message =
      typeof data?.error === 'string' && data.error
        ? data.error
        : `Erro na requisição (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}
