import assert from 'node:assert/strict'
import test from 'node:test'
import { idlePose } from '../src/pet-idle.ts'
import { build } from 'esbuild'
const bundle = await build({entryPoints:['src/pet-scene-model.ts'],bundle:true,write:false,format:'esm',platform:'node'})
const {requestSceneRest,createSceneBody,inputSceneBody,advanceScene,sceneTravel,reportScenePosition,syncScenePosition,advanceSceneScale,sceneHitRegion,restingSceneIds,reconcileSceneBodies} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
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

test('disabled dragging preserves position and disabled click feedback never accumulates irritation', () => {
  const a = body()
  const original = a.x
  for (const phase of ['start','move','end']) inputSceneBody(a,{phase,deltaX:100,deltaY:-150},bounds,100,{draggable:false})
  assert.equal(a.x,original); assert.equal(a.y,0); assert.equal(a.dragging,false)
  for(let i=0;i<10;i++) inputSceneBody(a,{phase:'activate',deltaX:0,deltaY:0},bounds,200+i,{clickFeedback:false})
  assert.equal(a.irritation,0)
})
test('affinity rerenders and asynchronous save acknowledgements retain idle drift; external position resets apply', () => {
  const a=body()
  a.x+=40
  const written=reportScenePosition(a,640)
  a.mode='roll'; a.pose=idlePose('roll',1000,80)
  const visible=a.x+a.pose.dx
  assert.equal(syncScenePosition(a,.3,640,1000),false)
  assert.equal(syncScenePosition(a,written,640,1001),false)
  assert.equal(a.x+a.pose.dx,visible)
  assert.equal(a.mode,'roll')
  assert.equal(syncScenePosition(a,.9,640,1002),true)
  assert.equal(a.x,.9*(640-128)); assert.equal(a.pose.dx,0)
})

test('coalesced menu-open snapshot releases pending drag and freezes pose without parent state', () => {
  const a=body()
  inputSceneBody(a,{phase:'start',deltaX:0,deltaY:0},bounds,0)
  inputSceneBody(a,{phase:'move',deltaX:30,deltaY:-80},bounds,100)
  inputSceneBody(a,{phase:'idle',menuOpen:true,deltaX:0,deltaY:0},bounds,101)
  assert.equal(a.dragging,false); assert.equal(a.pressed,false)
  const y=a.y
  advanceScene([a],bounds,132,32,opts)
  advanceScene([a],bounds,3000,32,opts)
  assert.equal(a.y,y)
  inputSceneBody(a,{phase:'idle',menuOpen:false,deltaX:0,deltaY:0},bounds,3001)
  advanceScene([a],bounds,3032,32,opts)
  assert.ok(a.y>y)
})
test('all public pet appearances retain morphable head and skin across roll and lift', async () => {
  const compiled = await build({entryPoints:['src/pet-appearance.ts','src/pet-scene-shape.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
  const modules = await Promise.all(compiled.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
  const {petAppearance}=modules[0]
  const {createPetShapeTimeline}=modules[1]
  const {resolveAvatarAnimationTimelineFrame}=await import('@oneworks/avatar')
  for(const species of ['cat','dog','rabbit']) {
    const definition=petAppearance(species)
    for(const lifted of [false,true]) {
      const timeline=createPetShapeTimeline(definition,lifted)
      assert.ok(timeline)
      for(const sample of [0,250,500,1000]) {
        const frame=resolveAvatarAnimationTimelineFrame(definition,timeline,sample)
        assert.equal(frame.scene.entity.parts.filter(part=>part.face).length,1)
        assert.equal(frame.scene.appearance.paletteId,definition.scene.appearance.paletteId)
        for(const part of frame.scene.entity.parts) assert.ok(part.scaleX>0 && part.scaleY>0)
      }
    }
  }
})

test('body size interpolates while saved position and head baseline stay fixed', () => {
  const a=body()
  const originalX=a.x
  const baseline=sceneHitRegion(a,bounds).y+sceneHitRegion(a,bounds).height
  const initial=advanceSceneScale(a.sizeScale,1.18,32,false)
  assert.ok(initial>1 && initial<1.18)
  for(let i=0;i<200;i++) a.sizeScale=advanceSceneScale(a.sizeScale,1.18,32,false)
  assert.equal(a.sizeScale,1.18)
  const large=sceneHitRegion(a,bounds)
  assert.ok(Math.abs(large.y+large.height-baseline)<.000001)
  assert.equal(a.x,originalX);assert.equal(a.y,0)
  assert.ok(large.x>=0 && large.x+large.width<=bounds.width)
  a.sizeScale=advanceSceneScale(a.sizeScale,.85,32,true)
  const small=sceneHitRegion(a,bounds)
  assert.equal(a.sizeScale,.85);assert.ok(small.width<large.width)
  assert.ok(Math.abs(small.y+small.height-baseline)<.000001)
})
test('resting set uses stable identity order and excludes waking or manipulated pets', () => {
  const a=body('a'),b=body('b'),c=body('c')
  a.mode='sleep';b.mode='sleep';c.mode='wake'
  assert.deepEqual(restingSceneIds([b,c,a]),['a','b'])
  a.pressed=true
  assert.deepEqual(restingSceneIds([b,c,a]),['b'])
  assert.deepEqual(restingSceneIds([c]),[])
})

test('static settings retain sleep care state without decorative motion and clicks or drags wake it', () => {
  for(const staticOptions of [{reducedMotion:true},{idleAnimations:false}]) {
    const a=body()
    const settings={...opts,...staticOptions}
    advanceScene([a],bounds,61000,32,settings)
    assert.equal(a.mode,'sleep');assert.deepEqual(restingSceneIds([a]),['cat'])
    assert.equal(a.pose.eyes,.06)
    assert.equal(a.pose.scaleX,1);assert.equal(a.pose.scaleY,1)
    assert.equal(a.pose.dx,0);assert.equal(a.pose.y,0);assert.equal(a.pose.angle,0)
    const slept=structuredClone(a.pose)
    advanceScene([a],bounds,65000,32,settings)
    assert.deepEqual(a.pose,slept)
    inputSceneBody(a,{phase:'activate',deltaX:0,deltaY:0},bounds,65001)
    advanceScene([a],bounds,65032,32,settings)
    assert.equal(a.mode,'rest');assert.equal(a.pose.eyes,1)
    assert.deepEqual(restingSceneIds([a]),[])
    advanceScene([a],bounds,130000,32,settings)
    assert.equal(a.mode,'sleep')
    inputSceneBody(a,{phase:'start',deltaX:0,deltaY:0},bounds,130001)
    inputSceneBody(a,{phase:'move',deltaX:5,deltaY:-20},bounds,130033)
    assert.deepEqual(restingSceneIds([a]),[])
    assert.equal(a.dragging,true)
  }
})
test('re-enabling animations retains a settled sleeping face and resting position', () => {
  const a=body()
  advanceScene([a],bounds,61000,32,{...opts,idleAnimations:false})
  const x=a.x
  advanceScene([a],bounds,61032,32,opts)
  assert.equal(a.mode,'sleep');assert.ok(Math.abs(a.pose.eyes-.06)<.00001)
  assert.ok(Math.abs(a.pose.scaleY-1)<.012)
  assert.equal(a.x,x);assert.equal(a.pose.dx,0);assert.equal(a.y,0)
})

test('new arrivals reserve free ground without changing any existing entity', () => {
  const existing=body('cat',.6)
  const original=structuredClone(existing)
  const result=reconcileSceneBodies([existing],[{id:'dog',x:.62},{id:'cat',x:.6},{id:'rabbit',x:.6}],640,100)
  assert.equal(result[1],existing)
  assert.deepEqual(existing,original)
  for(let i=0;i<result.length;i++) for(let j=i+1;j<result.length;j++) assert.ok(Math.abs(result[i].x-result[j].x)>=128*.7+6-.001)
})
test('crowded new arrivals stay in bounds and do not eject old pets', () => {
  const old=createSceneBody({id:'a',x:0},150,0,0)
  const result=reconcileSceneBodies([old],[{id:'a',x:0},{id:'b',x:0},{id:'c',x:1}],150,100)
  assert.equal(old.x,0)
  assert.ok(result.every(body=>body.x>=0 && body.x<=22))
})

test('manual rest survives recovery from an interrupted hop and settles into sleep', () => {
  const pet = body()
  pet.mode = 'hop'; pet.pose = idlePose('hop', 500, 80)
  requestSceneRest(pet, 500)
  for (let now = 532; now <= 2500; now += 32) advanceScene([pet], bounds, now, 32, opts)
  assert.equal(pet.mode, 'sleep')
  assert.deepEqual(restingSceneIds([pet]), ['cat'])
  inputSceneBody(pet, {phase:'start',deltaX:0,deltaY:0}, bounds, 2600)
  assert.equal(pet.sleepRequested, false)
})
