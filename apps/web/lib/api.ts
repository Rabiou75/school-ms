const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locale: string;
  schoolId?: string | null;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('authUser');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('authUser');
}

function currentLocale(): string {
  if (typeof window === 'undefined') return 'fr';
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return ['en', 'fr', 'ar'].includes(first) ? first : 'fr';
}

export function logout(): void {
  clearSession();
  window.location.href = '/' + currentLocale() + '/login';
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const res = await fetch(API_URL + path, { ...init, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/' + currentLocale() + '/login';
  }
  return res;
}
