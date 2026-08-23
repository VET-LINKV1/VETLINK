/**
 * SecuritySettings.jsx
 * Password policies, session timeout, login attempt limits, 2FA,
 * account lockout, device/session management, security notifications.
 */
import { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Clock, Lock, Fingerprint, Bell, Smartphone, Save } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, FormFooter, Note, ConfirmDialog, ErrorCard } from './primitives';

export default function SecuritySettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState(null);

  // Fetch on mount
  useEffect(() => {
    settingsService.getSection('security')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load security settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  // Early error return
  if (error) {
    return <ErrorCard message={error} onRetry={() => window.location.reload()} />;
  }

  // Early loading return
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <SettingCard title="Password Policy" subtitle="Enforcement rules for all user accounts." icon={KeyRound}>
          <div className="space-y-3 animate-pulse">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
            </div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              ))}
            </div>
          </div>
        </SettingCard>
        <SettingCard title="Session & Lockout" subtitle="Timeouts and brute-force protection." icon={Clock}>
          <div className="space-y-3 animate-pulse">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
              <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
            </div>
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
        <SettingCard title="Two-Factor Authentication" subtitle="Organization-wide 2FA enforcement." icon={Fingerprint}>
          <div className="space-y-3 animate-pulse">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
        <SettingCard title="Security Notifications" subtitle="Alerts on sensitive account events." icon={Bell}>
          <div className="space-y-3 animate-pulse">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        </SettingCard>
      </div>
    );
  }

  const sec = data;

  const set = async (patch) => {
    await settingsService.updateSection('security', { ...sec, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('security', sec, 'Updated security settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('security');
    const d = await settingsService.getSection('security');
    setData(d);
    setConfirmReset(false);
    setLastSaved('Security reset');
  };

  return (
    <div className="space-y-5">
      <SettingCard title="Password Policy" subtitle="Enforcement rules for all user accounts." icon={KeyRound}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Minimum length" htmlFor="smin">
            <TextInput id="smin" type="number" min="6" max="64" value={sec.minLength} onChange={e => set({ minLength: Number(e.target.value) })} />
          </Field>
          <Field label="Expiry (days, 0 = never)" htmlFor="sexp">
            <TextInput id="sexp" type="number" min="0" value={sec.passwordExpiryDays} onChange={e => set({ passwordExpiryDays: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="space-y-2 pt-1">
          {[
            { key: 'requireUppercase', label: 'Require uppercase letter' },
            { key: 'requireNumber',    label: 'Require a number' },
            { key: 'requireSymbol',    label: 'Require a symbol' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
              <span className="font-body text-sm text-slate-700 dark:text-slate-200">{label}</span>
              <Toggle checked={sec[key]} onChange={v => set({ [key]: v })} label={label} />
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Session & Lockout" subtitle="Timeouts and brute-force protection." icon={Clock}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Session timeout (minutes)" htmlFor="stimeout">
            <TextInput id="stimeout" type="number" min="5" max="480" value={sec.sessionTimeoutMin} onChange={e => set({ sessionTimeoutMin: Number(e.target.value) })} hint="Idle time before auto-logout." />
          </Field>
          <Field label="Max login attempts" htmlFor="smax">
            <TextInput id="smax" type="number" min="1" max="20" value={sec.maxLoginAttempts} onChange={e => set({ maxLoginAttempts: Number(e.target.value) })} />
          </Field>
          <Field label="Lockout duration (minutes)" htmlFor="slock">
            <TextInput id="slock" type="number" min="1" value={sec.lockoutMinutes} onChange={e => set({ lockoutMinutes: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Account lockout</p>
            <p className="text-xs font-body text-slate-400">Lock accounts after exceeding attempts.</p>
          </div>
          <Toggle checked={sec.lockoutEnabled} onChange={v => set({ lockoutEnabled: v })} label="Lockout" />
        </div>
      </SettingCard>

      <SettingCard title="Two-Factor Authentication" subtitle="Organization-wide 2FA enforcement." icon={Fingerprint}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Require 2FA for all staff</p>
            <p className="text-xs font-body text-slate-400">Overrides per-user opt-out.</p>
          </div>
          <Toggle checked={sec.twoFactorRequired} onChange={v => set({ twoFactorRequired: v })} label="Require 2FA" />
        </div>
        <Field label="Default 2FA method" htmlFor="s2fa">
          <Select id="s2fa" value={sec.twoFactorMethod} onChange={e => set({ twoFactorMethod: e.target.value })}>
            <option value="app">Authenticator app</option>
            <option value="sms">SMS code</option>
            <option value="email">Email code</option>
          </Select>
        </Field>
        <Note tone="warning">Changes to 2FA policy are logged and may require affected users to re-enroll.</Note>
      </SettingCard>

      <SettingCard title="Security Notifications" subtitle="Alerts on sensitive account events." icon={Bell}>
        <div className="space-y-2">
          {[
            { key: 'notifyOnNewLogin',        label: 'Notify on new device login' },
            { key: 'notifyOnPermissionChange',label: 'Notify on role / permission change' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
              <span className="font-body text-sm text-slate-700 dark:text-slate-200">{label}</span>
              <Toggle checked={sec[key]} onChange={v => set({ [key]: v })} label={label} />
            </div>
          ))}
        </div>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={() => setConfirmReset(true)} saving={saving} lastSaved={lastSaved} resetLabel="Reset to defaults" />
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset security settings?"
        message="This reverts password policy, lockout, session, and 2FA settings to recommended defaults. This is logged."
        danger
        confirmLabel="Reset security"
        onConfirm={handleReset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}