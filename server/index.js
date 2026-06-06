import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter      from './routes/auth.js';
import staffRouter     from './routes/staff.js';
import tiersRouter     from './routes/tiers.js';
import usersRouter     from './routes/users.js';
import promotionsRouter from './routes/promotions.js';
import promotionRequestsRouter from './routes/promotionRequests.js';
import ordersRouter    from './routes/orders.js';
import slipsRouter     from './routes/slips.js';
import productsRouter  from './routes/products.js';
import settingsRouter  from './routes/companySettings.js';
import dashboardRouter from './routes/dashboard.js';
import chatRouter      from './routes/chat.js';
import { allowMethods, requireAuth, requireMethodRoles } from './middleware/auth.js';
import { resolveCompanyFromRequest } from './lib/company.js';

dotenv.config();

const app  = express();
// iisnode sets PORT to a named pipe path; local dev uses TCP 3001
const PORT = process.env.PORT || 3001;

// CORS needed for local dev only; iisnode shares the same origin
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use((req, _res, next) => {
  req.company = resolveCompanyFromRequest(req);
  next();
});

function allowPublicUserRoutes(req, res, next) {
  const method = req.method.toUpperCase() === 'HEAD' ? 'GET' : req.method.toUpperCase();
  const isRootGet = method === 'GET' && req.path === '/';
  const isRootPost = method === 'POST' && req.path === '/';
  const isOrdersGet = method === 'GET' && /^\/[^/]+\/orders\/?$/.test(req.path);
  const isRedemptionsGet = method === 'GET' && /^\/[^/]+\/redemptions\/?$/.test(req.path);

  if (isRootGet || isRootPost || isOrdersGet || isRedemptionsGet) {
    return next();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function allowPublicPromotionRoutes(req, res, next) {
  const method = req.method.toUpperCase() === 'HEAD' ? 'GET' : req.method.toUpperCase();
  const isListOrDetail = method === 'GET' && (req.path === '/' || /^\/[^/]+\/?$/.test(req.path));
  const isRedeem = method === 'POST' && /^\/[^/]+\/redeem\/?$/.test(req.path);

  if (isListOrDetail || isRedeem) {
    return next();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

app.use('/api/auth', authRouter);

// Public LIFF endpoints
app.use('/api/public/tiers', allowMethods(['GET']), tiersRouter);
app.use('/api/public/users', allowPublicUserRoutes, usersRouter);
app.use('/api/public/promotions', allowPublicPromotionRoutes, promotionsRouter);
app.use('/api/public/slips', allowMethods(['POST']), slipsRouter);
app.use('/api/public/orders', allowMethods(['POST']), ordersRouter);
app.use('/api/public/settings', allowMethods(['GET']), settingsRouter);

// Protected admin endpoints
app.use('/api/admin/dashboard', requireAuth, allowMethods(['GET']), dashboardRouter);
app.use('/api/admin/users', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin', 'manager'],
  PUT:   ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
}), usersRouter);
app.use('/api/admin/promotions', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin', 'manager'],
  PUT:   ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
  DELETE:['admin', 'manager'],
}), promotionsRouter);
app.use('/api/admin/promotion-requests', promotionRequestsRouter);
app.use('/api/admin/orders', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin', 'manager'],
  PUT:   ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
  DELETE:['admin', 'manager'],
}), ordersRouter);
app.use('/api/admin/settings', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  PUT:   ['admin'],
}), settingsRouter);
app.use('/api/admin/products', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin', 'manager'],
  PUT:   ['admin', 'manager'],
  PATCH: ['admin', 'manager'],
  DELETE:['admin', 'manager'],
}), productsRouter);
app.use('/api/admin/tiers', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin'],
  PUT:   ['admin'],
  PATCH: ['admin'],
  DELETE:['admin'],
}), tiersRouter);
app.use('/api/admin/chat', requireAuth, requireMethodRoles({
  GET:   ['admin', 'manager', 'user'],
  POST:  ['admin', 'manager'],
}), chatRouter);
app.use('/api/admin/staff', requireAuth, requireMethodRoles({
  GET:   ['admin'],
  POST:  ['admin'],
  PATCH: ['admin'],
}), staffRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'รูปสลิปมีขนาดใหญ่เกินไป กรุณาลดขนาดแล้วลองใหม่' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'ข้อมูลซ้ำในระบบ (Duplicate entry)' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`DENE CRM API running on http://localhost:${PORT}`);
});
