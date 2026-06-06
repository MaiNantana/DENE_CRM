import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { getTierDetails } from '../lib/loyalty.js';
import { awardUserPoints, consumeUserPoints, getUserPointHistory, syncUserPointsState } from '../lib/points.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function normalizeBirthday(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const toIso = (year, month, day) => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;

    const pad = (n) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
  };

  let match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (match) return toIso(Number(match[1]), Number(match[2]), Number(match[3]));

  match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return toIso(Number(match[3]), Number(match[2]), Number(match[1]));

  return null;
}

// GET /api/users?search=&showAll=1
router.get('/', aw(async (req, res) => {
  const search   = req.query.search  ? `%${req.query.search}%` : null;
  const showAll  = req.query.showAll === '1';   // default: active only
  const activeFilter = showAll ? '' : ' AND is_active=1';
  const companyId = getCompanyId(req);

  const [rows] = search
    ? await db.query(
        `SELECT * FROM users WHERE company_id=? AND (line_id LIKE ? OR name LIKE ?)${activeFilter} ORDER BY joined_at DESC`,
        [companyId, search, search]
      )
    : await db.query(
      `SELECT * FROM users WHERE company_id=?${activeFilter} ORDER BY joined_at DESC`,
      [companyId]
      );
  const refreshedRows = await Promise.all(rows.map(async row => {
    const refreshed = await syncUserPointsState(db, row.id, companyId);
    if (!refreshed) return row;
    return {
      ...row,
      points: refreshed.points,
      tier: refreshed.tier,
      tier_expires_at: refreshed.tier_expires_at,
    };
  }));
  res.json(refreshedRows);
}));

router.get('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  await syncUserPointsState(db, req.params.id, companyId);
  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

router.post('/', aw(async (req, res) => {
  const { lineId, name, phone, email, avatar, birthday } = req.body;
  const companyId = getCompanyId(req);
  if (!lineId || !name) return res.status(400).json({ error: 'lineId and name are required' });
  const normalizedBirthday = normalizeBirthday(birthday);
  if (typeof birthday === 'string' && birthday.trim() && !normalizedBirthday) {
    return res.status(400).json({ error: 'Invalid birthday format. Use dd/MM/yyyy or yyyy-MM-dd.' });
  }
  await db.query(
    'INSERT INTO users (company_id, line_id, name, phone, email, avatar, birthday) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [companyId, lineId, name, phone || null, email || null, avatar || null, normalizedBirthday || null]
  );
  const [[user]] = await db.query('SELECT * FROM users WHERE line_id=? AND company_id=?', [lineId, companyId]);
  res.status(201).json(user);
}));

// PUT /api/users/:id  — แก้ไขข้อมูล (รวม tier, points, total_spent)
router.put('/:id', aw(async (req, res) => {
  const { lineId, name, phone, email, avatar, birthday, tier, points, totalSpent } = req.body;
  const nextLineId = typeof lineId === 'string' ? lineId.trim() : null;
  const validTiers = ['Standard', 'Silver', 'Gold', 'Platinum'];
  if (nextLineId !== null && !nextLineId) return res.status(400).json({ error: 'lineId cannot be empty' });
  if (tier && !validTiers.includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
  if (points != null && (isNaN(points) || points < 0)) return res.status(400).json({ error: 'Invalid points' });
  if (totalSpent != null && (isNaN(totalSpent) || totalSpent < 0)) return res.status(400).json({ error: 'Invalid totalSpent' });
  const normalizedBirthday = normalizeBirthday(birthday);
  const companyId = getCompanyId(req);
  if (typeof birthday === 'string' && birthday.trim() && !normalizedBirthday) {
    return res.status(400).json({ error: 'Invalid birthday format. Use dd/MM/yyyy or yyyy-MM-dd.' });
  }

  if (nextLineId) {
    const [duplicateRows] = await db.query(
      'SELECT id FROM users WHERE line_id=? AND id<>? AND company_id=? LIMIT 1',
      [nextLineId, req.params.id, companyId]
    );
    if (duplicateRows.length) return res.status(409).json({ error: 'Line ID already exists' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[currentUser]] = await conn.query(
      'SELECT id, points, tier FROM users WHERE id=? AND company_id=? FOR UPDATE',
      [req.params.id, companyId]
    );
    if (!currentUser) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const fields = ['name=?', 'phone=?', 'email=?', 'avatar=?', 'birthday=?'];
    const values = [name, phone || null, email || null, avatar || null, normalizedBirthday || null];
    if (nextLineId) { fields.push('line_id=?'); values.push(nextLineId); }
    if (points    == null && tier != null) { fields.push('tier=?'); values.push(tier); }
    if (totalSpent != null){ fields.push('total_spent=?'); values.push(parseFloat(totalSpent)); }
    values.push(req.params.id);
    values.push(companyId);

    await conn.query(`UPDATE users SET ${fields.join(', ')} WHERE id=? AND company_id=?`, values);

    if (points != null) {
      const targetPoints = parseInt(points);
      const delta = targetPoints - (Number(currentUser.points) || 0);
      if (delta > 0) {
        await awardUserPoints(conn, { companyId, userId: req.params.id, points: delta, note: 'ปรับแต้มจากแอดมิน' });
      } else if (delta < 0) {
        await consumeUserPoints(conn, { companyId, userId: req.params.id, points: Math.abs(delta), note: 'ปรับแต้มจากแอดมิน' });
      }
    } else if (tier != null) {
      const tierRow = await getTierDetails(conn, companyId, tier);
      const durationDays = Number(tierRow?.duration_days) || 0;
      await conn.query(
        `UPDATE users
         SET tier=?,
             tier_expires_at=CASE
               WHEN ? > 0 THEN DATE_ADD(NOW(), INTERVAL ? DAY)
               ELSE NULL
             END
         WHERE id=? AND company_id=?`,
        [tier, durationDays, durationDays, req.params.id, companyId]
      );
    }

    await conn.commit();
    const [[user]] = await conn.query('SELECT * FROM users WHERE id=? AND company_id=?', [req.params.id, companyId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// PATCH /api/users/:id/status  — toggle active / inactive
router.patch('/:id/status', aw(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });
  const companyId = getCompanyId(req);
  await db.query('UPDATE users SET is_active=? WHERE id=? AND company_id=?', [isActive ? 1 : 0, req.params.id, companyId]);
  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

router.get('/:id/orders', aw(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM orders WHERE user_id=? AND company_id=? ORDER BY ordered_at DESC', [req.params.id, getCompanyId(req)]);
  res.json(rows);
}));

router.get('/:id/points', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  await syncUserPointsState(db, req.params.id, companyId);
  const rows = await getUserPointHistory(db, req.params.id, companyId);
  res.json(rows);
}));

router.get('/:id/redemptions', aw(async (req, res) => {
  const userId = req.params.id;
  const companyId = getCompanyId(req);
  const [rows] = await db.query(
    `
      SELECT
        history.id,
        history.promotionId,
        history.promotionTitle,
        history.points,
        history.occurredAt,
        history.status,
        history.itemType,
        history.reviewNote
      FROM (
        SELECT
          r.id,
          p.id AS promotionId,
          p.title AS promotionTitle,
          r.points_used AS points,
          r.redeemed_at AS occurredAt,
          'completed' AS status,
          'redeem' AS itemType,
          NULL AS reviewNote
        FROM redemptions r
        JOIN promotions p ON p.id = r.promotion_id AND p.company_id = r.company_id
        WHERE r.user_id = ? AND r.company_id = ?

        UNION ALL

        SELECT
          rq.id,
          rq.promotion_id AS promotionId,
          rq.promotion_title AS promotionTitle,
          rq.points_required AS points,
          rq.requested_at AS occurredAt,
          rq.status AS status,
          'request' AS itemType,
          rq.review_note AS reviewNote
        FROM promotion_redemption_requests rq
        WHERE rq.user_id = ? AND rq.company_id = ?
          AND rq.status IN ('pending', 'rejected')
      ) history
      ORDER BY history.occurredAt DESC
    `,
    [userId, companyId, userId, companyId]
  );
  res.json(rows);
}));

router.get('/:id/messages', aw(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM chat_messages WHERE user_id=? AND company_id=? ORDER BY created_at ASC', [req.params.id, getCompanyId(req)]);
  res.json(rows);
}));

export default router;
