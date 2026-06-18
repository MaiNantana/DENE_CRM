import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import { analyzeSlipImage } from '../lib/slipVerification.js';
import { createMemberSlipOrder } from '../lib/slipOrders.js';
import {
  getLineChannelConfig,
  verifyLineSignature,
  getLineImageDataUrl,
  replyLineText,
} from '../lib/lineChannel.js';
import { getCompanyByCode } from '../lib/company.js';

const router = Router();

function formatBaht(amount) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0);
}

const PENDING_REPLY = 'ได้รับรูปแล้ว กำลังรอตรวจสอบ ทางร้านจะยืนยันให้เร็ว ๆ นี้ 🙏';

// Process a single LINE image-message event: detect slip -> check member -> reply.
async function handleImageEvent({ companyConfig, channel, event }) {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  if (!replyToken || !lineUserId) return;

  try {
    const imageData = await getLineImageDataUrl(channel.accessToken, event.message.id);
    const analysis = await analyzeSlipImage({ imageData, lineId: lineUserId, companyCode: companyConfig.code });

    const [[user]] = await db.query(
      'SELECT id, line_id, tier FROM users WHERE line_id=? AND company_id=?',
      [lineUserId, companyConfig.id]
    );

    // Member sent a genuine slip with a readable amount -> record order + reply points.
    if (analysis.isSlip && analysis.canProceed && analysis.amount && user) {
      const order = await createMemberSlipOrder({
        companyId: companyConfig.id,
        user,
        analysis,
        slipImageData: imageData,
      });

      if (order.duplicate) {
        await replyLineText(
          channel.accessToken,
          replyToken,
          `สลิปนี้ถูกใช้ไปแล้ว${order.match?.order_ref ? ` (ออเดอร์ ${order.match.order_ref})` : ''} กรุณาส่งสลิปใหม่`
        );
        return;
      }

      await replyLineText(
        channel.accessToken,
        replyToken,
        `ได้รับสลิปเรียบร้อย ✅\nยอด ฿${formatBaht(order.amount)}\nคุณจะได้รับประมาณ ${order.pointsEarned} แต้ม (รอร้านยืนยัน)`
      );
      return;
    }

    // Everything else (not a slip / not a member / amount unreadable / suspicious) -> pending.
    await replyLineText(channel.accessToken, replyToken, PENDING_REPLY);
  } catch (err) {
    console.error('[lineWebhook] image event failed:', err?.message || err);
    // Best-effort fallback so the user still gets a response.
    try {
      await replyLineText(channel.accessToken, replyToken, PENDING_REPLY);
    } catch {
      // reply token may be expired/used; nothing more to do.
    }
  }
}

// POST /api/line/webhook/:company  (mounted with express.raw so req.body is a Buffer)
router.post('/:company', aw(async (req, res) => {
  const companyConfig = getCompanyByCode(req.params.company);
  const channel = getLineChannelConfig(companyConfig.code);

  if (!channel) {
    // No credentials configured for this company's LINE OA.
    return res.status(404).json({ error: 'LINE channel not configured' });
  }

  const signature = req.headers['x-line-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  if (!verifyLineSignature(channel.secret, rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  // Ack immediately so LINE does not time out / retry; process asynchronously.
  res.sendStatus(200);

  for (const event of events) {
    if (event?.type === 'message' && event.message?.type === 'image') {
      // not awaited on the response, but awaited here to keep ordering + catch errors
      handleImageEvent({ companyConfig, channel, event }).catch(err => {
        console.error('[lineWebhook] handler error:', err?.message || err);
      });
    }
  }
}));

export default router;
