import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const result = await build({ stdin: { contents: `export * from './src/pet-usage.ts'; export * from './src/pet-store.ts'; export * from './src/pet-domain.ts';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false })
const { PetUsageController, PetStore, createPetState, settlePetUsage, migratePetState } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const snapshot = (tokens = 0, revision = 0, epoch = 'epoch-1') => ({ schemaVersion: 1, status: 'ready', scopeId: 'local-profile', sourceId: 'rollout-source', epoch, revision, policyId: 'codex-local-input-output-v1', eligibleTokens: tokens, inputTokens: tokens, outputTokens: 0, enabledAt: 1, observedThrough: 1000, coverage: 'partial', diagnostics: [] })
function memory(value = null) {
  let data = value, revision = 0, writes = 0
  return {
    load: async () => ({ revision: data ? String(revision) : null, value: structuredClone(data) }),
    compareAndSwap: async (expected, state) => { if (expected !== (data ? String(revision) : null)) return false; data = structuredClone(state); revision++; writes++; return true },
    state: () => data,
    writes: () => writes,
  }
}
function service(initial = snapshot()) {
  let value = initial, reads = 0
  const listeners = new Set()
  return {
    read: async () => { reads++; return value },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set: next => { value = next },
    emit: next => { value = next; for (const listener of listeners) listener() },
    listeners: () => listeners.size,
    reads: () => reads,
  }
}
function controller(source, store, statuses = []) {
  return new PetUsageController(source, async (usage, key, current) => { await store.settleUsage(usage, key, current) }, value => statuses.push(value))
}
test('public usage first read baselines, later fractional deltas award once, unchanged polling writes nothing', async t => {
  const adapter = memory(), store = new PetStore(adapter, { trustedUsageEnabled: true }), source = service(snapshot(9999)), statuses = []
  const client = controller(source, store, statuses); t.after(() => client.dispose())
  await client.start()
  assert.equal(adapter.state().wallet.balance, 0)
  const writes = adapter.writes()
  for (let index = 0; index < 20; index++) await client.refresh()
  assert.equal(adapter.writes(), writes)
  source.set(snapshot(10000, 1)); await client.refresh()
  assert.equal(adapter.state().wallet.balance, 0)
  source.set(snapshot(19999, 2)); await client.refresh()
  assert.equal(adapter.state().wallet.balance, 1)
  assert.equal(adapter.state().receipts.length, 1)
  assert.equal(statuses.at(-1).status, 'ready')
  assert.equal(statuses.at(-1).coverage, 'partial')
})
test('two clients share a frontier, restart does not remint, and a new epoch never credits history', async t => {
  const adapter = memory(), source = service(), a = controller(source, new PetStore(adapter, { trustedUsageEnabled: true })), b = controller(source, new PetStore(adapter, { trustedUsageEnabled: true }))
  t.after(() => { a.dispose(); b.dispose() })
  await Promise.all([a.start(), b.start()])
  source.set(snapshot(20000, 1)); await Promise.all([a.refresh(), b.refresh()])
  assert.equal(adapter.state().wallet.balance, 2)
  a.dispose()
  const restarted = controller(source, new PetStore(adapter, { trustedUsageEnabled: true })); t.after(() => restarted.dispose())
  await restarted.start()
  assert.equal(adapter.state().wallet.balance, 2)
  source.set(snapshot(1000000, 50, 'epoch-2')); await restarted.refresh()
  assert.equal(adapter.state().wallet.balance, 2)
  source.set(snapshot(1010000, 51, 'epoch-2')); await restarted.refresh()
  assert.equal(adapter.state().wallet.balance, 3)
})
test('rollback, same revision with changed counters and malformed public totals are unavailable without credit', async t => {
  const adapter = memory(), source = service(), statuses = [], client = controller(source, new PetStore(adapter, { trustedUsageEnabled: true }), statuses)
  t.after(() => client.dispose()); await client.start()
  source.set(snapshot(20000, 2)); await client.refresh()
  const writes = adapter.writes()
  for (const value of [snapshot(10000, 1), snapshot(30000, 2), { ...snapshot(30000, 3), inputTokens: 1 }]) {
    source.set(value); await client.refresh()
    assert.equal(statuses.at(-1).status, 'unavailable')
    assert.equal(adapter.writes(), writes)
    assert.equal(adapter.state().wallet.balance, 2)
  }
})
test('permission invalidation fences an in-flight ready response and publishes denied status', async t => {
  const adapter = memory(), source = service(), statuses = []
  let release
  const pending = new Promise(resolve => { release = resolve })
  let first = true
  const read = source.read
  source.read = () => { if (first) { first = false; return pending } return read() }
  const client = controller(source, new PetStore(adapter, { trustedUsageEnabled: true }), statuses)
  t.after(() => client.dispose())
  const starting = client.start()
  source.emit({ schemaVersion: 1, status: 'unavailable', reason: 'permission-denied', diagnostics: [] })
  release(snapshot(100000, 20)); await starting
  assert.equal(adapter.writes(), 0)
  assert.deepEqual(statuses.at(-1), { status: 'unavailable', reason: 'permission-denied' })
})
test('disposal while owner storage load is pending fences CAS and unsubscribes', async () => {
  const adapter = memory(), source = service(), statuses = []
  let entered, release
  const waiting = new Promise(resolve => { entered = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const load = adapter.load
  adapter.load = async () => { entered(); await gate; return load() }
  const client = controller(source, new PetStore(adapter, { trustedUsageEnabled: true }), statuses)
  const starting = client.start(); await waiting
  client.dispose(); release(); await starting
  assert.equal(adapter.writes(), 0)
  assert.equal(source.listeners(), 0)
  assert.equal(statuses.at(-1).status, 'initializing')
})
test('thousands of usage increments keep a compact permanent frontier and one income record', () => {
  let state = settlePetUsage(createPetState(), { sourceId: 'host', totalTokens: 0, revision: 0 }, { key: 'baseline', now: 0 }).state
  for (let index = 1; index <= 3000; index++) state = settlePetUsage(state, { sourceId: 'host', totalTokens: index * 10000, revision: index }, { key: `usage-${index}`, now: index }).state
  assert.equal(state.wallet.balance, 3000)
  assert.equal(state.receipts.length, 1)
  assert.ok(new TextEncoder().encode(JSON.stringify(state)).byteLength < 4096)
  assert.deepEqual(migratePetState(state), state)
  const duplicate = settlePetUsage(state, { sourceId: 'host', totalTokens: 30000000, revision: 3000 }, { key: 'replay-after-compaction', now: 9999 })
  assert.equal(duplicate.duplicate, true)
})
test('legacy income receipts compact without losing frontier and an oversized transaction is not written', async () => {
  let state = settlePetUsage(createPetState(), { sourceId: 'host', totalTokens: 0 }, { key: 'base', now: 0 }).state
  state = settlePetUsage(state, { sourceId: 'host', totalTokens: 20000 }, { key: 'income', now: 1 }).state
  state.receipts = [{ key: 'old-a', kind: 'usage', at: 1, coins: 1, detail: 'old' }, { key: 'old-b', kind: 'usage', at: 2, coins: 1, detail: 'old' }]
  const migrated = migratePetState(state)
  assert.equal(migrated.receipts.length, 1)
  assert.equal(migrated.wallet.balance, 2)
  assert.equal(migrated.usage.host.totalTokens, 20000)
  migrated.receipts.push(...Array.from({ length: 2500 }, (_, index) => ({ key: `old-feed-${index}`, kind: 'feed', at: index, coins: 0, detail: 'x'.repeat(250) })))
  const adapter = memory(migrated), store = new PetStore(adapter)
  await assert.rejects(store.execute({ type: 'settings', value: {} }, 'new'), /空间不足/)
  assert.equal(adapter.writes(), 0)
})
