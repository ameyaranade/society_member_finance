import type { User } from 'firebase/auth';
import { callables } from '../../lib/callables';

export async function callRefreshClaims(user: User): Promise<void> {
  await callables.refreshClaims();
  await user.getIdToken(true);
}
