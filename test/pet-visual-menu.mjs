import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle = await build({ stdin: { contents: `export { petVisualMenu } from './src/pet-visual-menu.ts'; export { PET_CATALOG } from './src/pet-catalog.ts'`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false })
const { petVisualMenu, PET_CATALOG } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function assertPublicMenu(items) {
  assert.ok(items.length <= 20)
  assert.equal(new Set(items.map(item => item.id)).size, items.length)
  for (const item of items) {
    assert.ok(item.id.trim() && item.id.length <= 100)
    assert.ok(item.label.trim() && item.label.length <= 200)
    assert.ok(item.disabled === undefined || typeof item.disabled === 'boolean')
    assert.ok(Object.keys(item).every(key => ['id','label','disabled'].includes(key)))
  }
}
test('large food inventories remain within the public menu budget with a care-page escape hatch', () => {
  const foodInventory = Object.fromEntries(PET_CATALOG.filter(item => item.kind === 'food').map(item => [item.id, 99]))
  assert.ok(Object.keys(foodInventory).length > 13, 'regression covers a catalog that previously overflowed the 20-item menu')
  const menu = petVisualMenu({foodInventory,mainPetId:'pet:cat'},'pet:cat')
  assertPublicMenu(menu)
  assert.equal(menu.filter(item => item.id.startsWith('feed:')).length, 4)
  assert.equal(menu.find(item => item.id === 'pets').label, '更多喂食与照顾…')
  assert.equal(menu.find(item => item.id === 'main').disabled, true)
})
test('empty and sparse inventories only offer food that can actually be used', () => {
  const empty = petVisualMenu({foodInventory:{},mainPetId:'pet:cat'},'pet:dog')
  assertPublicMenu(empty)
  assert.equal(empty.filter(item => item.id.startsWith('feed:')).length, 0)
  assert.ok(empty.some(item => item.id === 'pets'))
  const sparse = petVisualMenu({foodInventory:{'food-snack':0,'food-meal':2},mainPetId:'pet:cat'},'pet:cat')
  assertPublicMenu(sparse)
  assert.deepEqual(sparse.filter(item => item.id.startsWith('feed:')), [{id:'feed:food-meal',label:'喂显存糯米团 · 2'}])
})
