/**
 * RegisterPage.jsx
 * Unified multi-role registration for ALL user types:
 * Admin, Veterinarian, Clinical Staff, Client
 *
 * STEPS:
 *   1. Account Info (name, email, password, phone)
 *   2. Role Selection
 *   3. Role-specific fields
 *   4. Success
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { clientService } from '../services/clientService';
import { staffAuthService } from '../services/staffAuthService';
import {
  User, Mail, Lock, Phone, MapPin, PawPrint,
  ShieldCheck, Stethoscope, Users, UserCircle,
  ChevronRight, ChevronLeft, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';

// ── Password strength ────────────────────────────────────────
function getStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-blue-600'];
const STRENGTH_TEXT   = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-blue-600'];

// ── Roles ────────────────────────────────────────────────────
const ROLES = [
  {
    value: 'client',
    label: 'Pet Owner',
    desc: 'Book appointments, manage your pets',
    icon: UserCircle,
    color: 'from-sky-500 to-sky-600',
    active: 'bg-sky-600 border-sky-600',
    light: 'bg-sky-50 border-sky-200 text-sky-700',
    requiresOTP: false,
  },
  {
    value: 'admin',
    label: 'Administrator',
    desc: 'Full system access and user management',
    icon: ShieldCheck,
    color: 'from-violet-500 to-violet-600',
    active: 'bg-violet-600 border-violet-600',
    light: 'bg-violet-50 border-violet-200 text-violet-700',
    requiresOTP: true,
  },
  {
    value: 'veterinarian',
    label: 'Vet Doctor',
    desc: 'Patient care, records & scheduling',
    icon: Stethoscope,
    color: 'from-blue-500 to-blue-600',
    active: 'bg-blue-600 border-blue-600',
    light: 'bg-blue-50 border-blue-200 text-blue-700',
    requiresOTP: true,
  },
  {
    value: 'staff',
    label: 'Clinical Staff',
    desc: 'Appointments & clinical assistance',
    icon: Users,
    color: 'from-teal-500 to-teal-600',
    active: 'bg-teal-600 border-teal-600',
    light: 'bg-teal-50 border-teal-200 text-teal-700',
    requiresOTP: true,
  },
];

const SPECIALIZATIONS = [
  'General Practice', 'Surgery', 'Dentistry', 'Dermatology',
  'Cardiology', 'Ophthalmology', 'Orthopedics', 'Oncology',
  'Emergency & Critical Care', 'Other',
];

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Reptile', 'Other'];

// ── Step labels ──────────────────────────────────────────────
const STEPS = ['Account Info', 'Select Role', 'Details'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore(s => s.setAuth);

  const [step, setStep]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showCPw, setShowCPw]       = useState(false);
  const [errors, setErrors]         = useState({});

  // Account info
  const [account, setAccount] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', phoneNumber: '',
  });

  // Role
  const [role, setRole] = useState('');

  // Role-specific fields
  const [details, setDetails] = useState({
    // Client
    address: '', petName: '', petSpecies: 'Dog', petBreed: '',
    petAge: '', petGender: 'unknown', skipPet: false,
    // Vet
    licenseNumber: '', specialization: '',
    // Staff
    position: '',
    // Admin
    organizationName: '',
  });

  const selectedRole = ROLES.find(r => r.value === role);
  const strength = getStrength(account.password);

  // ── Field helpers ───────────────────────────────────────
  const setAcc = (key, val) => {
    setAccount(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
    setServerError('');
  };
  const setDet = (key, val) => {
    setDetails(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
    setServerError('');
  };

  // ── Validation ──────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!account.fullName.trim()) e.fullName = 'Full name is required';
    if (!account.email.trim())    e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(account.email)) e.email = 'Enter a valid email';
    if (!account.password)        e.password = 'Password is required';
    else if (account.password.length < 8)  e.password = 'At least 8 characters';
    else if (!/[A-Z]/.test(account.password)) e.password = 'Must include an uppercase letter';
    else if (!/[0-9]/.test(account.password)) e.password = 'Must include a number';
    else if (!/[^A-Za-z0-9]/.test(account.password)) e.password = 'Must include a symbol (!@#$%^&* etc.)';
    if (account.password !== account.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!account.phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    if (!role) { setErrors({ role: 'Please select a role' }); return false; }
    return true;
  };

  const validateStep3 = () => {
    const e = {};
    if (role === 'veterinarian') {
      if (!details.licenseNumber.trim()) e.licenseNumber = 'License number is required';
      if (!details.specialization)       e.specialization = 'Specialization is required';
    }
    if (role === 'staff' && !details.position) e.position = 'Position is required';
    if (role === 'client' && !details.skipPet && !details.petName.trim()) e.petName = 'Pet name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ──────────────────────────────────────────
  const next = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) { handleSubmit(); return; }
    setStep(s => s + 1);
  };
  const back = () => { setErrors({}); setStep(s => s - 1); };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    setServerError('');
    try {
      if (role === 'client') {
        // Client registration — no OTP needed
        const result = await clientService.register({
          name:          account.fullName,
          email:         account.email,
          password:      account.password,
          contactNumber: account.phoneNumber,
          address:       details.address,
          pet: details.skipPet ? undefined : {
            name: details.petName, species: details.petSpecies,
            breed: details.petBreed, age: details.petAge, gender: details.petGender,
          },
        });
        setAuth(result);
        navigate('/client');
      } else {
        // Staff/Admin/Vet — requires OTP verification
        const regResult = await staffAuthService.register({
          fullName:       account.fullName,
          email:          account.email,
          password:       account.password,
          phoneNumber:    account.phoneNumber,
          role,
          licenseNumber:  details.licenseNumber  || undefined,
          specialization: details.specialization || undefined,
          position:       details.position       || undefined,
          organizationName: details.organizationName || undefined,
        });
        // staffAuthService.register returns { success, data: { phone, devOTP, delivered, provider } }
        const devOTP = regResult?.data?.devOTP || null;
        navigate('/staff/verify-otp', {
          state: { phone: account.phoneNumber, devOTP },
        });
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg">

        {/* ── Header ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/PHVC_Logo.png" alt="PHVC"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-100 shadow-md" />
            <div className="text-left">
              <p className="font-display text-slate-800 text-xl font-700 leading-tight">PHVC</p>
              <p className="text-slate-400 text-xs font-body">Pet Healthcare Veterinary Clinic</p>
            </div>
          </div>
          <h1 className="font-display text-slate-800 text-2xl font-700">Create Your Account</h1>
          <p className="text-slate-400 font-body text-sm mt-1">Join PHVC — your pet's care starts here</p>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center justify-center mb-6">
          {STEPS.map((label, i) => {
            const num = i + 1;
            const done = step > num;
            const active = step === num;
            return (
              <div key={num} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-body font-600 transition-all ${
                  active ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : done  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
                }`}>
                  {done
                    ? <CheckCircle className="w-3.5 h-3.5" />
                    : <span className="w-4 h-4 flex items-center justify-center font-700">{num}</span>
                  }
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 transition-all ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8">

          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-500 font-body">{serverError}</p>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* STEP 1 — Account Info                      */}
          {/* ═══════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-slate-800 text-xl font-700 mb-1">Account Information</h2>
              <p className="text-slate-400 text-sm font-body mb-5">Create your login credentials</p>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={account.fullName} onChange={e => setAcc('fullName', e.target.value)}
                    placeholder="Juan dela Cruz" className={`${inputClass('fullName')} pl-10`} />
                </div>
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={account.email} onChange={e => setAcc('email', e.target.value)}
                    placeholder="you@email.com" className={`${inputClass('email')} pl-10`} />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPw ? 'text' : 'password'} value={account.password}
                    onChange={e => setAcc('password', e.target.value)}
                    placeholder="Min 8 chars, uppercase, number"
                    className={`${inputClass('password')} pl-10 pr-11`} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {account.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-slate-100'}`} />
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
                  <input type={showCPw ? 'text' : 'password'} value={account.confirmPassword}
                    onChange={e => setAcc('confirmPassword', e.target.value)}
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
                  Phone Number * <span className="text-slate-400 text-xs font-normal">(international format)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={account.phoneNumber} onChange={e => setAcc('phoneNumber', e.target.value)}
                    placeholder="+639123456789" className={`${inputClass('phoneNumber')} pl-10`} />
                </div>
                {errors.phoneNumber && <p className="mt-1 text-xs text-red-500">{errors.phoneNumber}</p>}
              </div>

              <button onClick={next}
                className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* STEP 2 — Role Selection                    */}
          {/* ═══════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-slate-800 text-xl font-700 mb-1">Select Your Role</h2>
              <p className="text-slate-400 text-sm font-body mb-5">Choose how you'll use PHVC</p>

              <div className="space-y-3">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  const selected = role === r.value;
                  return (
                    <button key={r.value} type="button" onClick={() => { setRole(r.value); setErrors({}); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                        selected ? `${r.active} text-white shadow-lg` : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
                      }`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-white/20' : 'bg-slate-100'}`}>
                        <Icon className={`w-6 h-6 ${selected ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-display font-700 text-sm ${selected ? 'text-white' : 'text-slate-800'}`}>{r.label}</p>
                          {r.requiresOTP && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-body ${selected ? 'bg-white/20 text-white/80' : 'bg-amber-100 text-amber-600'}`}>
                              OTP required
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-body mt-0.5 ${selected ? 'text-white/70' : 'text-slate-400'}`}>{r.desc}</p>
                      </div>
                      {selected && <CheckCircle className="w-5 h-5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {errors.role && <p className="text-xs text-red-500 font-body">{errors.role}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={back}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-all">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={next}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* STEP 3 — Role-specific Details             */}
          {/* ═══════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Role badge */}
              {selectedRole && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-body font-600 mb-1 ${selectedRole.light}`}>
                  <selectedRole.icon className="w-3.5 h-3.5" />
                  {selectedRole.label}
                </div>
              )}
              <h2 className="font-display text-slate-800 text-xl font-700 mb-1">Additional Details</h2>
              <p className="text-slate-400 text-sm font-body mb-4">
                {role === 'client'       ? 'Tell us about your pet'
                : role === 'veterinarian' ? 'Your professional credentials'
                : role === 'staff'        ? 'Your position at PHVC'
                : 'Optional organization info'}
              </p>

              {/* ── CLIENT fields ── */}
              {role === 'client' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={details.address} onChange={e => setDet('address', e.target.value)}
                        placeholder="City, Province" className={`${inputClass('address')} pl-10`} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-slate-700 font-body">Add Your First Pet</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={details.skipPet}
                          onChange={e => setDet('skipPet', e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-600" />
                        <span className="text-xs text-slate-400 font-body">Skip for now</span>
                      </label>
                    </div>

                    {!details.skipPet ? (
                      <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1 font-body">Pet Name *</label>
                            <div className="relative">
                              <PawPrint className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input value={details.petName} onChange={e => setDet('petName', e.target.value)}
                                placeholder="Buddy" className={`${inputClass('petName')} pl-9 py-2`} />
                            </div>
                            {errors.petName && <p className="mt-1 text-xs text-red-500">{errors.petName}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1 font-body">Species</label>
                            <select value={details.petSpecies} onChange={e => setDet('petSpecies', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              {SPECIES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1 font-body">Breed</label>
                            <input value={details.petBreed} onChange={e => setDet('petBreed', e.target.value)}
                              placeholder="Golden Retriever" className={`${inputClass()} py-2`} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1 font-body">Age (years)</label>
                            <input type="number" min="0" max="50" value={details.petAge}
                              onChange={e => setDet('petAge', e.target.value)}
                              placeholder="3" className={`${inputClass()} py-2`} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1 font-body">Gender</label>
                          <div className="flex gap-2">
                            {['male','female','unknown'].map(g => (
                              <button key={g} type="button" onClick={() => setDet('petGender', g)}
                                className={`flex-1 py-2 rounded-xl text-xs font-body font-500 capitalize border transition-all ${
                                  details.petGender === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                }`}>{g}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-6 text-center bg-slate-50 rounded-xl border border-slate-100">
                        <PawPrint className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-slate-400 text-xs font-body">You can add pets from your dashboard later</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── VET fields ── */}
              {role === 'veterinarian' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">PRC License Number *</label>
                    <input value={details.licenseNumber} onChange={e => setDet('licenseNumber', e.target.value)}
                      placeholder="e.g. PRC-VET-12345" className={inputClass('licenseNumber')} />
                    {errors.licenseNumber && <p className="mt-1 text-xs text-red-500">{errors.licenseNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Specialization *</label>
                    <select value={details.specialization} onChange={e => setDet('specialization', e.target.value)}
                      className={inputClass('specialization')}>
                      <option value="">Select specialization...</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.specialization && <p className="mt-1 text-xs text-red-500">{errors.specialization}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-amber-700 text-xs font-body">
                      📱 An OTP will be sent to <span className="font-600">{account.phoneNumber}</span> to verify your account.
                    </p>
                  </div>
                </div>
              )}

              {/* ── STAFF fields ── */}
              {role === 'staff' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 font-body">Position *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'assistant',  label: 'Vet Assistant',  desc: 'Direct patient support' },
                        { value: 'technician', label: 'Vet Technician', desc: 'Medical procedures & lab' },
                      ].map(p => (
                        <button key={p.value} type="button" onClick={() => setDet('position', p.value)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            details.position === p.value
                              ? 'bg-teal-600 border-teal-600 text-white shadow-md'
                              : 'bg-white border-slate-200 hover:border-teal-300'
                          }`}>
                          <p className={`font-display font-700 text-sm ${details.position === p.value ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
                          <p className={`text-xs font-body mt-1 ${details.position === p.value ? 'text-white/70' : 'text-slate-400'}`}>{p.desc}</p>
                        </button>
                      ))}
                    </div>
                    {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-amber-700 text-xs font-body">
                      📱 An OTP will be sent to <span className="font-600">{account.phoneNumber}</span> to verify your account.
                    </p>
                  </div>
                </div>
              )}

              {/* ── ADMIN fields ── */}
              {role === 'admin' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Organization Name (optional)</label>
                    <input value={details.organizationName} onChange={e => setDet('organizationName', e.target.value)}
                      placeholder="Pet Healthcare Veterinary Clinic" className={inputClass()} />
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-amber-700 text-xs font-body">
                      📱 An OTP will be sent to <span className="font-600">{account.phoneNumber}</span> to verify your account.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={back}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-all">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={next} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {role === 'client' ? 'Creating...' : 'Sending OTP...'}</>
                    : role === 'client' ? 'Create Account' : 'Register & Verify'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer links */}
        <p className="text-center text-slate-500 text-sm font-body mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-600 hover:text-blue-700 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
