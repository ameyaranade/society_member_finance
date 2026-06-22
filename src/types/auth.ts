import type { Timestamp } from 'firebase/firestore';
import type { SocietyConfig } from './config';

export type { SocietyConfig };
export type Role = 'admin' | 'mc' | 'fm' | 'resident';
export type MembershipStatus = 'invited' | 'active' | 'deactivated';

/** Custom claims minted by Cloud Functions — stored in the JWT */
export interface AuthClaims {
  societyId?: string;    // active society
  role?: Role;
  superAdmin?: boolean;
  societies?: string[];  // all society IDs the user belongs to (for future switcher)
}

/** /users/{uid} — global profile written on first sign-in */
export interface UserProfile {
  id: string;   // document id = uid
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

/**
 * /memberships/{uid}_{societyId}
 * Top-level so "all societies for a user" can be queried with a single where('uid','==',uid).
 * Created with status:'invited' (no uid yet); uid stamped when the user first signs in.
 */
export interface Membership {
  id: string;           // uid_societyId composite key
  societyId: string;
  email: string;
  role: Role;
  status: MembershipStatus;
  invitedBy: string;    // uid of the inviter (superAdmin or admin)
  invitedAt: Timestamp;
  uid?: string;         // populated by refreshClaims after first sign-in
  activatedAt?: Timestamp;
  displayName?: string;
  photoURL?: string;
}

/** /societies/{societyId} */
export interface Society {
  id: string;
  name: string;
  address?: string;
  registrationNo?: string;
  totalUnits: number;
  createdAt: Timestamp;
  createdBy: string;    // super-admin uid
  config?: SocietyConfig;
}
