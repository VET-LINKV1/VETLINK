const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const clientService = {
  async register({ name, email, password, contactNumber, address, pet }) {
    // Pre-flight duplicate check
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) throw new Error('An account with this email already exists.');

    // 1. Create Supabase Auth user (email pre-confirmed)
    const createPayload = { email, password, email_confirm: true };
    if (contactNumber) {
      createPayload.phone = contactNumber;
      createPayload.phone_confirm = true;
    }
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createPayload);
    if (authError) throw new Error(authError.message);

    const userId = authData.user?.id;
    if (!userId) throw new Error('Registration failed — no user ID returned.');

    logger.auth('client.register: auth user created', { userId, email });

    // 2. Insert profile — schema column is `phone_number`, NOT contact_number
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id:           userId,
        email,
        name,
        role:         'client',
        phone_number: contactNumber || null,
        address:      address || null,
        is_verified:  true,
        is_active:    true,
      });
    if (profileError) {
      // Rollback the auth user so it's not half-created
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error('Failed to create user profile: ' + profileError.message);
    }

    // 3. Insert pet if provided (non-fatal)
    let petRecord = null;
    if (pet?.name && pet?.species) {
      const { data: petData, error: petError } = await supabaseAdmin
        .from('pets')
        .insert({
          owner_id: userId,
          name:     pet.name,
          species:  pet.species,
          breed:    pet.breed || null,
          age:      pet.age ? parseInt(pet.age, 10) : null,
          gender:   pet.gender || 'unknown',
        })
        .select()
        .single();
      if (petError) logger.warn('client.register', 'Pet insert failed', { msg: petError.message });
      else petRecord = petData;
    }

    // 4. Sign in to get session
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) throw new Error('Account created but auto-login failed: ' + loginError.message);

    const profile = {
      id:            userId,
      email,
      name,
      role:          'client',
      phone_number:  contactNumber || null,
      address:       address || null,
      avatar_url:    null,
    };

    return {
      session: {
        accessToken:  loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        expiresAt:    loginData.session.expires_at,
      },
      user: profile,
      pet:  petRecord,
    };
  },

  async getDashboard(userId) {
    const [petsRes, appointmentsRes] = await Promise.all([
      supabaseAdmin.from('pets').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('appointments').select('*, pets(name, species)').eq('client_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);
    return {
      pets: petsRes.data || [],
      appointments: appointmentsRes.data || [],
      stats: {
        totalPets: petsRes.data?.length || 0,
        upcomingAppointments: (appointmentsRes.data || []).filter(a => a.status === 'pending' || a.status === 'confirmed').length,
        completedVisits: (appointmentsRes.data || []).filter(a => a.status === 'completed').length,
      },
    };
  },

  async getPets(userId) {
    const { data, error } = await supabaseAdmin.from('pets').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async addPet(userId, petData) {
    const { data, error } = await supabaseAdmin.from('pets').insert({
      owner_id: userId,
      name: petData.name,
      species: petData.species,
      breed: petData.breed || null,
      age: petData.age ? parseInt(petData.age, 10) : null,
      gender: petData.gender || 'unknown',
      weight_kg: petData.weight_kg || null,
      notes: petData.notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getAppointments(userId) {
    const { data, error } = await supabaseAdmin.from('appointments').select('*, pets(name, species, breed)').eq('client_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async updateSmsOptIn(userId, optIn) {
    const { data, error } = await supabaseAdmin
      .from('users').update({ sms_opt_in: !!optIn }).eq('id', userId).select('id, sms_opt_in').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async bookAppointment(userId, { petId, type, reason, appointmentAt }) {
    const { data, error } = await supabaseAdmin.from('appointments').insert({
      pet_id: petId, client_id: userId,
      type: type || 'General Checkup',
      reason: reason || null,
      appointment_at: appointmentAt || null,
      status: 'pending',
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
};

module.exports = clientService;
