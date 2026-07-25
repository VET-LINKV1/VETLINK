import { PawPrint, Calendar, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SPECIES_EMOJI = {
  Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇',
  Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾',
};

const CLASSIFICATION_CONFIG = {
  regular:    { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  icon: TrendingUp,   dot: 'bg-green-500' },
  occasional: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  icon: Minus,        dot: 'bg-amber-500' },
  irregular:  { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    icon: TrendingDown, dot: 'bg-red-500' },
  new_patient:{ bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   icon: TrendingUp,   dot: 'bg-blue-500' },
  no_visits:  { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-500',  icon: Minus,        dot: 'bg-slate-400' },
};

function PetVisitCard({ analytics }) {
  const { pet, totalVisits, lastVisit, daysSinceLast, frequency, upcomingCount } = analytics;
  const cfg = CLASSIFICATION_CONFIG[frequency.classification] || CLASSIFICATION_CONFIG.no_visits;
  const FreqIcon = cfg.icon;

  const formatLastVisit = (iso) => {
    if (!iso) return 'No visits yet';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-shadow p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl">
            {SPECIES_EMOJI[pet.species] || '🐾'}
          </div>
          <div>
            <h3 className="font-display text-slate-800 font-700">{pet.name}</h3>
            <p className="text-slate-400 text-xs font-body">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
          </div>
        </div>

        {/* Frequency badge */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1.5 rounded-xl border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {frequency.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="font-display text-slate-800 text-xl font-700">{totalVisits}</p>
          <p className="text-slate-400 text-xs font-body mt-0.5">Total Visits</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="font-display text-slate-800 text-xl font-700">
            {daysSinceLast != null ? daysSinceLast : '—'}
          </p>
          <p className="text-slate-400 text-xs font-body mt-0.5">Days Since Last</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="font-display text-slate-800 text-xl font-700">{upcomingCount}</p>
          <p className="text-slate-400 text-xs font-body mt-0.5">Upcoming</p>
        </div>
      </div>

      {/* Last visit */}
      <div className="flex items-center gap-2 text-xs font-body text-slate-400 pt-3 border-t border-slate-100">
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span>Last visit: <span className="text-slate-600 font-500">{formatLastVisit(lastVisit)}</span></span>
      </div>
    </div>
  );
}

export default PetVisitCard;
