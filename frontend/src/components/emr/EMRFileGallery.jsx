/**
 * EMRFileGallery.jsx
 * Upload + preview EMR files (X-rays, lab results, prescriptions, docs, photos).
 * Files render as cards; clicking one fetches a signed URL and opens it.
 *
 * Props:
 *   petId
 *   files       Array<emr_file>
 *   canWrite    boolean   (controls upload + delete)
 *   onChange()
 */
import { useState, useRef } from 'react';
import {
  Upload, FileImage, FileText, FileBadge, FileCheck, Trash2, Loader2, X,
} from 'lucide-react';
import { emrService } from '../../services/emrService';

const KIND_OPTIONS = [
  { value: 'xray',             label: 'X-ray' },
  { value: 'lab_result',       label: 'Lab result' },
  { value: 'prescription_doc', label: 'Prescription' },
  { value: 'photo',            label: 'Photo' },
  { value: 'document',         label: 'Document' },
  { value: 'other',            label: 'Other' },
];

const KIND_META = {
  xray:             { icon: FileImage,  tint: 'bg-blue-50  text-blue-600' },
  lab_result:       { icon: FileCheck,  tint: 'bg-emerald-50 text-emerald-600' },
  prescription_doc: { icon: FileBadge,  tint: 'bg-violet-50 text-violet-600' },
  photo:            { icon: FileImage,  tint: 'bg-pink-50 text-pink-600' },
  document:         { icon: FileText,   tint: 'bg-slate-100 text-slate-600' },
  other:            { icon: FileText,   tint: 'bg-slate-100 text-slate-500' },
};

function bytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024)         return `${n} B`;
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function EMRFileGallery({ petId, files = [], canWrite, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [err, setErr]             = useState('');
  const [meta, setMeta]           = useState({ kind: 'document', title: '', description: '' });
  const [pending, setPending]     = useState(null); // selected file before upload

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPending(f);
    setMeta((m) => ({ ...m, title: m.title || f.name.replace(/\.[^.]+$/, '') }));
  };

  const upload = async () => {
    if (!pending) return;
    if (!meta.title) { setErr('Title is required.'); return; }
    setErr(''); setUploading(true); setProgress(0);
    try {
      await emrService.uploadFile(pending, { petId, ...meta }, (p) => setProgress(p));
      setPending(null);
      setMeta({ kind: 'document', title: '', description: '' });
      if (inputRef.current) inputRef.current.value = '';
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const cancelPending = () => {
    setPending(null);
    setErr('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const open = async (f) => {
    try {
      const res = await emrService.getFileUrl(f.id);
      if (res?.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (_) { alert('Could not open file.'); }
  };

  const remove = async (f) => {
    if (!confirm(`Archive "${f.title}"?`)) return;
    try { await emrService.deleteFile(f.id, false); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
          {!pending ? (
            <label className="flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/10 cursor-pointer hover:bg-white dark:hover:bg-white/5 text-slate-500 text-sm font-body">
              <Upload className="w-4 h-4" />
              Choose a file (X-ray, lab PDF, photo, doc) — max 25 MB
              <input ref={inputRef} type="file" className="hidden" onChange={onPick}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.dcm" />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-body text-slate-700 dark:text-slate-200">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="truncate flex-1">{pending.name}</span>
                <span className="text-xs text-slate-400">{bytes(pending.size)}</span>
                <button onClick={cancelPending} className="p-1 rounded-lg text-slate-400 hover:bg-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white">
                  {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input required placeholder="Title *" value={meta.title}
                  onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
                <input placeholder="Description" value={meta.description}
                  onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                  className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
              </div>
              {err && <p className="text-xs text-red-500">{err}</p>}
              {uploading && (
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={upload} disabled={uploading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!files.length ? (
        <p className="text-sm text-slate-400 font-body text-center py-6">No files attached.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((f) => {
            const m = KIND_META[f.kind] || KIND_META.document;
            const Icon = m.icon;
            return (
              <div key={f.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3 flex items-start gap-3 hover:border-blue-300 transition-colors">
                <button onClick={() => open(f)} className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.tint}`}>
                  <Icon className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => open(f)} className="block w-full text-left">
                    <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                      {f.title}
                    </p>
                    <p className="text-xs text-slate-400 font-body mt-0.5">
                      {f.kind.replace('_', ' ')} · {bytes(f.size_bytes)}
                    </p>
                    {f.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-1 line-clamp-2">
                        {f.description}
                      </p>
                    )}
                  </button>
                </div>
                {canWrite && (
                  <button onClick={() => remove(f)} title="Archive"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
