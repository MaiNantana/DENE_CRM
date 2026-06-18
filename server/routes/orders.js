import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { createSlipFingerprint, findDuplicateSlip, parseDataUrl, recordSlipReviewLog, verifySlipToken } from '../lib/slipVerification.js';
import { getSlipStoragePath, storeSlipImage } from '../lib/slipStorage.js';
import { syncUserPointsState, awardUserPoints, consumeUserPoints } from '../lib/points.js';
import { getOrCreateGuestUser } from '../lib/guestUser.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

const VALID_STATUS = ['pending', 'paid', 'cancel'];
const STATUS_ALIASES = {
  approved: 'paid',
  rejected: 'cancel',
};

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status;
}

function allowedStatuses(status) {
  const normalized = normalizeStatus(status);
  if (!normalized || !VALID_STATUS.includes(normalized)) return null;
  if (normalized === 'paid') return ['paid', 'approved'];
  if (normalized === 'cancel') return ['cancel', 'rejected'];
  return [normalized];
}

function normalizeDiscountMode(value, fallback = 'manual') {
  return String(value || fallback).trim().toLowerCase() === 'member' ? 'member' : 'manual';
}

function calculatePoints(amount, bahtPerPoint = 10, multiplier = 1) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount <= 0) return 0;
  const rate = Number(bahtPerPoint) || 10;
  const mult = Number(multiplier) || 1;
  return Math.floor((numericAmount / rate) * mult);
}

function normalizeOrderAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 0;
  return Math.round(numericAmount * 100) / 100;
}

function normalizeOrderInputAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) return null;
  return Math.round(numericAmount * 100) / 100;
}

async function getUserTierProfile(conn, userId, companyId) {
  const user = await syncUserPointsState(conn, userId, companyId);
  if (!user) return null;
  const [[memberRow]] = await conn.query(
    'SELECT is_member FROM users WHERE id=? AND company_id=? LIMIT 1',
    [userId, companyId]
  );
  const [[tierRow]] = await conn.query(
    `SELECT COALESCE(baht_per_point, 10) AS baht_per_point,
            COALESCE(multiplier, 1) AS multiplier,
            COALESCE(discount_percent, 0) AS discount_percent
     FROM tiers
     WHERE company_id=? AND name=?
     LIMIT 1`,
    [companyId, user.tier]
  );
  return {
    userId: user.id,
    lineId: user.line_id,
    userTier: user.tier,
    isMember: Number(memberRow?.is_member) !== 0,
    bahtPerPoint: Number(tierRow?.baht_per_point) || 10,
    multiplier: Number(tierRow?.multiplier) || 1,
    discountPercent: Number(tierRow?.discount_percent) || 0,
  };
}

async function getOrderContext(conn, userId, amount, companyId) {
  const profile = await getUserTierProfile(conn, userId, companyId);
  if (!profile) return null;
  return {
    ...profile,
    // Non-members (walk-in / guest) never earn points.
    points: profile.isMember ? calculatePoints(amount, profile.bahtPerPoint, profile.multiplier) : 0,
  };
}

function calculateOrderFinancials(items, rawDiscount, { discountMode = 'manual', memberDiscountPercent = 0 } = {}) {
  const subtotal = normalizeOrderAmount(
    items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) || 0) * (parseInt(item.qty) || 1), 0)
  );
  const mode = normalizeDiscountMode(discountMode);
  const discount = mode === 'member'
    ? Math.min(normalizeOrderAmount((subtotal * (Number(memberDiscountPercent) || 0)) / 100), subtotal)
    : (() => {
        const parsedDiscount = rawDiscount == null || rawDiscount === ''
          ? 0
          : normalizeOrderInputAmount(rawDiscount);
        if (parsedDiscount == null) return null;
        return Math.min(parsedDiscount, subtotal);
      })();
  if (discount == null) return null;
  const amount = normalizeOrderAmount(subtotal - discount);
  return { subtotal, discount, amount, discountMode: mode };
}

function formatSlipAmount(amount) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildSlipOrderItems(amount) {
  const normalizedAmount = normalizeOrderAmount(amount);
  return [{
    productId: null,
    name: `ชำระเงินผ่านสลิป ฿${formatSlipAmount(normalizedAmount)}`,
    unitPrice: normalizedAmount,
    qty: 1,
  }];
}

async function adjustUserPoints(conn, userId, delta, companyId, { refId = null, note = null } = {}) {
  if (!delta) return;
  if (delta > 0) {
    await awardUserPoints(conn, { companyId, userId, points: delta, refId, note });
  } else {
    await consumeUserPoints(conn, { companyId, userId, points: Math.abs(delta), refId, note });
  }
}

async function adjustUserTotalSpent(conn, userId, delta, companyId) {
  if (!delta) return;
  if (delta > 0) {
    await conn.query('UPDATE users SET total_spent = total_spent + ? WHERE id=? AND company_id=?', [delta, userId, companyId]);
  } else {
    await conn.query('UPDATE users SET total_spent = GREATEST(total_spent - ?, 0) WHERE id=? AND company_id=?', [Math.abs(delta), userId, companyId]);
  }
}

async function reconcileOrderPoints(conn, { oldOrder, orderId, orderRef, newUserId, newStatus, newAmount, companyId }) {
  const context = await getOrderContext(conn, newUserId, newAmount, companyId);
  if (!context) return null;

  const previousStatus = normalizeStatus(oldOrder?.status || 'pending');
  const previousUserId = oldOrder?.user_id || newUserId;
  const previousPoints = Number(oldOrder?.points_earned ?? 0) || (oldOrder
    ? calculatePoints(oldOrder.amount, oldOrder.baht_per_point, oldOrder.multiplier)
    : 0);
  const nextStatus = normalizeStatus(newStatus || previousStatus);
  const nextIsPaid = nextStatus === 'paid';
  const previousIsPaid = previousStatus === 'paid';
  const noteBase = `ออเดอร์ ${orderRef || orderId}`;

  if (previousIsPaid && previousUserId === newUserId) {
    const delta = context.points - previousPoints;
    if (delta !== 0) {
      await adjustUserPoints(conn, newUserId, delta, companyId, {
        refId: orderId,
        note: delta > 0 ? `${noteBase} ปรับแต้มเพิ่ม` : `${noteBase} ปรับแต้มลด`,
      });
    }
  } else if (previousIsPaid && previousUserId !== newUserId) {
    if (previousPoints > 0) {
      await adjustUserPoints(conn, previousUserId, -previousPoints, companyId, {
        refId: orderId,
        note: `${noteBase} ย้ายออเดอร์ออกจากสมาชิก`,
      });
    }
    if (nextIsPaid && context.points > 0) {
      await adjustUserPoints(conn, newUserId, context.points, companyId, {
        refId: orderId,
        note: `${noteBase} ได้รับแต้ม`,
      });
    }
  } else if (!previousIsPaid && nextIsPaid) {
    if (context.points > 0) {
      await adjustUserPoints(conn, newUserId, context.points, companyId, {
        refId: orderId,
        note: `${noteBase} ได้รับแต้ม`,
      });
    }
  } else if (previousIsPaid && !nextIsPaid) {
    if (previousPoints > 0) {
      await adjustUserPoints(conn, previousUserId, -previousPoints, companyId, {
        refId: orderId,
        note: `${noteBase} ยกเลิก/ย้อนสถานะ`,
      });
    }
  }

  await conn.query('UPDATE orders SET points_earned=? WHERE id=? AND company_id=?', [context.points, orderId, companyId]);
  return context.points;
}

async function reconcileOrderTotalSpent(conn, { oldOrder, newUserId, newStatus, newAmount, companyId }) {
  const previousStatus = normalizeStatus(oldOrder?.status || 'pending');
  const previousUserId = oldOrder?.user_id || newUserId;
  const previousAmount = Number(oldOrder?.amount ?? 0) || 0;
  const previousContribution = previousStatus === 'paid' ? previousAmount : 0;
  const nextStatus = normalizeStatus(newStatus || previousStatus);
  const nextContribution = nextStatus === 'paid' ? (Number(newAmount ?? 0) || 0) : 0;

  if (previousUserId === newUserId) {
    const delta = nextContribution - previousContribution;
    if (delta !== 0) {
      await adjustUserTotalSpent(conn, newUserId, delta, companyId);
    }
    return;
  }

  if (previousContribution > 0) {
    await adjustUserTotalSpent(conn, previousUserId, -previousContribution, companyId);
  }
  if (nextContribution > 0) {
    await adjustUserTotalSpent(conn, newUserId, nextContribution, companyId);
  }
}

// GET /api/orders?status=&limit=
router.get('/', aw(async (req, res) => {
  const { status, limit = 200 } = req.query;
  const statusFilter = status ? allowedStatuses(status) : null;
  const companyId = getCompanyId(req);
  if (status && !statusFilter) return res.status(400).json({ error: 'Invalid status' });

  const query = statusFilter
    ? `SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier,
             COALESCE(t.baht_per_point, 10) AS baht_per_point,
             COALESCE(t.multiplier, 1) AS multiplier
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
       WHERE o.company_id=? AND o.status IN (${statusFilter.map(() => '?').join(',')})
       ORDER BY o.ordered_at DESC LIMIT ?`
    : `SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier,
             COALESCE(t.baht_per_point, 10) AS baht_per_point,
             COALESCE(t.multiplier, 1) AS multiplier
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
       WHERE o.company_id=?
       ORDER BY o.ordered_at DESC LIMIT ?`;

  const [rows] = statusFilter
    ? await db.query(query, [companyId, ...statusFilter, parseInt(limit)])
    : await db.query(query, [companyId, parseInt(limit)]);

  // attach items
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [items] = await db.query(
      `SELECT * FROM order_items WHERE company_id=? AND order_id IN (${ids.map(() => '?').join(',')})`,
      [companyId, ...ids]
    );
    const itemMap = {};
    items.forEach(i => { (itemMap[i.order_id] = itemMap[i.order_id] || []).push(i); });
    rows.forEach(r => { r.items = itemMap[r.id] || []; });
  }
  res.json(rows);
}));

// GET /api/orders/slip-reports?limit=20
router.get('/slip-reports', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  const windowDays = Math.min(Math.max(parseInt(req.query.windowDays, 10) || 30, 1), 365);
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 1), 24);

  const now = new Date();
  const monthMap = new Map();
  const monthKeys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7);
    monthKeys.push(monthKey);
    monthMap.set(monthKey, {
      monthKey,
      monthLabel: date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
      total: 0,
      manual: 0,
      verified: 0,
      uncertain: 0,
      suspicious: 0,
      duplicate: 0,
    });
  }
  const monthStart = monthKeys[0] ? `${monthKeys[0]}-01` : null;

  const [[summary]] = await db.query(
    `
      SELECT
        COUNT(*) AS totalAttempts,
        COALESCE(SUM(status='duplicate'), 0) AS duplicateAttempts,
        COALESCE(SUM(status='suspicious'), 0) AS suspiciousAttempts
      FROM slip_review_logs
      WHERE company_id=?
        AND status IN ('duplicate', 'suspicious')
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
    [companyId, windowDays]
  );

  const [recentRows] = await db.query(
    `
      SELECT
        l.id,
        l.company_id AS companyId,
        l.analysis_id AS analysisId,
        l.user_id AS userId,
        u.name AS userName,
        l.line_id AS lineId,
        l.source,
        l.status,
        l.amount,
        l.bank,
        l.reference_number AS referenceNumber,
        l.slip_fingerprint AS slipFingerprint,
        l.slip_transaction_date AS slipTransactionDate,
        l.slip_transaction_time AS slipTransactionTime,
        l.duplicate_order_id AS duplicateOrderId,
        l.duplicate_order_ref AS duplicateOrderRef,
        l.reason,
        l.created_at AS createdAt
      FROM slip_review_logs l
      LEFT JOIN users u ON u.id=l.user_id AND u.company_id=l.company_id
      WHERE l.company_id=?
        AND l.status IN ('duplicate', 'suspicious')
      ORDER BY l.created_at DESC
      LIMIT ?
    `,
    [companyId, limit]
  );

  if (monthStart) {
    const [monthlyRows] = await db.query(
      `
        SELECT
          DATE_FORMAT(o.ordered_at, '%Y-%m') AS monthKey,
          COUNT(*) AS total,
          COALESCE(SUM(o.slip_verification_status='manual'), 0) AS manual,
          COALESCE(SUM(o.slip_verification_status='verified'), 0) AS verified,
          COALESCE(SUM(o.slip_verification_status='uncertain'), 0) AS uncertain,
          COALESCE(SUM(o.slip_verification_status='suspicious'), 0) AS suspicious,
          COALESCE(SUM(o.slip_verification_status='duplicate'), 0) AS duplicate
        FROM orders o
        WHERE o.company_id=?
          AND o.slip_verification_status IS NOT NULL
          AND o.ordered_at >= ?
        GROUP BY DATE_FORMAT(o.ordered_at, '%Y-%m')
        ORDER BY monthKey ASC
      `,
      [companyId, monthStart]
    );

    monthlyRows.forEach(row => {
      const item = monthMap.get(row.monthKey);
      if (!item) return;
      item.total = Number(row.total || 0);
      item.manual = Number(row.manual || 0);
      item.verified = Number(row.verified || 0);
      item.uncertain = Number(row.uncertain || 0);
      item.suspicious = Number(row.suspicious || 0);
      item.duplicate = Number(row.duplicate || 0);
    });
  }

  res.json({
    windowDays,
    months,
    summary: {
      totalAttempts: Number(summary?.totalAttempts || 0),
      duplicateAttempts: Number(summary?.duplicateAttempts || 0),
      suspiciousAttempts: Number(summary?.suspiciousAttempts || 0),
      manualAttempts: 0,
      verifiedAttempts: 0,
      uncertainAttempts: 0,
    },
    monthly: Array.from(monthMap.values()),
    recent: recentRows,
  });
}));

// GET /api/orders/:id
router.get('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const [[order]] = await db.query(
    `SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier,
            COALESCE(t.baht_per_point, 10) AS baht_per_point,
            COALESCE(t.multiplier, 1) AS multiplier
     FROM orders o
     LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
     LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
     WHERE o.id=? AND o.company_id=?`,
    [req.params.id, companyId]
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const [items] = await db.query('SELECT * FROM order_items WHERE order_id=? AND company_id=?', [req.params.id, companyId]);
  order.items = items;
  res.json(order);
}));

router.get('/:id/slip-image', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const [[order]] = await db.query('SELECT id, slip_url FROM orders WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!order || !order.slip_url) return res.status(404).json({ error: 'Slip image not found' });

  const slipPath = getSlipStoragePath(order.slip_url);
  if (!slipPath) return res.status(404).json({ error: 'Slip image not found' });

  try {
    await fs.access(slipPath);
  } catch {
    return res.status(404).json({ error: 'Slip image not found' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.resolve(slipPath));
}));

// POST /api/orders
router.post('/', aw(async (req, res) => {
  const {
    items = [],
    discount,
    discountMode,
    note,
    status = 'pending',
    slipVerificationToken,
    slipImageData,
    slipAmount,
    slipReference,
    slipBank,
    slipTransactionDate,
    slipTransactionTime,
    lineId,
    guestName,
  } = req.body;
  let userId = req.body.userId;
  const companyId = getCompanyId(req);
  const normalizedStatus = normalizeStatus(status || 'pending');
  const normalizedItems = Array.isArray(items) ? items : [];
  // Members pass userId; non-members (walk-in slip uploads) pass lineId and become a guest record.
  if (!userId && !lineId) return res.status(400).json({ error: 'userId or lineId is required' });
  if (!VALID_STATUS.includes(normalizedStatus)) return res.status(400).json({ error: 'Invalid status' });
  const normalizedDiscountMode = normalizeDiscountMode(discountMode);

  const orderRef = `ord-${Date.now()}`;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (!userId && lineId) {
      const guest = await getOrCreateGuestUser(conn, companyId, lineId, guestName);
      userId = guest.id;
    }
    const userProfile = await getUserTierProfile(conn, userId, companyId);
    if (!userProfile) { await conn.rollback(); return res.status(404).json({ error: 'User not found' }); }

    let amount = 0;
    let orderDiscount = 0;
    let orderItems = normalizedItems;
    let finalStatus = normalizedStatus;
    let finalDiscountMode = normalizedDiscountMode;
    let slipPayload = null;
    let slipStorageData = null;

    if (slipVerificationToken) {
      slipPayload = verifySlipToken(slipVerificationToken);
      if (!slipPayload) {
        await conn.rollback();
        return res.status(400).json({ error: 'Slip verification token is invalid or expired' });
      }
      if (slipPayload.userId && slipPayload.userId !== userId) {
        await conn.rollback();
        return res.status(400).json({ error: 'Slip verification does not match the selected user' });
      }
      if (slipPayload.lineId && slipPayload.lineId !== userProfile.lineId) {
        await conn.rollback();
        return res.status(400).json({ error: 'Line ID mismatch' });
      }
      if (!slipPayload.canProceed || slipPayload.verificationStatus !== 'verified') {
        await conn.rollback();
        return res.status(400).json({ error: 'Slip is not verified' });
      }
      if (!slipImageData) {
        await conn.rollback();
        return res.status(400).json({ error: 'slipImageData is required' });
      }

      amount = normalizeOrderAmount(slipPayload.amount);
      if (!amount) {
        await conn.rollback();
        return res.status(400).json({ error: 'Slip amount is required' });
      }
      const parsedSlip = parseDataUrl(slipImageData);
      const slipFingerprint = await createSlipFingerprint(slipImageData);
      if (slipPayload.slipFingerprint && slipPayload.slipFingerprint !== slipFingerprint) {
        await conn.rollback();
        return res.status(400).json({ error: 'Slip image mismatch' });
      }
      const duplicateSlip = await findDuplicateSlip(conn, {
        companyId,
        slipFingerprint,
        referenceNumber: slipPayload.referenceNumber,
        amount,
        bank: slipPayload.bank,
        transactionDate: slipPayload.transactionDate,
        transactionTime: slipPayload.transactionTime,
      });
      if (duplicateSlip) {
        await recordSlipReviewLog(db, {
          companyId,
          analysisId: slipPayload.analysisId || orderRef,
          userId,
          lineId: userProfile.lineId,
          source: 'order',
          status: 'duplicate',
          amount,
          bank: slipPayload.bank,
          referenceNumber: slipPayload.referenceNumber,
          slipFingerprint,
          transactionDate: slipPayload.transactionDate,
          transactionTime: slipPayload.transactionTime,
          duplicateOrderId: duplicateSlip.match?.order_id || null,
          duplicateOrderRef: duplicateSlip.match?.order_ref || null,
          reason: `พบสลิปซ้ำกับออเดอร์ ${duplicateSlip.match?.order_ref || 'รายการเดิม'}`,
        }).catch(() => null);
        await conn.rollback();
        return res.status(409).json({
          error: `พบสลิปซ้ำกับออเดอร์ ${duplicateSlip.match?.order_ref || 'รายการเดิม'}`,
          duplicateOrderRef: duplicateSlip.match?.order_ref || null,
        });
      }
      const slipUrl = await storeSlipImage({
        analysisId: crypto.randomUUID(),
        mimeType: parsedSlip.mimeType,
        base64Data: parsedSlip.base64Data,
      });
      orderItems = buildSlipOrderItems(amount);
      finalStatus = 'pending';
      finalDiscountMode = 'manual';
      slipStorageData = {
        slipUrl,
        slipFingerprint,
      };
    } else if (slipImageData) {
      const parsedSlip = parseDataUrl(slipImageData);
      const slipFingerprint = await createSlipFingerprint(slipImageData);
      const manualSlipAmount = normalizeOrderAmount(slipAmount);
      if (!manualSlipAmount) {
        await conn.rollback();
        return res.status(400).json({ error: 'slipAmount is required' });
      }
      // QR data (when the slip QR was decoded): used for stronger duplicate detection + records.
      const qrReference = typeof slipReference === 'string' && slipReference.trim() ? slipReference.trim() : null;
      const qrBank = typeof slipBank === 'string' && slipBank.trim() ? slipBank.trim() : null;
      const qrDate = typeof slipTransactionDate === 'string' && slipTransactionDate.trim() ? slipTransactionDate.trim() : null;
      const qrTime = typeof slipTransactionTime === 'string' && slipTransactionTime.trim() ? slipTransactionTime.trim() : null;

      const duplicateSlip = await findDuplicateSlip(conn, {
        companyId,
        slipFingerprint,
        referenceNumber: qrReference,
        amount: manualSlipAmount,
        bank: qrBank,
      });
      if (duplicateSlip) {
        await recordSlipReviewLog(db, {
          companyId,
          analysisId: `manual-${orderRef}`,
          userId,
          lineId: userProfile.lineId,
          source: 'order',
          status: 'duplicate',
          amount: manualSlipAmount,
          bank: qrBank,
          referenceNumber: qrReference,
          slipFingerprint,
          duplicateOrderId: duplicateSlip.match?.order_id || null,
          duplicateOrderRef: duplicateSlip.match?.order_ref || null,
          reason: `พบสลิปซ้ำกับออเดอร์ ${duplicateSlip.match?.order_ref || 'รายการเดิม'}`,
        }).catch(() => null);
        await conn.rollback();
        return res.status(409).json({
          error: `พบสลิปซ้ำกับออเดอร์ ${duplicateSlip.match?.order_ref || 'รายการเดิม'}`,
          duplicateOrderRef: duplicateSlip.match?.order_ref || null,
        });
      }
      const slipUrl = await storeSlipImage({
        analysisId: crypto.randomUUID(),
        mimeType: parsedSlip.mimeType,
        base64Data: parsedSlip.base64Data,
      });
      amount = manualSlipAmount;
      orderItems = buildSlipOrderItems(amount);
      orderDiscount = 0;
      finalStatus = 'pending';
      finalDiscountMode = 'manual';
      slipPayload = {
        manualReview: true,
        slipUrl,
        slipFingerprint,
        referenceNumber: qrReference,
        bank: qrBank,
        transactionDate: qrDate,
        transactionTime: qrTime,
        // Authenticity was confirmed by the slip QR; only the amount is human-entered.
        verificationStatus: qrReference ? 'verified' : 'manual',
      };
    } else {
      if (!orderItems.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'items cannot be empty' });
      }
      const financials = calculateOrderFinancials(orderItems, discount, {
        discountMode: normalizedDiscountMode,
        memberDiscountPercent: userProfile.discountPercent,
      });
      if (!financials) {
        await conn.rollback();
        return res.status(400).json({ error: 'Invalid discount' });
      }
      amount = financials.amount;
      orderDiscount = financials.discount;
      finalDiscountMode = financials.discountMode;
    }

    const context = await getOrderContext(conn, userId, amount, companyId);
    if (!context) { await conn.rollback(); return res.status(404).json({ error: 'User not found' }); }
    const baseNote = typeof note === 'string' ? note.trim() : '';
    const slipSummary = slipPayload && typeof slipPayload.summary === 'string' && slipPayload.summary.trim()
      ? slipPayload.summary.trim()
      : 'Slip analysis completed.';
    const slipReviewNote = slipPayload
      ? slipPayload.manualReview
        ? `ส่งสลิปเข้าตรวจด้วยมือ: ${formatSlipAmount(amount)} THB`
        : `ตรวจสลิปอัตโนมัติ: ${formatSlipAmount(amount)} THB | ${slipSummary}`
      : null;
    const orderNote = slipPayload
      ? [baseNote, slipReviewNote]
          .filter(Boolean)
          .join('\n\n')
      : (baseNote || null);
    const slipVerificationStatus = slipPayload
      ? (slipPayload.verificationStatus || (slipPayload.manualReview ? 'manual' : 'verified'))
      : null;
    const slipUrl = slipStorageData?.slipUrl || slipPayload?.slipUrl || null;
    const slipFingerprint = slipStorageData?.slipFingerprint || slipPayload?.slipFingerprint || null;
    await conn.query(
      `INSERT INTO orders (
         company_id, order_ref, user_id, amount, discount, discount_mode, points_earned,
         slip_url, slip_fingerprint, slip_reference_number, slip_bank, slip_transaction_date,
         slip_transaction_time, slip_verification_status, note, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        orderRef,
        userId,
        amount,
        orderDiscount,
        finalDiscountMode,
        context.points,
        slipUrl,
        slipFingerprint,
        slipPayload?.referenceNumber || null,
        slipPayload?.bank || null,
        slipPayload?.transactionDate || null,
        slipPayload?.transactionTime || null,
        slipVerificationStatus,
        orderNote,
        finalStatus,
      ]
    );
    const [[{ id: orderId }]] = await conn.query("SELECT id FROM orders WHERE order_ref=? AND company_id=?", [orderRef, companyId]);
    for (const it of orderItems) {
      await conn.query(
        "INSERT INTO order_items (company_id, order_id, product_id, name, unit_price, qty) VALUES (?, ?, ?, ?, ?, ?)",
        [companyId, orderId, it.productId || null, it.name, parseFloat(it.unitPrice) || 0, parseInt(it.qty) || 1]
      );
    }
    if (finalStatus === 'paid') {
      await adjustUserPoints(conn, userId, context.points, companyId, {
        refId: orderId,
        note: `ออเดอร์ ${orderRef} ได้รับแต้ม`,
      });
      await adjustUserTotalSpent(conn, userId, amount, companyId);
    }
    await conn.commit();
    const [[order]] = await conn.query(
      "SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier, COALESCE(t.baht_per_point, 10) AS baht_per_point, COALESCE(t.multiplier, 1) AS multiplier FROM orders o LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id WHERE o.id=? AND o.company_id=?",
      [orderId, companyId]
    );
    const [savedOrderItems] = await conn.query("SELECT * FROM order_items WHERE order_id=? AND company_id=?", [orderId, companyId]);
    order.items = savedOrderItems;
    res.status(201).json(order);
  } catch (err) { await conn.rollback(); throw err; }
  finally { conn.release(); }
}));

// PUT /api/orders/:id
router.put('/:id', aw(async (req, res) => {
  const { userId, items = [], discount, discountMode, note, status } = req.body;
  const companyId = getCompanyId(req);
  const normalizedStatus = status != null ? normalizeStatus(status) : null;
  if (!items.length) return res.status(400).json({ error: 'items cannot be empty' });
  if (normalizedStatus && !VALID_STATUS.includes(normalizedStatus)) return res.status(400).json({ error: 'Invalid status' });
  const normalizedDiscountMode = discountMode == null
    ? normalizeDiscountMode(undefined, 'manual')
    : normalizeDiscountMode(discountMode);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[existingOrder]] = await conn.query(
      `SELECT o.*, u.tier AS user_tier,
              COALESCE(t.baht_per_point, 10) AS baht_per_point,
              COALESCE(t.multiplier, 1) AS multiplier
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
       WHERE o.id=? AND o.company_id=? FOR UPDATE`,
      [req.params.id, companyId]
    );
    if (!existingOrder) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }

    const nextUserId = userId || existingOrder.user_id;
    const nextStatus = normalizedStatus || normalizeStatus(existingOrder.status);
    const nextUserProfile = await getUserTierProfile(conn, nextUserId, companyId);
    if (!nextUserProfile) { await conn.rollback(); return res.status(404).json({ error: 'User not found' }); }
    const financials = calculateOrderFinancials(items, discount, {
      discountMode: discountMode == null ? existingOrder.discount_mode : normalizedDiscountMode,
      memberDiscountPercent: nextUserProfile.discountPercent,
    });
    if (!financials) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid discount' });
    }
    const { amount, discount: orderDiscount, discountMode: nextDiscountMode } = financials;
    const context = await getOrderContext(conn, nextUserId, amount, companyId);
    if (!context) { await conn.rollback(); return res.status(404).json({ error: 'User not found' }); }

    const fields = ['amount=?', 'discount=?', 'discount_mode=?', 'note=?', 'points_earned=?'];
    const vals = [amount, orderDiscount, nextDiscountMode, note || null, context.points];
    if (userId != null) { fields.push('user_id=?'); vals.push(userId); }
    if (normalizedStatus != null) { fields.push('status=?'); vals.push(normalizedStatus); }
    vals.push(req.params.id);
    vals.push(companyId);
    await conn.query(`UPDATE orders SET ${fields.join(', ')} WHERE id=? AND company_id=?`, vals);
    await conn.query("DELETE FROM order_items WHERE order_id=? AND company_id=?", [req.params.id, companyId]);
    for (const it of items) {
      await conn.query(
        "INSERT INTO order_items (company_id, order_id, product_id, name, unit_price, qty) VALUES (?, ?, ?, ?, ?, ?)",
        [companyId, req.params.id, it.productId || null, it.name, parseFloat(it.unitPrice) || 0, parseInt(it.qty) || 1]
      );
    }
    await reconcileOrderPoints(conn, {
      oldOrder: existingOrder,
      orderId: req.params.id,
      orderRef: existingOrder.order_ref,
      newUserId: nextUserId,
      newStatus: nextStatus,
      newAmount: amount,
      companyId,
    });
    await reconcileOrderTotalSpent(conn, {
      oldOrder: existingOrder,
      newUserId: nextUserId,
      newStatus: nextStatus,
      newAmount: amount,
      companyId,
    });
    await conn.commit();
    const [[order]] = await conn.query(
      "SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier, COALESCE(t.baht_per_point, 10) AS baht_per_point, COALESCE(t.multiplier, 1) AS multiplier FROM orders o LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id WHERE o.id=? AND o.company_id=?",
      [req.params.id, companyId]
    );
    const [updatedOrderItems] = await conn.query("SELECT * FROM order_items WHERE order_id=? AND company_id=?", [req.params.id, companyId]);
    order.items = updatedOrderItems;
    res.json(order);
  } catch (err) { await conn.rollback(); throw err; }
  finally { conn.release(); }
}));

// PATCH /api/orders/:id/status
router.patch('/:id/status', aw(async (req, res) => {
  const normalizedStatus = normalizeStatus(req.body.status);
  if (!VALID_STATUS.includes(normalizedStatus)) return res.status(400).json({ error: 'Invalid status' });
  const companyId = getCompanyId(req);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[existingOrder]] = await conn.query(
      `SELECT o.*, u.tier AS user_tier,
              COALESCE(t.baht_per_point, 10) AS baht_per_point,
              COALESCE(t.multiplier, 1) AS multiplier
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
       WHERE o.id=? AND o.company_id=? FOR UPDATE`,
      [req.params.id, companyId]
    );
    if (!existingOrder) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }

    if (normalizeStatus(existingOrder.status) === normalizedStatus) {
      await conn.commit();
      const [[order]] = await conn.query(
        "SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier, COALESCE(t.baht_per_point, 10) AS baht_per_point, COALESCE(t.multiplier, 1) AS multiplier FROM orders o LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id WHERE o.id=? AND o.company_id=?",
        [req.params.id, companyId]
      );
      return res.json(order);
    }

    await reconcileOrderPoints(conn, {
      oldOrder: existingOrder,
      orderId: req.params.id,
      orderRef: existingOrder.order_ref,
      newUserId: existingOrder.user_id,
      newStatus: normalizedStatus,
      newAmount: existingOrder.amount,
      companyId,
    });
    await reconcileOrderTotalSpent(conn, {
      oldOrder: existingOrder,
      newUserId: existingOrder.user_id,
      newStatus: normalizedStatus,
      newAmount: existingOrder.amount,
      companyId,
    });
    await conn.query("UPDATE orders SET status=? WHERE id=? AND company_id=?", [normalizedStatus, req.params.id, companyId]);
    await conn.commit();
    const [[order]] = await conn.query(
      "SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier, COALESCE(t.baht_per_point, 10) AS baht_per_point, COALESCE(t.multiplier, 1) AS multiplier FROM orders o LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id WHERE o.id=? AND o.company_id=?",
      [req.params.id, companyId]
    );
    res.json(order);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// DELETE /api/orders/:id
router.delete('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT o.*, u.tier AS user_tier,
              COALESCE(t.baht_per_point, 10) AS baht_per_point,
              COALESCE(t.multiplier, 1) AS multiplier
       FROM orders o
       LEFT JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id
       LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id
       WHERE o.id=? AND o.company_id=? FOR UPDATE`,
      [req.params.id, companyId]
    );
    if (!order) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }

    const orderPoints = Number(order.points_earned ?? 0) || calculatePoints(order.amount, order.baht_per_point, order.multiplier);
    if (normalizeStatus(order.status) === 'paid' && orderPoints > 0) {
      await adjustUserPoints(conn, order.user_id, -orderPoints, companyId, {
        refId: order.id,
        note: `ลบออเดอร์ ${order.order_ref}`,
      });
    }
    if (normalizeStatus(order.status) === 'paid') {
      await adjustUserTotalSpent(conn, order.user_id, -Number(order.amount || 0), companyId);
    }

    await conn.query("DELETE FROM order_items WHERE order_id=? AND company_id=?", [req.params.id, companyId]);
    await conn.query("DELETE FROM orders WHERE id=? AND company_id=?", [req.params.id, companyId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

export default router;
