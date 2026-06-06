import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import {
  hashPassword,
  normalizeRole,
  sanitizeStaff,
} from '../lib/auth.js';
import { requireAuth, requireMinimumRole } from '../middleware/auth.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function sanitizeStaffListRow(row) {
  return {
    id: row.id,
    companyId: row.company_id || null,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

router.get('/', requireAuth, requireMinimumRole('admin'), aw(async (_req, res) => {
  const [rows] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE company_id=? ORDER BY created_at ASC',
    [getCompanyId(_req)]
  );
  res.json(rows.map(sanitizeStaffListRow));
}));

router.post('/', requireAuth, requireMinimumRole('admin'), aw(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const displayName = String(req.body.displayName || '').trim();
  const password = String(req.body.password || '');
  const role = normalizeRole(req.body.role) || 'user';

  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้ ชื่อที่แสดง และรหัสผ่าน' });
  }

  const passwordHash = hashPassword(password);
  await db.query(
    'INSERT INTO staff_accounts (company_id, username, display_name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [getCompanyId(req), username, displayName, passwordHash, role]
  );

  const [[staff]] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE username=? AND company_id=? LIMIT 1',
    [username, getCompanyId(req)]
  );
  res.status(201).json(sanitizeStaff(staff));
}));

router.patch('/:id', requireAuth, requireMinimumRole('admin'), aw(async (req, res) => {
  const updates = [];
  const values = [];

  if (req.body.username != null) {
    const username = String(req.body.username || '').trim();
    if (!username) return res.status(400).json({ error: 'username is required' });
    updates.push('username=?');
    values.push(username);
  }

  if (req.body.displayName != null) {
    const displayName = String(req.body.displayName || '').trim();
    if (!displayName) return res.status(400).json({ error: 'displayName is required' });
    updates.push('display_name=?');
    values.push(displayName);
  }

  if (req.body.role != null) {
    const role = normalizeRole(req.body.role);
    if (!role) return res.status(400).json({ error: 'Invalid role' });
    updates.push('role=?');
    values.push(role);
  }

  if (req.body.isActive != null) {
    if (typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }
    updates.push('is_active=?');
    values.push(req.body.isActive ? 1 : 0);
  }

  if (req.body.password != null && String(req.body.password).trim()) {
    updates.push('password_hash=?');
    values.push(hashPassword(String(req.body.password)));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);
  await db.query(`UPDATE staff_accounts SET ${updates.join(', ')} WHERE id=? AND company_id=?`, [...values, getCompanyId(req)]);

  const [[staff]] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE id=? AND company_id=? LIMIT 1',
    [req.params.id, getCompanyId(req)]
  );
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  res.json(sanitizeStaff(staff));
}));

router.post('/:id/reset-password', requireAuth, requireMinimumRole('admin'), aw(async (req, res) => {
  const password = String(req.body.password || '').trim();
  if (!password) {
    return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านใหม่' });
  }

  await db.query('UPDATE staff_accounts SET password_hash=? WHERE id=? AND company_id=?', [hashPassword(password), req.params.id, getCompanyId(req)]);
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeStaff(req.staff) });
});

export default router;
