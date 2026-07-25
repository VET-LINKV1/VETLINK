/**
 * MessageBubble.jsx
 * Single chat message + its attachments. Aligns left/right based on
 * whether the caller is the sender.
 *
 * Props:
 *   message       row from /api/comms (with attachments)
 *   isMine        boolean
 *   onAttachmentClick(att)  opens signed URL
 *   onDelete()
 */
import { useState } from 'react';
import {
  FileText, Image as ImageIcon, Film, Download, Trash2, MoreHorizontal,
} from 'lucide-react';
import { commsService } from '../../services/commsService';

function fmtTime(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    const today = new Date();
    if (dt.toDateString() === today.toDateString()) {
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return dt.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function bytes(n) {
  if (!n) return '';
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function MessageBubble({ message, isMine, onDelete }) {
  const [menu, setMenu] = useState(false);
  const isSystem = message.kind === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <p className="text-xs font-body italic text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">
          {message.body}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[78%] sm:max-w-[70%] rounded-2xl overflow-hidden
        ${isMine ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="flex flex-col">
            {message.attachments.map((att) => (
              <AttachmentTile key={att.id} att={att} mine={isMine} />
            ))}
          </div>
        )}

        {/* Text body */}
        {message.body && (
          <p className="px-3 py-2 text-sm font-body whitespace-pre-wrap break-words">
            {message.body}
          </p>
        )}

        {/* Timestamp + menu */}
        <div className={`flex items-center justify-end gap-1 px-3 pb-1
          ${isMine ? 'text-blue-100' : 'text-slate-400'} text-[10px] font-body`}>
          {fmtTime(message.created_at)}
          {isMine && (
            <div className="relative">
              <button onClick={() => setMenu(s => !s)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10">
                <MoreHorizontal className="w-3 h-3" />
              </button>
              {menu && (
                <div className="absolute right-0 top-5 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32">
                  <button onClick={() => { setMenu(false); onDelete && onDelete(); }}
                    className="w-full text-left px-3 py-1 text-xs font-body text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentTile({ att, mine }) {
  const [signedUrl, setUrl] = useState(null);
  const [loading,   setL]   = useState(false);

  const fetchUrl = async () => {
    if (signedUrl) return signedUrl;
    setL(true);
    try {
      const res = await commsService.getAttachmentUrl(att.id);
      setUrl(res.url);
      return res.url;
    } catch (_) { return null; }
    finally { setL(false); }
  };
  const open = async () => {
    const u = await fetchUrl();
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };

  // Inline previews for images
  if (att.kind === 'image') {
    return (
      <button onClick={open} className="block">
        <ImagePreview att={att} mine={mine} loadUrl={fetchUrl} />
      </button>
    );
  }
  // Inline player for videos
  if (att.kind === 'video') {
    return (
      <div className="p-2">
        <VideoPreview att={att} loadUrl={fetchUrl} />
      </div>
    );
  }
  // Generic file row
  const Icon = att.mime_type?.startsWith('image/') ? ImageIcon
           : att.mime_type?.startsWith('video/') ? Film
           : FileText;
  return (
    <button onClick={open} disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 text-left ${mine ? 'hover:bg-white/10' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mine ? 'bg-white/15' : 'bg-blue-50 text-blue-600'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-body font-600 truncate ${mine ? '' : ''}`}>{att.file_name}</p>
        <p className={`text-[10px] uppercase tracking-wider ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
          {att.mime_type} · {bytes(att.size_bytes)}
        </p>
      </div>
      <Download className={`w-3.5 h-3.5 ${mine ? 'text-blue-100' : 'text-slate-400'}`} />
    </button>
  );
}

function ImagePreview({ att, loadUrl }) {
  const [src, setSrc] = useState(null);
  if (!src) loadUrl().then(setSrc);
  return src
    ? <img src={src} alt={att.file_name} className="max-h-72 w-full object-cover" />
    : <div className="h-40 bg-slate-200 animate-pulse" />;
}

function VideoPreview({ att, loadUrl }) {
  const [src, setSrc] = useState(null);
  if (!src) loadUrl().then(setSrc);
  return src
    ? <video controls src={src} className="max-h-80 w-full rounded-lg bg-black" />
    : <div className="h-40 bg-slate-200 animate-pulse rounded-lg" />;
}
