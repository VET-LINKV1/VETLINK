/**
 * CsvImportDialog.jsx
 * Lets admin paste/upload a CSV of users and bulk-create them.
 *
 * Expected CSV columns (header row required):
 *   email,name,role,phone_number,license_number,specialization,position,department
 *
 * Role must be one of: admin / veterinarian / staff / client.
 */
import { useEffect, useState } from 'react';
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { userManagementService } from '../../../services/userManagementService';

const TEMPLATE =
`email,name,role,phone_number,license_number,specialization,position,department
jane.doe@clinic.com,Jane Doe,veterinarian,+639171234567,V-123,Surgery,,Clinical
carl@clinic.com,Carl Reyes,staff,+639170000000,,,assistant,Reception
owner@example.com,Owner Name,client,+639170001111,,,,`;

// Minimal CSV parser. Handles quoted fields and commas inside quotes.
function parseCsv(text) {
  const out = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = splitLine(lines[0]).map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
    out.push(row);
  }
  return out;
}
function splitLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export default function CsvImportDialog({ onClose, onDone }) {
  const [csv, setCsv]         = useState('');
  const [rows, setRows]       = useState([]);
  const [sendInvite, setSI]   = useState(true);
  const [submitting, setSub]  = useState(false);
  const [result, setResult]   = useState(null);   // { ok: [...], failed: [...] }
  const [error, setError]     = useState('');

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  useEffect(() => {
    try { setRows(parseCsv(csv)); }
    catch { setRows([]); }
  }, [csv]);

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    e.target.value = '';
  };

  const submit = async () => {
    setSub(true); setError(''); setResult(null);
    try {
      const res = await userManagementService.bulkImport(rows, { send_invite: sendInvite });
      setResult(res);
      // If everything succeeded, close after a beat.
      if (res && res.failed && res.failed.length === 0) {
        setTimeout(() => onDone && onDone(res), 800);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setSub(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display font-700 text-base text-slate-800 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" /> Bulk import users
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs font-body text-slate-500 dark:text-slate-400">
            Paste CSV text or upload a .csv file. The first row must be the header.
            Required columns: <span className="font-mono">email</span>, <span className="font-mono">name</span>, <span className="font-mono">role</span>.
          </p>

          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-body font-600 cursor-pointer flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10">
              <FileText className="w-3.5 h-3.5" /> Choose .csv file
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} />
            </label>
            <button onClick={() => setCsv(TEMPLATE)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10">
              Load template
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs font-body text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSI(e.target.checked)} />
              Generate invite links
            </label>
          </div>

          <textarea value={csv} onChange={(e) => setCsv(e.target.value)}
            rows={8}
            placeholder="email,name,role,phone_number,..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />

          {rows.length > 0 && (
            <div className="text-xs font-body text-slate-500 dark:text-slate-400">
              Parsed <span className="font-700 text-slate-700 dark:text-slate-200">{rows.length}</span> rows.
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-body">{error}</div>}

          {result && (
            <div className="border border-slate-100 dark:border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-body font-600">{result.ok.length} succeeded</span>
              </div>
              {result.failed?.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-body font-600">{result.failed.length} failed</span>
                  </div>
                  <ul className="text-[11px] font-mono text-red-700 max-h-32 overflow-y-auto space-y-0.5">
                    {result.failed.map((f, i) => (
                      <li key={i}>row {f.row} — {f.email || '(no email)'}: {f.error}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600">
            Close
          </button>
          <button onClick={submit} disabled={!rows.length || submitting}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 flex items-center gap-1.5 disabled:opacity-40">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import {rows.length ? `(${rows.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
