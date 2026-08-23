import { useEffect, useState, useMemo } from 'react';
import {
  BarChart2, PawPrint, Weight, Ruler, Syringe, Calendar, Pill,
  FlaskConical, ShieldCheck, ShieldAlert, Activity, HeartPulse,
  AlertTriangle, Lightbulb, Stethoscope, Clock, CheckCircle2,
  XCircle, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { clientService } from '../../services/clientService';

/* ── helpers ── */
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtMonth = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};
const fmtAxisDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const PET_COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#a855f7', '#ef4444', '#22c55e'];

const StatusBadge = ({ tone = 'slate', children }) => {
  const tones = {
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    slate:  'bg-slate-100 border-slate-200 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-body font-600 px-2.5 py-1 rounded-xl border ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
};

const SectionCard = ({ icon: Icon, title, subtitle, children, right }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
          {Icon && <Icon className="w-5 h-5 text-teal-600" />}
        </div>
        <div>
          <h2 className="font-display text-slate-800 font-700 text-base leading-tight">{title}</h2>
          {subtitle && <p className="text-slate-400 font-body text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const StatTile = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'text-slate-800', blue: 'text-blue-600', green: 'text-green-600',
    amber: 'text-amber-600', red: 'text-red-600', teal: 'text-teal-600',
  };
  return (
    <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
      <p className={`font-display text-2xl font-700 ${tones[tone] || tones.slate}`}>{value}</p>
      <p className="text-slate-400 text-xs font-body mt-1">{label}</p>
    </div>
  );
};

const EmptyHint = ({ children }) => (
  <div className="text-center py-8 text-slate-400 font-body text-sm">{children}</div>
);

const ComposedBar = ({ data, labelKey, valueKey, color = '#0ea5e9', height = 220 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
      <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
      />
      <Bar dataKey={valueKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={48} />
    </BarChart>
  </ResponsiveContainer>
);

function ClientAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await clientService.getAnalytics();
        if (alive) setData(res);
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load analytics');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const weightTrendMerged = useMemo(() => {
    if (!data?.weightTrend?.length) return [];
    // Build a unified dataset keyed by date across pets for multi-series chart
    const byDate = new Map();
    for (const s of data.weightTrend) {
      for (const pt of s.series) {
        const key = fmtAxisDate(pt.date);
        if (!byDate.has(key)) byDate.set(key, { date: key });
        byDate.get(key)[s.petId] = pt.weight;
        byDate.get(key)[`__name_${s.petId}`] = s.petName;
      }
    }
    // Sort chronologically
    return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data]);

  const bcsMerged = useMemo(() => {
    if (!data?.bcsTrend?.length) return [];
    const byDate = new Map();
    for (const s of data.bcsTrend) {
      for (const pt of s.series) {
        const key = fmtAxisDate(pt.date);
        if (!byDate.has(key)) byDate.set(key, { date: key });
        byDate.get(key)[s.petId] = pt.bcs;
      }
    }
    return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
      <p className="text-red-600 font-body text-sm">Couldn't load analytics. {error}</p>
    </div>
  );

  if (!data || data.healthOverview.totalPets === 0) return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-slate-800 text-2xl font-700">Health Analytics</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">Insights across your pets' care history</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <BarChart2 className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="font-display text-slate-600 font-600 mb-2">No data yet</h3>
        <p className="text-slate-400 font-body text-sm">Add pets and book appointments to see analytics here.</p>
      </div>
    </div>
  );

  const ho = data.healthOverview;
  const vax = data.vaccinationCompliance;
  const appt = data.appointmentHistory;
  const med = data.medicationAdherence;
  const lab = data.labTrends;
  const prev = data.preventiveCare;
  const insights = data.insights || { flags: [], recommendations: [] };

  const timelineKindTone = {
    visit: 'blue', vaccination: 'green', prescription: 'amber', treatment: 'red', file: 'slate',
  };
  const timelineKindLabel = {
    visit: 'Visit', vaccination: 'Vaccination', prescription: 'Prescription',
    treatment: 'Treatment', file: 'Document',
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-800 text-2xl font-700">Health Analytics</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">Insights across your pets' care history</p>
      </div>

      {/* ── 1. HEALTH OVERVIEW ── */}
      <SectionCard icon={HeartPulse} title="Health Overview" subtitle="Summary of activity across all pets">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Pets" value={ho.totalPets} tone="teal" />
          <StatTile label="Total Visits" value={ho.totalVisits} tone="blue" />
          <StatTile label="Completed" value={ho.completedVisits} tone="green" />
          <StatTile label="Cancelled" value={ho.cancelledVisits} tone="red" />
          <StatTile label="Upcoming" value={ho.upcomingAppointments} tone="amber" />
          <StatTile label="Follow-ups Due" value={ho.followUpsDue} tone="slate" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-body text-slate-400">
          <Activity className="w-4 h-4" />
          <span>{ho.medicalRecords} medical record{ho.medicalRecords !== 1 ? 's' : ''} on file</span>
        </div>
      </SectionCard>

      {/* ── 2. WEIGHT TREND ── */}
      <SectionCard icon={Weight} title="Weight Trend" subtitle="Body weight over time (kg)">
        {data.weightTrend.length === 0 ? (
          <EmptyHint>No weight entries recorded yet.</EmptyHint>
        ) : data.weightTrend.length === 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.weightTrend[0].series.map(p => ({ date: fmtAxisDate(p.date), weight: p.weight }))} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" name={data.weightTrend[0].petName} stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weightTrendMerged} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data.weightTrend.map((s, i) => (
                <Line key={s.petId} type="monotone" dataKey={s.petId} name={s.petName} stroke={PET_COLORS[i % PET_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* ── 3. BODY CONDITION SCORE ── */}
      <SectionCard icon={Ruler} title="Body Condition Score" subtitle="BCS on a 9-point scale (ideal 4–5)">
        {data.bcsTrend.length === 0 ? (
          <EmptyHint>No body condition scores recorded yet.</EmptyHint>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={bcsMerged} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  {data.bcsTrend.map((s, i) => (
                    <linearGradient key={s.petId} id={`bcs-${s.petId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PET_COLORS[i % PET_COLORS.length]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={PET_COLORS[i % PET_COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 9]} ticks={[1, 3, 5, 7, 9]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {data.bcsTrend.map((s, i) => (
                  <Area key={s.petId} type="monotone" dataKey={s.petId} name={s.petName} stroke={PET_COLORS[i % PET_COLORS.length]} strokeWidth={2} fill={`url(#bcs-${s.petId})`} connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs font-body text-slate-400">
              <span>Ideal band: <span className="text-green-600 font-600">4–5</span></span>
              <span>Underweight: ≤3</span>
              <span>Overweight: ≥7</span>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── 4. VACCINATION COMPLIANCE ── */}
      <SectionCard
        icon={Syringe}
        title="Vaccination Compliance"
        subtitle="Passport protection status"
        right={<StatusBadge tone={vax.complianceRate >= 80 ? 'green' : vax.complianceRate >= 50 ? 'amber' : (vax.complianceRate > 0 ? 'red' : 'slate')}>{vax.complianceRate}% protected</StatusBadge>}
      >
        {vax.totalVaccines === 0 ? (
          <EmptyHint>No vaccinations on record.</EmptyHint>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatTile label="Protected" value={vax.protected} tone="green" />
              <StatTile label="Expiring Soon" value={vax.expiringSoon} tone="amber" />
              <StatTile label="Overdue" value={vax.overdue} tone="red" />
              <StatTile label="Scheduled" value={vax.scheduled} tone="blue" />
            </div>
            {vax.byPet.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-600 text-slate-500 font-body mb-1">Per pet</p>
                {vax.byPet.map(p => (
                  <div key={p.petId} className="flex items-center justify-between gap-3 text-sm font-body">
                    <span className="text-slate-700 font-500">{p.petName}</span>
                    <div className="flex items-center gap-2">
                      {p.protected > 0 && <StatusBadge tone="green">{p.protected} protected</StatusBadge>}
                      {p.expiringSoon > 0 && <StatusBadge tone="amber">{p.expiringSoon} expiring</StatusBadge>}
                      {p.overdue > 0 && <StatusBadge tone="red">{p.overdue} overdue</StatusBadge>}
                      {p.scheduled > 0 && <StatusBadge tone="blue">{p.scheduled} scheduled</StatusBadge>}
                      {p.total === 0 && <span className="text-slate-400 text-xs">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── 5. APPOINTMENT HISTORY ── */}
      <SectionCard icon={Calendar} title="Appointment History" subtitle="Visits by status, type and pet">
        {appt.totalAppointments === 0 ? (
          <EmptyHint>No appointments found in the last 2 years.</EmptyHint>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-600 text-slate-500 font-body mb-3">By status</p>
              <ComposedBar data={appt.byStatus.map(s => ({ name: s.status, count: s.count }))} labelKey="name" valueKey="count" color="#0ea5e9" />
            </div>
            <div>
              <p className="text-xs font-600 text-slate-500 font-body mb-3">By type</p>
              {appt.byType.length === 0 ? (
                <EmptyHint>No typed appointments.</EmptyHint>
              ) : (
                <ComposedBar data={appt.byType.map(s => ({ name: s.type, count: s.count }))} labelKey="name" valueKey="count" color="#14b8a6" />
              )}
            </div>
          </div>
        )}
        {appt.byPet.length > 0 && appt.byPet.some(p => p.total > 0) && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs font-600 text-slate-500 font-body mb-2">Per pet</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {appt.byPet.filter(p => p.total > 0).map(p => (
                <div key={p.petId} className="flex items-center justify-between text-sm font-body bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-slate-700 font-500">{p.petName}</span>
                  <span className="text-slate-400 text-xs">
                    {p.completed} done · {p.upcoming} upcoming · {p.cancelled} cancelled
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 6. MEDICATION ADHERENCE ── */}
      <SectionCard
        icon={Pill}
        title="Medication Adherence"
        subtitle="Prescription status across pets"
        right={<StatusBadge tone={med.adherenceRate >= 80 ? 'green' : med.adherenceRate >= 50 ? 'amber' : (med.adherenceRate > 0 ? 'red' : 'slate')}>{med.adherenceRate}% adherence</StatusBadge>}
      >
        {med.totalPrescriptions === 0 ? (
          <EmptyHint>No prescriptions on record.</EmptyHint>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatTile label="Total" value={med.totalPrescriptions} tone="slate" />
              <StatTile label="Active" value={med.active} tone="green" />
              <StatTile label="Completed" value={med.completed} tone="blue" />
              <StatTile label="Discontinued" value={med.discontinued} tone="red" />
            </div>
            {med.byPet.length > 0 && med.byPet.some(p => p.total > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-600 text-slate-500 font-body mb-1">Per pet</p>
                {med.byPet.filter(p => p.total > 0).map(p => (
                  <div key={p.petId} className="flex items-center justify-between text-sm font-body">
                    <span className="text-slate-700 font-500">{p.petName}</span>
                    <div className="flex items-center gap-2">
                      {p.active > 0 && <StatusBadge tone="green">{p.active} active</StatusBadge>}
                      {p.completed > 0 && <StatusBadge tone="blue">{p.completed} done</StatusBadge>}
                      {p.discontinued > 0 && <StatusBadge tone="red">{p.discontinued} stopped</StatusBadge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── 7. LABORATORY TRENDS ── */}
      <SectionCard icon={FlaskConical} title="Laboratory Trends" subtitle="Diagnostic results over time">
        {lab.totalLabResults === 0 ? (
          <EmptyHint>No laboratory results on file.</EmptyHint>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 text-sm font-body text-slate-500">
              <FlaskConical className="w-4 h-4 text-teal-600" />
              <span>{lab.totalLabResults} lab result{lab.totalLabResults !== 1 ? 's' : ''} recorded</span>
            </div>
            {lab.byMonth.length > 0 ? (
              <ComposedBar data={lab.byMonth.map(m => ({ name: fmtMonth(m.month), count: m.count }))} labelKey="name" valueKey="count" color="#a855f7" height={200} />
            ) : (
              <div className="space-y-2">
                {lab.byPet.filter(p => p.count > 0).map(p => (
                  <div key={p.petId} className="flex items-center justify-between text-sm font-body bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="text-slate-700 font-500">{p.petName}</span>
                    <span className="text-slate-400 text-xs">{p.count} result{p.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── 8. PREVENTIVE CARE ── */}
      <SectionCard icon={ShieldCheck} title="Preventive Care" subtitle="Upcoming and overdue preventive items">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Upcoming Vaccines" value={prev.upcomingVaccines} tone="blue" />
          <StatTile label="Overdue Vaccines" value={prev.overdueVaccines} tone={prev.overdueVaccines > 0 ? 'red' : 'slate'} />
          <StatTile label="Due Dewormings" value={prev.dueDewormings} tone={prev.dueDewormings > 0 ? 'amber' : 'slate'} />
          <StatTile label="Last Wellness" value={prev.lastWellnessVisit ? fmtDate(prev.lastWellnessVisit).split(',')[0] : '—'} tone="teal" />
        </div>
        {prev.byPet.length > 0 && prev.byPet.some(p => p.upcomingVaccines || p.overdueVaccines || p.dueDewormings) && (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-600 text-slate-500 font-body mb-1">Per pet</p>
            {prev.byPet.filter(p => p.upcomingVaccines || p.overdueVaccines || p.dueDewormings).map(p => (
              <div key={p.petId} className="flex items-center justify-between text-sm font-body">
                <span className="text-slate-700 font-500">{p.petName}</span>
                <div className="flex items-center gap-2">
                  {p.upcomingVaccines > 0 && <StatusBadge tone="blue">{p.upcomingVaccines} due</StatusBadge>}
                  {p.overdueVaccines > 0 && <StatusBadge tone="red">{p.overdueVaccines} overdue</StatusBadge>}
                  {p.dueDewormings > 0 && <StatusBadge tone="amber">{p.dueDewormings} deworm</StatusBadge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── 9. HEALTH TIMELINE ── */}
      <SectionCard icon={Clock} title="Health Timeline" subtitle="Recent care events">
        {!data.healthTimeline || data.healthTimeline.length === 0 ? (
          <EmptyHint>No timeline events yet.</EmptyHint>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 space-y-4">
            {data.healthTimeline.slice(0, 25).map(ev => (
              <li key={ev.id} className="ml-4">
                <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white" />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={timelineKindTone[ev.kind] || 'slate'}>{timelineKindLabel[ev.kind] || ev.kind}</StatusBadge>
                  <span className="text-xs font-body text-slate-400">{fmtDate(ev.date)}</span>
                </div>
                <p className="text-sm font-body text-slate-600 mt-1">{ev.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* ── 10. VETERINARY INSIGHTS / RECOMMENDATIONS ── */}
      <SectionCard icon={Lightbulb} title="Veterinary Insights & Recommendations" subtitle="Auto-generated flags from your pet's records">
        {insights.flags.length === 0 && insights.recommendations.length === 0 ? (
          <div className="flex items-center gap-3 text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Everything looks on track — no action items flagged right now.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.flags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-600 text-slate-500 font-body">Flags</p>
                {insights.flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm font-body rounded-xl px-3 py-2 border"
                    style={{
                      background: f.severity === 'high' ? '#fef2f2' : f.severity === 'medium' ? '#fffbeb' : '#f0f9ff',
                      borderColor: f.severity === 'high' ? '#fecaca' : f.severity === 'medium' ? '#fde68a' : '#bae6fd',
                    }}>
                    {f.severity === 'high'
                      ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      : f.severity === 'medium'
                        ? <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        : <Stethoscope className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
                    <span className={f.severity === 'high' ? 'text-red-700' : f.severity === 'medium' ? 'text-amber-700' : 'text-blue-700'}>{f.message}</span>
                  </div>
                ))}
              </div>
            )}
            {insights.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-600 text-slate-500 font-body">Recommendations</p>
                {insights.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm font-body text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    {r.priority === 'high' ? <TrendingUp className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      : r.priority === 'medium' ? <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        : <TrendingDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ClientAnalyticsPage;
