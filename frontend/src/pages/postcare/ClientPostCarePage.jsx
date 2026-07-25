/**
 * ClientPostCarePage.jsx
 *
 * Client portal for the Integrated Post-Care & Pharmacy Hub.
 * Three tabs:
 *   - Discharges     (per pet / appointment)
 *   - Prescriptions  (refill requests)
 *   - Reminders      (medication reminders manager)
 *
 * Mounted at /client/postcare.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ClipboardCheck, RefreshCw, Bell, PawPrint, Loader2, AlertCircle, ChevronRight, Calendar,
} from 'lucide-react';
import { clientService }    from '../../services/clientService';
import { postCareService }  from '../../services/postCareService';
import { emrService }       from '../../services/emrService';
import DischargeView        from '../../components/postcare/DischargeView';
import RefillRequestPanel   from '../../components/postcare/RefillRequestPanel';
import ReminderManager      from '../../components/postcare/ReminderManager';

const TABS = [
  { key: 'discharges',    label: 'Discharges',     Icon: ClipboardCheck },
  { key: 'prescriptions', label: 'Prescriptions',  Icon: RefreshCw      },
  { key: 'reminders',     label: 'Reminders',      Icon: Bell           },
];

export default function ClientPostCarePage() {
  const [tab, setTab]         = useState('discharges');
  const [pets, setPets]       = useState([]);
  const [pet,  setPet]        = useState(null);

  // discharges
  const [discharges, setDischarges] = useState([]);
  const [activeDischarge, setActiveDischarge] = useState(null);

  // refills
  const [activeRx, setActiveRx]       = useState([]);
  const [refills,  setRefills]        = useState([]);

  // reminders
  const [reminders, setReminders]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const loadPets = useCallback(async () => {
    const list = await clientService.getPets();
    setPets(list || []);
    if (!pet && list?.[0]) setPet(list[0]);
  }, [pet]);

  const loadAll = useCallback(async () => {
    if (!pet) return;
    setLoading(true); setErr('');
    try {
      const [d, rx, mine, rems] = await Promise.all([
        postCareService.listDischargesForPet(pet.id),
        emrService.listPrescriptions(pet.id),
        postCareService.listMyRefills(),
        postCareService.listReminders(),
      ]);
      setDischarges(d || []);
      setActiveRx((rx || []).filter(r => r.status === 'active'));
      setRefills(mine || []);
      setReminders(rems || []);
      // Default-open most recent discharge
      if (d?.length && !activeDischarge) {
        const full = await postCareService.getDischargeByAppointment(d[0].appointment_id);
        setActiveDischarge(full);
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load post-care.');
    } finally { setLoading(false); }
  }, [pet, activeDischarge]);

  useEffect(() => { loadPets(); }, []); // eslint-disable-line
  useEffect(() => { if (pet) loadAll(); }, [pet?.id]); // eslint-disable-line

  const refillsForPet = useMemo(() =>
    refills.filter(r => r.pet?.id === pet?.id || r.prescription?.pet_id === pet?.id),
    [refills, pet]
  );

  const remindersForPet = useMemo(() =>
    reminders.filter(r => r.pet?.id === pet?.id),
    [reminders, pet]
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Post-Care & Pharmacy</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">
          Discharge instructions, refill requests, and medication reminders — all in one place.
        </p>
      </header>

      {/* Pet picker */}
      {pets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pets.map((p) => (
            <button key={p.id} onClick={() => { setPet(p); setActiveDischarge(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-body font-600 border transition-colors
                ${pet?.id === p.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <PawPrint className="w-3.5 h-3.5" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-1 flex flex-wrap gap-1">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 transition-colors
              ${tab === key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : !pet ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
          <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-body">You have no pets registered yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
          {tab === 'discharges' && (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
              <aside>
                <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
                  Discharges
                </p>
                {!discharges.length ? (
                  <p className="text-sm text-slate-400 font-body italic">None yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {discharges.map((d) => {
                      const active = activeDischarge?.appointment_id === d.appointment_id;
                      return (
                        <li key={d.id}>
                          <button
                            onClick={async () => {
                              const full = await postCareService.getDischargeByAppointment(d.appointment_id);
                              setActiveDischarge(full);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-start gap-2
                              ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-body font-600 text-slate-700 truncate">{d.title}</p>
                              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                                {new Date(d.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
              <div className="min-w-0">
                <DischargeView discharge={activeDischarge} />
              </div>
            </div>
          )}

          {tab === 'prescriptions' && (
            <RefillRequestPanel activeRx={activeRx} myRequests={refillsForPet} onChange={loadAll} />
          )}

          {tab === 'reminders' && (
            <ReminderManager activeRx={activeRx} reminders={remindersForPet} onChange={loadAll} />
          )}
        </div>
      )}
    </div>
  );
}
