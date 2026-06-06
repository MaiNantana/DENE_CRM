export async function getTierForPoints(conn, companyId, points) {
  const numericPoints = Number(points) || 0;
  const [[row]] = await conn.query(
    `
      SELECT name
      FROM tiers
      WHERE company_id=? AND min_points <= ?
      ORDER BY min_points DESC, sort_order DESC, id ASC
      LIMIT 1
    `,
    [companyId, numericPoints]
  );

  if (row?.name) return row.name;

  const [[fallbackRow]] = await conn.query(
    `
      SELECT name
      FROM tiers
      WHERE company_id=?
      ORDER BY min_points ASC, sort_order ASC, id ASC
      LIMIT 1
    `,
    [companyId]
  );

  return fallbackRow?.name || null;
}

export async function getTierDetails(conn, companyId, tierName) {
  if (!tierName) return null;
  const [[row]] = await conn.query(
    `
      SELECT name, min_points, duration_days
      FROM tiers
      WHERE company_id=? AND name=?
      LIMIT 1
    `,
    [companyId, tierName]
  );
  return row || null;
}

export async function syncUserTierByPoints(conn, userId, companyId) {
  const [[user]] = await conn.query(
    'SELECT id, points, tier, tier_expires_at FROM users WHERE id=? AND company_id=? LIMIT 1',
    [userId, companyId]
  );

  if (!user) return null;

  const nextTier = await getTierForPoints(conn, companyId, user.points);
  if (!nextTier) return user.tier;

  const currentTier = await getTierDetails(conn, companyId, user.tier);
  const targetTier = nextTier === user.tier ? currentTier : await getTierDetails(conn, companyId, nextTier);
  const currentDurationDays = Number(currentTier?.duration_days) || 0;
  const targetDurationDays = Number(targetTier?.duration_days) || 0;
  const currentExpiresAt = user.tier_expires_at ? new Date(user.tier_expires_at) : null;
  const now = Date.now();

  let shouldUpdate = nextTier !== user.tier;
  let nextDurationDays = targetDurationDays;

  if (!shouldUpdate) {
    const hasTimedExpiry = currentDurationDays > 0;
    const missingExpiry = hasTimedExpiry && !currentExpiresAt;
    const expired = hasTimedExpiry && currentExpiresAt && currentExpiresAt.getTime() <= now;
    const noExpiryNeeded = !hasTimedExpiry && user.tier_expires_at;

    shouldUpdate = missingExpiry || expired || noExpiryNeeded;
    nextDurationDays = currentDurationDays;
  }

  if (shouldUpdate) {
    await conn.query(
      `UPDATE users
       SET tier=?,
           tier_expires_at=CASE
             WHEN ? > 0 THEN DATE_ADD(NOW(), INTERVAL ? DAY)
             ELSE NULL
           END
       WHERE id=? AND company_id=?`,
      [nextTier, nextDurationDays, nextDurationDays, user.id, companyId]
    );
  }

  return nextTier;
}
