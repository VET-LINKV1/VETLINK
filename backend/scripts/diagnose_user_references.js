/**
 * diagnose_user_references.js
 *
 * READ-ONLY. Finds every table+column in your live Supabase schema that
 * has a foreign key pointing at public.users(id), then checks each one
 * for rows referencing the given user. Nothing is deleted or modified.
 *
 * This replaces guessing from migration files with asking the actual
 * live database, via Supabase's auto-generated OpenAPI schema (which
 * PostgREST exposes at the REST root and includes FK metadata in each
 * column's description).
 *
 * USAGE (run from the backend/ folder):
 *   node scripts/diagnose_user_references.js --user=someone@example.com
 *   node scripts/diagnose_user_references.js --id=<user-uuid>
 */
require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const args = process.argv.slice(2);
const userArg = args.find(a => a.startsWith('--user='))?.split('=')[1];
const idArg   = args.find(a => a.startsWith('--id='))?.split('=')[1];

// A baseline of columns we already know reference users(id), so we still
// report on these even if the OpenAPI description parsing below finds
// nothing (older/newer PostgREST versions format descriptions differently).
const KNOWN_CANDIDATES = [
  ['appointments', 'client_id'], ['appointments', 'vet_id'], ['appointments', 'triaged_by'],
  ['appointments', 'approved_by'], ['appointments', 'cancelled_by'], ['appointments', 'declined_by'],
  ['medical_records', 'vet_id'], ['payments', 'user_id'], ['soap_notes', 'vet_id'],
  ['prescriptions', 'vet_id'], ['treatments', 'vet_id'], ['refill_requests', 'requested_by'],
  ['refill_requests', 'processed_by'], ['discharge_instructions', 'vet_id'],
  ['passport_shares', 'created_by'], ['messages', 'sender_id'], ['emr_files', 'uploaded_by'],
  ['conversations', 'assigned_vet_id'], ['conversations', 'client_id'],
  ['vaccinations', 'vet_id'], ['pet_weights', 'recorded_by'], ['appointment_intakes', 'submitted_by'],
  ['video_consultations', 'vet_id'], ['video_consultations', 'created_by'], ['video_consultations', 'client_id'],
  ['health_check_results', 'performed_by'], ['prescriptive_resource_usage', 'used_by'],
  ['prescriptive_actions', 'acted_by'], ['notifications', 'user_id'], ['pets', 'owner_id'],
  ['staff_profiles', 'user_id'],
];

async function fetchOpenApiCandidates() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) { console.log(`(schema introspection request failed: ${res.status} — falling back to known list)`); return []; }
    const spec = await res.json();
    const defs = spec.definitions || spec.components?.schemas || {};
    const found = [];
    for (const [table, def] of Object.entries(defs)) {
      const props = def.properties || {};
      for (const [col, meta] of Object.entries(props)) {
        const desc = meta.description || '';
        const m = desc.match(/<fk table=['"]users['"] column=['"]id['"]\s*\/>/);
        if (m) found.push([table, col]);
      }
    }
    return found;
  } catch (e) {
    console.log(`(schema introspection failed: ${e.message} — falling back to known list)`);
    return [];
  }
}

async function main() {
  let targetId = idArg;
  let targetEmail = userArg;

  if (!targetId) {
    if (!targetEmail) {
      console.error('Pass --user=<email> or --id=<uuid>.');
      process.exit(1);
    }
    const { data, error } = await supabaseAdmin.from('users').select('id, email, role').eq('email', targetEmail).single();
    if (error || !data) { console.error(`No user found with email "${targetEmail}".`); process.exit(1); }
    targetId = data.id;
    console.log(`Resolved ${targetEmail} → id=${targetId} (role=${data.role})\n`);
  }

  const discovered = await fetchOpenApiCandidates();
  const all = new Map();
  for (const [t, c] of [...KNOWN_CANDIDATES, ...discovered]) all.set(`${t}.${c}`, [t, c]);

  console.log(`Checking ${all.size} known/discovered table.column pairs for references to ${targetId}...\n`);

  const hits = [];
  for (const [table, column] of all.values()) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, targetId);
      if (error) {
        if (!/relation .* does not exist|schema cache/i.test(error.message)) {
          console.log(`  ? ${table}.${column} — query error: ${error.message}`);
        }
        continue;
      }
      if (count > 0) {
        hits.push([table, column, count]);
        console.log(`  ✗ ${table}.${column} — ${count} row(s) still reference this user`);
      }
    } catch (e) {
      // table doesn't exist or similar — ignore
    }
  }

  if (!hits.length) {
    console.log('\nNo references found in any checked table. If deletion still fails, the blocking');
    console.log('table exists but was not discovered here — check Supabase Dashboard → Database →');
    console.log('Database → search for this user\'s ID, or Table Editor → look for a table with a');
    console.log('column type "uuid" that isn\'t in the list above.');
  } else {
    console.log(`\nFound ${hits.length} blocking table(s). Send this output back and I'll add proper cleanup for them.`);
  }
}

main().catch(e => { console.error('Unexpected error:', e); process.exit(1); });
