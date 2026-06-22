import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { functions } from '../../lib/firebase';
import type { AuthClaims } from '../../types/auth';

const refreshClaimsCallable = httpsCallable<void, AuthClaims>(functions, 'refreshClaims');

/**
 * Call after sign-in: activates any pending membership invitations,
 * sets custom claims, then force-refreshes the ID token so the new
 * claims are available immediately.
 */
export async function callRefreshClaims(user: User): Promise<void> {
  await refreshClaimsCallable();
  // Force a token refresh so the new claims take effect in this session
  await user.getIdToken(true);
}
