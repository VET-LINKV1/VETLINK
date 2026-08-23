/**
 * RecentPetActivity.jsx — Recent Pet Activity rail for the Admin Pet Records page.
 * Shows newly registered pets, recently updated records, recent visits, and
 * upcoming/overdue vaccinations derived from the loaded pet list.
 */
import { Pencil, Syringe, Stethoscope, PawPrint, Clock } from 'lucide-react';

const SPECIES_EMOJI = { Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇', Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾' };

function relTime(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export default function RecentPetActivity({ pets = [], vaccinations = [] }) {
  // Build events from the current pet list.
  const events = [];

  pets.forEach(p => {
    events.push({ kind: 'registered', pet: p, at: p.created_at,
      text: `${p.name} was registered`, sub: `${p.species} · ${p.ownerName || 'owner'}` });
    if (p.updated_at && p.updated_at !== p.created_at) {
      events.push({ kind: 'updated', pet: p, at: p.updated_at,
        text: `Record for ${p.name} updated`, sub: 'Profile changed' });
    }
    if (p.lastVisit) {
      events.push({ kind: 'visit', pet: p, at: p.lastVisit,
        text: `${p.name} had a visit`, sub: p.assignedVet ? `with ${p.assignedVet}` : 'at clinic' });
    }
    if (p.vaccinationStatus === 'overdue') {
      events.push({ kind: 'vax', pet: p, at: p.updated_at,
        text: `${p.name} has overdue vaccination`, sub: 'Requires attention' });
    }
  });

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  const top = events.slice(0, 8);

  const ICONS = { registered: PawPrint, updated: Pencil, visit: Stethoscope, vax: Syringe };
  const TINTS = {
    registered: 'bg-emerald-50 text-emerald-600',
    updated:    'bg-blue-50 text-blue-600',
    visit:      'bg-teal-50 text-teal-600',
    vax:        'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/10">
        <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Clock className="w-3.5 h-3.5" /></span>
        <h3 className="font-display text-slate-800 dark:text-white text-sm font-600">Recent Pet Activity</h3>
      </div>
      <div className="p-4">
        {top.length === 0 ? (
          <p className="text-center text-slate-400 text-sm font-body py-6">No recent activity.</p>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-white/10 rounded-full" />
            {top.map((ev, i) => {
              const Icon = ICONS[ev.kind] || Clock;
              return (
                <div key={i} className="relative pl-9">
                  <span className={`absolute left-[8px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${TINTS[ev.kind] || 'bg-slate-400'}`} />
                  <div className="flex items-start gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${TINTS[ev.kind] || 'bg-slate-100'}`}>
                      {SPECIES_EMOJI[ev.pet?.species] || '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-slate-700 dark:text-slate-200 font-600">{ev.text}</p>
                      <p className="text-xs text-slate-400 font-body">{ev.sub}</p>
                      <p className="text-[11px] text-slate-300 font-body mt-0.5">{relTime(ev.at)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
