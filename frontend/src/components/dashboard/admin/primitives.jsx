/**
 * primitives.jsx
 * Shared building blocks for the Admin Main Dashboard.
 * Keeps a single source of truth for spacing, tone palettes, and status
 * indicators so every section reads as one coherent surface.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

/* ── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */
export function SectionHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-white/10">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-slate-800 dark:text-white text-[15px] font-600 leading-tight truncate">{title}</h3>
          {subtitle && <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Tone palette for badges / dots / pills ───────────────────────────────── */
export const TONES = {
  blue:    { soft: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500',     ring: 'ring-blue-500/20' },
  indigo:  { soft: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500',  ring: 'ring-indigo-500/20' },
  amber:   { soft: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500',     ring: 'ring-amber-500/20' },
  emerald: { soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
  red:     { soft: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500',     ring: 'ring-red-500/20' },
  slate:   { soft: 'bg-slate-100 text-slate-600 border-slate-200',  dot: 'bg-slate-400',    ring: 'ring-slate-500/20' },
  violet:  { soft: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500',  ring: 'ring-violet-500/20' },
  teal:    { soft: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-teal-500',    ring: 'ring-teal-500/20' },
};

/* ── Status badge (dot + label, tone-aware, accessible) ───────────────────── */
export function StatusBadge({ tone = 'slate', label, pulse = false }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${t.soft}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot} ${pulse ? 'animate-pulse' : ''}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/* ── Trend pill (delta, up/down/flat) ─────────────────────────────────────── */
export function TrendPill({ value, suffix = '%', goodWhen = 'up' }) {
  const flat = Math.abs(value) < 0.05;
  const positive = value > 0;
  // "good" depends on the metric. For pending actions / cancelled, down is good.
  const isGood = flat ? null : (positive === (goodWhen === 'up'));
  const cls = flat
    ? 'bg-slate-100 text-slate-500'
    : isGood
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-red-50 text-red-500';
  const arrow = flat ? '→' : positive ? '↑' : '↓';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-body font-700 px-1.5 py-0.5 rounded-md ${cls}`}>
      <span aria-hidden>{arrow}</span>
      {flat ? '0' : Math.abs(value).toFixed(1)}
      {!flat && suffix}
    </span>
  );
}

/* ── Loading skeleton block ───────────────────────────────────────────────── */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-100 dark:bg-white/5 rounded-lg ${className}`} />;
}

export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Inline error state with retry ────────────────────────────────────────── */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <p className="font-body text-slate-600 dark:text-slate-300 text-sm mb-1">{message || 'Something went wrong loading this section.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-body font-600 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
