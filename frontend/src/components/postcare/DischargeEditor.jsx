/**
 * DischargeEditor.jsx
 * Vet-side editor for the post-care discharge instructions.
 * Builds the structured arrays (steps, feeding, videos) inline.
 *
 * Props:
 *   appointmentId   required
 *   initial         optional existing discharge row
 *   onSaved(row)
 */
import { useState } from 'react';
import {
  Plus, Trash2, Save, Eye, Loader2, ClipboardCheck, Utensils, Video, Calendar,
} from 'lucide-react';
import { postCareService } from '../../services/postCareService';

const EMPTY_STEP    = { title: '', detail: '', when: '' };
const EMPTY_FEEDING = { food: '', amount: '', frequency: '', notes: '' };
const EMPTY_VIDEO   = { title: '', url: '', kind: 'youtube' };

export default function DischargeEditor({ appointmentId, initial, onSaved }) {
  const [title, setTitle] = useState(initial?.title || 'Discharge Instructions');
  const [body,  setBody]  = useState(initial?.body  || '');
  const [followUp, setFollowUp] = useState(initial?.follow_up_date || '');
  const [steps,   setSteps]   = useState(initial?.steps   || []);
  const [feeding, setFeeding] = useState(initial?.feeding || []);
  const [videos,  setVideos]  = useState(initial?.videos  || []);
  const [publishing, setPublishing] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async (isPublished) => {
    setErr('');
    if (isPublished) setPublishing(true); else setDraftSaving(true);
    try {
      const data = await postCareService.upsertDischarge({
        appointmentId, title, body,
        steps:   steps.filter(s => s.title?.trim()),
        feeding: feeding.filter(f => f.food?.trim()),
        videos:  videos.filter(v => v.title?.trim() && v.url?.trim()),
        followUpDate: followUp || null,
        isPublished,
      });
      onSaved && onSaved(data);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to save.');
    } finally { setPublishing(false); setDraftSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body font-600 bg-white dark:bg-slate-800" />
        <label className="flex items-center gap-2 text-xs font-body text-slate-500">
          <Calendar className="w-3.5 h-3.5" /> Follow-up
          <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-body bg-white" />
        </label>
      </div>

      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">
          Notes
        </span>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Free-text post-care notes the owner will see at the top"
          className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
      </label>

      {/* Steps */}
      <ArraySection icon={ClipboardCheck} title="Step-by-step care" empty={EMPTY_STEP} list={steps} setList={setSteps}
        render={(item, set) => (
          <>
            <input required placeholder="Step title *" value={item.title}
              onChange={(e) => set({ ...item, title: e.target.value })} className={INPUT} />
            <input placeholder="When (e.g. 'after meals')" value={item.when}
              onChange={(e) => set({ ...item, when: e.target.value })} className={INPUT} />
            <textarea rows={2} placeholder="Details" value={item.detail}
              onChange={(e) => set({ ...item, detail: e.target.value })}
              className={`sm:col-span-2 ${INPUT}`} />
          </>
        )} cols="grid-cols-1 sm:grid-cols-2" />

      {/* Feeding */}
      <ArraySection icon={Utensils} title="Feeding & recovery" empty={EMPTY_FEEDING} list={feeding} setList={setFeeding}
        render={(item, set) => (
          <>
            <input required placeholder="Food / item *" value={item.food}
              onChange={(e) => set({ ...item, food: e.target.value })} className={INPUT} />
            <input placeholder="Amount" value={item.amount}
              onChange={(e) => set({ ...item, amount: e.target.value })} className={INPUT} />
            <input placeholder="Frequency" value={item.frequency}
              onChange={(e) => set({ ...item, frequency: e.target.value })} className={INPUT} />
            <input placeholder="Notes" value={item.notes}
              onChange={(e) => set({ ...item, notes: e.target.value })} className={INPUT} />
          </>
        )} cols="grid-cols-1 sm:grid-cols-2" />

      {/* Videos */}
      <ArraySection icon={Video} title="Tutorial videos" empty={EMPTY_VIDEO} list={videos} setList={setVideos}
        render={(item, set) => (
          <>
            <input required placeholder="Video title *" value={item.title}
              onChange={(e) => set({ ...item, title: e.target.value })} className={INPUT} />
            <select value={item.kind} onChange={(e) => set({ ...item, kind: e.target.value })} className={INPUT}>
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="other">Other</option>
            </select>
            <input required placeholder="URL *" value={item.url}
              onChange={(e) => set({ ...item, url: e.target.value })}
              className={`sm:col-span-2 ${INPUT}`} />
          </>
        )} cols="grid-cols-1 sm:grid-cols-2" />

      {err && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}

      <div className="flex items-center justify-end gap-2">
        <button onClick={() => save(false)} disabled={draftSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-600 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50">
          {draftSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save draft
        </button>
        <button onClick={() => save(true)} disabled={publishing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-600 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50">
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Publish to client
        </button>
      </div>
    </div>
  );
}

const INPUT = 'rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800';

function ArraySection({ icon: Icon, title, empty, list, setList, render, cols }) {
  const add = () => setList([...list, { ...empty }]);
  const remove = (i) => setList(list.filter((_, idx) => idx !== i));
  const update = (i, next) => setList(list.map((it, idx) => idx === i ? next : it));

  return (
    <section className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-xs font-body font-600 uppercase tracking-wider text-slate-500">
          <Icon className="w-3.5 h-3.5 text-blue-600" /> {title}
        </h3>
        <button onClick={add} type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-body font-600 bg-blue-50 hover:bg-blue-100 text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs font-body text-slate-400 italic">None added yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((item, i) => (
            <li key={i} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-white/10">
              <div className={`grid ${cols} gap-2`}>
                {render(item, (next) => update(i, next))}
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={() => remove(i)}
                  className="text-xs font-body text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
