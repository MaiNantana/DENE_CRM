import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, LogOut, UserCircle } from 'lucide-react';
import AdminDashboard from '../../components/AdminDashboard';
import { mockTiers } from '../../mockData';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { buildCompanyPath, getCompanyThemeStyle, getCurrentCompany } from '../../lib/company';

export default function AdminPage() {
  const [tiers, setTiers] = useState(mockTiers);
  const { user, logout } = useAdminAuth();
  const company = getCurrentCompany();
  const themeStyle = getCompanyThemeStyle(company);

  return (
    <div className="min-h-screen bg-japandi-50 text-japandi-900 flex flex-col" style={themeStyle}>
      <div className="bg-white/85 backdrop-blur-xl border-b border-japandi-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={buildCompanyPath('/admin')} className="inline-flex items-center gap-2 text-japandi-700 hover:text-japandi-900 transition-colors text-sm font-semibold">
            <ArrowLeft size={18} />
            {company.label} CRM
          </Link>

          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-japandi-200 bg-japandi-50 px-3 py-1 text-xs font-semibold text-japandi-700">
                <UserCircle size={14} />
                {user.displayName}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-japandi-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-japandi-500">
                <BadgeCheck size={12} />
                {user.role}
              </span>
              <button
                type="button"
                onClick={() => { void logout(); }}
                className="inline-flex items-center gap-2 rounded-full bg-japandi-800 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-japandi-900 transition-colors"
              >
                <LogOut size={14} />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <AdminDashboard tiers={tiers} setTiers={setTiers} role={user?.role || 'user'} />
      </div>
    </div>
  );
}
