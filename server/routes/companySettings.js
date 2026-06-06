import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function normalizePointExpiryDays(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 365;
  return Math.floor(numeric);
}

async function loadCompanySettings(companyId) {
  const [[row]] = await db.query(
    'SELECT company_id, point_expiry_days, updated_at FROM company_settings WHERE company_id=? LIMIT 1',
    [companyId]
  );

  if (row) return row;

  await db.query(
    'INSERT INTO company_settings (company_id, point_expiry_days) VALUES (?, 365)',
    [companyId]
  );

  const [[inserted]] = await db.query(
    'SELECT company_id, point_expiry_days, updated_at FROM company_settings WHERE company_id=? LIMIT 1',
    [companyId]
  );
  return inserted || { company_id: companyId, point_expiry_days: 365, updated_at: null };
}

router.get('/', aw(async (req, res) => {
  const row = await loadCompanySettings(getCompanyId(req));
  res.json({
    companyId: row.company_id,
    pointExpiryDays: Number(row.point_expiry_days) > 0 ? Number(row.point_expiry_days) : 365,
    updatedAt: row.updated_at,
  });
}));

router.put('/', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const pointExpiryDays = normalizePointExpiryDays(req.body.pointExpiryDays ?? req.body.point_expiry_days);

  await db.query(
    `
      INSERT INTO company_settings (company_id, point_expiry_days)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE point_expiry_days=VALUES(point_expiry_days), updated_at=NOW()
    `,
    [companyId, pointExpiryDays]
  );

  const row = await loadCompanySettings(companyId);
  res.json({
    companyId: row.company_id,
    pointExpiryDays: Number(row.point_expiry_days) > 0 ? Number(row.point_expiry_days) : 365,
    updatedAt: row.updated_at,
  });
}));

export default router;
