import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// Reading the declarative entry must not load Avatar or activate the plugin.
globalThis.__cordisxSharedReactRuntime = { React: {}, jsxRuntime: {}, ui: {}, defineReactVisual: value => value }
const { manifest } = await import('../dist/runtime/module.js')
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const runtime = `${JSON.stringify(manifest, null, 2)}\n`
await writeFile(new URL('../dist/manifest.json', import.meta.url), runtime)
const envelope = {
  $schema: 'https://raw.githubusercontent.com/cordisx/cordisx-protocol/main/schemas/plugin-package.v11.schema.json',
  schemaVersion: 11,
  id: manifest.id,
  version: pkg.version,
  entry: './dist/runtime/module.js',
  readme: './README.md',
  canonicalSource: 'https://github.com/cordisx/plugin-pet',
  distribution: { mode: 'explicit-local-v1', signature: 'unsupported' },
  compatibility: { runtimeAbi: 1, protocolSchemas: [manifest.$schema] },
  dependencies: [],
  runtimeManifest: {
    path: './dist/manifest.json',
    schema: manifest.$schema,
    digest: `sha256:${createHash('sha256').update(runtime).digest('hex')}`,
  },
}
await writeFile(new URL('../cordisx-package.json', import.meta.url), `${JSON.stringify(envelope, null, 2)}\n`)
