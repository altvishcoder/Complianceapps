import { useQuery } from '@tanstack/react-query';

export interface BrandingConfig {
  id?: string;
  organisationId?: string;
  appName: string;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCss?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  footerText?: string | null;
}

export interface AssetsConfig {
  assetsBaseUrl: string;
  objectStorageConfigured: boolean;
  mapTiles: {
    light: string;
    dark: string;
    selfHosted: boolean;
  };
  markers: {
    baseUrl: string;
  };
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'SocialComply',
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  accentColor: '#60a5fa',
  fontFamily: 'Inter',
  metaTitle: 'SocialComply - Compliance Management',
  metaDescription: 'UK Social Housing Compliance Management Platform',
};

async function fetchBranding(orgId?: string): Promise<BrandingConfig> {
  const params = orgId ? `?org=${encodeURIComponent(orgId)}` : '';
  const response = await fetch(`/api/branding${params}`, { credentials: 'include' });
  if (!response.ok) {
    console.warn('Failed to fetch branding, using defaults');
    return DEFAULT_BRANDING;
  }
  return response.json();
}

async function fetchAssetsConfig(): Promise<AssetsConfig> {
  const response = await fetch('/api/assets/config', { credentials: 'include' });
  if (!response.ok) {
    return {
      assetsBaseUrl: '/assets',
      objectStorageConfigured: false,
      mapTiles: {
        light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        selfHosted: false,
      },
      markers: {
        baseUrl: '/assets/leaflet',
      },
    };
  }
  return response.json();
}

export function useBranding(orgId?: string) {
  return useQuery({
    queryKey: ['branding', orgId],
    queryFn: () => fetchBranding(orgId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAssetsConfig() {
  return useQuery({
    queryKey: ['assets-config'],
    queryFn: fetchAssetsConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function applyBrandingToDocument(branding: BrandingConfig) {
  if (branding.metaTitle) {
    document.title = branding.metaTitle;
  }
  
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && branding.metaDescription) {
    metaDescription.setAttribute('content', branding.metaDescription);
  }
  
  if (branding.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
  
  const root = document.documentElement;
  if (branding.primaryColor) {
    root.style.setProperty('--brand-primary', branding.primaryColor);
  }
  if (branding.secondaryColor) {
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
  }
  if (branding.accentColor) {
    root.style.setProperty('--brand-accent', branding.accentColor);
  }
  
  if (branding.customCss) {
    let styleEl = document.getElementById('custom-branding-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-branding-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = branding.customCss;
  }
}
