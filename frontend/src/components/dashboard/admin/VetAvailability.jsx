/**
 * VetAvailability.jsx
 * Each veterinarian's live status + appointment count, ranked by load.
 */
import { useState, useEffect } from 'react';
import { Stethoscope } from 'lucide-react';
import { Card, SectionHeader, StatusBadge, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const STATUS_TONE = {
  'Available': 'emerald',
  'In Consultation': 'amber',
  'On Break': 'blue',
  'Off Duty': 'slate',
};

export default function VetAvailability() {
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setVets(await dashboardApi.getVets());
    } catch (e) {
      setError(e.message || 'Failed to load veterinarians');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const available = vets.filter((v) => v.status === 'Available').length;
  const inConsult = vets.filter((v) => v.status === 'In Consultation').length;

  return (
    <Card>
      <SectionHeader
        title="Veterinarian Availability"
        subtitle={`${available} available · ${inConsult} in consult`}
        icon={Stethoscope}
        action={
          <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
            {vets.length} on shift
          </span>
        }
      />
      <div className="p-3 sm:p-4">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="space-y-1.5">
            {vets.map((v) => {
              const tone = STATUS_TONE[v.status] || 'slate';
              const initials = v.name.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-display font-700 text-xs shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-slate-800 dark:text-slate-100 text-sm font-600 truncate">{v.name}</p>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs">
                      {v.appointments} appts {v.status === 'Available' ? '· free now' : `· next ${v.nextFree}`}
                    </p>
                  </div>
                  <StatusBadge tone={tone} label={v.status} pulse={v.status === 'In Consultation'} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
