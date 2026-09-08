import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const result = await build({ stdin: { contents: `export {DeviceControl} from './src/pet-device-controls.tsx'; export {createPetState} from './src/pet-domain.ts'; export {petProduct} from './src/pet-catalog.ts'`, resolveDir:process.cwd() }, bundle:true, format:'esm', platform:'node', write:false, loader:{'.png':'dataurl'}, plugins:[{name:'public-ui',setup(builder){
  builder.onResolve({filter:/^(cordisx\/react(?:\/jsx-runtime)?|react(?:\/jsx-runtime)?)$/},args=>({path:pathToFileURL(require.resolve(args.path.replace('cordisx/',''))).href,external:true}))
  builder.onResolve({filter:/^cordisx\/ui$/},()=>({path:'ui',namespace:'stub'}))
  builder.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:`import {createElement as h} from 'react';export const Button=({children,...p})=>h('button',p,children);export const Select=({'aria-label':label,options,value,disabled})=>h('select',{'aria-label':label,value,disabled,onChange:()=>{}},options.map(x=>h('option',{key:x.value,value:x.value},x.label)));`,loader:'js'}))
}}]})
const {DeviceControl,createPetState,petProduct}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const render=(state,id)=>renderToStaticMarkup(createElement(DeviceControl,{state,item:petProduct(id),busy:false,run:()=>{}}))
test('owned shared devices expose finite storage and refill without a pet selector',()=>{
  const state=createPetState();state.itemInventory['item-water-dispenser']=1;state.devices.waterLevel=1;state.devices.waterEnabled=true
  const html=render(state,'item-water-dispenser')
  assert.match(html,/储水量/);assert.match(html,/max="300"/);assert.match(html,/加满清水/)
  assert.match(html,/空仓 · 已停止供给/);assert.doesNotMatch(html,/选择.*宠物/)
})
test('feeder loading is bounded by remaining storage and owned inventory',()=>{
  const state=createPetState();state.itemInventory['item-auto-feeder']=1;state.devices.feederLevel=1;state.devices.foodQueue=[{foodId:'food-snack',quantity:5}]
  const html=render(state,'item-auto-feeder')
  assert.match(html,/aria-label="装入份数"[^>]*max="1"/)
  assert.match(html,/储粮投放顺序/);assert.match(html,/比特脆脆 × 5/)
  state.devices.foodQueue=[];state.foodInventory={}
  const empty=render(state,'item-auto-feeder')
  assert.match(empty,/储粮仓为空/);assert.match(empty,/aria-label="购买比特脆脆"/)
})
