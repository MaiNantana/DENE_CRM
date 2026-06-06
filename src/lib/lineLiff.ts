import liff from '@line/liff';
import { getCurrentCompany } from './company';

let initPromise: Promise<void> | null = null;
let initCompanyCode = '';

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
    liff.login({ redirectUri: window.location.href });
    return { lineId: fallback, isAuto: false };
  }

  try {
    const profile = await liff.getProfile();
    const userId = profile.userId?.trim() || '';
    if (userId) {
      return { lineId: userId, isAuto: true };
    }
  } catch (err) {
    if (fallback) {
      return { lineId: fallback, isAuto: false };
    }
    throw err;
  }

  return { lineId: fallback, isAuto: false };
}
