import { createEconomyServer, Economy } from '@cordisx/economy/server'
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
const bundle = await build({
  stdin: {
    contents:
      `export * from '@cordisx/economy/client'; export * from './src/pet-economy.ts'; export * from './src/pet-economy-journal.ts'; export * from './src/pet-domain.ts'; export * from './src/pet-purchase.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const {
  EconomyClient,
  bearerTransport,
  PetEconomy,
  PetEconomyJournal,
  createPetState,
  settlePetUsage,
  petMerchantCatalog,
  petSnapshotHash,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const binding = { instanceId: 'test-instance', accountId: 'alice' }
const sourceId = 'pet-migration-v1'
function documentStore(initial) {
  let value = structuredClone(initial), revision = 1, fail = false
  const backups = new Map()
  const storage = {
    load: async () => ({ value: structuredClone(value), revision: String(revision) }),
    compareAndSwap: async (expected, next) => {
      if (fail) throw new Error('isolated local write unavailable')
      if (expected !== String(revision)) return false
      value = structuredClone(next)
      revision++
      return true
    },
  }
  const backup = {
    create: async (key, value) => {
      if (!backups.has(key)) backups.set(key, structuredClone(value))
    },
    load: async key => structuredClone(backups.get(key)),
  }
  return {
    storage,
    backup,
    read: () => structuredClone(value),
    fail: value => {
      fail = value
    },
    backups,
  }
}
function oldWallet(coins) {
  const baseline =
    settlePetUsage(createPetState(), { sourceId: 'isolated-historical', totalTokens: 0 }, { key: 'baseline', now: 0 })
      .state
  return settlePetUsage(baseline, { sourceId: 'isolated-historical', totalTokens: coins * 10000 }, {
    key: 'income',
    now: 1,
  }).state
}
async function fixture(t, { initial = oldWallet(100), approve = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'pet-sdk-integration-'))
  const serverEconomy = new Economy(join(dir, 'ledger.sqlite'))
  serverEconomy.auth.createInstance(binding.instanceId, 10000)
  serverEconomy.auth.createAccount(binding.instanceId, 'alice')
  serverEconomy.auth.createAccount(binding.instanceId, 'bob')
  const tokens = Object.fromEntries(
    ['alice', 'bob'].map(
      account => [account, serverEconomy.auth.login(serverEconomy.auth.enrollment(binding.instanceId, account)).token],
    ),
  )
  const sponsor = serverEconomy.auth.createService(binding.instanceId, 'sponsor', '*', 1000).token
  const gameToken = serverEconomy.auth.createService(binding.instanceId, 'game', '*', 1000).token
  serverEconomy.commerce.createSource(binding.instanceId, sourceId, 'sponsor', 'migration', 5000, 1000, 1000)
  serverEconomy.commerce.createSource(binding.instanceId, 'test-initial', 'sponsor', 'reward', 1000, 1000, 1000)
  for (const item of petMerchantCatalog()) {
    serverEconomy.commerce.createItem(binding.instanceId, item.id, item.title, item.price, item.namespace)
  }
  const server = createEconomyServer(serverEconomy)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    serverEconomy.close()
    await rm(dir, { recursive: true, force: true })
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const sdkFor = token => new EconomyClient(baseUrl, bearerTransport(fetch, () => token))
  const sdk = sdkFor(tokens.alice), bob = sdkFor(tokens.bob), game = sdkFor(gameToken)
  await sdkFor(sponsor).grant(
    { sourceId: 'test-initial', accountId: 'bob', eventId: 'bob-test-grant', amount: 100 },
    'test-grant-bob',
  )
  if (approve && initial.wallet.balance > 0) {
    serverEconomy.commerce.entitlement(
      binding.instanceId,
      sourceId,
      await petSnapshotHash(initial),
      'alice',
      initial.wallet.balance,
    )
  }
  const doc = documentStore(initial),
    journal = new PetEconomyJournal(doc.storage, doc.backup, () => 1000),
    statuses = []
  const pet = new PetEconomy(sdk, journal, binding, sourceId, status => statuses.push(status))
  t.after(() => pet.dispose())
  return {
    serverEconomy,
    sdk,
    sdkFor,
    tokens,
    game,
    bob,
    doc,
    journal,
    statuses,
    pet,
    baseUrl,
    sponsor: sdkFor(sponsor),
  }
}
test('real SDK + HTTP + SQLite game settlement is spendable in Pet, replay never debits or delivers twice', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  const agreement = await f.game.createAgreement({
    matchId: 'pet-cross-plugin-match',
    game: { id: 'gomoku', version: '1.0.0', digest: 'a'.repeat(64), reviewStatus: 'unreviewed' },
    participants: [{ accountId: 'alice', amount: 100 }, { accountId: 'bob', amount: 100 }],
    settlementPolicy: {
      kind: 'enumerated',
      outcomes: [{ id: 'alice-wins', payouts: [{ accountId: 'alice', amount: 200 }] }],
    },
    expiresAt: Date.now() + 60000,
  }, 'test-create-match')
  await f.sdk.reserve({ agreementId: agreement.id, termsHash: agreement.termsHash }, 'test-reserve-alice')
  await f.bob.reserve({ agreementId: agreement.id, termsHash: agreement.termsHash }, 'test-reserve-bob')
  await f.game.settle(
    { agreementId: agreement.id, termsHash: agreement.termsHash, outcomeId: 'alice-wins' },
    'test-game-settlement',
  )
  assert.equal((await f.sdk.me()).available, 200)
  const command = { type: 'buy', productId: 'item-auto-feeder' }
  await f.pet.purchase(command, 'pet-buy-device-1')
  assert.equal(f.doc.read().itemInventory['item-auto-feeder'], 1)
  assert.equal((await f.sdk.me()).available, 20)
  assert.equal(f.statuses.at(-1).wallet.available, 20)
  await f.pet.purchase(command, 'pet-buy-device-1')
  await f.pet.refresh()
  assert.equal((await f.sdk.orders()).length, 1)
  assert.equal((await f.sdk.me()).available, 20)
  assert.equal(f.doc.read().economy.receipts.length, 1)
  assert.equal(f.doc.read().wallet.balance, 100) // untouched legacy audit, not spendable
  await assert.rejects(f.pet.purchase(command, 'pet-buy-device-2'), /已拥有/)
  await assert.rejects(
    f.sdk.claim({ sourceId, entitlementId: f.doc.read().economy.migration.snapshotHash }, 'new-migration-key'),
    error => error.code === 'MIGRATION_CONSUMED',
  )
  f.serverEconomy.store.assertConservation(binding.instanceId)
})
test('lost purchase response and offline local delivery reconcile the same receipt after reload', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  let drop = true
  const transport = bearerTransport(fetch, () => f.tokens.alice)
  const interrupted = new EconomyClient(f.baseUrl, async request => {
    const result = await transport(request)
    if (drop && request.method === 'POST' && request.url.endsWith('/orders')) {
      drop = false
      throw new Error('response lost after commit')
    }
    return result
  })
  const disconnected = new PetEconomy(interrupted, f.journal, binding, sourceId, () => {})
  t.after(() => disconnected.dispose())
  const command = { type: 'buy', productId: 'food-snack', quantity: 2 }
  await assert.rejects(disconnected.purchase(command, 'pet-uncertain-order'), /response lost/)
  const afterDebit = (await f.sdk.me()).available
  assert.equal((await f.sdk.orders()).length, 1)
  assert.equal(f.doc.read().foodInventory['food-snack'], 3)
  disconnected.dispose()
  const reload = new PetEconomy(f.sdk, new PetEconomyJournal(f.doc.storage, f.doc.backup), binding, sourceId, () => {})
  t.after(() => reload.dispose())
  f.doc.fail(true)
  await assert.rejects(reload.refresh(), /local write unavailable/)
  assert.equal((await f.sdk.me()).available, afterDebit)
  f.doc.fail(false)
  await reload.purchase(command, 'new-ui-retry-key') // resumes saved key, not a new charge
  assert.equal(f.doc.read().foodInventory['food-snack'], 5)
  assert.equal(f.doc.read().economy.pending, undefined)
  assert.equal((await f.sdk.me()).available, afterDebit)
  assert.equal((await f.sdk.orders()).length, 1)
  await reload.refresh()
  assert.equal(f.doc.read().foodInventory['food-snack'], 5)
})
test('unapproved or wrong-account migration keeps original backup and authority pending', async t => {
  const f = await fixture(t, { approve: false })
  await assert.rejects(f.pet.migrate(), error => error.code === 'NOT_FOUND')
  assert.equal(f.doc.read().economy.migration.status, 'pending')
  assert.equal(f.doc.backups.size, 1)
  assert.equal((await f.sdk.me()).available, 0)
  const migration = f.doc.read().economy.migration
  f.serverEconomy.commerce.entitlement(binding.instanceId, sourceId, migration.snapshotHash, 'alice', 100)
  const wrong = new PetEconomy(f.bob, f.journal, binding, sourceId, () => {})
  t.after(() => wrong.dispose())
  await assert.rejects(wrong.refresh(), /身份/)
  await assert.rejects(
    f.bob.claim({ sourceId, entitlementId: migration.snapshotHash }, migration.key),
    error => error.code === 'NOT_FOUND',
  )
  await f.pet.refresh()
  assert.equal(f.doc.read().economy.migration.status, 'complete')
  assert.equal((await f.sdk.me()).available, 100)
})
test('zero old balance binds without a cloud grant and never claims unknown usage as assets', async t => {
  const f = await fixture(t, { initial: createPetState(), approve: false })
  await f.pet.migrate()
  assert.match(f.doc.read().economy.migration.receiptId, /^zero-balance:/)
  assert.equal((await f.sdk.me()).available, 0)
  assert.equal((await f.sdk.ledger()).length, 0)
  await f.pet.refresh()
  assert.equal((await f.sdk.me()).available, 0)
})
test('price disagreement fails before debit; disposal retains pending order for the next generation', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  await assert.rejects(
    f.sdk.purchase({ itemId: 'food-snack', quantity: 1, expectedTotal: 999 }, 'wrong-price-test'),
    error => error.code === 'PRICE_CHANGED',
  )
  assert.equal((await f.sdk.orders()).length, 0)
  let coordinator
  const transport = bearerTransport(fetch, () => f.tokens.alice)
  const sdk = new EconomyClient(f.baseUrl, async request => {
    const result = await transport(request)
    if (request.method === 'POST' && request.url.endsWith('/orders')) coordinator.dispose()
    return result
  })
  coordinator = new PetEconomy(sdk, f.journal, binding, sourceId, () => {})
  await assert.rejects(coordinator.purchase({ type: 'buy', productId: 'food-snack' }, 'disposed-order'), /关闭/)
  assert.ok(f.doc.read().economy.pending)
  await f.pet.refresh()
  assert.equal(f.doc.read().foodInventory['food-snack'], 4)
  assert.equal((await f.sdk.orders()).length, 1)
})
test('published Pet catalogue is the complete generated owner catalogue', async () => {
  const exported = JSON.parse(await readFile('economy/pet-catalog.json', 'utf8'))
  assert.deepEqual(exported, petMerchantCatalog())
})

test('free Pet SKU produces one durable receipt without changing the shared balance', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  const free = petMerchantCatalog().find(item => item.price === 0)
  const before = await f.sdk.me()
  const order = await f.sdk.purchase({ itemId: free.id, quantity: 1, expectedTotal: 0 }, 'free-pet-order')
  assert.equal(order.total, 0)
  assert.deepEqual(await f.sdk.purchase({ itemId: free.id, quantity: 1, expectedTotal: 0 }, 'free-pet-order'), order)
  assert.deepEqual(await f.sdk.me(), before)
  assert.equal((await f.sdk.orders()).length, 1)
})

test('a new Pet installation cannot replay an order belonging to the original store identity', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  const command = { type: 'buy', productId: 'food-snack' }
  await f.pet.purchase(command, 'original-store-order')
  const originalStore = f.doc.read().economy.storeId
  const order = (await f.sdk.orders())[0]
  assert.deepEqual(order.fulfillmentTarget, { namespace: 'pet', storeId: originalStore })
  const newDoc = documentStore(oldWallet(100))
  const fresh = new PetEconomy(f.sdk, new PetEconomyJournal(newDoc.storage, newDoc.backup), binding, sourceId, () => {})
  t.after(() => fresh.dispose())
  const before = (await f.sdk.me()).available
  await fresh.migrate() // same original digest/key is a historical replay, not another import
  assert.notEqual(newDoc.read().economy.storeId, originalStore)
  assert.equal((await f.sdk.me()).available, before)
  await assert.rejects(fresh.purchase(command, 'original-store-order'), error => error.code === 'IDEMPOTENCY_CONFLICT')
  assert.equal(newDoc.read().foodInventory['food-snack'], 3)
  assert.equal(newDoc.read().economy.receipts.length, 0)
  assert.equal((await f.sdk.orders()).length, 1)
})

test('endpoint identity cannot change even if another URL returns the same named account and instance', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  const transport = bearerTransport(fetch, () => f.tokens.alice)
  const alias = new EconomyClient(
    f.baseUrl + '/alias',
    request => transport({ ...request, url: request.url.replace('/alias/v1', '/v1') }),
  )
  const changed = new PetEconomy(alias, f.journal, binding, sourceId, () => {})
  t.after(() => changed.dispose())
  await assert.rejects(changed.purchase({ type: 'buy', productId: 'food-snack' }, 'changed-endpoint'), /地址/)
  assert.equal(f.doc.read().economy.pending, undefined)
  assert.equal((await f.sdk.orders()).length, 0)
})

test('a charged order with a mismatched authenticated target never releases local fulfilment', async t => {
  const f = await fixture(t)
  await f.pet.migrate()
  const transport = bearerTransport(fetch, () => f.tokens.alice)
  const altered = new EconomyClient(f.baseUrl, async request => {
    const response = await transport(request)
    if (request.method === 'GET' && /\/orders\//.test(request.url)) {
      const body = JSON.parse(response.body)
      return {
        ...response,
        body: JSON.stringify({ ...body, fulfillmentTarget: { namespace: 'pet', storeId: 'different-store' } }),
      }
    }
    return response
  })
  const guarded = new PetEconomy(altered, f.journal, binding, sourceId, () => {})
  t.after(() => guarded.dispose())
  await assert.rejects(guarded.purchase({ type: 'buy', productId: 'food-snack' }, 'target-check-order'), /收据/)
  assert.equal(f.doc.read().foodInventory['food-snack'], 3)
  assert.ok(f.doc.read().economy.pending)
  await f.pet.refresh()
  assert.equal(f.doc.read().foodInventory['food-snack'], 4)
  assert.equal((await f.sdk.orders()).length, 1)
})

test('a rejected request cannot erase the journal while another window commits that same key', async t => {
  const f = await fixture(t, { initial: createPetState(), approve: false })
  await f.pet.migrate()
  const transport = bearerTransport(fetch, () => f.tokens.alice)
  let committed, release, recovery
  const afterCommit = new Promise(resolve => {
    committed = resolve
  })
  const heldResponse = new Promise(resolve => {
    release = resolve
  })
  const recoveringSdk = new EconomyClient(f.baseUrl, async request => {
    const response = await transport(request)
    if (request.method === 'POST' && request.url.endsWith('/orders')) {
      committed()
      await heldResponse
    }
    return response
  })
  const recovering = new PetEconomy(recoveringSdk, f.journal, binding, sourceId, () => {})
  t.after(() => {
    recovering.dispose()
    release()
  })
  const failedSdk = new EconomyClient(f.baseUrl, async request => {
    const response = await transport(request)
    if (request.method === 'POST' && request.url.endsWith('/orders') && response.status === 409) {
      await f.sponsor.grant({
        sourceId: 'test-initial',
        accountId: 'alice',
        eventId: 'concurrent-test-funding',
        amount: 10,
      }, 'concurrent-fund-key')
      recovery = recovering.refresh()
      await afterCommit
    }
    return response
  })
  const failed = new PetEconomy(failedSdk, f.journal, binding, sourceId, () => {})
  t.after(() => failed.dispose())
  await assert.rejects(
    failed.purchase({ type: 'buy', productId: 'food-snack' }, 'concurrent-recovery-order'),
    error => error.code === 'INSUFFICIENT_FUNDS',
  )
  assert.ok(f.doc.read().economy.pending)
  release()
  await recovery
  assert.equal(f.doc.read().foodInventory['food-snack'], 4)
  assert.equal((await f.sdk.orders()).length, 1)
})
