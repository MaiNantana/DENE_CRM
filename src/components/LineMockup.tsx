import { useState } from 'react';
import { ChevronLeft, Menu, Phone, CreditCard, Camera, History, Ticket, X, Search, Gift, ShieldCheck, Mail, LogOut, Download, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockUsers, mockPromotions, mockHistory } from '../mockData';
import { ChatMessage, TierConfig } from '../types';
import { getContrastColor } from '../utils';

interface LineMockupProps {
  tiers: TierConfig[];
}

export default function LineMockup({ tiers }: LineMockupProps) {
  // Use first user as the simulated current user
  const currentUser = mockUsers[0];
  const [points, setPoints] = useState(currentUser.points);
  
  const currentTierConfig = tiers.find(t => t.name === currentUser.tier) || tiers[0];
  const cardColor = currentTierConfig.color || '#b9b99d';
  const contrastColor = getContrastColor(cardColor);
  
  const [activeModal, setActiveModal] = useState<'liff' | 'register' | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      type: 'text',
      text: 'สวัสดีค่ะ ยินดีต้อนรับสู่ระบบสมาชิกร้าน DENE ค่ะ 🎉\n\nคุณสามารถกดที่เมนูด้านล่างเพื่อดูบัตรสมาชิก แลกของรางวัล หรือส่งรูปสลิปเพื่อสะสมแต้มได้เลยค่ะ',
      timestamp: '10:00 AM'
    }
  ]);

  const handleUploadSlip = () => {
    // Simulate user sending an image
    const newImageMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      type: 'image',
      imageUrl: 'https://images.unsplash.com/photo-1544243555-d14a2db6b933?q=80&w=200&auto=format&fit=crop',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, newImageMsg]);
    
    // Simulate bot replying with point calculation after 1.5s
    setTimeout(() => {
      const earned = Math.floor(Math.random() * 50) + 10;
      setPoints(p => p + earned);
      
      const newReplyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        type: 'slip_result',
        text: `ได้รับยอดชำระเงินเรียบร้อยค่ะ ✅\nคุณได้รับแต้มสะสมเพิ่ม ${earned} แต้ม\n\nแต้มรวมปัจจุบัน: ${points + earned} แต้มค่ะ 🌟`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newReplyMsg]);
    }, 1500);
  };

  return (
    <div className="mx-auto w-[375px] h-[812px] min-h-[812px] bg-slate-900 rounded-[3rem] shadow-2xl relative overflow-hidden border-[8px] border-slate-800 flex flex-col z-10 shrink-0">
      {/* Phone Bezel/Notch */}
      <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
        <div className="w-32 h-6 bg-slate-800 rounded-b-2xl"></div>
      </div>

      {/* LINE Header */}
      <div className="bg-japandi-800 pt-10 pb-3 px-4 flex items-center justify-between text-japandi-50 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-4">
          <ChevronLeft size={24} className="opacity-80" />
          <div className="flex gap-2 items-center">
             <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                <img src="/vite.svg" alt="logo" className="w-4 h-4 opacity-70" />
             </div>
             <h2 className="font-bold text-base tracking-wide shrink-0">DENE Official</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 opacity-80">
          <Search size={20} />
          <Phone size={20} />
          <Menu size={20} />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-[#8c9fb6] p-4 overflow-y-auto flex flex-col gap-4 pb-4">
        <div className="text-center text-xs text-white/60 my-2 shadow-sm bg-black/10 inline-block px-3 py-1 rounded-full mx-auto">
          วันนี้
        </div>
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} max-w-full`}>
            {msg.sender === 'bot' && (
              <div className="w-8 h-8 rounded-full mr-2 shrink-0 bg-japandi-800 flex items-center justify-center text-white border border-white/20">
                 <img src="/vite.svg" alt="Store" className="w-4 h-4 opacity-80" />
              </div>
            )}
            
            <div className={`flex flex-col gap-1 max-w-[75%]`}>
              {msg.type === 'image' ? (
                <div className="rounded-2xl overflow-hidden bg-white p-1 shadow-md border-2 border-white">
                  <img src={msg.imageUrl} alt="Slip" className="w-48 h-64 object-cover rounded-xl" />
                </div>
              ) : (
                <div className={`p-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-[#85E249] rounded-2xl rounded-tr-sm text-japandi-900' 
                    : 'bg-white rounded-2xl rounded-tl-sm text-japandi-900'
                }`}>
                  {msg.text}
                </div>
              )}
              <span className={`text-[10px] text-white/80 px-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input & Rich Menu Area */}
      <div className="bg-white shrink-0 rounded-none shadow-[0_-4px_15px_rgba(0,0,0,0.05)] relative z-40 bg-japandi-800">
        
        {/* Chat Input Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-japandi-900 bg-japandi-50">
          <div className="w-8 h-8 flex items-center justify-center text-japandi-500 hover:bg-japandi-100 rounded-full cursor-pointer">
            <PlusIcon />
          </div>
          <div className="flex-1 bg-japandi-200/50 rounded-full h-9 flex items-center px-4">
            <span className="text-japandi-500 text-sm">Aa</span>
          </div>
          <div className="w-8 h-8 flex items-center justify-center text-japandi-500 hover:bg-japandi-100 rounded-full cursor-pointer">
            <SendIcon />
          </div>
        </div>

        {/* Rich Menu - Graphic styled with Japandi Theme */}
        <div className="h-[260px] p-2 bg-japandi-900 grid grid-cols-3 grid-rows-2 gap-2 pb-6 relative overflow-hidden">
          {/* Decorative faint pattern */}
          <div className="absolute inset-0 bg-white/5 opacity-50" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
          
          <button 
            onClick={() => setActiveModal('register')}
            className="row-span-2 bg-[#ab6a55] rounded-xl flex flex-col items-center justify-center gap-3 text-white hover:bg-[#8f5846] transition-colors relative group overflow-hidden z-10 shadow-lg border border-[#ab6a55]"
          >
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <UserPlus size={28} />
            </div>
            <div className="text-center">
               <span className="text-xs font-bold tracking-wider uppercase block mb-1">สมัครสมาชิก</span>
               <span className="text-[9px] font-medium opacity-80 uppercase tracking-widest">Register</span>
            </div>
          </button>

          <button 
            onClick={() => setActiveModal('liff')}
            className="row-span-2 bg-[#c09e85] rounded-xl flex flex-col items-center justify-center gap-3 text-japandi-900 hover:bg-[#a59385] transition-colors relative group overflow-hidden z-10 shadow-lg border border-[#c09e85]"
          >
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
              <CreditCard size={28} />
            </div>
            <div className="text-center">
               <span className="text-xs font-bold tracking-wider uppercase block mb-1">บัตรสมาชิก</span>
               <span className="text-[9px] font-medium opacity-80 uppercase tracking-widest">E-Member</span>
            </div>
          </button>
          
          <div className="flex flex-col gap-2 z-10 row-span-2">
            <button 
              onClick={handleUploadSlip}
              className="flex-1 bg-japandi-800/80 backdrop-blur-md rounded-xl flex flex-col items-center justify-center gap-2 text-japandi-50 hover:bg-japandi-700 transition-colors border border-white/10"
            >
              <Camera size={20} className="opacity-90" />
              <span className="text-[10px] font-bold tracking-widest uppercase">ส่งสลิป</span>
            </button>
            <div className="grid grid-rows-2 gap-2 flex-1">
               <button 
                 onClick={() => setActiveModal('liff')}
                 className="bg-japandi-800/80 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-japandi-50 hover:bg-japandi-700 transition-colors border border-white/10"
               >
                 <Gift size={16} className="opacity-90 text-[#c09e85]" />
                 <span className="text-[9px] font-bold tracking-widest uppercase">แลกแต้ม</span>
               </button>
               <button 
                 onClick={() => setActiveModal('liff')}
                 className="bg-japandi-800/80 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-japandi-50 hover:bg-japandi-700 transition-colors border border-white/10"
               >
                 <History size={16} className="opacity-90" />
                 <span className="text-[9px] font-bold tracking-widest uppercase">ประวัติ</span>
               </button>
            </div>
          </div>
        </div>
        
      </div>

      {/* Slide UP "LIFF" Mini App / Registration form */}
      <AnimatePresence>
        {(activeModal === 'liff' || activeModal === 'register') && (
          <div className="absolute inset-x-0 bottom-0 h-full z-50 flex flex-col pointer-events-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: '5%' }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 inset-x-0 h-[95%] bg-japandi-50 rounded-t-[32px] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-white/80 backdrop-blur-xl shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-japandi-200/60 sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-japandi-800 flex items-center justify-center">
                        {activeModal === 'register' ? (
                          <UserPlus className="text-white w-4 h-4" />
                        ) : (
                          <UserIcon className="text-white w-4 h-4" />
                        )}
                     </div>
                     <div>
                        <h3 className="font-bold text-japandi-900 text-sm leading-tight">
                          {activeModal === 'register' ? 'สมัครสมาชิก (Register)' : 'ระบบสมาชิก DENE'}
                        </h3>
                        <p className="text-[10px] text-japandi-500 uppercase tracking-widest font-semibold">
                          {activeModal === 'register' ? 'CONNECT WITH LINE' : `${currentUser.tier} MEMBER`}
                        </p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-auto pb-20 p-5 bg-japandi-50/50">
                
                {activeModal === 'register' ? (
                  <div className="space-y-6">
                    <div className="text-center py-6">
                      <div className="mx-auto w-20 h-20 bg-japandi-100 rounded-full flex items-center justify-center mb-4 border border-japandi-200">
                         <img src="/vite.svg" alt="logo" className="w-10 h-10 opacity-70" />
                      </div>
                      <h4 className="text-lg font-bold text-japandi-900 mb-2">ยินดีต้อนรับสู่ DENE</h4>
                      <p className="text-sm text-japandi-500">กรอกข้อมูลเพื่อรับสิทธิพิเศษมากมาย</p>
                    </div>
                    
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('สมัครสมาชิกสำเร็จแล้ว!'); setActiveModal('liff'); }}>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อ-นามสกุล</label>
                        <input 
                          type="text" 
                          required
                          placeholder="ระบุชื่อของคุณ" 
                          className="w-full bg-white border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 focus:border-transparent transition-all"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">เบอร์โทรศัพท์</label>
                        <input 
                          type="tel" 
                          required
                          placeholder="08X-XXX-XXXX" 
                          className="w-full bg-white border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 focus:border-transparent transition-all"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">วันเกิด</label>
                        <input 
                          type="date"
                          required 
                          className="w-full bg-white border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400 focus:border-transparent transition-all"
                        />
                      </div>

                      <div className="pt-4">
                        <button 
                          type="submit"
                          className="w-full bg-japandi-800 text-white rounded-xl py-4 font-bold text-sm tracking-wide hover:bg-japandi-900 transition-colors shadow-md"
                        >
                          ยืนยันการสมัครสมาชิก
                        </button>
                        <p className="text-[10px] text-center text-japandi-500 mt-4 leading-relaxed">
                          การคลิกยืนยัน หมายถึงคุณยอมรับ<br/>ข้อตกลงและเงื่อนไขการให้บริการ
                        </p>
                      </div>
                    </form>
                  </div>
                ) : (
                  <>
                    {/* Card UI: Japandi Style */}
                 <div className="relative min-h-[210px] w-full rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col justify-between border border-japandi-200/50 transition-colors"
                    style={{ backgroundColor: cardColor, color: contrastColor }}
                  >
                    {/* Decorative Elements */}
                    <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-24 h-24 bg-black/10 rounded-full blur-xl"></div>

                    <div className="flex justify-between items-start relative z-10 mb-6">
                      <p className="text-[10px] font-bold opacity-80 tracking-[0.2em]">{currentUser.tier.toUpperCase()}</p>
                      <div className="w-10 h-10 bg-black/10 rounded-xl backdrop-blur-md flex items-center justify-center shadow-inner">
                         <ShieldCheck size={20} className="opacity-80" />
                      </div>
                    </div>

                    <div className="relative z-10 mb-4">
                      <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider mb-0.5">Member Name</p>
                      <p className="text-xl font-bold tracking-tight">{currentUser.name}</p>
                    </div>

                    <div className="relative z-10 flex justify-between items-end mt-auto">
                      <div>
                        <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider mb-0.5">Point Balance</p>
                        <p className="text-[32px] font-black tracking-tighter leading-none">{points.toLocaleString()} <span className="text-sm font-bold opacity-70 tracking-normal">PTS</span></p>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-80 bg-black/10 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-black/5 flex items-center gap-1">
                         <Ticket size={12} />
                         REWARDS
                      </div>
                    </div>
                 </div>

                 {/* Personal Info Box */}
                 <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-japandi-200">
                    <h4 className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest mb-4 flex items-center gap-2 pb-3 border-b border-japandi-100">
                       <UserIcon className="w-3.5 h-3.5" />
                       ข้อมูลสมาชิก (Profile)
                    </h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <span className="text-[13px] text-japandi-500 font-medium">ชื่อ-นามสกุล</span>
                          <span className="text-sm font-bold text-japandi-900 border-b border-dashed border-japandi-300 pb-0.5">{currentUser.name}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[13px] text-japandi-500 font-medium">เบอร์โทรศัพท์</span>
                          <span className="text-sm font-bold text-japandi-900 flex items-center gap-2">
                            {currentUser.phone || '08x-xxx-xxxx'}
                          </span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[13px] text-japandi-500 font-medium">อีเมล</span>
                          <span className="text-sm font-bold text-japandi-900">{currentUser.email || '-'}</span>
                       </div>
                    </div>
                 </div>

                 {/* Promotions / Redeem Box */}
                 <div className="mt-6">
                    <div className="flex justify-between items-end mb-4 px-1">
                       <h4 className="text-sm font-bold text-japandi-900 flex items-center gap-2">
                          <Gift size={18} className="text-[#c09e85]" />
                          แลกแต้มรับสิทธิ์ (Redeem)
                       </h4>
                       <span className="text-[10px] text-japandi-500 font-bold uppercase tracking-widest">ทั้งหมด</span>
                    </div>
                    
                    <div className="space-y-3">
                       {mockPromotions.map(promo => (
                         <div key={promo.id} className="bg-white rounded-xl p-4 shadow-sm border border-japandi-200 flex gap-4 items-center relative overflow-hidden">
                            {promo.status === 'inactive' && (
                               <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10"></div>
                            )}
                            <div className="w-14 h-14 bg-japandi-100 rounded-xl flex items-center justify-center shrink-0 border border-japandi-200">
                               <Ticket size={24} className="text-japandi-700" />
                            </div>
                            <div className="flex-1">
                               <h5 className="text-sm font-bold text-japandi-900 mb-0.5">{promo.title}</h5>
                               <p className="text-[10px] text-japandi-500 leading-snug line-clamp-2">{promo.description}</p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end pl-2 border-l border-japandi-100">
                               <span className="text-base font-black text-[#ab6a55]">{promo.pointsRequired}</span>
                               <span className="text-[9px] font-bold text-japandi-400 uppercase tracking-widest mt-0.5">PTS</span>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* History Box */}
                 <div className="mt-8">
                    <h4 className="text-sm font-bold text-japandi-900 mb-4 flex items-center gap-2 px-1">
                        <History size={18} className="text-japandi-600" />
                        ประวัติการทำรายการล่าสุด
                    </h4>
                    
                    <div className="bg-white border border-japandi-200 rounded-2xl overflow-hidden shadow-sm">
                       {mockHistory.map((hist, idx) => (
                         <div key={hist.id} className={`p-4 flex items-center justify-between ${idx !== mockHistory.length - 1 ? 'border-b border-japandi-100' : ''}`}>
                            <div className="flex items-center gap-3">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hist.status === 'approved' ? 'bg-japandi-50 text-japandi-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {hist.status === 'approved' ? <Download size={16} /> : <History size={16} />}
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-japandi-900 uppercase">{hist.id}</p>
                                  <p className="text-[10px] text-japandi-500">{hist.date}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-bold text-japandi-800">฿{hist.amount.toLocaleString()}</p>
                               <p className="text-[10px] font-bold text-[#c09e85] tracking-widest mt-0.5">+{hist.pointsEarned} PTS</p>
                            </div>
                         </div>
                       ))}
                    </div>
                    
                    <button className="w-full mt-4 py-3 bg-japandi-200/50 hover:bg-japandi-200 text-japandi-800 text-xs font-bold uppercase tracking-widest rounded-xl transition-colors">
                       ดูประวัติทั้งหมด
                    </button>
                 </div>
                 </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
}

function SendIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
}

function UserIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
