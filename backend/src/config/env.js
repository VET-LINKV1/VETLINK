require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  },
  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  sms: {
    // When true, the OTP step for staff registration is bypassed
    // entirely — accounts are created immediately and marked verified.
    // Accepts "1", "true", or "yes" (case-insensitive).
    disabled: ['1', 'true', 'yes'].includes(String(process.env.SMS_DISABLED || '').trim().toLowerCase()),
  },
};

// Validate required variables
const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']; // SUPABASE_JWT_SECRET is now optional — we verify via Supabase API
required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = config;
