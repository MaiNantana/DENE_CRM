import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, Ticket, Gift, History, Download, Loader2, AlertCircle, CheckCircle, Clock, XCircle, X, BadgeCheck } from 'lucide-react';
import LiffLayout from './LiffLayout';
import { publicApi } from '../../api';
import { DEMO_LINE_ID } from '../../constants';
import { getContrastColor } from '../../utils';
import { useLineIdentity } from '../../hooks/useLineIdentity';
import { buildCompanyPath, getCurrentCompany } from '../../lib/company';
import { getTierBahtPerPoint, getTierDiscountPercent, normalizeTierBenefits } from '../../lib/tiers';
import type { PointHistory } from '../../types';

export default function LiffMember() {
  const [params]  = useSearchParams();
  const nav       = useNavigate();
  const company = getCurrentCompany();
  const fallbackLineId = params.get('lineId') || (import.meta.env.DEV ? DEMO_LINE_ID : '');
  const { lineId, loading: identityLoading, error: identityError, isAuto } = useLineIdentity(fallbackLineId);

  const [user,   setUser]   = useState<any>(null);
  const [tiers,  setTiers]  = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [redemptionHistory, setRedemptionHistory] = useState<any[]>([]);
  const [pointHistory, setPointHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]  = useState('');
  const [redeemingPromoId, setRedeemingPromoId] = useState<string | null>(null);
  const [promoNotice, setPromoNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<any | null>(null);

  const loadMemberHistory = async (userId: string) => {
    const [orderData, redemptionData, pointData] = await Promise.all([
      publicApi.getUserOrders(userId),
      publicApi.getUserRedemptions(userId),
      publicApi.getUserPoints(userId),
    ]);
    setOrders(orderData);
    setRedemptionHistory(redemptionData);
    setPointHistory(pointData.filter((p: PointHistory) => p.type === 'earn'));
  };

  useEffect(() => {
    if (identityLoading) return;
    if (!lineId) {
      setError(identityError || 'ไม่พบ Line ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    (async () => {
      try {
        const [users, tData, pData] = await Promise.all([
          publicApi.getUsers(lineId, true),
          publicApi.getTiers(),
          publicApi.getPromotions('active'),
        ]);
        const found = users.find((u: any) => u.line_id === lineId);
        if (!found) { setError('ไม่พบข้อมูลสมาชิก กรุณาสมัครสมาชิกก่อน'); setLoading(false); return; }
        setUser(found);
        setTiers(tData);
        setPromos(pData);
        await loadMemberHistory(found.id);
      } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
      finally { setLoading(false); }
    })();
  }, [lineId, identityLoading, identityError]);

  useEffect(() => {
    if (!promoNotice) return;
    const timer = window.setTimeout(() => setPromoNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [promoNotice]);

  if (identityLoading || loading) return (
    <LiffLayout title="บัตรสมาชิก" subtitle={`${company.label} Member`}>
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-japandi-400">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm">กำลังอ่านข้อมูลสมาชิกจาก LINE...</p>
      </div>
    </LiffLayout>
  );

  if (error) return (
    <LiffLayout title="บัตรสมาชิก" subtitle={`${company.label} Member`}>
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <p className="text-japandi-700 font-semibold">{error}</p>
        <button onClick={() => nav(buildCompanyPath(`/liff/register${lineId ? `?lineId=${encodeURIComponent(lineId)}` : ''}`, company))}
          className="py-3 px-6 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900">
          สมัครสมาชิก
        </button>
      </div>
    </LiffLayout>
  );

  const openRedeemModal = (promo: any) => {
    setSelectedPromo(promo);
    setPromoNotice(null);
  };

  const closeRedeemModal = () => {
    if (redeemingPromoId) return;
    setSelectedPromo(null);
  };

  const handleRedeem = async (promo: any) => {
    const requiredPoints = Number(promo.points_required) || 0;
    const currentPoints = Number(user.points) || 0;

    if (currentPoints < requiredPoints) {
      setPromoNotice({ type: 'error', text: `แต้มไม่พอสำหรับ "${promo.title}"` });
      return;
    }

    setRedeemingPromoId(promo.id);
    setPromoNotice(null);

    try {
      const result = await publicApi.redeemPromotion(promo.id, { userId: user.id, lineId });
      if (result?.status === 'pending' || result?.redeemMode === 'manual') {
        setPromoNotice({ type: 'success', text: `ส่งคำขอ "${promo.title}" เรียบร้อยแล้ว รอร้านยืนยันก่อนใช้สิทธิ์` });
      } else {
        const usedPoints = Number(result?.pointsUsed ?? requiredPoints) || requiredPoints;
        const remainingPoints = Number(result?.remainingPoints);

        setUser((prev: any) => {
          if (!prev) return prev;
          const nextPoints = Number.isFinite(remainingPoints)
            ? remainingPoints
            : Math.max((Number(prev.points) || 0) - usedPoints, 0);
          return { ...prev, points: nextPoints };
        });

        setPromoNotice({ type: 'success', text: `แลก "${promo.title}" สำเร็จ ใช้ ${usedPoints.toLocaleString()} แต้ม` });
      }
      try {
        await loadMemberHistory(user.id);
      } catch {
        // keep the success state even if history refresh fails
      }
      setSelectedPromo(null);
    } catch (err: any) {
      setPromoNotice({ type: 'error', text: err?.message || 'เกิดข้อผิดพลาดในการแลกสิทธิ์' });
    } finally {
      setRedeemingPromoId(null);
    }
  };

  const tierConfig = tiers.find((t: any) => t.name === user.tier) || tiers[0];
  const cardColor  = tierConfig?.color || '#b9b99d';
  const textColor  = getContrastColor(cardColor);
  const tierBahtPerPoint = getTierBahtPerPoint(tierConfig || {});
  const tierDiscountPercent = getTierDiscountPercent(tierConfig || {});
  const tierMultiplier = Number(tierConfig?.multiplier ?? 1) || 1;
  const bens = normalizeTierBenefits(tierConfig?.benefits);
  const getOrderPoints = (o: any) => {
    const storedPoints = Number(o.points_earned ?? o.pointsEarned);
    if (Number.isFinite(storedPoints) && storedPoints > 0) return storedPoints;

    const orderTier = o.user_tier || user.tier;
    const tier = tiers.find((t: any) => t.name === orderTier);
    const bahtPerPoint = getTierBahtPerPoint(tier || {});
    const multiplier = Number(tier?.multiplier ?? 1) || 1;
    const amount = Number(o.amount) || 0;

    return amount > 0 ? Math.floor((amount / bahtPerPoint) * multiplier) : 0;
  };
  const formatDisplayDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('th-TH', { dateStyle: 'medium' });
  };
  const earnedPointHistory = pointHistory.filter((p: PointHistory) => p.type === 'earn');
  const getPointHistoryStatus = (item: PointHistory) => {
    if (!item.expiresAt) return item.pointsRemaining > 0 ? 'ไม่หมดอายุ' : 'ใช้แล้ว';
    const expired = new Date(item.expiresAt).getTime() <= Date.now();
    if (expired) return 'หมดอายุ';
    return item.pointsRemaining > 0 ? 'ใช้งานอยู่' : 'ใช้แล้ว';
  };

  // next tier
  const sorted = [...tiers].sort((a, b) => a.min_points - b.min_points);
  const currIdx = sorted.findIndex(t => t.name === user.tier);
  const nextTier = sorted[currIdx + 1];
  const progress = nextTier
    ? Math.min(100, ((user.points - (tierConfig?.min_points || 0)) / (nextTier.min_points - (tierConfig?.min_points || 0))) * 100)
    : 100;

  return (
    <LiffLayout title="บัตรสมาชิก" subtitle={`${company.label} — ${user.tier} Member`} noPad>
      <div className="p-4 space-y-4 pb-8">

        {identityError && !isAuto && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-3 text-xs leading-relaxed">
            {identityError}
          </div>
        )}

        {promoNotice && (
          <div className={`rounded-2xl border p-3 text-sm flex items-start gap-2 ${
            promoNotice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {promoNotice.type === 'success' ? (
              <CheckCircle size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <p className="leading-relaxed">{promoNotice.text}</p>
          </div>
        )}

        {/* Member Card */}
        <div className="relative rounded-3xl p-5 shadow-lg overflow-hidden flex flex-col justify-between min-h-[200px]"
          style={{ backgroundColor: cardColor, color: textColor }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20" style={{ backgroundColor: textColor }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ backgroundColor: textColor }} />

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold opacity-70 tracking-[0.2em] uppercase">{user.tier} MEMBER</p>
              <p className="font-bold text-xl mt-1">{user.name}</p>
              <p className="text-xs opacity-60 mt-0.5">{user.line_id}</p>
              {user.tier_expires_at && (
                <p className="text-[10px] opacity-60 mt-1">
                  หมดอายุระดับ: {formatDisplayDate(user.tier_expires_at)}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: textColor + '20' }}>
              <ShieldCheck size={20} style={{ opacity: 0.8 }} />
            </div>
          </div>

          <div className="relative z-10 flex justify-between items-end mt-6">
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-wider font-bold">Point Balance</p>
              <p className="text-4xl font-black leading-tight">{Number(user.points).toLocaleString()}</p>
              <p className="text-xs font-bold opacity-60">PTS</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-60 font-bold">ยอดซื้อรวม</p>
              <p className="text-sm font-bold">฿{Number(user.total_spent).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextTier && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-japandi-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-japandi-600">ความคืบหน้าสู่ระดับ</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: nextTier.color + '30', color: nextTier.color }}>
                {nextTier.name}
              </span>
            </div>
            <div className="w-full bg-japandi-100 rounded-full h-2 mb-2 overflow-hidden">
              <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: cardColor }} />
            </div>
            <p className="text-[11px] text-japandi-500">
              ต้องการอีก <span className="font-bold text-japandi-800">{(nextTier.min_points - user.points).toLocaleString()} แต้ม</span> เพื่อเลื่อนระดับ
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-japandi-100">
          <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest mb-3">สิทธิพิเศษที่คำนวณจากระดับ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-japandi-200 bg-japandi-50/70 p-3">
              <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">คะแนนสะสม</p>
              <p className="mt-1 text-sm font-black text-japandi-900">x{tierMultiplier}</p>
              <p className="mt-1 text-[11px] text-japandi-500">ทุก ฿{Number(tierBahtPerPoint).toLocaleString()} = 1 แต้ม</p>
            </div>
            <div className="rounded-xl border border-japandi-200 bg-japandi-50/70 p-3">
              <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">ส่วนลดสมาชิก</p>
              <p className="mt-1 text-sm font-black text-japandi-900">{Number(tierDiscountPercent).toFixed(2).replace(/\.00$/, '')}%</p>
              <p className="mt-1 text-[11px] text-japandi-500">ซื้อ ฿1,000 ลด ฿{(1000 * Number(tierDiscountPercent) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        {bens.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-japandi-100">
            <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest mb-3">สิทธิพิเศษอื่นๆ ของคุณ</h3>
            <ul className="space-y-2">
              {bens.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-japandi-800">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ backgroundColor: cardColor }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Promotions */}
        {promos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <Gift size={14} /> แลกแต้มรับสิทธิ์
            </h3>
            {promos.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openRedeemModal(p)}
                disabled={redeemingPromoId === p.id}
                aria-label={`แลกสิทธิ์ ${p.title}`}
                className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-japandi-100 space-y-3 transition-transform touch-manipulation cursor-pointer ${
                  redeemingPromoId === p.id ? 'opacity-80' : 'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]'
                }`}
              >
                <div className="flex gap-3 items-start">
                  <div className="w-12 h-12 bg-japandi-100 rounded-xl flex items-center justify-center shrink-0">
                    <Ticket size={20} className="text-japandi-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-japandi-900 text-sm truncate">{p.title}</p>
                    <p className="text-japandi-500 text-xs line-clamp-2">{p.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                        (p.redeem_mode || p.redeemMode) === 'manual'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {(p.redeem_mode || p.redeemMode) === 'manual' ? 'รออนุมัติ' : 'แลกทันที'}
                      </span>
                      <span className="text-[10px] text-japandi-400 font-semibold">
                        แตะเพื่อดูรายละเอียด
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right pl-2 border-l border-japandi-100">
                    <p className="text-base font-black" style={{ color: cardColor }}>{Number(p.points_required).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-japandi-400 uppercase">PTS</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-japandi-50">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-japandi-500">
                      ใช้ {Number(p.points_required).toLocaleString()} แต้ม
                    </p>
                    {Number(user.points) < Number(p.points_required) && (
                      <p className="text-[10px] font-bold text-amber-600">
                        แต้มของคุณยังไม่พอ
                      </p>
                    )}
                  </div>
                  <div className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-bold ${
                    Number(user.points) >= Number(p.points_required)
                      ? 'bg-japandi-800 text-white'
                      : 'bg-japandi-100 text-japandi-600'
                  }`}>
                    {redeemingPromoId === p.id ? (
                      <>
                        <Loader2 size={14} className="mr-2 animate-spin" />
                        กำลังแลก
                      </>
                    ) : Number(user.points) >= Number(p.points_required) ? (
                      'กดเพื่อแลก'
                    ) : (
                      'ดูเงื่อนไข'
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Redeem Confirm Modal */}
        {selectedPromo && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeRedeemModal} />
            <div className="relative w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-japandi-200 overflow-hidden">
              <div className="px-6 pt-6 pb-5 border-b border-japandi-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-japandi-500">ยืนยันการแลกแต้ม</p>
                    <h3 className="mt-2 text-lg font-black text-japandi-900">{selectedPromo.title}</h3>
                  </div>
                  <button onClick={closeRedeemModal} disabled={!!redeemingPromoId}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-japandi-100 text-japandi-600 disabled:opacity-50">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="rounded-2xl border border-japandi-200 bg-japandi-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-japandi-500 uppercase tracking-widest">โปรโมชั่น</p>
                      <p className="font-bold text-japandi-900 mt-1">{selectedPromo.title}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                      (selectedPromo.redeem_mode || selectedPromo.redeemMode) === 'manual'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {(selectedPromo.redeem_mode || selectedPromo.redeemMode) === 'manual' ? 'รออนุมัติ' : 'แลกทันที'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-japandi-600 leading-relaxed">
                    {selectedPromo.description || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-japandi-200 p-4">
                    <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">แต้มที่ใช้</p>
                    <p className="mt-1 text-xl font-black text-japandi-900">{Number(selectedPromo.points_required).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-japandi-200 p-4">
                    <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">แต้มปัจจุบัน</p>
                    <p className="mt-1 text-xl font-black text-japandi-900">{Number(user.points).toLocaleString()}</p>
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${
                  Number(user.points) >= Number(selectedPromo.points_required)
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {Number(user.points) >= Number(selectedPromo.points_required)
                    ? selectedPromo.redeem_mode === 'manual' || selectedPromo.redeemMode === 'manual'
                      ? 'ร้านจะต้องกดยืนยันคำขอของคุณก่อนจึงจะใช้สิทธิ์ได้'
                      : 'ระบบจะตัดแต้มทันทีหลังคุณกดยืนยัน'
                    : 'แต้มของคุณยังไม่พอสำหรับรายการนี้'}
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={closeRedeemModal} disabled={!!redeemingPromoId}
                    className="flex-1 py-3 border border-japandi-200 rounded-2xl text-sm font-bold text-japandi-700 hover:bg-japandi-50 disabled:opacity-50">
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => void handleRedeem(selectedPromo)}
                    disabled={redeemingPromoId === selectedPromo.id || Number(user.points) < Number(selectedPromo.points_required)}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-japandi-800 hover:bg-japandi-900 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {redeemingPromoId === selectedPromo.id ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        กำลังดำเนินการ
                      </>
                    ) : (selectedPromo.redeem_mode || selectedPromo.redeemMode) === 'manual' ? (
                      'ส่งคำขอแลกแต้ม'
                    ) : (
                      'ยืนยันแลกสิทธิ์'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Redemption History */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest px-1 flex items-center gap-2">
            <Gift size={14} /> ประวัติแลกแต้ม
          </h3>
          {redemptionHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-japandi-100 text-center text-japandi-400 text-sm">
              ยังไม่มีประวัติแลกแต้ม
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-japandi-100 overflow-hidden">
              {redemptionHistory.slice(0, 5).map((h: any, i: number) => {
                const isCompleted = h.status === 'completed';
                const isRejected = h.status === 'rejected';
                return (
                  <div key={`${h.itemType || 'history'}-${h.id}`} className={`px-4 py-3 flex items-center justify-between ${i < redemptionHistory.length - 1 ? 'border-b border-japandi-50' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-50 text-green-600' : isRejected ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {isCompleted ? <CheckCircle size={14} /> : isRejected ? <XCircle size={14} /> : <Clock size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-japandi-900 truncate">{h.promotionTitle}</p>
                        <p className="text-[10px] text-japandi-400">
                          {new Date(h.occurredAt).toLocaleDateString('th-TH')}
                          {isRejected && h.reviewNote ? ` · ${h.reviewNote}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isCompleted ? 'text-green-600' : isRejected ? 'text-red-500' : 'text-amber-600'}`}>
                        {isCompleted ? '-' : ''}{Number(h.points).toLocaleString()} pts
                      </p>
                      <p className={`text-[10px] font-semibold ${isCompleted ? 'text-green-600' : isRejected ? 'text-red-500' : 'text-amber-600'}`}>
                        {isCompleted ? 'แลกสำเร็จ' : isRejected ? 'ถูกปฏิเสธ' : 'รออนุมัติ'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Point History */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest px-1 flex items-center gap-2">
            <BadgeCheck size={14} /> ประวัติคะแนน
          </h3>
          {earnedPointHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-japandi-100 text-center text-japandi-400 text-sm">
              ยังไม่มีประวัติคะแนน
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-japandi-100 overflow-hidden">
              {earnedPointHistory.slice(0, 5).map((item, i) => {
                const isExpired = !!item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
                const status = getPointHistoryStatus(item);
                return (
                  <div key={item.id} className={`px-4 py-3 flex items-center justify-between ${i < earnedPointHistory.length - 1 ? 'border-b border-japandi-50' : ''}`}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-japandi-900 truncate">
                        {item.note || 'แต้มสะสม'}
                      </p>
                      <p className="text-[10px] text-japandi-400 mt-0.5">
                        ได้ {formatDisplayDate(item.createdAt)} · หมดอายุ {item.expiresAt ? formatDisplayDate(item.expiresAt) : 'ไม่หมดอายุ'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
                        +{Number(item.points).toLocaleString()} pts
                      </p>
                      <p className={`text-[10px] font-semibold ${isExpired ? 'text-red-500' : item.pointsRemaining > 0 ? 'text-green-600' : 'text-japandi-400'}`}>
                        {status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order History */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest px-1 flex items-center gap-2">
            <History size={14} /> ประวัติรายการล่าสุด
          </h3>
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-japandi-100 text-center text-japandi-400 text-sm">
              ยังไม่มีรายการ
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-japandi-100 overflow-hidden">
              {orders.slice(0, 5).map((o: any, i: number) => (
                <div key={o.id} className={`px-4 py-3 flex items-center justify-between ${i < orders.length - 1 ? 'border-b border-japandi-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${o.status === 'paid' ? 'bg-green-50 text-green-600' : o.status === 'cancel' ? 'bg-red-50 text-red-400' : 'bg-amber-50 text-amber-600'}`}>
                      <Download size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-japandi-900 uppercase">{o.order_ref}</p>
                      <p className="text-[10px] text-japandi-400">{new Date(o.ordered_at).toLocaleDateString('th-TH')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-japandi-900">฿{Number(o.amount).toLocaleString()}</p>
                    <p className="text-[10px] font-bold" style={{ color: o.status === 'paid' ? cardColor : '#aaa' }}>
                      {o.status === 'paid' ? `+${getOrderPoints(o).toLocaleString()} pts` : o.status === 'cancel' ? 'ยกเลิก' : 'รอชำระ'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button onClick={() => nav(buildCompanyPath(`/liff/slip?lineId=${encodeURIComponent(lineId)}`, company))}
            className="py-3.5 bg-japandi-800 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-japandi-900 transition-colors">
            📷 ส่งสลิป
          </button>
          <button onClick={() => nav(buildCompanyPath(`/liff/register?lineId=${encodeURIComponent(lineId)}`, company))}
            className="py-3.5 bg-white border-2 border-japandi-200 text-japandi-800 rounded-2xl font-bold text-sm hover:bg-japandi-50 transition-colors">
            แก้ไขข้อมูล
          </button>
        </div>
      </div>
    </LiffLayout>
  );
}
