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
    // Socket data:invalidate is the fast path; poll + window-focus refetch are
    // the safety net so the dot still updates if a socket event is missed.
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    enabled: isAuthenticated,
  });

  return data;
}
