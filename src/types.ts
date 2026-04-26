export type TierLevel = 'Standard' | 'Silver' | 'Gold' | 'Platinum';

export interface TierConfig {
  id: string;
  name: TierLevel;
  minPoints: number;
  benefits: string[];
  multiplier: number;
  color: string;
}

export interface User {
  id: string;
  lineId: string;
  name: string;
  phone?: string;
  email?: string;
  avatar: string;
  tier: TierLevel;
  points: number;
  joinedAt: string;
  totalSpent: number;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  status: 'active' | 'inactive';
}

export interface ChatMessage {
  id: string;
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
