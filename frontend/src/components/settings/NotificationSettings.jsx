/**
 * NotificationSettings.jsx
 * ClickSend SMS, email, appointment/vaccination/refill/lab/payment
 * notifications, templates, plus a "Send Test SMS" action.
 */
import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, CalendarCheck, Syringe, Pill, FlaskConical, CreditCard, Send, Wifi, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Toggle, FormFooter, Note, StatusPill, ErrorCard } from './primitives';

const CHANNELS = [
  { key: 'appointmentConfirmation', label: 'Appointment confirmations', icon: CalendarCheck },
  { key: 'appointmentReminder',     label: 'Appointment reminders',     icon: CalendarCheck },
  { key: 'vaccinationReminder',     label: 'Vaccination reminders',     icon: Syringe },
  { key: 'prescriptionRefill',      label: 'Prescription refill notices', icon: Pill },
  { key: 'labResult',               label: 'Laboratory result notices', icon: FlaskConical },
  { key: 'paymentConfirmation',     label: 'Payment confirmations',     icon: CreditCard },
  { key: 'emailDigest',             label: 'Weekly email digest',       icon: Mail },
];

const TEMPLATE_FIELDS = [
  { key: 'appointmentConfirmation', label: 'Appointment confirmation' },
  { key: 'appointmentReminder',     label: 'Appointment reminder' },
  { key: 'vaccinationReminder',     label: 'Vaccination reminder' },
  { key: 'prescriptionRefill',      label: 'Prescription refill' },
  { key: 'labResult',               label: 'Lab result' },
  { key: 'paymentConfirmation',     label: 'Payment confirmation' },
];

export default function NotificationSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [testSms, setTestSms] = useState({ open: false, phone: '', sending: false, result: null });
  const [testSmsDuration, setTestSmsDuration] = useState(0);
  const [error, setError] = useState(null);

  // Fetch on mount
  useEffect(() => {
    settingsService.getSection('notifications')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load notification settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  // Early error return
  if (error) {
    return <ErrorCard message={error} onRetry={() => window.location.reload()} />;
  }

  // Early loading return
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <SettingCard title="SMS (ClickSend)" subtitle="Outbound SMS provider configuration." icon={MessageSquare}>
          <div className="space-y-3 animate-pulse">
            <div className="h-12 rounded-lg bg-slate-100 dark:bg-white/5" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
            </div>
          </div>
        </SettingCard>
        <SettingCard title="Notification Channels" subtitle="Choose which events trigger messages." icon={Bell}>
          <div className="space-y-2 animate-pulse">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-white/5" />
            ))}
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
        <SettingCard title="Message Templates" subtitle="Variables: {{owner}} {{pet}} {{date}} {{time}} {{link}} {{amount}} {{receipt}} {{vaccine}} {{medication}}" icon={Mail}>
          <div className="space-y-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-white/5" />
            ))}
          </div>
        </SettingCard>
      </div>
    );
  }

  const n = data;

  const set = async (patch) => {
    await settingsService.updateSection('notifications', { ...n, ...patch });
    setData(d => ({ ...d, ...patch }));
  };
  const setChannel = (key, val) => set({ channels: { ...n.channels, [key]: val } });
  const setTemplate = (key, val) => set({ templates: { ...n.templates, [key]: val } });

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('notifications', n, 'Updated notification settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('notifications');
    const d = await settingsService.getSection('notifications');
    setData(d);
  };

  const openSendTest = () => setTestSms({ open: true, phone: data?.clinic?.mobile || '', sending: false, result: null });
  const sendTest = async () => {
    if (!/^\+?\d{7,}$/.test(testSms.phone.replace(/\s/g, ''))) { alert('Enter a valid phone number with country code.'); return; }
    setTestSms(s => ({ ...s, sending: true, result: null }));
    const res = await settingsService.testSms(testSms.phone, 'This is a test message from Paw Health Veterinary Clinic.');
    setTestSms(s => ({ ...s, sending: false, result: res }));
    setTestSmsDuration(d => d + 1);
  };

  return (
    <div className="space-y-5">
      <SettingCard title="SMS (ClickSend)" subtitle="Outbound SMS provider configuration." icon={MessageSquare}>
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">ClickSend</p>
              <p className="text-xs font-body text-slate-400">Sender ID: {n.clicksend.senderId}</p>
            </div>
          </div>
          <StatusPill tone={n.clicksend.connected ? 'success' : 'danger'}>
            {n.clicksend.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {n.clicksend.connected ? 'Connected' : 'Offline'}
          </StatusPill>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="From name" htmlFor="nfrom">
            <TextInput id="nfrom" value={n.clicksend.from} onChange={e => set({ clicksend: { ...n.clicksend, from: e.target.value } })} />
          </Field>
          <Field label="Sender ID" htmlFor="nsid">
            <TextInput id="nsid" value={n.clicksend.senderId} onChange={e => set({ clicksend: { ...n.clicksend, senderId: e.target.value } })} />
          </Field>
          <Field label="Email from" htmlFor="nemail">
            <TextInput id="nemail" type="email" value={n.emailFrom} onChange={e => set({ emailFrom: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Enable SMS notifications</p>
            <p className="text-xs font-body text-slate-400">Master switch for all SMS channels.</p>
          </div>
          <Toggle checked={n.clicksend.enabled} onChange={v => set({ clicksend: { ...n.clicksend, enabled: v } })} label="SMS enabled" />
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={openSendTest} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 flex items-center gap-1.5 shadow shadow-blue-500/20">
            <Send className="w-4 h-4" /> Send Test SMS
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Notification Channels" subtitle="Choose which events trigger messages." icon={Bell}>
        <div className="space-y-2">
          {CHANNELS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-blue-500" />
                <span className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">{label}</span>
              </div>
              <Toggle checked={n.channels[key]} onChange={v => setChannel(key, v)} label={label} />
            </div>
          ))}
        </div>
        <Field label="Reminder lead times (hours before)" htmlFor="nlead">
          <div className="flex flex-wrap gap-2 pt-1">
            {[1,2,4,24,48].map(h => {
              const on = n.reminderLeadHours.includes(h);
              return (
                <button key={h} type="button" onClick={() => set({ reminderLeadHours: on ? n.reminderLeadHours.filter(x => x !== h) : [...n.reminderLeadHours, h] })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body font-600 transition-colors
                    ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                  {h < 24 ? `${h}h` : `${h/24}d`}
                </button>
              );
            })}
          </div>
        </Field>
      </SettingCard>

      <SettingCard title="Message Templates" subtitle="Variables: {{owner}} {{pet}} {{date}} {{time}} {{link}} {{amount}} {{receipt}} {{vaccine}} {{medication}}" icon={Mail}>
        <div className="space-y-3">
          {TEMPLATE_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <textarea rows={2} value={n.templates[key]} onChange={e => setTemplate(key, e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none" />
            </Field>
          ))}
        </div>
        <Note tone="info">Templates support plain-text variables. Changes apply to new notifications only.</Note>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>

      {testSms.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setTestSms(s => ({ ...s, open: false }))}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="font-display text-slate-800 dark:text-white text-base font-700">Send Test SMS</h3>
              <Field label="Test phone number" htmlFor="tsms">
                <TextInput id="tsms" value={testSms.phone} onChange={e => setTestSms(s => ({ ...s, phone: e.target.value }))} placeholder="+63 917 555 0000" />
              </Field>
              <p className="text-xs font-body text-slate-400">Message: "This is a test message from Paw Health Veterinary Clinic."</p>
              {testSms.result && (
                <StatusPill tone={testSms.result.ok ? 'success' : 'danger'}>
                  {testSms.result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {testSms.result.message}
                </StatusPill>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/10 justify-end">
              <button onClick={() => setTestSms(s => ({ ...s, open: false }))} className="px-3.5 py-2 rounded-lg border dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600">Cancel</button>
              <button onClick={sendTest} disabled={testSms.sending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-body font-600 flex items-center gap-1.5">
                {testSms.sending && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}