const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = envBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}
