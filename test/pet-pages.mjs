import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const result = await build({ entryPoints: ['src/pet-pages.tsx'], bundle: true, format: 'esm', platform: 'node', write: false, loader: { '.png': 'dataurl', '.svg': 'dataurl' }, plugins: [{
  name: 'host-page-test', setup(builder) {
    builder.onResolve({ filter: /^(cordisx\/react(?:\/jsx-runtime)?|react(?:\/jsx-runtime)?)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path.replace('cordisx/', ''))).href, external: true }))
    builder.onResolve({ filter: /^cordisx\/ui$/ }, () => ({ path: 'ui', namespace: 'host-test' }))
    builder.onResolve({ filter: /^@oneworks\/avatar-react\/renderer$/ }, () => ({ path: 'avatar', namespace: 'host-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'host-test' }, args => ({ contents: args.path === 'avatar'
      ? `import {createElement as h} from 'react'; export const Avatar=({definition,...props})=>h('div',{'aria-label':props['aria-label'],'data-avatar-preset':definition.scene.entity.preset})`
      : `import {createElement as h} from 'react'; export const Stack=({children})=>h('div',{},children); export const Icon=({name})=>h('i',{'data-icon':name}); export const Card=Stack; export const Text=({children,role})=>h('span',{role},children); export const Button=({children,...p})=>h('button',p,children); export const Select=({'aria-label':label,options,value,disabled})=>h('select',{'aria-label':label,value,disabled,onChange:()=>{}},options.map(x=>h('option',{key:x.value,value:x.value},x.label))); export const EmptyState=({title,description})=>h('div',{},title,description)`, loader: 'js' }))
  },
}] })
const { PetPage, PetWardrobe, peekPose, availableFoods, shopProducts, bagProducts, PET_SHOP_PAGE_SIZE } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const stateBundle = await build({ entryPoints: ['src/pet-domain.ts'], bundle: true, format: 'esm', platform: 'node', write: false })
const { createPetState } = await import(`data:text/javascript;base64,${Buffer.from(stateBundle.outputFiles[0].text).toString('base64')}`)
function render(section, state = createPetState(), busy = false, usage, navigation) {
  const snapshot = { state, error: null, busy, usage }
  return renderToStaticMarkup(createElement(PetPage, { section, navigation, client: { getSnapshot: () => snapshot, subscribe: () => () => {}, execute: async () => {} } }))
}
test('shop renders real avatar definitions and unavailable income without offering a mint control', () => {
  const html = render('shop',createPetState(),false,undefined,{session:{filter:'all',hideOwned:false,product:'pet-dog'},open:()=>{}})
  assert.match(html, /data-snapshot-species="cat"/)
  assert.match(html, /data-snapshot-species="dog"/)
  assert.match(html, /data-snapshot-species="rabbit"/)
  assert.doesNotMatch(html, /使用奖励暂不可用|允许读取本机 Token/)
  assert.match(html, /相伴解锁 0\/6/)
  assert.match(html, /宠物币不足/)
  assert.doesNotMatch(html, /充值|领取宠物币|测试余额/)
})
test('wallet distinguishes permission denial and attributed work without promising unconfigured backpay', () => {
  const denied = render('ledger', createPetState(), false, { status: 'unavailable', reason: 'permission-denied' })
  assert.match(denied, /使用奖励未开启/)
  const ready = render('ledger', createPetState(), false, { status: 'ready', coverage: 'partial', observedThrough: 1000, eligibleTokens: 100000 })
  assert.match(ready, /仅统计可归因的正常根任务工作/)
  assert.match(ready, /游戏、分叉、子任务和未知来源不计入/)
  assert.match(ready, /期间用量不补发/)
  assert.doesNotMatch(ready, /奖励暂不可用/)
})
test('overview keeps care forms in a secondary page and bag shows owned inventory', () => {
  const state = createPetState()
  const navigation = {session:{selectedPet:'pet:cat', filter:'all',hideOwned:false},open:()=>{}}
  assert.doesNotMatch(render('pets'), /for="name-pet:cat"/)
  assert.match(render('pets'), /aria-label="查看猫猫详情"/)
  assert.doesNotMatch(render('pets'), /查看档案/)
  assert.doesNotMatch(render('pet-detail',state,false,undefined,navigation), /for="name-pet:cat"/)
  assert.match(render('pet-detail',state,false,undefined,navigation), /aria-label="修改名字"/)
  assert.match(render('pet-detail',state,false,undefined,navigation), /role="tablist" aria-label="宠物详情"/)
  assert.doesNotMatch(render('pet-detail',state,false,undefined,navigation), /<details|<summary|role="menuitem"/)
  assert.doesNotMatch(render('bag'), /奶咖 · 未解锁/)
  assert.match(render('settings'), /aria-label="减少动态效果"/)
  assert.match(render('ledger'), /还没有收支记录/)
})
test('shop filters persist and hide already owned products', () => {
  const navigation = {session:{filter:'pet',hideOwned:true},open:()=>{}}
  const html = render('shop',createPetState(),false,undefined,navigation)
  assert.doesNotMatch(html,/data-snapshot-species="cat"/)
  assert.match(html,/data-snapshot-species="dog"/)
  assert.match(html,/aria-pressed="true"/)
})

test('busy state disables care mutations and settings selectors while navigation stays available', () => {
  const html = render('pets', createPetState(), true)
  for (const label of ['喂给猫猫', '休息']) {
    const button = html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0]
    assert.ok(button, `missing accessible action ${label}`)
    assert.match(button, /disabled=""/)
  }
  const navigation = html.match(/<nav aria-label="宠物页面">([\s\S]*?)<\/nav>/)?.[1]
  assert.ok(navigation)
  for (const tag of navigation.matchAll(/<button\b[^>]*>/g)) assert.doesNotMatch(tag[0], /disabled=/)
  const foodTab = html.match(/<button[^>]*aria-label="喂食"[^>]*>/)?.[0]
  assert.ok(foodTab)
  assert.doesNotMatch(foodTab, /disabled=/)
  for (const tag of render('settings',createPetState(),true).matchAll(/<select\b[^>]*>/g)) assert.match(tag[0], /disabled=""/)
})

test('care pages show weight and distinguish death from a retained memorial', () => {
  const state = createPetState()
  state.pets[0].status = 'dead'; state.pets[0].care.health = 0; state.activePetIds = []
  assert.match(render('pets', state), /已逝去/)
  assert.match(render('pet-detail', state), /体重 4.00 kg/)
  assert.match(render('pet-detail', state), /已逝去/)
  assert.match(render('pet-detail', state), /pet-detail-tab-actions/)
  state.pets[0].status = 'buried'
  assert.match(render('pets', state), /已安葬/)
  assert.match(render('settings', state), /离线时暂停/)
})

test('peek framing is stable per identity and varies across pets without hiding the face', () => {
  const ids = ['pet:cat','pet:dog','pet:rabbit','preview:skin-white','preview:skin-orange']
  const poses = ids.map(peekPose)
  assert.deepEqual(poses, ids.map(peekPose))
  assert.ok(new Set(poses.map(pose => pose.side)).size > 1)
  assert.ok(poses.every(pose => Math.abs(pose.angle) <= 22 && pose.offset >= 36 && pose.offset <= 60))
  const html = render('pets')
  assert.match(html,/aria-label="猫猫，主宠"/)
  assert.match(html,/aria-label="选中宠物"/)
  assert.doesNotMatch(html,/宠物活动区域/)
})

test('album omits duplicate chrome and recruitment placeholders; food follows stock', () => {
  const state = createPetState()
  const html = render('pets',state)
  assert.match(html,/pet-album-gallery/)
  assert.doesNotMatch(html,/发现新伙伴|遇见新伙伴|宠物收藏册|class="pet-inspector"/)
  state.foodInventory = {'food-meal':2, 'food-snack':0, 'food-feast':5}
  assert.deepEqual(availableFoods(state).map(food=>food.id), ['food-meal','food-feast'])
  state.foodInventory = {}
  assert.deepEqual(availableFoods(state), [])
})

test('shop buys into inventory with quantity and no recipient or use action', () => {
  const nav = {session:{filter:'food',hideOwned:false,product:'food-snack'},open:()=>{}}
  const html = render('product-detail',createPetState(),false,undefined,nav)
  assert.match(html,/aria-label="购买数量" type="number" min="1" max="99" step="1" value="1"/)
  assert.match(html,/合计 · 1 份/)
  assert.doesNotMatch(html,/选择使用物品的宠物|>喂食<|>装备皮肤</)
  const bag = render('bag-detail',createPetState(),false,undefined,nav)
  assert.match(bag,/选择使用物品的宠物/)
  assert.match(bag,/>喂食</)
  assert.doesNotMatch(bag,/购买数量/)
})
test('care offers immediate food selection and shows distinct states and attributes', () => {
  const home = render('pets')
  assert.match(home,/aria-label="选择食物"/)
  assert.match(home,/喂给猫猫/)
  assert.match(home,/aria-label="饮水"/)
  assert.match(home,/aria-label="装扮"/)
  const detail = render('pet-detail')
  assert.match(detail,/aria-label="饮水"/)
  assert.match(detail,/aria-label="心情"/)
  assert.match(detail,/pet-detail-tab-attributes/)
  assert.match(detail,/pet-detail-tab-actions/)
  assert.doesNotMatch(detail,/>智力<|>幸运<|>代谢<|>吸收</)
  assert.match(detail,/role="tabpanel" aria-labelledby="pet-detail-tab-status"/)
})

test('out-of-stock home care has one accessible purchase action instead of duplicate text controls', () => {
  const state = createPetState(); state.foodInventory = {}
  const html = render('pets', state)
  const actions = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(match => /aria-label="购买/.test(match[1]))
  assert.equal(actions.length, 1)
  assert.match(actions[0][1], /aria-label="购买比特脆脆"/)
  assert.match(actions[0][2], /<svg/)
  assert.equal(actions[0][2].replace(/<svg[\s\S]*?<\/svg>/g, '').trim(), '')
  assert.doesNotMatch(html, /没有库存|去商店补给/)
})

test('large catalogs render at most eighteen shop tiles and keep pagination outside the scrolling grid', () => {
  const state = createPetState()
  const products = shopProducts(state, 'skin', false)
  assert.ok(products.length > 100)
  const nav = {session:{filter:'skin',hideOwned:false},open:()=>{}}
  const html = render('shop', state, false, undefined, nav)
  assert.equal([...html.matchAll(/data-pet-anchor=/g)].length, PET_SHOP_PAGE_SIZE)
  assert.match(html, /aria-label="商品分页"/)
  assert.match(html, /aria-label="下一页商品"/)
  assert.match(html, /aria-label="皮肤适用物种"/)
  assert.match(html, /全部种类/)
  const food = render('shop',state,false,undefined,{session:{filter:'food',hideOwned:false},open:()=>{}})
  assert.doesNotMatch(food,/aria-label="伙伴分组"|aria-label="皮肤适用物种"/)
})
test('species groups filter pet and skin catalogs without hiding other product categories', () => {
  const state = createPetState()
  const birds = shopProducts(state,'pet',false,'bird')
  assert.ok(birds.length > 0)
  assert.ok(birds.every(item => ['chick','duck','penguin','owl','parrot','goose'].includes(item.species)))
  const parrotSkins = shopProducts(state,'skin',false,'bird','parrot')
  assert.ok(parrotSkins.length > 1)
  assert.ok(parrotSkins.every(item => item.species === 'parrot'))
  assert.deepEqual(shopProducts(state,'food',false,'bird','parrot'),shopProducts(state,'food',false))
  const html = render('shop',state,false,undefined,{session:{filter:'skin',hideOwned:false,group:'bird',species:'parrot'},open:()=>{}})
  assert.match(html,/value="parrot"[^>]*>鹦鹉/)
  assert.doesNotMatch(html,/value="cat"/)
})
test('precise product navigation resolves the correct page even with stale species filters', () => {
  const state = createPetState()
  const products = shopProducts(state,'skin',false)
  const item = products.at(-1)
  const html = render('shop',state,false,undefined,{session:{filter:'skin',hideOwned:false,group:'companion',species:'cat',page:0,anchor:item.id,product:item.id},open:()=>{}})
  assert.ok(html.includes(`data-pet-anchor="${item.id}"`))
  assert.match(html,/aria-pressed="true" data-pet-anchor=/)
  assert.ok([...html.matchAll(/data-pet-anchor=/g)].length <= PET_SHOP_PAGE_SIZE)
})

test('bag shares category, species filters, tile presentation and pagination while exposing inventory use', () => {
  const state = createPetState()
  state.ownedSkinIds = shopProducts(state,'skin',false).map(item => item.id)
  const nav = {session:{filter:'skin',hideOwned:true},open:()=>{}}
  const html = render('bag',state,false,undefined,nav)
  assert.match(html,/aria-label="商品类型"/)
  assert.match(html,/aria-label="伙伴分组"/)
  assert.match(html,/aria-label="皮肤适用物种"/)
  assert.match(html,/class="pet-tile-grid pet-shop-grid"/)
  assert.match(html,/aria-label="商品分页"/)
  assert.equal([...html.matchAll(/data-pet-anchor=/g)].length,PET_SHOP_PAGE_SIZE)
  assert.doesNotMatch(html,/隐藏已拥有|购买数量/)
  const supplies = bagProducts(state,'food')
  assert.deepEqual(supplies.map(item=>item.id),['food-snack'])
  const food = render('bag',state,false,undefined,{session:{filter:'food',hideOwned:false,product:'food-snack'},open:()=>{}})
  assert.match(food,/选择使用物品的宠物/)
  assert.match(food,/>喂食</)
  assert.match(food,/× 3/)
  assert.doesNotMatch(food,/购买数量/)
})
test('every species group uses an icon before its text in both shop and bag', () => {
  for (const section of ['shop','bag']) {
    const html = render(section,createPetState(),false,undefined,{session:{filter:'pet',hideOwned:false},open:()=>{}})
    const group = html.match(/aria-label="伙伴分组">([\s\S]*?)<\/div>/)?.[1]
    assert.ok(group)
    const buttons = [...group.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
    assert.equal(buttons.length,7)
    for (const [,body] of buttons) assert.match(body,/^<svg[\s\S]*?<\/svg>[^<]+$/)
  }
})

test('unlocked species can be adopted again while bag counts individual companions', () => {
  const state = createPetState()
  state.wallet.balance = 100
  state.pets.push({...structuredClone(state.pets[0]),id:'pet:cat:second',name:'另一只猫'})
  const nav = {session:{filter:'pet',hideOwned:false,product:'pet-cat'},open:()=>{}}
  const shop = render('shop',state,false,undefined,nav)
  assert.match(shop,/再领养一只/)
  const total = shop.match(/class="pet-purchase-total">([\s\S]*?)<\/div>/)?.[1]
  assert.match(total,/再次领养/)
  assert.match(total,/>\s*30<\/strong>/)
  assert.doesNotMatch(shop, /<button[^>]*disabled=""[^>]*>[\s]*再领养一只/)
  const bag = render('bag',state,false,undefined,nav)
  assert.match(bag,/拥有 2 只/)
  assert.match(bag,/查看伙伴/)
  assert.doesNotMatch(bag,/再领养一只/)
})

test('shop and bag remain static including selected detail previews', () => {
  const state = createPetState()
  state.ownedSkinIds = shopProducts(state,'skin',false).map(item => item.id)
  for (const section of ['shop','bag']) {
    const nav = {session:{filter:'skin',hideOwned:false},open:()=>{}}
    const html = render(section,state,false,undefined,nav)
    assert.equal([...html.matchAll(/data-snapshot-species=/g)].length,PET_SHOP_PAGE_SIZE)
    assert.doesNotMatch(html,/data-avatar-preset=/)
    nav.session.product='skin-white';nav.session.anchor='skin-white'
    const detail = render(section,state,false,undefined,nav)
    assert.equal([...detail.matchAll(/data-avatar-preset=/g)].length,0)
  }
})
test('multiple companions keep only the selected portrait live', () => {
  const state=createPetState()
  state.pets.push({...structuredClone(state.pets[0]),id:'pet:cat:2',name:'第二只'})
  const html=render('pets',state)
  assert.equal([...html.matchAll(/data-avatar-preset=/g)].length,1)
  assert.equal([...html.matchAll(/data-snapshot-species=/g)].length,1)
})

test('wardrobe includes locked same-species skins with prices and static previews', () => {
  const state = createPetState()
  const html = renderToStaticMarkup(createElement(PetWardrobe, {state, entity:state.pets[0], busy:false, run:()=>{}}))
  assert.match(html, /云朵白，已穿戴/)
  assert.match(html, /奶咖，未解锁/)
  assert.match(html, /橘子汽水，已解锁/)
  assert.match(html, /相伴纪念，未解锁/)
  assert.doesNotMatch(html, /雪原|垂耳奶糖|data-avatar-preset/)
  assert.match(html, /选择皮肤/)
  state.ownedSkinIds.push('skin-siamese')
  const unlocked = renderToStaticMarkup(createElement(PetWardrobe, {state, entity:state.pets[0], busy:false, run:()=>{}}))
  assert.match(unlocked, /奶咖，已解锁/)
})
