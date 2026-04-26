import React, { useState } from 'react';
import { Users, Tag, Award, Settings, Search, Plus, TrendingUp, CreditCard, Activity, ArrowRight } from 'lucide-react';
import { mockUsers, mockPromotions, mockHistory } from '../mockData';
import { TierConfig } from '../types';

interface AdminDashboardProps {
  tiers: TierConfig[];
  setTiers: React.Dispatch<React.SetStateAction<TierConfig[]>>;
}

export default function AdminDashboard({ tiers, setTiers }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'promotions' | 'levels'>('overview');
  const [editingTiers, setEditingTiers] = useState(tiers);

  // Update original state when saving
  const handleSaveTiers = () => {
    setTiers(editingTiers);
    alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  };

  // Stats for Overview
  const totalUsers = mockUsers.length;
  const activePromos = mockPromotions.filter(p => p.status === 'active').length;
  const totalPoints = mockUsers.reduce((sum, u) => sum + u.points, 0);

  const handleTierChange = (id: string, field: 'minPoints' | 'multiplier' | 'color', value: string) => {
     setEditingTiers(prev => prev.map(t => 
       t.id === id ? { ...t, [field]: field === 'color' ? value : Number(value) } : t
     ));
  };

  return (
    <div className="max-w-7xl mx-auto p-6 flex gap-6 h-full text-japandi-900">
      
      {/* Sidebar */}
      <div className="w-64 bg-white/80 backdrop-blur-xl border border-japandi-200 rounded-3xl p-5 shrink-0 flex flex-col relative z-10 shadow-sm">
        <div className="text-xs font-bold text-japandi-500 uppercase tracking-wider mb-6 px-3">CRM System</div>
        
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-japandi-800 text-white shadow-md' : 'text-japandi-600 hover:bg-japandi-100 border border-transparent'}`}
          >
            <Activity size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-japandi-800 text-white shadow-md' : 'text-japandi-600 hover:bg-japandi-100 border border-transparent'}`}
          >
            <Users size={18} />
            ลูกค้า & สมาชิก
          </button>
          <button 
            onClick={() => setActiveTab('promotions')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'promotions' ? 'bg-japandi-800 text-white shadow-md' : 'text-japandi-600 hover:bg-japandi-100 border border-transparent'}`}
          >
            <Tag size={18} />
            จัดการโปรโมชั่น
          </button>
          <button 
            onClick={() => setActiveTab('levels')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'levels' ? 'bg-japandi-800 text-white shadow-md' : 'text-japandi-600 hover:bg-japandi-100 border border-transparent'}`}
          >
            <Award size={18} />
            ตั้งค่า Loyalty Level
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white/80 backdrop-blur-xl border border-japandi-200 rounded-3xl overflow-hidden flex flex-col relative z-10 shadow-sm">
        {/* Header */}
        <div className="px-6 py-5 border-b border-japandi-200 flex justify-between items-center bg-japandi-50/50">
          <h1 className="text-xl font-bold text-japandi-900">
            {activeTab === 'overview' && 'ภาพรวมระบบ (Dashboard)'}
            {activeTab === 'users' && 'รายชื่อลูกค้า (Customers)'}
            {activeTab === 'promotions' && 'จัดการโปรโมชั่น (Promotions)'}
            {activeTab === 'levels' && 'ตั้งค่าระดับสมาชิก (Loyalty Tiers)'}
          </h1>
          <div className="flex gap-3">
            {activeTab === 'users' && (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-japandi-450" />
                <input 
                  type="text" 
                  placeholder="ค้นหา Line ID..." 
                  className="pl-9 pr-4 py-2 bg-white border border-japandi-300 rounded-xl text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400 w-64 placeholder-japandi-450 shadow-sm"
                />
              </div>
            )}
            {activeTab === 'promotions' && (
              <button className="flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 transition-colors shadow-md">
                <Plus size={16} />
                สร้างโปรโมชั่นใหม่
              </button>
            )}
            {activeTab === 'levels' && (
              <button 
                onClick={handleSaveTiers}
                className="flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 transition-colors shadow-md"
              >
                บันทึกการตั้งค่า
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto p-6 bg-japandi-50/30">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                  <div className="w-12 h-12 bg-japandi-100 text-japandi-800 rounded-xl flex items-center justify-center mb-4">
                     <Users size={24} />
                  </div>
                  <p className="text-xs text-japandi-500 font-bold uppercase tracking-wider mb-1">จำนวนลูกค้าทั้งหมด</p>
                  <p className="text-3xl font-bold text-japandi-900">{totalUsers.toLocaleString()} <span className="text-sm font-normal text-japandi-500">คน</span></p>
                </div>
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                  <div className="w-12 h-12 bg-[#ffe8d6] text-japandi-600 rounded-xl flex items-center justify-center mb-4">
                     <Tag size={24} />
                  </div>
                  <p className="text-xs text-japandi-500 font-bold uppercase tracking-wider mb-1">โปรโมชั่นที่ใช้งานอยู่</p>
                  <p className="text-3xl font-bold text-japandi-900">{activePromos} <span className="text-sm font-normal text-japandi-500">แคมเปญ</span></p>
                </div>
                <div className="bg-japandi-800 border border-japandi-900 rounded-2xl p-5 shadow-sm relative overflow-hidden text-white pattern-dots">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="w-12 h-12 bg-white/10 text-japandi-200 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                     <TrendingUp size={24} />
                  </div>
                  <p className="text-xs text-japandi-300 font-bold uppercase tracking-wider mb-1">คะแนนสะสมในระบบรวม</p>
                  <p className="text-3xl font-bold text-white">{totalPoints.toLocaleString()} <span className="text-sm font-normal text-japandi-300">pts</span></p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Recent Transactions */}
                 <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-japandi-900">รายการสั่งซื้อล่าสุด</h3>
                      <button className="text-xs font-semibold text-japandi-600 hover:text-japandi-800 flex items-center gap-1">ดูทั้งหมด <ArrowRight size={14}/></button>
                    </div>
                    <div className="space-y-3">
                       {mockHistory.slice(0, 4).map(h => (
                         <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-japandi-100 hover:bg-japandi-50 transition-colors">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-japandi-100 text-japandi-600 flex items-center justify-center">
                               <CreditCard size={18} />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-japandi-900">{h.id.toUpperCase()}</p>
                               <p className="text-xs text-japandi-500">{h.date}</p>
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-sm font-bold text-japandi-900">฿{h.amount.toLocaleString()}</p>
                             <p className="text-xs font-semibold text-japandi-sage">+{h.pointsEarned} pts</p>
                           </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* Shortcuts */}
                 <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-japandi-900 mb-4">ทางลัดจัดการระบบ (Quick Actions)</h3>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => setActiveTab('promotions')} className="flex flex-col items-start p-4 rounded-xl border border-japandi-200 hover:border-japandi-400 hover:bg-japandi-50 transition-all text-left group">
                          <Tag size={20} className="text-japandi-600 mb-2 group-hover:text-japandi-800" />
                          <span className="font-semibold text-japandi-900 text-sm">สร้างโปรโมชั่นใหม่</span>
                          <span className="text-xs text-japandi-500 mt-1">ดึงดูดลูกค้าด้วยคูปอง</span>
                       </button>
                       <button onClick={() => setActiveTab('users')} className="flex flex-col items-start p-4 rounded-xl border border-japandi-200 hover:border-japandi-400 hover:bg-japandi-50 transition-all text-left group">
                          <Users size={20} className="text-japandi-600 mb-2 group-hover:text-japandi-800" />
                          <span className="font-semibold text-japandi-900 text-sm">ดูรายชื่อลูกค้า</span>
                          <span className="text-xs text-japandi-500 mt-1">ตรวจสอบประวัติสมาชิก</span>
                       </button>
                       <button onClick={() => setActiveTab('levels')} className="flex flex-col items-start p-4 rounded-xl border border-japandi-200 hover:border-japandi-400 hover:bg-japandi-50 transition-all text-left group">
                          <Award size={20} className="text-japandi-600 mb-2 group-hover:text-japandi-800" />
                          <span className="font-semibold text-japandi-900 text-sm">ปรับเกณฑ์ระดับสถานะ</span>
                          <span className="text-xs text-japandi-500 mt-1">แก้ไขคะแนนเลื่อนขั้น</span>
                       </button>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="border border-japandi-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-japandi-50 text-japandi-600 border-b border-japandi-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4 font-bold">ชื่อลูกค้า / Line</th>
                    <th className="px-6 py-4 font-bold text-center">ระดับ (Level)</th>
                    <th className="px-6 py-4 font-bold text-right">คะแนนสะสม (Points)</th>
                    <th className="px-6 py-4 font-bold text-right">ยอดซื้อรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-japandi-100">
                  {mockUsers.map(user => (
                    <tr key={user.id} className="hover:bg-japandi-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-japandi-200 object-cover border-2 border-white shadow-sm" />
                          <div>
                            <div className="font-bold text-japandi-900 text-sm">{user.name}</div>
                            <div className="text-japandi-500 text-[10px]">Line ID: {user.lineId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                          user.tier === 'Platinum' ? 'bg-japandi-800 text-japandi-100 border-japandi-900' :
                          user.tier === 'Gold' ? 'bg-[#c09e85]/20 text-[#7f6554] border-[#c09e85]' :
                          user.tier === 'Silver' ? 'bg-japandi-300/30 text-japandi-700 border-japandi-300' :
                          'bg-japandi-sage/20 text-japandi-800 border-japandi-sage' // Standard
                        }`}>
                          {user.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-japandi-800 tracking-wide text-xs">
                        {user.points.toLocaleString()} pts
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-japandi-600 text-xs">
                        ฿{user.totalSpent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'promotions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockPromotions.map(promo => (
                <div key={promo.id} className="bg-white border border-japandi-200 shadow-sm rounded-3xl p-5 hover:border-japandi-400 transition-colors relative overflow-hidden group">
                  {promo.status === 'inactive' && (
                    <div className="absolute top-0 right-0 bg-japandi-rust text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">INACTIVE</div>
                  )}
                  <div className="w-12 h-12 bg-japandi-100 text-japandi-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Tag size={20} />
                  </div>
                  <h3 className="font-bold text-japandi-900 mb-1.5">{promo.title}</h3>
                  <p className="text-japandi-500 text-xs mb-5 line-clamp-2 h-8">{promo.description}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-japandi-100 mt-auto">
                    <div className="text-xs text-japandi-600">
                      ใช้ <span className="text-japandi-800 font-bold text-[15px] mx-1">{promo.pointsRequired}</span> แต้ม
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'levels' && (
            <div className="max-w-4xl">
               <div className="bg-white border border-japandi-200 rounded-3xl p-6 shadow-sm">
                  <p className="text-sm text-japandi-600 mb-8">ตั้งค่าระดับสมาชิก เกณฑ์การสะสมคะแนน และสิทธิประโยชน์ของแต่ละระดับ ลองแก้ไขตัวเลขเพื่อดูการจำลอง (Mockup Interactivity)</p>
                  
                  <div className="space-y-6">
                    {editingTiers.map((tier, idx) => (
                      <div key={tier.id} className="p-5 rounded-2xl border border-japandi-200 bg-japandi-50/50 flex flex-col md:flex-row gap-6 relative">
                        <div className="w-full md:w-1/4 shrink-0 flex flex-col justify-center">
                           <div className={`inline-flex self-start items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-2 ${
                              tier.name === 'Platinum' ? 'bg-japandi-800 text-japandi-100 border-japandi-900' :
                              tier.name === 'Gold' ? 'bg-[#c09e85]/20 text-[#7f6554] border-[#c09e85]' :
                              tier.name === 'Silver' ? 'bg-japandi-300/30 text-japandi-700 border-japandi-300' :
                              'bg-japandi-sage/20 text-japandi-800 border-japandi-sage'
                            }`}>
                              Level {idx + 1}: {tier.name}
                            </div>
                            <p className="text-xs text-japandi-500 mt-1 font-medium">สิทธิพิเศษ:</p>
                            <ul className="text-xs text-japandi-700 list-disc list-inside mt-1 space-y-1">
                               {tier.benefits.map((b, i) => <li key={i} className="truncate">{b}</li>)}
                            </ul>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                           <div className="space-y-1">
                              <label className="text-xs font-bold text-japandi-600 uppercase tracking-wide">คะแนนขั้นต่ำ (Points)</label>
                              <div className="relative">
                                 <input 
                                   type="number" 
                                   value={tier.minPoints}
                                   onChange={(e) => handleTierChange(tier.id, 'minPoints', e.target.value)}
                                   disabled={idx === 0}
                                   className="w-full bg-white border border-japandi-300 rounded-xl px-4 py-2.5 text-sm text-japandi-900 font-bold focus:ring-2 focus:ring-japandi-500 focus:outline-none disabled:bg-japandi-100 disabled:text-japandi-450"
                                 />
                                 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-japandi-400">PTS</span>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-xs font-bold text-japandi-600 uppercase tracking-wide">ตัวคูณคะแนน (Multiplier)</label>
                              <div className="relative">
                                 <input 
                                   type="number" 
                                   step="0.1"
                                   min="1"
                                   value={tier.multiplier}
                                   onChange={(e) => handleTierChange(tier.id, 'multiplier', e.target.value)}
                                   className="w-full bg-white border border-japandi-300 rounded-xl px-4 py-2.5 text-sm text-japandi-900 font-bold focus:ring-2 focus:ring-japandi-500 focus:outline-none"
                                 />
                                 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-japandi-400">X</span>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-xs font-bold text-japandi-600 uppercase tracking-wide">สีบัตรสมาชิก (Color)</label>
                              <div className="relative border border-japandi-300 rounded-xl overflow-hidden h-[42px] focus-within:ring-2 focus-within:ring-japandi-500">
                                 <input 
                                   type="color" 
                                   value={tier.color || '#dddddd'}
                                   onChange={(e) => handleTierChange(tier.id, 'color', e.target.value)}
                                   className="w-full h-16 absolute -top-2 -left-2 cursor-pointer scale-150"
                                 />
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
