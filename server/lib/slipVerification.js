import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { storeSlipImage } from './slipStorage.js';

const SLIP_SECRET = process.env.SLIP_ANALYSIS_SECRET || process.env.AUTH_SECRET || 'dev-slip-analysis-secret';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';
const SLIP_MODEL = process.env.GEMINI_SLIP_MODEL || 'gemini-2.5-flash';
const MIN_SLIP_CONFIDENCE = Number(process.env.SLIP_MIN_CONFIDENCE || 0.72);

let aiClient = null;

function getAiClient() {
  if (!GEMINI_API_KEY) return null;
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return aiClient;
}

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

function parseDataUrl(imageData) {
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

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => normalizeString(item))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
}

function parseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function createSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      verificationStatus: {
        type: 'string',
        enum: ['verified', 'uncertain', 'suspicious'],
        description: 'How trustworthy the slip image looks.',
      },
      amount: {
        type: ['number', 'null'],
        minimum: 0,
        description: 'The total amount shown on the slip in Thai Baht.',
      },
      currency: {
        type: 'string',
        enum: ['THB'],
        description: 'Currency shown on the slip.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score from 0 to 1.',
      },
      bank: {
        type: ['string', 'null'],
        description: 'Bank or payment provider visible on the slip.',
      },
      transactionDate: {
        type: ['string', 'null'],
        description: 'Date visible on the slip, preferably YYYY-MM-DD.',
      },
      transactionTime: {
        type: ['string', 'null'],
        description: 'Time visible on the slip, preferably HH:MM or HH:MM:SS.',
      },
      referenceNumber: {
        type: ['string', 'null'],
        description: 'Reference / transaction number visible on the slip.',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
        description: 'Short warnings or reasons for uncertainty/suspicion.',
      },
      summary: {
        type: 'string',
        description: 'Short Thai or English summary of the analysis.',
      },
    },
    required: ['verificationStatus', 'amount', 'currency', 'confidence', 'warnings', 'summary'],
  };
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

export async function analyzeSlipImage({ imageData, userId, lineId }) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const { mimeType, base64Data } = parseDataUrl(imageData);
  const response = await ai.models.generateContent({
    model: SLIP_MODEL,
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: [
            'You are verifying a Thai bank transfer slip for a coffee shop CRM.',
            'Extract the total amount shown on the slip and assess whether the image looks like a real payment slip.',
            'Be conservative.',
            'If the amount is not clearly visible, set verificationStatus to "uncertain" and amount to null.',
            'If there are visible signs of editing, tampering, mismatched fonts, cropped borders hiding details, or the image does not look like a transfer slip, set verificationStatus to "suspicious".',
            'If everything looks like a normal transfer slip and the total amount is clearly visible, set verificationStatus to "verified".',
            'Do not guess. Return only JSON.',
          ].join(' '),
        },
      ],
    }],
    config: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseJsonSchema: createSchema(),
    },
  });

  const parsed = parseModelJson(response.text);
  const verificationStatus = ['verified', 'uncertain', 'suspicious'].includes(parsed.verificationStatus)
    ? parsed.verificationStatus
    : 'uncertain';
  const amount = normalizeAmount(parsed.amount);
  const confidence = clampConfidence(parsed.confidence);
  const warnings = normalizeWarnings(parsed.warnings);
  const bank = normalizeString(parsed.bank) || null;
  const transactionDate = normalizeString(parsed.transactionDate) || null;
  const transactionTime = normalizeString(parsed.transactionTime) || null;
  const referenceNumber = normalizeString(parsed.referenceNumber) || null;
  const summary = normalizeString(parsed.summary) || 'Slip analysis completed.';
  const currency = normalizeString(parsed.currency).toUpperCase() === 'THB' ? 'THB' : 'THB';

  const canProceed = verificationStatus === 'verified' && amount !== null && confidence >= MIN_SLIP_CONFIDENCE && warnings.length === 0;
  const finalStatus = canProceed ? 'verified' : verificationStatus === 'suspicious' ? 'suspicious' : 'uncertain';
  const analysisId = crypto.randomUUID();
  const slipUrl = canProceed ? await storeSlipImage({ analysisId, mimeType, base64Data }) : null;
  const payload = {
    analysisId,
    userId: userId || null,
    lineId: lineId || null,
    amount,
    currency,
    verificationStatus: finalStatus,
    confidence,
    bank,
    transactionDate,
    transactionTime,
    referenceNumber,
    warnings,
    summary,
    canProceed,
    slipUrl,
    iat: Date.now(),
    exp: Date.now() + 15 * 60 * 1000,
  };

  return {
    ...payload,
    verificationToken: canProceed ? signPayload(payload) : null,
  };
}
