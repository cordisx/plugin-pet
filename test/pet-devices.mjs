import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle = await build({ stdin: { contents: `export * from './src/pet-domain.ts'; export * from './src/pet-devices.ts'; export * from './src/pet-attributes.ts'; export * from './src/pet-catalog.ts'; export * from './src/pet-store.ts'`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false })
const { createPetState, settlePetUsage, applyPetCommand, migratePetState, deviceCapacity, deviceFoodCount, foodEffect, PET_CATALOG, PetStore } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const tx = (key, now = 1000) => ({ key, now })
let serial=0
const command=(state,value)=>applyPetCommand(state,value,tx(`command:${serial++}`)).state
function supplied() {
  let state = settlePetUsage(createPetState(), { sourceId: 'test', totalTokens: 0 }, tx('base')).state
  state = settlePetUsage(state, { sourceId: 'test', totalTokens: 50000000 }, tx('credit')).state
  for (const productId of ['item-water-dispenser','item-auto-feeder']) state=command(state,{type:'buy',productId})
  return state
}
function filled() {
  let state=supplied()
  state=command(state,{type:'device-refill-water',quantity:300})
  return command(state,{type:'device-load-food',foodId:'food-snack',quantity:3})
}
function pulse(state, key = 'pulse', now = 61000, elapsedMs = 60000) { return applyPetCommand(state, { type: 'carePulse', elapsedMs }, tx(key, now)).state }
test('permanent devices are purchased empty and enabled; only highest tier counts', () => {
  assert.throws(()=>command(createPetState(),{type:'device-settings',value:{waterEnabled:true}}),/购买/)
  const state=supplied()
  assert.equal(state.devices.waterEnabled,true);assert.equal(state.devices.feederEnabled,true)
  assert.equal(state.devices.waterStored,0);assert.deepEqual(state.devices.foodQueue,[])
  assert.throws(()=>command(state,{type:'buy',productId:'item-auto-feeder'}),/拥有/)
  assert.throws(()=>command(state,{type:'buy',productId:'item-auto-feeder',quantity:2}),/一件/)
  const before=filled()
  const mid=command(before,{type:'device-upgrade',device:'feeder'})
  const upgraded=command(mid,{type:'device-upgrade',device:'feeder'})
  assert.equal(mid.wallet.balance,before.wallet.balance-360)
  assert.equal(upgraded.wallet.balance,before.wallet.balance-1080)
  assert.deepEqual(deviceCapacity(upgraded,'feeder'),{tier:3,capacity:48,serviceLimit:8})
  assert.equal(deviceFoodCount(upgraded.devices),3)
  assert.throws(()=>command(upgraded,{type:'device-upgrade',device:'feeder'}),/满级/)
})
test('refill/load are atomic, cap storage, reject missing inventory and forbid settings supply forgery', () => {
  let state=supplied();state=command(state,{type:'device-refill-water',quantity:999})
  assert.equal(state.devices.waterStored,300)
  assert.throws(()=>command(state,{type:'device-refill-water',quantity:.5}),/正整数/)
  assert.throws(()=>command(state,{type:'device-settings',value:{waterStored:300}}),/库存/)
  assert.throws(()=>command(state,{type:'device-load-food',foodId:'food-meal',quantity:1}),/不足/)
  state=command(state,{type:'buy',productId:'food-snack',quantity:10})
  const loaded=command(state,{type:'device-load-food',foodId:'food-snack',quantity:6})
  assert.equal(deviceFoodCount(loaded.devices),6);assert.equal(loaded.foodInventory['food-snack'],7)
  assert.throws(()=>command(loaded,{type:'device-load-food',foodId:'food-snack',quantity:1}),/容量/)
  const upgraded=command(loaded,{type:'device-upgrade',device:'feeder'})
  assert.equal(deviceCapacity(upgraded,'feeder').capacity,18)
  assert.equal(deviceFoodCount(upgraded.devices),6)
  assert.deepEqual(migratePetState(upgraded),upgraded)
})
test('online use consumes stored supplies, applies real nutrition, and cannot generate affinity or spend coins', () => {
  const state=filled();state.careUpdatedAt=1000
  const pet=state.pets[0];pet.care.fullness=0;pet.care.hydration=0
  const next=pulse(state);const effect=foodEffect(next.pets[0],PET_CATALOG.find(f=>f.id==='food-snack'))
  assert.equal(next.pets[0].care.hydration,80);assert.equal(next.devices.waterStored,220)
  assert.equal(next.pets[0].care.fullness,effect.fullness);assert.equal(deviceFoodCount(next.devices),2)
  assert.equal(next.pets[0].affinity,pet.affinity);assert.deepEqual(next.wallet,state.wallet)
  assert.deepEqual(next.foodInventory,state.foodInventory)
  assert.equal(next.receipts.filter(r=>['device-water','device-feed'].includes(r.kind)).length,2)
  assert.deepEqual(pulse(next,'overlap').devices,next.devices)
  assert.deepEqual(pulse(next).receipts,next.receipts)
})
test('remaining water can partially restore hydration without inventing supplies',()=>{
  let state=supplied();state=command(state,{type:'device-refill-water',quantity:10})
  state.careUpdatedAt=1000;state.pets[0].care.hydration=0
  const next=pulse(state)
  assert.equal(next.pets[0].care.hydration,10);assert.equal(next.devices.waterStored,0)
})
test('paused, uninitialized, inactive, disabled, sufficient and empty devices do not use supplies',()=>{
  for(const condition of ['paused','first','inactive','disabled','sufficient','empty']) {
    const state=condition==='empty'?supplied():filled();state.careUpdatedAt=1000
    state.pets[0].care.fullness=state.pets[0].care.hydration=0
    if(condition==='first')state.careUpdatedAt=null
    if(condition==='inactive')state.activePetIds=[]
    if(condition==='disabled')state.devices.waterEnabled=state.devices.feederEnabled=false
    if(condition==='sufficient')state.pets[0].care.fullness=state.pets[0].care.hydration=80
    const next=pulse(state,'p',61000,condition==='paused'?0:60000)
    assert.equal(next.devices.waterStored,state.devices.waterStored,condition)
    assert.deepEqual(next.devices.foodQueue,state.devices.foodQueue,condition)
  }
})
test('devices cannot revive deaths occurring during care',()=>{
  const state=filled();state.careUpdatedAt=1000
  state.pets[0].care={...state.pets[0].care,fullness:0,hydration:0,health:.001,lowFullnessMs:3600000,lowHydrationMs:3600000}
  const next=pulse(state);assert.equal(next.pets[0].status,'dead');assert.deepEqual(next.devices,state.devices)
})
test('old device settings migrate without giving free water or food',()=>{
  const state=supplied();state.devices={waterEnabled:true,feederEnabled:false,foodId:'food-meal'}
  const next=migratePetState(state)
  assert.equal(next.devices.waterEnabled,true);assert.equal(next.devices.foodId,'food-meal')
  assert.equal(next.devices.waterStored,0);assert.deepEqual(next.devices.foodQueue,[])
  assert.deepEqual(next.wallet,state.wallet);assert.deepEqual(next.foodInventory,state.foodInventory)
})
test('shared low-tier devices rotate fairly across three hungry pets',()=>{
  let state=filled()
  for(const productId of ['pet-dog','pet-rabbit'])state=command(state,{type:'buy',productId})
  state=command(state,{type:'setActive',petIds:state.pets.map(p=>p.id)})
  state.careUpdatedAt=1000
  for(const p of state.pets)p.care.fullness=p.care.hydration=0
  let next=pulse(state)
  assert.equal(next.pets[2].care.hydration,0);assert.equal(next.pets[2].care.fullness,0)
  assert.equal(next.devices.waterCursor,2);assert.equal(next.devices.feederCursor,2)
  next=pulse(next,'second',121000)
  assert.ok(next.pets[2].care.hydration>0);assert.ok(next.pets[2].care.fullness>0)
  assert.equal(deviceFoodCount(next.devices),0)
})
test('food queue preserves batch order and distinct food energy/mood effects',()=>{
  let state=supplied()
  for(const foodId of ['food-snack','food-meal']) {
    state=command(state,{type:'buy',productId:foodId})
    state=command(state,{type:'device-load-food',foodId,quantity:1})
  }
  state.careUpdatedAt=1000;state.pets[0].care.fullness=0;state.pets[0].care.energy=0;state.pets[0].care.mood=0
  const first=pulse(state)
  assert.equal(first.devices.foodQueue[0].foodId,'food-meal')
  const snack=PET_CATALOG.find(f=>f.id==='food-snack')
  assert.equal(first.pets[0].care.energy,snack.energy)
  assert.equal(first.pets[0].care.mood,(snack.mood??0)*first.pets[0].traits.cheerfulness)
  first.pets[0].care.fullness=0;first.pets[0].care.energy=0;first.pets[0].care.mood=0
  const second=pulse(first,'second',121000);const meal=PET_CATALOG.find(f=>f.id==='food-meal')
  assert.equal(second.pets[0].care.energy,meal.energy)
  assert.equal(second.pets[0].care.mood,(meal.mood??0)*second.pets[0].traits.cheerfulness)
  assert.equal(deviceFoodCount(second.devices),0)
})
test('CAS retries cannot load or feed twice',async()=>{
  let state=filled();state.careUpdatedAt=1000;state.pets[0].care.fullness=0;let revision=0
  const adapter={load:async()=>({value:structuredClone(state),revision:String(revision)}),compareAndSwap:async(expected,next)=>{if(expected!==String(revision))return false;state=structuredClone(next);revision++;return true}}
  const a=new PetStore(adapter),b=new PetStore(adapter)
  await Promise.all([a.execute({type:'carePulse',elapsedMs:60000},'same-pulse'),b.execute({type:'carePulse',elapsedMs:60000},'same-pulse')])
  assert.equal(deviceFoodCount(state.devices),2)
  assert.equal(state.receipts.filter(r=>r.kind==='device-feed').length,1)
})

test('upgrade debits atomically, preserves supplies and refuses an insufficient wallet',()=>{
  const state=filled()
  const first=command(state,{type:'device-upgrade',device:'water'})
  assert.deepEqual(deviceCapacity(first,'water'),{tier:2,capacity:800,serviceLimit:4})
  assert.equal(first.wallet.balance,state.wallet.balance-240)
  assert.equal(first.devices.waterStored,300)
  const second=command(first,{type:'device-upgrade',device:'water'})
  assert.equal(second.wallet.balance,first.wallet.balance-480)
  assert.equal(deviceCapacity(second,'water').capacity,2000)
  assert.deepEqual(migratePetState(second),second)
  const empty=structuredClone(state);empty.wallet={balance:0,earned:0,spent:0}
  const snapshot=structuredClone(empty)
  assert.throws(()=>command(empty,{type:'device-upgrade',device:'water'}),/不足/)
  assert.deepEqual(empty,snapshot)
})
