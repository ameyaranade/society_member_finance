import { Navigate } from 'react-router-dom';
import type { Role } from '../../types/auth';
import { useAuth } from './useAuth';

interface Props {
  roles: Role[];
  children: React.ReactNode;
}

/**
 * Renders children only if the user's current role is in the allowed list.
 * Otherwise redirects to /forbidden.
 * This is a UX gate — Firestore rules are the hard security boundary.
 */
export default function RequireRole({ roles, children }: Props) {
  const { role, isSuperAdmin } = useAuth();

  if (isSuperAdmin || (role && roles.includes(role))) {
    return <>{children}</>;
  }

  return <Navigate to="/forbidden" replace />;
}
