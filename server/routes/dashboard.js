import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

router.get('/', aw(async (req, res) => {
  const companyId = getCompanyId(req);
  const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users WHERE company_id=?', [companyId]);
  const [[{ activePromos }]] = await db.query('SELECT COUNT(*) AS activePromos FROM promotions WHERE company_id=? AND status="active"', [companyId]);
  const [[{ totalPoints }]] = await db.query('SELECT COALESCE(SUM(points),0) AS totalPoints FROM users WHERE company_id=?', [companyId]);
  const [[{ totalRevenue }]] = await db.query('SELECT COALESCE(SUM(amount),0) AS totalRevenue FROM orders WHERE company_id=? AND status IN ("paid", "approved")', [companyId]);
  const [recentOrders] = await db.query(
    'SELECT o.*, u.name AS user_name, u.line_id, u.tier AS user_tier, COALESCE(t.baht_per_point, 10) AS baht_per_point, COALESCE(t.multiplier, 1) AS multiplier FROM orders o JOIN users u ON u.id=o.user_id AND u.company_id=o.company_id LEFT JOIN tiers t ON t.name=u.tier AND t.company_id=o.company_id WHERE o.company_id=? ORDER BY o.ordered_at DESC LIMIT 5',
    [companyId]
  );
  const [tierBreakdown] = await db.query('SELECT tier, COUNT(*) AS count FROM users WHERE company_id=? GROUP BY tier', [companyId]);
  res.json({ totalUsers, activePromos, totalPoints, totalRevenue, recentOrders, tierBreakdown });
}));

export default router;
