const { supabaseAdmin } = require('../config/supabase');

const petService = {
  /**
   * Clients see only their own pets.
   * Vets/staff/admin see all (read-only).
   */
  async getAll(userId, role) {
    let query = supabaseAdmin
      .from('pets')
      .select('*, owner:users!pets_owner_id_fkey(id, name, email, phone_number)')
      .order('created_at', { ascending: false });
    if (role === 'client' || !role) query = query.eq('owner_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  async create(userId, petData) {
    const { data, error } = await supabaseAdmin.from('pets').insert({
      owner_id:  userId,
      name:      petData.name,
      species:   petData.species,
      breed:     petData.breed || null,
      age:       petData.age ? parseInt(petData.age, 10) : null,
      gender:    petData.gender || 'unknown',
      weight_kg: petData.weight_kg ? parseFloat(petData.weight_kg) : null,
      notes:     petData.notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(userId, petId, petData) {
    // Verify ownership first
    const { data: existing } = await supabaseAdmin
      .from('pets').select('id').eq('id', petId).eq('owner_id', userId).single();
    if (!existing) throw new Error('Pet not found or access denied');

    const updatePatch = {};
    if (petData.name      !== undefined) updatePatch.name      = petData.name;
    if (petData.species   !== undefined) updatePatch.species   = petData.species;
    if (petData.breed     !== undefined) updatePatch.breed     = petData.breed || null;
    if (petData.age       !== undefined) updatePatch.age       = petData.age ? parseInt(petData.age, 10) : null;
    if (petData.gender    !== undefined) updatePatch.gender    = petData.gender;
    if (petData.weight_kg !== undefined) updatePatch.weight_kg = petData.weight_kg ? parseFloat(petData.weight_kg) : null;
    if (petData.notes     !== undefined) updatePatch.notes     = petData.notes || null;

    const { data, error } = await supabaseAdmin.from('pets').update(updatePatch).eq('id', petId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
};

module.exports = petService;
