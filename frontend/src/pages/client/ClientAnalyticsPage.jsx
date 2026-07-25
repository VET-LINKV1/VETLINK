import { useMemo } from 'react';
import { BarChart2, PawPrint } from 'lucide-react';
import { usePets } from '../../hooks/usePets';
import { useAppointments } from '../../hooks/useAppointments';
import PetVisitCard from '../../components/client/analytics/PetVisitCard';
import VisitChart from '../../components/client/analytics/VisitChart';
import { buildAllPetsAnalytics } from '../../components/client/analytics/visitAnalytics';

function ClientAnalyticsPage() {
  const { pets, loading: petsLoading }             = usePets();
  const { appointments, loading: apptLoading }     = useAppointments();
  const loading = petsLoading || apptLoading;

  // Build analytics for all pets
  const analytics = useMemo(
    () => buildAllPetsAnalytics(pets, appointments),
    [pets, appointments]
  );

  // Summary stats
  const totalVisits     = analytics.reduce((s, a) => s + a.totalVisits, 0);
  const regularPets     = analytics.filter(a => a.frequency.classification === 'regular').length;
  const irregularPets   = analytics.filter(a => a.frequency.classification === 'irregular').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-800 text-2xl font-700">Analytics</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">Track your pets' visit history and health consistency</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
            <BarChart2 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="font-display text-slate-800 text-2xl font-700">{totalVisits}</p>
          <p className="font-body text-slate-500 text-sm">Total Completed Visits</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center mb-3">
            <PawPrint className="w-5 h-5 text-green-500" />
          </div>
          <p className="font-display text-slate-800 text-2xl font-700">{regularPets}</p>
          <p className="font-body text-slate-500 text-sm">Pets with Regular Check-ups</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-3">
            <PawPrint className="w-5 h-5 text-red-400" />
          </div>
          <p className="font-display text-slate-800 text-2xl font-700">{irregularPets}</p>
          <p className="font-body text-slate-500 text-sm">Pets with Irregular Visits</p>
        </div>
      </div>

      {/* No pets state */}
      {pets.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="font-display text-slate-600 font-600 mb-2">No data yet</h3>
          <p className="text-slate-400 font-body text-sm">Add pets and book appointments to see analytics here.</p>
        </div>
      )}

      {/* Per-pet analytics cards */}
      {analytics.length > 0 && (
        <>
          <h2 className="font-display text-slate-700 text-lg font-600">Per-Pet Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analytics.map(a => (
              <PetVisitCard key={a.pet.id} analytics={a} />
            ))}
          </div>
        </>
      )}

      {/* Visit charts per pet */}
      {analytics.filter(a => a.totalVisits > 0).length > 0 && (
        <>
          <h2 className="font-display text-slate-700 text-lg font-600">Visit History Charts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics
              .filter(a => a.totalVisits > 0)
              .map(a => (
                <VisitChart
                  key={a.pet.id}
                  petName={a.pet.name}
                  data={a.visitsByMonth}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ClientAnalyticsPage;
