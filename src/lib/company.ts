import type { CSSProperties } from 'react';

export type CompanyCode = 'DENE' | 'KEFERA';

export interface CompanyConfig {
  code: CompanyCode;
  id: 1 | 2;
  label: string;
  liffId: string;
  lineOaName: string;
  accent: string;
  softAccent: string;
}

function readEnv(key: keyof ImportMetaEnv) {
  return String(import.meta.env[key] || '').trim();
}

const DENE: CompanyConfig = {
  code: 'DENE',
  id: 1,
  label: 'DENE',
  liffId: readEnv('VITE_LIFF_ID_DENE') || readEnv('VITE_LIFF_ID'),
  lineOaName: 'DENE Line OA',
  accent: '#2c5243',
  softAccent: '#b9b99d',
};

const KEFERA: CompanyConfig = {
  code: 'KEFERA',
  id: 2,
  label: 'KEFÉRA',
  liffId: readEnv('VITE_LIFF_ID_KEFERA'),
  lineOaName: 'KEFÉRA Line OA',
  accent: '#8b5e3c',
  softAccent: '#f0dccb',
};

export const COMPANY_CONFIGS: Record<CompanyCode, CompanyConfig> = {
  DENE,
  KEFERA,
};

export const COMPANY_LIST: CompanyConfig[] = [DENE, KEFERA];

export function normalizeCompanyCode(value?: string | null): CompanyCode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'kefera') return 'KEFERA';
  return 'DENE';
}

// True only for real company codes (used to reject typo'd URLs like /kerfera instead of defaulting).
export function isKnownCompanyCode(value?: string | null): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'dene' || normalized === 'kefera';
}

export function getCompanyByCode(value?: string | null): CompanyConfig {
  return COMPANY_CONFIGS[normalizeCompanyCode(value)];
}

export function getCompanyFromPathname(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const firstSegment = String(pathname || '').split('/').filter(Boolean)[0] || '';
  return getCompanyByCode(firstSegment);
}

export function getCurrentCompany() {
  return getCompanyFromPathname();
}

export function getCompanyPathPrefix(company = getCurrentCompany()) {
  return `/${company.code}`;
}

export function buildCompanyPath(path: string, company = getCurrentCompany()) {
  const [pathname, search = ''] = String(path || '/').split('?');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getCompanyPathPrefix(company)}${cleanPath}${search ? `?${search}` : ''}`;
}

export function stripCompanyPrefix(pathname: string) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (!parts.length) return '/';
  const first = normalizeCompanyCode(parts[0]);
  if (!first) return pathname || '/';
  const remainder = parts.slice(1).join('/');
  return remainder ? `/${remainder}` : '/';
}

export function isCompanyPath(pathname: string) {
  return /^\/(dene|kefera)(\/|$)/i.test(String(pathname || ''));
}

export function getCompanyThemeStyle(company = getCurrentCompany()): CSSProperties {
  if (company.code !== 'KEFERA') return {};

  // KEFÉRA palette: ivory background, taupe boxes, muted-brown / charcoal text. The japandi-* tokens
  // are remapped so existing components inherit the brand colors without per-page edits.
  return {
    backgroundColor: '#eeebdf', // ivory
    '--color-japandi-50': '#f6f4ee',
    '--color-japandi-100': '#eeebdf', // ivory
    '--color-japandi-200': '#e3ddd2',
    '--color-japandi-300': '#cfc6b8',
    '--color-japandi-400': '#a39284', // taupe
    '--color-japandi-450': '#a39284', // taupe
    '--color-japandi-500': '#8c7c6d',
    '--color-japandi-600': '#7a6855', // muted brown
    '--color-japandi-700': '#5f5043',
    '--color-japandi-800': '#7a6855', // muted brown (headers / primary)
    '--color-japandi-900': '#1a1a1a', // charcoal
    '--color-japandi-sage': '#cfc6b8',
  } as CSSProperties;
}

export function getCompanyDocumentTitle(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const normalizedPath = String(pathname || '').trim().toLowerCase();

  if (!normalizedPath || normalizedPath === '/') {
    return 'Dene / KEFÉRA';
  }

  if (/^\/(admin|liff)(\/|$)/i.test(normalizedPath)) {
    return 'Dene CRM';
  }

  if (isCompanyPath(normalizedPath)) {
    const company = getCompanyFromPathname(normalizedPath);
    return company.code === 'KEFERA' ? 'KEFÉRA CRM' : 'Dene CRM';
  }

  return 'Dene / KEFÉRA';
}
