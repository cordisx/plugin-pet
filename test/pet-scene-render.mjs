import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const result=await build({entryPoints:['src/pet-scene-render.ts','src/pet-scene-model.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output'})
const [render,model]=await Promise.all(result.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {captureSceneFrame,sameSceneRegion,advanceSceneGaze}=render
const {createSceneBody,sceneHitRegion,inputSceneBody,advanceScene}=model
const bounds={width:600,height:300}
test('one stationary region publication suffices for 300 frames, while movement and label changes publish', () => {
  const body=createSceneBody({id:'a',x:.5},600,0,0)
  let previous,publishes=0
  for(let i=0;i<300;i++) {
    const region={...sceneHitRegion(body,bounds),label:'cat'}
    if(!sameSceneRegion(previous,region)){previous=region;publishes++}
  }
  assert.equal(publishes,1)
  assert.equal(sameSceneRegion(previous,{...previous,x:previous.x+1}),false)
  assert.equal(sameSceneRegion(previous,{...previous,label:'dog'}),false)
})
test('static snapshots retain object identity; dragging only invalidates the selected pet', () => {
  const a=createSceneBody({id:'a',x:.3},600,0,0), b=createSceneBody({id:'b',x:.7},600,0,0)
  const first=captureSceneFrame([a,b],[],0,true)
  let current=first
  for(let i=0;i<300;i++) current=captureSceneFrame([a,b],current,i*32,true)
  assert.equal(current[0],first[0]);assert.equal(current[1],first[1])
  inputSceneBody(a,{phase:'start',deltaX:0,deltaY:0},bounds,10000)
  inputSceneBody(a,{phase:'move',deltaX:20,deltaY:-60},bounds,10032)
  const dragged=captureSceneFrame([a,b],current,10032,true)
  assert.notEqual(dragged[0],current[0]);assert.equal(dragged[1],current[1])
})
test('shared gaze clock converges without forcing perpetual component renders', () => {
  const a=createSceneBody({id:'a',x:.3},600,0,0)
  let previous=captureSceneFrame([a],[],0,false),changes=0
  for(let i=0;i<300;i++) {
    advanceSceneGaze(a,bounds,{x:1,y:.5},true)
    const next=captureSceneFrame([a],previous,i*32,false)
    if(next[0]!==previous[0])changes++
    previous=next
  }
  assert.ok(changes>1 && changes<20,`gaze updates: ${changes}`)
  const held=previous[0]
  advanceSceneGaze(a,bounds,null,true)
  assert.equal(captureSceneFrame([a],previous,10000,false)[0],held)
})
test('subpixel breathing keeps smooth small motion with fewer rendered snapshots', () => {
  const a=createSceneBody({id:'a',x:.3},600,0,0)
  let previous=captureSceneFrame([a],[],0,false),changes=0
  for(let i=1;i<=90;i++) {
    advanceScene([a],bounds,i*32,32,{reducedMotion:false,idleAnimations:true})
    const next=captureSceneFrame([a],previous,i*32,false)
    if(next[0]!==previous[0])changes++
    previous=next
  }
  assert.ok(changes>0 && changes<30,`90 ticks rendered ${changes} visible snapshots`)
})
