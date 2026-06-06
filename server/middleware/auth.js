import db from '../db.js';
import { aw } from '../asyncWrap.js';
import {
  canAccessRole,
  getAuthCookie,
  parseSessionToken,
  sanitizeStaff,
} from '../lib/auth.js';
import { resolveCompanyFromRequest } from '../lib/company.js';

export const requireAuth = aw(async (req, res, next) => {
  req.company = req.company || resolveCompanyFromRequest(req);
  const token = getAuthCookie(req);
  const session = parseSessionToken(token);
  if (!session?.sub) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }

  const tokenCompanyId = Number(session.companyId || session.company_id || 1) || 1;
  if (tokenCompanyId !== Number(req.company.id || 1)) {
    return res.status(401).json({ error: 'ข้อมูลล็อกอินไม่ตรงกับบริษัทที่กำลังใช้งาน' });
  }

  const [[staff]] = await db.query(
    'SELECT id, company_id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM staff_accounts WHERE id=? AND company_id=? LIMIT 1',
    [session.sub, req.company.id]
  );

  if (!staff || !staff.is_active) {
    return res.status(401).json({ error: 'บัญชีนี้ถูกปิดใช้งานหรือไม่ถูกต้อง' });
  }

  req.staff = staff;
  req.currentStaff = sanitizeStaff(staff);
  next();
});

export function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    if (!canAccessRole(req.staff.role, minimumRole)) {
      return res.status(403).json({ error: 'สิทธิ์ไม่เพียงพอ' });
    }
    next();
  };
}

export function allowMethods(methods) {
  const allowed = new Set(methods.map(method => method.toUpperCase()));
  return (req, res, next) => {
    const method = req.method.toUpperCase() === 'HEAD' ? 'GET' : req.method.toUpperCase();
    if (!allowed.has(method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    next();
  };
}

export function requireMethodRoles(matrix) {
  const normalized = Object.fromEntries(
    Object.entries(matrix).map(([method, roles]) => [
      method.toUpperCase(),
      roles.map(role => String(role).toLowerCase()),
    ])
  );

  return (req, res, next) => {
    const method = req.method.toUpperCase() === 'HEAD' ? 'GET' : req.method.toUpperCase();
    const roles = normalized[method];
    if (!roles) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!req.staff) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    if (!roles.includes(String(req.staff.role).toLowerCase())) {
      return res.status(403).json({ error: 'สิทธิ์ไม่เพียงพอ' });
    }
    next();
  };
}
