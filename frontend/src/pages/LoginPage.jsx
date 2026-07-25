import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import LoginTransition from '../components/ui/LoginTransition';

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPw, setShowPw]               = useState(false);
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      setTransitioning(true);
      await login(email, password);
    } catch (err) {
      setTransitioning(false);
      setError(err?.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  if (transitioning) return <LoginTransition />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center p-4">

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600 opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-400 opacity-10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500 opacity-5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* ── Logo + Clinic name ── */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shadow-blue-900/50">
              <img src="/PHVC_Logo.png" alt="PHVC" className="w-full h-full object-cover" />
            </div>
            <div>
            </div>
          </div>
        </div>

        {/* ── Login card ── */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">

          <div className="mb-6 text-center">
            <h2 className="font-display text-white text-xl font-700">Welcome back</h2>
            <p className="text-blue-200 text-sm font-body mt-1">Sign in to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/15 border border-red-400/30 mb-5">
              <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
              <p className="text-red-200 text-sm font-body">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-blue-100 text-sm font-body font-500 mb-2">
                Email address
              </label>
              <input
                id="email" type="email" autoComplete="email"
                value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@phvc.com" disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/15 disabled:opacity-50 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-blue-100 text-sm font-body font-500 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••" disabled={loading}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/15 disabled:opacity-50 transition-all"
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white font-display font-600 text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-blue-300/60 text-xs font-body">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Register links */}
          <div className="space-y-2.5">
            <Link to="/register"
              className="flex items-center justify-center w-full py-2.5 rounded-xl border border-white/20 text-blue-100 text-sm font-body font-500 hover:bg-white/10 transition-all">
              New pet owner? Create account
            </Link>
            <Link to="/staff/register"
              className="flex items-center justify-center w-full py-2.5 rounded-xl border border-white/10 text-blue-300 text-sm font-body hover:bg-white/5 transition-all">
              PHVC Staff registration
            </Link>
          </div>
        </div>

        <p className="text-center text-blue-400/40 text-xs font-body mt-5">
          © {new Date().getFullYear()} Pet Healthcare Veterinary Clinic
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
