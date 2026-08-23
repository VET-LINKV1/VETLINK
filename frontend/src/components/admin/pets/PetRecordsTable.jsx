/**
 * PetRecordsTable.jsx — clinic-wide pet records table for admins.
 * Renders the pet roster with sortable columns, row selection, and
 * inline action menu. Photos fall back to a species emoji avatar.
 */
import { useState } from 'react';
import {
  ArrowUpDown, MoreHorizontal, Eye, Pencil, User, CalendarPlus, Stethoscope,
  Upload, Download, Trash2, PawPrint,
} from 'lucide-react';

const SPECIES_EMOJI = { Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇', Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾' };

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}

export function VaxBadge({ status }) {
  const map = {
    up_to_date:    { label: 'Up-to-Date',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    expiring_soon: { label: 'Expiring Soon',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    overdue:       { label: 'Overdue',         cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const s = map[status] || map.up_to_date;
  return (
    <span className={`inline-flex items-center text-[11px] font-body font-600 px-2 py-0.5 rounded-md border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-body font-600 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-body font-600 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
    </span>
  );
}

const COLUMNS = [
  { key: 'displayId',  label: 'Pet ID',           sortable: false },
  { key: 'name',       label: 'Name',             sortable: true },
  { key: 'species',    label: 'Species',          sortable: false },
  { key: 'breed',      label: 'Breed',            sortable: false },
  { key: 'age',        label: 'Age',              sortable: true },
  { key: 'gender',     label: 'Sex',              sortable: false },
  { key: 'ownerName',  label: 'Owner',            sortable: false },
  { key: 'ownerContact', label: 'Contact',        sortable: false },
  { key: 'weight_kg',  label: 'Weight',           sortable: false },
  { key: 'vaccinationStatus', label: 'Vaccination', sortable: false },
  { key: 'assignedVet', label: 'Veterinarian',    sortable: false },
  { key: 'lastVisit',  label: 'Last Visit',       sortable: true },
  { key: 'active',     label: 'Status',           sortable: false },
];

export default function PetRecordsTable({
  items, sort, dir, onSortChange,
  selected, onToggle, onToggleAll,
  onView, onEdit, onViewOwner, onBook, onHistory, onExport, onDelete,
  canWrite, canExport,
}) {
  const [menuId, setMenuId] = useState(null);

  const sortBtn = (col) => {
    if (!col.sortable) return <span className="text-slate-400">{col.label}</span>;
    const active = sort === col.key;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    return (
      <button onClick={() => onSortChange(col.key, active ? nextDir : 'asc')}
        className={`inline-flex items-center gap-1 ${active ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}>
        {col.label}
        <ArrowUpDown className="w-3 h-3 opacity-60" />
      </button>
    );
  };

  const allSelected = items.length > 0 && items.every(p => selected.has(p.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead className="bg-slate-50 dark:bg-white/5">
          <tr className="text-left text-[11px] font-600 uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2.5 w-8">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            </th>
            {COLUMNS.map(c => <th key={c.key} className="px-3 py-2.5 whitespace-nowrap">{sortBtn(c)}</th>)}
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
          {items.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isSel ? 'bg-blue-50/40' : ''}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={isSel} onChange={() => onToggle(p.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-slate-400">{p.displayId}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5 min-w-[9rem]">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                      {SPECIES_EMOJI[p.species] || '🐾'}
                    </div>
                    <button onClick={() => onView(p)} className="font-600 text-slate-700 dark:text-slate-200 hover:text-blue-600 truncate text-left">
                      {p.name}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">{p.species}</td>
                <td className="px-3 py-3 text-xs text-slate-500 truncate max-w-[8rem]">{p.breed || '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{p.age != null ? `${p.age}y` : '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500 capitalize">{p.gender}</td>
                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300 truncate max-w-[9rem]">{p.ownerName || '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-400 truncate max-w-[8rem]">{p.ownerContact || '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</td>
                <td className="px-3 py-3"><VaxBadge status={p.vaccinationStatus} /></td>
                <td className="px-3 py-3 text-xs text-slate-500 truncate max-w-[9rem]">{p.assignedVet || '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(p.lastVisit)}</td>
                <td className="px-3 py-3"><StatusBadge active={p.lastVisit && new Date(p.lastVisit) > new Date(Date.now() - 540 * 864e5)} /></td>
                <td className="px-3 py-3 text-right relative">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => onView(p)} title="View Record"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canWrite && (
                      <button onClick={() => onEdit(p)} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => setMenuId(menuId === p.id ? null : p.id)} title="More"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {menuId === p.id && (
                    <div className="absolute right-2 top-11 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg py-1.5 w-52 text-left">
                      <MenuItem onClick={() => { setMenuId(null); onViewOwner(p); }} icon={User}>View Owner</MenuItem>
                      <MenuItem onClick={() => { setMenuId(null); onBook(p); }} icon={CalendarPlus}>Book Appointment</MenuItem>
                      <MenuItem onClick={() => { setMenuId(null); onHistory(p); }} icon={Stethoscope}>Medical History</MenuItem>
                      {canExport && <MenuItem onClick={() => { setMenuId(null); onExport(p); }} icon={Download}>Export Record</MenuItem>}
                      {canWrite && <MenuItem onClick={() => { setMenuId(null); onDelete(p); }} icon={Trash2} danger>Deactivate Pet</MenuItem>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs font-body flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5
        ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 dark:text-slate-200'}`}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}
