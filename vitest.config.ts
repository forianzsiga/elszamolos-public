import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['node_modules/', 'dist/', '.worktrees/', '.opencode/'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    globalSetupTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/', 'dist/', 'dev-dist/', 'public/', 'caddata_zsiga/'],
    },
  },
});
