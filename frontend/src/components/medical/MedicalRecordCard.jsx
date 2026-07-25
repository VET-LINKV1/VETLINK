/**
 * MedicalRecordCard.jsx
 * Displays a single medical record — collapsed + expandable.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Stethoscope, Pill, FileText, Weight, Thermometer, Calendar, Edit2 } from 'lucide-react';

function MedicalRecordCard({ record, canEdit, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const visitDate = new Date(record.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
  const followUp = record.follow_up_date
    ? new Date(record.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Teal left strip */}
      <div className="flex">
        <div className="w-1 bg-teal-400 shrink-0" />
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display text-slate-800 text-sm font-700">{visitDate}</p>
                {record.appointments?.type && (
                  <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-lg font-body font-600">
                    {record.appointments.type}
                  </span>
                )}
                {followUp && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-body font-600 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Follow-up {followUp}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs font-body mt-0.5">
                By {record.vet?.name || 'Unknown Vet'}
                {(record.weight_kg || record.temperature_c) && (
                  <span className="ml-2">
                    {record.weight_kg    && <span className="ml-1.5"><Weight className="w-3 h-3 inline" /> {record.weight_kg}kg</span>}
                    {record.temperature_c && <span className="ml-1.5"><Thermometer className="w-3 h-3 inline" /> {record.temperature_c}°C</span>}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {canEdit && (
                <button onClick={() => onEdit(record)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Diagnosis preview — always visible */}
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Stethoscope className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
              <p className={`text-sm font-body text-slate-700 ${!expanded ? 'line-clamp-2' : ''}`}>
                {record.diagnosis}
              </p>
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {record.treatment && (
                <Detail icon={Stethoscope} label="Treatment" value={record.treatment} color="text-blue-500" />
              )}
              {record.prescription && (
                <Detail icon={Pill} label="Prescription" value={record.prescription} color="text-violet-500" />
              )}
              {record.notes && (
                <Detail icon={FileText} label="Notes" value={record.notes} color="text-slate-400" />
              )}
              {!record.treatment && !record.prescription && !record.notes && (
                <p className="text-slate-300 text-xs font-body italic">No additional details recorded.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value, color }) {
  return (
    <div>
      <p className={`text-xs font-body font-600 uppercase tracking-wide mb-1 flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm font-body text-slate-700 whitespace-pre-line leading-relaxed">{value}</p>
    </div>
  );
}

export default MedicalRecordCard;
