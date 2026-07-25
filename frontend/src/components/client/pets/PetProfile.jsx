import { ArrowLeft, PawPrint, Calendar, FileText, Edit2 } from 'lucide-react';
import AppointmentCard from '../appointments/AppointmentCard';

const SPECIES_EMOJI = {
  Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇',
  Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾',
};

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 text-sm font-body">{label}</span>
      <span className="text-slate-700 text-sm font-body font-500 capitalize">{value}</span>
    </div>
  );
}

function PetProfile({ pet, appointments = [], onBack, onEdit }) {
  // Filter appointments for this pet
  const petAppointments = appointments.filter(a => a.pet_id === pet.id);
  const upcoming = petAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed');
  const history  = petAppointments.filter(a => a.status === 'completed' || a.status === 'cancelled');

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-body text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Pet Records
      </button>

      {/* Pet header card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-4 top-4 text-5xl opacity-20 pointer-events-none">
          {SPECIES_EMOJI[pet.species] || '🐾'}
        </div>
        <div className="relative z-10 flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl shrink-0">
            {SPECIES_EMOJI[pet.species] || '🐾'}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-700 mb-1">{pet.name}</h1>
            <p className="text-blue-100 font-body text-sm mb-3">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {pet.age != null && (
                <span className="px-3 py-1 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-body">
                  {pet.age} year{pet.age !== 1 ? 's' : ''} old
                </span>
              )}
              <span className="px-3 py-1 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-body capitalize">
                {pet.gender}
              </span>
              {pet.weight_kg && (
                <span className="px-3 py-1 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-body">
                  {pet.weight_kg} kg
                </span>
              )}
            </div>
          </div>
          <button onClick={() => onEdit(pet)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-body transition-colors shrink-0">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      {/* Pet details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h3 className="font-display text-slate-800 font-600 mb-4 flex items-center gap-2">
          <PawPrint className="w-4 h-4 text-blue-500" /> Pet Details
        </h3>
        <InfoRow label="Species"  value={pet.species} />
        <InfoRow label="Breed"    value={pet.breed} />
        <InfoRow label="Age"      value={pet.age != null ? `${pet.age} year${pet.age !== 1 ? 's' : ''}` : null} />
        <InfoRow label="Gender"   value={pet.gender} />
        <InfoRow label="Weight"   value={pet.weight_kg ? `${pet.weight_kg} kg` : null} />
        {pet.notes && (
          <div className="pt-3 mt-1">
            <p className="text-slate-400 text-xs font-body uppercase tracking-wide mb-1.5">Notes</p>
            <p className="text-slate-600 text-sm font-body leading-relaxed bg-slate-50 rounded-xl p-3">
              {pet.notes}
            </p>
          </div>
        )}
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-slate-800 font-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Upcoming Appointments
          </h3>
          <span className="text-xs font-body text-slate-400">{upcoming.length} scheduled</span>
        </div>
        <div className="p-6">
          {upcoming.length === 0 ? (
            <p className="text-center text-slate-400 text-sm font-body py-4">No upcoming appointments</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map(a => <AppointmentCard key={a.id} appointment={a} onCancel={() => {}} />)}
            </div>
          )}
        </div>
      </div>

      {/* Medical records placeholder */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-slate-800 font-600 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Medical Records
          </h3>
          <span className="text-xs font-body bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">Coming Soon</span>
        </div>
        <div className="p-6 text-center py-10">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-slate-400 font-body text-sm">Medical records will appear here once available</p>
        </div>
      </div>

      {/* Visit history */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-display text-slate-800 font-600">Visit History</h3>
            <span className="text-xs font-body text-slate-400">{history.length} visits</span>
          </div>
          <div className="p-6 space-y-3">
            {history.map(a => <AppointmentCard key={a.id} appointment={a} onCancel={() => {}} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default PetProfile;
