/**
 * PHVC Database Seeder
 * Creates Admin, Veterinarian, and Staff demo accounts
 * Run: node database/seed.js (from backend/ folder)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../backend/.env') });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SEED_STAFF = [
  {
    email: 'admin@phvc.com',
    password: 'Admin@1234',
    name: 'Admin User',
    role: 'admin',
    phone: '+639100000001',
    profile: null,
  },
  {
    email: 'vet@phvc.com',
    password: 'Vet@12345',
    name: 'Dr. Jane Smith',
    role: 'veterinarian',
    phone: '+639100000002',
    profile: { license_number: 'PRC-VET-12345', specialization: 'General Practice' },
  },
  {
    email: 'staff@phvc.com',
    password: 'Staff@1234',
    name: 'Staff Member',
    role: 'staff',
    phone: '+639100000003',
    profile: { position: 'assistant' },
  },
];

async function seed() {
  console.log('\n🌱 PHVC Database Seeder\n');

  for (const user of SEED_STAFF) {
    try {
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        phone: user.phone,
        phone_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already') || authError.message.includes('exists')) {
          console.log(`  ⚠️  Skipped ${user.email} (already exists)`);
          continue;
        }
        throw authError;
      }

      const userId = authData.user.id;

      // Insert into public.users
      const { error: userError } = await supabaseAdmin.from('users').upsert({
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        phone_number: user.phone,
        is_verified: true,
        is_active: true,
      });
      if (userError) throw userError;

      // Insert staff profile if applicable
      if (user.profile) {
        const { error: profileError } = await supabaseAdmin.from('staff_profiles').upsert({
          user_id: userId,
          ...user.profile,
        });
        if (profileError) throw profileError;
      }

      console.log(`  ✅  ${user.role.toUpperCase()}: ${user.name} — ${user.email} / ${user.password}`);
    } catch (err) {
      console.error(`  ❌  Failed for ${user.email}:`, err.message);
    }
  }

  console.log('\n✅ Seeding complete!\n');
  console.log('Demo credentials:');
  SEED_STAFF.forEach(u => console.log(`  ${u.role.padEnd(14)} ${u.email.padEnd(25)} ${u.password}`));
  console.log();
}

seed().catch(console.error);
