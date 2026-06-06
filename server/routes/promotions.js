import { randomUUID } from 'crypto';
import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { consumeUserPoints, syncUserPointsState } from '../lib/points.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function normalizeRedeemMode(value, fallback = 'auto') {
  return String(value || fallback).toLowerCase() === 'manual' ? 'manual' : 'auto';
}

router.get('/', aw(async (req, res) => {
  const { status } = req.query;
  const companyId = getCompanyId(req);
  const [rows] = status
    ? await db.query('SELECT * FROM promotions WHERE company_id=? AND status=? ORDER BY created_at DESC', [companyId, status])
    : await db.query('SELECT * FROM promotions WHERE company_id=? ORDER BY created_at DESC', [companyId]);
  res.json(rows);
}));

router.get('/:id', aw(async (req, res) => {
  const [[row]] = await db.query('SELECT * FROM promotions WHERE id=? AND company_id=?', [req.params.id, getCompanyId(req)]);
  if (!row) return res.status(404).json({ error: 'Promotion not found' });
  res.json(row);
}));

router.post('/', aw(async (req, res) => {
  const promotionId = randomUUID();
  const companyId = getCompanyId(req);
  const title = String(req.body.title || '').trim();
  const description = req.body.description == null ? null : String(req.body.description).trim() || null;
  const pointsRequired = Number(req.body.pointsRequired);
  const status = req.body.status === 'inactive' ? 'inactive' : 'active';
  const redeemMode = normalizeRedeemMode(req.body.redeemMode);
  const expiresAt = req.body.expiresAt ? String(req.body.expiresAt) : null;

  if (!title || !Number.isFinite(pointsRequired)) {
    return res.status(400).json({ error: 'title and pointsRequired are required' });
  }

  await db.query(
    'INSERT INTO promotions (id, company_id, title, description, points_required, status, redeem_mode, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [promotionId, companyId, title, description, pointsRequired, status, redeemMode, expiresAt]
  );

  const [[row]] = await db.query('SELECT * FROM promotions WHERE id=? AND company_id=?', [promotionId, companyId]);
  res.status(201).json(row);
}));

router.put('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const [[current]] = await db.query('SELECT * FROM promotions WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!current) return res.status(404).json({ error: 'Promotion not found' });

  const title = req.body.title != null ? String(req.body.title).trim() : current.title;
  const description = req.body.description === undefined
    ? current.description
    : String(req.body.description || '').trim() || null;
  const pointsRequired = Number(req.body.pointsRequired ?? current.points_required);
  const status = req.body.status === 'active' || req.body.status === 'inactive'
    ? req.body.status
    : current.status;
  const redeemMode = req.body.redeemMode == null
    ? normalizeRedeemMode(current.redeem_mode)
    : normalizeRedeemMode(req.body.redeemMode, current.redeem_mode);
  const expiresAt = req.body.expiresAt === undefined
    ? current.expires_at
    : (req.body.expiresAt ? String(req.body.expiresAt) : null);

  if (!title || !Number.isFinite(pointsRequired)) {
    return res.status(400).json({ error: 'title and pointsRequired are required' });
  }

  await db.query(
    'UPDATE promotions SET title=?, description=?, points_required=?, status=?, redeem_mode=?, expires_at=? WHERE id=? AND company_id=?',
    [title, description, pointsRequired, status, redeemMode, expiresAt, req.params.id, companyId]
  );

  const [[row]] = await db.query('SELECT * FROM promotions WHERE id=? AND company_id=?', [req.params.id, companyId]);
  res.json(row);
}));

router.delete('/:id', aw(async (req, res) => {
  await db.query('DELETE FROM promotions WHERE id=? AND company_id=?', [req.params.id, getCompanyId(req)]);
  res.json({ success: true });
}));

router.post('/:id/redeem', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const userId = String(req.body.userId || '').trim();
  const lineId = String(req.body.lineId || '').trim();
  if (!userId && !lineId) {
    return res.status(400).json({ error: 'userId or lineId is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[promo]] = await conn.query(
      'SELECT id, title, points_required, redeem_mode FROM promotions WHERE id=? AND company_id=? AND status="active" FOR UPDATE',
      [req.params.id, companyId]
    );
    if (!promo) {
      await conn.rollback();
      return res.status(404).json({ error: 'Promotion not available' });
    }

    let user = null;
    if (userId) {
      const [[foundById]] = await conn.query('SELECT * FROM users WHERE id=? AND company_id=? FOR UPDATE', [userId, companyId]);
      user = foundById || null;
    }
    if (!user && lineId) {
      const [[foundByLineId]] = await conn.query('SELECT * FROM users WHERE line_id=? AND company_id=? FOR UPDATE', [lineId, companyId]);
      user = foundByLineId || null;
    }
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }
    if (userId && user.id !== userId) {
      await conn.rollback();
      return res.status(400).json({ error: 'User mismatch' });
    }
    if (lineId && user.line_id !== lineId) {
      await conn.rollback();
      return res.status(400).json({ error: 'Line ID mismatch' });
    }

    user = await syncUserPointsState(conn, user.id, companyId) || user;

    const pointsRequired = Number(promo.points_required) || 0;
    const [pendingRows] = await conn.query(
      'SELECT id, promotion_id, points_required FROM promotion_redemption_requests WHERE user_id=? AND company_id=? AND status="pending" FOR UPDATE',
      [user.id, companyId]
    );
    const pendingPoints = pendingRows.reduce((sum, row) => sum + Number(row.points_required || 0), 0);
    const availablePoints = Number(user.points) - pendingPoints;

    if (normalizeRedeemMode(promo.redeem_mode) === 'manual') {
      const samePromoPending = pendingRows.some(row => row.promotion_id === req.params.id);
      if (samePromoPending) {
        await conn.rollback();
        return res.status(409).json({ error: 'คำขอนี้อยู่ระหว่างรออนุมัติแล้ว' });
      }
      if (availablePoints < pointsRequired) {
        await conn.rollback();
        return res.status(400).json({ error: 'Insufficient points' });
      }

      const requestId = randomUUID();
      await conn.query(
        'INSERT INTO promotion_redemption_requests (id, company_id, user_id, promotion_id, promotion_title, points_required, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
        [requestId, companyId, user.id, req.params.id, promo.title, pointsRequired]
      );

      await conn.commit();
      return res.json({
        success: true,
        status: 'pending',
        redeemMode: 'manual',
        requestId,
        promotionTitle: promo.title,
        pointsRequired,
        currentPoints: Number(user.points),
        pendingPoints: pendingPoints + pointsRequired,
        availablePointsAfterReserve: availablePoints - pointsRequired,
      });
    }

    if (availablePoints < pointsRequired) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient points' });
    }

    const redemptionId = randomUUID();
    await consumeUserPoints(conn, {
      companyId,
      userId: user.id,
      points: pointsRequired,
      refId: redemptionId,
      note: `แลก: ${promo.title}`,
    });
    await conn.query(
      'INSERT INTO redemptions (id, company_id, user_id, promotion_id, points_used) VALUES (?, ?, ?, ?, ?)',
      [redemptionId, companyId, user.id, req.params.id, pointsRequired]
    );

    await conn.commit();
    res.json({
      success: true,
      status: 'completed',
      redeemMode: 'auto',
      pointsUsed: pointsRequired,
      promotionTitle: promo.title,
      remainingPoints: Math.max(Number(user.points) - pointsRequired, 0),
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

export default router;
