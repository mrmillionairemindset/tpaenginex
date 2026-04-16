'use client';

import { createContext, useContext, useEffect } from 'react';

export interface BrandingConfig {
  brandName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
}

const BrandingContext = createContext<BrandingConfig>({
  brandName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({
  branding,
  children,
}: {
  branding: BrandingConfig;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Apply primary color as CSS custom property for dynamic theming
    if (branding.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    }

    // Update favicon if custom one is set
    if (branding.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
        || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = branding.faviconUrl;
      document.head.appendChild(link);
    }

    // Update document title with brand name
    if (branding.brandName) {
      const baseTitle = document.title.replace(/^[^|]*\| /, '');
      document.title = `${branding.brandName} | ${baseTitle || 'Portal'}`;
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
