import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle=await build({stdin:{contents:`export * from './src/pet-species.ts'; export * from './src/pet-care.ts'; export * from './src/pet-attributes.ts'; export * from './src/pet-domain.ts'; export * from './src/pet-catalog.ts'`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false})
const {PET_SPECIES,PET_SPECIES_IDS,PET_BASE_WEIGHT,PET_SPECIES_METABOLISM,initialPetCare,advancePetCare,foodEffect,createPetState,settlePetUsage,applyPetCommand,migratePetState,PET_CATALOG,PET_DEFAULT_SKINS}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
test('every public preset has finite care and weight-calibrated nutrition',()=>{
  assert.ok(PET_SPECIES_IDS.length>3)
  for(const species of PET_SPECIES_IDS) {
    assert.ok(PET_SPECIES[species].weight>0,species)
    assert.ok(PET_SPECIES[species].metabolism>0,species)
    const pet={...createPetState().pets[0],species,care:initialPetCare(species)}
    assert.equal(pet.care.weight,PET_SPECIES[species].weight)
    const next=advancePetCare(pet,3600000)
    for(const value of Object.values(next.care))assert.ok(Number.isFinite(value),species)
    assert.ok(next.care.fullness<pet.care.fullness,species)
    assert.ok(foodEffect(pet,PET_CATALOG.find(p=>p.id==='food-snack')).fullness>0,species)
  }
})
test('every catalog species can be acquired and round-trip through validated save migration',()=>{
  let state=settlePetUsage(createPetState(),{sourceId:'test',totalTokens:0},{key:'baseline',now:1}).state
  state=settlePetUsage(state,{sourceId:'test',totalTokens:10000000000},{key:'income',now:2}).state
  for(const species of PET_SPECIES_IDS.filter(s=>s!=='cat')) {
    state=applyPetCommand(state,{type:'buy',productId:`pet-${species}`},{key:`buy-${species}`,now:3}).state
    const pet=state.pets.find(p=>p.species===species)
    assert.equal(pet.skinId,PET_DEFAULT_SKINS[species])
    assert.equal(pet.care.weight,PET_SPECIES[species].weight)
    assert.deepEqual(migratePetState(state),state)
  }
  assert.equal(state.pets.length,PET_SPECIES_IDS.length)
  const bad=structuredClone(state);bad.pets[0].species='custom'
  assert.throws(()=>migratePetState(bad),/未知宠物类型/)
})
test('legacy cat dog rabbit weights, metabolism, inventories and wallet remain unchanged',()=>{
  assert.deepEqual(['cat','dog','rabbit'].map(s=>PET_BASE_WEIGHT[s]),[4,8,2])
  assert.deepEqual(['cat','dog','rabbit'].map(s=>PET_SPECIES_METABOLISM[s]),[1,.9,1.2])
  const state=createPetState();const old=structuredClone(state)
  const migrated=migratePetState(state)
  assert.deepEqual(migrated,old)
  delete state.pets[0].care
  const preCare=migratePetState(state)
  assert.equal(preCare.pets[0].care.weight,4)
  assert.deepEqual(preCare.wallet,old.wallet)
  assert.deepEqual(preCare.foodInventory,old.foodInventory)
})
