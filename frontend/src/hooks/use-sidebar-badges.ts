import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useAuthStore } from '../stores/auth.store';

async function fetchBadges(): Promise<Record<string, number>> {
  const { data } = await api.get<{ data: Record<string, number> }>('/badges');
  return data.data;
}

export function useSidebarBadges(): Record<string, number> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);

  const { data = {} } = useQuery({
    queryKey: ['badges', role],
    queryFn: fetchBadges,
    staleTime: 30_000,
    enabled: isAuthenticated,
  });

  return data;
}
