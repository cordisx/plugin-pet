import { build } from 'esbuild'
import assert from 'node:assert/strict'
import test from 'node:test'
const bundle = await build({
  stdin: {
    contents:
      `export * from './src/pet-domain.ts'; export * from './src/pet-store.ts'; export * from './src/pet-economy-journal.ts'; export * from './src/pet-purchase.ts'`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const {
  createPetState,
  migratePetState,
  settlePetUsage,
  applyPetCommand,
  PetStore,
  PetEconomyJournal,
  petSnapshotHash,
  petMerchantCatalog,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const binding = { instanceId: 'isolated-test-instance', accountId: 'alice' }
function fixture(initial = createPetState()) {
  let value = structuredClone(initial), revision = 1, fail = false
  const files = new Map()
  const storage = {
    load: async () => ({ value: structuredClone(value), revision: String(revision) }),
    compareAndSwap: async (expected, next) => {
      if (fail) throw new Error('offline local storage')
      if (expected !== String(revision)) return false
      value = structuredClone(next)
      revision++
      return true
    },
  }
  const backups = {
    create: async (id, backup) => {
      if (!files.has(id)) files.set(id, structuredClone(backup))
    },
    load: async id => structuredClone(files.get(id)),
  }
  return {
    storage,
    backups,
    files,
    read: () => structuredClone(value),
    fail: next => {
      fail = next
    },
    journal: new PetEconomyJournal(storage, backups, () => 1000),
  }
}
function legacy() {
  let state =
    settlePetUsage(createPetState(), { sourceId: 'historical', totalTokens: 0 }, { key: 'base', now: 0 }).state
  state = settlePetUsage(state, { sourceId: 'historical', totalTokens: 10_000_000 }, { key: 'income', now: 1 }).state
  state = applyPetCommand(state, { type: 'buy', productId: 'item-auto-feeder' }, { key: 'device', now: 2 }).state
  state = applyPetCommand(state, { type: 'rename', petId: 'pet:cat', name: '保留名字' }, { key: 'name', now: 3 }).state
  return state
}
async function migrate(f) {
  const pending = await f.journal.prepareMigration(binding, 'pet-approved-v1', 'https://economy.test/v1')
  await f.journal.completeMigration(binding, pending.economy.migration.key, 'isolated-import-receipt')
}
function receipt(state, orderId = 'server-order-1') {
  const { key, command, itemId, quantity, total, at } = state.economy.pending
  return { key, command, itemId, quantity, total, at, orderId }
}
test('migration preserves the exact raw document in a create-only verified backup', async () => {
  const original = legacy()
  delete original.pets[0].sex // early v1 compatibility must not rewrite the backup
  const f = fixture(original)
  const pending = await f.journal.prepareMigration(binding, 'pet-approved-v1', 'https://economy.test/v1')
  assert.equal(pending.version, 2)
  assert.equal(pending.economy.migration.status, 'pending')
  assert.deepEqual(f.files.get(pending.economy.migration.backupDocumentId).value, original)
  assert.equal(pending.economy.migration.snapshotHash, await petSnapshotHash(original))
  assert.deepEqual(pending.wallet, original.wallet)
  const store = new PetStore(f.storage)
  await assert.rejects(store.execute({ type: 'feed', petId: 'pet:cat', foodId: 'food-snack' }, 'frozen'), /待对账/)
  await f.journal.completeMigration(binding, pending.economy.migration.key, 'approved-receipt')
  const actual = f.read()
  delete actual.economy
  actual.version = 1
  assert.deepEqual(actual, migratePetState(original))
  await assert.rejects(
    f.journal.prepareMigration({ ...binding, accountId: 'mallory' }, 'pet-approved-v1', 'https://economy.test/v1'),
    /不匹配/,
  )
  await assert.rejects(f.journal.prepareMigration(binding, 'another-source', 'https://economy.test/v1'), /重复导入/)
  const repeated = await f.journal.prepareMigration(binding, 'pet-approved-v1', 'https://economy.test/v1')
  assert.equal(repeated.economy.migration.receiptId, 'approved-receipt')
  assert.equal(f.files.size, 1)
})
test('corrupt legacy economy or corrupt backup refuses authority switch without replacing data', async () => {
  const original = legacy()
  original.wallet.balance++
  const invalid = fixture(original)
  await assert.rejects(invalid.journal.prepareMigration(binding, 'source', 'https://economy.test/v1'), /账目/)
  assert.deepEqual(invalid.read(), original)
  assert.equal(invalid.files.size, 0)
  const f = fixture(legacy())
  f.backups.load = async () => ({ snapshotHash: 'f'.repeat(64), value: {} })
  await assert.rejects(f.journal.prepareMigration(binding, 'source', 'https://economy.test/v1'), /备份校验失败/)
  assert.equal(f.read().version, 1)
})
test('purchase is journaled before remote work, failed local delivery resumes after reload exactly once', async () => {
  const f = fixture(legacy())
  await migrate(f)
  const wallet = f.read().wallet, initial = f.read().foodInventory['food-snack']
  const state = await f.journal.preparePurchase(
    binding,
    { type: 'buy', productId: 'food-snack', quantity: 3 },
    'purchase-1',
  )
  const delivered = receipt(state)
  assert.equal(f.read().foodInventory['food-snack'], initial)
  f.fail(true)
  await assert.rejects(f.journal.completePurchase(binding, delivered), /offline/)
  assert.equal(f.read().economy.pending.key, 'purchase-1')
  f.fail(false)
  const reload = new PetEconomyJournal(f.storage, f.backups)
  await Promise.all([reload.completePurchase(binding, delivered), f.journal.completePurchase(binding, delivered)])
  assert.equal(f.read().foodInventory['food-snack'], initial + 3)
  assert.equal(f.read().economy.receipts.length, 1)
  assert.equal(f.read().economy.pending, undefined)
  assert.deepEqual(f.read().wallet, wallet)
  assert.deepEqual(migratePetState(f.read()), f.read())
  await assert.rejects(reload.completePurchase(binding, { ...delivered, total: 999 }), /不一致/)
})
test('pending purchase blocks competing local changes and shared mode cannot spend legacy balance', async () => {
  const f = fixture(legacy())
  await migrate(f)
  const store = new PetStore(f.storage, { trustedUsageEnabled: true })
  await assert.rejects(store.execute({ type: 'buy', productId: 'food-snack' }, 'bypass'), /共享购买/)
  await assert.rejects(store.settleUsage({ sourceId: 'historical', totalTokens: 99_000_000 }, 'mint'), /铸币/)
  await f.journal.preparePurchase(binding, { type: 'adopt', species: 'cat' }, 'adopt-1')
  await assert.rejects(store.execute({ type: 'carePulse', elapsedMs: 60000 }, 'pulse'), /待对账/)
  await assert.rejects(f.journal.preparePurchase(binding, { type: 'adopt', species: 'cat' }, 'adopt-2'), /上一笔/)
  await f.journal.completePurchase(binding, receipt(f.read()))
  assert.equal(f.read().pets.length, 2)
  assert.equal(f.read().pets[1].id, 'pet:cat:2')
})
test('permanent goods and upgrades preflight before an intent exists; catalogue includes all SKUs', async () => {
  const f = fixture(legacy())
  await migrate(f)
  await assert.rejects(
    f.journal.preparePurchase(binding, { type: 'buy', productId: 'item-auto-feeder' }, 'duplicate'),
    /已拥有/,
  )
  assert.equal(f.read().economy.pending, undefined)
  const state = await f.journal.preparePurchase(binding, { type: 'device-upgrade', device: 'feeder' }, 'upgrade-1')
  assert.equal(state.economy.pending.itemId, 'upgrade-feeder-2')
  await f.journal.completePurchase(binding, receipt(state))
  assert.equal(f.read().devices.feederLevel, 2)
  assert.equal(f.read().devices.foodQueue.length, 0)
  const catalog = petMerchantCatalog()
  assert.ok(catalog.length > 200)
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length)
  assert.ok(catalog.every(item => Number.isSafeInteger(item.price) && item.price >= 0 && item.namespace === 'pet'))
})
test('oversized fulfilment rejects before journaling and wrong receipts never release the lock', async () => {
  const f = fixture(legacy())
  await migrate(f)
  await f.journal.preparePurchase(binding, { type: 'buy', productId: 'food-snack' }, 'purchase')
  const valid = receipt(f.read())
  await assert.rejects(f.journal.completePurchase(binding, { ...valid, itemId: 'food-chicken' }), /不一致/)
  await assert.rejects(f.journal.completePurchase({ ...binding, instanceId: 'another' }, valid), /不匹配/)
  assert.equal(f.read().economy.pending.key, 'purchase')
  const large = legacy()
  large.receipts.push(
    ...Array.from(
      { length: 2000 },
      (_, i) => ({ key: `old-${i}`, kind: 'feed', at: i, coins: 0, detail: 'x'.repeat(256) }),
    ),
  )
  const oversized = fixture(large)
  await assert.rejects(oversized.journal.prepareMigration(binding, 'source', 'https://economy.test/v1'), /空间不足/)
  assert.equal(oversized.files.size, 0)
})
