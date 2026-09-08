import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle=await build({stdin:{contents:`export * from './src/pet-domain.ts'; export * from './src/pet-catalog.ts'; export * from './src/pet-store.ts'`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false})
const {createPetState,settlePetUsage,applyPetCommand,migratePetState,petAdoptionPrice,initialPetSex,PetStore}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
let seq=0
const execute=(state,command,key=`tx:${seq++}`)=>applyPetCommand(state,command,{key,now:1000})
function funded(){let state=settlePetUsage(createPetState(),{sourceId:'test',totalTokens:0},{key:'base',now:0}).state;return settlePetUsage(state,{sourceId:'test',totalTokens:10000000},{key:'income',now:1}).state}
test('unlock grants one instance; paid adoption adds independent named same-species companions',()=>{
  let state=execute(funded(),{type:'buy',productId:'pet-dog'}).state
  assert.equal(state.pets.filter(p=>p.species==='dog').length,1)
  assert.equal(state.unlockedSpecies.filter(s=>s==='dog').length,1)
  const before=structuredClone(state)
  state=execute(state,{type:'adopt',species:'dog'},'adopt-dog').state
  const dogs=state.pets.filter(p=>p.species==='dog')
  assert.equal(dogs.length,2);assert.notEqual(dogs[0].id,dogs[1].id);assert.notEqual(dogs[0].name,dogs[1].name)
  assert.equal(dogs[0].id,'pet:dog');assert.equal(dogs[1].id,'pet:dog:2')
  assert.notDeepEqual(dogs[0].attributes,dogs[1].attributes)
  assert.equal(state.wallet.balance,before.wallet.balance-petAdoptionPrice('dog'))
  assert.equal(petAdoptionPrice('cat'),30);assert.equal(petAdoptionPrice('dog'),75)
  assert.deepEqual(execute(state,{type:'adopt',species:'dog'},'adopt-dog').state,state)
  const original=structuredClone(dogs[0])
  state=execute(state,{type:'rename',petId:dogs[1].id,name:'豆豆'}).state
  state=execute(state,{type:'feed',petId:dogs[1].id,foodId:'food-snack'}).state
  assert.deepEqual(state.pets.find(p=>p.id===dogs[0].id),original)
  assert.equal(state.pets.find(p=>p.id===dogs[1].id).name,'豆豆')
  assert.equal(state.pets.find(p=>p.id===dogs[1].id).sex,initialPetSex(dogs[1].id))
  assert.deepEqual(migratePetState(state),state)
})
test('adoption requires species unlock and sufficient funds, with no free starter duplication',()=>{
  assert.throws(()=>execute(createPetState(),{type:'adopt',species:'cat'}),/不足/)
  assert.throws(()=>execute(funded(),{type:'adopt',species:'dog'}),/解锁/)
  assert.throws(()=>execute(funded(),{type:'buy',productId:'pet-cat'}),/再次领养/)
  const state=funded(),before=structuredClone(state)
  assert.throws(()=>execute(state,{type:'adopt',species:'custom'}),/解锁/)
  assert.deepEqual(state,before)
})
test('legacy saves infer unlocks and stable sex without changing identity or assets',()=>{
  const state=funded(),before=structuredClone(state)
  delete state.unlockedSpecies
  for(const p of state.pets)delete p.sex
  const next=migratePetState(state)
  assert.deepEqual(next.unlockedSpecies,['cat'])
  assert.equal(next.pets[0].sex,initialPetSex(next.pets[0].id))
  assert.deepEqual(next.pets[0],before.pets[0])
  assert.deepEqual(next.wallet,before.wallet);assert.deepEqual(next.foodInventory,before.foodInventory)
  assert.deepEqual(migratePetState(next),next)
  const bad=structuredClone(next);bad.pets[0].sex='unknown'
  assert.throws(()=>migratePetState(bad),/性别/)
})
test('simultaneous paid adoptions preserve unique instances and same-key retries charge once',async()=>{
  let value=funded(),revision=0
  const adapter={load:async()=>({value:structuredClone(value),revision:String(revision)}),compareAndSwap:async(expected,next)=>{if(expected!==String(revision))return false;value=structuredClone(next);revision++;return true}}
  const a=new PetStore(adapter),b=new PetStore(adapter)
  const balance=value.wallet.balance
  await Promise.all([a.execute({type:'adopt',species:'cat'},'a'),b.execute({type:'adopt',species:'cat'},'b')])
  assert.equal(value.pets.length,3);assert.equal(new Set(value.pets.map(p=>p.id)).size,3)
  assert.equal(value.wallet.balance,balance-60)
  await Promise.all([a.execute({type:'adopt',species:'cat'},'retry'),b.execute({type:'adopt',species:'cat'},'retry')])
  assert.equal(value.pets.length,4);assert.equal(value.wallet.balance,balance-90)
  assert.deepEqual(migratePetState(value),value)
})
test('adopting preserves unlocked skins and the older companion outfit',()=>{
  let state=execute(funded(),{type:'equip',petId:'pet:cat',skinId:'skin-orange'}).state
  const owned=[...state.ownedSkinIds]
  state=execute(state,{type:'adopt',species:'cat'}).state
  assert.deepEqual(state.ownedSkinIds,owned)
  assert.equal(state.pets.find(p=>p.id==='pet:cat').skinId,'skin-orange')
  assert.equal(state.pets.find(p=>p.id==='pet:cat:2').skinId,'skin-white')
  state=execute(state,{type:'equip',petId:'pet:cat:2',skinId:'skin-orange'}).state
  state=execute(state,{type:'equip',petId:'pet:cat',skinId:'skin-white'}).state
  assert.equal(state.pets.find(p=>p.id==='pet:cat:2').skinId,'skin-orange')
})
