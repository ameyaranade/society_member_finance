/**
 * One-time bootstrap: grant superAdmin claim to a Firebase Auth user.
 * Accepts either a UID or an email address.
 *
 * Usage (run from the functions/ directory so firebase-admin is available):
 *   node ..\scripts\setSuperAdmin.js ameyaar@gmail.com
 *   node ..\scripts\setSuperAdmin.js <uid>
 *
 * Requires service-account.json in the project root.
 * Download from: Firebase Console → Project Settings → Service accounts → Generate new private key
 */

const admin = require('firebase-admin');
const path  = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error('\n✗  Could not load service-account.json');
  console.error('   Download from: Firebase Console → Project Settings → Service accounts → Generate new private key');
  console.error(`   Save to: ${serviceAccountPath}\n`);
  process.exit(1);
}

const input = process.argv[2];
if (!input) {
  console.error('\nUsage: node ..\\scripts\\setSuperAdmin.js <email-or-uid>\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function run() {
  // Resolve UID from email or treat input as UID directly
  let user;
  if (input.includes('@')) {
    user = await admin.auth().getUserByEmail(input);
  } else {
    user = await admin.auth().getUser(input);
  }

  await admin.auth().setCustomUserClaims(user.uid, { superAdmin: true });
  console.log(`\n✓  superAdmin: true → ${user.email} (${user.uid})`);
  console.log('   Sign out and sign back in to activate the claim.\n');
}

run().then(() => process.exit(0)).catch(err => {
  console.error('\n✗  Error:', err.message, '\n');
  process.exit(1);
});
