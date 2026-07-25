import { PawPrint, Calendar, CheckCircle, Clock, FileText, ListChecks, Activity, XCircle } from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, LineChart, DonutChart, SparkLine } from '../../components/healthcheck/charts';

function ClientHealthCheck({ data }) {
  const k = data.kpis;
  const c = data.charts;
  const pets = data.pets || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={PawPrint}    color="sky"     label="Your pets"        value={k.totalPets} />
        <KpiTile icon={Calendar}    color="blue"    label="Visits booked"    value={k.totalAppointments}
                 sparkline={<SparkLine data={c.appointmentsByDay} />} />
        <KpiTile icon={CheckCircle} color="emerald" label="Completed visits" value={k.completed} />
        <KpiTile icon={Clock}       color="amber"   label="Upcoming"         value={k.upcoming} />

        <KpiTile icon={FileText}    color="violet"  label="Medical records"  value={k.medicalRecords} />
        <KpiTile icon={ListChecks}  color="teal"    label="Follow-ups"       value={k.followUpsScheduled}
                 sublabel="scheduled ahead" />
        <KpiTile icon={XCircle}     color="red"     label="Cancellations"    value={k.cancelled} />
        <KpiTile icon={Activity}    color="slate"   label="Window"           value={`${data.window.start.slice(5)} → ${data.window.end.slice(5)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Visits over time"
            csvFilename="client-appointments-by-day"
            csvData={c.appointmentsByDay}>
            <LineChart data={c.appointmentsByDay} />
          </ChartCard>
        </div>
        <ChartCard title="By status"
          csvFilename="client-appointments-by-status"
          csvData={c.appointmentsByStatus}>
          <DonutChart data={c.appointmentsByStatus} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Visit types"
          csvFilename="client-appointments-by-type"
          csvData={c.appointmentsByType}>
          <BarChart data={c.appointmentsByType} />
        </ChartCard>
        <ChartCard title="Visits per pet"
          csvFilename="client-visits-by-pet"
          csvData={c.visitsByPet}>
          <BarChart data={c.visitsByPet} />
        </ChartCard>
      </div>

      {/* Per-pet weight trend */}
      {c.weightTrendByPet && c.weightTrendByPet.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-slate-700 dark:text-white text-lg font-700">Weight trend per pet</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {c.weightTrendByPet.map((pt) => (
              <ChartCard key={pt.petId}
                title={pt.petName}
                subtitle={`${pt.series.length} weighed visit${pt.series.length === 1 ? '' : 's'}`}
                csvFilename={`weight-${pt.petName}`}
                csvData={pt.series}>
                <LineChart
                  data={pt.series.map((s) => ({ day: s.date, weight: s.weight }))}
                  xKey="day" yKey="weight"
                />
              </ChartCard>
            ))}
          </div>
        </section>
      )}

      {/* Pet directory */}
      {pets.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-5">
          <h3 className="font-display text-slate-800 dark:text-white text-base font-700 mb-3">Your pets at a glance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/10">
                  <th className="py-2 pr-4 font-600">Pet</th>
                  <th className="py-2 pr-4 font-600">Species</th>
                  <th className="py-2 pr-4 font-600">Visits</th>
                  <th className="py-2 pr-4 font-600">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {pets.map((p) => (
                  <tr key={p.petId} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200 font-500">{p.petName}</td>
                    <td className="py-2 pr-4 text-slate-500 capitalize">{p.species || '—'}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{p.visits}</td>
                    <td className="py-2 pr-4 text-slate-500">{p.lastVisit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default ClientHealthCheck;
