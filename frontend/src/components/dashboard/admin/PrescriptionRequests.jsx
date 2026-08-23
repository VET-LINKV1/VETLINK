/**
 * PrescriptionRequests.jsx
 * New / Under Review / Approved / Rejected — same visual pattern as LabStatus.
 */
import { useState, useEffect } from 'react';
import { Pill } from 'lucide-react';
import { Card, SectionHeader, Skeleton, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const ROWS = [
  { key: 'new', label: 'New', tone: 'blue', dot: '#0ea5e9' },
  { key: 'underReview', label: 'Under Review', tone: 'amber', dot: '#f59e0b' },
  { key: 'approved', label: 'Approved', tone: 'emerald', dot: '#10b981' },
  { key: 'rejected', label: 'Rejected', tone: 'red', dot: '#ef4444' },
];

export default function PrescriptionRequests() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getPrescriptions());
    } catch (e) {
      setError(e.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const total = data ? ROWS.reduce((s, r) => s + data[r.key], 0) : 1;

  return (
    <Card>
      <SectionHeader title="Prescription Requests" subtitle="Refill & new Rx queue" icon={Pill} />
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