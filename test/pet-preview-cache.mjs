import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const bundle=await build({entryPoints:['src/pet-preview-cache.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'react-hook-test',setup(build){build.onResolve({filter:/^cordisx\/react$/},()=>({path:'react',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export function useEffect(){}'}))}}]})
const {createPetPreviewCache}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function setup(capacity=128){const images=[],idle=new Set();const cache=createPetPreviewCache({createImage(){const image={src:'',onload:null,onerror:null};images.push(image);return image},idle(fn){idle.add(fn);return()=>idle.delete(fn)}},capacity);return{cache,images,idle,flush(){for(const f of [...idle]){idle.delete(f);f()}},done(image){image.onload?.()}}}
test('current URLs start first, duplicate requests share loads, and next page waits for idle',()=>{
 const env=setup();const stopA=env.cache.acquire(['a','b','a'],['c']);const stopB=env.cache.acquire(['a'])
 assert.deepEqual(env.images.map(i=>i.src),['a','b']);assert.equal(env.cache.snapshot().active,2)
 env.flush();assert.deepEqual(env.images.map(i=>i.src),['a','b','c'])
 stopA();assert.equal(env.images[0].src,'a');assert.equal(env.images[1].src,'');assert.equal(env.images[2].src,'')
 env.done(env.images[0]);stopB();assert.deepEqual(env.cache.snapshot(),{size:1,active:0,queued:0})
})
test('background work is bounded to four and yields to a newly selected page',()=>{
 const env=setup();env.cache.acquire([],['n1','n2','n3','n4','n5']);env.flush()
 assert.equal(env.cache.snapshot().active,4);assert.equal(env.cache.snapshot().queued,1)
 env.cache.acquire(['current'])
 assert.equal(env.images[4].src,'current');assert.equal(env.cache.snapshot().active,4)
 assert.ok(env.images.slice(0,4).every(i=>i.src===''))
})
test('cleanup cancels pending idle and in-flight requests; late callbacks cannot revive old generations',()=>{
 const env=setup();const stop=env.cache.acquire(['a'],['next']);const late=env.images[0].onload
 stop();env.flush();late();assert.equal(env.images.length,1);assert.deepEqual(env.cache.snapshot(),{size:0,active:0,queued:0})
 env.cache.acquire([],['idle-only']);env.cache.dispose();assert.equal(env.idle.size,0);env.flush()
 assert.equal(env.images.length,1)
})
test('loaded image cache is bounded and evicts old unused entries',()=>{
 const env=setup(2)
 for(const url of ['a','b','c']){const stop=env.cache.acquire([url]);env.done(env.images.at(-1));stop()}
 assert.equal(env.cache.snapshot().size,2)
 const stop=env.cache.acquire(['b']);assert.equal(env.images.length,3);stop()
 env.cache.acquire(['a']);assert.equal(env.images.length,4);assert.equal(env.cache.snapshot().size,2)
})
test('failed image loads release slots and may retry without a poisoned cache',()=>{
 const env=setup();const stop=env.cache.acquire(['broken']);env.images[0].onerror();assert.equal(env.cache.snapshot().size,0);stop()
 env.cache.acquire(['broken']);assert.equal(env.images.length,2);assert.equal(env.cache.snapshot().active,1)
 env.cache.dispose();assert.equal(env.cache.snapshot().active,0)
})
