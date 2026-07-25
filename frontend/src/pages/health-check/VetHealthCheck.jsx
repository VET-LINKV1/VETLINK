import { Calendar, CheckCircle, XCircle, Clock, PawPrint, FileText, ListChecks, Stethoscope } from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart, LineChart, DonutChart, SparkLine } from '../../components/healthcheck/charts';

function VetHealthCheck({ data }) {
  const k = data.kpis;
  const c = data.charts;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar}    color="blue"    label="My appointments" value={k.totalAppointments}
                 sparkline={<SparkLine data={c.appointmentsByDay} />} />
        <KpiTile icon={CheckCircle} color="emerald" label="Completed"        value={k.completed}
                 sublabel={`${k.uniquePets} unique pets seen`} />
        <KpiTile icon={Clock}       color="amber"   label="Upcoming"         value={k.upcoming} />
        <KpiTile icon={XCircle}     color="red"     label="Cancellations"    value={k.cancelled}
                 sublabel={`${k.cancellationRate}% rate`} />

        <KpiTile icon={Clock}       color="sky"     label="Avg duration"     value={`${k.avgDurationMins}m`} />
        <KpiTile icon={FileText}    color="violet"  label="Records authored" value={k.medicalRecords} />
        <KpiTile icon={ListChecks}  color="teal"    label="Follow-ups due"   value={k.followUpsDue} />
        <KpiTile icon={PawPrint}    color="slate"   label="Unique pets"      value={k.uniquePets} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="My caseload over time"
            subtitle="Appointments per day"
            csvFilename="vet-appointments-by-day"
            csvData={c.appointmentsByDay}
          >
            <LineChart data={c.appointmentsByDay} />
          </ChartCard>
        </div>
        <ChartCard title="By status"
          csvFilename="vet-appointments-by-status"
          csvData={c.appointmentsByStatus}
        >
          <DonutChart data={c.appointmentsByStatus} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Appointment types"
          csvFilename="vet-appointments-by-type"
          csvData={c.appointmentsByType}
        >
          <HBarChart data={c.appointmentsByType.slice(0, 8)} />
        </ChartCard>
        <ChartCard title={<span className="inline-flex items-center gap-1.5"><Stethoscope className="w-4 h-4" /> Top diagnoses I've recorded</span>}
          csvFilename="vet-top-diagnoses"
          csvData={c.topDiagnoses}
        >
          <HBarChart data={c.topDiagnoses.slice(0, 10)} />
        </ChartCard>
      </div>

      <ChartCard title="Pets treated by species"
        csvFilename="vet-pets-by-species"
        csvData={c.petsTreatedBySpecies}
      >
        <BarChart data={c.petsTreatedBySpecies} />
      </ChartCard>
    </div>
  );
}

export default VetHealthCheck;
