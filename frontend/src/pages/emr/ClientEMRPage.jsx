/**
 * ClientEMRPage.jsx
 * Read-only EMR view that pet owners see for their own pets.
 * Pulls the same /api/emr endpoints — backend authorizes by ownership.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  PawPrint, Stethoscope, Syringe, Pill, Activity, FileText, Loader2, BarChart3,
} from 'lucide-react';
import { emrService } from '../../services/emrService';

import EMRTimeline       from '../../components/emr/EMRTimeline';
import SOAPNoteList      from '../../components/emr/SOAPNoteList';
import VaccinationTracker from '../../components/emr/VaccinationTracker';
import PrescriptionManager from '../../components/emr/PrescriptionManager';
import TreatmentTracker  from '../../components/emr/TreatmentTracker';
import EMRFileGallery    from '../../components/emr/EMRFileGallery';

const TABS = [
  { key: 'timeline',      label: 'Timeline',      icon: BarChart3    },
  { key: 'soap',          label: 'SOAP Notes',    icon: Stethoscope },
  { key: 'vaccinations',  label: 'Vaccinations',  icon: Syringe     },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill        },
  { key: 'treatments',    label: 'Treatments',    icon: Activity    },
  { key: 'files',         label: 'Files',         icon: FileText    },
];

export default function ClientEMRPage() {
  const [clients, setClients] = useState([]);     // will contain just the calling client
  const [pet, setPet]         = useState(null);
  const [chart, setChart]     = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tab, setTab] = useState('timeline');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cs = await emrService.listClientsWithPets();
      setClients(cs);
      const firstPet = cs?.[0]?.pets?.[0];
      if (firstPet) setPet(firstPet);
    } finally { setLoading(false); }
  }, []);

  const loadChart = useCallback(async (petId) => {
    const [c, tl] = await Promise.all([
      emrService.getPetChart(petId),
      emrService.getPetTimeline(petId, { limit: 200 }),
    ]);
    setChart(c); setTimeline(tl);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (pet?.id) loadChart(pet.id); }, [pet?.id, loadChart]);

  const myPets = clients[0]?.pets || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">My Pets' Records</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">
          View your pet's medical history, prescriptions, vaccinations, and uploaded documents.
        </p>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : !myPets.length ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-10 text-center">
          <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-body">You don't have any pets registered yet.</p>
        </div>
      ) : (
        <>
          {/* Pet picker */}
          <div className="flex flex-wrap gap-2">
            {myPets.map((p) => (
              <button key={p.id} onClick={() => setPet(p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-body font-600 border transition-colors
                  ${pet?.id === p.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <PawPrint className="w-4 h-4" /> {p.name}
                <span className="text-xs opacity-80">{p.species}</span>
              </button>
            ))}
          </div>

          {pet && (
            <>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-5">
                <p className="font-display text-2xl font-700">{pet.name}</p>
                <p className="font-body text-sm text-blue-100">
                  {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                  {pet.age != null ? ` · ${pet.age}y` : ''}
                  {pet.gender ? ` · ${pet.gender}` : ''}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-1 flex flex-wrap gap-1 overflow-x-auto scrollbar-thin">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 whitespace-nowrap transition-colors
                      ${tab === key
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
                {tab === 'timeline'      && <EMRTimeline events={timeline} />}
                {tab === 'soap'          && <SOAPNoteList notes={chart?.recentSoapNotes || []} canWrite={false} />}
                {tab === 'vaccinations'  && <VaccinationTracker petId={pet.id} vaccinations={chart?.vaccinations || []} canWrite={false} />}
                {tab === 'prescriptions' && <PrescriptionManager petId={pet.id} prescriptions={chart?.prescriptions || []} canWrite={false} />}
                {tab === 'treatments'    && <TreatmentTracker petId={pet.id} treatments={chart?.treatments || []} canWrite={false} />}
                {tab === 'files'         && <EMRFileGallery petId={pet.id} files={chart?.files || []} canWrite={false} />}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
