import { bearerTransport, EconomyClient } from '@cordisx/economy/client'
import { createEconomyServer, Economy } from '@cordisx/economy/server'
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
const bundle = await build({
  stdin: {
    contents:
      `export * from './src/pet-work-rewards.ts'; export * from './src/pet-usage.ts'; export * from './src/pet-work-sponsor.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { PetWorkRewards, PetUsageController, readyWork, petWorkSponsorConnector } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
const snapshot = (eligibleTokens = 0, revision = 0, epoch = 'work-v2') => ({
  schemaVersion: 2,
  status: 'ready',
  policyId: 'codex-local-work-input-output-v2',
  classification: {
    version: 'host-game-cwd-v1',
    hostGameTasks: 'excluded',
    forksAndSubagents: 'excluded',
    unknownSources: 'excluded',
  },
  scopeId: 'test-profile',
  sourceId: 'test-work',
  epoch,
  revision,
  eligibleTokens,
  inputTokens: eligibleTokens,
  outputTokens: 0,
  enabledAt: 1,
  observedThrough: 1000 + revision,
  coverage: 'partial',
  diagnostics: [],
})
function memory() {
  let value = null, revision = 0, fail = false
  return {
    load: async () => ({ value: structuredClone(value), revision }),
    save: async (expected, next) => {
      if (fail) throw new Error('isolated local CAS unavailable')
      if (expected !== revision) return false
      value = structuredClone(next)
      revision++
      return true
    },
    read: () => structuredClone(value),
    fail: next => {
      fail = next
    },
  }
}
async function fixture(t, { daily = 100, budget = 100, storage = memory() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'pet-work-test-'))
  const economy = new Economy(join(dir, 'ledger.sqlite'))
  economy.auth.createInstance('work-test', 1000)
  economy.auth.createAccount('work-test', 'alice')
  const userToken = economy.auth.login(economy.auth.enrollment('work-test', 'alice')).token
  const token = economy.auth.createService('work-test', 'pet-sponsor', '*', 100).token
  economy.commerce.createSource('work-test', 'pet-work', 'pet-sponsor', 'reward', budget, daily, daily)
  const server = createEconomyServer(economy)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}`, transport = bearerTransport(fetch, () => token)
  const sdk = new EconomyClient(baseUrl, transport),
    user = new EconomyClient(baseUrl, bearerTransport(fetch, () => userToken))
  const identity = { baseUrl, instanceId: 'work-test', accountId: 'alice', sourceId: 'pet-work' }
  const statuses = [], rewards = new PetWorkRewards(storage, s => statuses.push(s))
  const sponsor = { sdk, identity, dispose() {} }
  rewards.connect(sponsor)
  t.after(async () => {
    rewards.dispose()
    await new Promise(r => server.close(r))
    economy.close()
    await rm(dir, { recursive: true, force: true })
  })
  return {
    economy,
    sdk,
    user,
    identity,
    storage,
    statuses,
    rewards,
    sponsor,
    transport,
    baseUrl,
    observe: (s, valid = () => true) => rewards.observe(s, identity, valid),
  }
}
test('v2 exact attribution uses a fresh baseline and original 10000:1 rate, preserving fractional future work', async t => {
  const f = await fixture(t)
  await f.observe(snapshot(900000, 10))
  assert.equal((await f.user.me()).available, 0)
  await f.observe(snapshot(909999, 11))
  assert.equal((await f.user.me()).available, 0)
  await f.observe(snapshot(910000, 12))
  assert.equal((await f.user.me()).available, 1)
  await f.observe(snapshot(940001, 13))
  assert.equal((await f.user.me()).available, 4)
  await f.observe(snapshot(940001, 13))
  assert.equal((await f.user.me()).available, 4)
  assert.equal(f.storage.read().remainder, 1)
  assert.equal(f.storage.read().earned, 4)
  f.economy.store.assertConservation('work-test')
})
test('missing sponsor, permission gap, new epoch and lower snapshots never backpay old usage', async t => {
  const f = await fixture(t), statuses = []
  const unconfigured = new PetWorkRewards(f.storage, s => statuses.push(s))
  await unconfigured.observe(snapshot(100000), f.identity, () => true)
  assert.equal(f.storage.read(), null)
  assert.equal(statuses.at(-1).status, 'unavailable')
  await f.observe(snapshot(100000, 1))
  f.rewards.pause()
  await f.observe(snapshot(900000, 2))
  assert.equal((await f.user.me()).available, 0)
  await f.observe(snapshot(910000, 3))
  assert.equal((await f.user.me()).available, 1)
  await f.observe(snapshot(1, 0))
  assert.equal(f.storage.read().cursor.tokens, 910000)
  await f.observe(snapshot(1000000, 4))
  assert.equal((await f.user.me()).available, 1)
  await f.observe(snapshot(5000000, 5, 'new-epoch'))
  assert.equal((await f.user.me()).available, 1)
  await f.observe(snapshot(5010000, 6, 'new-epoch'))
  assert.equal((await f.user.me()).available, 2)
  unconfigured.dispose()
})
test('source or daily budget exhaustion advances frontier without creating a pending debt', async t => {
  const f = await fixture(t, { daily: 1 })
  await f.observe(snapshot())
  await f.observe(snapshot(20000, 1))
  assert.equal((await f.user.me()).available, 0)
  assert.equal(f.storage.read().pending, undefined)
  assert.match(f.statuses.at(-1).reason, /额度不足/)
  await f.observe(snapshot(30000, 2))
  assert.equal((await f.user.me()).available, 1)
  await f.observe(snapshot(40000, 3))
  assert.equal((await f.user.me()).available, 1)
  assert.equal(f.storage.read().cursor.tokens, 40000)
})
test('response loss persists original event, reload replays once, and unresolved-period work is dropped', async t => {
  const f = await fixture(t)
  let drop = true
  const sdk = new EconomyClient(f.baseUrl, async request => {
    const result = await f.transport(request)
    if (drop && request.url.endsWith('/rewards/grant')) {
      drop = false
      throw new Error('response lost')
    }
    return result
  })
  f.rewards.connect({ ...f.sponsor, sdk })
  await f.observe(snapshot())
  await f.observe(snapshot(20000, 1))
  const event = f.storage.read().pending.eventId
  assert.equal((await f.user.me()).available, 2)
  f.rewards.dispose()
  const reloaded = new PetWorkRewards(f.storage, () => {})
  reloaded.connect(f.sponsor)
  t.after(() => reloaded.dispose())
  await reloaded.observe(snapshot(500000, 2), f.identity, () => true)
  assert.equal((await f.user.me()).available, 2)
  assert.equal(f.storage.read().lastEventId, event)
  await reloaded.observe(snapshot(600000, 3), f.identity, () => true)
  assert.equal((await f.user.me()).available, 2)
  await reloaded.observe(snapshot(610000, 4), f.identity, () => true)
  assert.equal((await f.user.me()).available, 3)
})
test('failed local receipt write recovers through same event without repeating cloud credit', async t => {
  const f = await fixture(t)
  const sdk = new EconomyClient(f.baseUrl, async request => {
    const result = await f.transport(request)
    if (request.url.endsWith('/rewards/grant')) f.storage.fail(true)
    return result
  })
  f.rewards.connect({ ...f.sponsor, sdk })
  await f.observe(snapshot())
  await f.observe(snapshot(10000, 1))
  assert.ok(f.storage.read().pending)
  assert.equal((await f.user.me()).available, 1)
  f.storage.fail(false)
  f.rewards.connect(f.sponsor)
  await f.observe(snapshot(10000, 1))
  assert.equal((await f.user.me()).available, 1)
  assert.equal(f.storage.read().pending, undefined)
})
test('multi-window CAS and successful event deduplication grant one reward for one interval', async t => {
  const f = await fixture(t), second = new PetWorkRewards(f.storage, () => {})
  second.connect(f.sponsor)
  t.after(() => second.dispose())
  await f.observe(snapshot())
  await second.observe(snapshot(), f.identity, () => true)
  await Promise.all([f.observe(snapshot(10000, 1)), second.observe(snapshot(10000, 1), f.identity, () => true)])
  assert.equal((await f.user.me()).available, 1)
  assert.equal(f.storage.read().earned, 1)
})
test('wrong wallet identity and user sponsor cannot grant or overwrite reward history', async t => {
  const f = await fixture(t)
  await f.observe(snapshot())
  const before = f.storage.read()
  await f.rewards.observe(snapshot(10000, 1), { ...f.identity, accountId: 'bob' }, () => true)
  assert.deepEqual(f.storage.read(), before)
  f.rewards.connect({ ...f.sponsor, sdk: f.user })
  await f.observe(snapshot(10000, 1))
  assert.equal((await f.user.me()).available, 0)
  assert.deepEqual(f.storage.read(), before)
})
test('disposal or invalidated generation during source read prevents grant and cursor writes', async t => {
  const f = await fixture(t)
  await f.observe(snapshot())
  let release, entered
  const held = new Promise(r => {
      release = r
    }),
    start = new Promise(r => {
      entered = r
    })
  const sdk = new EconomyClient(f.baseUrl, async request => {
    entered()
    await held
    return f.transport(request)
  })
  f.rewards.connect({ ...f.sponsor, sdk })
  const before = f.storage.read()
  const running = f.observe(snapshot(10000, 1))
  await start
  f.rewards.dispose()
  release()
  await running
  assert.deepEqual(f.storage.read(), before)
  assert.equal((await f.user.me()).available, 0)
})
test('public controller accepts only exact work classification and never calls profile v1 when v2 is present', async () => {
  let value = snapshot(), calls = 0, pauses = 0
  const usage = {
    read: () => {
      throw new Error('v1 must not be read')
    },
    readWork: async () => value,
    subscribe: () => () => {},
  }
  const controller = new PetUsageController(usage, () => {}, async () => {
    calls++
  }, () => {
    pauses++
  })
  await controller.start()
  assert.equal(calls, 1)
  for (
    const change of [
      { policyId: 'other' },
      { classification: { ...value.classification, unknownSources: 'included' } },
      { schemaVersion: 1 },
      { eligibleTokens: -1 },
    ]
  ) {
    value = { ...snapshot(), ...change }
    assert.equal(readyWork(value), false)
    await controller.refresh()
  }
  assert.equal(calls, 1)
  assert.equal(pauses, 4)
  controller.dispose()
})
test('sponsor connection is separate opaque service authorization with identity-checked readonly preflight', async t => {
  const f = await fixture(t), authorized = [], revoked = []
  const http = {
    authorize: async request => {
      authorized.push(request)
      return {
        status: 'accepted',
        value: {
          contract: 'cordisx.http-connection/v1',
          id: 'opaque-sponsor',
          origin: f.baseUrl,
          credential: 'bearer',
        },
      }
    },
    revoke: async value => {
      revoked.push(value)
    },
    request: async request => {
      const result = await f.transport({
        method: request.method,
        url: f.baseUrl + request.path,
        headers: request.headers,
        body: request.body,
      })
      return { status: 'accepted', value: { statusCode: result.status, body: result.body } }
    },
  }
  const connection = await petWorkSponsorConnector(http, 'pet-work')(f.identity)
  assert.deepEqual(connection.identity, f.identity)
  assert.equal(authorized.length, 1)
  connection.dispose()
  assert.equal(revoked.length, 1)
  await assert.rejects(petWorkSponsorConnector(http, 'pet-work')({ ...f.identity, instanceId: 'wrong' }), /同一实例/)
  assert.equal(revoked.length, 2)
})
