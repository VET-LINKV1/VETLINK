/**
 * UserFormDialog.jsx
 * Modal that handles both create and edit flows.
 *
 * Props:
 *   mode      'create' | 'edit'
 *   initial   user row (edit mode)
 *   onClose()
 *   onSaved(user)
 */
import { useEffect, useState } from 'react';
import { X, Loader2, Save, UserPlus, Copy } from 'lucide-react';
import { userManagementService } from '../../../services/userManagementService';

const ROLES = [
  { value: 'admin',        label: 'Admin' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'staff',        label: 'Staff' },
  { value: 'client',       label: 'Client' },
];

export default function UserFormDialog({ mode = 'create', initial = null, onClose, onSaved }) {
  const sp = initial?.staff_profiles?.[0] || initial?.staff_profiles || {};
  const [form, setForm] = useState({
    email:          initial?.email          || '',
    name:           initial?.name           || '',
    role:           initial?.role           || 'client',
    phone_number:   initial?.phone_number   || '',
    address:        initial?.address        || '',
    license_number: sp?.license_number      || '',
    specialization: sp?.specialization      || '',
    position:       sp?.position            || '',
    department:     sp?.department          || '',
    send_invite:    true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [inviteLink, setLink] = useState('');

  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true); setError(''); setLink('');
    try {
      if (mode === 'create') {
        const res = await userManagementService.create(form);
        if (res?.invite_link) setLink(res.invite_link);
        // If we surfaced an invite link, keep the modal open so the admin can copy it.
        // Otherwise close.
        if (!res?.invite_link) onSaved && onSaved(res?.user);
        else setTimeout(() => onSaved && onSaved(res?.user), 200);
      } else {
        const patch = { ...form };
        delete patch.send_invite;
        // Only send role if changed
        if (initial?.role === patch.role) delete patch.role;
        const updated = await userManagementService.update(initial.id, patch);
        onSaved && onSaved(updated);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  const showStaffFields = form.role === 'veterinarian' || form.role === 'staff';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display font-700 text-base text-slate-800 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            {mode === 'create' ? 'Create user' : `Edit ${initial?.name || 'user'}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-body">{error}</div>}
          {inviteLink && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-body text-emerald-800">
              <p className="font-600 mb-1">Invite link generated. Share it with the user:</p>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteLink}
                  className="flex-1 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-700" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(inviteLink).catch(() => {}); }}
                  className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-600 flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full name *" value={form.name} onChange={(v) => set('name', v)} required />
            <Field label="Email *" type="email" value={form.email} onChange={(v) => set('email', v)} required disabled={false} />
            <SelectField label="Role *" value={form.role} onChange={(v) => set('role', v)} options={ROLES} />
            <Field label="Phone" value={form.phone_number} onChange={(v) => set('phone_number', v)} />
            <Field label="Address" value={form.address} onChange={(v) => set('address', v)} className="md:col-span-2" />
          </div>

          {showStaffFields && (
            <div className="border-t border-slate-100 dark:border-white/10 pt-3 mt-3">
              <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
                {form.role === 'veterinarian' ? 'Veterinarian details' : 'Staff details'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {form.role === 'veterinarian' && (
                  <>
                    <Field label="License number" value={form.license_number} onChange={(v) => set('license_number', v)} />
                    <Field label="Specialization" value={form.specialization} onChange={(v) => set('specialization', v)} />
                  </>
                )}
                {form.role === 'staff' && (
                  <SelectField label="Position" value={form.position} onChange={(v) => set('position', v)}
                    options={[
                      { value: '',           label: '—' },
                      { value: 'assistant',  label: 'Assistant' },
                      { value: 'technician', label: 'Technician' },
                    ]} />
                )}
                <Field label="Department" value={form.department} onChange={(v) => set('department', v)} />
              </div>
            </div>
          )}

          {mode === 'create' && (
            <label className="flex items-center gap-2 text-xs font-body text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.send_invite} onChange={(e) => set('send_invite', e.target.checked)} />
              Generate a password-reset / invite link
            </label>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 flex items-center gap-1.5 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Create user' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-body font-600 text-slate-500 dark:text-slate-400 mb-1 block">{label}</span>
      <input type={type} value={value || ''} required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
    </label>
  );
}

function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-body font-600 text-slate-500 dark:text-slate-400 mb-1 block">{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
