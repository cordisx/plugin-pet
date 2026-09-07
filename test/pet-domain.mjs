import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle = await build({ stdin: { contents: `export * from './src/pet-domain.ts'; export * from './src/pet-store.ts'; export * from './src/pet-catalog.ts'`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false })
const { createPetState, applyPetCommand, settlePetUsage, migratePetState, PetStore, PET_CATALOG } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const tx = (key, now = 1000) => ({ key, now })
function credit(state, tokens) {
  state = settlePetUsage(state, { sourceId: 'test-authoritative', totalTokens: 0 }, tx('baseline')).state
  return settlePetUsage(state, { sourceId: 'test-authoritative', totalTokens: tokens }, tx('usage')).state
}
function memoryAdapter(initial = null) {
  let value = initial
  let revision = 0
  return {
    async load() { return { value: structuredClone(value), revision: value === null ? null : String(revision) } },
    async compareAndSwap(expected, next) {
      if (expected !== (value === null ? null : String(revision))) return false
      value = structuredClone(next); revision++; return true
    },
  }
}
test('free welcome contents permit appearance, feeding and a second pet without token income', () => {
  let state = createPetState()
  assert.equal(state.wallet.balance, 0)
  assert.equal(state.ownedSkinIds.length, 2)
  for (let i = 0; i < 3; i++) state = applyPetCommand(state, { type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, tx(`feed-${i}`)).state
  state = applyPetCommand(state, { type: 'claim', productId: 'pet-dog' }, tx('claim')).state
  assert.equal(state.pets.length, 2)
  assert.equal(state.pets[0].affinity, 6)
  assert.equal(state.pets[1].affinity, 0)
  assert.equal(state.wallet.balance, 0)
  assert.throws(() => applyPetCommand(state, { type: 'claim', productId: 'pet-dog' }, tx('again')), /已拥有/)
})
test('purchase is immutable, atomic, deduplicated and permanent goods cannot be bought twice', () => {
  const initial = credit(createPetState(), 2_000_000)
  const bought = applyPetCommand(initial, { type: 'buy', productId: 'pet-dog' }, tx('buy'))
  assert.equal(initial.wallet.balance, 200)
  assert.equal(bought.state.wallet.balance, 50)
  assert.equal(bought.state.pets.length, 2)
  assert.equal(applyPetCommand(bought.state, { type: 'buy', productId: 'pet-dog' }, tx('buy')).duplicate, true)
  assert.throws(() => applyPetCommand(bought.state, { type: 'buy', productId: 'pet-dog' }, tx('other')), /已拥有/)
  assert.throws(() => applyPetCommand(bought.state, { type: 'buy', productId: 'pet-rabbit' }, tx('rabbit')), /不足/)
  assert.equal(bought.state.wallet.balance, 50)
  assert.equal(bought.state.pets.length, 2)
})
test('skins require ownership and compatible species', () => {
  let state = credit(createPetState(), 2_000_000)
  assert.throws(() => applyPetCommand(state, { type: 'equip', petId: 'pet:cat', skinId: 'skin-siamese' }, tx('no')), /解锁/)
  state = applyPetCommand(state, { type: 'buy', productId: 'pet-dog' }, tx('dog')).state
  assert.throws(() => applyPetCommand(state, { type: 'equip', petId: 'pet:cat', skinId: 'skin-shiba' }, tx('wrong')), /不适用/)
  state = applyPetCommand(state, { type: 'equip', petId: 'pet:cat', skinId: 'skin-orange' }, tx('orange')).state
  assert.equal(state.pets[0].skinId, 'skin-orange')
})
test('usage baseline excludes history, carries fractional new tokens and refuses rollback', () => {
  let state = settlePetUsage(createPetState(), { sourceId: 'host', totalTokens: 9999 }, tx('base')).state
  state = settlePetUsage(state, { sourceId: 'host', totalTokens: 10000 }, tx('one')).state
  assert.equal(state.wallet.balance, 0)
  state = settlePetUsage(state, { sourceId: 'host', totalTokens: 19999 }, tx('next')).state
  assert.equal(state.wallet.balance, 1)
  const unchanged = settlePetUsage(state, { sourceId: 'host', totalTokens: 19999 }, tx('refresh')).state
  assert.equal(unchanged.wallet.balance, 1)
  assert.throws(() => settlePetUsage(state, { sourceId: 'host', totalTokens: 1 }, tx('rollback')), /回退/)
})
test('two windows cannot double spend or double issue a receipt', async () => {
  const adapter = memoryAdapter(credit(createPetState(), 50_000))
  const a = new PetStore(adapter), b = new PetStore(adapter)
  const outcomes = await Promise.allSettled([
    a.execute({ type: 'buy', productId: 'food-snack' }, 'a'),
    b.execute({ type: 'buy', productId: 'food-snack' }, 'b'),
  ])
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal((await a.read()).wallet.balance, 0)
  assert.equal((await a.read()).foodInventory['food-snack'], 4)
  const adapter2 = memoryAdapter()
  const c = new PetStore(adapter2), d = new PetStore(adapter2)
  const results = await Promise.all([c.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'same'), d.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'same')])
  assert.equal(results.filter(item => item.duplicate).length, 1)
  assert.equal((await c.read()).pets[0].affinity, 2)
})
test('real usage settlement remains disabled unless trusted adapter is explicitly attached', async () => {
  const store = new PetStore(memoryAdapter())
  await assert.rejects(store.settleUsage({ sourceId: 'host', totalTokens: 100000 }, 'usage'), /尚未接入/)
  assert.equal((await store.read()).wallet.balance, 0)
})
test('interaction cooldown and daily limit prevent click farming with no absence penalty', () => {
  let state = createPetState()
  for (let i = 0; i < 30; i++) state = applyPetCommand(state, { type: 'interact', petId: 'pet:cat' }, tx(`i${i}`, 1000 + i * 60000)).state
  assert.equal(state.pets[0].affinity, 10)
  state = applyPetCommand(state, { type: 'interact', petId: 'pet:cat' }, tx('month-later', 32 * 86400000)).state
  assert.equal(state.pets[0].affinity, 11)
  state = applyPetCommand(state, { type: 'interact', petId: 'pet:cat' }, tx('same-time', 32 * 86400000)).state
  assert.equal(state.pets[0].affinity, 11)
})
test('position, visibility and active selection preserve stable identities', () => {
  let state = credit(createPetState(), 4_000_000)
  state = applyPetCommand(state, { type: 'buy', productId: 'pet-dog' }, tx('dog')).state
  state = applyPetCommand(state, { type: 'setActive', petIds: ['pet:cat', 'pet:dog'] }, tx('active')).state
  state = applyPetCommand(state, { type: 'move', petId: 'pet:dog', x: 2 }, tx('move')).state
  state = applyPetCommand(state, { type: 'setMain', petId: 'pet:dog' }, tx('main')).state
  state = applyPetCommand(state, { type: 'settings', value: { visible: false } }, tx('hide')).state
  assert.equal(state.pets[1].x, 1)
  assert.equal(state.mainPetId, 'pet:dog')
  assert.equal(state.activePetIds.length, 2)
  assert.throws(() => applyPetCommand(state, { type: 'setActive', petIds: ['pet:cat', 'pet:cat'] }, tx('duplicate')), /重复/)
  assert.throws(() => applyPetCommand(state, { type: 'settings', value: { maxActivePets: 1 } }, tx('reduce')), /减少/)
  assert.deepEqual(migratePetState(state), state)
})
test('corrupt economy and future versions fail closed rather than silently reset', () => {
  assert.equal(migratePetState(null).pets.length, 1)
  assert.throws(() => migratePetState({ ...createPetState(), version: 2 }), /版本/)
  const bad = createPetState(); bad.wallet.balance = 100
  assert.throws(() => migratePetState(bad), /账目/)
})
test('catalog palettes exist in the installed Avatar public catalog', async () => {
  const { AVATAR_PALETTES } = await import('@oneworks/avatar')
  for (const skin of PET_CATALOG.filter(item => item.kind === 'skin')) assert.ok(AVATAR_PALETTES.some(item => item.id === skin.paletteId), skin.paletteId)
})

test('high-frequency preferences use bounded receipts without evicting financial idempotency', () => {
  let state = applyPetCommand(createPetState(), { type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, tx('feed-forever')).state
  for (let index = 0; index < 500; index++) state = applyPetCommand(state, { type: 'move', petId: 'pet:cat', x: index % 10 / 10 }, tx(`move-${index}`)).state
  assert.equal(state.receipts.length, 1)
  assert.equal(state.recentReceipts.length, 128)
  const retried = applyPetCommand(migratePetState(state), { type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, tx('feed-forever', 999999))
  assert.equal(retried.duplicate, true)
  assert.equal(retried.state.foodInventory['food-snack'], 2)
  assert.equal(retried.state.pets[0].affinity, 2)
})
test('early v1 receipts migrate to economic ledger and bounded preference cache', () => {
  const state = createPetState()
  delete state.recentReceipts
  state.receipts = Array.from({ length: 300 }, (_, index) => ({ key: `old-${index}`, kind: 'move', at: index, coins: 0, detail: 'move' }))
  state.receipts.unshift({ key: 'old-feed', kind: 'feed', at: 0, coins: 0, detail: '猫猫 · 小点心' })
  const migrated = migratePetState(state)
  assert.equal(migrated.receipts[0].key, 'old-feed')
  assert.equal(migrated.recentReceipts.length, 128)
  assert.equal(migrated.recentReceipts.at(-1).key, 'old-299')
})
test('malformed snapshots never trigger a replacement write', async () => {
  const cases = [
    { ...createPetState(), wallet: { balance: 5, earned: 5, spent: 0 } },
    { ...createPetState(), foodInventory: [] },
    { ...createPetState(), usage: { '__proto__': null, fake: { totalTokens: 1, rewardedCoins: -1, remainderTokens: 0 } } },
    { ...createPetState(), receipts: [null] },
    { ...createPetState(), recentReceipts: [{ key: 'fake', kind: 'move', at: 0, coins: 100, detail: 'bad' }] },
  ]
  for (const value of cases) {
    let writes = 0
    const store = new PetStore({ load: async () => ({ revision: '1', value }), compareAndSwap: async () => { writes++; return true } })
    await assert.rejects(store.execute({ type: 'settings', value: {} }, 'must-not-write'))
    assert.equal(writes, 0)
  }
})
test('CAS exhaustion surfaces failure and an uncertain committed retry remains idempotent', async () => {
  let attempts = 0
  const store = new PetStore({ load: async () => ({ revision: null, value: null }), compareAndSwap: async () => { attempts++; return false } })
  await assert.rejects(store.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'busy'), /其他窗口/)
  assert.equal(attempts, 12)
  const memory = memoryAdapter()
  let first = true
  const uncertain = new PetStore({ load: memory.load, compareAndSwap: async (...args) => {
    const result = await memory.compareAndSwap(...args)
    if (first) { first = false; throw new Error('response lost after commit') }
    return result
  } })
  await assert.rejects(uncertain.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'same-retry'), /response lost/)
  const result = await uncertain.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'same-retry')
  assert.equal(result.duplicate, true)
  assert.equal((await uncertain.read()).foodInventory['food-snack'], 2)
})
