/**
 * PetPassportPage.jsx
 *
 * Per-pet passport view. Three tabs:
 *   Overview  — vaccination timeline + summary
 *   Weight    — interactive Recharts line chart + log entries
 *   Records   — recent visits + prescriptions + files
 *
 * Actions in the header:
 *   - Download PDF (jsPDF + html2canvas, lazy-loaded)
 *   - Share via email (SharePassportModal)
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Mail, Loader2, PawPrint,
  Shield, ShieldAlert, AlertTriangle, Activity, FileText, Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { passportService } from '../../services/passportService';
import VaccinationTimeline from '../../components/passport/VaccinationTimeline';
import WeightChart from '../../components/passport/WeightChart';
import SharePassportModal from '../../components/passport/SharePassportModal';
import PassportPDF, { downloadAsPDF } from '../../components/passport/PassportPDF';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Shield },
  { key: 'weight',   label: 'Weight',   icon: Activity },
  { key: 'records',  label: 'Records',  icon: FileText },
];

export default function PetPassportPage() {
  const { petId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const canWrite = role === 'admin' || role === 'veterinarian' || role === 'staff';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');
  const [shareOpen, setShareOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await passportService.getPetPassport(petId);
      setData(d);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load passport.');
    } finally { setLoading(false); }
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const fname = `${data?.pet?.name || 'pet'}_health_passport.pdf`.replace(/\s+/g, '_');
      await downloadAsPDF(pdfRef.current, fname);
    } catch (e) {
      alert('Could not generate PDF: ' + (e.message || e));
    } finally { setExporting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-4 py-3 rounded-xl">
        {err || 'Passport not found.'}
      </div>
    );
  }

  const { pet, owner, summary, vaccinations } = data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-xs font-body uppercase tracking-wider text-blue-600 font-700">Digital Health Passport</p>
            <h1 className="font-display text-2xl text-slate-800 dark:text-white font-700">{pet.name}</h1>
            <p className="text-sm text-slate-500 font-body">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.age != null ? ` · ${pet.age}y` : ''}
              {owner ? ` · Owner: ${owner.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700">
            <Mail className="w-4 h-4" />
            Email passport
          </button>
        </div>
      </div>

      {/* Status hero */}
      <StatusHero summary={summary} pet={pet} />

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-1 flex flex-wrap gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 transition-colors
              ${tab === key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
        {tab === 'overview' && (
          <VaccinationTimeline items={vaccinations} />
        )}
        {tab === 'weight' && (
          <WeightChart petId={petId} weights={data.weightSeries || []}
            canWrite={canWrite} onChange={load} />
        )}
        {tab === 'records' && (
          <RecordsTab data={data} />
        )}
      </div>

      {/* Off-screen printable target — only mounted for the PDF render */}
      <div style={{ position: 'absolute', left: '-10000px', top: 0 }}>
        <PassportPDF ref={pdfRef} data={data} />
      </div>

      <SharePassportModal open={shareOpen} onClose={() => setShareOpen(false)}
        pet={pet} onShared={() => {}} />
    </div>
  );
}

function StatusHero({ summary, pet }) {
  const status = summary?.overall_vax_status || 'none';
  const meta = {
    protected:     { bg: 'from-emerald-500 to-emerald-700', label: 'Fully Protected',  Icon: Shield        },
    expiring_soon: { bg: 'from-amber-500 to-amber-600',     label: 'Expiring Soon',    Icon: ShieldAlert   },
    overdue:       { bg: 'from-red-500 to-red-700',         label: 'Overdue',          Icon: AlertTriangle },
    scheduled:     { bg: 'from-blue-500 to-blue-700',       label: 'Vaccines Scheduled', Icon: Shield      },
    none:          { bg: 'from-slate-400 to-slate-600',     label: 'No Vaccinations',  Icon: Shield        },
  }[status] || { bg: 'from-blue-500 to-blue-700', label: 'Status Unknown', Icon: Shield };
  const Icon = meta.Icon;

  return (
    <div className={`rounded-2xl text-white p-5 bg-gradient-to-br ${meta.bg} shadow-lg`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider opacity-90">Vaccination status</p>
            <p className="font-display text-2xl font-700 leading-tight">{meta.label}</p>
            <p className="text-xs opacity-90 mt-0.5">
              {summary?.vax_protected || 0} protected · {summary?.vax_expiring || 0} expiring · {summary?.vax_overdue || 0} overdue
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Weight" value={summary?.current_weight_kg ? `${Number(summary.current_weight_kg).toFixed(1)} kg` : '—'} />
          <Stat label="BCS"    value={summary?.current_bcs ? `${summary.current_bcs}/9` : '—'} />
          <Stat label="Visits" value={summary?.visits_total ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/15 rounded-xl px-3 py-2 min-w-[70px]">
      <p className="font-display text-xl font-700 leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}

function RecordsTab({ data }) {
  const visits = data.recentVisits || [];
  const rxs    = data.prescriptions || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 font-display font-600 text-slate-700 dark:text-slate-200 mb-3">
          <Stethoscope className="w-4 h-4 text-blue-600" /> Medical history
        </h3>
        {visits.length ? (
          <ul className="space-y-2">
            {visits.map((r) => (
              <li key={r.id} className="border-l-2 border-blue-200 pl-3 py-1">
                <p className="text-sm font-body text-slate-700 dark:text-slate-200">
                  <span className="font-600">{new Date(r.visit_date).toLocaleDateString()}</span> — {r.diagnosis}
                </p>
                {r.treatment && <p className="text-xs text-slate-500 font-body mt-0.5">Treatment: {r.treatment}</p>}
                {r.notes && <p className="text-xs text-slate-500 font-body mt-0.5 italic">"{r.notes}"</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 font-body">No medical history yet.</p>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 font-display font-600 text-slate-700 dark:text-slate-200 mb-3">
          <FileText className="w-4 h-4 text-blue-600" /> Prescriptions
        </h3>
        {rxs.length ? (
          <ul className="space-y-1">
            {rxs.map((p) => (
              <li key={p.id} className="text-sm font-body text-slate-700 dark:text-slate-200">
                <span className="font-600">{p.medication_name}</span>
                <span className="text-slate-500"> — {p.dosage} · {p.frequency}</span>
                <span className={`ml-2 text-[10px] font-body font-600 px-2 py-0.5 rounded-md
                  ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700'
                    : p.status === 'discontinued' ? 'bg-amber-50 text-amber-700'
                    : 'bg-slate-100 text-slate-500'}`}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 font-body">No prescriptions yet.</p>
        )}
      </div>
    </div>
  );
}
