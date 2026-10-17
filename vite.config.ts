import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run server` hosts the simulation API; in dev the app reaches it through this proxy.
    proxy: { '/simulation': 'http://localhost:3001' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'server/index.ts',
        'src/globals.d.ts',
        '**/index.ts',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
