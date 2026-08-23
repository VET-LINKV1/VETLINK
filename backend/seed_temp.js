import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config(); // reads backend/.env automatically since we're running from backend/

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SEED_USERS = [
  { email: 'admin@vetlink.dev',  password: 'demo1234', name: 'Admin User',     role: 'admin' },
  { email: 'vet@vetlink.dev',    password: 'demo1234', name: 'Dr. Jane Smith', role: 'veterinarian' },
  { email: 'staff@vetlink.dev',  password: 'demo1234', name: 'Staff Member',   role: 'staff' },
];

async function seed() {
  console.log('🌱 VETLINK Database Seeder\n');

  for (const user of SEED_USERS) {
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
          console.log(`  ⚠️  Skipped ${user.email} (already exists)`);
          continue;
        }
        throw authError;
      }

      const userId = authData?.user?.id;

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert({ id: userId, email: user.email, name: user.name, role: user.role });

      if (profileError) throw profileError;

      console.log(`  ✅  Created: ${user.name} (${user.role}) — ${user.email}`);
    } catch (err) {
      console.error(`  ❌  Failed for ${user.email}:`, err.message);
    }
  }

  console.log('\n✅ Seeding complete. Login with password: demo1234');
}

seed().catch(console.error);