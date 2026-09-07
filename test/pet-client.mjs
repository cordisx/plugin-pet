import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle = await build({ entryPoints: ['src/pet-client.ts'], bundle: true, format: 'esm', platform: 'node', write: false })
const { PetClient } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function documents() {
  let value, revision = 0, unavailable = false, commits = 0
  const listeners = new Set()
  const read = () => unavailable ? { status: 'unavailable', diagnostic: '存储暂不可用' }
    : value ? { status: 'loaded', snapshot: { revision, value: structuredClone(value) } } : { status: 'missing' }
  return {
    load: async () => read(),
    subscribe: (_id, listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    transaction: async request => {
      assert.equal(request.documentId, 'pet-system')
      assert.equal(request.contract, 'cordisx.owner-documents/v1')
      if (unavailable) return read()
      if (request.expectedRevision !== revision) return { status: 'conflict' }
      value = structuredClone(request.value); revision++; commits++
      const snapshot = read().snapshot
      // Deliberately defer notifications: initialization must also hydrate the CAS loser.
      return { status: 'accepted', snapshot }
    },
    emit: result => listeners.forEach(listener => listener(result ?? read())),
    unavailable: (next = true) => { unavailable = next },
    commits: () => commits,
    listenerCount: () => listeners.size,
  }
}
test('simultaneous initialization hydrates both windows without duplicating starter contents', async t => {
  const clock = fakeClock()
  const bridge = documents(), a = new PetClient(bridge, clock.runtime), b = new PetClient(bridge, clock.runtime)
  t.after(() => { a.dispose(); b.dispose() })
  await Promise.all([a.start(), b.start()])
  assert.equal(a.getSnapshot().state.foodInventory['food-snack'], 3)
  bridge.emit()
  assert.deepEqual(a.getSnapshot().state, b.getSnapshot().state)
  await Promise.all([a.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }), b.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' })])
  bridge.emit()
  assert.equal(a.getSnapshot().state.foodInventory['food-snack'], 1)
  assert.equal(b.getSnapshot().state.pets[0].affinity, 4)
  assert.equal(a.getSnapshot().busy, false)
  a.dispose(); b.dispose()
  assert.equal(bridge.listenerCount(), 0)
})
test('stale updates cannot roll back state; unavailable writes surface errors without consuming food', async t => {
  const clock = fakeClock()
  const bridge = documents(), client = new PetClient(bridge, clock.runtime)
  t.after(() => client.dispose())
  await client.start()
  const old = await bridge.load()
  await client.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' })
  bridge.emit(old)
  assert.equal(client.getSnapshot().state.foodInventory['food-snack'], 2)
  bridge.unavailable()
  await client.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' })
  assert.match(client.getSnapshot().error, /不可用/)
  assert.equal(client.getSnapshot().state.foodInventory['food-snack'], 2)
  assert.equal(client.getSnapshot().feedback.sequence, 1)
  client.dispose()
  const snapshot = client.getSnapshot()
  bridge.emit(old)
  await client.execute({ type: 'settings', value: { visible: false } })
  assert.equal(client.getSnapshot(), snapshot)
})

let nextRequestId = 0
function fakeClock() {
  let wall = 1000, monotonic = 0, timerId = 0
  const timers = new Map()
  return {
    runtime: {
      now: () => wall,
      monotonicNow: () => monotonic,
      randomId: () => `test-request-${++nextRequestId}`,
      setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
      clearTimeout: id => timers.delete(id),
    },
    pending: () => timers.size,
    async tick(wallMs = 60000, monotonicMs = wallMs) {
      wall += wallMs; monotonic += monotonicMs
      const due = [...timers.values()]; timers.clear()
      await Promise.all(due.map(callback => callback()))
    },
  }
}
test('online pulses run once per elapsed window and dispose removes all timers', async t => {
  const clock = fakeClock(), bridge = documents(), client = new PetClient(bridge, clock.runtime)
  t.after(() => client.dispose())
  await client.start(); await client.start()
  assert.equal(clock.pending(), 1)
  const initial = client.getSnapshot().state.pets[0].care.fullness
  await clock.tick()
  assert.ok(Math.abs(client.getSnapshot().state.pets[0].care.fullness - (initial - .1)) < 1e-8)
  assert.equal(clock.pending(), 1)
  client.dispose()
  assert.equal(clock.pending(), 0)
  const commits = bridge.commits()
  await clock.tick()
  assert.equal(bridge.commits(), commits)
})
test('system sleep is paused even when the monotonic clock does not include suspended time', async t => {
  const clock = fakeClock(), bridge = documents(), client = new PetClient(bridge, clock.runtime)
  t.after(() => client.dispose())
  await client.start()
  const initial = client.getSnapshot().state.pets[0].care.fullness
  await clock.tick(24 * 3600000, 60000)
  assert.equal(client.getSnapshot().state.pets[0].care.fullness, initial)
  await clock.tick(24 * 3600000)
  assert.equal(client.getSnapshot().state.pets[0].care.fullness, initial)
  await clock.tick()
  assert.ok(Math.abs(client.getSnapshot().state.pets[0].care.fullness - (initial - .1)) < 1e-8)
})
test('initial unavailable storage recovers automatically without accruing hunger debt', async t => {
  const clock = fakeClock(), bridge = documents(), client = new PetClient(bridge, clock.runtime)
  t.after(() => client.dispose())
  bridge.unavailable()
  await client.start()
  assert.match(client.getSnapshot().error, /不可用/)
  assert.equal(clock.pending(), 1)
  await clock.tick(12 * 3600000)
  assert.equal(client.getSnapshot().state, null)
  bridge.unavailable(false)
  await clock.tick()
  assert.equal(client.getSnapshot().state.pets[0].care.fullness, 80)
  assert.equal(client.getSnapshot().error, null)
  await clock.tick()
  assert.ok(client.getSnapshot().state.pets[0].care.fullness < 80)
})
test('a failed pulse reanchors on recovery and two clients do not double advance care', async t => {
  const clock = fakeClock(), bridge = documents(), a = new PetClient(bridge, clock.runtime), b = new PetClient(bridge, clock.runtime)
  t.after(() => { a.dispose(); b.dispose() })
  await Promise.all([a.start(), b.start()]); bridge.emit()
  await clock.tick(); bridge.emit()
  assert.ok(Math.abs(a.getSnapshot().state.pets[0].care.fullness - 79.9) < 1e-8)
  bridge.unavailable()
  await clock.tick()
  bridge.unavailable(false)
  await clock.tick(); bridge.emit()
  assert.ok(Math.abs(a.getSnapshot().state.pets[0].care.fullness - 79.9) < 1e-8)
  await clock.tick(); bridge.emit()
  assert.ok(Math.abs(a.getSnapshot().state.pets[0].care.fullness - 79.8) < 1e-8)
})
test('HMR replacement keeps one timer and a disposed pending startup cannot write', async t => {
  const clock = fakeClock(), bridge = documents(), old = new PetClient(bridge, clock.runtime)
  t.after(() => old.dispose())
  await old.start(); old.dispose()
  const replacement = new PetClient(bridge, clock.runtime)
  t.after(() => replacement.dispose())
  await replacement.start()
  assert.equal(clock.pending(), 1)
  assert.equal(bridge.listenerCount(), 1)
  const other = documents()
  let release
  const barrier = new Promise(resolve => { release = resolve })
  const pending = new PetClient({ ...other, load: async () => { await barrier; return other.load() } }, clock.runtime)
  const starting = pending.start()
  pending.dispose(); release(); await starting
  assert.equal(other.commits(), 0)
  assert.equal(other.listenerCount(), 0)
  assert.equal(clock.pending(), 1)
})
