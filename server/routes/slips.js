import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { analyzeSlipImage } from '../lib/slipVerification.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

router.post('/analyze', aw(async (req, res) => {
  const { imageData, userId, lineId } = req.body;
  if (!imageData) return res.status(400).json({ error: 'imageData is required' });
  const companyId = getCompanyId(req);

  let user = null;
  if (userId) {
    const [[foundById]] = await db.query('SELECT id, line_id FROM users WHERE id=? AND company_id=?', [userId, companyId]);
    user = foundById || null;
  } else if (lineId) {
    const [[foundByLineId]] = await db.query('SELECT id, line_id FROM users WHERE line_id=? AND company_id=?', [lineId, companyId]);
    user = foundByLineId || null;
  }

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (lineId && user.line_id !== lineId) return res.status(400).json({ error: 'Line ID mismatch' });

  const analysis = await analyzeSlipImage({ imageData, userId: user.id, lineId: user.line_id });
  res.json(analysis);
}));

export default router;
