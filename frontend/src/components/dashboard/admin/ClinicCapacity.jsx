/**
 * ClinicCapacity.jsx
 * Room/branch utilization: a circular progress gauge + per-branch bars.
 */
import { useState, useEffect } from 'react';
import { Building2, Maximize, Minimize } from 'lucide-react';
import { Card, SectionHeader, Skeleton, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

function CircularProgress({ value, size = 96, stroke = 10, color = '#2563eb', children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export default function ClinicCapacity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getCapacity());
    } catch (e) {
      setError(e.message || 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const utilColor = data?.utilization > 85 ? '#ef4444' : data?.utilization > 65 ? '#f59e0b' : '#10b981';

  return (
    <Card>
      <SectionHeader title="Clinic Capacity" subtitle="Room & branch utilization" icon={Building2} />
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-24 mx-auto rounded-full" />
            <SkeletonRows rows={3} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <div className="flex flex-col items-center text-center">
                <CircularProgress value={data.utilization} size={110} stroke={8} color={utilColor}>
                  <div className="text-center">
                    <p className="font-display text-2xl font-700 text-slate-800 dark:text-white tabular-nums">{data.utilization}%</p>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs">Utilization</p>
                  </div>
                </CircularProgress>
                <p className="font-body text-slate-500 dark:text-slate-400 text-xs mt-2 max-w-xs text-center">
                  {data.available} of {data.totalRooms} rooms free
                </p>
              </div>
              <div className="flex-1 space-y-3">
                {data.branches.map((b) => {
                  const pct = b.utilization;
                  const c = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-body text-slate-600 dark:text-slate-300 font-500">{b.name}</span>
                        <span className="font-mono text-slate-800 dark:text-white font-600">{b.available}/{b.rooms}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${pct}%`, background: c }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
              <div className="text-center">
                <p className="font-display text-xl font-700 text-slate-800 dark:text-white">{data.totalRooms}</p>
                <p className="font-body text-slate-400 dark:text-slate-500 text-xs">Total Rooms</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-700 text-emerald-600 dark:text-emerald-400">{data.available}</p>
                <p className="font-body text-slate-400 dark:text-slate-500 text-xs">Available</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-700 text-blue-600 dark:text-blue-400">{data.occupied}</p>
                <p className="font-body text-slate-400 dark:text-slate-500 text-xs">Occupied</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}