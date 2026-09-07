import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const root = new URL('../', import.meta.url)
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
test('portable package binds the actual runtime manifest and package version', async () => {
  const envelope = await json('cordisx-package.json')
  const pkg = await json('package.json')
  const bytes = await readFile(new URL(envelope.runtimeManifest.path, root))
  const manifest = JSON.parse(bytes)
  assert.equal(envelope.version, pkg.version)
  assert.equal(envelope.id, manifest.id)
  assert.equal(envelope.runtimeManifest.digest, digest(bytes))
  assert.equal(manifest.schemaVersion, 10)
  assert.equal(envelope.entry, './dist/runtime/module.js')
  assert.ok(pkg.files.includes('cordisx-package.json'))
})
test('release keeps every indexed lazy graph file with its original digest', async () => {
  const artifact = await json('dist/runtime/artifact.json')
  assert.ok(artifact.files.some(file => file.dynamicImports.length > 0))
  for (const file of artifact.files) {
    const bytes = await readFile(new URL(`dist/runtime/${file.path}`, root))
    assert.equal(digest(bytes), file.digest, file.path)
    assert.equal(bytes.length, file.byteLength, file.path)
  }
})
