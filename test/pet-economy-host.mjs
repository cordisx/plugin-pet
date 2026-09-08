import { build } from 'esbuild'
import assert from 'node:assert/strict'
import test from 'node:test'
const bundle = await build({
  entryPoints: ['src/pet-economy-host.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { petHostTransport, petEconomyConnector } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
const connection = {
  contract: 'cordisx.http-connection/v1',
  id: 'opaque-handle',
  origin: 'https://economy.test',
  credential: 'bearer',
}
test('SDK transport uses only the public authorized handle, allowed headers, deadline and cancellation', async () => {
  const requests = [], lifetime = new AbortController()
  const http = {
    request: async request => {
      requests.push(request)
      return { status: 'accepted', value: { statusCode: 200, body: '{}', contentType: 'application/json' } }
    },
  }
  const transport = petHostTransport(http, connection, lifetime.signal)
  const before = Date.now()
  assert.deepEqual(
    await transport({
      method: 'POST',
      url: 'https://economy.test/v1/orders',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'stable-request' },
      body: '{}',
    }),
    { status: 200, body: '{}' },
  )
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].headers, { 'content-type': 'application/json', 'idempotency-key': 'stable-request' })
  assert.equal(requests[0].connection, connection)
  assert.equal(requests[0].path, '/v1/orders')
  assert.ok(requests[0].deadline >= before && requests[0].deadline <= Date.now() + 30000)
  lifetime.abort()
  assert.equal(requests[0].signal.aborted, true)
  await assert.rejects(transport({ method: 'GET', url: 'https://attacker.test/v1/me', headers: {} }), /超出/)
  await assert.rejects(
    transport({ method: 'GET', url: 'https://economy.test/v1/me', headers: { Authorization: 'never-allowed' } }),
    /头部/,
  )
  assert.equal(requests.length, 1)
})
test('connection is an explicit Host consent action and a generation disposal aborts every SDK request', async () => {
  let authorizations = 0, last
  const http = {
    authorize: async input => {
      authorizations++
      assert.deepEqual(input, { origin: connection.origin, credential: 'bearer' })
      return { status: 'accepted', value: connection }
    },
    request: async input => {
      last = input
      return {
        status: 'accepted',
        value: {
          statusCode: 200,
          body: JSON.stringify({ instanceId: 'one', accountId: 'alice', available: 9, reserved: 0 }),
        },
      }
    },
    revoke: async () => ({ status: 'accepted', value: null }),
  }
  const connect = petEconomyConnector(http, {
    economyBaseUrl: 'https://economy.test',
    migrationSourceId: 'permanent-source',
  })
  assert.equal(authorizations, 0)
  const result = await connect()
  assert.deepEqual(result.binding, { instanceId: 'one', accountId: 'alice' })
  assert.equal(result.sourceId, 'permanent-source')
  assert.equal(authorizations, 1)
  assert.doesNotMatch(JSON.stringify(result), /opaque-handle|secret|token/)
  result.dispose()
  assert.equal(last.signal.aborted, true)
  assert.equal(petEconomyConnector(undefined, {}), undefined)
})
test('denied, stale and invalid endpoint errors remain explicit without a fallback fetch or token field', async () => {
  let calls = 0
  const http = {
    authorize: async () => {
      calls++
      return { status: 'unavailable', code: 'denied' }
    },
  }
  await assert.rejects(petEconomyConnector(http, { economyBaseUrl: 'https://economy.test' })(), /denied/)
  await assert.rejects(petEconomyConnector(http, { economyBaseUrl: 'http://unsafe.test' })(), /HTTPS/)
  assert.equal(calls, 1)
  const transport = petHostTransport(
    { request: async () => ({ status: 'unavailable', code: 'stale-generation' }) },
    connection,
    new AbortController().signal,
  )
  await assert.rejects(
    transport({ method: 'GET', url: connection.origin + '/v1/me', headers: {} }),
    /stale-generation.*原事务保留/,
  )
})
