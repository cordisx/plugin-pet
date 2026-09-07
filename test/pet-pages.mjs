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
function render(section, state = createPetState(), busy = false) {
  const snapshot = { state, error: null, busy }
  return renderToStaticMarkup(createElement(PetPage, { section, client: { getSnapshot: () => snapshot, subscribe: () => () => {}, execute: async () => {} } }))
}
test('shop renders real avatar definitions and unavailable income without offering a mint control', () => {
  const html = render('shop')
  assert.match(html, /data-avatar-preset="cat"/)
  assert.match(html, /data-avatar-preset="dog"/)
  assert.match(html, /data-avatar-preset="rabbit"/)
  assert.match(html, /使用奖励暂未开放/)
  assert.match(html, /相伴解锁 0\/6/)
  assert.match(html, /宠物币不足/)
  assert.doesNotMatch(html, /充值|领取宠物币|测试余额/)
})
test('pet, bag and settings pages expose distinct care controls and accessible names', () => {
  assert.match(render('pets'), /设为主宠/)
  assert.match(render('pets'), /for="name-pet:cat"/)
  assert.match(render('bag'), /试穿皮肤/)
  assert.match(render('bag'), /奶咖 · 未解锁/)
  assert.match(render('bag'), /消耗 1 份/)
  assert.match(render('settings'), /aria-label="减少动态效果"/)
  assert.match(render('settings'), /最多同时出场/)
  assert.match(render('ledger'), /还没有收支记录/)
})

test('busy state disables every mutating button and settings selector', () => {
  for (const section of ['shop', 'pets', 'bag', 'settings']) {
    const html = render(section, createPetState(), true)
    for (const tag of html.matchAll(/<button\b[^>]*>/g)) assert.match(tag[0], /disabled=""/, `${section}: ${tag[0]}`)
    if (section === 'settings') for (const tag of html.matchAll(/<select\b[^>]*>/g)) assert.match(tag[0], /disabled=""/)
  }
})
