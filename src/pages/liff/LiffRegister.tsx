import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CheckCircle, Loader2 } from 'lucide-react';
import LiffLayout from './LiffLayout';
import { publicApi } from '../../api';
import { useLineIdentity } from '../../hooks/useLineIdentity';
import { resolveLineUserId } from '../../lib/lineLiff';
import { buildCompanyPath, getCurrentCompany } from '../../lib/company';

type Step = 'form' | 'success';

export default function LiffRegister() {
  const nav = useNavigate();
  const { lineId, loading: lineLoading, error: lineError } = useLineIdentity();
  const company = getCurrentCompany();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ name: '', phone: '', birthday: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState<any>(null);

  const set = (k: 'name' | 'phone' | 'birthday' | 'email', v: string) => { setForm(p => ({ ...p, [k]: v })); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let effectiveLineId = lineId.trim();
    if (!effectiveLineId) {
      const resolved = await resolveLineUserId();
      effectiveLineId = resolved.lineId.trim();
    }
    if (!effectiveLineId) { setError(lineError || 'กรุณาเปิดหน้านี้ผ่าน LINE เพื่อดึง LINE ID อัตโนมัติ'); return; }
    if (!form.name.trim())   { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    setLoading(true); setError('');
    try {
      const user = await publicApi.createUser({
        lineId:   effectiveLineId,
        name:     form.name.trim(),
        phone:    form.phone    || undefined,
        birthday: form.birthday || undefined,
        email:    form.email    || undefined,
      });
      setCreatedUser(user);
      setStep('success');
    } catch (err: any) {
      setError(err.message?.includes('Duplicate') ? 'Line ID นี้สมัครสมาชิกแล้ว' : (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
    } finally { setLoading(false); }
  };

  if (step === 'success') {
    return (
      <LiffLayout title="สมัครสมาชิกสำเร็จ" subtitle={`${company.label} Member`}>
        <div className="flex flex-col items-center py-10 gap-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-japandi-900">ยินดีต้อนรับ!</h2>
          <p className="text-japandi-600">คุณ <span className="font-bold">{createdUser?.name}</span> สมัครสมาชิกเรียบร้อยแล้ว</p>

          <div className="w-full bg-white rounded-2xl p-5 shadow-sm border border-japandi-100 text-left space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">ระดับ</span>
              <span className="font-bold text-japandi-800">Standard</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">คะแนนเริ่มต้น</span>
              <span className="font-bold text-japandi-800">0 แต้ม</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-japandi-500">Line ID</span>
              <span className="font-bold text-japandi-800">{createdUser?.line_id}</span>
            </div>
          </div>

          <button onClick={() => nav(buildCompanyPath('/liff/member'))}
            className="w-full py-3.5 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900 transition-colors shadow-md mt-2">
            ดูบัตรสมาชิก →
          </button>
        </div>
      </LiffLayout>
    );
  }

  return (
    <LiffLayout title="สมัครสมาชิก" subtitle={`${company.label} CRM — Register`}>
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 py-2">
        {lineLoading && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
            กำลังอ่าน LINE ID อัตโนมัติ...
          </div>
        )}

        {!lineLoading && lineId && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            ใช้ LINE ID อัตโนมัติแล้ว: <span className="font-mono font-bold">{lineId}</span>
          </div>
        )}

        {lineError && !lineLoading && !lineId && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            {lineError}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-japandi-800/10 border border-japandi-800/20 rounded-2xl p-4 flex gap-3">
          <UserPlus size={20} className="text-japandi-800 shrink-0 mt-0.5" />
          <p className="text-sm text-japandi-700 leading-relaxed">
            กรอกข้อมูลเพื่อสมัครสมาชิก {company.label} ระบบจะดึง LINE ID จาก LIFF อัตโนมัติเมื่อเปิดผ่าน LINE
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-japandi-100 space-y-4">
          <Field label="ชื่อ-นามสกุล" required>
            <input
              name="member_name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="ชื่อ-นามสกุลของคุณ"
              autoComplete="new-password"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50" />
          </Field>

          <Field label="เบอร์โทรศัพท์">
            <input
              name="member_phone"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              type="tel"
              autoComplete="tel"
              autoCorrect="off"
              inputMode="tel"
              placeholder="08X-XXX-XXXX"
              className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50" />
          </Field>

          <Field label="วันเกิด">
            <input
              name="member_birthday"
              value={form.birthday}
              onChange={e => set('birthday', e.target.value)}
              type="date"
              autoComplete="bday"
              className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50" />
          </Field>

          <Field label="อีเมล (ไม่บังคับ)">
            <input
              name="member_email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder="example@email.com"
              className="w-full border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 bg-japandi-50" />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-4 bg-japandi-800 text-white rounded-2xl font-bold text-sm hover:bg-japandi-900 transition-colors shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={16} className="animate-spin" />กำลังสมัคร...</> : 'ยืนยันการสมัครสมาชิก'}
        </button>

        <p className="text-center text-[11px] text-japandi-400 leading-relaxed">
          การกดยืนยัน หมายถึงคุณยอมรับข้อตกลง<br />และเงื่อนไขการให้บริการของ {company.label}
        </p>
      </form>
    </LiffLayout>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-japandi-600 uppercase tracking-widest">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
