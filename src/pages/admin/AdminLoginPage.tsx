import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockKeyhole, Loader2, ShieldCheck, Sparkles, Users, BadgeCheck } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { buildCompanyPath, getCompanyThemeStyle, getCurrentCompany } from '../../lib/company';

type Mode = 'login' | 'bootstrap';

export default function AdminLoginPage() {
  const nav = useNavigate();
  const { user, hasStaff, loading, login, bootstrap } = useAdminAuth();
  const company = getCurrentCompany();
  const themeStyle = getCompanyThemeStyle(company);
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) nav(buildCompanyPath('/admin'), { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (!hasStaff) setMode('bootstrap');
  }, [hasStaff]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้');
      return;
    }

    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }

    if (mode === 'bootstrap') {
      if (!displayName.trim()) {
        setError('กรุณากรอกชื่อที่แสดง');
        return;
      }
      if (password.length < 8) {
        setError('รหัสผ่านควรมีอย่างน้อย 8 ตัวอักษร');
        return;
      }
      if (password !== confirmPassword) {
        setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'bootstrap') {
        await bootstrap({ displayName: displayName.trim(), username: username.trim(), password });
      } else {
        await login(username.trim(), password);
      }
      nav(buildCompanyPath('/admin'), { replace: true });
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(184,184,157,0.18),_transparent_35%),linear-gradient(135deg,_#f7f4ee_0%,_#eef1ec_52%,_#e7ece6_100%)]" style={themeStyle}>
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-japandi-200 px-5 py-4 shadow-sm">
          <Loader2 size={18} className="animate-spin text-japandi-700" />
          <span className="text-sm font-medium text-japandi-700">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={buildCompanyPath('/admin')} replace />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(184,184,157,0.18),_transparent_35%),linear-gradient(135deg,_#f7f4ee_0%,_#eef1ec_52%,_#e7ece6_100%)] text-japandi-900" style={themeStyle}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-12%] left-[-10%] w-[24rem] h-[24rem] rounded-full bg-japandi-200/50 blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-japandi-sage/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-white/40 blur-2xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-10 lg:py-16 min-h-screen flex items-center">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 w-full items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-japandi-200 bg-white/75 backdrop-blur-xl px-4 py-2 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-japandi-700" />
              <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-japandi-500">{company.label} Access</span>
            </div>

            <h1 className="mt-8 text-4xl md:text-6xl font-black tracking-tight text-japandi-900">
              ระบบแอดมินของ {company.label}
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-japandi-600 max-w-2xl">
              เข้าสู่ระบบด้วยบัญชีที่กำหนดสิทธิ์ไว้ชัดเจน
              <span className="font-semibold text-japandi-800"> admin</span>,
              <span className="font-semibold text-japandi-800"> manager</span>,
              และ <span className="font-semibold text-japandi-800"> user</span>
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: 'ความปลอดภัย', text: 'ใช้บัญชี staff แยกจากสมาชิก LINE' },
                { icon: BadgeCheck, title: 'สิทธิ์ชัดเจน', text: 'กำหนด role ได้ 3 ระดับ' },
                { icon: Users, title: 'จัดการง่าย', text: 'สร้างและปิดใช้งานบัญชีได้จากระบบ' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl p-4 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-japandi-800 text-white">
                    <Icon size={20} />
                  </div>
                  <p className="mt-3 font-bold text-japandi-900">{title}</p>
                  <p className="mt-1 text-sm text-japandi-600">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 backdrop-blur-xl p-6 md:p-8 shadow-[0_24px_70px_rgba(80,88,76,0.12)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-japandi-500">
                    {mode === 'bootstrap' ? 'Initial Setup' : 'Login'}
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-japandi-900">
                    {mode === 'bootstrap' ? 'สร้างแอดมินคนแรก' : 'เข้าสู่ระบบ'}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-japandi-600">
                    {mode === 'bootstrap'
                      ? 'ใช้ครั้งแรกเพื่อสร้างบัญชี admin เริ่มต้น จากนั้นค่อยเพิ่ม manager และ user ได้'
                    : `ใช้บัญชี staff ของ ${company.label} เพื่อเข้าใช้งานหน้าแอดมิน`}
                  </p>
                </div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-japandi-800 text-white shadow-lg shadow-japandi-800/20">
                  <LockKeyhole size={22} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === 'bootstrap' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">ชื่อที่แสดง</label>
                    <input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="เช่น ผู้ดูแลระบบ"
                      className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">ชื่อผู้ใช้</label>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="username"
                    className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">รหัสผ่าน</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                  />
                </div>

                {mode === 'bootstrap' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">ยืนยันรหัสผ่าน</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-japandi-800 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-japandi-900 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {mode === 'bootstrap' ? 'สร้างบัญชีแอดมิน' : 'เข้าสู่ระบบ'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-xs text-japandi-500 leading-relaxed">
                  {hasStaff
                    ? 'หากยังไม่มีบัญชี ให้ผู้ดูแลระบบสร้างบัญชี admin, manager, user จากหน้าจัดการบัญชี'
                    : `ยังไม่พบบัญชี staff ของ ${company.label} ในระบบ สามารถสร้างแอดมินคนแรกได้ทันที`}
                </p>
                {hasStaff ? (
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'bootstrap' : 'login')}
                    className="shrink-0 text-xs font-bold text-japandi-700 hover:text-japandi-900"
                  >
                    {mode === 'login' ? 'ตั้งค่าเริ่มต้น' : 'กลับไปหน้าเข้าสู่ระบบ'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    <Sparkles size={12} />
                    First run
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
