/**
 * cleanup_non_admin_users.js
 *
 * Deletes every user account EXCEPT one designated admin — for the
 * "start fresh with a single admin" cleanup.
 *
 * Reuses the exact same deletion logic the Admin > User Management page
 * uses (userManagementService.deleteUser), so every deleted user's
 * appointments, medical records, payments, pets, messages, etc. are
 * cleaned up the same way a manual delete-from-the-UI would.
 *
 * SAFETY:
 *   - Defaults to a DRY RUN. Nothing is deleted unless you pass --confirm.
 *   - Writes a full JSON backup of every user about to be deleted (their
 *     public.users row) to backend/backups/ before touching anything.
 *   - Refuses to run if it can't uniquely determine which admin to keep —
 *     pass --keep=<email> to be explicit.
 *
 * USAGE (run from the backend/ folder, in YOUR OWN terminal — this
 * needs real internet access to reach Supabase):
 *
 *   node scripts/cleanup_non_admin_users.js
 *       → dry run: shows exactly what would be deleted, deletes nothing.
 *
 *   node scripts/cleanup_non_admin_users.js --keep=admin@yourclinic.com
 *       → dry run, explicitly naming which admin to keep.
 *
 *   node scripts/cleanup_non_admin_users.js --keep=admin@yourclinic.com --confirm
 *       → ACTUALLY DELETES every other user. Irreversible.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../src/config/supabase');
const userManagementService = require('../src/services/userManagementService');

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const keepArg = args.find(a => a.startsWith('--keep='));
const keepEmail = keepArg ? keepArg.split('=')[1].trim().toLowerCase() : null;

async function main() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, is_active, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch users:', error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} total user(s).\n`);

  // ── Figure out which admin to keep ──────────────────────────────
  const admins = users.filter(u => u.role === 'admin');
  let keepUser;

  if (keepEmail) {
    keepUser = users.find(u => u.email.toLowerCase() === keepEmail);
    if (!keepUser) {
      console.error(`No user found with email "${keepEmail}". Aborting — nothing was deleted.`);
      process.exit(1);
    }
    if (keepUser.role !== 'admin') {
      console.error(`"${keepEmail}" is role "${keepUser.role}", not "admin". Refusing to proceed — pass the actual admin's email.`);
      process.exit(1);
    }
  } else if (admins.length === 1) {
    keepUser = admins[0];
  } else if (admins.length === 0) {
    console.error('No admin account found at all. Refusing to proceed — there would be nobody left who can sign in.');
    process.exit(1);
  } else {
    console.error(`Found ${admins.length} admin accounts — can't guess which one to keep:`);
    admins.forEach(a => console.error(`  - ${a.email} (id=${a.id})`));
    console.error('\nRe-run with --keep=<email> to specify which one survives.');
    process.exit(1);
  }

  const toDelete = users.filter(u => u.id !== keepUser.id);

  console.log(`Keeping admin: ${keepUser.email} (id=${keepUser.id})\n`);
  console.log(`Would delete ${toDelete.length} user(s):`);
  const byRole = {};
  toDelete.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
  console.log('  By role:', JSON.stringify(byRole));
  toDelete.forEach(u => console.log(`  - [${u.role}] ${u.email} (id=${u.id}, created=${u.created_at})`));

  if (!toDelete.length) {
    console.log('\nNothing to do — only the admin account exists.');
    return;
  }

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing was deleted. Re-run with --confirm to actually delete these accounts.');
    return;
  }

  // ── Backup before deleting anything ─────────────────────────────
  const backupDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `pre_cleanup_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
  console.log(`\nBackup written to ${backupPath}`);

  // ── Delete, one at a time, via the same code path the admin UI uses ──
  console.log('\nDeleting...');
  let ok = 0, failed = 0;
  for (const u of toDelete) {
    try {
      await userManagementService.deleteUser(keepUser.id, u.id);
      console.log(`  ✓ deleted ${u.role} ${u.email}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ FAILED to delete ${u.role} ${u.email}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} deleted, ${failed} failed.`);
  if (failed > 0) {
    console.log('Failed deletions were left in place — re-run the script to retry just those (already-deleted users are simply skipped).');
  }
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
