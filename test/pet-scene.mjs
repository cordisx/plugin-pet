import assert from 'node:assert/strict'
import test from 'node:test'
import { idlePose } from '../src/pet-idle.ts'
import { build } from 'esbuild'
const bundle = await build({entryPoints:['src/pet-scene-model.ts'],bundle:true,write:false,format:'esm',platform:'node'})
const {createSceneBody,inputSceneBody,advanceScene,sceneTravel} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const bounds = { width: 640, height: 350 }
const opts = { reducedMotion: false, idleAnimations: true, random: () => .8 }
const body = (id = 'cat', x = .3) => createSceneBody({id,x},640,0,0)
test('roll curls before travel and unfolds after a full turn without positional jump', () => {
  const early = idlePose('roll',450,100)
  assert.equal(early.ball,1); assert.equal(early.dx,0)
  const finish = idlePose('roll',2600,100)
  assert.equal(finish.ball,0); assert.equal(finish.dx,100); assert.equal(finish.angle,360)
  const middle = idlePose('roll',1300,100)
  assert.ok(middle.dx > 0 && middle.dx < 100)
})
test('drag interruption retains visible position and affects only selected entity', () => {
  const a = body(), b = body('dog',.8)
  a.mode='roll'; a.pose=idlePose('roll',1200,100)
  const visible = a.x+a.pose.dx
  inputSceneBody(a,{phase:'start',deltaX:0,deltaY:0},bounds,1200)
  assert.equal(a.x,visible)
  inputSceneBody(a,{phase:'move',deltaX:20,deltaY:-100},bounds,1232)
  assert.equal(a.x,visible+20); assert.equal(a.y,-100); assert.equal(b.y,0)
  inputSceneBody(a,{phase:'end',deltaX:20,deltaY:-100},bounds,1300)
  for(let i=0;i<50;i++) advanceScene([a,b],bounds,1332+i*32,32,opts)
  assert.equal(a.y,0); assert.equal(a.dragging,false)
})
test('travel reserves clear path and a shared scene starts only one moving pet', () => {
  const a=body('a',0), b=body('b',.4), c=body('c',.9)
  assert.ok(sceneTravel(a,[a,b,c],640,1,500)<=b.x-128*.7)
  a.nextAction=0;b.nextAction=0;c.nextAction=0
  advanceScene([a,b,c],bounds,100,32,opts)
  assert.equal([a,b,c].filter(p=>p.mode==='roll'||p.mode==='hop').length,1)
})
test('sleep wakes on first click without irritation and menu pause preserves animation time', () => {
  const a=body();a.mode='sleep';a.started=0
  inputSceneBody(a,{phase:'start',deltaX:0,deltaY:0},bounds,3000)
  inputSceneBody(a,{phase:'activate',deltaX:0,deltaY:0},bounds,3050)
  assert.equal(a.mode,'wake'); assert.equal(a.irritation,0)
  a.mode='roll';a.started=4000;a.distance=80
  advanceScene([a],bounds,4500,32,{...opts,pausedIds:['cat']})
  advanceScene([a],bounds,9500,32,{...opts,pausedIds:['cat']})
  advanceScene([a],bounds,9532,32,opts)
  assert.equal(a.started,9032)
  assert.equal(a.pose.dx,idlePose('roll',500,80).dx)
})
test('reduced motion settles fall and suppresses autonomous travel', () => {
  const a=body();a.y=-100;a.nextAction=0
  advanceScene([a],bounds,2000,32,{...opts,reducedMotion:true})
  assert.equal(a.y,0);assert.equal(a.mode,'rest');assert.equal(a.pose.angle,0)
})
test('public Avatar timeline preserves head and skin through partial curl and release', async () => {
  const compiled = await build({entryPoints:['src/pet-scene-shape.ts'],bundle:true,write:false,format:'esm',platform:'node'})
  const {createPetShapeTimeline} = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
  const {composerAvatarDefinition} = await import('../src/avatar-model.ts')
  const {resolveAvatarAnimationTimelineFrame} = await import('@oneworks/avatar')
  const definition = composerAvatarDefinition('white',.5,.5,true)
  const timeline = createPetShapeTimeline(definition)
  for (const time of [0,200,500,1000,500,0]) {
    const frame = resolveAvatarAnimationTimelineFrame(definition,timeline,time)
    assert.ok(frame.scene.entity.parts.some(part=>part.face))
    assert.equal(frame.scene.appearance.paletteId,definition.scene.appearance.paletteId)
    const head = frame.scene.entity.parts.find(part=>part.face)
    assert.ok(head.scaleX>0 && head.scaleY>0)
  }
  assert.equal(createPetShapeTimeline(composerAvatarDefinition('white',.5,.5,false)),undefined)
})
