import { HttpsError } from 'firebase-functions/v2/https';

interface CallerRequest {
  auth?: { uid?: string; token?: Record<string, unknown> } | null;
}

export interface Caller {
  uid: string;
  societyId: string;
  role: string;
}

/**
 * Extracts and validates caller identity from a Cloud Functions request.
 * Throws unauthenticated/failed-precondition if uid or societyId is absent.
 */
export function requireCaller(request: CallerRequest): Caller {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

  const token     = request.auth?.token;
  const societyId = token?.societyId as string | undefined;
  const role      = (token?.role as string | undefined) ?? '';

  if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');

  return { uid, societyId, role };
}

/** Throws permission-denied if a document's societyId doesn't match the caller's. */
export function assertSameSociety(docSocietyId: string, callerSocietyId: string): void {
  if (docSocietyId !== callerSocietyId)
    throw new HttpsError('permission-denied', 'Cross-society access denied.');
}
