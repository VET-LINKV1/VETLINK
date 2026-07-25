import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { staffAuthService } from '../../services/staffAuthService';
import {
  Eye, EyeOff, User, Mail, Lock, Phone,
  ShieldCheck, Stethoscope, Users, AlertCircle, Loader2,
  ChevronRight, CheckCircle,
} from 'lucide-react';

// ── Password strength ──────────────────────────────────────────
function getStrength(pw) {
  let s = 0;
  if (pw.length >= 8)             s++;
  if (/[A-Z]/.test(pw))           s++;
  if (/[0-9]/.test(pw))           s++;
  if (/[^A-Za-z0-9]/.test(pw))    s++;
  return s;
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-blue-600'];
const STRENGTH_TEXT   = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-blue-600'];

// ── Role config ────────────────────────────────────────────────
const ROLES = [
  {
    value: 'admin',
    label: 'Administrator',
    short: 'Admin',
    icon: ShieldCheck,
    desc: 'Full system access and user management',
    color: 'from-violet-500 to-violet-600',
    light: 'bg-violet-50 border-violet-200 text-violet-700',
    active: 'bg-violet-600 border-violet-600',
  },
  {
    value: 'veterinarian',
    label: 'Vet Doctor',
    short: 'Vet',
    icon: Stethoscope,
    desc: 'Patient care, records, and scheduling',
    color: 'from-blue-500 to-blue-600',
    light: 'bg-blue-50 border-blue-200 text-blue-700',
    active: 'bg-blue-600 border-blue-600',
  },
  {
    value: 'staff',
    label: 'Clinical Staff',
    short: 'Staff',
    icon: Users,
    desc: 'Appointments and clinical assistance',
    color: 'from-sky-500 to-sky-600',
    light: 'bg-sky-50 border-sky-200 text-sky-700',
    active: 'bg-sky-600 border-sky-600',
  },
];

const SPECIALIZATIONS = [
  'General Practice', 'Surgery', 'Dentistry', 'Dermatology',
  'Cardiology', 'Ophthalmology', 'Orthopedics', 'Oncology',
  'Emergency & Critical Care', 'Other',
];

// ── Steps ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Select Role' },
  { id: 2, label: 'Account Info' },
  { id: 3, label: 'Role Details' },
];

// ── Main Component ─────────────────────────────────────────────
function StaffRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    role: '',
    fullName: '', email: '', password: '', confirmPassword: '', phoneNumber: '',
    licenseNumber: '', specialization: '', position: '',
  });
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCPw, setShowCPw]     = useState(false);

  const strength = getStrength(form.password);
  const selectedRole = ROLES.find(r => r.value === form.role);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
    setServerError('');
  };

  // ── Validation ─────────────────────────────────────────────
  const validateStep1 = () => {
    if (!form.role) { setErrors({ role: 'Please select a role' }); return false; }
    return true;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.fullName.trim())    e.fullName = 'Full name is required';
    if (!form.email.trim())       e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password)           e.password = 'Password is required';
    else if (form.password.length < 8)          e.password = 'At least 8 characters';
    else if (!/[A-Z]/.test(form.password))      e.password = 'Must include an uppercase letter';
    else if (!/[0-9]/.test(form.password))      e.password = 'Must include a number';
    else if (!/[^A-Za-z0-9]/.test(form.password)) e.password = 'Must include a symbol (e.g. @, !, #)';
    if (form.password !== form.confirmPassword)  e.confirmPassword = 'Passwords do not match';
    if (!form.phoneNumber.trim())  e.phoneNumber = 'Phone number is required';
    else if (!/^\+[1-9]\d{7,14}$/.test(form.phoneNumber)) e.phoneNumber = 'Use international format: +639123456789';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    if (form.role === 'veterinarian') {
      if (!form.licenseNumber.trim()) e.licenseNumber = 'License number is required';
      if (!form.specialization)       e.specialization = 'Specialization is required';
    }
    if (form.role === 'staff' && !form.position) e.position = 'Position is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    // Admin skips step 3
    if (step === 2 && form.role === 'admin') {
      handleSubmit();
      return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => { setErrors({}); setStep(s => s - 1); };

  const handleSubmit = async () => {
    if (form.role !== 'admin' && !validateStep3()) return;
    setLoading(true);
    setServerError('');
    try {
      const _regRes = await staffAuthService.register({
        fullName:       form.fullName,
        email:          form.email,
        password:       form.password,
        phoneNumber:    form.phoneNumber,
        role:           form.role,
        licenseNumber:  form.licenseNumber  || undefined,
        specialization: form.specialization || undefined,
        position:       form.position       || undefined,
      });
      // SMS disabled on the backend → account is already created; skip OTP.
      if (_regRes?.data?.skippedOtp) {
        navigate('/login', {
          state: {
            justRegistered: true,
            email: _regRes?.data?.email || form.email,
            message: 'Account created — please sign in.',
          },
        });
        return;
      }
      navigate('/staff/verify-otp', { state: { phone: form.phoneNumber, devOTP: _regRes?.data?.devOTP || null } });
    } catch (err) {
      setServerError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (key) => `
    w-full px-4 py-3 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${errors[key] ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 bg-white focus:ring-blue-500'}
  `;

  // ── Step indicator ──────────────────────────────────────────
  const stepsToShow = form.role === 'admin' ? STEPS.slice(0, 2) : STEPS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/PHVC_Logo.png" alt="PHVC"
              className="w-12 h-12 rounded-xl object-cover border border-blue-100 shadow-md" />
            <div className="text-left">
              <p className="font-display text-slate-800 text-xl font-700 leading-tight">PHVC</p>
              <p className="text-slate-400 text-xs font-body">Pet Healthcare Veterinary Clinic</p>
            </div>
          </div>
          <h1 className="font-display text-slate-800 text-2xl font-700">Staff Registration</h1>
          <p className="text-slate-400 font-body text-sm mt-1">Create your internal staff account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-6">
          {stepsToShow.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-body font-600 transition-all ${
                step === s.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : step > s.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {step > s.id
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <span className="w-4 h-4 flex items-center justify-center">{s.id}</span>
                }
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < stepsToShow.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 transition-all ${step > s.id ? 'bg-blue-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8">

          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-500 font-body">{serverError}</p>
            </div>
          )}

          {/* ── STEP 1: Role Selection ── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-slate-800 text-xl font-700">Select Your Role</h2>
              <div className="space-y-3">
                {ROLES.map(role => {
                  const Icon = role.icon;
                  const isSelected = form.role === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => set('role', role.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                        isSelected
                          ? `${role.active} text-white shadow-lg`
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20' : 'bg-slate-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-display font-700 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                          {role.label}
                        </p>
                        <p className={`text-xs font-body mt-0.5 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                          {role.desc}
                        </p>
                      </div>
                      {isSelected && <CheckCircle className="w-5 h-5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {errors.role && <p className="text-xs text-red-500 font-body">{errors.role}</p>}

              <button onClick={nextStep}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 2: Account Info ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Role badge */}
              {selectedRole && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-body font-600 mb-1 ${selectedRole.light}`}>
                  <selectedRole.icon className="w-3.5 h-3.5" />
                  {selectedRole.label}
                </div>
              )}
              <h2 className="font-display text-slate-800 text-xl font-700">Account Information</h2>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={form.fullName} onChange={e => set('fullName', e.target.value)}
                    placeholder="Dr. Juan dela Cruz" className={`${inputClass('fullName')} pl-10`} />
                </div>
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@phvc.com" className={`${inputClass('email')} pl-10`} />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min 8 chars, uppercase, number, symbol"
                    className={`${inputClass('password')} pl-10 pr-11`} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-slate-100'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-body ${STRENGTH_TEXT[strength]}`}>{STRENGTH_LABELS[strength]}</p>
                  </div>
                )}
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Confirm Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showCPw ? 'text' : 'password'} value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    placeholder="Re-enter password" className={`${inputClass('confirmPassword')} pl-10 pr-11`} />
                  <button type="button" onClick={() => setShowCPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
                  Phone Number * <span className="text-slate-400 text-xs font-normal">— for OTP verification</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)}
                    placeholder="+639123456789" className={`${inputClass('phoneNumber')} pl-10`} />
                </div>
                {errors.phoneNumber && <p className="mt-1 text-xs text-red-500">{errors.phoneNumber}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={prevStep}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 transition-all">
                  Back
                </button>
                <button onClick={nextStep} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
                  {form.role === 'admin'
                    ? loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : 'Register & Send OTP'
                    : <>Continue <ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Role-specific fields ── */}
          {step === 3 && (
            <div className="space-y-5">
              {selectedRole && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-body font-600 mb-1 ${selectedRole.light}`}>
                  <selectedRole.icon className="w-3.5 h-3.5" />
                  {selectedRole.label} Details
                </div>
              )}
              <h2 className="font-display text-slate-800 text-xl font-700">
                {form.role === 'veterinarian' ? 'Veterinarian Details' : 'Staff Details'}
              </h2>

              {/* Veterinarian fields */}
              {form.role === 'veterinarian' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">PRC License Number *</label>
                    <input value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)}
                      placeholder="e.g. PRC-VET-12345" className={inputClass('licenseNumber')} />
                    {errors.licenseNumber && <p className="mt-1 text-xs text-red-500">{errors.licenseNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Specialization *</label>
                    <select value={form.specialization} onChange={e => set('specialization', e.target.value)}
                      className={inputClass('specialization')}>
                      <option value="">Select specialization...</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.specialization && <p className="mt-1 text-xs text-red-500">{errors.specialization}</p>}
                  </div>
                </div>
              )}

              {/* Staff fields */}
              {form.role === 'staff' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 font-body">Position *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'assistant',  label: 'Veterinary Assistant',  desc: 'Direct patient care support' },
                      { value: 'technician', label: 'Vet Technician',         desc: 'Medical procedures & lab' },
                    ].map(p => (
                      <button key={p.value} type="button" onClick={() => set('position', p.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          form.position === p.value
                            ? 'bg-sky-600 border-sky-600 text-white shadow-md'
                            : 'bg-white border-slate-200 hover:border-sky-300'
                        }`}>
                        <p className={`font-display font-700 text-sm ${form.position === p.value ? 'text-white' : 'text-slate-800'}`}>
                          {p.label}
                        </p>
                        <p className={`text-xs font-body mt-1 ${form.position === p.value ? 'text-white/70' : 'text-slate-400'}`}>
                          {p.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position}</p>}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={prevStep}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 transition-all">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                    : 'Register & Send OTP'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-sm font-body mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-600 hover:text-blue-700 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default StaffRegisterPage;
