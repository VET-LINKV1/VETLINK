/**
 * BranchSettings.jsx
 * Clinic branches, consultation / surgery / lab rooms, availability,
 * operating hours, and veterinarian assignments.
 */
import { useState, useEffect } from 'react';
import { Building2, DoorOpen, Plus, Trash2, Stethoscope, CheckCircle2, Clock, X } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, FormFooter, StatusPill, Note, ErrorCard } from './primitives';

const ROOM_TYPE_LABELS = { consultation: 'Consultation', surgery: 'Surgery', laboratory: 'Laboratory' };

export default function BranchSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchDraft, setBranchDraft] = useState({ name: '', address: '', phone: '', primary: false });
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomDraft, setRoomDraft] = useState({ name: '', branch: '', type: 'consultation' });
  const [error, setError] = useState(null);

  // Fetch on mount
  useEffect(() => {
    settingsService.getBranches()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load branch & room settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  // Early error return
  if (error) {
    return <ErrorCard message={error} onRetry={() => window.location.reload()} />;
  }

  // Early loading return
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <SettingCard title="Branches" subtitle="Clinic locations and their details." icon={Building2}>
          <div className="space-y-2 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-white/5" />
            ))}
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
        <SettingCard title="Rooms" subtitle="Consultation, surgery, and laboratory rooms per branch." icon={DoorOpen}>
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-28 rounded-lg border border-slate-100 dark:border-white/10" />
            ))}
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
      </div>
    );
  }

  const br = data;

  const addBranch = async () => {
    if (!branchDraft.name.trim()) return;
    await settingsService.createBranch({
      name: branchDraft.name.trim(),
      address: branchDraft.address,
      phone: branchDraft.phone,
      primary: branchDraft.primary,
      hours: { open: '09:00', close: '18:00' },
    });
    setBranchDraft({ name: '', address: '', phone: '', primary: false });
    setShowBranchForm(false);
    const d = await settingsService.getBranches();
    setData(d);
  };

  const addRoom = async () => {
    if (!roomDraft.name.trim() || !roomDraft.branch) return;
    await settingsService.createRoom({
      branchId: roomDraft.branch,
      name: roomDraft.name.trim(),
      type: roomDraft.type,
      available: true,
    });
    setRoomDraft({ name: '', branch: br.branches[0]?.id || '', type: 'consultation' });
    setShowRoomForm(false);
    const d = await settingsService.getBranches();
    setData(d);
  };

  const removeBranch = async (id) => {
    if (br.branches.length <= 1) { alert('At least one branch is required.'); return; }
    // Remove the branch's rooms first (no cascade on the backend).
    const roomsToDelete = br.rooms.filter(r => r.branch === id);
    await Promise.all(roomsToDelete.map(r => settingsService.deleteRoom(r.id)));
    await settingsService.deleteBranch(id);
    const d = await settingsService.getBranches();
    setData(d);
  };

  const removeRoom = async (id) => {
    await settingsService.deleteRoom(id);
    const d = await settingsService.getBranches();
    setData(d);
  };

  const toggleRoomAvail = async (id) => {
    const room = br.rooms.find(r => r.id === id);
    if (!room) return;
    await settingsService.updateRoom(id, { available: !room.available });
    const d = await settingsService.getBranches();
    setData(d);
  };

  const handleSave = async () => {
    setSaving(true);
    // Branch & room changes persist via the individual endpoints above, so the
    // save action just confirms the latest server state.
    const d = await settingsService.getBranches();
    setData(d);
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    // Branches/rooms don't have a reset endpoint; reloading from the server
    // restores the canonical state.
    const d = await settingsService.getBranches();
    setData(d);
  };

  const openRoomForm = () => {
    setRoomDraft({ name: '', branch: br.branches[0]?.id || '', type: 'consultation' });
    setShowRoomForm(true);
  };

  return (
    <div className="space-y-5">
      <SettingCard title="Branches" subtitle="Clinic locations and their details." icon={Building2}>
        <div className="space-y-2">
          {br.branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    {b.name}
                    {b.primary && <StatusPill tone="info">Primary</StatusPill>}
                  </p>
                  <p className="text-xs font-body text-slate-400">{b.address} · {b.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-body text-slate-400 hidden sm:block">{br.rooms.filter(r => r.branch === b.id).length} rooms</span>
                <button onClick={() => removeBranch(b.id)} disabled={br.branches.length <= 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showBranchForm ? (
          <div className="space-y-3 p-3 rounded-lg border border-slate-200 dark:border-white/10">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Branch name"><TextInput value={branchDraft.name} onChange={e => setBranchDraft(d => ({ ...d, name: e.target.value }))} /></Field>
              <Field label="Phone"><TextInput value={branchDraft.phone} onChange={e => setBranchDraft(d => ({ ...d, phone: e.target.value }))} /></Field>
            </div>
            <Field label="Address"><TextInput value={branchDraft.address} onChange={e => setBranchDraft(d => ({ ...d, address: e.target.value }))} /></Field>
            <div className="flex items-center gap-2">
              <Toggle checked={branchDraft.primary} onChange={v => setBranchDraft(d => ({ ...d, primary: v }))} label="Primary" />
              <span className="text-sm font-body text-slate-600 dark:text-slate-300">Set as primary branch</span>
            </div>
            <div className="flex gap-2">
              <button onClick={addBranch} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-body font-600">Add branch</button>
              <button onClick={() => setShowBranchForm(false)} className="px-3 py-2 rounded-lg border dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowBranchForm(true)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10">+ Add branch</button>
        )}
      </SettingCard>

      <SettingCard title="Rooms" subtitle="Consultation, surgery, and laboratory rooms per branch." icon={DoorOpen}>
        <div className="space-y-3">
          {br.branches.map(b => (
            <div key={b.id} className="rounded-lg border border-slate-100 dark:border-white/10 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-white/5 font-body text-xs font-600 uppercase tracking-wider text-slate-400">{b.name}</div>
              <div className="p-3 space-y-2">
                {br.rooms.filter(r => r.branch === b.id).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">{r.name}</p>
                        <p className="text-xs font-body text-slate-400">{ROOM_TYPE_LABELS[r.type]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleRoomAvail(r.id)} className="flex items-center gap-1.5 text-xs font-body font-600">
                        <StatusPill tone={r.available ? 'success' : 'neutral'}>{r.available ? 'Available' : 'In use'}</StatusPill>
                      </button>
                      <button onClick={() => removeRoom(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {!br.rooms.filter(r => r.branch === b.id).length && <p className="text-xs font-body text-slate-400">No rooms in this branch.</p>}
              </div>
            </div>
          ))}
        </div>

        {showRoomForm ? (
          <div className="space-y-3 p-3 rounded-lg border border-slate-200 dark:border-white/10">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Room name"><TextInput value={roomDraft.name} onChange={e => setRoomDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Consult Room 3" /></Field>
              <Field label="Branch">
                <Select value={roomDraft.branch} onChange={e => setRoomDraft(d => ({ ...d, branch: e.target.value }))}>
                  {br.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={roomDraft.type} onChange={e => setRoomDraft(d => ({ ...d, type: e.target.value }))}>
                  <option value="consultation">Consultation</option>
                  <option value="surgery">Surgery</option>
                  <option value="laboratory">Laboratory</option>
                </Select>
              </Field>
            </div>
            <div className="flex gap-2">
              <button onClick={addRoom} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-body font-600">Add room</button>
              <button onClick={() => setShowRoomForm(false)} className="px-3 py-2 rounded-lg border dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={openRoomForm} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10">+ Add room</button>
        )}
      </SettingCard>

      <Note tone="info">Room availability is reflected in the appointment scheduler. Veterinarian assignment to rooms is managed in the Schedule module.</Note>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}