/**
 * SharedPassportPage.jsx
 *
 * Public, token-gated view of a pet's digital health passport.
 * Reached via /passport/share/:token — no login required.
 *
 * Wraps the same PassportPDF component used for the download
 * flow, so the on-screen and printed versions look identical.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, Shield, AlertCircle, ExternalLink } from 'lucide-react';
import { passportService } from '../../services/passportService';
import PassportPDF, { downloadAsPDF } from '../../components/passport/PassportPDF';

export default function SharedPassportPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await passportService.getByShareToken(token);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || 'Link invalid or expired.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-display text-slate-800 font-700">Can't open this link</p>
          <p className="text-sm text-slate-500 font-body mt-1">{err}</p>
          <p className="text-xs text-slate-400 font-body mt-4">
            The link may have expired or been revoked. Contact the clinic that sent it for a new one.
          </p>
        </div>
      </div>
    );
  }

  const { pet, shareInfo, summary } = data || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Public-facing top bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-display text-slate-800 dark:text-white font-700 text-sm">VETLINK</p>
              <p className="text-[10px] uppercase tracking-wider font-body text-slate-400">Shared Health Passport</p>
            </div>
          </div>
          <button onClick={handleDownload} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-5 py-6 space-y-5">
        {/* Meta strip */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-body">
            <Field label="Pet" value={`${pet?.name || ''} · ${pet?.species || ''}`} />
            <Field label="Shared with" value={shareInfo?.recipient} />
            <Field label="Link expires" value={shareInfo?.expiresAt ? new Date(shareInfo.expiresAt).toLocaleString() : '—'} />
          </div>
        </div>

        {/* Render the same printable component as the on-screen view */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 794 }}>
            <PassportPDF ref={pdfRef} data={{
              pet,
              owner: null,                    // hide owner PII on public view
              summary,
              vaccinations: data.vaccinations,
              weightSeries: data.weightSeries,
              recentVisits: data.recentVisits,
              prescriptions: data.prescriptions,
            }} />
          </div>
        </div>

        <p className="text-xs text-center text-slate-400 font-body pt-2">
          Issued by VETLINK · For verification, contact the issuing clinic.
        </p>
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-400">{label}</p>
      <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200">{value || '—'}</p>
    </div>
  );
}
