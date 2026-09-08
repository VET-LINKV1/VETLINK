/**
 * ClinicSettings.jsx
 * Clinic name, logo, address, contact, email, operating hours,
 * emergency contact, timezone, currency.
 */
import { useState, useEffect } from 'react';
import { Building, MapPin, Phone, Mail, Globe, Clock, AlertCircle, DollarSign, Upload, Image } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, TextArea, Toggle, FormFooter, ChipList, Note, Select, ErrorCard } from './primitives';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TIMEZONES = ['Asia/Manila','Asia/Singapore','Asia/Tokyo','Asia/Dubai','Europe/London','America/New_York','America/Los_Angeles','UTC'];
const CURRENCIES = ['PHP','USD','SGD','AED','EUR','GBP','AUD','CAD'];

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-3 w-56 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClinicSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [hours, setHours] = useState([]);

  useEffect(() => {
    settingsService.getSection('clinic')
      .then(d => { setData(d); setLogoPreview(d.logoUrl); setHours(d.hours); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load clinic settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const c = data;

  const set = async (patch) => {
    await settingsService.updateSection('clinic', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('clinic', { ...data, hours, logoUrl: logoPreview }, `Updated clinic settings: ${data.name}`);
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('clinic');
    const d = await settingsService.getSection('clinic');
    setData(d);
    setLogoPreview(d.logoUrl);
    setHours(d.hours);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) { alert('Logo must be < 1 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard
        title="Clinic Identity"
        subtitle="Name, branding, and public contact details."
        icon={Building}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Clinic name" htmlFor="cname">
            <TextInput id="cname" value={c.name} onChange={e => set({ name: e.target.value })} />
          </Field>
          <Field label="Short name / abbreviation" htmlFor="cshort">
            <TextInput id="cshort" value={c.shortName} onChange={e => set({ shortName: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="cemail">
            <TextInput id="cemail" type="email" value={c.email} onChange={e => set({ email: e.target.value })} />
          </Field>
          <Field label="Phone (landline)" htmlFor="cphone">
            <TextInput id="cphone" value={c.phone} onChange={e => set({ phone: e.target.value })} />
          </Field>
          <Field label="Mobile" htmlFor="cmobile">
            <TextInput id="cmobile" value={c.mobile} onChange={e => set({ mobile: e.target.value })} />
          </Field>
          <Field label="Website" htmlFor="cweb">
            <TextInput id="cweb" value={c.website} onChange={e => set({ website: e.target.value })} />
          </Field>
          <Field label="Timezone" htmlFor="ctz">
            <Select id="ctz" value={c.timezone} onChange={e => set({ timezone: e.target.value })}>
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Currency" htmlFor="ccur">
            <Select id="ccur" value={c.currency} onChange={e => set({ currency: e.target.value })}>
              {CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="w-20 h-20 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-slate-300" />}
          </div>
          <div className="flex flex-col gap-2">
            <label className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Choose logo
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <p className="text-xs font-body text-slate-400">PNG/JPG, max 1 MB. Square recommended.</p>
          </div>
        </div>
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </SettingCard>

      <SettingCard
        title="Address"
        subtitle="Physical location for invoices, wayfinding, and regulatory filings."
        icon={MapPin}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Address line 1" htmlFor="ca1">
            <TextInput id="ca1" value={c.addressLine} onChange={e => set({ addressLine: e.target.value })} />
          </Field>
          <Field label="Address line 2 (optional)" htmlFor="ca2">
            <TextInput id="ca2" placeholder="Suite, floor, building" />
          </Field>
          <Field label="City" htmlFor="ccity">
            <TextInput id="ccity" value={c.city} onChange={e => set({ city: e.target.value })} />
          </Field>
          <Field label="State / Province" htmlFor="cstate">
            <TextInput id="cstate" value={c.state} onChange={e => set({ state: e.target.value })} />
          </Field>
          <Field label="Postal code" htmlFor="cpostal">
            <TextInput id="cpostal" value={c.postalCode} onChange={e => set({ postalCode: e.target.value })} />
          </Field>
          <Field label="Country" htmlFor="ccountry">
            <TextInput id="ccountry" value={c.country} onChange={e => set({ country: e.target.value })} />
          </Field>
        </div>
      </SettingCard>

      <SettingCard
        title="Operating Hours"
        subtitle="Displayed on booking portal and used for scheduling rules."
        icon={Clock}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((day) => {
            const h = hours.find(x => x.day === day) || { day, open: '08:00', close: '18:00', closed: false };
            return (
              <div key={day} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                <span className="w-24 font-body text-sm text-slate-700 dark:text-slate-200">{day}</span>
                <input type="checkbox"
                  checked={h.closed} onChange={e => setHours(hours.map(x => x.day === day ? { ...x, closed: e.target.checked } : x))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                <label className="text-xs font-body text-slate-500">Closed</label>
                <input type="time"
                  value={h.open} onChange={e => setHours(hours.map(x => x.day === day ? { ...x, open: e.target.value } : x))}
                  disabled={h.closed} className="w-24 text-sm border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 bg-white dark:bg-slate-800" />
                <span className="text-slate-400 text-xs">–</span>
                <input type="time"
                  value={h.close} onChange={e => setHours(hours.map(x => x.day === day ? { ...x, close: e.target.value } : x))}
                  disabled={h.closed} className="w-24 text-sm border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 bg-white dark:bg-slate-800" />
              </div>
            );
          })}
        </div>
      </SettingCard>

      <SettingCard
        title="Emergency Contact"
        subtitle="Shown on after-hours voicemail, website footer, and client portal."
        icon={AlertCircle}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name / Role" htmlFor="cename">
            <TextInput id="cename" value={c.emergencyName} onChange={e => set({ emergencyName: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="cephone">
            <TextInput id="cephone" value={c.emergencyPhone} onChange={e => set({ emergencyPhone: e.target.value })} hint="Include country code (e.g. +63 917 555 9001)" />
          </Field>
        </div>
      </SettingCard>
    </div>
  );
}
