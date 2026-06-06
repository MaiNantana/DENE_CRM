const COMPANY_CONFIGS = {
  DENE: {
    code: 'DENE',
    id: 1,
    label: 'DENE',
    lineOaName: 'DENE Line OA',
  },
  Kefera: {
    code: 'Kefera',
    id: 2,
    label: 'Kefera',
    lineOaName: 'Kefera Line OA',
  },
};

export function normalizeCompanyCode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'kefera' || normalized === '2') return 'Kefera';
  if (normalized === 'dene' || normalized === '1') return 'DENE';
  return 'DENE';
}

export function getCompanyByCode(value) {
  return COMPANY_CONFIGS[normalizeCompanyCode(value)];
}

export function getCompanyById(value) {
  const numeric = Number(value);
  if (numeric === 2) return COMPANY_CONFIGS.Kefera;
  return COMPANY_CONFIGS.DENE;
}

function parseCompanyFromValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return getCompanyById(raw);
  }

  return getCompanyByCode(raw);
}

export function resolveCompanyFromRequest(req) {
  const headerCode = req?.headers?.['x-company-code'];
  const headerId = req?.headers?.['x-company-id'];
  const queryCompany = req?.query?.company || req?.query?.companyCode || req?.query?.company_id;

  return (
    parseCompanyFromValue(headerCode) ||
    parseCompanyFromValue(headerId) ||
    parseCompanyFromValue(queryCompany) ||
    COMPANY_CONFIGS.DENE
  );
}

export function getCompanyCookieName(company) {
  const normalized = normalizeCompanyCode(company?.code || company);
  return normalized === 'Kefera' ? 'kefera_admin_session' : 'dene_admin_session';
}

export function getCompanyId(company) {
  return getCompanyByCode(company?.code || company).id;
}

export function getCompanyCode(company) {
  return getCompanyByCode(company?.code || company).code;
}

export function getCompanyLabel(company) {
  return getCompanyByCode(company?.code || company).label;
}

export function getCompanyConfigList() {
  return Object.values(COMPANY_CONFIGS);
}

export function isValidCompanyCode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'dene' || normalized === 'kefera' || normalized === '1' || normalized === '2';
}

