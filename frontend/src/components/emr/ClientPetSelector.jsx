/**
 * ClientPetSelector.jsx
 * Two-pane navigator: list of clients, expanding into their pets.
 * Used as the left sidebar of the EMR module.
 *
 * Props:
 *   clients      Array<{ id, name, email, pets: [...] }>
 *   selectedPetId
 *   onSelectPet(pet, client)
 *   searchable   default true
 */
import { useMemo, useState } from 'react';
import { Search, User, PawPrint, ChevronDown, ChevronRight } from 'lucide-react';

export default function ClientPetSelector({ clients = [], selectedPetId, onSelectPet, searchable = true }) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(clients.map(c => c.id)));

  const filtered = useMemo(() => {
    if (!q.trim()) return clients;
    const term = q.trim().toLowerCase();
    return clients
      .map((c) => {
        const matchClient = c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term);
        const matchPets = (c.pets || []).filter(p =>
          p.name?.toLowerCase().includes(term) ||
          p.species?.toLowerCase().includes(term) ||
          p.breed?.toLowerCase().includes(term));
        if (matchClient) return c;
        if (matchPets.length) return { ...c, pets: matchPets };
        return null;
      })
      .filter(Boolean);
  }, [clients, q]);

  const toggle = (id) => {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10">
        <p className="text-xs font-body font-600 text-slate-400 uppercase tracking-wider mb-2">
          Clients & Pets
        </p>
        {searchable && (
          <label className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients or pets…"
              className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!filtered.length && (
          <p className="text-sm text-slate-400 font-body text-center py-8 px-4">
            {clients.length ? 'No matches.' : 'No clients with pets yet.'}
          </p>
        )}
        {filtered.map((c) => {
          const isOpen = expanded.has(c.id);
          return (
            <div key={c.id} className="border-b border-slate-50 dark:border-white/5 last:border-b-0">
              <button
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1 truncate text-sm font-body font-600 text-slate-700 dark:text-slate-200">
                  {c.name}
                </span>
                <span className="text-xs text-slate-400">{c.pets?.length || 0}</span>
              </button>
              {isOpen && (c.pets || []).map((p) => {
                const active = p.id === selectedPetId;
                return (
                  <button key={p.id}
                    onClick={() => onSelectPet?.(p, c)}
                    className={`w-full flex items-center gap-2 pl-10 pr-4 py-2 text-left text-sm font-body transition-colors
                      ${active
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-l-2 border-blue-500'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    <PawPrint className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{p.species}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
