/**
 * ChatComposer.jsx
 * Text input + attachment uploader. Hits sendMessage / uploadAttachment
 * from useConversation().
 *
 * Props:
 *   onSend(text)
 *   onAttach(file)
 *   uploading      boolean — disables UI while attaching
 *   progress       0..100 if uploading
 *   placeholder
 */
import { useRef, useState } from 'react';
import { Send, Paperclip, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function ChatComposer({ onSend, onAttach, uploading = false, progress = 0, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const submit = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || uploading) return;
    setText('');
    await onSend(t);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f || !onAttach) return;
    onAttach(f);
    e.target.value = '';
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-100 dark:border-white/10 p-3 bg-white dark:bg-slate-900">
      {uploading && (
        <div className="mb-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="cursor-pointer p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 shrink-0"
          title="Attach photo or video">
          <ImageIcon className="w-4 h-4" />
          <input ref={inputRef} type="file" className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.dcm"
            onChange={pick} disabled={uploading} />
        </label>

        <textarea rows={1} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          disabled={uploading}
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500/30 max-h-32" />

        <button type="submit" disabled={!text.trim() || uploading}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-40 shrink-0">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
}
