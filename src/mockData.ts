import { User, Promotion, OrderHistory, TierConfig } from './types';

export const mockTiers: TierConfig[] = [
  { id: 't1', name: 'Standard', minPoints: 0, benefits: ['สะสมแต้มทุกการสั่งซื้อ'], multiplier: 1, color: '#b9b99d' },
  { id: 't2', name: 'Silver', minPoints: 500, benefits: ['รับคะแนน x1.2', 'คูปองวันเกิด'], multiplier: 1.2, color: '#dad3cd' },
  { id: 't3', name: 'Gold', minPoints: 2000, benefits: ['รับคะแนน x1.5', 'รับส่วนลด 5%', 'ของขวัญปีใหม่'], multiplier: 1.5, color: '#c09e85' },
  { id: 't4', name: 'Platinum', minPoints: 5000, benefits: ['รับคะแนน x2', 'รับส่วนลด 10%', 'ของขวัญพิเศษ'], multiplier: 2, color: '#2c5243' },
];

export const mockUsers: User[] = [
  {
    id: 'u1',
    lineId: '@customer_a',
    name: 'Somchai Jaidee',
    phone: '081-123-4567',
    email: 'somchai.j@example.com',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    tier: 'Gold',
    points: 1250,
    joinedAt: '2023-01-15',
    totalSpent: 15400
  },
  {
    id: 'u2',
    lineId: '@wanida_b',
    name: 'Wanida S.',
    phone: '082-987-6543',
    email: 'wanida.s@test.com',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    tier: 'Standard',
    points: 120,
    joinedAt: '2023-11-20',
    totalSpent: 1200
  },
  {
    id: 'u3',
    lineId: '@kritsada99',
    name: 'Kritsada M.',
    phone: '093-555-7777',
    email: 'kritsada99@domain.com',
    avatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d',
    tier: 'Platinum',
    points: 5400,
    joinedAt: '2022-06-10',
    totalSpent: 85000
  },
  {
    id: 'u4',
    lineId: '@nattapong_z',
    name: 'Nattapong K.',
    phone: '084-222-3333',
    email: 'nattapong.k@zmail.com',
    avatar: 'https://i.pravatar.cc/150?u=a04258114e29026703d',
    tier: 'Silver',
    points: 650,
    joinedAt: '2023-05-05',
    totalSpent: 6500
  }
];

export const mockPromotions: Promotion[] = [
  { id: 'p1', title: 'ส่วนลด 100 บาท', description: 'ใช้ 500 แต้มเพื่อแลกรับส่วนลด 100 บาท สำหรับบิลถัดไป', pointsRequired: 500, status: 'active' },
  { id: 'p2', title: 'ฟรีเครื่องดื่ม 1 แก้ว', description: 'แลก 200 แต้ม รับฟรีเครื่องดื่มมูลค่าไม่เกิน 80 บาท', pointsRequired: 200, status: 'active' },
  { id: 'p3', title: 'อัพเกรดเป็น Gold ฟรี', description: 'ใช้ 3000 แต้ม อัพเกรดเป็นระดับ Gold 1 ปี', pointsRequired: 3000, status: 'inactive' },
];

export const mockHistory: OrderHistory[] = [
  { id: 'ord-001', date: '2023-12-10 14:30', amount: 1500, pointsEarned: 150, status: 'approved' },
  { id: 'ord-002', date: '2023-12-15 09:15', amount: 850, pointsEarned: 85, status: 'approved' },
  { id: 'ord-003', date: '2023-12-20 18:45', amount: 2100, pointsEarned: 210, status: 'pending' },
];
