/**
 * VetMedicalRecordsPage.jsx
 * Vet view: create records from completed appointments, edit own records.
 */
import { useState, useEffect, useCallback } from 'react';
import { medicalRecordService } from '../../services/medicalRecordService';
import { appointmentService } from '../../services/appointmentService';
import { useAuth } from '../../hooks/useAuth';
import MedicalRecordCard from '../../components/medical/MedicalRecordCard';
import MedicalRecordForm from '../../components/medical/MedicalRecordForm';
import { FileText, Plus, Calendar, Search, Filter, Loader2, AlertCircle } from 'lucide-react';

export default function VetMedicalRecordsPage() {
  const { role } = useAuth();
  const isVet   = role === 'veterinarian';
  const isAdmin = role === 'admin';
  const canEditAny = isVet || isAdmin;

  const [records, setRecords]               = useState([]);
  const [appointments, setAppointments]     = useState([]); // completed, no record yet
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [showForm, setShowForm]             = useState(false);
  const [editingRecord, setEditingRecord]   = useState(null);
  const [selectedAppt, setSelectedAppt]     = useState(null);
  const [search, setSearch]                 = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    // Pick the right endpoint by role:
    //   vet   → /medical-records/my-records (only the records they wrote)
    //   else  → /medical-records             (clinic-wide list for admin/staff)
    const fetchRecords = isVet
      ? medicalRecordService.getMyRecords()
      : medicalRecordService.getAll();
    const fetchAppts = appointmentService.getAll({ status: 'confirmed' });

    const [recRes, apptRes] = await Promise.allSettled([fetchRecords, fetchAppts]);

    const recs = recRes.status === 'fulfilled' ? (recRes.value || []) : [];
    const apps = apptRes.status === 'fulfilled' ? (apptRes.value || []) : [];
    setRecords(recs);

    // Hide appointments that already have a record. Only vets need this
    // "create record from appointment" workflow — keep it empty for others.
    if (isVet) {
      const recorded = new Set(recs.map(r => r.appointment_id).filter(Boolean));
      setAppointments(apps.filter(a => !recorded.has(a.id)));
    } else {
      setAppointments([]);
    }

    // Surface the first real error so the user knows what went wrong.
    const firstErr = [recRes, apptRes].find(r => r.status === 'rejected');
    if (firstErr) {
      const r = firstErr.reason;
      const status = r?.response?.status;
      const msg = r?.response?.data?.error
        || (status === 403 ? 'You do not have permission to view records here.' : null)
        || r?.message
        || 'Failed to load records.';
      setError(msg);
    }
    setLoading(false);
  }, [isVet]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFormSuccess = () => { setShowForm(false); setEditingRecord(null); setSelectedAppt(null); loadData(); };

  const filteredRecords = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.pets?.name?.toLowerCase().includes(q) || r.diagnosis?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Medical Records</h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">{records.length} records created</p>
        </div>
        {canEditAny && (
          <button onClick={() => { setEditingRecord(null); setSelectedAppt(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-body font-600 text-sm shadow-lg shadow-teal-500/25 transition-all">
            <Plus className="w-4 h-4" /> New Record
          </button>
        )}
      </div>

      {/* Pending appointments needing records */}
      {appointments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-700 font-body font-600 text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {appointments.length} confirmed appointment{appointments.length > 1 ? 's' : ''} awaiting a medical record
          </p>
          <div className="space-y-2">
            {appointments.slice(0, 3).map(appt => (
              <div key={appt.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-100">
                <div>
                  <p className="font-display text-slate-800 dark:text-white text-sm font-600">{appt.pets?.name} — {appt.type}</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-body">
                    {appt.appointment_at && new Date(appt.appointment_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    · {appt.client?.name}
                  </p>
                </div>
                <button onClick={() => { setSelectedAppt(appt); setEditingRecord(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-body font-600 hover:bg-teal-700 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Record
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by pet name or diagnosis..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 dark:border-white/10">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600 mb-2">No records found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-body">
            {canEditAny ? 'Create your first medical record above.' : 'No medical records have been written yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(record => (
            <div key={record.id}>
              {record.pets && (
                <p className="text-xs font-body font-600 text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    {record.pets.name[0]}
                  </span>
                  {record.pets.name} · {record.pets.species}
                </p>
              )}
              <MedicalRecordCard
                record={record}
                canEdit={canEditAny}
                onEdit={(r) => { setEditingRecord(r); setSelectedAppt(null); setShowForm(true); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Record form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <MedicalRecordForm
            pet={selectedAppt?.pets || editingRecord?.pets}
            appointment={selectedAppt}
            existingRecord={editingRecord}
            onSuccess={handleFormSuccess}
            onClose={() => { setShowForm(false); setEditingRecord(null); setSelectedAppt(null); }}
          />
        </div>
      )}
    </div>
  );
}
