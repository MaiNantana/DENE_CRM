import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

const FIXED_POINTS_BENEFIT_RE = /^รับคะแนน\s*x\s*(\d+(?:\.\d+)?)$/i;
const FIXED_DISCOUNT_BENEFIT_RE = /^รับส่วนลด\s*(\d+(?:\.\d+)?)\s*%$/i;

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function parseBenefitList(benefits) {
  if (!benefits) return [];

  let values = [];
  if (Array.isArray(benefits)) {
    values = benefits;
  } else if (typeof benefits === 'string') {
    const trimmed = benefits.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      values = [trimmed];
    }
  } else if (benefits != null) {
    values = [benefits];
  }

  return values
    .map(value => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizeBenefitList(benefits) {
  return parseBenefitList(benefits).filter(
    value => !FIXED_POINTS_BENEFIT_RE.test(value) && !FIXED_DISCOUNT_BENEFIT_RE.test(value)
  );
}

function parseDiscountPercent(discountPercent, benefits) {
  const hasDirectValue = discountPercent !== undefined && discountPercent !== null && String(discountPercent).trim() !== '';
  if (hasDirectValue) {
    const direct = Number(discountPercent);
    if (Number.isFinite(direct)) {
      if (direct > 0) return Math.max(direct, 0);

      for (const benefit of parseBenefitList(benefits)) {
        const match = benefit.match(FIXED_DISCOUNT_BENEFIT_RE);
        if (match) return Math.max(Number(match[1]) || 0, 0);
      }

      return 0;
    }
  }

  for (const benefit of parseBenefitList(benefits)) {
    const match = benefit.match(FIXED_DISCOUNT_BENEFIT_RE);
    if (match) return Math.max(Number(match[1]) || 0, 0);
  }

  return 0;
}

function parseDurationDays(durationDays) {
  const direct = Number(durationDays);
  if (!Number.isFinite(direct) || direct < 0) return 365;
  return Math.floor(direct);
}

router.get('/', aw(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM tiers WHERE company_id=? ORDER BY sort_order ASC, min_points ASC', [getCompanyId(req)]);
  res.json(rows);
}));

router.post('/', aw(async (req, res) => {
  const { name, minPoints, multiplier, color, benefits, bahtPerPoint, discountPercent, durationDays } = req.body;
  const companyId = getCompanyId(req);
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const nextBenefits = normalizeBenefitList(benefits);
  const nextDiscountPercent = parseDiscountPercent(discountPercent, nextBenefits);
  const nextDurationDays = parseDurationDays(durationDays);

  const [[{ maxOrder }]] = await db.query('SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM tiers WHERE company_id=?', [companyId]);
  await db.query(
    'INSERT INTO tiers (company_id, name, min_points, multiplier, baht_per_point, discount_percent, duration_days, color, benefits, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [companyId, name.trim(), minPoints ?? 0, multiplier ?? 1, parseFloat(bahtPerPoint) || 10, nextDiscountPercent, nextDurationDays, color ?? '#b9b99d', JSON.stringify(nextBenefits), maxOrder + 1]
  );
  const [[row]] = await db.query('SELECT * FROM tiers WHERE name=? AND company_id=? ORDER BY created_at DESC LIMIT 1', [name.trim(), companyId]);
  res.status(201).json(row);
}));

router.put('/:id', aw(async (req, res) => {
  const { name, minPoints, multiplier, color, benefits, bahtPerPoint, discountPercent, durationDays } = req.body;
  const companyId = getCompanyId(req);
  const nextBenefits = normalizeBenefitList(benefits);
  const nextDiscountPercent = parseDiscountPercent(discountPercent, nextBenefits);
  const nextDurationDays = parseDurationDays(durationDays);
  await db.query(
    'UPDATE tiers SET name=?, min_points=?, multiplier=?, baht_per_point=?, discount_percent=?, duration_days=?, color=?, benefits=? WHERE id=? AND company_id=?',
    [name, minPoints, multiplier, parseFloat(bahtPerPoint) || 10, nextDiscountPercent, nextDurationDays, color ?? '#b9b99d', JSON.stringify(nextBenefits), req.params.id, companyId]
  );
  const [[row]] = await db.query('SELECT * FROM tiers WHERE id=? AND company_id=?', [req.params.id, companyId]);
  res.json(row);
}));

router.delete('/:id', aw(async (req, res) => {
  // ป้องกันลบทั้งหมด — ต้องเหลืออย่างน้อย 1 tier
  const companyId = getCompanyId(req);
  const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM tiers WHERE company_id=?', [companyId]);
  if (cnt <= 1) return res.status(400).json({ error: 'ต้องมีอย่างน้อย 1 ระดับสมาชิก' });
  await db.query('DELETE FROM tiers WHERE id=? AND company_id=?', [req.params.id, companyId]);
  res.json({ success: true });
}));

export default router;
