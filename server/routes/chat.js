import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

router.get('/:userId', aw(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM chat_messages WHERE user_id=? AND company_id=? ORDER BY created_at ASC', [req.params.userId, getCompanyId(req)]);
  res.json(rows);
}));

router.post('/:userId', aw(async (req, res) => {
  const { sender, type, text, imageUrl } = req.body;
  await db.query(
    'INSERT INTO chat_messages (company_id, user_id, sender, type, text, image_url) VALUES (?,?,?,?,?,?)',
    [getCompanyId(req), req.params.userId, sender, type || 'text', text || null, imageUrl || null]
  );
  const [msgs] = await db.query(
    'SELECT * FROM chat_messages WHERE user_id=? AND company_id=? ORDER BY created_at DESC LIMIT 1',
    [req.params.userId, getCompanyId(req)]
  );
  res.status(201).json(msgs[0]);
}));

export default router;
