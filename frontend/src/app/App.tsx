import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from '../routes';
import { queryClient } from '../lib/query-client';
import { ToastProvider } from '../components/ui/Toast';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" makes every Framer animation honor the OS
          "reduce motion" setting (a11y CRITICAL). */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <RouterProvider router={router} />
          <ReactQueryDevtools initialIsOpen={false} />
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
