import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import {
  clearAuthCookie,
  hashPassword,
  normalizeRole,
  sanitizeStaff,
  setAuthCookie,
  verifyPassword,
} from '../lib/auth.js';
import { requireAuth, requireMinimumRole } from '../middleware/auth.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

async function getStaffCount(companyId) {
  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM staff_accounts WHERE company_id=?', [companyId]);
  return Number(count) || 0;
}

function validateBootstrapPayload(body) {
  const displayName = String(body.displayName || '').trim();
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  return { displayName, username, password };
}

router.get('/status', aw(async (_req, res) => {
  const count = await getStaffCount(getCompanyId(_req));
  res.json({ hasStaff: count > 0 });
}));

router.get('/me', requireAuth, aw(async (req, res) => {
  res.json({ user: sanitizeStaff(req.staff) });
}));

router.post('/login', aw(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  const [[staff]] = await db.query(
    'SELECT id, company_id, username, display_name, password_hash, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE username=? AND company_id=? LIMIT 1',
    [username, getCompanyId(req)]
  );

  if (!staff || !staff.is_active) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  if (!verifyPassword(password, staff.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  await db.query('UPDATE staff_accounts SET last_login_at=NOW() WHERE id=? AND company_id=?', [staff.id, getCompanyId(req)]);
  const [[updated]] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE id=? AND company_id=? LIMIT 1',
    [staff.id, getCompanyId(req)]
  );

  setAuthCookie(res, req, updated);
  res.json({ user: sanitizeStaff(updated) });
}));

router.post('/bootstrap', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const count = await getStaffCount(companyId);
  if (count > 0) {
    return res.status(409).json({ error: 'มีบัญชีผู้ใช้อยู่แล้ว' });
  }

  const { displayName, username, password } = validateBootstrapPayload(req.body);
  if (!displayName || !username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อที่แสดง, ชื่อผู้ใช้ และรหัสผ่าน' });
  }

  const passwordHash = hashPassword(password);
  await db.query(
    'INSERT INTO staff_accounts (company_id, username, display_name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [companyId, username, displayName, passwordHash, 'admin']
  );

  const [[staff]] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE username=? AND company_id=? LIMIT 1',
    [username, companyId]
  );

  setAuthCookie(res, req, staff);
  res.status(201).json({ user: sanitizeStaff(staff) });
}));

router.post('/logout', (_req, res) => {
  clearAuthCookie(res, _req);
  res.json({ ok: true });
});

router.get('/roles', requireAuth, requireMinimumRole('admin'), (_req, res) => {
  res.json({
    roles: ['admin', 'manager', 'user'],
  });
});

export default router;
