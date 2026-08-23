/**
 * SystemSettings.jsx
 * Date format, time format, timezone, currency, language, pagination,
 * dashboard refresh, and other general preferences.
 */
import { useState, useEffect } from 'react';
import { SlidersHorizontal, Calendar, Clock, Globe, DollarSign, Languages, LayoutGrid, RefreshCw } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, Select, FormFooter, Note, Toggle, ErrorCard } from './primitives';

const DATE_FORMATS = [
  'MMM D, YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'D MMM YYYY',
];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
];
const TIMEZONES = ['Asia/Manila','Asia/Singapore','Asia/Tokyo','Asia/Dubai','Europe/London','America/New_York','UTC'];
const CURRENCIES = ['PHP','USD','SGD','AED','EUR','GBP','AUD','CAD'];

export default function SystemSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    settingsService.getSection('system')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load system preferences. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const sys = data || {};

  const set = async (patch) => {
    setData(prev => {
      const merged = { ...prev, ...patch };
      settingsService.updateSection('system', merged).catch(e => console.error(e));
      return merged;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('system', data, 'Updated system preferences');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    await settingsService.resetSection('system');
    const d = await settingsService.getSection('system');
    setData(d);
    setSaving(false);
  };

    if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingCard title="Localization" subtitle="How dates, times, money, and language are displayed." icon={Globe}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Date format" htmlFor="sysdate">
            <Select id="sysdate" value={sys.dateFormat} onChange={e => set({ dateFormat: e.target.value })}>
              {DATE_FORMATS.map(f => <option key={f} value={f}>{f} (e.g. {new Date().toLocaleDateString()})</option>)}
            </Select>
          </Field>
          <Field label="Time format" htmlFor="systime">
            <Select id="systime" value={sys.timeFormat} onChange={e => set({ timeFormat: e.target.value })}>
              <option value="12h">12-hour (AM/PM)</option>
              <option value="24h">24-hour</option>
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="systz">
            <Select id="systz" value={sys.timezone} onChange={e => set({ timezone: e.target.value })}>
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Currency" htmlFor="syscur">
            <Select id="syscur" value={sys.currency} onChange={e => set({ currency: e.target.value })}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Language" htmlFor="syslang">
            <Select id="syslang" value={sys.language} onChange={e => set({ language: e.target.value })}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </Field>
          <Field label="Week starts on" htmlFor="sysweek">
            <Select id="sysweek" value={sys.weekStart} onChange={e => set({ weekStart: e.target.value })}>
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
            </Select>
          </Field>
        </div>
      </SettingCard>

      <SettingCard title="Display & Performance" subtitle="Table density, pagination, and live refresh." icon={LayoutGrid}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rows per page" htmlFor="syspage">
            <Select id="syspage" value={sys.pagination} onChange={e => set({ pagination: Number(e.target.value) })}>
              {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Dashboard auto-refresh (seconds)" htmlFor="sysrefresh">
            <Select id="sysrefresh" value={sys.dashboardRefreshSec} onChange={e => set({ dashboardRefreshSec: Number(e.target.value) })}>
              {[15,30,60,120,0].map(n => <option key={n} value={n}>{n === 0 ? 'Off' : `${n}s`}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Compact tables</p>
            <p className="text-xs font-body text-slate-400">Reduce row padding for denser data views.</p>
          </div>
          <Toggle checked={sys.compactTables} onChange={v => set({ compactTables: v })} label="Compact tables" />
        </div>
        <Note tone="info">Localization changes apply to the current administrator's view immediately. Currency and timezone here sync with Clinic and Billing defaults where appropriate.</Note>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}
