/**
 * ProfilePage.jsx
 * Full profile management for all roles.
 * - View mode: shows all profile info in clean card layout
 * - Edit mode: inline editing with validation
 * - Avatar upload with Supabase Storage
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { profileService } from '../services/profileService';
import { clientService } from '../services/clientService';
import AvatarUpload from '../components/profile/AvatarUpload';
import ProfileField from '../components/profile/ProfileField';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';
import {
  Edit2, Save, X, CheckCircle, AlertCircle,
  Loader2, Shield, Stethoscope, Users, UserCircle,
  Mail, Phone, MapPin, Calendar, BadgeCheck, MessageSquare,
} from 'lucide-react';

// Role display config
const ROLE_CONFIG = {
  admin:        { label: 'Administrator',   icon: Shield,      color: 'bg-violet-100 text-violet-700 border-violet-200' },
  veterinarian: { label: 'Veterinarian',    icon: Stethoscope, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  staff:        { label: 'Clinical Staff',  icon: Users,       color: 'bg-teal-100 text-teal-700 border-teal-200' },
  client:       { label: 'Pet Owner',       icon: UserCircle,  color: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const SPECIALIZATIONS = [
  'General Practice', 'Surgery', 'Dentistry', 'Dermatology',
  'Cardiology', 'Ophthalmology', 'Orthopedics', 'Oncology',
  'Emergency & Critical Care', 'Other',
];

export default function ProfilePage() {
  const { user: storeUser, setUser } = useAuthStore();

  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError]         = useState('');
  const [errors, setErrors]       = useState({});
  const [smsOptIn, setSmsOptIn]   = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Edit state mirrors profile
  const [form, setForm] = useState({});

  // ── Load profile ───────────────────────────────────────
  useEffect(() => {
    profileService.getProfile()
      .then(data => {
        setProfile(data);
        setSmsOptIn(data.sms_opt_in !== false);
        setForm({
          name:           data.name           || '',
          phoneNumber:    data.phone_number    || '',
          address:        data.address         || '',
          licenseNumber:  data.staff_profile?.license_number  || '',
          specialization: data.staff_profile?.specialization  || '',
          position:       data.staff_profile?.position        || '',
        });
      })
      .catch(err => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Avatar upload ──────────────────────────────────────
  const handleAvatarUpload = async (file) => {
    const result = await profileService.uploadAvatar(file);
    setProfile(prev => ({ ...prev, avatar_url: result.avatarUrl }));
    setUser({ ...storeUser, avatar_url: result.avatarUrl });
  };

  // ── Validation ─────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.phoneNumber && !/^\+[1-9]\d{7,14}$/.test(form.phoneNumber)) {
      e.phoneNumber = 'Use international format: +639123456789';
    }
    if (profile?.role === 'veterinarian') {
      if (!form.licenseNumber.trim()) e.licenseNumber = 'License number is required';
      if (!form.specialization)       e.specialization = 'Specialization is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const updated = await profileService.updateProfile({
        name:           form.name,
        phoneNumber:    form.phoneNumber,
        address:        form.address,
        licenseNumber:  form.licenseNumber,
        specialization: form.specialization,
        position:       form.position,
      });
      setProfile(updated);
      setUser({ ...storeUser, name: form.name });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setErrors({});
    setError('');
    // Reset form to current profile
    setForm({
      name:           profile.name           || '',
      phoneNumber:    profile.phone_number    || '',
      address:        profile.address         || '',
      licenseNumber:  profile.staff_profile?.license_number  || '',
      specialization: profile.staff_profile?.specialization  || '',
      position:       profile.staff_profile?.position        || '',
    });
  };

  const handleSmsToggle = async () => {
    setSmsLoading(true);
    try {
      await clientService.updateSmsOptIn(!smsOptIn);
      setSmsOptIn(!smsOptIn);
    } catch (e) {
      setError('Failed to update SMS preference.');
    } finally {
      setSmsLoading(false);
    }
  };

  const setF = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  // ── Loading ────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );

  const role   = profile?.role;
  const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.client;
  const RoleIcon = roleCfg.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">

      {/* ── Page header ── */}
      <div>
        <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">My Profile</h1>
        <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">Manage your account information</p>
      </div>

      {/* ── Success banner ── */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-blue-700 font-body text-sm font-500">Profile updated successfully!</p>
        </div>
      )}

      {passwordChanged && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-green-700 font-body text-sm font-500">Password changed successfully!</p>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-600 font-body text-sm">{error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* PROFILE CARD                                       */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-card overflow-hidden">

        {/* ── Banner + Avatar ── */}
        <div className="relative h-28 bg-gradient-to-r from-blue-700 to-blue-500">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar positioned over banner */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <AvatarUpload
              currentUrl={profile?.avatar_url}
              name={profile?.name}
              onUpload={handleAvatarUpload}
              disabled={false}
            />

            {/* Edit / Save / Cancel buttons */}
            <div className="flex gap-2 mt-12">
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/25 transition-all">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <>
                  <button onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 dark:text-slate-600 text-sm font-body font-500 hover:bg-slate-50 dark:bg-slate-800/50 transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/25 disabled:opacity-60 transition-all">
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name + role badge */}
          {!editing ? (
            <div className="mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-slate-800 dark:text-white text-2xl font-700">{profile?.name}</h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${roleCfg.color}`}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleCfg.label}
                </span>
                {profile?.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-body font-600 px-2 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-1">{profile?.email}</p>
            </div>
          ) : (
            <div className="mb-6">
              <ProfileField
                label="Full Name *"
                editing={true}
                editValue={form.name}
                onChange={val => setF('name', val)}
                placeholder="Your full name"
                error={errors.name}
              />
            </div>
          )}

          {/* ── Info grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">

            {/* Left column — Contact info */}
            <div>
              <p className="text-xs font-body font-700 text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Contact Information
              </p>

              {/* Email — always read-only */}
              <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-body text-slate-400 dark:text-slate-500 mb-0.5">Email</p>
                  <p className="text-slate-700 dark:text-slate-200 font-body text-sm font-500">{profile?.email}</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 font-body">Cannot be changed</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  {!editing ? (
                    <>
                      <p className="text-xs font-body text-slate-400 dark:text-slate-500 mb-0.5">Phone Number</p>
                      <p className="text-slate-700 dark:text-slate-200 font-body text-sm font-500">
                        {profile?.phone_number || <span className="text-slate-300 dark:text-slate-600 italic">Not set</span>}
                      </p>
                    </>
                  ) : (
                    <ProfileField
                      label="Phone Number"
                      editing={true}
                      editValue={form.phoneNumber}
                      onChange={val => setF('phoneNumber', val)}
                      placeholder="+639123456789"
                      error={errors.phoneNumber}
                    />
                  )}
                </div>
              </div>

              {/* Address — clients only */}
              {(role === 'client' || profile?.address) && (
                <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    {!editing ? (
                      <>
                        <p className="text-xs font-body text-slate-400 dark:text-slate-500 mb-0.5">Address</p>
                        <p className="text-slate-700 dark:text-slate-200 font-body text-sm font-500">
                          {profile?.address || <span className="text-slate-300 dark:text-slate-600 italic">Not set</span>}
                        </p>
                      </>
                    ) : (
                      <ProfileField
                        label="Address"
                        editing={true}
                        editValue={form.address}
                        onChange={val => setF('address', val)}
                        placeholder="City, Province"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Joined date */}
              <div className="flex items-start gap-3 py-3">
                <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-body text-slate-400 dark:text-slate-500 mb-0.5">Member Since</p>
                  <p className="text-slate-700 dark:text-slate-200 font-body text-sm font-500">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right column — Role-specific info */}
            <div>
              <p className="text-xs font-body font-700 text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                {role === 'veterinarian' ? 'Professional Details'
                : role === 'staff'       ? 'Staff Details'
                : role === 'admin'       ? 'Admin Details'
                : 'Account Details'}
              </p>

              {/* Veterinarian fields */}
              {role === 'veterinarian' && (
                <div className="space-y-1">
                  {!editing ? (
                    <>
                      <ProfileField label="License Number" value={profile?.staff_profile?.license_number} editing={false} />
                      <ProfileField label="Specialization"  value={profile?.staff_profile?.specialization}  editing={false} />
                    </>
                  ) : (
                    <div className="space-y-4">
                      <ProfileField
                        label="License Number *"
                        editing={true}
                        editValue={form.licenseNumber}
                        onChange={val => setF('licenseNumber', val)}
                        placeholder="PRC-VET-12345"
                        error={errors.licenseNumber}
                      />
                      <ProfileField
                        label="Specialization *"
                        editing={true}
                        editValue={form.specialization}
                        onChange={val => setF('specialization', val)}
                        options={SPECIALIZATIONS.map(s => ({ value: s, label: s }))}
                        error={errors.specialization}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Staff fields */}
              {role === 'staff' && (
                <div>
                  {!editing ? (
                    <ProfileField
                      label="Position"
                      value={profile?.staff_profile?.position
                        ? profile.staff_profile.position.charAt(0).toUpperCase() + profile.staff_profile.position.slice(1)
                        : null}
                      editing={false}
                    />
                  ) : (
                    <ProfileField
                      label="Position"
                      editing={true}
                      editValue={form.position}
                      onChange={val => setF('position', val)}
                      options={[
                        { value: 'assistant',  label: 'Veterinary Assistant' },
                        { value: 'technician', label: 'Veterinary Technician' },
                      ]}
                    />
                  )}
                </div>
              )}

              {/* Admin / Client — no extra required fields */}
              {(role === 'admin' || role === 'client') && (
                <div className="py-3">
                  <p className="text-xs font-body text-slate-400 dark:text-slate-500 mb-0.5">Role</p>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${roleCfg.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {roleCfg.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Security card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-card p-6">
        <h3 className="font-display text-slate-800 dark:text-white font-600 mb-4">Account Security</h3>
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500">Password</p>
            <p className="font-body text-slate-400 dark:text-slate-500 text-xs">Keep your account secure with a strong password</p>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 dark:text-slate-600 text-sm font-body font-500 hover:bg-slate-50 dark:bg-slate-800/50 transition-all">
            Change Password
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500">Phone Verification</p>
            <p className="font-body text-slate-400 dark:text-slate-500 text-xs">
              {profile?.is_verified ? 'Verified via SMS OTP' : 'Not yet verified'}
            </p>
          </div>
          <span className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${
            profile?.is_verified
              ? 'bg-green-50 text-green-600 border-green-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {profile?.is_verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      </div>

      {/* ── Notification Preferences (clients only) ── */}
      {role === 'client' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-card p-6">
          <h3 className="font-display text-slate-800 dark:text-white font-600 mb-4">Notification Preferences</h3>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500">SMS Notifications</p>
                <p className="font-body text-slate-400 dark:text-slate-500 text-xs">
                  Receive appointment reminders, booking confirmations, and messages via SMS
                </p>
              </div>
            </div>
            <button
              onClick={handleSmsToggle}
              disabled={smsLoading}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                smsOptIn ? 'bg-blue-600' : 'bg-slate-300'
              } ${smsLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                smsOptIn ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* ── Change Password modal ── */}
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onChanged={() => {
            setPasswordChanged(true);
            setTimeout(() => setPasswordChanged(false), 3000);
          }}
        />
      )}
    </div>
  );
}
