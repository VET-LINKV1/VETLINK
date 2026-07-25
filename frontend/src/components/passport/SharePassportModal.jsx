/**
 * SharePassportModal.jsx
 * Modal that creates a tokenized share for a pet and optionally
 * emails the recipient. Falls back to "copy link" when the backend
 * couldn't deliver the email.
 *
 * Props:
 *   open
 *   onClose()
 *   pet               required
 *   onShared()        callback after success
 */
import { useState } from 'react';
import { X, Mail, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { passportService } from '../../services/passportService';

export default function SharePassportModal({ open, onClose, pet, onShared }) {
  const [form, setForm]   = useState({ email: '', message: '', ttlDays: 30 });
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [result, setRes]  = useState(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const data = await passportService.createShare({
        petId:          pet.id,
        recipientEmail: form.email,
        message:        form.message,
        ttlDays:        Number(form.ttlDays) || 30,
      });
      setRes(data);
      onShared && onShared(data);
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to create share.');
    } finally { setBusy(false); }
  };

  const copy = () => {
    if (!result?.url) return;
    navigator.clipboard.writeText(result.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const close = () => {
    setForm({ email: '', message: '', ttlDays: 30 });
    setRes(null);
    setErr('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-display text-slate-800 dark:text-white font-700">Share passport</p>
              <p className="text-xs font-body text-slate-400">{pet?.name}'s digital health record</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={submit} className="p-5 space-y-3">
            <label className="block text-xs font-body font-600 text-slate-500 uppercase tracking-wide">
              Recipient email *
              <input required type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vet@otherclinic.com"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
            </label>
            <label className="block text-xs font-body font-600 text-slate-500 uppercase tracking-wide">
              Personal message (optional)
              <textarea rows={3} value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="A brief note for the recipient…"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
            </label>
            <label className="block text-xs font-body font-600 text-slate-500 uppercase tracking-wide">
              Link expires in (days)
              <input type="number" min={1} max={365} value={form.ttlDays}
                onChange={(e) => setForm({ ...form, ttlDays: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
            </label>
            {err && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />{err}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close}
                className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-body">
                Cancel
              </button>
              <button type="submit" disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send share link
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-3">
            <div className={`rounded-lg px-3 py-2.5 text-sm font-body
              ${result.emailed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {result.emailed
                ? `✓ Email sent to ${result.share?.recipient_email || 'recipient'}.`
                : `Couldn't send email automatically (${result.emailReason || 'SMTP not configured'}). Copy the link below to share manually.`}
            </div>

            <div>
              <p className="text-xs font-body font-600 text-slate-500 uppercase tracking-wide mb-1">
                Shareable link
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={result.url}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 truncate" />
                <button onClick={copy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs font-body text-slate-400 mt-2">
                Expires {new Date(result.share?.expires_at).toLocaleString()}
              </p>
            </div>

            <div className="flex justify-end">
              <button onClick={close}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-body font-600">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
