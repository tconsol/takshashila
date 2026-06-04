import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { authService } from '../services/auth.service';
import { ROLE_DASHBOARD_PATHS } from '../constants/roles';
import type { LoginFormData } from '../validators/auth.validators';

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.getMe,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginFormData) => authService.login(data),
    onSuccess: (result) => {
      setAuth(result.user, result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      navigate(ROLE_DASHBOARD_PATHS[result.user.role], { replace: true });
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      clearAuth();          // clears localStorage + sessionStorage
      qc.clear();           // clears all React Query cache
      navigate('/login', { replace: true });
    },
  });
}
