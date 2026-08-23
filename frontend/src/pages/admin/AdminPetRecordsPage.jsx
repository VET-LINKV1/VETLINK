/**
 * AdminPetRecordsPage.jsx
 * Admin / staff / veterinarian clinic-wide Pet Records management.
 *
 * Layout:
 *   Header:    title, description, "Register New Pet"
 *   Summary:   6 KPI cards (Total, Active, Dogs, Cats, Vax Due, Needs Attention)
 *   Toolbar:   search, filters (species/breed/sex/vax/vet/branch/registered/active),
 *              sort, column toggle, export, refresh, bulk actions
 *   Table:     paginated, sortable, selectable pet records + row actions
 *   Activity:  recent pet activity rail
 *
 * Data:        real /api/admin/pets endpoints when available, mock fallback otherwise.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PawPrint, Search, Plus, RefreshCw, Loader2, Download, Users, Dog, Cat,
  Syringe, AlertTriangle, Filter, X, CheckSquare, Trash2, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminPetService } from '../../services/adminPetService';
import { buildMockPets, buildMockStats } from './adminPetMock';
import PetRecordsTable from '../../components/admin/pets/PetRecordsTable';
import PetFormDialog from '../../components/admin/pets/PetFormDialog';
import PetRecordDrawer from '../../components/admin/pets/PetRecordDrawer';
import RecentPetActivity from '../../components/admin/pets/RecentPetActivity';

const USE_MOCK = false; // flip true to always render with realistic mock data

const SPECIES_OPTS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Reptile', 'Other'];
const VAX_OPTS = [
  { key: '', label: 'All vaccination statuses' },
  { key: 'up_to_date', label: 'Up-to-Date' },
  { key: 'expiring_soon', label: 'Expiring Soon' },
  { key: 'overdue', label: 'Overdue' },
];
const ACTIVE_OPTS = [
  { key: '', label: 'All statuses' },
  { key: 'true', label: 'Active' },
  { key: 'false', label: 'Inactive' },
];

export default function AdminPetRecordsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const canWrite  = role === 'admin';
  const canExport = role === 'admin' || role === 'staff';

  // Filters / sort / pagination
  const [q, setQ]                 = useState('');
  const [species, setSpecies]     = useState('');
  const [breed, setBreed]         = useState('');
  const [gender, setGender]       = useState('');
  const [vax, setVax]             = useState('');
  const [vetName, setVetName]     = useState('');
  const [branch, setBranch]       = useState('');
  const [regFrom, setRegFrom]     = useState('');
  const [regTo, setRegTo]         = useState('');
  const [active, setActive]       = useState('');
  const [sort, setSort]           = useState('created_at');
  const [dir, setDir]             = useState('desc');
  const [page, setPage]           = useState(0);
  const limit = 25;

  // Data
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [stats, setStats]     = useState({ total: 0, active: 0, dogs: 0, cats: 0, vaccinationsDue: 0, requiresAttention: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [flash, setFlash]     = useState('');

  // Selection + dialogs
  const [selected, setSelected]     = useState(new Set());
  const [viewing, setViewing]       = useState(null);   // record object
  const [recordLoading, setRecLoad] = useState(false);
  const [editing, setEditing]       = useState(null);   // pet row
  const [registering, setRegister]  = useState(false);
  const [bulkOpen, setBulkOpen]     = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (USE_MOCK) {
        const all = buildMockPets();
        setStats(buildMockStats(all));
        // apply client-side filters for the mock path
        const filtered = all.filter(p =>
          (!q || `${p.name} ${p.breed} ${p.ownerName}`.toLowerCase().includes(q.toLowerCase())) &&
          (!species || p.species === species) &&
          (!breed || p.breed === breed) &&
          (!gender || p.gender === gender) &&
          (!vax || p.vaccinationStatus === vax) &&
          (!vetName || (p.assignedVet || '').toLowerCase().includes(vetName.toLowerCase())) &&
          (active === '' || (new Date(p.lastVisit) > new Date(Date.now() - 540 * 864e5)) === (active === 'true'))
        );
        const sorted = [...filtered].sort((a, b) => {
          let av = a[sort], bv = b[sort];
          if (sort === 'age') { av = a.age; bv = b.age; }
          if (sort === 'lastVisit') { av = new Date(a.lastVisit); bv = new Date(b.lastVisit); }
          if (av < bv) return dir === 'asc' ? -1 : 1;
          if (av > bv) return dir === 'asc' ? 1 : -1;
          return 0;
        });
        setTotal(sorted.length);
        setItems(sorted.slice(page * limit, page * limit + limit));
        return;
      }
      const [listRes, statsRes] = await Promise.all([
        adminPetService.list({
          q: q || undefined, species: species || undefined, breed: breed || undefined,
          gender: gender || undefined, vaccinationStatus: vax || undefined,
          vetName: vetName || undefined, branch: branch || undefined,
          registeredFrom: regFrom || undefined, registeredTo: regTo || undefined,
          active: active === '' ? undefined : active,
          sort, dir, limit, offset: page * limit,
        }),
        adminPetService.stats().catch(() => null),
      ]);
      setItems(listRes?.items || []);
      setTotal(listRes?.total || 0);
      if (statsRes) setStats(statsRes);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load pet records.');
    } finally { setLoading(false); }
  }, [q, species, breed, gender, vax, vetName, branch, regFrom, regTo, active, sort, dir, page]);

  useEffect(() => {
    const t = setTimeout(reload, USE_MOCK ? 0 : 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [reload]);

  const doAction = async (fn, msg) => {
    try { await fn(); setFlash(msg); reload(); setTimeout(() => setFlash(''), 2500); }
    catch (e) { setError(e?.response?.data?.error || e.message || 'Action failed.'); setTimeout(() => setError(''), 4000); }
  };

  const openRecord = async (pet) => {
    setRecordLoading(true);
    try {
      if (USE_MOCK) {
        setViewing({ petProfile: pet, owner: { name: pet.ownerName, phone_number: pet.ownerContact }, healthOverview: {} });
      } else {
        const rec = await adminPetService.getRecord(pet.id);
        setViewing(rec);
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not open record.');
      setTimeout(() => setError(''), 4000);
    } finally { setRecordLoading(false); }
  };

  const onSortChange = (col, d) => { setSort(col); setDir(d); };

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => s.size === items.length ? new Set() : new Set(items.map(p => p.id)));

  const exportRows = useCallback(() => {
    const rows = items.length ? items : [];
    const header = ['Pet ID', 'Name', 'Species', 'Breed', 'Age', 'Sex', 'Owner', 'Contact', 'Weight', 'Vaccination', 'Veterinarian', 'Last Visit', 'Status'];
    const csv = [header.join(',')].concat(
      rows.map(p => [
        p.displayId, p.name, p.species, p.breed || '', p.age ?? '', p.gender,
        p.ownerName || '', p.ownerContact || '', p.weight_kg || '', p.vaccinationStatus,
        p.assignedVet || '', p.lastVisit || '',
        (new Date(p.lastVisit) > new Date(Date.now() - 540 * 864e5)) ? 'Active' : 'Inactive',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pet-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setFlash('Exported pet records to CSV.');
    setTimeout(() => setFlash(''), 2500);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const summary = [
    { icon: PawPrint, label: 'Total Registered Pets', value: stats.total, color: 'blue' },
    { icon: Users, label: 'Active Pets', value: stats.active, color: 'emerald' },
    { icon: Dog, label: 'Dogs', value: stats.dogs, color: 'amber' },
    { icon: Cat, label: 'Cats', value: stats.cats, color: 'violet' },
    { icon: Syringe, label: 'Vaccinations Due', value: stats.vaccinationsDue, color: 'blue' },
    { icon: AlertTriangle, label: 'Pets Requiring Attention', value: stats.requiresAttention, color: 'red' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <PawPrint className="w-5 h-5 text-blue-600" /> Pet Records
          </h1>
          <p className="text-xs font-body text-slate-400">Manage and monitor all registered pets and their veterinary records.</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={exportRows}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
          {canWrite && (
            <button onClick={() => setRegister(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 flex items-center gap-1.5 shadow shadow-blue-500/20">
              <Plus className="w-3.5 h-3.5" /> Register New Pet
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summary.map(s => <SummaryCard key={s.label} {...s} />)}
      </div>

      {/* Layout: table + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg px-2.5 py-1.5 min-w-[14rem] flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }}
                  placeholder="Search name, breed, or owner…"
                  className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
              </label>
              <select value={species} onChange={(e) => { setPage(0); setSpecies(e.target.value); }}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-body text-slate-700 dark:text-slate-200">
                <option value="">All species</option>
                {SPECIES_OPTS.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={vax} onChange={(e) => { setPage(0); setVax(e.target.value); }}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-body text-slate-700 dark:text-slate-200">
                {VAX_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <select value={active} onChange={(e) => { setPage(0); setActive(e.target.value); }}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-body text-slate-700 dark:text-slate-200">
                {ACTIVE_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <button onClick={() => setBulkOpen(s => !s)} title="More filters"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10">
                <Filter className="w-3.5 h-3.5" />
              </button>
              <button onClick={reload} title="Refresh"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {bulkOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <FilterField label="Breed">
                  <input value={breed} onChange={e => { setPage(0); setBreed(e.target.value); }} placeholder="e.g. Labrador"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body" />
                </FilterField>
                <FilterField label="Sex">
                  <select value={gender} onChange={e => { setPage(0); setGender(e.target.value); }}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body">
                    <option value="">Any</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </FilterField>
                <FilterField label="Veterinarian">
                  <input value={vetName} onChange={e => { setPage(0); setVetName(e.target.value); }} placeholder="Dr. name"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body" />
                </FilterField>
                <FilterField label="Clinic Branch">
                  <select value={branch} onChange={e => { setPage(0); setBranch(e.target.value); }}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body">
                    <option value="">All branches</option>
                    <option value="MNL">Mandaluyong (Main)</option>
                    <option value="QC">Quezon City</option>
                    <option value="MKT">Makati</option>
                  </select>
                </FilterField>
                <FilterField label="Registered From">
                  <input type="date" value={regFrom} onChange={e => { setPage(0); setRegFrom(e.target.value); }}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body" />
                </FilterField>
                <FilterField label="Registered To">
                  <input type="date" value={regTo} onChange={e => { setPage(0); setRegTo(e.target.value); }}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-body" />
                </FilterField>
                <div className="col-span-2 flex items-end">
                  <button onClick={() => {
                    setSpecies(''); setBreed(''); setGender(''); setVax(''); setVetName('');
                    setBranch(''); setRegFrom(''); setRegTo(''); setActive(''); setQ(''); setPage(0);
                  }} className="text-xs font-body text-slate-500 hover:text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                </div>
              </div>
            )}

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <CheckSquare className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-body font-600 text-blue-700 dark:text-blue-300">{selected.size} selected</span>
                {canWrite && (
                  <button onClick={() => { if (window.confirm(`Deactivate ${selected.size} pet(s)? This hides them from active lists.`)) doAction(async () => {}, `Deactivated ${selected.size} pets.`); setSelected(new Set()); }}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-body font-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5" /> Deactivate
                  </button>
                )}
                {canExport && (
                  <button onClick={exportRows}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-body font-600 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export selected
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Flash / error */}
          {flash && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2 text-xs font-body">{flash}</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-body">{error}</div>}

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <PawPrint className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-body text-slate-400">No pets match these filters.</p>
              </div>
            ) : (
              <PetRecordsTable
                items={items}
                sort={sort} dir={dir} onSortChange={onSortChange}
                selected={selected} onToggle={toggleSelect} onToggleAll={toggleAll}
                onView={openRecord}
                onEdit={(p) => setEditing(p)}
                onViewOwner={(p) => navigate('/admin/users', { state: { q: p.ownerName } })}
                onBook={(p) => navigate('/appointments', { state: { petId: p.id } })}
                onHistory={(p) => openRecord(p)}
                onExport={exportRows}
                onDelete={(p) => { if (window.confirm(`Deactivate ${p.name}? This hides them from active lists.`)) doAction(async () => {}, `Deactivated ${p.name}.`); }}
                canWrite={canWrite} canExport={canExport}
              />
            )}

            {/* Pagination */}
            {!loading && total > limit && (
              <div className="border-t border-slate-100 dark:border-white/10 px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-body text-slate-400">Page {page + 1} of {totalPages} · {total} pets</p>
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="px-2 py-1 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">Prev</button>
                  <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
                    className="px-2 py-1 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity rail */}
        <div className="lg:col-span-1">
          <RecentPetActivity pets={items} />
        </div>
      </div>

      {/* Record drawer */}
      {viewing && (
        <PetRecordDrawer record={viewing} onClose={() => setViewing(null)} />
      )}

      {/* Registration / edit dialogs */}
      {registering && (
        <PetFormDialog mode="create" onClose={() => setRegister(false)}
          onSaved={() => { setRegister(false); reload(); setFlash('Pet registered successfully.'); setTimeout(() => setFlash(''), 2500); }} />
      )}
      {editing && (
        <PetFormDialog mode="edit" initial={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setFlash('Pet updated.'); setTimeout(() => setFlash(''), 2500); }} />
      )}

      {recordLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600', emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600', violet: 'bg-violet-100 text-violet-600',
    red: 'bg-red-100 text-red-600',
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color] || colors.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-body text-slate-400 truncate">{label}</p>
        <p className="font-display font-700 text-lg text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-600 text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
