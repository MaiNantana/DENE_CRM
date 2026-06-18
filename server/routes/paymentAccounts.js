import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function normalize(value, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.slice(0, max) : null;
}

// GET /  (admin: ?showAll=1 returns inactive too; public/default: active only)
router.get('/', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const showAll = req.query.showAll === '1';
  const activeFilter = showAll ? '' : ' AND is_active=1';
  const [rows] = await db.query(
    `SELECT * FROM payment_accounts WHERE company_id=?${activeFilter} ORDER BY sort_order ASC, created_at ASC`,
    [companyId]
  );
  res.json(rows);
}));

// POST /
router.post('/', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const bank = normalize(req.body.bank, 100);
  const accountName = normalize(req.body.accountName, 200);
  if (!bank) return res.status(400).json({ error: 'bank is required' });
  if (!accountName) return res.status(400).json({ error: 'accountName is required' });

  const accountNumber = normalize(req.body.accountNumber, 50);
  const promptpay = normalize(req.body.promptpay, 50);
  const note = normalize(req.body.note, 255);
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  await db.query(
    `INSERT INTO payment_accounts (company_id, bank, account_name, account_number, promptpay, note, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [companyId, bank, accountName, accountNumber, promptpay, note, sortOrder]
  );
  const [[row]] = await db.query(
    'SELECT * FROM payment_accounts WHERE company_id=? ORDER BY created_at DESC LIMIT 1',
    [companyId]
  );
  res.status(201).json(row);
}));

// PUT /:id
router.put('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const bank = normalize(req.body.bank, 100);
  const accountName = normalize(req.body.accountName, 200);
  if (!bank) return res.status(400).json({ error: 'bank is required' });
  if (!accountName) return res.status(400).json({ error: 'accountName is required' });

  const accountNumber = normalize(req.body.accountNumber, 50);
  const promptpay = normalize(req.body.promptpay, 50);
  const note = normalize(req.body.note, 255);
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  await db.query(
    `UPDATE payment_accounts
     SET bank=?, account_name=?, account_number=?, promptpay=?, note=?, sort_order=?
     WHERE id=? AND company_id=?`,
    [bank, accountName, accountNumber, promptpay, note, sortOrder, req.params.id, companyId]
  );
  const [[row]] = await db.query('SELECT * FROM payment_accounts WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!row) return res.status(404).json({ error: 'Payment account not found' });
  res.json(row);
}));

// PATCH /:id/status  — toggle active
router.patch('/:id/status', aw(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });
  const companyId = getCompanyId(req);
  await db.query('UPDATE payment_accounts SET is_active=? WHERE id=? AND company_id=?', [isActive ? 1 : 0, req.params.id, companyId]);
  const [[row]] = await db.query('SELECT * FROM payment_accounts WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!row) return res.status(404).json({ error: 'Payment account not found' });
  res.json(row);
}));

// DELETE /:id
router.delete('/:id', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const [[row]] = await db.query('SELECT id FROM payment_accounts WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!row) return res.status(404).json({ error: 'Payment account not found' });
  await db.query('DELETE FROM payment_accounts WHERE id=? AND company_id=?', [req.params.id, companyId]);
  res.json({ ok: true, deletedId: req.params.id });
}));

export default router;
