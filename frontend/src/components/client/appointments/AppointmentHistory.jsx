import { useState, useMemo } from 'react';
import { Search, Filter, Calendar } from 'lucide-react';
import AppointmentCard from './AppointmentCard';

const STATUS_OPTIONS = ['all', 'completed', 'cancelled', 'pending', 'confirmed'];

function AppointmentHistory({ appointments }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const filtered = useMemo(() => {
    let list = [...appointments];

    // Filter by status
    if (statusFilter !== 'all') {
      list = list.filter(a => a.status === statusFilter);
    }

    // Filter by search (pet name or service type)
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.pets?.name?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      const da = new Date(a.appointment_at || a.created_at);
      const db = new Date(b.appointment_at || b.created_at);
      return sortOrder === 'newest' ? db - da : da - db;
    });

    return list;
  }, [appointments, statusFilter, search, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by pet name or service..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>
            ))}
          </select>

          {/* Sort order */}
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs font-body text-slate-400">
        Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        {statusFilter !== 'all' ? ` · ${statusFilter}` : ''}
        {search ? ` · "${search}"` : ''}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-display text-slate-500 font-600 text-sm">No records found</p>
          <p className="text-slate-400 font-body text-xs mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => (
            // History is read-only — no cancel action
            <AppointmentCard key={appt.id} appointment={appt} onCancel={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AppointmentHistory;
