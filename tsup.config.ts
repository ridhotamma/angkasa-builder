import { defineConfig } from 'tsup'

/**
 * One ESM build per entry point, with type declarations. Dependencies stay
 * external — the host installs them once. The browser runtime's one-file
 * script is built separately by `scripts/build-runtime.ts`.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'render/index': 'src/render/index.ts',
    'editor/index': 'src/editor/index.ts',
    'editor-core/index': 'src/editor-core/index.ts',
    'snapshot/index': 'src/snapshot/index.ts',
    'html/index': 'src/html/index.ts',
    'html/runtime': 'src/html/runtime.ts',
    'quick-checkout/index': 'src/quick-checkout/index.ts',
  },
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  // Declarations come from `tsc -p tsconfig.build.json`: faster, and within memory.
  dts: false,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: [/^node:/],
})
