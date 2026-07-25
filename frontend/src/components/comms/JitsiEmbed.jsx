/**
 * JitsiEmbed.jsx
 * Thin iframe wrapper around a Jitsi Meet room.
 *
 * Props:
 *   url            full meeting URL (https://meet.jit.si/<room>#userInfo...)
 *   displayName    optional display name passed via URL hash
 *   subject        optional subject shown in Jitsi header
 *   onClose()      called when user clicks "Leave" overlay (host UI)
 *
 * Note: we intentionally use the iframe API (no external JS SDK) so the
 * component works out of the box on meet.jit.si with zero setup.
 */
import { useMemo } from 'react';

function buildUrl(base, displayName, subject) {
  // Jitsi reads userInfo and config from the URL hash.
  const params = [];
  if (displayName) {
    params.push(
      `userInfo.displayName=%22${encodeURIComponent(displayName)}%22`
    );
  }
  if (subject) {
    params.push(
      `config.subject=%22${encodeURIComponent(subject)}%22`
    );
  }
  // Sensible defaults for a clinical call
  params.push('config.prejoinPageEnabled=false');
  params.push('config.disableDeepLinking=true');
  params.push('config.startWithAudioMuted=false');
  params.push('config.startWithVideoMuted=false');

  return params.length ? `${base}#${params.join('&')}` : base;
}

export default function JitsiEmbed({ url, displayName, subject, onClose }) {
  const src = useMemo(() => buildUrl(url, displayName, subject), [url, displayName, subject]);

  if (!url) {
    return (
      <div className="w-full h-full bg-slate-900 text-slate-300 flex items-center justify-center rounded-2xl">
        <p className="font-body text-sm">No meeting URL.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <iframe
        title="Video consultation"
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-read; clipboard-write"
        allowFullScreen
        className="w-full h-full border-0"
      />
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-red-600 hover:bg-red-700 text-white text-xs font-body font-600 px-3 py-1.5 rounded-lg shadow-lg"
        >
          End call
        </button>
      )}
    </div>
  );
}
