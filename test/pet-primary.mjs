import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle = await build({entryPoints:['src/pet-primary-pose.ts','src/pet-appearance.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
const modules = await Promise.all(bundle.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {advancePrimaryGaze,primaryDefinition,primaryMode,primaryWeightFactor,primaryWeightDefinition}=modules[0]
const {petAppearance}=modules[1]
test('dictation recording and transcription have distinct priority states', () => {
  assert.equal(primaryMode({schemaVersion:2,dictation:'recording'}),'recording')
  assert.equal(primaryMode({schemaVersion:2,dictation:'starting'}),'thinking')
  assert.equal(primaryMode({schemaVersion:2,dictation:'transcribing'}),'thinking')
  assert.equal(primaryMode({schemaVersion:2,dictation:'idle',action:'stop'}),'idle')
})
test('gaze re-entry interpolates from retained position and eventually stops scheduling work', () => {
  let current={x:.1,y:.8}
  const target={x:.9,y:.2}
  const initial=advancePrimaryGaze(current,target,32,false)
  assert.ok(initial.gaze.x>.1 && initial.gaze.x<.9)
  assert.equal(initial.settled,false)
  let settled=false
  for(let i=0;i<30 && !settled;i++) ({gaze:current,settled}=advancePrimaryGaze(current,target,32,false))
  assert.equal(settled,true);assert.deepEqual(current,target)
  assert.deepEqual(advancePrimaryGaze(current,{x:.5,y:.5},32,true),{gaze:{x:.5,y:.5},settled:true})
})
test('state face preserves each species, skin, and head geometry while adjusting primary framing', () => {
  for(const species of ['cat','dog','rabbit']) {
    const base=petAppearance(species)
    for(const mode of ['idle','recording','thinking']) {
      const result=primaryDefinition(base,{x:.5,y:.5},mode)
      assert.equal(result.scene.entity,base.scene.entity)
      assert.equal(result.scene.appearance,base.scene.appearance)
      assert.equal(result.scene.view.scale,1.9)
      assert.equal(result.scene.view.positionY,30)
      if(mode==='thinking') assert.notEqual(result.scene.face.leftEyeHeight,result.scene.face.rightEyeHeight)
    }
  }
})

test('weight quantization preserves neutral geometry and moves all attachments together without changing skin', () => {
  assert.equal(primaryWeightFactor(1),1)
  assert.equal(primaryWeightFactor(1.001),1)
  assert.equal(primaryWeightFactor(9),1.06)
  assert.equal(primaryWeightFactor(.1),.94)
  for(const species of ['cat','dog','rabbit']) {
    const base=petAppearance(species)
    assert.equal(primaryWeightDefinition(base,1),base)
    const altered=primaryWeightDefinition(base,1.06)
    assert.equal(altered.scene.appearance,base.scene.appearance)
    assert.equal(altered.scene.view,base.scene.view)
    const head=base.scene.entity.parts.find(part=>part.face)
    for(let index=0;index<base.scene.entity.parts.length;index++) {
      const original=base.scene.entity.parts[index], part=altered.scene.entity.parts[index]
      assert.equal(part.x,head.x+(original.x-head.x)*1.06)
      assert.equal(part.scaleX,original.scaleX*1.06)
      for(const key of ['baseColor','foregroundColor','highlightColor','shadowColor','y','scaleY']) assert.equal(part[key],original[key])
    }
  }
})
