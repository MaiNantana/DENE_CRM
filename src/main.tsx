import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
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

          <Route path="/:companyCode/admin/login" element={<AdminLoginPage />} />
          <Route path="/:companyCode/admin" element={<AdminGate><AdminPage /></AdminGate>} />
          <Route path="/:companyCode/liff" element={<LiffEntry />} />
          <Route path="/:companyCode/liff/member" element={<LiffMember />} />
          <Route path="/:companyCode/liff/register" element={<LiffRegister />} />
          <Route path="/:companyCode/liff/slip" element={<LiffSlip />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  </StrictMode>,
);
