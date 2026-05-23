import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { PageLoader } from '../components/ui/Loading';
import type { Role } from '../types';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) return <PageLoader />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role]} replace />;
  }

  return <Outlet />;
}
