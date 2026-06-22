import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const _db = getFirestore();
_db.settings({ ignoreUndefinedProperties: true });

export const db = _db;
export const adminAuth = getAuth();
