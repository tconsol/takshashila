import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from '../routes';
import { queryClient } from '../lib/query-client';
import { ToastProvider } from '../components/ui/Toast';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        <ReactQueryDevtools initialIsOpen={false} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
