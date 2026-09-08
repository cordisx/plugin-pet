import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const result = await build({ entryPoints: ['src/pet-pages.tsx'], bundle: true, format: 'esm', platform: 'node', write: false, plugins: [{
  name: 'host-page-test', setup(builder) {
    builder.onResolve({ filter: /^(cordisx\/react(?:\/jsx-runtime)?|react(?:\/jsx-runtime)?)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path.replace('cordisx/', ''))).href, external: true }))
    builder.onResolve({ filter: /^cordisx\/ui$/ }, () => ({ path: 'ui', namespace: 'host-test' }))
    builder.onResolve({ filter: /^@oneworks\/avatar-react$/ }, () => ({ path: 'avatar', namespace: 'host-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'host-test' }, args => ({ contents: args.path === 'avatar'
      ? `import {createElement as h} from 'react'; export const Avatar=({definition,...props})=>h('div',{'aria-label':props['aria-label'],'data-avatar-preset':definition.scene.entity.preset})`
      : `import {createElement as h} from 'react'; export const Stack=({children})=>h('div',{},children); export const Card=Stack; export const Text=({children,role})=>h('span',{role},children); export const Button=({children,...p})=>h('button',p,children); export const Select=({'aria-label':label,options,value,disabled})=>h('select',{'aria-label':label,value,disabled,onChange:()=>{}},options.map(x=>h('option',{key:x.value,value:x.value},x.label))); export const EmptyState=({title,description})=>h('div',{},title,description)`, loader: 'js' }))
  },
}] })
const { PetPage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const stateBundle = await build({ entryPoints: ['src/pet-domain.ts'], bundle: true, format: 'esm', platform: 'node', write: false })
const { createPetState } = await import(`data:text/javascript;base64,${Buffer.from(stateBundle.outputFiles[0].text).toString('base64')}`)
function render(section, state = createPetState(), busy = false, usage, navigation) {
  const snapshot = { state, error: null, busy, usage }
  return renderToStaticMarkup(createElement(PetPage, { section, navigation, client: { getSnapshot: () => snapshot, subscribe: () => () => {}, execute: async () => {} } }))
}
test('shop renders real avatar definitions and unavailable income without offering a mint control', () => {
  const html = render('shop')
  assert.match(html, /data-avatar-preset="cat"/)
  assert.match(html, /data-avatar-preset="dog"/)
  assert.match(html, /data-avatar-preset="rabbit"/)
  assert.match(html, /使用奖励暂不可用/)
  assert.match(html, /相伴解锁 0\/6/)
  assert.match(html, /宠物币不足/)
  assert.doesNotMatch(html, /充值|领取宠物币|测试余额/)
})
test('wallet distinguishes permission denial from connected partial coverage', () => {
  const denied = render('shop', createPetState(), false, { status: 'unavailable', reason: 'permission-denied' })
  assert.match(denied, /允许读取本机 Token 使用量/)
  const ready = render('ledger', createPetState(), false, { status: 'ready', coverage: 'partial', observedThrough: 1000, eligibleTokens: 100000 })
  assert.match(ready, /不包含全部历史或其他设备/)
  assert.match(ready, /最近同步/)
  assert.doesNotMatch(ready, /奖励暂不可用/)
})
test('overview keeps care forms in a secondary page and bag shows owned inventory', () => {
  const state = createPetState()
  const navigation = {session:{selectedPet:'pet:cat', filter:'all',hideOwned:false},open:()=>{}}
  assert.doesNotMatch(render('pets'), /for="name-pet:cat"/)
  assert.match(render('pets'), /照顾与装扮/)
  assert.match(render('pet-detail',state,false,undefined,navigation), /for="name-pet:cat"/)
  assert.match(render('pet-detail',state,false,undefined,navigation), /设为主宠/)
  assert.doesNotMatch(render('bag'), /奶咖 · 未解锁/)
  assert.match(render('settings'), /aria-label="减少动态效果"/)
  assert.match(render('ledger'), /还没有收支记录/)
})
test('shop filters persist and hide already owned products', () => {
  const navigation = {session:{filter:'pet',hideOwned:true},open:()=>{}}
  const html = render('shop',createPetState(),false,undefined,navigation)
  assert.doesNotMatch(html,/data-avatar-preset="cat"/)
  assert.match(html,/data-avatar-preset="dog"/)
  assert.match(html,/aria-pressed="true"/)
})

test('busy state disables every mutating button and settings selector', () => {
  for (const section of ['shop', 'pets', 'bag', 'settings']) {
    const html = render(section, createPetState(), true)
    for (const tag of html.matchAll(/<button\b[^>]*>/g)) if (!tag[0].includes('pet-card-open')) assert.match(tag[0], /disabled=""/, `${section}: ${tag[0]}`)
    if (section === 'settings') for (const tag of html.matchAll(/<select\b[^>]*>/g)) assert.match(tag[0], /disabled=""/)
  }
})

test('care pages show weight and distinguish death from a retained memorial', () => {
  const state = createPetState()
  state.pets[0].status = 'dead'; state.pets[0].care.health = 0; state.activePetIds = []
  assert.match(render('pets', state), /已逝去/)
  assert.match(render('pet-detail', state), /体重 4.00 kg/)
  assert.match(render('pet-detail', state), /安葬/)
  assert.match(render('pet-detail', state), /重启核心/)
  state.pets[0].status = 'buried'
  assert.match(render('pets', state), /已安葬/)
  assert.match(render('settings', state), /离线时暂停/)
})
