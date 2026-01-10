export const API_VERSION = 'v1';
export const API_BASE_URL = `/api/${API_VERSION}`;
export const LEGACY_API_BASE_URL = '/api';

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export function legacyApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${LEGACY_API_BASE_URL}${cleanPath}`;
}
