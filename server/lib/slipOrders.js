import crypto from 'crypto';
import db from '../db.js';
import { findDuplicateSlip, recordSlipReviewLog, parseDataUrl } from './slipVerification.js';
import { storeSlipImage } from './slipStorage.js';

function normalizeOrderAmount(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100) / 100;
}

// Mirrors the points calculation in routes/orders.js (kept in sync intentionally).
function calculatePoints(amount, bahtPerPoint = 10, multiplier = 1) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount <= 0) return 0;
  const rate = Number(bahtPerPoint) || 10;
  const mult = Number(multiplier) || 1;
  return Math.floor((numericAmount / rate) * mult);
}

function formatSlipAmount(amount) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/**
 * Create a pending slip order for a member whose chat slip passed QR + OCR verification.
 * No points/total_spent are awarded here — the order waits for shop approval, exactly like
 * the LIFF upload flow. Returns { orderRef, amount, pointsEarned } or { duplicate, match }.
 */
export async function createMemberSlipOrder({ companyId, user, analysis, slipImageData }) {
  const amount = normalizeOrderAmount(analysis?.amount);
  if (!amount) throw new Error('slip amount is required');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const slipFingerprint = analysis?.slipFingerprint || null;
    const referenceNumber = analysis?.referenceNumber || null;
    const bank = analysis?.bank || null;

    const duplicate = await findDuplicateSlip(conn, {
      companyId,
      slipFingerprint,
      referenceNumber,
      amount,
      bank,
    });
    if (duplicate) {
      await recordSlipReviewLog(db, {
        companyId,
        analysisId: analysis?.analysisId || `chat-${Date.now()}`,
        userId: user.id,
        lineId: user.line_id,
        source: 'order',
        status: 'duplicate',
        amount,
        bank,
        referenceNumber,
        slipFingerprint,
        duplicateOrderId: duplicate.match?.order_id || null,
        duplicateOrderRef: duplicate.match?.order_ref || null,
        reason: `พบสลิปซ้ำกับออเดอร์ ${duplicate.match?.order_ref || 'รายการเดิม'}`,
      }).catch(() => null);
      await conn.rollback();
      return { duplicate: true, match: duplicate.match };
    }

    const [[tierRow]] = await conn.query(
      `SELECT COALESCE(baht_per_point, 10) AS baht_per_point, COALESCE(multiplier, 1) AS multiplier
       FROM tiers WHERE company_id=? AND name=? LIMIT 1`,
      [companyId, user.tier]
    );
    const bahtPerPoint = Number(tierRow?.baht_per_point) || 10;
    const multiplier = Number(tierRow?.multiplier) || 1;
    const pointsEarned = calculatePoints(amount, bahtPerPoint, multiplier);

    const parsedSlip = parseDataUrl(slipImageData);
    const slipUrl = await storeSlipImage({
      analysisId: crypto.randomUUID(),
      mimeType: parsedSlip.mimeType,
      base64Data: parsedSlip.base64Data,
    });

    const orderRef = `ord-${Date.now()}`;
    const note = `ส่งสลิปผ่าน LINE chat: ${formatSlipAmount(amount)} THB`;

    await conn.query(
      `INSERT INTO orders (
         company_id, order_ref, user_id, amount, discount, discount_mode, points_earned,
         slip_url, slip_fingerprint, slip_reference_number, slip_bank, slip_transaction_date,
         slip_transaction_time, slip_verification_status, note, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        orderRef,
        user.id,
        amount,
        0,
        'manual',
        pointsEarned,
        slipUrl,
        slipFingerprint,
        referenceNumber,
        bank,
        null,
        null,
        'verified',
        note,
        'pending',
      ]
    );
    const [[{ id: orderId }]] = await conn.query(
      'SELECT id FROM orders WHERE order_ref=? AND company_id=?',
      [orderRef, companyId]
    );
    await conn.query(
      'INSERT INTO order_items (company_id, order_id, product_id, name, unit_price, qty) VALUES (?, ?, ?, ?, ?, ?)',
      [companyId, orderId, null, `ชำระเงินผ่านสลิป ฿${formatSlipAmount(amount)}`, amount, 1]
    );

    await conn.commit();
    return { orderRef, amount, pointsEarned };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
