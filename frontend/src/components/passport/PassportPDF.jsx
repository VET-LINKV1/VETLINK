/**
 * PassportPDF.jsx
 *
 * Renders the printable health-passport layout AND exposes a
 * downloadAsPDF(node, filename) helper that turns it into a PDF
 * using jsPDF + html2canvas (loaded lazily so they don't bloat
 * the main bundle).
 *
 * The component is also used directly as the on-screen print
 * preview — it's styled to look identical printed or rendered.
 */
import { forwardRef } from 'react';
import { Shield, ShieldAlert, AlertTriangle, Syringe, Pill, FileText, Stethoscope, Activity } from 'lucide-react';

/* ── PDF generation ────────────────────────────────────────────── */

export async function downloadAsPDF(node, filename = 'health-passport.pdf') {
  if (!node) throw new Error('No node to render');
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL('image/png');

  // A4 in mm: 210 × 297
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth  = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Multi-page slicing if the rendered HTML is taller than one page.
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

/* ── visual helpers ───────────────────────────────────────────── */

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }); }
  catch { return d; }
}

const STATUS_PIXEL = {
  protected:     { color: '#10b981', label: 'Protected'      },
  expiring_soon: { color: '#f59e0b', label: 'Expiring soon'  },
  overdue:       { color: '#ef4444', label: 'Overdue'        },
  scheduled:     { color: '#3b82f6', label: 'Scheduled'      },
  cancelled:     { color: '#94a3b8', label: 'Cancelled'      },
};

/* ── printable component ──────────────────────────────────────── */

const PassportPDF = forwardRef(function PassportPDF({ data }, ref) {
  if (!data?.pet) {
    return <div ref={ref} className="p-8 text-slate-400">No passport data.</div>;
  }
  const { pet, owner, summary, vaccinations, weightSeries, recentVisits, prescriptions } = data;

  const overall = STATUS_PIXEL[summary?.overall_vax_status] || STATUS_PIXEL.scheduled;

  return (
    <div ref={ref} className="bg-white text-slate-800 mx-auto" style={{ width: 794, padding: 40, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-blue-600 pb-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-600 font-bold">VETLINK · Digital Health Passport</p>
          <h1 className="text-3xl font-bold mt-1">{pet.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{pet.gender ? ` · ${pet.gender}` : ''}{pet.age != null ? ` · ${pet.age}y` : ''}
            {pet.color ? ` · ${pet.color}` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Generated</p>
          <p className="font-semibold text-slate-700">{fmt(new Date())}</p>
        </div>
      </div>

      {/* Owner + status snapshot */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Owner</p>
          <p className="text-sm font-semibold mt-0.5">{owner?.name || '—'}</p>
          <p className="text-xs text-slate-500">{owner?.email || ''}</p>
          <p className="text-xs text-slate-500">{owner?.phone_number || ''}</p>
        </div>
        <div className="border border-slate-200 rounded-lg p-3" style={{ borderLeftColor: overall.color, borderLeftWidth: 4 }}>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Vaccination status</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: overall.color }}>{overall.label}</p>
          <p className="text-xs text-slate-500">
            {summary?.vax_protected || 0} protected · {summary?.vax_expiring || 0} expiring · {summary?.vax_overdue || 0} overdue
          </p>
        </div>
        <div className="border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Current weight</p>
          <p className="text-sm font-semibold mt-0.5">
            {summary?.current_weight_kg != null ? `${Number(summary.current_weight_kg).toFixed(2)} kg` : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {summary?.current_bcs ? `BCS ${summary.current_bcs}/9` : ''}
            {summary?.weight_last_at ? ` · ${fmt(summary.weight_last_at)}` : ''}
          </p>
        </div>
      </div>

      {/* Vaccinations */}
      <Section icon={Syringe} title="Vaccination record">
        {vaccinations?.length ? (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-semibold">Vaccine</th>
                <th className="text-left py-2 font-semibold">Administered</th>
                <th className="text-left py-2 font-semibold">Next due</th>
                <th className="text-left py-2 font-semibold">Batch</th>
                <th className="text-left py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {vaccinations.map((v) => {
                const s = STATUS_PIXEL[v.passport_status] || STATUS_PIXEL.scheduled;
                return (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{v.vaccine_name}</td>
                    <td className="py-2 text-slate-500">{fmt(v.administered_date)}</td>
                    <td className="py-2 text-slate-500">{fmt(v.due_date)}</td>
                    <td className="py-2 text-slate-500">{v.batch_number || '—'}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase"
                        style={{ color: s.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty />}
      </Section>

      {/* Rabies certificate highlight */}
      {(() => {
        const rabies = vaccinations?.find(v => /rabies/i.test(v.vaccine_name));
        if (!rabies) return null;
        const s = STATUS_PIXEL[rabies.passport_status] || STATUS_PIXEL.scheduled;
        return (
          <Section icon={Shield} title="Rabies certificate">
            <div className="border-2 border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Status</p>
                  <p className="text-base font-bold" style={{ color: s.color }}>{s.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Last given</p>
                  <p className="text-sm font-semibold">{fmt(rabies.administered_date)}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-2">Expires</p>
                  <p className="text-sm font-semibold">{fmt(rabies.due_date)}</p>
                </div>
              </div>
              {rabies.batch_number && (
                <p className="text-xs text-slate-500 mt-3">Batch # {rabies.batch_number}{rabies.manufacturer ? ` · ${rabies.manufacturer}` : ''}</p>
              )}
            </div>
          </Section>
        );
      })()}

      {/* Weight history */}
      <Section icon={Activity} title="Weight & growth">
        {weightSeries?.length ? (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-semibold">Date</th>
                <th className="text-right py-2 font-semibold">Weight (kg)</th>
                <th className="text-right py-2 font-semibold">BCS</th>
                <th className="text-left py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...weightSeries].slice(-12).reverse().map((w, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">{fmt(w.recorded_at)}</td>
                  <td className="py-2 text-right font-medium">{Number(w.weight_kg).toFixed(2)}</td>
                  <td className="py-2 text-right text-slate-500">{w.body_condition_score ?? '—'}</td>
                  <td className="py-2 text-slate-500">{w.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty />}
      </Section>

      {/* Medical history */}
      <Section icon={Stethoscope} title="Medical history">
        {recentVisits?.length ? (
          <ol className="space-y-2 text-xs">
            {recentVisits.map((r) => (
              <li key={r.id} className="border-l-2 border-blue-200 pl-3">
                <p className="font-semibold">{fmt(r.visit_date)} — {r.diagnosis}</p>
                {r.treatment && <p className="text-slate-500 mt-0.5">Treatment: {r.treatment}</p>}
                {r.notes && <p className="text-slate-500 mt-0.5 italic">{r.notes}</p>}
              </li>
            ))}
          </ol>
        ) : <Empty />}
      </Section>

      {/* Prescriptions */}
      {prescriptions?.length > 0 && (
        <Section icon={Pill} title="Active prescriptions">
          <ul className="space-y-1 text-xs">
            {prescriptions.filter(p => p.status === 'active').map((p) => (
              <li key={p.id}>
                <span className="font-semibold">{p.medication_name}</span> — {p.dosage} · {p.frequency}
                {p.route ? ` · ${p.route}` : ''}
                {p.end_date ? ` (until ${fmt(p.end_date)})` : ''}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-[10px] text-slate-400 mt-8 pt-3 border-t border-slate-200 text-center">
        VETLINK Digital Health Passport · Issued {fmt(new Date())} · Verify at the issuing clinic.
      </p>
    </div>
  );
});

export default PassportPDF;

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mb-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-blue-700 mb-2">
        <Icon className="w-4 h-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="text-xs text-slate-400 italic">No records on file.</p>;
}
