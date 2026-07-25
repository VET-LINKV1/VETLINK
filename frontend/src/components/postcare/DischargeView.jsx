/**
 * DischargeView.jsx
 * Read-only discharge instructions display for the client portal.
 *
 * Props:
 *   discharge  — row from /api/postcare/discharges/by-appointment/...
 */
import { ClipboardCheck, Utensils, Video, Calendar, FileText, ExternalLink, Play } from 'lucide-react';

function videoEmbedUrl(v) {
  const u = v.url || '';
  // Naive YouTube/Vimeo embed mapping; falls back to original URL.
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function DischargeView({ discharge }) {
  if (!discharge) {
    return (
      <p className="text-sm text-slate-400 font-body italic text-center py-6">
        No discharge instructions published yet.
      </p>
    );
  }

  const { title, body, steps, feeding, videos, follow_up_date, files } = discharge;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-slate-800 dark:text-white text-xl font-700">{title}</h2>
        {follow_up_date && (
          <p className="text-xs font-body text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Follow-up on <b className="text-slate-700 dark:text-slate-200">{new Date(follow_up_date).toLocaleDateString()}</b>
          </p>
        )}
      </header>

      {body && (
        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
          <p className="text-sm font-body text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{body}</p>
        </div>
      )}

      {/* Step-by-step care */}
      {steps?.length > 0 && (
        <Section icon={ClipboardCheck} title="Step-by-step care">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-700 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200">{s.title}</p>
                  {s.when && <p className="text-xs text-slate-400 font-body">{s.when}</p>}
                  {s.detail && <p className="text-sm font-body text-slate-600 dark:text-slate-300 mt-1">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Feeding */}
      {feeding?.length > 0 && (
        <Section icon={Utensils} title="Feeding & recovery">
          <ul className="space-y-2">
            {feeding.map((f, i) => (
              <li key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3">
                <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200">{f.food}</p>
                <p className="text-xs font-body text-slate-500 mt-0.5">
                  {f.amount ? `${f.amount} · ` : ''}{f.frequency || ''}
                </p>
                {f.notes && <p className="text-xs font-body text-slate-600 dark:text-slate-300 mt-1 italic">"{f.notes}"</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Videos */}
      {videos?.length > 0 && (
        <Section icon={Video} title="Tutorial videos">
          <ul className="space-y-3">
            {videos.map((v, i) => {
              const embed = videoEmbedUrl(v);
              return (
                <li key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl overflow-hidden">
                  {embed ? (
                    <div className="aspect-video bg-black">
                      <iframe src={embed} title={v.title}
                        className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                    </div>
                  ) : (
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Play className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="flex-1 text-sm font-body text-slate-700 dark:text-slate-200">{v.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}
                  <p className="px-3 py-2 text-xs font-body text-slate-500">{v.title}</p>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Attached files */}
      {files?.length > 0 && (
        <Section icon={FileText} title="Attachments">
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.file?.id || Math.random()} className="text-sm font-body text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                {f.file?.title || 'Untitled file'}
                <span className="text-xs text-slate-400">({f.file?.mime_type})</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-400 font-body mt-2">
            Open the EMR Files tab for signed download links.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-body font-600 uppercase tracking-wider text-slate-500 mb-2">
        <Icon className="w-3.5 h-3.5 text-blue-600" /> {title}
      </h3>
      {children}
    </section>
  );
}
