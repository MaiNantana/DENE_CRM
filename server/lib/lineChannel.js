import './env.js';
import crypto from 'crypto';

// Per-company LINE Messaging API credentials. Each LINE OA (DENE / KEFERA) is a separate
// channel with its own secret + access token and its own webhook URL.
function readChannelConfig(companyCode) {
  const code = String(companyCode || '').trim().toUpperCase();
  const secret = process.env[`LINE_CHANNEL_SECRET_${code}`]?.trim() || '';
  const accessToken = process.env[`LINE_CHANNEL_ACCESS_TOKEN_${code}`]?.trim() || '';
  if (!secret || !accessToken) return null;
  return { code, secret, accessToken };
}

export function getLineChannelConfig(companyCode) {
  return readChannelConfig(companyCode);
}

// Validate the X-Line-Signature header against the raw request body.
export function verifyLineSignature(channelSecret, rawBody, signature) {
  if (!channelSecret || !signature) return false;
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const expected = crypto.createHmac('sha256', channelSecret).update(buffer).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(String(signature));
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

// Download the binary content of an image message from LINE.
export async function getLineImageDataUrl(accessToken, messageId) {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`LINE content fetch failed (status ${response.status})`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

// Reply to a message using its (single-use, short-lived) reply token.
export async function replyLineText(accessToken, replyToken, text) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: String(text || '').slice(0, 5000) }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`LINE reply failed (status ${response.status}) ${detail}`.trim());
  }
  return true;
}
