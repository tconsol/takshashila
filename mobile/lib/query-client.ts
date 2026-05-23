import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});
