/**
 * primitives.jsx
 * Reusable building blocks for the VETLINK Admin Settings module.
 * Keeps every settings panel visually consistent with the rest of the
 * Admin Portal (rounded-2xl cards, slate palette, Sora/DM Sans fonts,
 * lucide icons, dark-mode aware).
 */
import { useState } from 'react';
import { AlertTriangle, X, Check, RefreshCw } from 'lucide-react';

/* ----------------------------- Toggle switch ----------------------------- */
export function Toggle({ checked, onChange, disabled, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
        ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

/* ------------------------------- Field row ------------------------------- */
export function Field({ label, htmlFor, children, hint, error }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-body font-600 text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs font-body text-slate-400">{hint}</p>}
      {error && <p className="text-xs font-body text-red-500">{error}</p>}
    </div>
  );
}

/* ------------------------------ Text input ------------------------------- */
export function TextInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800
        px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 outline-none
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors ${className}`}
    />
  );
}

/* ------------------------------ Text area -------------------------------- */
export function TextArea({ className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800
        px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 outline-none resize-none
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors ${className}`}
    />
  );
}

/* ------------------------------- Select ---------------------------------- */
export function Select({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800
        px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 outline-none
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

/* ----------------------------- Settings card ----------------------------- */
export function SettingCard({ title, subtitle, icon: Icon, children, footer, action }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <div>
            <h3 className="font-display text-slate-800 dark:text-white text-base font-600">{title}</h3>
            {subtitle && <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6 space-y-5">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-white/5">
          {footer}
        </div>
      )}
    </section>
  );
}

/* ------------------------- Settings form footer -------------------------- */
export function FormFooter({ onSave, onCancel, onReset, saving, lastSaved, saveLabel = 'Save Changes', resetLabel = 'Reset' }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {lastSaved && (
        <span className="mr-auto text-xs font-body text-emerald-600 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> {lastSaved}
        </span>
      )}
      {onReset && (
        <button type="button" onClick={onReset}
          className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
          {resetLabel}
        </button>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          Cancel
        </button>
      )}
      <button type="button" onClick={onSave} disabled={saving}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 transition-colors">
        {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {saveLabel}
      </button>
    </div>
  );
}

/* --------------------------- Confirmation modal -------------------------- */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onClose, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-slate-800 dark:text-white text-base font-700">{title}</h3>
              <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-1">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/10 justify-end">
          <button onClick={onClose} disabled={busy}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`px-4 py-2 rounded-lg text-white text-sm font-body font-600 shadow flex items-center gap-1.5 transition-colors
              ${danger ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
            {busy && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Inline status ----------------------------- */
export function StatusPill({ tone = 'neutral', children }) {
  const tones = {
    neutral:  'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    success:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    warning:  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    danger:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    info:     'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-body font-600 px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ------------------------------ Section note ----------------------------- */
export function Note({ children, tone = 'info' }) {
  const tones = {
    info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs font-body ${tones[tone]}`}>{children}</div>
  );
}

/* --------------------- Generic list-editor (add/remove) ------------------ */
export function ChipList({ items, onAdd, onRemove, placeholder, addLabel = 'Add', suggestions }) {
  const [value, setValue] = useState('');
  const add = () => {
    const v = value.trim();
    if (!v || items.includes(v)) { setValue(''); return; }
    onAdd(v); setValue('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-body">
            {it}
            <button type="button" onClick={() => onRemove(it)} className="text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {!items.length && <span className="text-xs font-body text-slate-400">None yet.</span>}
      </div>
      <div className="flex gap-2">
        {suggestions ? (
          <Select value={value} onChange={(e) => setValue(e.target.value)} className="flex-1">
            <option value="">{placeholder || 'Select…'}</option>
            {suggestions.filter((s) => !items.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        ) : (
          <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        )}
        <button type="button" onClick={add}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shrink-0 transition-colors">
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-white/10 mb-5">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} type="button"
          className={`px-3.5 py-2 text-sm font-body font-600 border-b-2 -mb-px transition-colors
            ${active === t.key
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------- Loading / error fallbacks -------------------------------- */
export function ErrorCard({ message, onRetry, title = 'Could not load this section' }) {
  return (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-red-800 dark:text-red-200 font-600">{title}</h3>
          <p className="font-body text-sm text-red-700 dark:text-red-300 mt-1">{message}</p>
          {onRetry && (
            <button onClick={onRetry}
              className="mt-3 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-body font-600 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
