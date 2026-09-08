import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle=await build({stdin:{contents:`export * from './src/pet-visual-menu.ts'; export { PET_CATALOG } from './src/pet-catalog.ts'; export { createPetState } from './src/pet-domain.ts'`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false})
const {petVisualMenu,executePetVisualAction,PET_CATALOG,createPetState}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function flatten(items){return items.flatMap(item=>[item,...flatten(item.children??[])])}
function assertPublicMenu(items,depth=1){assert.ok(items.length<=20);assert.ok(depth<=3);for(const item of items){assert.ok(item.id.length<=100&&item.id.trim());assert.ok(item.label.length<=200&&item.label.trim());assert.ok(/^(action|content|navigation)\./.test(item.icon));if(item.children)assertPublicMenu(item.children,depth+1)}}
test('nested menu groups care and wardrobe with icons and bounded unique nodes',()=>{
 const state=createPetState();state.foodInventory=Object.fromEntries(PET_CATALOG.filter(i=>i.kind==='food').map(i=>[i.id,99]));state.ownedSkinIds=PET_CATALOG.filter(i=>i.kind==='skin').map(i=>i.id)
 const menu=petVisualMenu(state,'pet:cat');assertPublicMenu(menu)
 const nodes=flatten(menu);assert.ok(nodes.length<=64);assert.equal(new Set(nodes.map(i=>i.id)).size,nodes.length)
 assert.deepEqual(menu.map(i=>i.id),['details','group-feed','group-care','group-outfit','group-manage','shop'])
 assert.ok(menu.find(i=>i.id==='group-feed').children.some(i=>i.id==='supplies'))
 assert.ok(menu.find(i=>i.id==='group-outfit').children.some(i=>i.id==='wardrobe'))
 assert.equal(nodes.find(i=>i.id==='main').disabled,true)
 assert.equal(nodes.find(i=>i.id==='equip:skin-white').disabled,true)
})
test('food entries reflect actual inventory; skins are owned and species-compatible; sleep follows state',()=>{
 const state=createPetState();state.foodInventory={'food-meal':2,'food-snack':0};state.ownedSkinIds.push('skin-shiba')
 const menu=flatten(petVisualMenu(state,'pet:cat',true))
 assert.deepEqual(menu.filter(i=>i.id.startsWith('feed:')).map(i=>i.id),['feed:food-meal'])
 assert.ok(!menu.some(i=>i.id==='equip:skin-shiba'));assert.ok(menu.some(i=>i.id==='wake'));assert.ok(!menu.some(i=>i.id==='sleep'))
 state.foodInventory={};assert.ok(flatten(petVisualMenu(state,'pet:cat')).some(i=>i.id==='supplies'))
})
test('legacy factory receives an icon-free flat menu within its 20-item budget',()=>{
 const state=createPetState();state.foodInventory=Object.fromEntries(PET_CATALOG.filter(i=>i.kind==='food').map(i=>[i.id,3]))
 const menu=petVisualMenu(state,'pet:cat',false,false)
 assert.ok(menu.length<=20);assert.ok(menu.every(i=>!i.children&&!i.icon));assert.ok(menu.some(i=>i.id==='hide'));assert.ok(menu.some(i=>i.id==='shop'))
})
test('leaf dispatch targets the clicked instance and preserves current main/hide semantics',async()=>{
 const calls=[],routes=[];const state=createPetState();state.activePetIds=['pet:cat','pet:cat:2']
 const client={execute:async c=>calls.push(c),getSnapshot:()=>({state}),requestSleep:id=>calls.push(['sleep',id]),requestWake:id=>calls.push(['wake',id])}
 const navigate=async(...args)=>routes.push(args)
 for(const action of ['feed:food-meal','equip:skin-orange','water','play','sleep','wake','main','reset','hide','details','wardrobe','supplies','shop','settings','group-care','bogus'])await executePetVisualAction(client,'pet:cat:2',action,navigate)
 assert.deepEqual(calls[0],{type:'feed',petId:'pet:cat:2',foodId:'food-meal'})
 assert.deepEqual(calls[1],{type:'equip',petId:'pet:cat:2',skinId:'skin-orange'})
 assert.ok(calls.some(c=>c.type==='setMain'&&c.petId==='pet:cat:2'))
 assert.deepEqual(calls.find(c=>c.type==='setActive').petIds,['pet:cat'])
 assert.ok(routes.some(([section,session])=>section==='pet-detail'&&session?.selectedPet==='pet:cat:2'))
 assert.ok(routes.some(([section,session])=>section==='pet-detail'&&session?.carePanel==='skin'))
 assert.ok(routes.some(([section,session])=>section==='shop'&&session?.filter==='food'))
 assert.equal(routes.length,5)
})
