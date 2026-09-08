/**
 * ChangePasswordModal.jsx
 * Self-service "change my password" dialog, used from the profile page's
 * Account Security card. Works for any signed-in role (admin included).
 */
import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { profileService } from '../../services/profileService';

function getStrength(pw) {
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-blue-600'];
const STRENGTH_TEXT   = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-blue-600'];

export default function ChangePasswordModal({ onClose, onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getStrength(form.newPassword);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose, saving]);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
    setServerError('');
  };

  const validate = () => {
    const e = {};
    if (!form.currentPassword) e.currentPassword = 'Current password is required';
    if (!form.newPassword) e.newPassword = 'New password is required';
    else if (form.newPassword.length < 8) e.newPassword = 'At least 8 characters';
    else if (!/[A-Z]/.test(form.newPassword)) e.newPassword = 'Must include an uppercase letter';
    else if (!/[0-9]/.test(form.newPassword)) e.newPassword = 'Must include a number';
    else if (!/[^A-Za-z0-9]/.test(form.newPassword)) e.newPassword = 'Must include a symbol (e.g. @, !, #)';
    if (form.newPassword && form.currentPassword && form.newPassword === form.currentPassword) {
      e.newPassword = 'New password must be different from your current password';
    }
    if (form.newPassword !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError('');
    try {
      await profileService.changePassword(form.currentPassword, form.newPassword);
      setSuccess(true);
      setTimeout(() => {
        onChanged && onChanged();
        onClose();
      }, 1200);
    } catch (err) {
      setServerError(err?.response?.data?.error || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (key) => `
    w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${errors[key] ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 bg-white focus:ring-blue-500'}
  `;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-slate-800 dark:text-white text-lg font-700">Change Password</h3>
          <button onClick={() => !saving && onClose()}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
            <p className="text-slate-700 dark:text-slate-200 font-body font-600">Password updated successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {serverError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-500 font-body">{serverError}</p>
              </div>
            )}

            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
                Current Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={show.current ? 'text' : 'password'}
                  value={form.currentPassword}
                  onChange={e => set('currentPassword', e.target.value)}
                  autoComplete="current-password"
                  className={inputClass('currentPassword')}
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword}</p>}
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={show.next ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={e => set('newPassword', e.target.value)}
                  placeholder="Min 8 chars, uppercase, number, symbol"
                  autoComplete="new-password"
                  className={inputClass('newPassword')}
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, next: !s.next }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-slate-100'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-body ${STRENGTH_TEXT[strength]}`}>{STRENGTH_LABELS[strength]}</p>
                </div>
              )}
              {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>}
            </div>

            {/* Confirm new password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={show.confirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                  className={inputClass('confirmPassword')}
                />
                <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => !saving && onClose()}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-body font-500 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
