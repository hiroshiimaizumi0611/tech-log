import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['demos/server-room/**', ...configDefaults.exclude],
    passWithNoTests: true,
  },
});
