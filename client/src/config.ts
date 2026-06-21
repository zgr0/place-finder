export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
