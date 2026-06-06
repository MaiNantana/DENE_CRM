import crypto from 'crypto';
import { getCompanyCookieName, getCompanyById, resolveCompanyFromRequest } from './company.js';
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS || 1000 * 60 * 60 * 12);
const SESSION_SECRET = process.env.AUTH_SECRET || 'dev-auth-secret-change-me';
const PBKDF2_ITERATIONS = Number(process.env.AUTH_PASSWORD_ITERATIONS || 150000);
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

export const ROLE_ORDER = {
  user: 1,
  manager: 2,
  admin: 3,
};

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_ORDER, normalized) ? normalized : null;
}

export function canAccessRole(role, minimumRole) {
  const userRank = ROLE_ORDER[normalizeRole(role) || ''] || 0;
  const minRank = ROLE_ORDER[normalizeRole(minimumRole) || ''] || 0;
  return userRank >= minRank;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(value)
    .digest('base64url');
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto
    .pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `pbkdf2_sha512$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, iterationStr, salt, hash] = String(storedHash || '').split('$');
  if (algorithm !== 'pbkdf2_sha512' || !iterationStr || !salt || !hash) return false;

  const iterations = Number(iterationStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const derived = crypto
    .pbkdf2Sync(String(password), salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');

  return timingSafeEqualHex(hash, derived);
}

export function createSessionToken(staff, company) {
  const resolvedCompany = company?.id ? company : getCompanyById(staff?.company_id || company?.companyId || 1);
  const payload = {
    sub: staff.id,
    username: staff.username,
    displayName: staff.display_name,
    role: staff.role,
    companyId: resolvedCompany.id,
    companyCode: resolvedCompany.code,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };

  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadPart);
  return `${payloadPart}.${signature}`;
}

export function parseSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  const expected = sign(payloadPart);
  const signatureBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthCookie(req) {
  const header = req.headers.cookie;
  if (!header) return '';
  const company = req?.company || resolveCompanyFromRequest(req);
  const cookieName = getCompanyCookieName(company);

  const name = `${cookieName}=`;
  const match = header
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(name));

  if (!match) return '';

  return decodeURIComponent(match.slice(name.length));
}

function isSecureRequest(req) {
  if (process.env.AUTH_COOKIE_SECURE === '1') return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || forwardedProto === 'https';
}

export function setAuthCookie(res, req, staff) {
  const company = req?.company || resolveCompanyFromRequest(req);
  const cookieName = getCompanyCookieName(company);
  res.cookie(cookieName, createSessionToken(staff, company), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAuthCookie(res, req) {
  const company = req?.company || resolveCompanyFromRequest(req);
  const cookieName = getCompanyCookieName(company);
  res.clearCookie(cookieName, {
    path: '/',
  });
}

export function sanitizeStaff(staff) {
  if (!staff) return null;
  return {
    id: staff.id,
    companyId: staff.company_id || null,
    username: staff.username,
    displayName: staff.display_name,
    role: staff.role,
    isActive: Boolean(staff.is_active),
    lastLoginAt: staff.last_login_at || null,
    createdAt: staff.created_at || null,
    updatedAt: staff.updated_at || null,
  };
}

export function parseAuthErrorMessage(err) {
  return err?.message || 'Authentication failed';
}
