import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import type { ReactNode } from 'react';
import { buildCompanyPath } from '../../lib/company';

export default function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(184,184,157,0.18),_transparent_35%),linear-gradient(135deg,_#f7f4ee_0%,_#eef1ec_52%,_#e7ece6_100%)]">
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-japandi-200 px-5 py-4 shadow-sm">
          <Loader2 size={18} className="animate-spin text-japandi-700" />
          <span className="text-sm font-medium text-japandi-700">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={buildCompanyPath('/admin/login')} replace />;
  }

  return <>{children}</>;
}
