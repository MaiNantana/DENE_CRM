import { User, Promotion, OrderHistory, TierConfig } from './types';
import { DEMO_LINE_ID } from './constants';

export const mockTiers: TierConfig[] = [
  { id: 't1', name: 'Standard', minPoints: 0, bahtPerPoint: 10, discountPercent: 0, durationDays: 365, benefits: ['สะสมแต้มทุกการสั่งซื้อ'], multiplier: 1, color: '#b9b99d' },
  { id: 't2', name: 'Silver', minPoints: 500, bahtPerPoint: 10, discountPercent: 0, durationDays: 365, benefits: ['คูปองวันเกิด'], multiplier: 1.2, color: '#dad3cd' },
  { id: 't3', name: 'Gold', minPoints: 2000, bahtPerPoint: 10, discountPercent: 5, durationDays: 365, benefits: ['ของขวัญปีใหม่'], multiplier: 1.5, color: '#c09e85' },
  { id: 't4', name: 'Platinum', minPoints: 5000, bahtPerPoint: 10, discountPercent: 10, durationDays: 365, benefits: ['ของขวัญพิเศษ'], multiplier: 2, color: '#2c5243' },
];

export const mockUsers: User[] = [
  {
    id: 'u1',
    lineId: DEMO_LINE_ID,
    name: 'N B',
    phone: '0999999999',
    email: '999@gmail.com',
    avatar: 'https://i.pravatar.cc/150?u=mai.nantana',
    tier: 'Standard',
    points: 524,
    joinedAt: '2026-05-28',
    totalSpent: 240,
    isActive: true
  },
  {
    id: 'u2',
    lineId: '@wanida_final',
    name: 'วาณิดา สุขใจ',
    phone: '082-555-6666',
    email: 'wanida.s@test.com',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    tier: 'Standard',
    points: 0,
    joinedAt: '2023-11-20',
    totalSpent: 0,
    isActive: true
  },
  {
    id: 'u3',
    lineId: '@utf8_test_003',
    name: 'สมชาย ใจดี',
    phone: '087-111-2222',
    email: 'kritsada99@domain.com',
    avatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d',
    tier: 'Standard',
    points: 0,
    joinedAt: '2022-06-10',
    totalSpent: 0,
    isActive: true
  },
  {
    id: 'u4',
    lineId: '@new_user_001',
    name: 'New User',
    phone: '088-111-2222',
    email: 'nattapong.k@zmail.com',
    avatar: 'https://i.pravatar.cc/150?u=a04258114e29026703d',
    tier: 'Standard',
    points: 0,
    joinedAt: '2023-05-05',
    totalSpent: 0,
    isActive: true
  }
];

export const mockPromotions: Promotion[] = [
  { id: 'p1', title: 'ส่วนลด 100 บาท', description: 'ใช้ 500 แต้มเพื่อแลกรับส่วนลด 100 บาท สำหรับบิลถัดไป', pointsRequired: 500, status: 'active' },
  { id: 'p2', title: 'ฟรีเครื่องดื่ม 1 แก้ว', description: 'แลก 200 แต้ม รับฟรีเครื่องดื่มมูลค่าไม่เกิน 80 บาท', pointsRequired: 200, status: 'active' },
  { id: 'p3', title: 'อัพเกรดเป็น Gold ฟรี', description: 'ใช้ 3000 แต้ม อัพเกรดเป็นระดับ Gold 1 ปี', pointsRequired: 3000, status: 'inactive' },
];

export const mockHistory: OrderHistory[] = [
  { id: 'ord-1780075392922', date: '2026-05-29 00:23', amount: 240, pointsEarned: 24, status: 'approved' },
];
