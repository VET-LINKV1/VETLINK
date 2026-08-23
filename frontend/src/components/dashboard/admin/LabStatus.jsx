/**
 * LabStatus.jsx
 * Pending / Processing / Ready for Review / Reviewed — distribution bar
 * plus a count list. Mirrors the structure of PrescriptionRequests.
 */
import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card, SectionHeader, Skeleton, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const ROWS = [
  { key: 'pending', label: 'Pending', tone: 'amber', dot: '#f59e0b' },
  { key: 'processing', label: 'Processing', tone: 'blue', dot: '#0ea5e9' },
  { key: 'readyForReview', label: 'Ready for Review', tone: 'violet', dot: '#8b5cf6' },
  { key: 'reviewed', label: 'Reviewed', tone: 'emerald', dot: '#10b981' },
];

export default function LabStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getLab());
    } catch (e) {
      setError(e.message || 'Failed to load lab status');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const total = data ? ROWS.reduce((s, r) => s + data[r.key], 0) : 1;

  return (
    <Card>
      <SectionHeader title="Laboratory Status" subtitle="Sample processing pipeline" icon={FlaskConical} />
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-3 w-full rounded-full" />
            <SkeletonRows rows={4} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Distribution bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-slate-100 dark:bg-white/5">
              {ROWS.map((r) => (
                <div key={r.key} style={{ width: `${(data[r.key] / total) * 100}%`, background: r.dot }}
                  title={`${r.label}: ${data[r.key]}`} />
              ))}
            </div>
            <div className="space-y-2.5">
              {ROWS.map((r) => (
                <div key={r.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: r.dot }} />
                    <span className="font-body text-slate-600 dark:text-slate-300 text-sm">{r.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-slate-800 dark:text-white text-base font-700 tabular-nums">{data[r.key]}</span>
                    <span className="font-body text-xs text-slate-400 w-10 text-right">{Math.round((data[r.key] / total) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
