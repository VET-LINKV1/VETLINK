/**
 * ClientRemindersPage.jsx
 *
 * Client view: show all upcoming vaccination & deworming reminders
 * grouped by pet. Highlights overdue items and upcoming due dates.
 *
 * Each pet card shows:
 *   - Pet name + species
 *   - List of due/overdue vaccinations and dewormings with status,
 *     due date, and days-until flags
 *
 * Mounted at /client/reminders
 */
import { useState, useEffect, useCallback } from 'react';
import { reminderService } from '../../services/reminderService';
import {
  Syringe, Bug, Calendar, Loader2, AlertCircle, CheckCircle2,
  Clock, ChevronDown, ChevronRight, ShieldAlert, X,
} from 'lucide-react';

const STATUS_META = {
  scheduled: { label: 'Scheduled',  color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  overdue:   { label: 'Overdue',    color: 'text-red-600',  bg: 'bg-red-50',  icon: ShieldAlert },
  administered: { label: 'Done',    color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled',  color: 'text-slate-400', bg: 'bg-slate-50', icon: X },
};

function daysUntil(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function DueBadge({ diff }) {
  if (diff < 0) {
    return <span className="text-xs font-700 text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{Math.abs(diff)} day{Math.abs(diff) !== 1 ? 's' : ''} overdue</span>;
  }
  if (diff === 0) {
    return <span className="text-xs font-700 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Due today</span>;
  }
  if (diff <= 7) {
    return <span className="text-xs font-700 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{diff} day{diff !== 1 ? 's' : ''}</span>;
  }
  return <span className="text-xs font-500 text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{diff} days</span>;
}

export default function ClientRemindersPage() {
  const [byPet, setByPet]       = useState([]); // [{pet, reminders: [...]}]
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState({}); // petId → bool

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await reminderService.getMine(90);
      setByPet(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalUpcoming = byPet.reduce((acc, g) =>
    acc + g.reminders.filter(r => r.status === 'scheduled').length, 0
  );
  const totalOverdue = byPet.reduce((acc, g) =>
    acc + g.reminders.filter(r => r.status === 'overdue').length, 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">
            Vaccination & Deworming Reminders
          </h1>
          <p className="text-slate-400 font-body text-sm mt-0.5">
            Keep your pets protected with timely vaccinations and deworming
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="font-display text-2xl font-700">{totalUpcoming}</p>
          <p className="text-sm text-white/80 font-body">Upcoming</p>
        </div>
        <div className={`rounded-2xl p-5 border shadow-sm ${totalOverdue > 0
          ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/20 border-transparent'
          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${totalOverdue > 0 ? 'bg-white/15' : 'bg-red-50'}`}>
            <ShieldAlert className={`w-5 h-5 ${totalOverdue > 0 ? 'text-white' : 'text-red-500'}`} />
          </div>
          <p className={`font-display text-2xl font-700 ${totalOverdue > 0 ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
            {totalOverdue}
          </p>
          <p className={`text-sm font-body ${totalOverdue > 0 ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
            Overdue{totalOverdue > 0 ? ' — please schedule' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
          </div>
        </div>
      ) : byPet.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
          <Syringe className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 font-600 mb-2">No reminders</p>
          <p className="text-slate-400 text-sm font-body mb-2">
            Your pets don't have any scheduled vaccinations or deworming.
          </p>
          <p className="text-xs text-slate-400 font-body">
            Your vet will set these up during your next visit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {byPet.map((group) => {
            const petId = group.pet.id;
            const isExpanded = expanded[petId] !== false; // default expanded
            const overdueCount = group.reminders.filter(r => r.status === 'overdue').length;
            const scheduledCount = group.reminders.filter(r => r.status === 'scheduled').length;

            return (
              <div key={petId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
                {/* Pet header */}
                <button
                  onClick={() => setExpanded(p => ({ ...p, [petId]: !isExpanded }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <span className="text-white font-display font-700 text-sm">
                        {group.pet.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-display font-600 text-slate-800 dark:text-white">{group.pet.name}</p>
                      <p className="text-xs text-slate-400 font-body">
                        {group.pet.species}{group.pet.breed ? ` · ${group.pet.breed}` : ''}
                        {' · '}{group.reminders.length} reminder{group.reminders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdueCount > 0 && (
                      <span className="text-xs font-700 text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                        {overdueCount} overdue
                      </span>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                  </div>
                </button>

                {/* Reminder list */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-white/10 divide-y divide-slate-50">
                    {group.reminders.map((r) => {
                      const StatusIcon = (STATUS_META[r.status] || STATUS_META.scheduled).icon;
                      const diff = daysUntil(r.due_date);
                      const isDue = diff <= 7;
                      const isOverdue = r.status === 'overdue' || diff < 0;

                      return (
                        <div key={r.id} className={`p-4 ${isOverdue ? 'bg-red-50/50' : isDue ? 'bg-amber-50/30' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                              ${r.category === 'deworming' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                              {r.category === 'deworming' ? <Bug className="w-4 h-4" /> : <Syringe className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="font-body font-600 text-slate-700 dark:text-slate-200 text-sm">
                                  {r.vaccine_name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-body font-600 px-1.5 py-0.5 rounded-md
                                    ${STATUS_META[r.status]?.bg || 'bg-slate-50'} ${STATUS_META[r.status]?.color || 'text-slate-500'}`}>
                                    {(STATUS_META[r.status] || STATUS_META.scheduled).label}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {r.category === 'deworming' && (
                                  <span className="text-[10px] font-600 text-violet-500 uppercase tracking-wider bg-violet-50 px-1.5 py-0.5 rounded">
                                    Deworming
                                  </span>
                                )}
                                {r.manufacturer && (
                                  <span className="text-xs text-slate-400 font-body">{r.manufacturer}</span>
                                )}
                                {r.dose && (
                                  <span className="text-xs text-slate-400 font-body">Dose: {r.dose}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-2">
                                {r.due_date ? (
                                  <span className={`text-xs font-body flex items-center gap-1
                                    ${isOverdue ? 'text-red-600' : isDue ? 'text-amber-600' : 'text-slate-500'}`}>
                                    <Calendar className="w-3 h-3" />
                                    Due: {new Date(r.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric'
                                    })}
                                  </span>
                                ) : null}
                                {r.due_date && <DueBadge diff={diff} />}
                              </div>

                              {r.notes && (
                                <p className="text-xs text-slate-400 font-body mt-1 italic">{r.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Message at bottom */}
      {!loading && byPet.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-body font-600 text-blue-800 text-sm">Stay on track</p>
            <p className="text-xs text-blue-600 font-body mt-0.5">
              Schedule a visit when your pet's vaccination or deworming is coming due.
              Your vet can also set up recurring reminders during your next appointment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
