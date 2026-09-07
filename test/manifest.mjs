import assert from 'node:assert/strict'
import test from 'node:test'
let visualDefinitions = 0
globalThis.__cordisxSharedReactRuntime = { React: {}, defineReactVisual: component => { visualDefinitions++; return component } }
const { apply, inject, manifest } = await import('../dist/runtime/module.js')
test('declares exact controlled render and optional pointer capabilities', () => {
  assert.equal(manifest.schemaVersion, 10)
  assert.equal(manifest.id, 'plugin-composer-animal')
  assert.deepEqual(manifest.capabilities.map(item => item.name), ['ui.extension-points.render', 'ui.extension-points.interact'])
  assert.deepEqual(inject, ['extensionPointVisuals'])
})
test('activation only registers lazy loaders and does not evaluate visual code', () => {
  const registered = []
  apply({ extensionPointVisuals: { register: (declaration, load) => { registered.push({ declaration, load }); return () => {} } } })
  assert.deepEqual(registered.map(item => item.declaration.pointId), ['composer.primary-action.visual', 'composer.frame.overlay'])
  assert.ok(registered.every(item => typeof item.load === 'function'))
  assert.ok(registered.every(item => item.declaration.events?.includes('pointer.observe')))
  assert.deepEqual(manifest.capabilities[1].scope.extensionPoints, registered.map(item => item.declaration.pointId))
  assert.equal(visualDefinitions, 0)
})
