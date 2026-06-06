import type { CSSProperties } from 'react';

export type CompanyCode = 'DENE' | 'Kefera';

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
  code: 'Kefera',
  id: 2,
  label: 'Kefera',
  liffId: readEnv('VITE_LIFF_ID_KEFERA'),
  lineOaName: 'Kefera Line OA',
  accent: '#8b5e3c',
  softAccent: '#f0dccb',
};

export const COMPANY_CONFIGS: Record<CompanyCode, CompanyConfig> = {
  DENE,
  Kefera: KEFERA,
};

export const COMPANY_LIST: CompanyConfig[] = [DENE, KEFERA];

export function normalizeCompanyCode(value?: string | null): CompanyCode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'kefera') return 'Kefera';
  return 'DENE';
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
  if (company.code !== 'Kefera') return {};

  return {
    backgroundColor: '#f8efe6',
    backgroundImage: 'radial-gradient(circle at top left, rgba(243, 215, 191, 0.95), transparent 35%), linear-gradient(135deg, #fff8f2 0%, #f6e4d4 54%, #edd0b8 100%)',
    '--color-japandi-50': '#fff9f4',
    '--color-japandi-100': '#f8eadf',
    '--color-japandi-200': '#edd7c4',
    '--color-japandi-300': '#e0c0a3',
    '--color-japandi-400': '#c99267',
    '--color-japandi-500': '#a66f46',
    '--color-japandi-600': '#8b5e3c',
    '--color-japandi-700': '#70492f',
    '--color-japandi-800': '#8b5e3c',
    '--color-japandi-900': '#4a2d1e',
    '--color-japandi-sage': '#d8b28d',
  } as CSSProperties;
}

export function getCompanyDocumentTitle(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const normalizedPath = String(pathname || '').trim().toLowerCase();

  if (!normalizedPath || normalizedPath === '/') {
    return 'Dene / Kefera';
  }

  if (/^\/(admin|liff)(\/|$)/i.test(normalizedPath)) {
    return 'Dene CRM';
  }

  if (isCompanyPath(normalizedPath)) {
    const company = getCompanyFromPathname(normalizedPath);
    return company.code === 'Kefera' ? 'Kefera CRM' : 'Dene CRM';
  }

  return 'Dene / Kefera';
}
