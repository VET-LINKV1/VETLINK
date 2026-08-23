/**
 * TodaysAppointments.jsx
 * Prominent live appointment board with status filters and a species-aware
 * visual. Highlights what's happening right now on the clinic floor.
 */
import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, Dog, Cat, Filter, Search, ChevronRight } from 'lucide-react';
import { Card, SectionHeader, StatusBadge, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi, STATUS } from './mockData';

const FILTERS = [
  'All', 'Confirmed', 'Checked-In', 'In Consultation', 'Completed', 'Cancelled', 'No-Show',
];

const SPECIES_ICON = { Dog: Dog, Cat: Cat };

function AppointmentRow({ appt }) {
  const status = STATUS[appt.status] || STATUS.Confirmed;
  const SpecIcon = SPECIES_ICON[appt.species] || Dog;
  const active = appt.status === 'In Consultation' || appt.status === 'Checked-In';
  return (
    <div className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
      active ? 'bg-blue-50/60 border-blue-100 dark:bg-blue-500/5 dark:border-blue-500/20'
             : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
    }`}>
      {/* Time */}
      <div className="w-12 sm:w-14 shrink-0">
        <p className="font-mono text-slate-800 dark:text-slate-100 text-sm font-600 tabular-nums">{appt.time}</p>
      </div>

      {/* Species + pet/owner */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
          <SpecIcon className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-slate-800 dark:text-slate-100 text-sm font-600 truncate">
            {appt.pet} <span className="font-normal text-slate-400 dark:text-slate-500">· {appt.owner}</span>
          </p>
          <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">
            {appt.type} · {appt.vet}
          </p>
        </div>
      </div>

      {/* Room + status (hide room on small screens) */}
      <div className="hidden md:block w-36 shrink-0">
        <p className="font-body text-slate-500 dark:text-slate-400 text-xs truncate">{appt.room}</p>
      </div>

      <div className="w-28 sm:w-32 shrink-0 flex justify-end">
        <StatusBadge tone={status.tone} label={appt.status} pulse={active} />
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-slate-400 transition-colors hidden sm:block" />
    </div>
  );
}

export default function TodaysAppointments() {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setAppts(await dashboardApi.getAppointments());
    } catch (e) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { All: appts.length };
    appts.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [appts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appts.filter((a) => {
      const matchFilter = filter === 'All' || a.status === filter;
      const matchQuery = !q || [a.pet, a.owner, a.vet, a.type, a.room].some((f) => f.toLowerCase().includes(q));
      return matchFilter && matchQuery;
    });
  }, [appts, filter, query]);

  const action = (
    <div className="flex items-center gap-2">
      <div className="relative hidden sm:block">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pet, vet…"
          className="w-40 pl-8 pr-2 py-1.5 text-xs font-body rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
    </div>
  );

  return (
    <Card>
      <SectionHeader
        title="Today's Appointments"
        subtitle={`${appts.length} scheduled · ${counts['Completed'] || 0} completed`}
        icon={CalendarClock}
        action={action}
      />

      {/* Filter chips */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {FILTERS.map((f) => {
          const isActive = filter === f;
          const count = counts[f] || 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-body font-600 whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {f}
              <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-white/20' : 'bg-slate-200/70 dark:bg-white/10 text-slate-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 sm:p-4">
        {loading ? (
          <SkeletonRows rows={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-body text-slate-500 dark:text-slate-400 text-sm">No appointments match this filter.</p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
            {filtered.map((a) => <AppointmentRow key={a.id} appt={a} />)}
          </div>
        )}
      </div>
    </Card>
  );
}
