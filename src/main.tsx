import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
import App from './App.tsx';
import CompanyNotFound from './components/CompanyNotFound.tsx';
import { isKnownCompanyCode } from './lib/company.ts';
import AdminGate from './components/admin/AdminGate.tsx';
import AdminPage from './pages/admin/AdminPage.tsx';
import AdminLoginPage from './pages/admin/AdminLoginPage.tsx';
import LiffEntry from './pages/liff/LiffEntry.tsx';
import LiffMember   from './pages/liff/LiffMember.tsx';
import LiffRegister from './pages/liff/LiffRegister.tsx';
import LiffSlip     from './pages/liff/LiffSlip.tsx';
import { AdminAuthProvider } from './hooks/useAdminAuth.tsx';
import DocumentTitle from './components/DocumentTitle.tsx';
import './index.css';

// Reject typo'd / unknown company codes (e.g. /kerfera) instead of silently showing DENE.
function RequireCompany({ children }: { children: ReactNode }) {
  const { companyCode } = useParams();
  if (!isKnownCompanyCode(companyCode)) return <CompanyNotFound code={companyCode || ''} />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminAuthProvider>
      <BrowserRouter>
        <DocumentTitle />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/:companyCode" element={<App />} />

          <Route path="/admin" element={<Navigate to="/DENE/admin" replace />} />
          <Route path="/admin/login" element={<Navigate to="/DENE/admin/login" replace />} />
          <Route path="/liff" element={<Navigate to="/DENE/liff" replace />} />
          <Route path="/liff/member" element={<Navigate to="/DENE/liff/member" replace />} />
          <Route path="/liff/register" element={<Navigate to="/DENE/liff/register" replace />} />
          <Route path="/liff/slip" element={<Navigate to="/DENE/liff/slip" replace />} />

          <Route path="/:companyCode/admin/login" element={<RequireCompany><AdminLoginPage /></RequireCompany>} />
          <Route path="/:companyCode/admin" element={<RequireCompany><AdminGate><AdminPage /></AdminGate></RequireCompany>} />
          <Route path="/:companyCode/liff" element={<RequireCompany><LiffEntry /></RequireCompany>} />
          <Route path="/:companyCode/liff/member" element={<RequireCompany><LiffMember /></RequireCompany>} />
          <Route path="/:companyCode/liff/register" element={<RequireCompany><LiffRegister /></RequireCompany>} />
          <Route path="/:companyCode/liff/slip" element={<RequireCompany><LiffSlip /></RequireCompany>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  </StrictMode>,
);
