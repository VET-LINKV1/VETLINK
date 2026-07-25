import { X } from 'lucide-react';

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-slate-800 text-lg font-700">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[65vh] overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <div className="flex gap-3 px-6 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}
export default Modal;
