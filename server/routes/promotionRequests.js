import { randomUUID } from 'crypto';
import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { requireAuth, requireMethodRoles } from '../middleware/auth.js';
import { consumeUserPoints, syncUserPointsState } from '../lib/points.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function serializeRequestRow(row) {
  return {
    id: row.id,
    userId: row.userId || row.user_id,
    userName: row.userName || row.user_name,
    lineId: row.lineId || row.line_id,
    promotionId: row.promotionId || row.promotion_id,
    promotionTitle: row.promotionTitle || row.promotion_title,
    pointsRequired: Number(row.pointsRequired ?? row.points_required ?? 0),
    status: row.status,
    requestedAt: row.requestedAt || row.requested_at,
    reviewedAt: row.reviewedAt || row.reviewed_at,
    reviewedBy: row.reviewedBy || row.reviewed_by,
    reviewedByName: row.reviewedByName || row.reviewed_by_name || null,
    reviewNote: row.reviewNote || row.review_note || null,
  };
}

async function loadRequestRow(conn, requestId, companyId = 1) {
  const [[row]] = await conn.query(
    `
      SELECT
        r.id,
        r.user_id AS userId,
        u.name AS userName,
        u.line_id AS lineId,
        r.promotion_id AS promotionId,
        r.promotion_title AS promotionTitle,
        r.points_required AS pointsRequired,
        r.status,
        r.requested_at AS requestedAt,
        r.reviewed_at AS reviewedAt,
        r.reviewed_by AS reviewedBy,
        s.display_name AS reviewedByName,
        r.review_note AS reviewNote
      FROM promotion_redemption_requests r
      JOIN users u ON u.id = r.user_id AND u.company_id = r.company_id
      LEFT JOIN staff_accounts s ON s.id = r.reviewed_by AND s.company_id = r.company_id
      WHERE r.id = ? AND r.company_id = ?
      LIMIT 1
    `,
    [requestId, companyId]
  );

  return row ? serializeRequestRow(row) : null;
}

router.get('/', requireAuth, requireMethodRoles({
  GET: ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
}), aw(async (req, res) => {
  const status = String(req.query.status || 'pending').toLowerCase();
  const companyId = getCompanyId(req);
  const params = [];
  let where = 'WHERE r.company_id = ?';
  params.push(companyId);

  if (status !== 'all') {
    const normalized = ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending';
    where += ' AND r.status = ?';
    params.push(normalized);
  }

  const [rows] = await db.query(
    `
      SELECT
        r.id,
        r.user_id AS userId,
        u.name AS userName,
        u.line_id AS lineId,
        r.promotion_id AS promotionId,
        r.promotion_title AS promotionTitle,
        r.points_required AS pointsRequired,
        r.status,
        r.requested_at AS requestedAt,
        r.reviewed_at AS reviewedAt,
        r.reviewed_by AS reviewedBy,
        s.display_name AS reviewedByName,
        r.review_note AS reviewNote
      FROM promotion_redemption_requests r
      JOIN users u ON u.id = r.user_id AND u.company_id = r.company_id
      LEFT JOIN staff_accounts s ON s.id = r.reviewed_by AND s.company_id = r.company_id
      ${where}
      ORDER BY r.requested_at DESC
    `,
    params
  );

  res.json(rows.map(serializeRequestRow));
}));

router.patch('/:id/approve', requireAuth, requireMethodRoles({
  GET: ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
}), aw(async (req, res) => {
  const reviewNote = req.body.reviewNote == null ? null : String(req.body.reviewNote).trim() || null;
  const conn = await db.getConnection();
  const companyId = getCompanyId(req);

  try {
    await conn.beginTransaction();

    const [[request]] = await conn.query(
      'SELECT * FROM promotion_redemption_requests WHERE id=? AND company_id=? AND status="pending" FOR UPDATE',
      [req.params.id, companyId]
    );
    if (!request) {
      await conn.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    const [[user]] = await conn.query(
      'SELECT id, points, name, line_id FROM users WHERE id=? AND company_id=? FOR UPDATE',
      [request.user_id, companyId]
    );
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const refreshedUser = await syncUserPointsState(conn, user.id, companyId);
    if (refreshedUser) {
      user.points = refreshedUser.points;
    }

    const [pendingRows] = await conn.query(
      'SELECT id, points_required FROM promotion_redemption_requests WHERE user_id=? AND company_id=? AND status="pending" FOR UPDATE',
      [user.id, companyId]
    );
    const totalPending = pendingRows.reduce((sum, row) => sum + Number(row.points_required || 0), 0);
    if (Number(user.points) < totalPending) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient points for pending requests' });
    }

    const pointsUsed = Number(request.points_required) || 0;
    const redemptionId = randomUUID();
    await consumeUserPoints(conn, {
      companyId,
      userId: user.id,
      points: pointsUsed,
      refId: redemptionId,
      note: `แลก: ${request.promotion_title}`,
    });
    await conn.query(
      'INSERT INTO redemptions (id, company_id, user_id, promotion_id, points_used) VALUES (?, ?, ?, ?, ?)',
      [redemptionId, companyId, user.id, request.promotion_id, pointsUsed]
    );
    await conn.query(
      'UPDATE promotion_redemption_requests SET status="approved", reviewed_at=NOW(), reviewed_by=?, review_note=? WHERE id=? AND company_id=?',
      [req.staff.id, reviewNote, request.id, companyId]
    );

    await conn.commit();

    res.json({
      id: request.id,
      userId: user.id,
      userName: user.name,
      lineId: user.line_id,
      promotionId: request.promotion_id,
      promotionTitle: request.promotion_title,
      pointsRequired: pointsUsed,
      status: 'approved',
      requestedAt: request.requested_at,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.staff.id,
      reviewedByName: req.currentStaff?.displayName || null,
      reviewNote,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

router.patch('/:id/reject', requireAuth, requireMethodRoles({
  GET: ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
}), aw(async (req, res) => {
  const reviewNote = req.body.reviewNote == null ? null : String(req.body.reviewNote).trim() || null;
  const conn = await db.getConnection();
  const companyId = getCompanyId(req);

  try {
    await conn.beginTransaction();

    const [[request]] = await conn.query(
      'SELECT * FROM promotion_redemption_requests WHERE id=? AND company_id=? AND status="pending" FOR UPDATE',
      [req.params.id, companyId]
    );
    if (!request) {
      await conn.rollback();
      return res.status(404).json({ error: 'Request not found' });
    }

    await conn.query(
      'UPDATE promotion_redemption_requests SET status="rejected", reviewed_at=NOW(), reviewed_by=?, review_note=? WHERE id=? AND company_id=?',
      [req.staff.id, reviewNote, request.id, companyId]
    );

    await conn.commit();

    res.json({
      id: request.id,
      userId: request.user_id,
      userName: null,
      lineId: null,
      promotionId: request.promotion_id,
      promotionTitle: request.promotion_title,
      pointsRequired: Number(request.points_required) || 0,
      status: 'rejected',
      requestedAt: request.requested_at,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.staff.id,
      reviewedByName: req.currentStaff?.displayName || null,
      reviewNote,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

export default router;
