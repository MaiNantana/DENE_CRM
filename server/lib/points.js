import { syncUserTierByPoints } from './loyalty.js';

function normalizePositiveInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function normalizeExpiryDays(value, fallback = 365) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}

export async function getCompanyPointExpiryDays(conn, companyId) {
  const [[row]] = await conn.query(
    'SELECT point_expiry_days FROM company_settings WHERE company_id=? LIMIT 1',
    [companyId]
  );
  return normalizeExpiryDays(row?.point_expiry_days, 365);
}

export async function ensureExpiredPointBatches(conn, userId, companyId) {
  const expiryDays = await getCompanyPointExpiryDays(conn, companyId);
  if (expiryDays <= 0) return 0;

  const [expiredRows] = await conn.query(
    `
      SELECT id, points_remaining
      FROM point_transactions
      WHERE company_id=?
        AND user_id=?
        AND type='earn'
        AND points_remaining > 0
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
      ORDER BY expires_at ASC, created_at ASC, id ASC
      FOR UPDATE
    `,
    [companyId, userId]
  );

  const expiredPoints = expiredRows.reduce((sum, row) => sum + (Number(row.points_remaining) || 0), 0);
  if (expiredPoints <= 0) return 0;

  const expiredIds = expiredRows.map(row => row.id);
  await conn.query(
    `UPDATE point_transactions
     SET points_remaining=0
     WHERE company_id=? AND user_id=? AND id IN (${expiredIds.map(() => '?').join(',')})`,
    [companyId, userId, ...expiredIds]
  );
  await conn.query(
    'UPDATE users SET points = GREATEST(points - ?, 0) WHERE id=? AND company_id=?',
    [expiredPoints, userId, companyId]
  );

  return expiredPoints;
}

export async function syncUserPointsState(conn, userId, companyId) {
  await ensureExpiredPointBatches(conn, userId, companyId);
  await syncUserTierByPoints(conn, userId, companyId);
  const [[user]] = await conn.query(
    'SELECT id, company_id, line_id, points, tier, tier_expires_at FROM users WHERE id=? AND company_id=? LIMIT 1',
    [userId, companyId]
  );
  return user || null;
}

export async function awardUserPoints(conn, { companyId, userId, points, refId = null, note = null }) {
  const normalizedPoints = normalizePositiveInt(points, 0);
  if (normalizedPoints <= 0) return 0;

  await ensureExpiredPointBatches(conn, userId, companyId);
  const expiryDays = await getCompanyPointExpiryDays(conn, companyId);

  await conn.query(
    `INSERT INTO point_transactions
       (company_id, user_id, type, points, points_remaining, ref_id, note, expires_at)
     VALUES
       (?, ?, 'earn', ?, ?, ?, ?, IF(? > 0, DATE_ADD(NOW(), INTERVAL ? DAY), NULL))`,
    [companyId, userId, normalizedPoints, normalizedPoints, refId, note, expiryDays, expiryDays]
  );
  await conn.query(
    'UPDATE users SET points = points + ? WHERE id=? AND company_id=?',
    [normalizedPoints, userId, companyId]
  );
  await syncUserPointsState(conn, userId, companyId);

  return normalizedPoints;
}

export async function consumeUserPoints(conn, { companyId, userId, points, refId = null, note = null }) {
  const normalizedPoints = normalizePositiveInt(points, 0);
  if (normalizedPoints <= 0) return 0;

  await ensureExpiredPointBatches(conn, userId, companyId);

  const [[user]] = await conn.query(
    'SELECT id, points FROM users WHERE id=? AND company_id=? LIMIT 1 FOR UPDATE',
    [userId, companyId]
  );
  if (!user) {
    throw new Error('User not found');
  }
  if ((Number(user.points) || 0) < normalizedPoints) {
    throw new Error('Insufficient points');
  }

  const [batches] = await conn.query(
    `
      SELECT id, points_remaining
      FROM point_transactions
      WHERE company_id=?
        AND user_id=?
        AND type='earn'
        AND points_remaining > 0
      ORDER BY (expires_at IS NULL) ASC, expires_at ASC, created_at ASC, id ASC
      FOR UPDATE
    `,
    [companyId, userId]
  );

  let remaining = normalizedPoints;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchRemaining = Number(batch.points_remaining) || 0;
    if (batchRemaining <= 0) continue;

    const used = Math.min(batchRemaining, remaining);
    await conn.query(
      'UPDATE point_transactions SET points_remaining = GREATEST(points_remaining - ?, 0) WHERE id=? AND company_id=?',
      [used, batch.id, companyId]
    );
    remaining -= used;
  }

  await conn.query(
    'UPDATE users SET points = GREATEST(points - ?, 0) WHERE id=? AND company_id=?',
    [normalizedPoints, userId, companyId]
  );
  await conn.query(
    `INSERT INTO point_transactions
       (company_id, user_id, type, points, points_remaining, ref_id, note, expires_at)
     VALUES
       (?, ?, 'redeem', ?, 0, ?, ?, NULL)`,
    [companyId, userId, normalizedPoints, refId, note]
  );
  await syncUserPointsState(conn, userId, companyId);

  return normalizedPoints;
}

export async function getUserPointHistory(conn, userId, companyId) {
  const [rows] = await conn.query(
    `
      SELECT
        id,
        type,
        points,
        points_remaining AS pointsRemaining,
        ref_id AS refId,
        note,
        created_at AS createdAt,
        expires_at AS expiresAt
      FROM point_transactions
      WHERE company_id=? AND user_id=?
      ORDER BY created_at DESC, id DESC
    `,
    [companyId, userId]
  );

  return rows;
}
