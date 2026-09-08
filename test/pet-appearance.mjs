import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { getAvatarPalette, parseAvatarDefinition, createDefaultAvatarDefinition, resolveSeededAvatarView } from '@oneworks/avatar'
const bundled = await build({entryPoints:['src/pet-appearance.ts','src/pet-scene-shape.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
const modules = await Promise.all(bundled.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {petAppearance,PET_AVATAR_SCALE}=modules[0]
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
