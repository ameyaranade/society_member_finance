/**
 * One-time script: creates an active MC membership for testing quorum validation.
 * Run from the project root: node scripts/addTestMC.cjs
 */
'use strict';
const admin = require('C:\\coding\\society-finance\\functions\\node_modules\\firebase-admin');
const path  = require('path');

const SERVICE_ACCOUNT = path.join(__dirname, '..', 'service-account.json');
const SOCIETY_ID      = 'test1-sumadhura-acropolis';
const EMAIL           = 'test-mc1@sumacr.com';

admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();

async function run() {
  const membershipId = `${EMAIL.replace(/[^a-z0-9]/gi, '_')}_${SOCIETY_ID}`;
  await db.doc(`memberships/${membershipId}`).set({
    id: membershipId,
    societyId: SOCIETY_ID,
    email: EMAIL,
    role: 'mc',
    status: 'active',
    uid: 'test-mc1-stub',
    displayName: 'Test MC Member',
    invitedBy: 'script',
    invitedAt: admin.firestore.FieldValue.serverTimestamp(),
    activatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✓ Active MC membership created:', membershipId);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
