import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Banknote, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';

type PaymentAccount = {
  id: string;
  bank: string;
  account_name: string;
  account_number: string | null;
  promptpay: string | null;
  note: string | null;
  is_active: number;
};

type FormState = {
  bank: string;
  accountName: string;
  accountNumber: string;
  note: string;
};

const EMPTY_FORM: FormState = { bank: '', accountName: '', accountNumber: '', note: '' };

export default function PaymentAccounts({ canEdit }: { canEdit: boolean }) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccount | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getPaymentAccounts(true);
      setAccounts(rows);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถโหลดบัญชีรับเงินได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true); };
  const openEdit = (acc: PaymentAccount) => {
    setEditing(acc);
    setForm({
      bank: acc.bank || '',
      accountName: acc.account_name || '',
      accountNumber: acc.account_number || '',
      note: acc.note || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.bank.trim()) { setFormError('กรุณากรอกธนาคาร'); return; }
    if (!form.accountName.trim()) { setFormError('กรุณากรอกชื่อบัญชี'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        bank: form.bank.trim(),
        accountName: form.accountName.trim(),
        accountNumber: form.accountNumber.trim() || undefined,
        note: form.note.trim() || undefined,
      };
      if (editing) await api.updatePaymentAccount(editing.id, payload);
      else await api.createPaymentAccount(payload);
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (acc: PaymentAccount) => {
    try {
      await api.setPaymentAccountStatus(acc.id, !(acc.is_active));
      await load();
    } catch (err: any) {
      setError(err.message || 'อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const handleDelete = async (acc: PaymentAccount) => {
    if (!window.confirm(`ลบบัญชี "${acc.bank} - ${acc.account_name}" ?`)) return;
    try {
      await api.deletePaymentAccount(acc.id);
      await load();
    } catch (err: any) {
      setError(err.message || 'ลบไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-xs leading-relaxed text-japandi-600">
        บัญชีรับเงินที่บันทึกไว้ใช้สำหรับ <span className="font-bold">แสดง/อ้างอิง</span> เท่านั้น
        (เช่น แจ้งลูกค้า หรือให้พนักงานตรวจสอบเอง) — ระบบ<span className="font-bold">ยังไม่ได้</span>นำไปตรวจสลิปอัตโนมัติ
        เพราะ QR ในสลิปไม่มีข้อมูลบัญชีผู้รับ
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-japandi-900 flex items-center gap-2"><Banknote size={18} /> บัญชีรับเงินของร้าน</h3>
        {canEdit && (
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-japandi-800 px-4 py-2 text-sm font-bold text-white hover:bg-japandi-900">
            <Plus size={15} /> เพิ่มบัญชี
          </button>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-japandi-500 py-10 justify-center"><Loader2 size={18} className="animate-spin" /> กำลังโหลด...</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-japandi-200 bg-white px-4 py-10 text-center text-sm text-japandi-500">
          ยังไม่มีบัญชีรับเงิน {canEdit && '— กด "เพิ่มบัญชี" เพื่อเริ่มต้น'}
        </div>
      ) : (
        <div className="rounded-2xl border border-japandi-100 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-japandi-500 text-xs uppercase tracking-widest border-b border-japandi-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold">ธนาคาร</th>
                <th className="px-4 py-3 text-left font-bold">ชื่อบัญชี</th>
                <th className="px-4 py-3 text-left font-bold">เลขบัญชี</th>
                <th className="px-4 py-3 text-left font-bold">สถานะ</th>
                {canEdit && <th className="px-4 py-3 text-right font-bold">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} className="border-b border-japandi-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-japandi-900">{acc.bank}</td>
                  <td className="px-4 py-3 text-japandi-700">
                    {acc.account_name}
                    {acc.note && <span className="block text-[11px] text-japandi-400">{acc.note}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-japandi-700">{acc.account_number || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${acc.is_active ? 'bg-green-50 text-green-700' : 'bg-japandi-100 text-japandi-500'}`}>
                      {acc.is_active ? 'Active' : 'ปิด'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(acc)} title="แก้ไข"
                          className="w-8 h-8 rounded-lg bg-japandi-100 text-japandi-600 hover:bg-japandi-200 flex items-center justify-center"><Pencil size={14} /></button>
                        <button onClick={() => handleToggle(acc)} title={acc.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          className="px-2 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold flex items-center">{acc.is_active ? 'ปิด' : 'เปิด'}</button>
                        <button onClick={() => handleDelete(acc)} title="ลบ"
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-japandi-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-lg font-bold text-japandi-900">{editing ? 'แก้ไขบัญชีรับเงิน' : 'เพิ่มบัญชีรับเงิน'}</h2>
              <button type="button" onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-japandi-100 text-japandi-600 hover:bg-japandi-200 flex items-center justify-center"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="ธนาคาร" required>
                <input value={form.bank} onChange={e => setForm(p => ({ ...p, bank: e.target.value }))}
                  placeholder="เช่น ธนาคารไทยพาณิชย์ (SCB)"
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
              </Field>
              <Field label="ชื่อบัญชี" required>
                <input value={form.accountName} onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))}
                  placeholder="ชื่อเจ้าของบัญชี"
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
              </Field>
              <Field label="เลขที่บัญชี">
                <input value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))}
                  placeholder="xxx-x-xxxxx-x" inputMode="numeric"
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
              </Field>
              <Field label="หมายเหตุ (ไม่บังคับ)">
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="เช่น บัญชีหลัก / สาขา"
                  className="w-full rounded-2xl border border-japandi-200 bg-japandi-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
              </Field>

              {formError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-2xl border border-japandi-200 px-4 py-3 text-sm font-semibold text-japandi-700 hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-japandi-800 px-4 py-3 text-sm font-bold text-white hover:bg-japandi-900 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-japandi-600">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
