import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,      // 5 min data stays fresh, no refetch
      gcTime: 1000 * 60 * 30,        // keep unused cache 30 min
      refetchOnWindowFocus: false,   // was true → an API call fired on every tab focus
      refetchOnReconnect: false,     // avoid request bursts on network blips
    },
    mutations: {
      retry: 0,
    },
  },
});
