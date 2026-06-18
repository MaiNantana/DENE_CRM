export type TierLevel = 'Standard' | 'Silver' | 'Gold' | 'Platinum';
export type StaffRole = 'admin' | 'manager' | 'user';
export type SlipVerificationStatus = 'verified' | 'uncertain' | 'suspicious' | 'duplicate';
export type SlipReviewStatus = SlipVerificationStatus | 'manual';

export interface OrderItemInput {
  productId?: string | null;
  name: string;
  unitPrice: number | string;
  qty: number | string;
}

export interface OrderCreatePayload {
  userId?: string;
  // For non-members (walk-in) submitting a slip: identify by LINE id + optional display name.
  lineId?: string;
  guestName?: string;
  items?: OrderItemInput[];
  discount?: number;
  discountMode?: 'manual' | 'member';
  note?: string;
  status?: string;
  slipVerificationToken?: string;
  slipImageData?: string;
  slipAmount?: number;
  // QR-decoded slip metadata carried with a manual (human-confirmed amount) submission.
  slipReference?: string | null;
  slipBank?: string | null;
  slipTransactionDate?: string | null;
  slipTransactionTime?: string | null;
}

export interface SlipAnalyzeRequest {
  imageData: string;
  userId?: string;
  lineId?: string;
}

export interface SlipAnalysisResult {
  analysisId: string;
  userId: string | null;
  lineId: string | null;
  amount: number | null;
  currency: 'THB';
  verificationStatus: SlipVerificationStatus;
  confidence: number;
  bank: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  referenceNumber: string | null;
  warnings: string[];
  summary: string;
  canProceed: boolean;
  verificationToken: string | null;
  slipUrl: string | null;
  slipFingerprint?: string | null;
  manualReview?: boolean;
  duplicateOfOrderId?: string | null;
  duplicateOfOrderRef?: string | null;
  duplicateReason?: string | null;
}

export interface SlipReviewLog {
  id: string;
  companyId?: number;
  analysisId: string;
  userId?: string | null;
  userName?: string | null;
  lineId?: string | null;
  source: 'analyze' | 'order';
  status: SlipReviewStatus;
  amount: number | null;
  bank?: string | null;
  referenceNumber?: string | null;
  slipFingerprint?: string | null;
  slipTransactionDate?: string | null;
  slipTransactionTime?: string | null;
  duplicateOrderId?: string | null;
  duplicateOrderRef?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface SlipMonthlyReport {
  monthKey: string;
  monthLabel: string;
  total: number;
  manual: number;
  verified: number;
  uncertain: number;
  suspicious: number;
  duplicate: number;
}

export interface SlipReviewReport {
  windowDays: number;
  months: number;
  summary: {
    totalAttempts: number;
    duplicateAttempts: number;
    suspiciousAttempts: number;
    manualAttempts: number;
    verifiedAttempts: number;
    uncertainAttempts: number;
  };
  monthly: SlipMonthlyReport[];
  recent: SlipReviewLog[];
}

export interface TierConfig {
  id: string;
  companyId?: number;
  name: TierLevel;
  minPoints: number;
  bahtPerPoint: number;
  discountPercent: number;
  durationDays: number;
  benefits: string[];
  multiplier: number;
  color: string;
}

export interface User {
  id: string;
  companyId?: number;
  customerCode?: string;
  lineId: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  tierExpiresAt?: string | null;
  avatar: string;
  tier: TierLevel;
  points: number;
  joinedAt: string;
  totalSpent: number;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  companyId?: number;
  title: string;
  description: string;
  pointsRequired: number;
  status: 'active' | 'inactive';
  redeemMode?: 'auto' | 'manual';
  expiresAt?: string | null;
}

export interface PromotionRedemptionRequest {
  id: string;
  companyId?: number;
  userId: string;
  userName: string;
  lineId: string;
  promotionId: string;
  promotionTitle: string;
  pointsRequired: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
}

export interface PointHistory {
  id: string;
  type: 'earn' | 'redeem';
  points: number;
  pointsRemaining: number;
  refId?: string | null;
  note?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface CompanySettings {
  companyId?: number;
  pointExpiryDays: number;
  updatedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  companyId?: number;
  sender: 'user' | 'bot';
  type: 'text' | 'image' | 'slip_result';
  text?: string;
  imageUrl?: string;
  timestamp: string;
}

export interface OrderHistory {
  id: string;
  date: string;
  amount: number;
  pointsEarned: number;
  status: 'approved' | 'pending' | 'rejected';
}

export interface StaffUser {
  id: string;
  companyId?: number;
  username: string;
  displayName: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
