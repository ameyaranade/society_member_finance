import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * After sign-in, ensure the user has an active societyId in their claims.
 * Super-admins bypass this (they operate across societies from a different UI).
 * Regular users without a society are shown the NoSociety page.
 */
export default function RequireSociety({ children }: { children: React.ReactNode }) {
  const { societyId, isSuperAdmin, loading } = useAuth();

  // Still resolving — RequireAuth already shows the spinner; nothing to do here
  if (loading) return null;

  if (!societyId) {
    return <Navigate to={isSuperAdmin ? '/super-admin' : '/no-society'} replace />;
  }

  return <>{children}</>;
}
