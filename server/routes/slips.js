import { Router } from 'express';
import db from '../db.js';
import { aw } from '../asyncWrap.js';
import {
  analyzeSlipImage,
  createSlipFingerprint,
  findDuplicateSlip,
  recordSlipReviewLog,
} from '../lib/slipVerification.js';

const router = Router();

function getCompanyId(req) {
  return Number(req.company?.id || 1) || 1;
}

function buildDuplicateAnalysis(base, match, reason, slipFingerprint) {
  const duplicateLabel = match?.order_ref ? `ออเดอร์ ${match.order_ref}` : 'รายการเดิม';
  return {
    ...base,
    amount: Number(match?.amount ?? base.amount ?? 0) || null,
    verificationStatus: 'duplicate',
    confidence: 1,
    bank: match?.slip_bank || base.bank || null,
    transactionDate: match?.slip_transaction_date || base.transactionDate || null,
    transactionTime: match?.slip_transaction_time || base.transactionTime || null,
    referenceNumber: match?.slip_reference_number || base.referenceNumber || null,
    warnings: [
      `พบสลิปซ้ำกับ${duplicateLabel}${match?.user_name ? ` ของ ${match.user_name}` : ''}`,
      ...(base.warnings || []),
    ],
    summary: 'พบสลิปซ้ำ ระบบไม่อนุญาตให้ส่งซ้ำ',
    canProceed: false,
    manualReview: false,
    verificationToken: null,
    slipUrl: null,
    slipFingerprint: slipFingerprint || base.slipFingerprint || null,
    duplicateOfOrderId: match?.order_id || null,
    duplicateOfOrderRef: match?.order_ref || null,
    duplicateReason: reason,
  };
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

  // Non-members (walk-in) have no users row yet — still allowed to analyze a slip as a guest.
  if (!user) {
    if (!lineId) return res.status(404).json({ error: 'User not found' });
    user = { id: null, line_id: lineId };
  }
  if (lineId && user.line_id !== lineId) return res.status(400).json({ error: 'Line ID mismatch' });

  const slipFingerprint = await createSlipFingerprint(imageData);
  const exactDuplicate = await findDuplicateSlip(db, {
    companyId,
    slipFingerprint,
  });
  if (exactDuplicate) {
    const analysisId = `dup-${Date.now()}`;
    await recordSlipReviewLog(db, {
      companyId,
      analysisId,
      userId: user.id,
      lineId: user.line_id,
      source: 'analyze',
      status: 'duplicate',
      amount: Number(exactDuplicate.match?.amount ?? 0) || null,
      bank: exactDuplicate.match?.slip_bank || null,
      referenceNumber: exactDuplicate.match?.slip_reference_number || null,
      slipFingerprint,
      transactionDate: exactDuplicate.match?.slip_transaction_date || null,
      transactionTime: exactDuplicate.match?.slip_transaction_time || null,
      duplicateOrderId: exactDuplicate.match?.order_id || null,
      duplicateOrderRef: exactDuplicate.match?.order_ref || null,
      reason: `พบสลิปซ้ำกับออเดอร์ ${exactDuplicate.match?.order_ref || 'รายการเดิม'}`,
    }).catch(() => null);
    return res.json(buildDuplicateAnalysis({
      analysisId,
      userId: user.id,
      lineId: user.line_id,
      amount: Number(exactDuplicate.match?.amount ?? 0) || null,
      currency: 'THB',
      verificationStatus: 'duplicate',
      confidence: 1,
      bank: exactDuplicate.match?.slip_bank || null,
      transactionDate: exactDuplicate.match?.slip_transaction_date || null,
      transactionTime: exactDuplicate.match?.slip_transaction_time || null,
      referenceNumber: exactDuplicate.match?.slip_reference_number || null,
      warnings: [],
      summary: 'พบสลิปซ้ำ ระบบไม่อนุญาตให้ส่งซ้ำ',
      canProceed: false,
      manualReview: false,
      verificationToken: null,
      slipUrl: null,
      slipFingerprint,
    }, exactDuplicate.match, exactDuplicate.reason, slipFingerprint));
  }

  const analysis = await analyzeSlipImage({ imageData, userId: user.id, lineId: user.line_id, companyCode: req.company?.code });
  const duplicate = await findDuplicateSlip(db, {
    companyId,
    slipFingerprint: analysis.slipFingerprint || slipFingerprint,
    referenceNumber: analysis.referenceNumber,
    amount: analysis.amount,
    bank: analysis.bank,
    transactionDate: analysis.transactionDate,
    transactionTime: analysis.transactionTime,
  });
  if (duplicate) {
    const duplicateAnalysisId = analysis.analysisId || `dup-${Date.now()}`;
    await recordSlipReviewLog(db, {
      companyId,
      analysisId: duplicateAnalysisId,
      userId: user.id,
      lineId: user.line_id,
      source: 'analyze',
      status: 'duplicate',
      amount: analysis.amount,
      bank: analysis.bank,
      referenceNumber: analysis.referenceNumber,
      slipFingerprint: analysis.slipFingerprint || slipFingerprint,
      transactionDate: analysis.transactionDate,
      transactionTime: analysis.transactionTime,
      duplicateOrderId: duplicate.match?.order_id || null,
      duplicateOrderRef: duplicate.match?.order_ref || null,
      reason: `พบสลิปซ้ำกับออเดอร์ ${duplicate.match?.order_ref || 'รายการเดิม'}`,
    }).catch(() => null);
    return res.json(buildDuplicateAnalysis(analysis, duplicate.match, duplicate.reason, analysis.slipFingerprint || slipFingerprint));
  }

  if (analysis.verificationStatus === 'suspicious') {
    await recordSlipReviewLog(db, {
      companyId,
      analysisId: analysis.analysisId,
      userId: user.id,
      lineId: user.line_id,
      source: 'analyze',
      status: 'suspicious',
      amount: analysis.amount,
      bank: analysis.bank,
      referenceNumber: analysis.referenceNumber,
      slipFingerprint: analysis.slipFingerprint || slipFingerprint,
      transactionDate: analysis.transactionDate,
      transactionTime: analysis.transactionTime,
      reason: analysis.summary || 'สลิปน่าสงสัย',
    }).catch(() => null);
  }

  res.json(analysis);
}));

export default router;
