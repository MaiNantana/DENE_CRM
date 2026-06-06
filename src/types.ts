export type TierLevel = 'Standard' | 'Silver' | 'Gold' | 'Platinum';
export type StaffRole = 'admin' | 'manager' | 'user';
export type SlipVerificationStatus = 'verified' | 'uncertain' | 'suspicious';

export interface OrderItemInput {
  productId?: string | null;
  name: string;
  unitPrice: number | string;
  qty: number | string;
}

export interface OrderCreatePayload {
  userId: string;
  items?: OrderItemInput[];
  discount?: number;
  discountMode?: 'manual' | 'member';
  note?: string;
  status?: string;
  slipVerificationToken?: string;
}

export interface SlipAnalyzeRequest {
  imageData: string;
  userId: string;
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
