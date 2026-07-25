import {
  Activity, Calendar, CheckCircle, XCircle, PawPrint, Users,
  Wallet, Stethoscope, Syringe, FileText, TrendingUp,
} from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart, LineChart, DonutChart, SparkLine } from '../../components/healthcheck/charts';

function fmtPHP(n) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
}

function AdminHealthCheck({ data }) {
  const k = data.kpis;
  const c = data.charts;

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar}   color="blue"    label="Appointments"    value={k.totalAppointments}
                 sublabel={`${k.completionRate}% completion`} sparkline={<SparkLine data={c.appointmentsByDay} valueKey="total" />} />
        <KpiTile icon={CheckCircle} color="emerald" label="Completed"       value={k.completed} />
        <KpiTile icon={XCircle}     color="red"     label="Cancelled"       value={k.cancelled}
                 sublabel={`${k.noShowRate}% no-show`} />
        <KpiTile icon={Wallet}      color="violet"  label="Revenue"         value={fmtPHP(k.totalRevenuePHP)}
                 sublabel={`${fmtPHP(k.pendingRevenuePHP)} pending`} />

        <KpiTile icon={PawPrint}    color="sky"     label="Pets registered" value={k.totalPets} />
        <KpiTile icon={Users}       color="teal"    label="Active users"    value={k.activeUsers} />
        <KpiTile icon={Syringe}     color="amber"   label="Vaccinated pets" value={`${k.vaccinatedPets}`}
                 sublabel={`${k.vaccinationRate}% in last 12 mo`} />
        <KpiTile icon={FileText}    color="slate"   label="Medical records" value={k.medicalRecords} />
      </div>

      {/* Appointments group */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard
            title="Appointments per day"
            subtitle="By status, across the selected window"
            csvFilename="appointments-by-day"
            csvData={c.appointmentsByDay}
          >
            <LineChart data={c.appointmentsByDay} stacked={['pending','confirmed','completed','cancelled']} />
          </ChartCard>
        </div>
        <ChartCard
          title="Status breakdown"
          subtitle="Share of appointment outcomes"
          csvFilename="appointments-by-status"
          csvData={c.appointmentsByStatus}
        >
          <DonutChart data={c.appointmentsByStatus} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Top appointment types"
          csvFilename="appointments-by-type"
          csvData={c.appointmentsByType}
        >
          <HBarChart data={c.appointmentsByType.slice(0, 8)} />
        </ChartCard>
        <ChartCard
          title="Caseload by veterinarian"
          csvFilename="appointments-by-vet"
          csvData={c.appointmentsByVet}
        >
          <HBarChart data={c.appointmentsByVet.slice(0, 8)} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Day of week distribution"
          subtitle="When patients book"
          csvFilename="appointments-by-day-of-week"
          csvData={c.appointmentsByDow}
        >
          <BarChart data={c.appointmentsByDow} />
        </ChartCard>
        <ChartCard
          title="Pet population — species"
          csvFilename="pets-by-species"
          csvData={c.petsBySpecies}
        >
          <DonutChart data={c.petsBySpecies} />
        </ChartCard>
        <ChartCard
          title="Pet population — gender"
          csvFilename="pets-by-gender"
          csvData={c.petsByGender}
        >
          <DonutChart data={c.petsByGender} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Pet age distribution"
          csvFilename="pets-by-age"
          csvData={c.petsAgeBuckets} csvColumns={['label','count']}
        >
          <BarChart data={c.petsAgeBuckets} labelKey="label" />
        </ChartCard>
        <ChartCard
          title="Pet weight distribution"
          csvFilename="pets-by-weight"
          csvData={c.petsWeightBuckets} csvColumns={['label','count']}
        >
          <BarChart data={c.petsWeightBuckets} labelKey="label" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Top breeds"
          subtitle="Most common breeds in your patient base"
          csvFilename="pets-by-breed"
          csvData={c.petsByBreed}
        >
          <HBarChart data={c.petsByBreed} />
        </ChartCard>
        <ChartCard
          title="Top diagnoses"
          subtitle={<span className="inline-flex items-center gap-1"><Stethoscope className="w-3 h-3" /> from medical records in window</span>}
          csvFilename="top-diagnoses"
          csvData={c.topDiagnoses}
        >
          <HBarChart data={c.topDiagnoses.slice(0, 10)} />
        </ChartCard>
      </div>

      {/* Revenue group */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard
            title="Monthly revenue (PHP)"
            subtitle={<span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> paid transactions only</span>}
            csvFilename="revenue-monthly"
            csvData={c.revenueMonthly}
          >
            <LineChart data={c.revenueMonthly} xKey="month" yKey="amount" />
          </ChartCard>
        </div>
        <ChartCard
          title="Payments by status"
          csvFilename="payments-by-status"
          csvData={c.paymentsByStatus}
        >
          <DonutChart data={c.paymentsByStatus} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Payment methods"
          subtitle="Among successful payments"
          csvFilename="payments-by-method"
          csvData={c.paymentsByMethod}
        >
          <DonutChart data={c.paymentsByMethod} />
        </ChartCard>
        <ChartCard
          title="Users by role"
          csvFilename="users-by-role"
          csvData={c.usersByRole}
        >
          <DonutChart data={c.usersByRole} />
        </ChartCard>
      </div>
    </div>
  );
}

export default AdminHealthCheck;
