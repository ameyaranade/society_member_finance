/**
 * One-time fix: updates the test-mc1 membership doc to use the real Firebase Auth UID.
 * The stub membership was created with uid:'test-mc1-stub' which blocks refreshClaims.
 * Run from the project root: node scripts/fixMCMembership.cjs
 */
'use strict';
const admin = require('C:\\coding\\society-finance\\functions\\node_modules\\firebase-admin');
const path  = require('path');

const SERVICE_ACCOUNT = path.join(__dirname, '..', 'service-account.json');
const SOCIETY_ID      = 'test1-sumadhura-acropolis';
const EMAIL           = 'test-mc1@sumacr.com';

admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db   = admin.firestore();
const auth = admin.auth();

async function run() {
  // Look up the real UID from Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(EMAIL);
  } catch (e) {
    console.error(`No Firebase Auth user found for ${EMAIL}. Create the account first by signing up in the app.`);
    process.exit(1);
  }

  const realUid = userRecord.uid;
  console.log(`Found Auth user: uid=${realUid}`);

  const membershipId = `${EMAIL.replace(/[^a-z0-9]/gi, '_')}_${SOCIETY_ID}`;
  const ref = db.doc(`memberships/${membershipId}`);
  const snap = await ref.get();

  if (!snap.exists) {
    console.error(`Membership doc ${membershipId} not found.`);
    process.exit(1);
  }

  const data = snap.data();
  console.log(`Current membership uid: ${data.uid}`);

  if (data.uid === realUid) {
    console.log('UID already correct — no update needed.');
    process.exit(0);
  }

  await ref.update({ uid: realUid });
  console.log(`✓ Updated membership ${membershipId}: uid → ${realUid}`);
  console.log('Have test-mc1 sign out and sign back in to pick up fresh claims.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
