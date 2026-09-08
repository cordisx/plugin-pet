import assert from 'node:assert/strict'
import test from 'node:test'
let visualDefinitions = 0
globalThis.__cordisxSharedReactRuntime = { React: {}, jsxRuntime: {}, ui: {}, defineReactPage: component => component, defineReactVisual: component => { visualDefinitions++; return component } }
const { apply, inject, manifest } = await import('../dist/runtime/module.js')
test('declares exact controlled render and optional pointer capabilities', () => {
  assert.equal(manifest.schemaVersion, 11)
  assert.equal(manifest.id, 'plugin-composer-animal')
  assert.deepEqual(manifest.capabilities.map(item => item.name), ['usage.read', 'ui.extension-points.render', 'ui.extension-points.interact'])
  assert.deepEqual(manifest.capabilities[0], { name: 'usage.read', required: false, scope: { profile: 'current' } })
  assert.deepEqual(inject, ['extensionPointVisuals', 'documents', 'pages', 'routes', 'slots', 'managerContent', 'usage', 'http'])
})
test('activation registers lazy visuals after loading; hiding and disposal restore native seats', async () => {
  const registered = []
  const cleanups = [], pages = [], routes = [], navigation = []
  let update, value, revision = 0, disposed = 0, stopped = false, usageReads = 0, usageStopped = false
  apply({
    effect: effect => { cleanups.push(effect()) },
    usage: {
      read: async () => { usageReads++; return { schemaVersion: 1, status: 'unavailable', reason: 'permission-denied', diagnostics: [] } },
      subscribe: () => () => { usageStopped = true },
    },
    documents: {
      load: async () => value ? { status: 'loaded', snapshot: { revision, value } } : { status: 'missing' },
      transaction: async request => { value = request.value; return { status: 'accepted', snapshot: { revision: ++revision, value } } },
      subscribe: (_id, callback) => { update = callback; return () => { stopped = true } },
    },
    pages: { register: page => pages.push(page) }, routes: { register: route => routes.push(route), navigate: async () => {} },
    slots: { register: () => {} }, managerContent: { register: item => navigation.push(item) },
    extensionPointVisuals: { register: (declaration, load) => { registered.push({ declaration, load }); return () => { disposed++ } } },
  })
  assert.equal(registered.length, 0)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pages.length, 8)
  assert.equal(routes.length, 8)
  assert.ok([...pages, ...routes].every(item => item.title?.fallback && item.description?.fallback))
  assert.equal(navigation.filter(item => item.tabs?.length).length, 0)
  assert.equal(navigation.filter(item => item.parentRoute).length, 5)
  assert.deepEqual(registered.map(item => item.declaration.pointId), ['composer.primary-action.visual', 'composer.frame.overlay'])
  assert.ok(registered.every(item => typeof item.load === 'function'))
  assert.ok(registered.every(item => item.declaration.events?.includes('pointer.observe')))
  assert.deepEqual(manifest.capabilities[2].scope.extensionPoints, registered.map(item => item.declaration.pointId))
  assert.equal(visualDefinitions, 0)
  assert.equal(usageReads, 1)
  value = structuredClone(value); value.settings.visible = false
  update({ status: 'loaded', snapshot: { revision: ++revision, value } })
  assert.equal(disposed, 2)
  value = structuredClone(value); value.settings.visible = true
  update({ status: 'loaded', snapshot: { revision: ++revision, value } })
  assert.equal(registered.length, 4)
  for (const dispose of cleanups) dispose()
  assert.equal(disposed, 4)
  assert.equal(stopped, true)
  assert.equal(usageStopped, true)
})
