/**
 * VetDischargePage.jsx
 *
 * Vet-facing editor for the discharge instructions of a specific
 * appointment. Loads any existing draft and lets the vet save it,
 * then publish to the client.
 *
 * Mounted at /discharge/:appointmentId.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Loader2, Eye, AlertCircle } from 'lucide-react';
import { postCareService } from '../../services/postCareService';
import DischargeEditor from '../../components/postcare/DischargeEditor';
import DischargeView   from '../../components/postcare/DischargeView';

export default function VetDischargePage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [discharge, setDischarge] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [preview, setPreview]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await postCareService.getDischargeByAppointment(appointmentId);
      setDischarge(d);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load.');
    } finally { setLoading(false); }
  }, [appointmentId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="font-display text-slate-800 dark:text-white text-xl font-700">
                Discharge instructions
              </h1>
              <p className="text-xs font-body text-slate-400">
                Post-treatment care guide the owner will see in their portal.
                {discharge?.is_published ? ' · Published' : ' · Draft'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
            <Eye className="w-4 h-4" /> {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : preview ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
          <DischargeView discharge={discharge} />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
          <DischargeEditor
            appointmentId={appointmentId}
            initial={discharge}
            onSaved={(d) => { setDischarge(d); }} />
        </div>
      )}
    </div>
  );
}
