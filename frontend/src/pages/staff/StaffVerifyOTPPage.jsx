import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { staffAuthService } from '../../services/staffAuthService';
import OTPInput from '../../components/staff/OTPInput';
import { CheckCircle, AlertCircle, Loader2, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react';

const RESEND_COOLDOWN = 60;

function StaffVerifyOTPPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const phone = location.state?.phone;
  const initialDevOTP = location.state?.devOTP || null;

  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);
  const [cooldown, setCooldown]   = useState(RESEND_COOLDOWN);
  const [devOTP, setDevOTP]       = useState(initialDevOTP);

  useEffect(() => {
    if (!phone) navigate('/staff/register', { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    setLoading(true);
    setError('');
    try {
      await staffAuthService.verifyOTP(phone, otp);
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { message: 'Account created! You can now log in.' } }), 2500);
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError('');
    try {
      const result = await staffAuthService.resendOTP(phone);
      if (!result.success) {
        setCooldown(result.cooldownRemaining || RESEND_COOLDOWN);
        setError(`Please wait ${result.cooldownRemaining} seconds before resending.`);
      } else {
        setCooldown(RESEND_COOLDOWN);
        setOtp('');
        if (result?.data?.devOTP) setDevOTP(result.data.devOTP);
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone ? phone.slice(0, 5) + '***' + phone.slice(-4) : '';

  if (!phone) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="font-display text-slate-800 text-2xl font-700 mb-2">Account Verified!</h2>
          <p className="text-slate-500 font-body text-sm mb-1">Your staff account has been created successfully.</p>
          <p className="text-slate-400 text-xs font-body">Redirecting to login...</p>
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <img src="/PHVC_Logo.png" alt="PHVC"
            className="w-14 h-14 rounded-2xl object-cover border border-blue-100 shadow mx-auto mb-3" />
          <h1 className="font-display text-slate-800 text-2xl font-700">Phone Verification</h1>
          <p className="text-slate-400 font-body text-sm mt-1">
            We sent a 6-digit code to{' '}
            <span className="text-slate-600 font-600 font-mono">{maskedPhone}</span>
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8">

          {/* Security notice */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100 mb-6">
            <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-blue-700 text-xs font-body font-600">Secure Verification</p>
              <p className="text-blue-500 text-xs font-body">Code expires in 5 minutes · Max 5 attempts</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-500 font-body">{error}</p>
            </div>
          )}

          {/* DEV-MODE banner: shows OTP for testing when no SMS provider is configured */}
          {devOTP && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-body font-600 text-amber-700">DEV MODE — no SMS sent</p>
              <p className="text-amber-600 text-xs font-body mt-0.5">Use this OTP for testing:</p>
              <p className="font-mono text-2xl font-700 text-amber-700 tracking-widest mt-1.5">{devOTP}</p>
              <p className="text-amber-500 text-[10px] font-body mt-1">Set TWILIO env vars in backend .env to send real SMS.</p>
            </div>
          )}
          {/* OTP boxes */}
          <OTPInput value={otp} onChange={setOtp} disabled={loading} />

          {/* Verify button */}
          <button onClick={handleVerify} disabled={loading || otp.length !== 6}
            className="w-full mt-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              : 'Verify & Create Account'}
          </button>

          {/* Resend */}
          <div className="flex items-center justify-center mt-5 gap-2">
            <p className="text-slate-400 text-sm font-body">Didn't receive the code?</p>
            <button onClick={handleResend} disabled={cooldown > 0 || resending}
              className="flex items-center gap-1.5 text-sm font-body font-600 transition-colors disabled:text-slate-300 text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed">
              {resending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                : cooldown > 0
                  ? <><RefreshCw className="w-3.5 h-3.5" /> Resend in {cooldown}s</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> Resend OTP</>
              }
            </button>
          </div>
        </div>

        <div className="text-center mt-5">
          <Link to="/staff/register"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm font-body transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to registration
          </Link>
        </div>
      </div>
    </div>
  );
}

export default StaffVerifyOTPPage;
