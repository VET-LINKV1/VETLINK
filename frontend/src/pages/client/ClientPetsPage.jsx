/**
 * ClientPetsPage.jsx
 * Client view: manage pets + view medical records per pet.
 */
import { useState, useEffect, useCallback } from 'react';
import { clientService } from '../../services/clientService';
import { medicalRecordService } from '../../services/medicalRecordService';
import MedicalRecordCard from '../../components/medical/MedicalRecordCard';
import {
  PawPrint, Plus, Edit2, X, Loader2, AlertCircle,
  ChevronRight, FileText, Calendar,
} from 'lucide-react';

const SPECIES = ['Dog','Cat','Bird','Rabbit','Hamster','Fish','Reptile','Other'];

// Simple pet add/edit modal
function PetModal({ pet, onSave, onClose }) {
  const isEdit = !!pet?.id;
  const [form, setForm] = useState({
    name: pet?.name || '', species: pet?.species || 'Dog', breed: pet?.breed || '',
    age: pet?.age || '', gender: pet?.gender || 'unknown', notes: pet?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Pet name is required.'); return; }
    setLoading(true);
    try {
      const result = isEdit
        ? await clientService.updatePet(pet.id, form)
        : await clientService.addPet(form);
      onSave(result);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save pet.');
    } finally { setLoading(false); }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 dark:bg-slate-800/50">
          <h3 className="font-display text-slate-800 dark:text-white font-700">{isEdit ? 'Edit Pet' : 'Add New Pet'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-500 text-sm font-body">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-1 font-body">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Buddy" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-1 font-body">Species</label>
              <select value={form.species} onChange={e => set('species', e.target.value)} className={inputClass}>
                {SPECIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-1 font-body">Breed</label>
              <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="Golden Retriever" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-1 font-body">Age (years)</label>
              <input type="number" min="0" max="50" value={form.age} onChange={e => set('age', e.target.value)} placeholder="3" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-1 font-body">Gender</label>
            <div className="flex gap-2">
              {['male','female','unknown'].map(g => (
                <button key={g} type="button" onClick={() => set('gender', g)}
                  className={`flex-1 py-2 rounded-xl text-xs font-body font-500 capitalize border transition-all ${form.gender === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 dark:text-slate-600 border-slate-200 dark:border-white/10 hover:border-blue-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 dark:text-slate-600 text-sm font-body hover:bg-slate-50 dark:bg-slate-800/50 dark:bg-slate-800/50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Add Pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientPetsPage() {
  const [pets, setPets]               = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [editingPet, setEditingPet]   = useState(null);
  const [error, setError]             = useState('');

  const loadPets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientService.getPets();
      setPets(data);
      if (data.length > 0 && !selectedPet) setSelectedPet(data[0]);
    } catch { setError('Failed to load pets.'); }
    finally { setLoading(false); }
  }, []);

  const loadRecords = useCallback(async (petId) => {
    setRecordsLoading(true);
    try {
      const data = await medicalRecordService.getByPet(petId);
      setRecords(data);
    } catch { setRecords([]); }
    finally { setRecordsLoading(false); }
  }, []);

  useEffect(() => { loadPets(); }, [loadPets]);
  useEffect(() => { if (selectedPet) loadRecords(selectedPet.id); }, [selectedPet, loadRecords]);

  const handlePetSaved = (pet) => {
    setShowModal(false);
    setEditingPet(null);
    loadPets();
    setSelectedPet(pet);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Pet Records</h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">{pets.length} pet{pets.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setEditingPet(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-body font-600 text-sm shadow-lg shadow-blue-500/25 transition-all">
          <Plus className="w-4 h-4" /> Add Pet
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 dark:border-white/10">
          <PawPrint className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600 mb-2">No pets registered</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-body mb-5">Add your first pet to get started.</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Pet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pet list */}
          <div className="lg:col-span-1 space-y-2">
            {pets.map(pet => (
              <button key={pet.id} onClick={() => setSelectedPet(pet)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                  selectedPet?.id === pet.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10 hover:border-blue-200 hover:shadow-sm'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedPet?.id === pet.id ? 'bg-white/20' : 'bg-blue-50'}`}>
                  <PawPrint className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-white' : 'text-blue-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-700 text-sm ${selectedPet?.id === pet.id ? 'text-white' : 'text-slate-800'}`}>{pet.name}</p>
                  <p className={`text-xs font-body ${selectedPet?.id === pet.id ? 'text-white/70' : 'text-slate-400'}`}>
                    {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.age ? ` · ${pet.age}y` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditingPet(pet); setShowModal(true); }}
                    className={`p-1.5 rounded-lg transition-colors ${selectedPet?.id === pet.id ? 'hover:bg-white/20 text-white/70' : 'hover:bg-slate-100 text-slate-400'}`}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-4 h-4 ${selectedPet?.id === pet.id ? 'text-white' : 'text-slate-300'}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Medical records */}
          <div className="lg:col-span-2 space-y-4">
            {selectedPet && (
              <>
                {/* Pet detail card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-4 shadow-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Species', value: selectedPet.species },
                      { label: 'Breed',   value: selectedPet.breed  || '—' },
                      { label: 'Age',     value: selectedPet.age    ? `${selectedPet.age} years` : '—' },
                      { label: 'Gender',  value: selectedPet.gender || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs font-body font-600 text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm font-body text-slate-700 dark:text-slate-200 font-500 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Records */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-slate-800 dark:text-white font-600">
                      Medical Records <span className="text-slate-400 dark:text-slate-500 font-400 text-sm">({records.length})</span>
                    </h3>
                  </div>

                  {recordsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
                    </div>
                  ) : records.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 dark:border-white/10">
                      <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="font-display text-slate-400 dark:text-slate-500 font-600 text-sm">No records yet</p>
                      <p className="text-slate-300 dark:text-slate-600 text-xs font-body mt-1">Records will appear here after vet visits</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {records.map(record => (
                        <MedicalRecordCard key={record.id} record={record} canEdit={false} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pet modal */}
      {showModal && (
        <PetModal
          pet={editingPet}
          onSave={handlePetSaved}
          onClose={() => { setShowModal(false); setEditingPet(null); }}
        />
      )}
    </div>
  );
}
