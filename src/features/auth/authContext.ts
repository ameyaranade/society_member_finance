import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { AuthClaims, Role } from '../../types/auth';

export interface AuthContextValue {
  user: User | null;
  claims: AuthClaims | null;
  /** Active society for this session */
  societyId: string | null;
  role: Role | null;
  isSuperAdmin: boolean;
  /** True while the initial auth state is being resolved */
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
