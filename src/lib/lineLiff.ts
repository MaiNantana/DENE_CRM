import liff from '@line/liff';
import { getCurrentCompany } from './company';

let initPromise: Promise<void> | null = null;
let initCompanyCode = '';

function getLoginRedirectUri() {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

function isRecoverableLiffError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || '');
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  return /invalid_request/i.test(code) || /invalid_request|bad request|access[_\s-]?token/i.test(message);
}

function isLiffBrowser() {
  try {
    return typeof liff.isInClient === 'function' ? liff.isInClient() : false;
  } catch {
    return false;
  }
}

function recoverLiffSession() {
  const redirectUri = getLoginRedirectUri();
  if (!redirectUri) return false;

  if (isLiffBrowser()) {
    return false;
  }

  try {
    liff.logout();
  } catch {
    // Ignore logout failures and proceed to login fallback.
  }

  liff.login({ redirectUri });
  return true;
}

function getActiveLiffId() {
  const company = getCurrentCompany();
  return company.liffId?.trim() || import.meta.env.VITE_LIFF_ID?.trim() || '';
}

export function hasLiffId() {
  return getActiveLiffId().length > 0;
}

export function getLiffId() {
  return getActiveLiffId();
}

// Best-effort LINE display name (for naming a walk-in / guest record). Returns '' if unavailable.
export async function getLineDisplayName() {
  const liffId = getActiveLiffId();
  if (!liffId) return '';
  try {
    await ensureLiffInitialized(liffId);
    if (!liff.isLoggedIn() && !isLiffBrowser()) return '';
    const profile = await liff.getProfile();
    return profile.displayName?.trim() || '';
  } catch {
    return '';
  }
}

export async function initializeLiff() {
  const liffId = getActiveLiffId();
  if (!liffId) return;

  await ensureLiffInitialized(liffId);
}

async function ensureLiffInitialized(liffId: string) {
  const companyCode = getCurrentCompany().code;

  if (companyCode !== initCompanyCode) {
    initPromise = null;
    initCompanyCode = companyCode;
  }

  if (!initPromise) {
    initPromise = liff.init({
      liffId,
      withLoginOnExternalBrowser: true,
    }).catch(err => {
      initPromise = null;
      if (isRecoverableLiffError(err) && recoverLiffSession()) {
        return new Promise<void>(() => {});
      }
      throw err;
    });
  }

  await initPromise;
}

function readContextUserId() {
  try {
    const contextUserId = liff.getContext?.().userId;
    return contextUserId?.trim() || '';
  } catch {
    return '';
  }
}

function readDecodedTokenUserId() {
  try {
    const tokenUserId = liff.getDecodedIDToken?.()?.sub;
    return tokenUserId?.trim() || '';
  } catch {
    return '';
  }
}

export async function resolveLineUserId(fallbackLineId = '') {
  const fallback = fallbackLineId.trim();
  const liffId = getActiveLiffId();

  if (!liffId) {
    return { lineId: fallback, isAuto: false };
  }

  await ensureLiffInitialized(liffId);

  const tokenUserId = readDecodedTokenUserId();
  if (tokenUserId) {
    return { lineId: tokenUserId, isAuto: true };
  }

  const contextUserId = readContextUserId();
  if (contextUserId) {
    return { lineId: contextUserId, isAuto: true };
  }

  if (!liff.isLoggedIn()) {
    if (!isLiffBrowser()) {
      liff.login({ redirectUri: getLoginRedirectUri() });
    }
    return { lineId: fallback, isAuto: false };
  }

  try {
    const profile = await liff.getProfile();
    const userId = profile.userId?.trim() || '';
    if (userId) {
      return { lineId: userId, isAuto: true };
    }
  } catch (err) {
    if (isRecoverableLiffError(err) && recoverLiffSession()) {
      await new Promise<void>(() => {});
    }
    if (fallback) {
      return { lineId: fallback, isAuto: false };
    }
    throw err;
  }

  return { lineId: fallback, isAuto: false };
}
