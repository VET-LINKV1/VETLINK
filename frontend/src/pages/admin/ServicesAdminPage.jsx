import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Plus, Edit, Trash2, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';

const URGENCY_OPTIONS = [
  { value: 'routine',    label: 'Routine' },
  { value: 'standard',   label: 'Standard' },
  { value: 'urgent',     label: 'Urgent' },
  { value: 'emergency',  label: 'Emergency' },
];

const COLOR_OPTIONS = [
  { value: 'blue',    label: 'Blue',    class: 'bg-blue-100 text-blue-700' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-100 text-emerald-700' },
  { value: 'violet',  label: 'Violet',  class: 'bg-violet-100 text-violet-700' },
  { value: 'amber',   label: 'Amber',   class: 'bg-amber-100 text-amber-700' },
  { value: 'red',     label: 'Red',     class: 'bg-red-100 text-red-700' },
  { value: 'slate',   label: 'Slate',   class: 'bg-slate-100 text-slate-700' },
];

const DEFAULT_SERVICE = {
  code: '',
  label: '',
  description: '',
  urgency: 'standard',
  duration_mins: 30,
  suggested_specialty: '',
  color: 'slate',
  price: null,
  is_active: true,
  display_order: 999,
};

export default function ServicesAdminPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_SERVICE });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) {
      setToast({ type: 'error', msg: error.message });
    } else {
      setServices(data || []);
    }
    setLoading(false);
  }

  function slugify(label) {
    return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function validate() {
    const e = {};
    if (!form.label.trim()) e.label = 'Name is required';
    if (form.price !== null && form.price !== '' && (isNaN(form.price) || form.price < 0)) e.price = 'Invalid price';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const autoCode = slugify(form.label) || ('service_' + Date.now());
      const payload = {
        code: (form.code || autoCode).trim().toLowerCase() || autoCode,
        label: form.label.trim(),
        description: null,
        urgency: form.urgency,
        duration_mins: 30,
        suggested_specialty: null,
        color: form.color,
        price: form.price === '' || form.price === null ? null : parseFloat(form.price),
        is_active: form.is_active,
        display_order: 999,
      };

      let error;
      if (editingId) {
        const res = await supabase
          .from('services')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        error = res.error;
      } else {
        const res = await supabase
          .from('services')
          .insert(payload);
        error = res.error;
      }

      if (error) throw error;
      setToast({ type: 'success', msg: editingId ? 'Service updated' : 'Service created' });
      setEditingId(null);
      setForm({ ...DEFAULT_SERVICE });
      loadServices();
    } catch (err) {
      setToast({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setForm({
      code: s.code,
      label: s.label,
      description: s.description || '',
      urgency: s.urgency,
      duration_mins: s.duration_mins,
      suggested_specialty: s.suggested_specialty || '',
      color: s.color,
      price: s.price ?? '',
      is_active: s.is_active,
      display_order: s.display_order,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...DEFAULT_SERVICE });
    setErrors({});
  }

  function startNew() {
    setEditingId(null);
    setForm({ ...DEFAULT_SERVICE });
    setErrors({});
  }

  async function handleDelete(id) {
    if (!confirm('Delete this service? This cannot be undone.')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) setToast({ type: 'error', msg: error.message });
    else {
      setToast({ type: 'success', msg: 'Service deleted' });
      loadServices();
    }
  }

  async function toggleActive(s) {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) setToast({ type: 'error', msg: error.message });
    else loadServices();
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display font-700">Services Management</h1>
        <button
          onClick={startNew}
          disabled={editingId}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-body ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto text-current opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Edit Form / Add Form */}
      {editingId && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6">
          <h2 className="font-display font-600 mb-4">Edit Service</h2>
          <ServiceForm form={form} errors={errors} onChange={setForm} onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      )}

      {!editingId && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6">
          <h2 className="font-display font-600 mb-4">Add New Service</h2>
          <ServiceForm form={form} errors={errors} onChange={setForm} onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Color</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Pricing</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {services.map(s => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-600">{s.label}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-600 uppercase ${COLOR_OPTIONS.find(c => c.value === s.color)?.class || 'bg-slate-100 text-slate-700'}`}>
                    {s.color}
                  </span>
                </td>
                <td className="px-6 py-4 capitalize">{s.urgency}</td>
                <td className="px-6 py-4">{s.price ? <span className="px-2 py-0.5 rounded-md text-xs font-600 bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">Fixed</span> : '—'}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => startEdit(s)} className="text-slate-400 hover:text-blue-600 mr-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceForm({ form, errors, onChange, onSave, onCancel, saving }) {
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? e.target.checked : value;
    onChange(prev => ({ ...prev, [name]: val }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field name="label" label="Name *" type="text" placeholder="Annual Check-up" value={form.label} onChange={handleChange} error={errors.label} />
      <Field name="urgency" label="Type *" type="select" value={form.urgency} onChange={handleChange} options={URGENCY_OPTIONS} error={errors.urgency} />
      <Field name="color" label="Color *" type="select" value={form.color} onChange={handleChange} options={COLOR_OPTIONS} error={errors.color} renderOption={o => <span className={`${o.class} px-2 py-1 rounded`}>{o.label}</span>} />

      <Field name="price" label="Pricing (₱)" type="number" step="0.01" placeholder="500.00" value={form.price} onChange={handleChange} error={errors.price} />

      <Field name="is_active" label="Active" type="checkbox" value={form.is_active} onChange={handleChange} fullWidth />

      <div className="lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-body font-500 hover:bg-slate-50 dark:hover:bg-white/5">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({ name, label, type, value, onChange, error, options, renderOption, placeholder, fullWidth, help, min, max, step }) {
  const className = `w-full px-3 py-2 rounded-xl border text-sm font-body focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
    error ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 focus:ring-blue-500'
  }`;

  if (type === 'checkbox') {
    return (
      <label className={fullWidth ? 'col-span-full' : ''} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox" name={name} checked={value} onChange={onChange} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <span className="font-body font-medium">{label}</span>
      </label>
    );
  }

  if (type === 'select') {
    return (
      <div className={fullWidth ? 'col-span-full' : ''}>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">{label}</label>
        <select name={name} value={value} onChange={onChange} className={className}>
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {renderOption ? renderOption(o) : o.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500 font-body">{error}</p>}
        {help && <p className="mt-1 text-xs text-slate-400 font-body">{help}</p>}
      </div>
    );
  }

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={className}
      />
      {error && <p className="mt-1 text-xs text-red-500 font-body">{error}</p>}
      {help && <p className="mt-1 text-xs text-slate-400 font-body">{help}</p>}
    </div>
  );
}