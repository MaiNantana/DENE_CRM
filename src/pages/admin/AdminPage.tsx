import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, KeyRound, Loader2, LogOut, UserCircle, X } from 'lucide-react';
import AdminDashboard from '../../components/AdminDashboard';
import { mockTiers } from '../../mockData';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { buildCompanyPath, getCompanyThemeStyle, getCurrentCompany } from '../../lib/company';

export default function AdminPage() {
  const [tiers, setTiers] = useState(mockTiers);
  const { user, logout, changePassword } = useAdminAuth();
  const company = getCurrentCompany();
  const themeStyle = getCompanyThemeStyle(company);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const openPasswordModal = () => {
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError('');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('รหัสผ่านใหม่ควรมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      closePasswordModal();
    } catch (err: any) {
      setPasswordError(err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setPasswordLoading(false);
    }
  };

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
                onClick={openPasswordModal}
                className="inline-flex items-center gap-2 rounded-full border border-japandi-200 bg-white px-3 py-1.5 text-xs font-bold text-japandi-700 shadow-sm hover:bg-japandi-50 transition-colors"
              >
                <KeyRound size={14} />
                เปลี่ยนรหัสผ่าน
              </button>
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

      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePasswordModal} />
          <div className="relative w-full max-w-md rounded-3xl border border-japandi-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-japandi-900">เปลี่ยนรหัสผ่าน</h2>
                <p className="text-xs text-japandi-500 mt-1">บัญชีที่ล็อกอินอยู่: {user?.displayName}</p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                className="w-8 h-8 rounded-full bg-japandi-100 text-japandi-600 hover:bg-japandi-200 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                  placeholder="กรอกรหัสผ่านเดิม"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                  placeholder="พิมพ์ซ้ำอีกครั้ง"
                />
              </div>

              {passwordError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="flex-1 rounded-2xl border border-japandi-200 px-4 py-3 text-sm font-semibold text-japandi-700 hover:bg-japandi-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-japandi-800 px-4 py-3 text-sm font-bold text-white hover:bg-japandi-900 disabled:opacity-60"
                >
                  {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  บันทึกรหัสผ่าน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
