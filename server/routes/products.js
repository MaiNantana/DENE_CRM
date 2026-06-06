import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

router.get('/', aw(async (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : null;
  const showAll = req.query.showAll === '1';
  const active  = showAll ? '' : ' AND is_active=1';
  const companyId = getCompanyId(req);
  const [rows] = search
    ? await db.query(`SELECT * FROM products WHERE company_id=? AND (name LIKE ? OR category LIKE ?)${active} ORDER BY name ASC`, [companyId, search, search])
    : await db.query(`SELECT * FROM products WHERE company_id=?${active} ORDER BY name ASC`, [companyId]);
  res.json(rows);
}));

router.get('/:id', aw(async (req, res) => {
  const [[row]] = await db.query('SELECT * FROM products WHERE id=? AND company_id=?', [req.params.id, getCompanyId(req)]);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
}));

router.post('/', aw(async (req, res) => {
  const { name, description, price, category } = req.body;
  const companyId = getCompanyId(req);
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  await db.query(
    'INSERT INTO products (company_id, name, description, price, category) VALUES (?, ?, ?, ?, ?)',
    [companyId, name.trim(), description || null, parseFloat(price) || 0, category || null]
  );
  const [[row]] = await db.query('SELECT * FROM products WHERE name=? AND company_id=? ORDER BY created_at DESC LIMIT 1', [name.trim(), companyId]);
  res.status(201).json(row);
}));

router.put('/:id', aw(async (req, res) => {
  const { name, description, price, category } = req.body;
  const companyId = getCompanyId(req);
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  await db.query(
    'UPDATE products SET name=?, description=?, price=?, category=? WHERE id=? AND company_id=?',
    [name.trim(), description || null, parseFloat(price) || 0, category || null, req.params.id, companyId]
  );
  const [[row]] = await db.query('SELECT * FROM products WHERE id=? AND company_id=?', [req.params.id, companyId]);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
}));

router.patch('/:id/status', aw(async (req, res) => {
  const { isActive } = req.body;
  const companyId = getCompanyId(req);
  await db.query('UPDATE products SET is_active=? WHERE id=? AND company_id=?', [isActive ? 1 : 0, req.params.id, companyId]);
  const [[row]] = await db.query('SELECT * FROM products WHERE id=? AND company_id=?', [req.params.id, companyId]);
  res.json(row);
}));

router.delete('/:id', aw(async (req, res) => {
  await db.query('DELETE FROM products WHERE id=? AND company_id=?', [req.params.id, getCompanyId(req)]);
  res.json({ success: true });
}));

export default router;
