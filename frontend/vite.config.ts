import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Derive proxy target from VITE_API_URL strip "/api/v1" suffix if present
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:5000/api/v1';
  const proxyTarget = apiUrl.replace(/\/api\/v\d+\/?$/, '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy vendors into separate cached chunks so the main bundle
          // stays small and these load only when a feature needs them.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion', 'gsap'],
            'vendor-xlsx': ['xlsx'],
            'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-agora': ['agora-rtc-sdk-ng'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
