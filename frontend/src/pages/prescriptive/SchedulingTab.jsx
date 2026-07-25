/**
 * SchedulingTab.jsx
 * Dynamic scheduling recommendations — conflicts, sterilization gaps,
 * vet load balancing, equipment readiness.
 */
import {
  Calendar, AlertOctagon, Stethoscope, Wrench, GaugeCircle,
} from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart } from '../../components/healthcheck/charts';
import RecommendationCard from '../../components/prescriptive/RecommendationCard';

function SchedulingTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Generating scheduling actions…' : 'No scheduling recommendations yet.'}
      </div>
    );
  }

  const k = data.kpis || {};
  const recs = data.recommendations || [];
  const vetLoad = (data.vetLoad || [])
    .sort((a, b) => (b.utilization_pct || 0) - (a.utilization_pct || 0))
    .slice(0, 10)
    .map((v) => ({ key: v.vet_name || '—', count: v.utilization_pct || 0 }));
  const equipment = data.equipmentStatus || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar}     color="blue"
                 label="Upcoming appts" value={k.upcomingAppointments}
                 sublabel={`${k.surgicalAppointments} surgical`} />
        <KpiTile icon={AlertOctagon} color="red"
                 label="Conflicts" value={k.conflictsCount}
                 sublabel="Double-booked vets" />
        <KpiTile icon={Wrench}       color="violet"
                 label="Equipment ready" value={k.equipmentReady}
                 sublabel={`${k.equipmentSterilizing} sterilizing`} />
        <KpiTile icon={GaugeCircle}  color="amber"
                 label="Vets overloaded" value={k.overloadedVets}
                 sublabel={`${k.underloadedVets} under-utilised`} />
      </div>

      {/* Recommendations */}
      <section>
        <h2 className="font-display text-slate-800 dark:text-white text-base font-700 mb-3">
          Recommended actions
          <span className="ml-2 text-xs font-body text-slate-400">{recs.length} total</span>
        </h2>
        {recs.length === 0 ? (
          <div className="p-6 text-center text-slate-400 font-body text-xs border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
            No scheduling issues detected — clinic schedule is balanced.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recs.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        )}
      </section>

      {/* Vet load + equipment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Vet utilisation"
          subtitle="Booked minutes / available minutes — next 30 days"
          csvFilename="vet-utilization"
          csvData={data.vetLoad}
          csvColumns={['vet_name','weekly_avail_minutes','upcoming_count','upcoming_minutes','utilization_pct']}
        >
          <HBarChart data={vetLoad} />
        </ChartCard>
        <ChartCard
          title="Equipment readiness"
          subtitle="Sterilization cycle status by item"
          csvFilename="equipment-status"
          csvData={equipment.map((e) => ({
            name: e.name, category: e.category, status: e.status,
            sterilization_cycle_mins: e.sterilization_cycle_mins,
            last_used_at: e.last_used_at, available_after: e.available_after,
          }))}
          csvColumns={['name','category','status','sterilization_cycle_mins','last_used_at','available_after']}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Ready at</th>
                </tr>
              </thead>
              <tbody>
                {equipment.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                    No equipment registered yet.
                  </td></tr>
                )}
                {equipment.slice(0, 12).map((e) => (
                  <tr key={e.equipment_id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{e.name}</td>
                    <td className="py-2 pr-3 text-slate-500 text-xs uppercase tracking-wider">{e.category || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-body font-700 uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        e.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500 text-xs">
                      {e.available_after ? new Date(e.available_after).toLocaleString() : 'now'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <p className="text-xs font-body text-slate-400 italic">
        Engine: conflict detection on overlapping vet bookings, sterilization-window
        check against surgical appointment times, vet load-balancing heuristic.
      </p>
    </div>
  );
}

export default SchedulingTab;
