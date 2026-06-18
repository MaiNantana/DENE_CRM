import './env.js';
import crypto from 'crypto';

const SLIP_SECRET = process.env.SLIP_ANALYSIS_SECRET || process.env.AUTH_SECRET || 'dev-slip-analysis-secret';

// Free, self-hosted slip reading: decode the slip QR (authenticity + dedup) and OCR the amount.
const SLIP_OCR_ENABLED = String(process.env.SLIP_OCR_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
// "tha" enables reading Thai-format dates (e.g. "17 มิ.ย. 69"); "eng" alone reads digits/time.
const SLIP_OCR_LANGS = process.env.SLIP_OCR_LANGS?.trim() || 'eng+tha';
const SLIP_OCR_TIMEOUT_MS = Number(process.env.SLIP_OCR_TIMEOUT_MS || 20000);
const SLIP_QR_MAX_WIDTH = Number(process.env.SLIP_QR_MAX_WIDTH || 1600);
// Optional: log the decoded slip QR payload to iisnode logs to tune the parser per bank.
const SLIP_QR_DEBUG = String(process.env.SLIP_QR_DEBUG ?? 'true').trim().toLowerCase() !== 'false';

// SlipOK — primary verifier (real bank check: exact amount/bank/receiver/date). If not configured
// or it can't read the slip, we fall back to the local QR decode (+ manual amount) below.
const SLIPOK_API_BASE = (process.env.SLIPOK_API_URL?.trim() || 'https://api.slipok.com/api/line/apikey').replace(/\/+$/, '');

// Per-company SlipOK credentials (each shop has its own branch + key). Falls back to the
// unsuffixed SLIPOK_API_KEY / SLIPOK_BRANCH_ID for single-company setups.
function getSlipOkConfig(companyCode) {
  const code = String(companyCode || '').trim().toUpperCase() || 'DENE';
  const apiKey = (process.env[`SLIPOK_API_KEY_${code}`] || process.env.SLIPOK_API_KEY || '').trim();
  const branchId = String(process.env[`SLIPOK_BRANCH_ID_${code}`] || process.env.SLIPOK_BRANCH_ID || '').trim();
  if (!apiKey || !branchId) return null;
  return { apiKey, branchId };
}
// Default false: /analyze is a preview and may run several times on the same slip; registering
// it on SlipOK would then trip SlipOK's own duplicate check. We dedup locally (fingerprint+ref).
const SLIPOK_LOG = String(process.env.SLIPOK_LOG ?? 'false').trim().toLowerCase() === 'true';
const SLIPOK_DUPLICATE_CODES = new Set([1012]);
// Codes meaning SlipOK could not read the slip image/QR -> fall back to local QR+OCR.
const SLIPOK_CANT_READ_CODES = new Set([1002, 1007]);

// Thai NITMX application identifier prefix found in genuine bank-slip verification QRs.
const SLIP_QR_AID_PREFIX = 'A00000067701';

// BOT bank codes that can appear in the slip QR -> readable Thai/short names.
const BANK_CODE_NAMES = {
  '002': 'ธนาคารกรุงเทพ (BBL)',
  '004': 'ธนาคารกสิกรไทย (KBANK)',
  '006': 'ธนาคารกรุงไทย (KTB)',
  '011': 'ธนาคารทหารไทยธนชาต (ttb)',
  '014': 'ธนาคารไทยพาณิชย์ (SCB)',
  '017': 'ธนาคารซิตี้แบงก์',
  '018': 'ธนาคารซูมิโตโม มิตซุย',
  '020': 'ธนาคารสแตนดาร์ดชาร์เตอร์ด',
  '022': 'ธนาคารซีไอเอ็มบีไทย (CIMB)',
  '024': 'ธนาคารยูโอบี (UOB)',
  '025': 'ธนาคารกรุงศรีอยุธยา (BAY)',
  '030': 'ธนาคารออมสิน (GSB)',
  '031': 'ธนาคารฮ่องกงและเซี่ยงไฮ้ (HSBC)',
  '033': 'ธนาคารอาคารสงเคราะห์ (GHB)',
  '034': 'ธนาคารเพื่อการเกษตรฯ (BAAC)',
  '035': 'ธนาคารเพื่อการส่งออกฯ (EXIM)',
  '039': 'ธนาคารมิซูโฮ',
  '045': 'ธนาคารบีเอ็นพี พารีบาส์',
  '052': 'ธนาคารแห่งประเทศจีน (BOC)',
  '066': 'ธนาคารอิสลามแห่งประเทศไทย (ISBT)',
  '067': 'ธนาคารทิสโก้ (TISCO)',
  '069': 'ธนาคารเกียรตินาคินภัทร (KKP)',
  '070': 'ธนาคารไอซีบีซี (ICBC)',
  '071': 'ธนาคารไทยเครดิต (TCD)',
  '073': 'ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)',
  '098': 'ธนาคารพัฒนาวิสาหกิจฯ (SME)',
};

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value) {
  return crypto.createHmac('sha256', SLIP_SECRET).update(value).digest('base64url');
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function parseDataUrl(imageData) {
  const raw = String(imageData || '').trim();
  if (!raw) throw new Error('slip image is required');

  const match = raw.match(/^data:(?<mime>[^;]+);base64,(?<data>.+)$/);
  if (match?.groups?.data) {
    return {
      mimeType: match.groups.mime || 'image/jpeg',
      base64Data: match.groups.data.replace(/\s+/g, ''),
    };
  }

  return {
    mimeType: 'image/jpeg',
    base64Data: raw.replace(/\s+/g, ''),
  };
}

export async function createSlipFingerprint(imageData) {
  const { base64Data } = parseDataUrl(imageData);
  const inputBuffer = Buffer.from(base64Data, 'base64');

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const normalized = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
      .grayscale()
      .normalize()
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  } catch {
    return crypto.createHash('sha256').update(inputBuffer).digest('hex');
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
}

function normalizeSlipReference(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function signPayload(payload) {
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadPart);
  return `${payloadPart}.${signature}`;
}

function verifyPayload(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  const expected = sign(payloadPart);
  if (!timingSafeEqual(signaturePart, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifySlipToken(token) {
  return verifyPayload(token);
}

function buildManualSlipAnalysis({
  userId,
  lineId,
  slipFingerprint,
  warnings = [],
  summary = '',
  bank = null,
  referenceNumber = null,
  isSlip = false,
} = {}) {
  const analysisId = crypto.randomUUID();
  const manualWarnings = [
    'ระบบจะส่งสลิปให้ร้านตรวจด้วยมือ',
    ...warnings,
  ].filter(Boolean);

  return {
    analysisId,
    userId: userId || null,
    lineId: lineId || null,
    amount: null,
    currency: 'THB',
    verificationStatus: 'uncertain',
    confidence: 0,
    bank,
    transactionDate: null,
    transactionTime: null,
    referenceNumber,
    warnings: manualWarnings,
    summary: summary || 'ร้านจะตรวจสอบสลิปและยืนยันให้ภายหลัง',
    canProceed: false,
    manualReview: true,
    isSlip,
    verificationToken: null,
    slipUrl: null,
    slipFingerprint,
  };
}

function buildBlockedSlipAnalysis({ userId, lineId, slipFingerprint, warnings = [], summary = '' } = {}) {
  return {
    analysisId: crypto.randomUUID(),
    userId: userId || null,
    lineId: lineId || null,
    amount: null,
    currency: 'THB',
    verificationStatus: 'suspicious',
    confidence: 0,
    bank: null,
    transactionDate: null,
    transactionTime: null,
    referenceNumber: null,
    warnings: warnings.filter(Boolean),
    summary: summary || 'สลิปไม่ผ่านการตรวจสอบ',
    canProceed: false,
    manualReview: false,
    isSlip: false,
    verificationToken: null,
    slipUrl: null,
    slipFingerprint,
  };
}

// ---------------------------------------------------------------------------
// QR decoding (authenticity + dedup) — fully local, no external API.
// ---------------------------------------------------------------------------

// ZXing decode (more robust than jsQR; TRY_HARDER) from an RGBA buffer. Optional dependency.
async function zxingDecodeRgba(rgba, width, height) {
  try {
    const Z = await import('@zxing/library');
    const len = width * height;
    const luminances = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i += 1) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      luminances[i] = (r * 0.2126 + g * 0.7152 + b * 0.0722) & 0xff;
    }
    const source = new Z.RGBLuminanceSource(luminances, width, height);
    const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
    const reader = new Z.MultiFormatReader();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const result = reader.decode(bitmap, hints);
    return result?.getText?.() || null;
  } catch {
    return null; // NotFoundException etc.
  }
}

// Render a sharp pipeline at a given width (optionally enhanced) then try jsQR + ZXing.
async function tryDecodeQr(sharp, jsQR, sourceBuffer, { width, gray = false, threshold = false, extract = null } = {}) {
  try {
    let pipeline = sharp(sourceBuffer);
    if (extract) pipeline = pipeline.extract(extract);
    pipeline = pipeline.resize({ width, withoutEnlargement: false, fit: 'inside' });
    if (gray) pipeline = pipeline.grayscale().normalize();
    if (threshold) pipeline = pipeline.threshold(140);

    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const arr = new Uint8ClampedArray(data.buffer, data.byteOffset, info.width * info.height * 4);

    const jsResult = jsQR(arr, info.width, info.height, { inversionAttempts: 'attemptBoth' });
    if (jsResult?.data) return jsResult.data;

    return await zxingDecodeRgba(arr, info.width, info.height);
  } catch {
    return null;
  }
}

async function decodeSlipQr(imageData) {
  try {
    const { base64Data } = parseDataUrl(imageData);
    const inputBuffer = Buffer.from(base64Data, 'base64');

    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const jsQRModule = await import('jsqr');
    const jsQR = jsQRModule.default || jsQRModule;

    // Normalise EXIF orientation once, then work from this buffer (consistent dimensions).
    const rotated = await sharp(inputBuffer).rotate().toBuffer();
    const meta = await sharp(rotated).metadata();

    // Strategy 1: whole image at a couple of scales + a contrast-enhanced variant.
    // Real slips vary a lot (small QR, low contrast, big photos), so we try a few passes.
    for (const width of [1280, 2000]) {
      const hit = await tryDecodeQr(sharp, jsQR, rotated, { width })
        || await tryDecodeQr(sharp, jsQR, rotated, { width, gray: true, threshold: true });
      if (hit) return hit;
    }

    // Strategy 2: the Thai slip QR is usually in the lower part — crop & upscale it.
    if (meta.width && meta.height) {
      const top = Math.floor(meta.height * 0.45);
      const region = { left: 0, top, width: meta.width, height: meta.height - top };
      const hit = await tryDecodeQr(sharp, jsQR, rotated, { width: 1600, extract: region })
        || await tryDecodeQr(sharp, jsQR, rotated, { width: 1600, extract: region, gray: true, threshold: true });
      if (hit) return hit;
    }

    return null;
  } catch {
    return null;
  }
}

function walkTags(tags, fn) {
  for (const tag of tags || []) {
    fn(tag);
    if (tag?.subTags?.length) walkTags(tag.subTags, fn);
  }
}

function slipQrReference(payload) {
  const normalized = normalizeSlipReference(payload);
  if (!normalized) return null;
  if (normalized.length <= 120) return normalized;
  // Too long for the slip_reference_number column — fall back to a stable hash.
  return ('QR' + crypto.createHash('sha256').update(normalized).digest('hex')).slice(0, 120);
}

// Returns { genuine: boolean, referenceNumber?: string|null, bank?: string|null }
async function parseSlipQr(payload) {
  const text = String(payload || '');
  if (!text) return { genuine: false };

  let tags = null;
  let nonStrictTags = null;
  try {
    // promptparse is an optional dependency — dynamically imported so a missing install
    // degrades to manual review instead of crashing the server on startup.
    const { parse: parseEmvco } = await import('promptparse');
    // strict = validate CRC checksum; subTags = parse nested TLV.
    const qr = parseEmvco(text, true, true);
    if (qr) tags = qr.getTags();
    try { const nq = parseEmvco(text, false, true); if (nq) nonStrictTags = nq.getTags(); } catch { /* ignore */ }
  } catch {
    tags = null;
  }

  // TEMP DEBUG: capture the real slip QR payload to tune the parser for each bank.
  if (SLIP_QR_DEBUG) {
    console.error('[slipQR] payload len=%d strictParse=%s nonStrictParse=%s aidPrefix=%s head=%s',
      text.length, !!tags, !!nonStrictTags, text.includes(SLIP_QR_AID_PREFIX), text.slice(0, 120));
  }

  // Genuine slip QR = parses as valid EMVCo TLV with a valid CRC checksum.
  // Thai bank slip QRs use a compact TLV format (CRC tag varies by bank) and do NOT carry the
  // PromptPay payment AID, so we rely on CRC validity. Random non-EMVCo QRs fail strict parsing.
  if (!tags) {
    return { genuine: false };
  }

  let bank = null;
  let bestRef = '';
  walkTags(tags, tag => {
    const value = String(tag?.value || '').trim();
    if (!bank && /^\d{3}$/.test(value) && BANK_CODE_NAMES[value]) {
      bank = BANK_CODE_NAMES[value];
    }
    // The transaction reference is the longest leaf value in the payload.
    if (!tag?.subTags?.length && value.length > bestRef.length && /[A-Za-z0-9]/.test(value)) {
      bestRef = value;
    }
  });

  return { genuine: true, referenceNumber: slipQrReference(bestRef || text), bank };
}

// ---------------------------------------------------------------------------
// OCR amount reading (tesseract.js) — best-effort, shop confirms on approval.
// ---------------------------------------------------------------------------

let ocrWorkerPromise = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const mod = await import('tesseract.js');
      const createWorker = mod.createWorker || mod.default?.createWorker;
      return createWorker(SLIP_OCR_LANGS);
    })().catch(error => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

// Best-effort amount extraction. Prefers a number sitting right before "บาท/THB", avoids the
// fee line ("ค่าธรรมเนียม"), and falls back to the largest decimal value. OCR is imperfect, so
// the customer always confirms/edits this value before submitting.
function extractAmountFromText(text) {
  const t = String(text || '');
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
  const candidates = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const intPart = m[1].replace(/,/g, '');
    const value = Number(m[2] ? `${intPart}.${m[2]}` : intPart);
    if (!Number.isFinite(value) || value <= 0) continue;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8);
    const before = t.slice(Math.max(0, m.index - 14), m.index);
    candidates.push({
      value,
      nearBaht: /บาท|THB|baht/i.test(after),
      nearFee: /ค่าธรรมเนียม|fee|ธรรมเนียม/i.test(before),
      hasDecimals: !!m[2],
    });
  }
  if (!candidates.length) return null;
  const score = c => (c.nearBaht ? 4 : 0) + (c.hasDecimals ? 1 : 0) - (c.nearFee ? 6 : 0);
  candidates.sort((a, b) => (score(b) - score(a)) || (b.value - a.value));
  const best = candidates[0];
  return best ? Math.round(best.value * 100) / 100 : null;
}

const THAI_MONTHS = {
  'มค': 1, 'กพ': 2, 'มีค': 3, 'เมย': 4, 'พค': 5, 'มิย': 6,
  'กค': 7, 'สค': 8, 'กย': 9, 'ตค': 10, 'พย': 11, 'ธค': 12,
};

// Best-effort date/time from OCR text. The slip QR does NOT carry these, so this is OCR-only
// (Thai month names need the "tha" OCR language; times/numeric dates read with "eng").
function extractDateTimeFromText(text) {
  const t = String(text || '');

  let time = null;
  const tm = t.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\b/);
  if (tm) time = `${tm[1].padStart(2, '0')}:${tm[2]}${tm[3] ? ':' + tm[3] : ''}`;

  let date = null;
  const dn = t.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (dn) {
    let year = Number(dn[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543; // Buddhist -> Gregorian
    date = `${year}-${String(dn[2]).padStart(2, '0')}-${String(dn[1]).padStart(2, '0')}`;
  } else {
    const dt = t.match(/(\d{1,2})\s*(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค)\.?\s*(\d{2,4})/);
    if (dt) {
      const mo = THAI_MONTHS[dt[2].replace(/\./g, '')];
      let year = Number(dt[3]);
      if (year < 100) year += 2500;
      if (year > 2400) year -= 543;
      if (mo) date = `${year}-${String(mo).padStart(2, '0')}-${String(dt[1]).padStart(2, '0')}`;
    }
  }
  return { date, time };
}

async function recognizeWithTimeout(worker, buffer, output) {
  const res = await Promise.race([
    worker.recognize(buffer, {}, output),
    new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), SLIP_OCR_TIMEOUT_MS)),
  ]);
  return res?.data || {};
}

// Flatten tesseract block tree -> [{ text, bbox }] at word level.
function collectOcrWords(blocks) {
  const out = [];
  (blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l =>
    (l.words || []).forEach(w => { if (w?.text && w?.bbox) out.push({ text: w.text, bbox: w.bbox }); }))));
  return out;
}

function parseAmountToken(t) {
  const m = String(t || '').replace(/,/g, '').match(/(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const v = Number(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  return Number.isFinite(v) ? v : null;
}

// Pick the amount by layout: the largest positive number sitting on the same line as (and left
// of) a "บาท/THB" word. This skips the fee line (0.00) and unrelated numbers (dates/refs).
function extractAmountByLayout(words) {
  const anchors = (words || []).filter(w => /บาท|THB|baht/i.test(w.text));
  let best = null;
  for (const a of anchors) {
    const lineH = (a.bbox.y1 - a.bbox.y0) || 20;
    const ay = (a.bbox.y0 + a.bbox.y1) / 2;
    for (const w of words) {
      if (w === a) continue;
      const wy = (w.bbox.y0 + w.bbox.y1) / 2;
      if (Math.abs(wy - ay) > lineH * 0.8) continue;       // same line
      if (w.bbox.x1 > a.bbox.x0 + 5) continue;             // left of the บาท word
      const n = parseAmountToken(w.text);
      if (n != null && n > 0 && (best == null || n > best)) best = n;
    }
  }
  return best;
}

// OCR the slip and return { amount, date, time } (all best-effort, may be null).
// Two passes: (1) a binarized, digit-only pass for the amount — binarizing removes the faint
// bank watermark that corrupts the figures, and the digit whitelist stops letters being read as
// numbers; (2) a normal text pass for date/time (+ amount fallback).
async function ocrSlip(imageData) {
  const empty = { amount: null, date: null, time: null };
  try {
    const { base64Data } = parseDataUrl(imageData);
    const inputBuffer = Buffer.from(base64Data, 'base64');

    let sharp = null;
    try { sharp = (await import('sharp')).default; } catch { /* sharp optional */ }
    const render = async ops => {
      if (!sharp) return inputBuffer;
      try { return await ops(sharp(inputBuffer).rotate()).toBuffer(); } catch { return inputBuffer; }
    };

    const worker = await getOcrWorker();

    // Single full pass with layout (word boxes). Pick the amount by its position relative to the
    // "บาท" word instead of guessing from flat text (which mis-picked dates/fees).
    const buf = await render(p => p
      .resize({ width: 1500, withoutEnlargement: false, fit: 'inside' })
      .grayscale().normalize().sharpen());
    const data = await recognizeWithTimeout(worker, buf, { text: true, blocks: true });
    const fullText = data.text || '';
    const words = collectOcrWords(data.blocks);

    let amount = extractAmountByLayout(words);
    if (amount == null) amount = extractAmountFromText(fullText); // fallback: near-บาท / largest decimal
    const { date, time } = extractDateTimeFromText(fullText);

    if (SLIP_QR_DEBUG) {
      console.error('[slipOCR] amount=%s date=%s time=%s | words=%j | fullHead=%j',
        amount, date, time, words.map(w => w.text).join(' ').slice(0, 120), fullText.replace(/\s+/g, ' ').slice(0, 120));
    }
    return { amount, date, time };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// SlipOK — primary verifier (real bank check). Returns exact amount/bank/receiver/date.
// ---------------------------------------------------------------------------

function bankNameFromCode(code) {
  const c = String(code || '').trim();
  return BANK_CODE_NAMES[c] || (c || null);
}

function parseSlipOkDateTime(data) {
  const ts = normalizeString(data?.transTimestamp || data?.transTimeStamp);
  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      return { transactionDate: iso.slice(0, 10), transactionTime: iso.slice(11, 19) };
    }
  }
  let transactionDate = null;
  const raw = normalizeString(data?.transDate);
  if (/^\d{8}$/.test(raw)) transactionDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  else if (raw) transactionDate = raw;
  return { transactionDate, transactionTime: normalizeString(data?.transTime) || null };
}

// Returns { status: 'verified'|'duplicate'|'suspicious'|'unverifiable'|'error', data?, message? }
export async function verifyWithSlipOk({ imageData, expectedAmount = null, apiKey, branchId } = {}) {
  if (!apiKey || !branchId) return { status: 'error', message: 'SlipOK is not configured' };
  try {
    const { mimeType, base64Data } = parseDataUrl(imageData);
    const buffer = Buffer.from(base64Data, 'base64');
    const form = new FormData();
    form.append('files', new Blob([buffer], { type: mimeType || 'image/jpeg' }), 'slip.jpg');
    form.append('log', String(SLIPOK_LOG));
    const amt = normalizeAmount(expectedAmount);
    if (amt != null) form.append('amount', String(amt));

    const resp = await fetch(`${SLIPOK_API_BASE}/${encodeURIComponent(branchId)}`, {
      method: 'POST',
      headers: { 'x-authorization': apiKey },
      body: form,
    });
    const json = await resp.json().catch(() => null);
    const code = Number(json?.code);
    const message = json?.message || json?.data?.message || `SlipOK request failed (status ${resp.status})`;
    if (resp.ok && json?.success && json?.data) return { status: 'verified', code, data: json.data };
    if (SLIPOK_DUPLICATE_CODES.has(code)) return { status: 'duplicate', code, message: message || 'สลิปนี้ถูกใช้ไปแล้ว' };
    // SlipOK could not read the image/QR -> let the local QR+OCR fallback try.
    if (SLIPOK_CANT_READ_CODES.has(code) || !json) return { status: 'unverifiable', code, message };
    // SlipOK read the slip but rejected it (wrong receiver account, amount mismatch, not found,
    // quota, etc.) -> this is a definitive verdict, surface it instead of falling back to OCR.
    return { status: 'rejected', code, message };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'SlipOK request failed' };
  }
}

function buildSlipOkAnalysis({ data, userId, lineId, slipFingerprint }) {
  const amount = normalizeAmount(data?.amount ?? data?.paidLocalAmount);
  const { transactionDate, transactionTime } = parseSlipOkDateTime(data);
  const bank = bankNameFromCode(data?.sendingBank);
  const referenceNumber = normalizeString(data?.transRef) || null;
  const canProceed = amount !== null;
  const analysisId = crypto.randomUUID();
  const payload = {
    analysisId,
    userId: userId || null,
    lineId: lineId || null,
    amount,
    currency: 'THB',
    verificationStatus: canProceed ? 'verified' : 'uncertain',
    confidence: 1,
    bank,
    transactionDate,
    transactionTime,
    referenceNumber,
    warnings: canProceed ? [] : ['SlipOK ตรวจสลิปได้แต่ไม่พบยอดเงิน'],
    summary: canProceed ? 'ตรวจสลิปผ่าน SlipOK สำเร็จ' : 'SlipOK ตรวจได้แต่ไม่พบยอด',
    canProceed,
    slipUrl: null,
    slipFingerprint,
    verificationSource: 'slipok',
    iat: Date.now(),
    exp: Date.now() + 15 * 60 * 1000,
  };
  return { ...payload, isSlip: true, verificationToken: canProceed ? signPayload(payload) : null };
}

// ---------------------------------------------------------------------------
// Main entry: SlipOK (primary) -> local QR decode + OCR (fallback). No AI.
// ---------------------------------------------------------------------------

export async function analyzeSlipImage({ imageData, userId, lineId, companyCode }) {
  const slipFingerprint = await createSlipFingerprint(imageData);

  // Primary: SlipOK real bank verification (exact amount/bank/receiver/date).
  const slipOkConfig = getSlipOkConfig(companyCode);
  if (slipOkConfig) {
    const slipOk = await verifyWithSlipOk({ imageData, apiKey: slipOkConfig.apiKey, branchId: slipOkConfig.branchId });
    if (SLIP_QR_DEBUG) {
      console.error('[slipOK] status=%s code=%s msg=%j amount=%s bank=%s ref=%s',
        slipOk.status, slipOk.code, slipOk.message || '', slipOk.data?.amount, slipOk.data?.sendingBank, slipOk.data?.transRef);
    }
    if (slipOk.status === 'verified') {
      return buildSlipOkAnalysis({ data: slipOk.data, userId, lineId, slipFingerprint });
    }
    // SlipOK read the slip and rejected it (wrong receiver / duplicate / amount mismatch / etc.)
    // -> surface the reason; do NOT fall back to OCR (that would defeat the verification).
    if (slipOk.status === 'duplicate' || slipOk.status === 'suspicious' || slipOk.status === 'rejected') {
      return buildBlockedSlipAnalysis({
        userId,
        lineId,
        slipFingerprint,
        warnings: [slipOk.message].filter(Boolean),
        summary: slipOk.message || 'SlipOK ตรวจสลิปไม่ผ่าน',
      });
    }
    // 'unverifiable' (can't read image/QR) | 'error' -> fall through to the local QR + OCR fallback.
  }

  const qrPayload = await decodeSlipQr(imageData);
  const qr = qrPayload ? await parseSlipQr(qrPayload) : null;

  // A QR was read but it is not a valid Thai slip QR -> likely fake/tampered.
  if (qrPayload && (!qr || !qr.genuine)) {
    return buildBlockedSlipAnalysis({
      userId,
      lineId,
      slipFingerprint,
      warnings: ['อ่าน QR ได้แต่โครงสร้างไม่ผ่านการตรวจสอบ (CRC/AID ไม่ถูกต้อง)'],
      summary: 'QR ในสลิปไม่ถูกต้อง อาจเป็นสลิปปลอมหรือถูกแก้ไข',
    });
  }

  // No QR detected -> cannot verify authenticity here, hand to manual review.
  if (!qrPayload) {
    return buildManualSlipAnalysis({
      userId,
      lineId,
      slipFingerprint,
      warnings: ['อ่าน QR ในสลิปไม่ได้ กรุณาถ่ายให้เห็น QR ให้ชัดเจน'],
      summary: 'อ่าน QR ไม่ได้ ร้านจะตรวจสลิปและยอดด้วยมือ',
    });
  }

  // Genuine slip QR. OCR reads the amount + date/time as a SUGGESTION; the customer confirms
  // or edits the amount before submitting (OCR is imperfect), then the shop approves.
  const ocr = SLIP_OCR_ENABLED ? await ocrSlip(imageData) : { amount: null, date: null, time: null };
  const amountReadNote = ocr.amount != null
    ? `ระบบอ่านยอดได้ ฿${ocr.amount} (จาก OCR) — กรุณาตรวจสอบ/แก้ไขให้ตรงกับสลิปก่อนส่ง`
    : 'ตรวจสลิปจริงผ่าน QR แล้ว แต่อ่านยอดอัตโนมัติไม่ได้ กรุณากรอกยอดบนสลิป';

  return {
    analysisId: crypto.randomUUID(),
    userId: userId || null,
    lineId: lineId || null,
    amount: ocr.amount,
    currency: 'THB',
    verificationStatus: 'verified',
    confidence: 0.6,
    bank: qr.bank,
    transactionDate: ocr.date,
    transactionTime: ocr.time,
    referenceNumber: qr.referenceNumber,
    warnings: [amountReadNote],
    summary: 'สลิปจริง (QR ผ่าน) — ยืนยัน/แก้ยอดก่อนส่ง',
    canProceed: false,
    manualReview: true,
    isSlip: true,
    verificationSource: 'qr+ocr',
    verificationToken: null,
    slipUrl: null,
    slipFingerprint,
  };
}

export async function findDuplicateSlip(conn, {
  companyId,
  slipFingerprint = null,
  referenceNumber = null,
  amount = null,
  bank = null,
  transactionDate = null,
  transactionTime = null,
} = {}) {
  if (!conn || !companyId) return null;

  if (slipFingerprint) {
    const [[byFingerprint]] = await conn.query(
      `SELECT o.id AS order_id, o.order_ref, o.amount, o.ordered_at, o.slip_fingerprint,
              o.slip_reference_number, o.slip_bank, o.slip_transaction_date, o.slip_transaction_time,
              u.name AS user_name
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       WHERE o.company_id=? AND o.slip_fingerprint=?
       ORDER BY o.ordered_at DESC
       LIMIT 1`,
      [companyId, slipFingerprint]
    );
    if (byFingerprint) {
      return {
        reason: 'fingerprint',
        match: byFingerprint,
      };
    }
  }

  const normalizedReference = normalizeSlipReference(referenceNumber);
  const normalizedAmount = normalizeAmount(amount);
  if (!normalizedReference) return null;

  const params = [companyId, normalizedReference];
  let amountClause = '';
  if (normalizedAmount != null) {
    amountClause = ' AND ABS(o.amount - ?) < 0.01';
    params.push(normalizedAmount);
  }

  const [[byReference]] = await conn.query(
    `SELECT o.id AS order_id, o.order_ref, o.amount, o.ordered_at, o.slip_fingerprint,
            o.slip_reference_number, o.slip_bank, o.slip_transaction_date, o.slip_transaction_time,
            u.name AS user_name
     FROM orders o
     LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
     WHERE o.company_id=? AND o.slip_reference_number=?${amountClause}
     ORDER BY o.ordered_at DESC
     LIMIT 1`,
    params
  );
  if (byReference) {
    return {
      reason: 'reference',
      match: byReference,
    };
  }

  const normalizedBank = normalizeString(bank);
  const normalizedDate = normalizeString(transactionDate);
  const normalizedTime = normalizeString(transactionTime);
  if (normalizedAmount != null && normalizedBank && normalizedDate && normalizedTime) {
    const [[byMeta]] = await conn.query(
      `SELECT o.id AS order_id, o.order_ref, o.amount, o.ordered_at, o.slip_fingerprint,
              o.slip_reference_number, o.slip_bank, o.slip_transaction_date, o.slip_transaction_time,
              u.name AS user_name
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       WHERE o.company_id=?
         AND ABS(o.amount - ?) < 0.01
         AND UPPER(TRIM(o.slip_bank)) = UPPER(TRIM(?))
         AND DATE_FORMAT(o.slip_transaction_date, '%Y-%m-%d') = ?
         AND UPPER(TRIM(o.slip_transaction_time)) = UPPER(TRIM(?))
       ORDER BY o.ordered_at DESC
       LIMIT 1`,
      [companyId, normalizedAmount, normalizedBank, normalizedDate, normalizedTime]
    );
    if (byMeta) {
      return {
        reason: 'metadata',
        match: byMeta,
      };
    }
  }

  return null;
}

export async function recordSlipReviewLog(conn, {
  companyId,
  analysisId,
  userId = null,
  lineId = null,
  source = 'analyze',
  status = 'manual',
  amount = null,
  bank = null,
  referenceNumber = null,
  slipFingerprint = null,
  transactionDate = null,
  transactionTime = null,
  duplicateOrderId = null,
  duplicateOrderRef = null,
  reason = null,
} = {}) {
  if (!conn || !companyId || !analysisId) return null;

  const normalizedStatus = ['verified', 'uncertain', 'suspicious', 'duplicate', 'manual'].includes(status)
    ? status
    : 'manual';
  const normalizedSource = String(source || 'analyze').toLowerCase() === 'order' ? 'order' : 'analyze';
  const normalizedAmount = normalizeAmount(amount);
  const normalizedBank = normalizeString(bank) || null;
  const normalizedReference = normalizeSlipReference(referenceNumber) || null;
  const normalizedFingerprint = normalizeString(slipFingerprint) || null;
  const normalizedTransactionDate = normalizeString(transactionDate) || null;
  const normalizedTransactionTime = normalizeString(transactionTime) || null;
  const normalizedReason = normalizeString(reason) || null;

  await conn.query(
    `INSERT INTO slip_review_logs (
       company_id, analysis_id, user_id, line_id, source, status, amount, bank, reference_number,
       slip_fingerprint, slip_transaction_date, slip_transaction_time, duplicate_order_id,
       duplicate_order_ref, reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       line_id = VALUES(line_id),
       source = VALUES(source),
       status = VALUES(status),
       amount = VALUES(amount),
       bank = VALUES(bank),
       reference_number = VALUES(reference_number),
       slip_fingerprint = VALUES(slip_fingerprint),
       slip_transaction_date = VALUES(slip_transaction_date),
       slip_transaction_time = VALUES(slip_transaction_time),
       duplicate_order_id = VALUES(duplicate_order_id),
       duplicate_order_ref = VALUES(duplicate_order_ref),
       reason = VALUES(reason)`,
    [
      companyId,
      String(analysisId),
      userId || null,
      lineId || null,
      normalizedSource,
      normalizedStatus,
      normalizedAmount,
      normalizedBank,
      normalizedReference,
      normalizedFingerprint,
      normalizedTransactionDate,
      normalizedTransactionTime,
      duplicateOrderId || null,
      duplicateOrderRef || null,
      normalizedReason,
    ]
  );

  return {
    companyId,
    analysisId: String(analysisId),
    userId: userId || null,
    lineId: lineId || null,
    source: normalizedSource,
    status: normalizedStatus,
    amount: normalizedAmount,
    bank: normalizedBank,
    referenceNumber: normalizedReference,
    slipFingerprint: normalizedFingerprint,
    transactionDate: normalizedTransactionDate,
    transactionTime: normalizedTransactionTime,
    duplicateOrderId: duplicateOrderId || null,
    duplicateOrderRef: duplicateOrderRef || null,
    reason: normalizedReason,
  };
}
