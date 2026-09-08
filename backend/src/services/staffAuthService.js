/**
 * staffAuthService.js
 * Handles registration for Veterinarian and Clinical Staff accounts.
 *
 * OTP verification is disabled for this flow — the Supabase Auth user,
 * profile row, and staff_profiles row are all created immediately on
 * submission, and the account is marked verified right away.
 */
const { supabaseAdmin } = require('../config/supabase');
const otpService = require('./otpService');

/**
 * Internal: actually create the Supabase Auth user + public.users row +
 * staff_profiles row. Called from either:
 *   - completeRegistration() after successful OTP verification, or
 *   - initiateRegistration() directly when SMS is disabled.
 */
async function provisionUser(source) {
  // source may be a "pending_registrations" row OR a freshly-submitted form.
  // Normalize to the columns we need.
  const email       = source.email;
  const fullName    = source.full_name    ?? source.fullName;
  const password    = source.password_plain ?? source.password;
  const role        = source.role;
  const phoneNumber = source.phone_number ?? source.phoneNumber;
  const licenseNo   = source.license_number ?? source.licenseNumber  ?? null;
  const specialty   = source.specialization ?? source.specialization ?? null;
  const position    = source.position       ?? null;

  // 1. Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone:         phoneNumber,
    phone_confirm: true,
  });
  if (authError) throw new Error('Failed to create account: ' + authError.message);

  const userId = authData.user.id;

  // 2. Profile row
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id:           userId,
    email,
    name:         fullName,
    role,
    phone_number: phoneNumber,
    is_verified:  true,
    is_active:    true,
  });
  if (userError) {
    await supabaseAdmin.auth.admin.deleteUser(userId); // rollback
    throw new Error('Failed to save user profile: ' + userError.message);
  }

  // 3. staff_profiles for vet/staff roles
  if (role === 'veterinarian' || role === 'staff') {
    const profileData = { user_id: userId };
    if (role === 'veterinarian') {
      profileData.license_number = licenseNo;
      profileData.specialization = specialty;
    }
    if (role === 'staff') {
      profileData.position = position;
    }
    await supabaseAdmin.from('staff_profiles').insert(profileData);
  }

  return { userId, email, role };
}

const staffAuthService = {

  async initiateRegistration(formData) {
    const { email, phoneNumber } = formData;

    // Check duplicate email in users table
    const { data: existingEmail } = await supabaseAdmin
      .from('users').select('id').eq('email', email).single();
    if (existingEmail) throw new Error('An account with this email already exists.');

    // Check duplicate phone
    const { data: existingPhone } = await supabaseAdmin
      .from('users').select('id').eq('phone_number', phoneNumber).single();
    if (existingPhone) throw new Error('This phone number is already registered.');

    // ── OTP verification is disabled for staff/veterinarian registration ──
    // The account is created immediately; no SMS/OTP step is required.
    const created = await provisionUser(formData);
    return {
      skippedOtp: true,
      message:    'Account created successfully. You can now log in.',
      email:      created.email,
      role:       created.role,
      phone:      phoneNumber,
      devOTP:     null,
      delivered:  false,
      provider:   'otp-disabled',
    };
  },

  async completeRegistration(phoneNumber, otp) {
    // Step 1: Verify OTP
    const result = await otpService.verifyOTP(phoneNumber, otp);
    if (!result.valid) throw new Error(result.reason);

    // Step 2: Fetch pending registration
    const { data: pending, error: fetchError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (fetchError || !pending) throw new Error('Registration session expired. Please register again.');
    if (new Date() > new Date(pending.expires_at)) {
      await supabaseAdmin.from('pending_registrations').delete().eq('phone_number', phoneNumber);
      throw new Error('Registration session expired. Please register again.');
    }

    // Step 3: Create Supabase Auth + profile rows (shared helper)
    const created = await provisionUser(pending);

    // Step 4: Clean up
    await supabaseAdmin.from('pending_registrations').delete().eq('phone_number', phoneNumber);

    return {
      message: 'Account created successfully. You can now log in.',
      email:   created.email,
      role:    created.role,
    };
  },
};

module.exports = staffAuthService;
