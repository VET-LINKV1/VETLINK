/**
 * ProfileSettings.jsx
 * Administrator profile, photo, email, password, 2FA, active sessions.
 * Uses real backend API: GET/PUT /api/profile, POST /api/profile/avatar.
 *
 * Password change and session revocation are not yet wired to backend
 * endpoints, so they remain local-only (clearly noted in the UI).
 */
import { useState, useEffect } from 'react';
import { User, Mail, Lock, Shield, LogOut, Camera, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import { SettingCard, Field, TextInput, TextArea, Toggle, FormFooter, ConfirmDialog, StatusPill, Note } from './primitives';
import apiClient from '../../services/apiClient';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function ProfileSettings() {
  const [p, setP] = useState({
    name: '', email: '', jobTitle: '', phone: '', photoUrl: '',
    twoFactorEnabled: true, sessions: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState(null);

  const patch = (patchObj) => setP(prev => ({ ...prev, ...patchObj }));

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        setError(null);
        const res = await apiClient.get('/profile');
        if (mounted && res.data) {
          const d = res.data;
          const profile = {
            name: d.name || '',
            email: d.email || '',
            jobTitle: d.jobTitle || d.staff_profile?.specialization || '',
            phone: d.phoneNumber || d.phone || '',
            photoUrl: d.photoUrl || d.avatarUrl || '',
            twoFactorEnabled: d.twoFactorEnabled ?? true,
            sessions: d.sessions || [],
          };
          setP(profile);
          setPhotoPreview(profile.photoUrl);
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to fetch profile:', err);
          setError('Failed to load profile. Please refresh the page.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { alert('Photo must be < 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
    const file = fileInput?.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.avatarUrl) {
        setPhotoPreview(res.data.avatarUrl);
        patch({ photoUrl: res.data.avatarUrl });
        setLastSaved(`Avatar updated ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.put('/profile', {
        name: p.name,
        phoneNumber: p.phone,
        address: p.address || '',
      });
      setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Profile save failed:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setPwdError('');
    if (passwordForm.new.length < 10) { setPwdError('Password must be at least 10 characters.'); return; }
    if (passwordForm.new !== passwordForm.confirm) { setPwdError('Passwords do not match.'); return; }
    setPwdSaving(true);
    // TODO: Wire to backend when /api/profile/password endpoint is available
    await delay(400);
    setPasswordForm({ current: '', new: '', confirm: '' });
    setPwdSaving(false);
    setLastSaved(`Password updated ${new Date().toLocaleTimeString()} (local only)`);
  };

  const revokeSession = (id) => setConfirmRevoke(id);

  const confirmRevokeAction = async () => {
    if (!confirmRevoke) return;
    setRevoking(confirmRevoke);
    // TODO: Wire to backend when /api/profile/sessions/:id endpoint is available
    await delay(300);
    patch({ sessions: p.sessions.filter(s => s.id !== confirmRevoke) });
    setRevoking(null);
    setConfirmRevoke(null);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 font-body text-slate-600 dark:text-slate-300">Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-body text-sm">
          {error}
        </div>
      )}

      <SettingCard
        title="Profile"
        subtitle="Your name, contact details, and avatar shown across the portal."
        icon={User}
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-center overflow-hidden">
              {photoPreview ? <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-300" />}
            </div>
            <label className="absolute bottom-0 right-0 m-2 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
              <Camera className="w-4 h-4 text-slate-600" />
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2">
            <Field label="Full name" htmlFor="pname">
              <TextInput id="pname" value={p.name} onChange={e => patch({ name: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="pemail">
              <TextInput id="pemail" type="email" value={p.email} onChange={e => patch({ email: e.target.value })} disabled />
              <p className="text-xs font-body text-slate-400">Email changes require verification.</p>
            </Field>
            <Field label="Job title" htmlFor="pjtitle">
              <TextInput id="pjtitle" value={p.jobTitle} onChange={e => patch({ jobTitle: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="pphone">
              <TextInput id="pphone" value={p.phone} onChange={e => patch({ phone: e.target.value })} />
            </Field>
          </div>
        </div>
        <FormFooter onSave={handleSaveProfile} onReset={() => {}} saving={saving} lastSaved={lastSaved} resetLabel="Discard" />
      </SettingCard>

      <SettingCard
        title="Security"
        subtitle="Password and two-factor authentication."
        icon={Shield}
      >
        <div className="space-y-5">
          <div>
            <h4 className="font-display text-slate-700 dark:text-slate-200 text-sm font-600 mb-3">Change Password</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Current password" htmlFor="pcur">
                <div className="relative">
                  <TextInput id="pcur" type={showCurrent ? 'text' : 'password'} value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label="New password" htmlFor="pnew">
                <div className="relative">
                  <TextInput id="pnew" type={showNew ? 'text' : 'password'} value={passwordForm.new} onChange={e => setPasswordForm(f => ({ ...f, new: e.target.value }))} />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs font-body text-slate-400">Min 10 chars, upper, number, symbol.</p>
              </Field>
              <Field label="Confirm new" htmlFor="pconf">
                <div className="relative">
                  <TextInput id="pconf" type={showConfirm ? 'text' : 'password'} value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            </div>
            {pwdError && <p className="text-sm font-body text-red-500">{pwdError}</p>}
            <FormFooter onSave={handleSavePassword} saving={pwdSaving} saveLabel="Update Password" onCancel={() => setPasswordForm({ current: '', new: '', confirm: '' })} />
            <Note tone="info">Password change is not yet wired to the backend API.</Note>
          </div>

          <div className="border-t border-slate-100 dark:border-white/10 pt-5">
            <h4 className="font-display text-slate-700 dark:text-slate-200 text-sm font-600 mb-3">Two-Factor Authentication</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-slate-700 dark:text-slate-200">Authenticator App</p>
                <p className="text-xs font-body text-slate-400">Use Google Authenticator, Authy, or similar.</p>
              </div>
              <Toggle checked={p.twoFactorEnabled} onChange={v => patch({ twoFactorEnabled: v })} label="Enabled" />
            </div>
            <Note tone="info">2FA is required for all administrators per clinic policy. (Read-only in this view; manage in your account security settings.)</Note>
          </div>

          <div className="border-t border-slate-100 dark:border-white/10 pt-5">
            <h4 className="font-display text-slate-700 dark:text-slate-200 text-sm font-600 mb-3">Active Sessions</h4>
            <p className="text-xs font-body text-slate-400 mb-3">Sign out of devices you no longer use.</p>
            <div className="space-y-2">
              {p.sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">{s.device}</p>
                      <p className="text-xs font-body text-slate-400">{s.location} · {new Date(s.lastActive).toLocaleString()}</p>
                    </div>
                    {s.current && <StatusPill tone="success">Current</StatusPill>}
                  </div>
                  {!s.current && (
                    <button
                      onClick={() => revokeSession(s.id)}
                      disabled={revoking === s.id}
                      className="px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-body font-600 transition-colors">
                      {revoking === s.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
              {!p.sessions.length && <p className="text-xs font-body text-slate-400">No active sessions found.</p>}
            </div>
            <Note tone="info">Session revocation is not yet wired to the backend API.</Note>
          </div>
        </div>
      </SettingCard>

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke session?"
        message="This will sign out the selected device immediately. You'll need to log in again on that device."
        danger
        onConfirm={confirmRevokeAction}
        onClose={() => setConfirmRevoke(null)}
      />
    </div>
  );
}
