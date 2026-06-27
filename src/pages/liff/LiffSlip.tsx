import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { getLineDisplayName } from '../../lib/lineLiff';
import type { SlipAnalysisResult } from '../../types';
import { buildCompanyPath, getCurrentCompany } from '../../lib/company';

type Step = 'form' | 'preview' | 'success';

const MAX_IMAGE_DIMENSION = 1600;

function formatAmount(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return 'No amount yet';
  return `฿${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseAmountInput(value: string) {
  const normalized = String(value || '').replace(/,/g, '').trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
}

function getStatusMeta(status?: SlipAnalysisResult['verificationStatus']) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified slip',
        tone: 'bg-green-50 text-green-700 border-green-200',
        icon: ShieldCheck,
      };
    case 'duplicate':
      return {
        label: 'Duplicate slip',
        tone: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    case 'suspicious':
      return {
        label: 'Suspicious / possibly fake',
        tone: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'Could not read clearly',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertCircle,
      };
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(String(ev.target?.result || ''));
    reader.onerror = () => reject(new Error('Could not read the slip file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the slip image'));
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
  const company = getCurrentCompany();
  const fallbackLineId = params.get('lineId') || (import.meta.env.DEV ? DEMO_LINE_ID : '');
  const { lineId, loading: identityLoading, error: identityError, isAuto } = useLineIdentity(fallbackLineId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [tiers, setTiers] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [initErr, setInitErr] = useState('');

  const [slipImg, setSlipImg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SlipAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [slipAmountInput, setSlipAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (identityLoading) return;
    if (!lineId) {
      setInitErr(identityError || 'LINE ID not found');
      setInitLoading(false);
      return;
    }

    setInitLoading(true);
    setInitErr('');
    (async () => {
      try {
        const [users, tData] = await Promise.all([publicApi.getUsers(lineId, true), publicApi.getTiers()]);
        const found = users.find((u: any) => u.line_id === lineId);
        if (found) {
          setUser(found);
          setIsGuest(false);
        } else {
          // Not a member — can still submit a slip as a guest (but earns no points)
          setUser(null);
          setIsGuest(true);
          getLineDisplayName().then(name => { if (name) setGuestName(name); }).catch(() => {});
        }
        setTiers(tData);
      } catch {
        setInitErr('Something went wrong. Please try again.');
      } finally {
        setInitLoading(false);
      }
    })();
  }, [lineId, identityLoading, identityError]);

  useEffect(() => {
    if (!slipImg || !lineId || step !== 'preview') return;
    if (!user && !isGuest) return;

    let active = true;
    setAnalysisLoading(true);
    setAnalysisError('');
    setError('');
    setAnalysis(null);

    (async () => {
      try {
        const data = await publicApi.analyzeSlip({
          imageData: slipImg,
          userId: user?.id,
          lineId,
        });
        if (!active) return;
        setAnalysis(data);
        // Prefill the editable amount with the OCR suggestion (user confirms/edits before sending).
        if (data?.manualReview && data?.amount != null) {
          setSlipAmountInput(String(data.amount));
        }
      } catch (err: any) {
        if (!active) return;
        setAnalysisError(err.message || 'Could not read the slip');
      } finally {
        if (active) setAnalysisLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slipImg, user?.id, isGuest, lineId, step]);

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
        setSlipAmountInput('');
        setStep('preview');
      } catch (err: any) {
        setError(err.message || 'Could not read the slip file');
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
    setSlipAmountInput('');
    setError('');
    setResult(null);
    setNote('');
  };

  const handleSubmit = async () => {
    if (!user && !isGuest) return;
    const noteValue = note.trim() || 'Slip submitted via LINE';
    const tierConfig = user ? tiers.find(t => t.name === user.tier) : undefined;
    const bpp = parseFloat(tierConfig?.baht_per_point) || 10;
    const multiplier = parseFloat(tierConfig?.multiplier) || 1;
    const manualReview = Boolean(analysis?.manualReview);
    const verifiedAmount = Number(analysis?.amount) || 0;
    const manualAmount = parseAmountInput(slipAmountInput);
    const amount = manualReview ? (manualAmount || 0) : verifiedAmount;

    if (manualReview) {
      if (!manualAmount) {
        setError('Please enter the amount on the slip');
        return;
      }
    } else if (!analysis || !analysis.canProceed || analysis.verificationStatus !== 'verified' || !analysis.verificationToken || !analysis.amount) {
      setError(
        analysis?.verificationStatus === 'duplicate'
          ? 'This slip already exists. Please use a new slip.'
          : 'The slip is not verified yet. Please retake a clearer photo.'
      );
      return;
    }

    setLoading(true);
    setError('');
    try {
      const pointsEarned = isGuest ? 0 : Math.floor((amount / bpp) * multiplier);
      const identity = isGuest
        ? { lineId, guestName: guestName || undefined }
        : { userId: user.id };
      const order = await publicApi.createOrder(manualReview
        ? {
            ...identity,
            status: 'pending',
            note: noteValue,
            slipImageData: slipImg || undefined,
            slipAmount: amount,
            // carry QR-decoded metadata (present when the slip QR was read) for dedup + records
            slipReference: analysis?.referenceNumber ?? undefined,
            slipBank: analysis?.bank ?? undefined,
            slipTransactionDate: analysis?.transactionDate ?? undefined,
            slipTransactionTime: analysis?.transactionTime ?? undefined,
          }
        : {
            ...identity,
            status: 'pending',
            note: noteValue,
            slipVerificationToken: analysis?.verificationToken || undefined,
            slipImageData: slipImg || undefined,
          });

      setResult({ order, pointsEarned, amount, analysis, manualReview, isGuest });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const tierConfig = user && tiers.find(t => t.name === user.tier);
  const cardColor = tierConfig?.color || '#b9b99d';
  const bpp = parseFloat(tierConfig?.baht_per_point) || 10;
  const mult = parseFloat(tierConfig?.multiplier) || 1;
  const manualReviewMode = Boolean(analysis?.manualReview);
  const manualAmount = parseAmountInput(slipAmountInput);
  const displayedAmount = manualReviewMode ? manualAmount : analysis?.amount;
  const estPoints = (!isGuest && displayedAmount) ? Math.floor((displayedAmount / bpp) * mult) : 0;
  const canSubmit = Boolean(
    slipImg &&
    analysis &&
    !analysisLoading &&
    !loading &&
    (manualReviewMode ? manualAmount : (analysis.canProceed && analysis.verificationToken && analysis.amount))
  );

  if (identityLoading || initLoading) {
    return (
      <LiffLayout title="Submit Slip" subtitle={`${company.label} — Slip Upload`}>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-japandi-400">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm">Loading your membership from LINE...</p>
        </div>
      </LiffLayout>
    );
  }

  if (initErr) {
    return (
      <LiffLayout title="Submit Slip" subtitle={`${company.label} — Slip Upload`}>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
            <AlertCircle size={28} className="text-amber-500" />
          </div>
          <p className="text-japandi-700 font-semibold">{initErr}</p>
          <button
            onClick={() => { window.location.href = buildCompanyPath(`/liff/register${lineId ? `?lineId=${encodeURIComponent(lineId)}` : ''}`, company); }}
            className="py-3 px-6 bg-japandi-800 text-white rounded-2xl font-bold text-sm"
          >
            Register
          </button>
        </div>
      </LiffLayout>
    );
  }

  if (step === 'success') {
    const manualReview = Boolean(result?.manualReview);
    return (
      <LiffLayout title="Slip Submitted" subtitle={`${company.label} — Slip Sent`}>
        <div className="flex flex-col items-center py-8 gap-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="font-serif text-2xl font-semibold text-japandi-900">Slip Submitted!</h2>
          <p className="text-japandi-600 text-sm">
            {manualReview
              ? 'The store will verify the amount from your slip and confirm later.'
              : 'The amount was read automatically and queued for approval.'}
          </p>

          <div className="w-full bg-white rounded-2xl p-5 shadow-sm border border-japandi-100 space-y-3 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">Order No.</span>
              <span className="font-mono font-bold text-japandi-800 text-xs">{result?.order?.order_ref}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">Amount</span>
              <span className="font-bold text-japandi-900">{formatAmount(result?.amount)}</span>
            </div>
            {!result?.isGuest && (
              <div className="flex justify-between text-sm">
                <span className="text-japandi-500">Estimated Points</span>
                <span className="font-bold" style={{ color: cardColor }}>~{result?.pointsEarned} pts</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">Status</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                {manualReview ? 'Awaiting store review' : 'Pending verification'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <button
              onClick={resetSlip}
              className="py-3 bg-white border-2 border-japandi-200 text-japandi-800 rounded-2xl font-bold text-sm hover:bg-japandi-50"
            >
              Submit Another
            </button>
            <button
              onClick={() => { window.location.href = buildCompanyPath(`/liff/member?lineId=${encodeURIComponent(lineId)}`, company); }}
              className="py-3 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900"
            >
              Member Card
            </button>
          </div>
        </div>
      </LiffLayout>
    );
  }

  const statusMeta = analysis?.manualReview
    ? {
        label: 'Awaiting store review',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertCircle,
      }
    : getStatusMeta(analysis?.verificationStatus);
  const StatusIcon = statusMeta.icon;

  return (
    <LiffLayout
      title="Submit Slip"
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
                {user.tier} · {Number(user.points).toLocaleString()} pts
              </p>
            </div>
          </div>
        )}

        {isGuest && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs leading-relaxed text-amber-800">
            <span className="font-bold">Guest</span> (not a member yet) — you can still submit a slip, but you <span className="font-bold">won't earn points</span>. To collect points, please register first.
          </div>
        )}

        {step === 'form' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-japandi-100 overflow-hidden">
              <div className="p-5 border-b border-japandi-50">
                <h3 className="text-xs font-bold text-japandi-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Camera size={14} /> Upload Slip
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-6 bg-japandi-50 border-2 border-dashed border-japandi-200 rounded-2xl hover:border-japandi-400 hover:bg-japandi-100 transition-all"
                  >
                    <Camera size={28} className="text-japandi-500" />
                    <span className="text-xs font-bold text-japandi-600">Take Photo</span>
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
                    <span className="text-xs font-bold text-japandi-600">Choose from Album</span>
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-2xl border border-japandi-100 bg-japandi-50 px-4 py-3 text-sm text-japandi-600">
                  Once you pick a slip, the amount is read automatically and checked for duplicates/fakes. If AI isn't available, you'll enter the amount for manual review.
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
                <span className="text-xs font-bold text-japandi-600 uppercase tracking-widest">Slip Preview</span>
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
                <Receipt size={14} /> {manualReviewMode ? 'Store Review' : 'Automatic Slip Check'}
              </h3>

              {analysisLoading && (
                <div className="rounded-2xl border border-japandi-100 bg-japandi-50 px-4 py-5 flex items-center gap-3 text-japandi-600">
                  <Loader2 size={18} className="animate-spin" />
                  <div>
                    <p className="text-sm font-semibold">
                      {manualReviewMode ? 'Preparing slip for store review...' : 'Reading amount and verifying slip...'}
                    </p>
                    <p className="text-[11px] text-japandi-500">
                      {manualReviewMode ? 'Please enter the slip amount before sending' : "The amount can't be edited manually"}
                    </p>
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

                  {manualReviewMode ? (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-800 space-y-3">
                      {analysis.referenceNumber ? (
                        <>
                          <p className="font-semibold">✅ Slip verified via QR</p>
                          <div className="grid grid-cols-1 gap-1 text-[12px] text-amber-900/90">
                            {analysis.bank && <div>Bank: <span className="font-semibold">{analysis.bank}</span></div>}
                            {(analysis.transactionDate || analysis.transactionTime) && (
                              <div>Date/Time: <span className="font-semibold">{analysis.transactionDate || '-'}{analysis.transactionTime ? ` · ${analysis.transactionTime}` : ''}</span></div>
                            )}
                            <div className="break-all">Reference: <span className="font-mono">{analysis.referenceNumber}</span></div>
                          </div>
                          <p className="text-[12px]">The amount was read via OCR — <span className="font-bold">please check/correct it to match the slip</span> before sending.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">Manual review mode</p>
                          <p>The slip image will be sent to the store to verify the amount. Please enter the exact amount on the slip before sending.</p>
                        </>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest">Amount on slip (THB)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={slipAmountInput}
                          onChange={e => setSlipAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-japandi-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-japandi-50 px-4 py-3">
                          <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Amount Read</p>
                          <p className="mt-1 text-lg font-black text-japandi-900">{formatAmount(analysis.amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-japandi-50 px-4 py-3">
                          <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Confidence</p>
                          <p className="mt-1 text-lg font-black text-japandi-900">
                            {Math.round((analysis.confidence || 0) * 100)}%
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-japandi-100 px-4 py-3 flex items-center gap-3">
                          <Banknote size={16} className="text-japandi-500" />
                          <div>
                            <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Bank</p>
                            <p className="font-semibold text-japandi-900">{analysis.bank || 'Not found'}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-japandi-100 px-4 py-3 flex items-center gap-3">
                          <div>
                            <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Date / Time</p>
                            <p className="font-semibold text-japandi-900">
                              {analysis.transactionDate || 'Not found'}
                              {analysis.transactionTime ? ` · ${analysis.transactionTime}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-japandi-100 px-4 py-3 sm:col-span-2">
                          <p className="text-[11px] font-bold text-japandi-500 uppercase tracking-widest">Reference</p>
                          <p className="font-semibold text-japandi-900 mt-1">{analysis.referenceNumber || 'Not found'}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {analysis.warnings?.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-2">Notes</p>
                      <ul className="space-y-1 text-sm text-amber-700 list-disc list-inside">
                        {analysis.warnings.map(warning => <li key={warning}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  {!analysis.canProceed && !analysis.manualReview && analysis.verificationStatus === 'duplicate' && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      This slip has already been used. Please use a new slip, or ask the store to review a special case.
                    </div>
                  )}

                  {!analysis.canProceed && !analysis.manualReview && analysis.verificationStatus !== 'duplicate' && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      The slip isn't verified yet. Please retake the photo so the amount and details are clearly visible.
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
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">Note</label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. 2 cups of coffee"
                  className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50"
                />
              </div>

              {!isGuest && displayedAmount && displayedAmount > 0 && (
                <div className="bg-japandi-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-japandi-600 font-semibold">Points to earn</span>
                  <span className="font-black text-base" style={{ color: cardColor }}>~{estPoints} pts</span>
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-4 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Sending...</>
                : manualReviewMode
                  ? 'Send for Store Review'
                  : 'Submit Slip'}
            </button>
          </div>
        )}
      </div>
    </LiffLayout>
  );
}
