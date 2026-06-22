import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AuthContext, type AuthContextValue } from './authContext';
import { callRefreshClaims } from './useRefreshClaims';
import type { AuthClaims } from '../../types/auth';

async function getClaims(user: User): Promise<AuthClaims> {
  const result = await user.getIdTokenResult(false);
  return result.claims as unknown as AuthClaims;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let c = await getClaims(firebaseUser);

        // If the user has no society claims yet, call refreshClaims to link
        // any pending membership invitations and set the claims.
        if (!c.societyId) {
          try {
            await callRefreshClaims(firebaseUser);
            c = await getClaims(firebaseUser);
          } catch {
            // refreshClaims may fail if Functions aren't deployed yet — degrade gracefully
          }
        }

        setUser(firebaseUser);
        setClaims(c);
      } else {
        setUser(null);
        setClaims(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      societyId: claims?.societyId ?? null,
      role: claims?.role ?? null,
      isSuperAdmin: claims?.superAdmin === true,
      loading,
    }),
    [user, claims, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
