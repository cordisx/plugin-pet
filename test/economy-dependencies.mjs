import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
test('economy consumer package inputs are portable, SHA-pinned and checksum verified', async () => {
  const record = JSON.parse(await readFile('.development/economy-dependencies.json', 'utf8'))
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  for (const artifact of record.artifacts) {
    assert.match(artifact.sourceCommit, /^[a-f0-9]{40}$/)
    assert.match(artifact.repository, /^https:\/\/github.com\/cordisx\//)
    const path = `.development/${artifact.artifact}`
    assert.equal({ ...pkg.dependencies, ...pkg.devDependencies }[artifact.package], `file:${path}`)
    assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), artifact.sha256)
  }
})
