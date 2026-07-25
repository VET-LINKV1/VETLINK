import { Calendar, CheckCircle, Clock, XCircle, Wallet, AlertCircle, CreditCard } from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { HBarChart, LineChart, DonutChart, SparkLine } from '../../components/healthcheck/charts';

function fmtPHP(n) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
}

function StaffHealthCheck({ data }) {
  const k = data.kpis;
  const c = data.charts;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar}    color="blue"    label="Appointments"    value={k.totalAppointments}
                 sparkline={<SparkLine data={c.appointmentsByDay} />} />
        <KpiTile icon={Clock}       color="amber"   label="Pending"          value={k.pending} />
        <KpiTile icon={Calendar}    color="sky"     label="Confirmed"        value={k.confirmed} />
        <KpiTile icon={CheckCircle} color="emerald" label="Completed"        value={k.completed} />

        <KpiTile icon={XCircle}     color="red"     label="Cancellations"    value={k.cancelled}
                 sublabel={`${k.noShowRate}% no-show rate`} />
        <KpiTile icon={Wallet}      color="violet"  label="Collected"        value={fmtPHP(k.collectedPHP)} />
        <KpiTile icon={AlertCircle} color="amber"   label="Outstanding"      value={fmtPHP(k.outstandingPHP)} />
        <KpiTile icon={CreditCard}  color="teal"    label="Successful payments" value={k.paidCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Appointment volume" subtitle="Per day"
            csvFilename="staff-appointments-by-day"
            csvData={c.appointmentsByDay}>
            <LineChart data={c.appointmentsByDay} />
          </ChartCard>
        </div>
        <ChartCard title="Status mix"
          csvFilename="staff-appointments-by-status"
          csvData={c.appointmentsByStatus}>
          <DonutChart data={c.appointmentsByStatus} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Caseload by veterinarian"
          csvFilename="staff-appointments-by-vet"
          csvData={c.appointmentsByVet}>
          <HBarChart data={c.appointmentsByVet.slice(0, 8)} />
        </ChartCard>
        <ChartCard title="Top services booked"
          csvFilename="staff-appointments-by-type"
          csvData={c.appointmentsByType}>
          <HBarChart data={c.appointmentsByType.slice(0, 8)} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Payments by status"
          csvFilename="staff-payments-by-status"
          csvData={c.paymentsByStatus}>
          <DonutChart data={c.paymentsByStatus} />
        </ChartCard>
        <ChartCard title="Payment methods used"
          subtitle="Among successful payments"
          csvFilename="staff-payments-by-method"
          csvData={c.paymentsByMethod}>
          <DonutChart data={c.paymentsByMethod} />
        </ChartCard>
      </div>
    </div>
  );
}

export default StaffHealthCheck;
