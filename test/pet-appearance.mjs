import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { getAvatarPalette, parseAvatarDefinition, createDefaultAvatarDefinition, resolveSeededAvatarView } from '@oneworks/avatar'
const bundled = await build({entryPoints:['src/pet-appearance.ts','src/pet-scene-shape.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
const modules = await Promise.all(bundled.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {petAppearance,petComposerAppearance,PET_AVATAR_SCALE}=modules[0]
const {createPetShapeTimeline}=modules[1]
const skins=[['cat','skin-white'],['cat','skin-orange'],['cat','skin-siamese'],['cat','skin-friend'],['dog','skin-shiba'],['dog','skin-husky'],['rabbit','skin-lop'],['rabbit','skin-dutch']]
test('native presets and palettes own species geometry and breed materials', () => {
  for(const [species,skin] of skins) {
    const definition=parseAvatarDefinition(petAppearance(species,skin))
    assert.equal(definition.scene.entity.preset,species)
    assert.deepEqual(definition.scene.entity.parts,[])
    const palette=getAvatarPalette(definition.scene.appearance.paletteId)
    assert.equal(definition.scene.appearance.coatPattern.enabled,Boolean(palette.coat))
    assert.equal(definition.scene.camera.background,'transparent')
    assert.equal(definition.scene.face.mouthEnabled,false)
    // rc.8 cannot resolve implicit preset parts through its public API; keep the
    // original animal and use whole-entity movement, not a manufactured mesh.
    assert.equal(createPetShapeTimeline(definition),undefined)
    assert.equal(createPetShapeTimeline(definition,true),undefined)
  }
  assert.equal(petAppearance('cat','skin-siamese').scene.appearance.coatPattern.density,0)
})
test('each pet keeps its native seeded pose regardless of cache insertion order or equipped skin', () => {
  const entities=['first-pet','second-pet','third-pet'].map(id=>({id,species:'cat',skinId:'skin-white'}))
  for(const entity of entities) {
    const definition=petAppearance(entity)
    const expected={...resolveSeededAvatarView(`pet-${entity.id}`,createDefaultAvatarDefinition().scene.view),scale:PET_AVATAR_SCALE}
    assert.deepEqual(definition.scene.view,expected)
    assert.equal(petAppearance({...entity}),definition)
    assert.deepEqual(petAppearance(entity,'skin-orange').scene.view,expected)
  }
  assert.notDeepEqual(petAppearance(entities[0]).scene.view,petAppearance(entities[1]).scene.view)
})

test('composer placement does not inherit the gallery crop', () => {
  const pet={id:'cropped-pet',species:'cat',skinId:'skin-white'}
  const gallery=petAppearance(pet)
  const composer=petComposerAppearance(pet)
  for(const key of ['positionX','positionY','yaw','pitch','roll']) assert.equal(composer.scene.view[key],0)
  assert.equal(composer.scene.entity,gallery.scene.entity)
  assert.equal(composer.scene.appearance,gallery.scene.appearance)
  assert.equal(petComposerAppearance(pet),composer)
  assert.notDeepEqual(gallery.scene.view,composer.scene.view)
})

test('every catalog species and coat resolves to its declared native preset and palette', async () => {
  const result = await build({entryPoints:['src/pet-catalog.ts'],bundle:true,write:false,format:'esm',platform:'node'})
  const {PET_CATALOG,PET_DEFAULT_SKINS}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
  const ids=new Set()
  for(const product of PET_CATALOG) {
    assert.ok(!ids.has(product.id),`duplicate ${product.id}`);ids.add(product.id)
    if(product.kind !== 'skin')continue
    const definition=parseAvatarDefinition(petAppearance(product.species,product.id))
    assert.equal(definition.scene.entity.preset,product.species)
    assert.equal(getAvatarPalette(product.paletteId).id,product.paletteId)
    assert.equal(definition.scene.appearance.paletteId,product.paletteId)
  }
  for(const product of PET_CATALOG.filter(item=>item.kind==='pet')) {
    const skin=PET_CATALOG.find(item=>item.id===PET_DEFAULT_SKINS[product.species])
    assert.equal(skin.species,product.species)
    assert.equal(skin.price,0)
  }
})
