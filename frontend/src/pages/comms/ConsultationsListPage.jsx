/**
 * ConsultationsListPage.jsx
 * Lists upcoming + recent video consultations. Used by both staff and clients;
 * the same component renders for /telehealth (staff) and /client/telehealth (client).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { commsService } from '../../services/commsService';
import { Video, Loader2, Plus, Clock, User, CheckCircle2, XCircle } from 'lucide-react';

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'in_progress', label: 'Live' },
  { key: 'completed',   label: 'Completed' },
];

function statusPill(s) {
  const map = {
    scheduled:    'bg-slate-100 text-slate-700',
    waiting:      'bg-amber-100 text-amber-700',
    in_progress:  'bg-emerald-100 text-emerald-700',
    completed:    'bg-blue-100 text-blue-700',
    cancelled:    'bg-red-100 text-red-700',
    no_show:      'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-slate-100 text-slate-700';
}

export default function ConsultationsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await commsService.listConsultations({
        status: filter === 'all' ? undefined : filter,
        days:   60,
      });
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load consultations.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600" /> Telehealth
          </h1>
          <p className="text-xs font-body text-slate-400">Video consultations — scheduled, live, and past.</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-body font-600 transition-colors
              ${filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-600 font-body">{error}</p>
        ) : !items.length ? (
          <div className="p-10 text-center">
            <Video className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-body text-slate-400">No consultations to show.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-white/5">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/telehealth/${c.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate flex-1">
                        {c.subject || 'Video consultation'}
                      </p>
                      <span className={`text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full ${statusPill(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-body text-slate-400">
                      {c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(c.scheduled_at).toLocaleString()}
                        </span>
                      )}
                      {c.client_name && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3" /> {c.client_name}
                        </span>
                      )}
                      {c.veterinarian_name && (
                        <span className="truncate">Vet: {c.veterinarian_name}</span>
                      )}
                    </div>
                  </div>
                  {c.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {(c.status === 'cancelled' || c.status === 'no_show') && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
