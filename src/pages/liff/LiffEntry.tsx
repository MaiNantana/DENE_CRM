import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, CreditCard, Loader2, Smartphone, UserPlus } from 'lucide-react';
import LiffLayout from './LiffLayout';
import { initializeLiff } from '../../lib/lineLiff';
import { publicApi } from '../../api';
import { useLineIdentity } from '../../hooks/useLineIdentity';
import { buildCompanyPath, getCurrentCompany } from '../../lib/company';

function getBootstrapTarget() {
  if (typeof window === 'undefined') return '';

  try {
    const rawState = new URLSearchParams(window.location.search).get('liff.state')?.trim() || '';
    if (!rawState) return '';

    let decoded = rawState;
    try {
      decoded = decodeURIComponent(rawState);
    } catch {
      // Keep the raw state if decoding fails.
    }

    const normalized = decoded.replace(/^\/+/, '');
    if (!normalized) return '';
    const company = getCurrentCompany();
    if (/^(DENE|Kefera)\//i.test(normalized)) return `/${normalized}`;
    if (normalized.startsWith('liff/')) return buildCompanyPath(`/${normalized}`, company);
    if (normalized.startsWith('admin/')) return buildCompanyPath(`/${normalized}`, company);
    if (normalized.startsWith('register') || normalized.startsWith('slip') || normalized.startsWith('member')) {
      return buildCompanyPath(`/liff/${normalized}`, company);
    }

    return normalized.startsWith('/') ? buildCompanyPath(normalized, company) : buildCompanyPath(`/liff/${normalized}`, company);
  } catch {
    return '';
  }
}

export default function LiffEntry() {
  const navigate = useNavigate();
  const target = getBootstrapTarget();
  const { lineId, loading: identityLoading } = useLineIdentity();
  const [memberExists, setMemberExists] = useState<boolean | null>(null);
  const [memberLookupLoading, setMemberLookupLoading] = useState(false);
  const company = getCurrentCompany();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await initializeLiff();
      } catch {
        // LIFF will still work in fallback mode; the leaf pages show their own errors.
      }

      if (!alive || !target) return;
      navigate(target, { replace: true });
    })();

    return () => {
      alive = false;
    };
  }, [navigate, target]);

  useEffect(() => {
    if (target) return;

    let alive = true;

    if (identityLoading || !lineId) {
      setMemberLookupLoading(false);
      setMemberExists(null);
      return () => {
        alive = false;
      };
    }

    setMemberLookupLoading(true);
    (async () => {
      try {
        const users = await publicApi.getUsers(lineId, true);
        if (!alive) return;
        setMemberExists(users.some((u: any) => u.line_id === lineId));
      } catch {
        if (!alive) return;
        setMemberExists(null);
      } finally {
        if (alive) setMemberLookupLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lineId, identityLoading, target]);

  const handleMemberAction = async () => {
    let exists = memberExists;

    if (exists === null && lineId) {
      setMemberLookupLoading(true);
      try {
        const users = await publicApi.getUsers(lineId, true);
        exists = users.some((u: any) => u.line_id === lineId);
        setMemberExists(exists);
      } catch {
        exists = false;
      } finally {
        setMemberLookupLoading(false);
      }
    }

    navigate(buildCompanyPath(exists ? '/liff/member' : '/liff/register', company));
  };

  if (target) {
    return (
      <LiffLayout title={`${company.label} Member`} subtitle="กำลังเปิดหน้าที่ถูกต้อง...">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Loader2 size={32} className="animate-spin text-japandi-500" />
          <p className="text-sm text-japandi-500 leading-relaxed">
            ระบบกำลังนำคุณไปยังหน้าที่ตรงกับลิงก์ที่กดจาก LINE
          </p>
        </div>
      </LiffLayout>
    );
  }

  return (
    <LiffLayout title={`${company.label} Member`} subtitle="เลือกเมนูที่ต้องการ" noPad>
      <div className="p-4 pb-8 space-y-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-japandi-100 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#06c755]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f8f49]">
            <Smartphone size={14} />
            {company.lineOaName}
          </div>
          <p className="text-sm leading-relaxed text-japandi-600">
            ถ้าเปิดจาก rich menu ระบบจะพาคุณไปยังหน้าที่เกี่ยวข้องโดยอัตโนมัติ
          </p>
        </div>

        <div className="grid gap-3">
          <Link to={buildCompanyPath('/liff/register', company)} className="rounded-2xl border border-japandi-200 bg-white px-4 py-4 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5">
            <div className="w-11 h-11 rounded-2xl bg-japandi-800 text-white flex items-center justify-center shrink-0">
              <UserPlus size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-japandi-900">สมัครสมาชิก</p>
              <p className="text-xs text-japandi-500">สร้างสมาชิกใหม่และดึง LINE ID อัตโนมัติ</p>
            </div>
            <ArrowRight size={18} className="text-japandi-400 shrink-0" />
          </Link>

          <Link to={buildCompanyPath('/liff/slip', company)} className="rounded-2xl border border-japandi-200 bg-white px-4 py-4 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5">
            <div className="w-11 h-11 rounded-2xl bg-[#06c755] text-white flex items-center justify-center shrink-0">
              <Camera size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-japandi-900">ส่งสลิป</p>
              <p className="text-xs text-japandi-500">อัปโหลดสลิปและส่งรายการชำระเงิน</p>
            </div>
            <ArrowRight size={18} className="text-japandi-400 shrink-0" />
          </Link>

          <button
            type="button"
            onClick={handleMemberAction}
            className="rounded-2xl border border-japandi-200 bg-white px-4 py-4 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5 text-left disabled:opacity-70"
            disabled={memberLookupLoading}
          >
            <div className="w-11 h-11 rounded-2xl bg-japandi-100 text-japandi-800 flex items-center justify-center shrink-0">
              {memberLookupLoading ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-japandi-900">บัตรสมาชิก</p>
              <p className="text-xs text-japandi-500">
                {memberLookupLoading
                  ? 'กำลังตรวจสอบสถานะสมาชิก...'
                  : memberExists
                    ? 'เปิดบัตรสมาชิกและดูแต้มของคุณ'
                    : 'ยังไม่พบข้อมูลสมาชิก กดเพื่อสมัครได้ทันที'}
              </p>
            </div>
            <ArrowRight size={18} className="text-japandi-400 shrink-0" />
          </button>
        </div>

        <div className="rounded-3xl border border-dashed border-japandi-200 bg-white/60 px-4 py-4 text-xs leading-relaxed text-japandi-500">
          <p className="font-semibold text-japandi-700">แยกเส้นทางชัดเจน</p>
          <p className="mt-1">
            แอดมินใช้ <span className="font-mono text-japandi-900">{buildCompanyPath('/admin', company)}</span> และหน้าสมาชิกใช้ <span className="font-mono text-japandi-900">{buildCompanyPath('/liff', company)}</span>
          </p>
        </div>
      </div>
    </LiffLayout>
  );
}
