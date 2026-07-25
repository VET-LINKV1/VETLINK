/**
 * PassportDashboardPage.jsx
 *
 * Multi-pet Digital Health Passport dashboard.
 *
 * Role behaviour:
 *   - client: lists THEIR pets (no client picker)
 *   - admin/vet/staff: lists all clients in a side picker; selecting
 *     one shows that client's pets
 *
 * Each pet renders as a PetPassportCard, color-coded by overall
 * vaccination status. Clicking opens /passport/pets/:petId.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, PawPrint, Shield, ShieldAlert, AlertTriangle, Filter } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { passportService } from '../../services/passportService';
import { emrService } from '../../services/emrService';
import PetPassportCard from '../../components/passport/PetPassportCard';

const STATUS_FILTERS = [
  { key: 'overdue',       label: 'Overdue',       Icon: AlertTriangle, color: 'text-red-600' },
  { key: 'expiring_soon', label: 'Expiring soon', Icon: ShieldAlert,   color: 'text-amber-600' },
  { key: 'protected',     label: 'Protected',     Icon: Shield,        color: 'text-emerald-600' },
];

export default function PassportDashboardPage() {
  const { user } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();

  const [rows, setRows]         = useState([]);
  const [clients, setClients]   = useState([]);
  const [selClient, setSel]     = useState(null);
  const [q, setQ]               = useState('');
  const [activeFilter, setFilter] = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      // Staff: also list clients for the side picker
      if (role !== 'client') {
        const cs = await emrService.listClientsWithPets();
        setClients(cs || []);
        if (!selClient && cs?.[0]) setSel(cs[0].id);
      }
      const data = await passportService.listClientPassports(role !== 'client' ? selClient : undefined);
      setRows(data || []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load passports.');
    } finally {
      setLoading(false);
    }
  }, [role, selClient]);

  useEffect(() => { load(); }, [load]);

  // Counts for the summary strip
  const counts = useMemo(() => rows.reduce((acc, r) => {
    acc.total += 1;
    if (r.overall_vax_status in acc) acc[r.overall_vax_status] += 1;
    return acc;
  }, { total: 0, protected: 0, expiring_soon: 0, overdue: 0, scheduled: 0, none: 0 }), [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(t) ||
        r.species?.toLowerCase().includes(t) ||
        r.breed?.toLowerCase().includes(t)
      );
    }
    if (activeFilter.size) {
      list = list.filter(r => activeFilter.has(r.overall_vax_status));
    }
    return list;
  }, [rows, q, activeFilter]);

  const toggleFilter = (k) => setFilter((s) => {
    const next = new Set(s);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Digital Health Passport</h1>
          <p className="text-slate-400 font-body text-sm mt-0.5">
            Color-coded vaccination status, weight tracking, and printable PDFs for every pet.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryTile label="Total pets" value={counts.total} tone="slate" />
        <SummaryTile label="Protected"     value={counts.protected}     tone="emerald" />
        <SummaryTile label="Expiring soon" value={counts.expiring_soon} tone="amber" />
        <SummaryTile label="Overdue"       value={counts.overdue}       tone="red" />
        <SummaryTile label="No records"    value={counts.none}          tone="slate" />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/10 px-3 py-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search pets…"
            className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200" />
        </label>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          {STATUS_FILTERS.map(({ key, label, Icon, color }) => {
            const on = activeFilter.has(key);
            return (
              <button key={key} onClick={() => toggleFilter(key)}
                className={`flex items-center gap-1 text-xs font-body font-600 px-2.5 py-1.5 rounded-lg border transition-colors
                  ${on
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Icon className={`w-3.5 h-3.5 ${on ? '' : color}`} /> {label}
              </button>
            );
          })}
          {!!activeFilter.size && (
            <button onClick={() => setFilter(new Set())}
              className="text-xs font-body text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Staff: client picker */}
      {role !== 'client' && clients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clients.map((c) => (
            <button key={c.id} onClick={() => setSel(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-600 border transition-colors
                ${selClient === c.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {c.name}
              <span className="opacity-80 text-[10px]">{c.pets?.length || 0} pets</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : err ? (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg">
          {err}
        </p>
      ) : !visible.length ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-10 text-center">
          <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-body">No pets to show.</p>
          {rows.length > 0 && (q || activeFilter.size) && (
            <p className="text-xs text-slate-400 font-body mt-1">Try clearing search or filters.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((row) => (
            <PetPassportCard key={row.pet_id} row={row}
              onOpen={(id) => navigate(`/passport/pets/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    red:     'bg-red-50 text-red-700 border-red-200',
    slate:   'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 opacity-70">{label}</p>
      <p className="font-display text-2xl font-700 mt-0.5">{value}</p>
    </div>
  );
}
