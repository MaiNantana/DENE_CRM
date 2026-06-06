import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle,
  Loader2,
  Receipt,
  ShieldCheck,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import LiffLayout from './LiffLayout';
import { publicApi } from '../../api';
import { DEMO_LINE_ID } from '../../constants';
import { useLineIdentity } from '../../hooks/useLineIdentity';
import type { SlipAnalysisResult } from '../../types';
import { buildCompanyPath, getCurrentCompany } from '../../lib/company';

type Step = 'form' | 'preview' | 'success';

const MAX_IMAGE_DIMENSION = 1600;

function formatAmount(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return 'ยังไม่พบยอด';
  return `฿${Number(amount).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusMeta(status?: SlipAnalysisResult['verificationStatus']) {
  switch (status) {
    case 'verified':
      return {
        label: 'ตรวจพบสลิปจริง',
        tone: 'bg-green-50 text-green-700 border-green-200',
        icon: ShieldCheck,
      };
    case 'suspicious':
      return {
        label: 'น่าสงสัย / อาจปลอม',
        tone: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'อ่านได้ไม่ชัดเจน',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertCircle,
      };
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(String(ev.target?.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์สลิปได้'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปสลิปได้'));
    img.src = src;
  });
}

async function optimizeSlipImage(file: File) {
  const original = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return original;

  try {
    const img = await loadImage(original);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return original;

    const longestSide = Math.max(width, height);
    if (longestSide <= MAX_IMAGE_DIMENSION && file.size <= 1.8 * 1024 * 1024) {
      return original;
    }

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / longestSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return original;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return original;
  }
}

export default function LiffSlip() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const company = getCurrentCompany();
  const fallbackLineId = params.get('lineId') || (import.meta.env.DEV ? DEMO_LINE_ID : '');
  const { lineId, loading: identityLoading, error: identityError, isAuto } = useLineIdentity(fallbackLineId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [initErr, setInitErr] = useState('');

  const [slipImg, setSlipImg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SlipAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (identityLoading) return;
    if (!lineId) {
      setInitErr(identityError || 'ไม่พบ Line ID');
      setInitLoading(false);
      return;
    }

    setInitLoading(true);
    setInitErr('');
    (async () => {
      try {
        const [users, tData] = await Promise.all([publicApi.getUsers(lineId, true), publicApi.getTiers()]);
        const found = users.find((u: any) => u.line_id === lineId);
        if (!found) {
          setInitErr('กรุณาสมัครสมาชิกก่อนส่งสลิป');
          return;
        }
        setUser(found);
        setTiers(tData);
      } catch {
        setInitErr('เกิดข้อผิดพลาด กรุณาลองใหม่');
      } finally {
        setInitLoading(false);
      }
    })();
  }, [lineId, identityLoading, identityError]);

  useEffect(() => {
    if (!slipImg || !user || !lineId || step !== 'preview') return;

    let active = true;
    setAnalysisLoading(true);
    setAnalysisError('');
    setError('');
    setAnalysis(null);

    (async () => {
      try {
        const data = await publicApi.analyzeSlip({
          imageData: slipImg,
          userId: user.id,
          lineId,
        });
        if (!active) return;
        setAnalysis(data);
      } catch (err: any) {
        if (!active) return;
        setAnalysisError(err.message || 'ไม่สามารถอ่านสลิปได้');
      } finally {
        if (active) setAnalysisLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slipImg, user?.id, lineId, step]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    void (async () => {
      try {
        setError('');
        setAnalysisError('');
        setAnalysis(null);
        setResult(null);
        const optimizedDataUrl = await optimizeSlipImage(file);
        setSlipImg(optimizedDataUrl);
        setStep('preview');
      } catch (err: any) {
        setError(err.message || 'ไม่สามารถอ่านไฟล์สลิปได้');
      } finally {
        e.target.value = '';
      }
    })();
  };

  const resetSlip = () => {
    setStep('form');
    setSlipImg(null);
    setAnalysis(null);
    setAnalysisLoading(false);
    setAnalysisError('');
    setError('');
    setResult(null);
    setNote('');
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!analysis || !analysis.canProceed || analysis.verificationStatus !== 'verified' || !analysis.verificationToken || !analysis.amount) {
      setError('สลิปยังไม่ผ่านการตรวจสอบ กรุณาถ่ายใหม่ให้ชัดเจน');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const tierConfig = tiers.find(t => t.name === user.tier);
      const bpp = parseFloat(tierConfig?.baht_per_point) || 10;
      const multiplier = parseFloat(tierConfig?.multiplier) || 1;
      const amount = Number(analysis.amount) || 0;
      const pointsEarned = Math.floor((amount / bpp) * multiplier);
      const noteValue = note.trim() || 'ส่งสลิปผ่าน LINE';

      const order = await publicApi.createOrder({
        userId: user.id,
        status: 'pending',
        note: noteValue,
        slipVerificationToken: analysis.verificationToken,
      });

      setResult({ order, pointsEarned, amount, analysis });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const tierConfig = user && tiers.find(t => t.name === user.tier);
  const cardColor = tierConfig?.color || '#b9b99d';
  const bpp = parseFloat(tierConfig?.baht_per_point) || 10;
  const mult = parseFloat(tierConfig?.multiplier) || 1;
  const estPoints = analysis?.amount ? Math.floor((analysis.amount / bpp) * mult) : 0;
  const canSubmit = Boolean(analysis && analysis.canProceed && analysis.verificationToken && !analysisLoading && !loading);

  if (identityLoading || initLoading) {
    return (
      <LiffLayout title="ส่งสลิป" subtitle={`${company.label} — Slip Upload`}>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-japandi-400">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm">กำลังอ่านข้อมูลสมาชิกจาก LINE...</p>
        </div>
      </LiffLayout>
    );
  }

  if (initErr) {
    return (
      <LiffLayout title="ส่งสลิป" subtitle={`${company.label} — Slip Upload`}>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
            <AlertCircle size={28} className="text-amber-500" />
          </div>
          <p className="text-japandi-700 font-semibold">{initErr}</p>
          <button
            onClick={() => nav(buildCompanyPath(`/liff/register${lineId ? `?lineId=${encodeURIComponent(lineId)}` : ''}`, company))}
            className="py-3 px-6 bg-japandi-800 text-white rounded-2xl font-bold text-sm"
          >
            สมัครสมาชิก
          </button>
        </div>
      </LiffLayout>
    );
  }

  if (step === 'success') {
    return (
      <LiffLayout title="ส่งสลิปสำเร็จ" subtitle={`${company.label} — Slip Sent`}>
        <div className="flex flex-col items-center py-8 gap-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-japandi-900">ส่งสลิปเรียบร้อย!</h2>
          <p className="text-japandi-600 text-sm">ระบบอ่านยอดอัตโนมัติแล้ว และส่งรายการเข้าแถวรออนุมัติ</p>

          <div className="w-full bg-white rounded-2xl p-5 shadow-sm border border-japandi-100 space-y-3 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">เลขที่ออเดอร์</span>
              <span className="font-mono font-bold text-japandi-800 text-xs">{result?.order?.order_ref}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">ยอดชำระ</span>
              <span className="font-bold text-japandi-900">{formatAmount(result?.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">แต้มโดยประมาณ</span>
              <span className="font-bold" style={{ color: cardColor }}>~{result?.pointsEarned} แต้ม</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">สถานะ</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">รอตรวจสอบ</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <button
              onClick={resetSlip}
              className="py-3 bg-white border-2 border-japandi-200 text-japandi-800 rounded-2xl font-bold text-sm hover:bg-japandi-50"
            >
              ส่งสลิปอีกใบ
            </button>
            <button
              onClick={() => nav(buildCompanyPath(`/liff/member?lineId=${encodeURIComponent(lineId)}`, company))}
              className="py-3 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900"
            >
              ดูบัตรสมาชิก
            </button>
          </div>
        </div>
      </LiffLayout>
    );
  }

  const statusMeta = getStatusMeta(analysis?.verificationStatus);
  const StatusIcon = statusMeta.icon;

  return (
    <LiffLayout
      title="ส่งสลิป"
      subtitle={`${company.label} — Slip Upload`}
      onBack={step === 'preview' ? resetSlip : undefined}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      <div className="space-y-4 py-2">
        {identityError && !isAuto && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-3 text-xs leading-relaxed">
            {identityError}
          </div>
        )}

        {user && (
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-japandi-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full shrink-0" style={{ backgroundColor: cardColor }} />
            <div>
              <p className="font-bold text-japandi-900 text-sm">{user.name}</p>
              <p className="text-[11px] text-japandi-500">
                {user.tier} · {Number(user.points).toLocaleString()} แต้ม
              </p>
            </div>
          </div>
        )}

        {step === 'form' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-japandi-100 overflow-hidden">
              <div className="p-5 border-b border-japandi-50">
                <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Camera size={14} /> อัปโหลดสลิป
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-6 bg-japandi-50 border-2 border-dashed border-japandi-200 rounded-2xl hover:border-japandi-400 hover:bg-japandi-100 transition-all"
                  >
                    <Camera size={28} className="text-japandi-500" />
                    <span className="text-xs font-bold text-japandi-600">ถ่ายรูป</span>
                  </button>
                  <button
                    onClick={() => {
                      if (fileRef.current) {
                        fileRef.current.removeAttribute('capture');
                        fileRef.current.click();
                      }
                    }}
                    className="flex flex-col items-center gap-2 py-6 bg-japandi-50 border-2 border-dashed border-japandi-200 rounded-2xl hover:border-japandi-400 hover:bg-japandi-100 transition-all"
                  >
                    <ImageIcon size={28} className="text-japandi-500" />
                    <span className="text-xs font-bold text-japandi-600">เลือกจากอัลบั้ม</span>
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-2xl border border-japandi-100 bg-japandi-50 px-4 py-3 text-sm text-japandi-600">
                  หลังเลือกสลิป ระบบจะอ่านยอดและตรวจความน่าเชื่อถือให้อัตโนมัติ
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
          </>
        )}

        {step === 'preview' && slipImg && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-japandi-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-japandi-50">
                <span className="text-xs font-bold text-japandi-600 uppercase tracking-widest">ตัวอย่างสลิป</span>
                <button
                  onClick={resetSlip}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-japandi-100 hover:bg-japandi-200 text-japandi-600"
                >
                  <X size={14} />
                </button>
              </div>
              <img src={slipImg} alt="slip" className="w-full max-h-80 object-contain bg-japandi-50" />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-japandi-100 space-y-4">
              <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest flex items-center gap-2">
                <Receipt size={14} /> ผลตรวจสลิปอัตโนมัติ
              </h3>

              {analysisLoading && (
                <div className="rounded-2xl border border-japandi-100 bg-japandi-50 px-4 py-5 flex items-center gap-3 text-japandi-600">
                  <Loader2 size={18} className="animate-spin" />
                  <div>
                    <p className="text-sm font-semibold">กำลังอ่านยอดและตรวจสอบสลิป...</p>
                    <p className="text-[11px] text-japandi-500">ระบบจะไม่ให้แก้ไขยอดเอง</p>
                  </div>
                </div>
              )}

              {!analysisLoading && analysis && (
                <div className="space-y-3">
                  <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${statusMeta.tone}`}>
                    <StatusIcon size={18} />
                    <div>
                      <p className="text-sm font-bold">{statusMeta.label}</p>
                      <p className="text-[11px] opacity-80">{analysis.summary}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-japandi-50 px-4 py-3">
                      <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">ยอดที่อ่านได้</p>
                      <p className="mt-1 text-lg font-black text-japandi-900">{formatAmount(analysis.amount)}</p>
                    </div>
                    <div className="rounded-2xl bg-japandi-50 px-4 py-3">
                      <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">ความมั่นใจ</p>
                      <p className="mt-1 text-lg font-black text-japandi-900">
                        {Math.round((analysis.confidence || 0) * 100)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-japandi-100 px-4 py-3 flex items-center gap-3">
                      <Banknote size={16} className="text-japandi-500" />
                      <div>
                        <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">ธนาคาร</p>
                        <p className="font-semibold text-japandi-900">{analysis.bank || 'ไม่พบ'}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-japandi-100 px-4 py-3 flex items-center gap-3">
                      <div>
                        <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">วัน / เวลา</p>
                        <p className="font-semibold text-japandi-900">
                          {analysis.transactionDate || 'ไม่พบ'}
                          {analysis.transactionTime ? ` · ${analysis.transactionTime}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-japandi-100 px-4 py-3 sm:col-span-2">
                      <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Reference</p>
                      <p className="font-semibold text-japandi-900 mt-1">{analysis.referenceNumber || 'ไม่พบ'}</p>
                    </div>
                  </div>

                  {analysis.warnings?.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-2">ข้อสังเกต</p>
                      <ul className="space-y-1 text-sm text-amber-700 list-disc list-inside">
                        {analysis.warnings.map(warning => <li key={warning}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  {!analysis.canProceed && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      สลิปยังไม่ผ่านการตรวจสอบ กรุณาถ่ายใหม่ให้เห็นยอดและรายละเอียดชัดเจน
                    </div>
                  )}
                </div>
              )}

              {!analysisLoading && analysisError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {analysisError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">หมายเหตุ</label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="เช่น ซื้อกาแฟ 2 แก้ว"
                  className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50"
                />
              </div>

              {analysis?.amount && analysis.amount > 0 && (
                <div className="bg-japandi-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-japandi-600 font-semibold">แต้มที่จะได้รับ</span>
                  <span className="font-black text-base" style={{ color: cardColor }}>~{estPoints} แต้ม</span>
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-4 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />กำลังส่ง...</> : 'ยืนยันส่งสลิป'}
            </button>
          </div>
        )}
      </div>
    </LiffLayout>
  );
}
