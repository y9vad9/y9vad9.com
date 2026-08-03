import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const aliases = {
  '@core': resolve(__dirname, './src/core'),
  '@config': resolve(__dirname, './src/config'),
  '@adapters': resolve(__dirname, './src/adapters'),
  '@components': resolve(__dirname, './src/components'),
  '@hooks': resolve(__dirname, './src/hooks'),
  '@store': resolve(__dirname, './src/store'),
  '@lib': resolve(__dirname, './src/lib'),
  '@i18n': resolve(__dirname, './src/i18n'),
  '~/site.config': resolve(__dirname, './site.config'),
  // Bare `~` so `loadSiteConfig`'s dynamic `~/site.<locale>.config` resolves
  // in tests the same way webpack resolves it in a build.
  '~': resolve(__dirname, '.'),
  '~/content': resolve(__dirname, './content'),
}

// Tests under `hooks/` and `components/`, plus any `.tsx` test file, exercise
// React + DOM and need jsdom. Everything else runs in pure node for speed.
// Vitest 4 tightened the config schema: project-level `esbuild` no longer
// accepts `jsx`, and `poolOptions` only belongs at the top level. Cast
// through `any` for the `jsx: 'automatic'` hint — esbuild does still
// honour the option at runtime, the bundled types just dropped it.
const jsxAutomatic = { jsx: 'automatic' } as unknown as Record<string, never>

export default defineConfig({
  esbuild: jsxAutomatic,
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/**',
        'src/lib/**',
        'src/adapters/**',
        'src/store/**',
        'src/hooks/**',
        'src/components/**',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/app/**',
        'src/**/*.css',
        'tests-e2e/**',
      ],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
        statements: 70,
      },
    },
    exclude: ['tests-e2e/**', 'node_modules/**', 'dist/**', '.next/**'],
    // Single-fork-per-project: one worker process per project, tests run
    // sequentially inside it. Slower than the default fan-out, but:
    //   - chdir-heavy tests (tests/content, tests/lib/images, tests/adapters)
    //     can't fight each other for the cwd from neighbouring forks.
    //   - On catastrophic failure / Ctrl+C, the parent only has 2 children
    //     to reap instead of one-per-CPU. Vitest used to leave a fanned-out
    //     pool of workers spinning in RAM when tests crashed during setup,
    //     and this configuration eliminates that surface entirely.
    pool: 'forks',
    // `poolOptions` was dropped from Vitest 4's typed `InlineConfig`
    // shape but the runtime still honours it. Spread through `any` so
    // the option survives without a typed slot.
    ...({ poolOptions: { forks: { singleFork: true } } } as Record<string, unknown>),
    projects: [
      {
        resolve: { alias: aliases },
        esbuild: jsxAutomatic,
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          // pool / poolOptions inherited from the top-level config in
          // Vitest 4 — they're no longer accepted per-project.
          include: [
            'tests/core/**/*.test.ts',
            'tests/adapters/**/*.test.ts',
            'tests/lib/**/*.test.ts',
            '!tests/lib/**/*.dom.test.ts',
            'tests/store/**/*.test.ts',
            'tests/app/**/*.test.ts',
            'tests/content/**/*.test.ts',
            // Cloudflare Pages functions. Pure helpers only — the middleware
            // itself is exercised against the real runtime via `wrangler`.
            'tests/functions/**/*.test.ts',
          ],
        },
      },
      {
        resolve: { alias: aliases },
        esbuild: jsxAutomatic,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          // pool / poolOptions inherited from the top-level config in
          // Vitest 4 — they're no longer accepted per-project.
          include: [
            'tests/hooks/**/*.test.{ts,tsx}',
            'tests/components/**/*.test.{ts,tsx}',
            // Most lib tests are pure and belong in the node pool; the few
            // that touch `document` opt into jsdom with a `.dom.test.ts`
            // suffix (excluded from the node project below).
            'tests/lib/**/*.dom.test.{ts,tsx}',
          ],
        },
      },
    ],
  },
  resolve: { alias: aliases },
})
