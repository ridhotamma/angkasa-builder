/**
 * Bundles the framework-free page runtime into one minified browser script,
 * `dist/html/page-runtime.js` (exported as `angkasa-builder/page-runtime.js`),
 * for hosts that serve it as a static file.
 */

const result = await Bun.build({
  entrypoints: [`${import.meta.dir}/../src/html/runtime-entry.ts`],
  outdir: `${import.meta.dir}/../dist/html`,
  naming: 'page-runtime.js',
  target: 'browser',
  format: 'iife',
  minify: true,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
for (const output of result.outputs) {
  console.log(`${output.path} (${(output.size / 1024).toFixed(1)} kB)`)
}
