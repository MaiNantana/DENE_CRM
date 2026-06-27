import { Link } from 'react-router-dom';
import { Building2, AlertTriangle } from 'lucide-react';
import { COMPANY_LIST } from '../lib/company';

export default function CompanyNotFound({ code }: { code: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-japandi-900 bg-[radial-gradient(circle_at_top_left,_rgba(184,184,157,0.22),_transparent_35%),linear-gradient(135deg,_#f7f4ee_0%,_#eef1ec_52%,_#e7ece6_100%)]">
      <div className="relative max-w-xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-lg">
          <AlertTriangle size={30} />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.35em] text-japandi-500">Company not found</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-semibold text-japandi-900">Store not found</h1>
        <p className="mt-4 text-base leading-relaxed text-japandi-600">
          No store found for the link <span className="font-mono font-bold text-japandi-900">/{code}</span>
          <br />Please check the spelling (e.g. <span className="font-mono">/kefera</span>, not <span className="font-mono">/kerfera</span>)
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 w-full">
          {COMPANY_LIST.map(company => (
            <Link
              key={company.code}
              reloadDocument
              to={`/${company.code}/admin`}
              className="rounded-2xl px-4 py-4 text-sm font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: company.accent }}
            >
              <Building2 size={18} />
              Enter {company.label}
            </Link>
          ))}
        </div>

        <Link to="/" reloadDocument className="mt-6 text-sm font-semibold text-japandi-600 hover:text-japandi-900">
          ← Back to store selection
        </Link>
      </div>
    </div>
  );
}
