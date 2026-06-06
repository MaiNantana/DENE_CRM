import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, LayoutDashboard, Smartphone } from 'lucide-react';
import { buildCompanyPath, COMPANY_LIST, getCompanyByCode, getCompanyThemeStyle, normalizeCompanyCode, type CompanyConfig } from './lib/company';

function CompanyQuickLink({
  company,
  to,
  icon: Icon,
  title,
  text,
  tone,
}: {
  company: CompanyConfig;
  to: string;
  icon: typeof LayoutDashboard;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <Link
      reloadDocument
      to={to}
      className="group rounded-[1.75rem] border border-white/70 bg-white/85 backdrop-blur-xl p-5 md:p-6 shadow-[0_18px_50px_rgba(80,88,76,0.10)] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${tone}`}>
          <Icon size={22} />
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ borderColor: `${company.accent}33`, color: company.accent }}
        >
          {company.code}
        </span>
      </div>
      <div className="mt-6">
        <h3 className="text-xl font-black text-japandi-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-japandi-600">{text}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-japandi-100 pt-4">
        <span className="text-sm font-semibold" style={{ color: company.accent }}>
          เปิดลิงก์
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-japandi-100 text-japandi-700 transition-transform group-hover:translate-x-1">
          <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

function CompanyEntryCard({ company }: { company: CompanyConfig }) {
  return (
    <div
      className="rounded-[2rem] border border-white/70 bg-white/82 backdrop-blur-xl p-6 md:p-8 shadow-[0_24px_70px_rgba(80,88,76,0.12)]"
      style={{ boxShadow: `0 24px 70px color-mix(in srgb, ${company.accent} 10%, transparent)` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: company.accent }}>
          <Building2 size={26} />
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ borderColor: `${company.accent}33`, color: company.accent }}
        >
          /{company.code}
        </span>
      </div>
      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: company.accent }}>
          Company Entry
        </p>
        <h2 className="mt-3 text-3xl md:text-4xl font-black text-japandi-900">
          {company.label}
        </h2>
        <p className="mt-3 text-sm md:text-base leading-relaxed text-japandi-600">
          แยกเส้นทางสำหรับบริษัทนี้โดยเฉพาะ ทั้งหน้าแอดมินและ LINE OA / LIFF จะผูกกับบริษัทเดียวกัน
        </p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link
          reloadDocument
          to={buildCompanyPath('/admin', company)}
          className="rounded-2xl px-4 py-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2"
          style={{ backgroundColor: company.accent }}
        >
          <LayoutDashboard size={18} />
          เข้า Admin
        </Link>
        <Link
          reloadDocument
          to={buildCompanyPath('/liff', company)}
          className="rounded-2xl border px-4 py-4 text-sm font-semibold transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          style={{ borderColor: `${company.accent}30`, color: company.accent, backgroundColor: `${company.softAccent}26` }}
        >
          <Smartphone size={18} />
          เปิด LIFF
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link reloadDocument to={buildCompanyPath('/liff/register', company)} className="rounded-2xl border border-japandi-200/80 bg-white/70 px-4 py-3 text-sm font-semibold text-japandi-700 shadow-sm transition-colors hover:bg-white">
          สมัครสมาชิก
        </Link>
        <Link reloadDocument to={buildCompanyPath('/liff/slip', company)} className="rounded-2xl border border-japandi-200/80 bg-white/70 px-4 py-3 text-sm font-semibold text-japandi-700 shadow-sm transition-colors hover:bg-white">
          ส่งสลิป
        </Link>
        <Link reloadDocument to={buildCompanyPath('/liff/member', company)} className="rounded-2xl border border-japandi-200/80 bg-white/70 px-4 py-3 text-sm font-semibold text-japandi-700 shadow-sm transition-colors hover:bg-white">
          บัตรสมาชิก
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  const params = useParams();
  const rawCompanyCode = String(params.companyCode || '').trim();
  const normalizedCode = normalizeCompanyCode(rawCompanyCode);
  const hasCompanyPath = Boolean(rawCompanyCode) && rawCompanyCode.toLowerCase() === normalizedCode.toLowerCase();
  const company = hasCompanyPath ? getCompanyByCode(normalizedCode) : null;
  const themeStyle = company ? getCompanyThemeStyle(company) : undefined;
  const keferaQuickLinkTone = 'bg-[#8b5e3c]';
  const keferaQuickLinkSoftTone = 'bg-[#a8734d]';

  return (
    <div
      className="relative min-h-screen overflow-hidden text-japandi-900 bg-[radial-gradient(circle_at_top_left,_rgba(184,184,157,0.22),_transparent_35%),linear-gradient(135deg,_#f7f4ee_0%,_#eef1ec_52%,_#e7ece6_100%)]"
      style={themeStyle}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-12%] left-[-10%] w-[24rem] h-[24rem] rounded-full bg-japandi-200/50 blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-japandi-sage/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-white/40 blur-2xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-10 lg:py-16">
        <div className="inline-flex items-center gap-3 rounded-full border border-japandi-200 bg-white/75 backdrop-blur-xl px-4 py-2 shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-japandi-700" />
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-japandi-500">
            {company ? `${company.label} Gateway` : 'CRM Gateway'}
          </span>
        </div>

        <div className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-japandi-500">
            {company ? `Company ${company.code}` : 'Choose company'}
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight text-japandi-900">
            {company ? `ทางเข้า ${company.label}` : 'เลือกบริษัทที่ต้องการใช้งาน'}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-japandi-600 max-w-2xl">
            {company
              ? `ลิงก์ชุดนี้ผูกกับ ${company.label} โดยตรง ทั้งแอดมินและหน้าสมาชิก LINE OA จะแยกจากบริษัทอื่น`
              : 'ระบบนี้ใช้ฐานข้อมูลชุดเดียว แต่แยกทุกข้อมูลตามบริษัท คุณสามารถเข้าผ่านลิงก์ของบริษัทที่ต้องการได้ทันที'}
          </p>
        </div>

        {company ? (
          <div className="mt-10 space-y-6">
            <CompanyEntryCard company={company} />
            <div className="rounded-3xl border border-dashed border-japandi-200 bg-white/60 px-4 py-4 text-xs leading-relaxed text-japandi-500">
              <p className="font-semibold text-japandi-700">ลิงก์บริษัทนี้</p>
              <p className="mt-1">
                แอดมินใช้ <span className="font-mono text-japandi-900">{buildCompanyPath('/admin', company)}</span> และหน้าสมาชิกใช้ <span className="font-mono text-japandi-900">{buildCompanyPath('/liff', company)}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {COMPANY_LIST.map(item => (
                <div key={item.code}>
                  <CompanyEntryCard company={item} />
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {COMPANY_LIST.map(item => (
                <div key={item.code} className="rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur-xl p-6 md:p-8 shadow-[0_24px_70px_rgba(80,88,76,0.12)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: item.accent }}>
                      <Building2 size={26} />
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
                      style={{ borderColor: `${item.accent}33`, color: item.accent }}
                    >
                      {item.lineOaName}
                    </span>
                  </div>
                  <div className="mt-8">
                    <h2 className="text-2xl md:text-3xl font-black text-japandi-900">{item.label}</h2>
                    <p className="mt-3 text-sm md:text-base leading-relaxed text-japandi-600 max-w-md">
                      ลิงก์แยกสำหรับบริษัทนี้ จะพาไปยังหน้าแอดมินและ LIFF ที่ผูกกับ Line OA ของ {item.label}
                    </p>
                  </div>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <CompanyQuickLink
                      company={item}
                      to={buildCompanyPath('/admin', item)}
                      icon={LayoutDashboard}
                      title="Admin"
                      text="จัดการสมาชิก ออเดอร์ โปรโมชั่น และทีมงาน"
                      tone={item.code === 'Kefera' ? keferaQuickLinkTone : 'bg-japandi-800'}
                    />
                    <CompanyQuickLink
                      company={item}
                      to={buildCompanyPath('/liff', item)}
                      icon={Smartphone}
                      title="LINE Member"
                      text="สมัครสมาชิก ส่งสลิป และดูบัตรสมาชิก"
                      tone={item.code === 'Kefera' ? keferaQuickLinkSoftTone : 'bg-[#06c755]'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
