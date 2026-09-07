import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { getAvatarPalette, parseAvatarDefinition, resolveAvatarCoatPatternDecals, resolveAvatarAnimationTimelineFrame } from '@oneworks/avatar'
const bundled = await build({entryPoints:['src/pet-appearance.ts','src/pet-scene-shape.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
const modules = await Promise.all(bundled.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {petAppearance}=modules[0]
const {createPetShapeTimeline}=modules[1]
const skins=[['cat','skin-white'],['cat','skin-orange'],['cat','skin-siamese'],['cat','skin-friend'],['dog','skin-shiba'],['dog','skin-husky'],['rabbit','skin-lop'],['rabbit','skin-dutch']]
function decals(definition) {
  const {scene}=definition
  return resolveAvatarCoatPatternDecals({entityParts:scene.entity.parts,entityPreset:scene.entity.preset,paletteId:scene.appearance.paletteId,pattern:scene.appearance.coatPattern})
}
test('breed skins enable public procedural markings rather than changing only body color', () => {
  for(const [species,skin] of skins.filter(([,id])=>!['skin-white','skin-friend'].includes(id))) {
    const definition=petAppearance(species,skin)
    assert.equal(definition.scene.appearance.coatPattern.enabled,true)
    assert.ok(decals(definition).length>0,skin)
    assert.ok(decals(definition).every(decal=>definition.scene.entity.parts.some(part=>part.id===decal.targetPartId)),skin)
  }
  assert.equal(petAppearance('cat','skin-white').scene.appearance.coatPattern.enabled,false)
  const siamese=petAppearance('cat','skin-siamese')
  assert.equal(siamese.scene.appearance.coatPattern.density,0)
  assert.equal(decals(siamese).length,1)
  assert.ok(decals(petAppearance('cat','skin-orange')).length>1)
})
test('Siamese honors species-named ear materials and dog silhouette differs from cat', () => {
  const siamese=petAppearance('cat','skin-siamese')
  const palette=getAvatarPalette('siamese')
  assert.equal(siamese.scene.entity.parts[0].baseColor,palette.entityMaterials['cat-ear-left'].baseColor)
  const dog=petAppearance('dog'),cat=petAppearance('cat')
  assert.notEqual(dog.scene.entity.parts[0].shape,cat.scene.entity.parts[0].shape)
  assert.notEqual(dog.scene.entity.parts.find(part=>part.face).shape,cat.scene.entity.parts.find(part=>part.face).shape)
})
test('all skins keep a complete head and resolvable surface markings throughout public curl/lift morphs', () => {
  for(const [species,skin] of skins) {
    const definition=parseAvatarDefinition(petAppearance(species,skin))
    for(const lifted of [false,true]) {
      const timeline=createPetShapeTimeline(definition,lifted)
      for(const sample of [0,250,500,1000]) {
        const frame=resolveAvatarAnimationTimelineFrame(definition,timeline,sample)
        assert.equal(frame.scene.entity.parts.filter(part=>part.face).length,1)
        assert.equal(frame.scene.appearance.paletteId,definition.scene.appearance.paletteId)
        for(const part of frame.scene.entity.parts) assert.ok(part.scaleX>0 && part.scaleY>0)
        if(definition.scene.appearance.coatPattern.enabled) assert.ok(decals({scene:frame.scene}).length>0)
      }
    }
  }
})
