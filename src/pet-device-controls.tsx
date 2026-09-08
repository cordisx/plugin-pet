import { PetDeviceArt, PET_DEVICE_ART_STYLES } from './pet-device-art.js'
import { useState } from 'cordisx/react'
import { Button, Select } from 'cordisx/ui'
import { PET_CATALOG, type PetProduct } from './pet-catalog.js'
import { deviceCapacity, deviceFoodCount } from './pet-devices.js'
import type { PetCommand, PetState } from './pet-domain.js'
import type { PetPageNavigation } from './pet-pages.js'
import { PetFoodArt } from './pet-food-art.js'

type DeviceProps = {
  item: PetProduct; state: PetState; busy: boolean
  run: (command: PetCommand) => void; navigation?: PetPageNavigation
}
function DeviceIcon({ kind }: { kind: 'shop' | 'power' | 'fill' | 'food' | 'upgrade' }) {
  const paths = { upgrade: 'M12 21V3m-6 6 6-6 6 6M5 17H3v4h4M19 17h2v4h-4', shop: 'M3 10h18l-2-7H5ZM4 10v11h16V10M9 21v-7h6v7', power: 'M12 2v10M6 5a9 9 0 1 0 12 0', fill: 'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6', food: 'M3 11h18c0 11-18 11-18 0ZM8 3v4M13 2v5M18 3v4' }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
function openDeviceProduct(navigation: PetPageNavigation | undefined, item: PetProduct) {
  if (!navigation) return
  navigation.session.filter = item.device ? 'device' : item.kind
  navigation.session.product = item.id
  navigation.session.anchor = item.id
  navigation.session.hideOwned = false
  navigation.open('shop')
}
export function DeviceControl({ item, state, busy, run, navigation }: DeviceProps) {
  const [foodId, setFoodId] = useState(state.devices.foodId)
  const [quantity, setQuantity] = useState(1)
  const [expanded, setExpanded] = useState(false)
  if (!item.device) return null
  const water = item.device === 'water'
  const capacity = deviceCapacity(state, item.device)
  const owned = (state.itemInventory[item.id] ?? 0) > 0
  const enabled = water ? state.devices.waterEnabled : state.devices.feederEnabled
  const stored = water ? state.devices.waterStored : deviceFoodCount(state.devices)
  const free = Math.max(0, (water ? Math.ceil(capacity.capacity - stored) : Math.floor(capacity.capacity - stored)))
  const upgradeCost = capacity.tier < 3 ? (water ? 240 : 360) * (capacity.tier === 2 ? 2 : 1) : 0
  const nextCapacity = (water ? [0, 300, 800, 2000] : [0, 6, 18, 48])[Math.min(3, capacity.tier + 1)]!
  const nextService = [0, 2, 4, 8][Math.min(3, capacity.tier + 1)]!
  const foods = PET_CATALOG.filter(food => food.kind === 'food')
  const selectedFood = foods.find(food => food.id === foodId) ?? foods[0]
  const stock = selectedFood ? state.foodInventory[selectedFood.id] ?? 0 : 0
  const maximum = Math.min(free, stock)
  const loadQuantity = Math.max(1, Math.min(quantity, Math.max(1, maximum)))
  const stateLabel = !owned ? '尚未拥有' : !enabled ? '已暂停' : stored <= 0 ? '空仓 · 已停止供给' : '自动供给中'
  return <section className="pet-reservoir" aria-label={item.name}>
    <div className="pet-reservoir-heading"><button className="pet-reservoir-summary" type="button" aria-label={owned ? `管理${item.name}` : `查看${item.name}`} aria-expanded={owned ? expanded : undefined} onClick={() => owned ? setExpanded(!expanded) : openDeviceProduct(navigation,item)}><PetDeviceArt device={item.device} tier={capacity.tier} fill={capacity.capacity ? stored/capacity.capacity : 0} foodId={state.devices.foodQueue[0]?.foodId} enabled={enabled} /><span><strong>{item.name}{owned && <em>Lv.{capacity.tier}</em>}</strong><small>{owned ? `${Math.floor(stored)} / ${capacity.capacity}${!enabled ? ' · 已暂停' : stored <= 0 ? ' · 空仓' : ''}` : '未拥有'}</small></span><span className="pet-reservoir-chevron" aria-hidden="true">{owned ? expanded ? '⌃' : '⌄' : ''}</span></button><Button variant="ghost" aria-label={!owned ? `购买${item.name}` : water ? '加满清水' : '补充食物'} title={!owned ? '去购买' : water ? free <= 0 ? '储水已满' : '加满清水' : '选择食物装入'} disabled={busy || (owned && water && free <= 0)} onClick={() => !owned ? openDeviceProduct(navigation,item) : water ? run({type:'device-refill-water',quantity:free}) : setExpanded(true)}><DeviceIcon kind={!owned ? 'shop' : 'fill'} /></Button></div>
    {owned && <div className="pet-reservoir-management" hidden={!expanded}><div className="pet-reservoir-level"><small>{stateLabel} · 每轮 {capacity.serviceLimit} 只共用</small><Button variant="ghost" aria-label={`${enabled ? '暂停' : '启用'}${item.name}`} title={enabled ? '暂停设备' : '启用设备'} disabled={busy} onClick={() => run({type:'device-settings',value:water ? {waterEnabled:!enabled} : {feederEnabled:!enabled}})}><DeviceIcon kind="power" /></Button></div><meter aria-label={water ? '储水量' : '储粮量'} min={0} max={capacity.capacity} value={stored} />
      {water ? <small>饮水低于 35 时自动补充；空仓停止供给。</small>
      : <><div className="pet-reservoir-loader"><Select aria-label="装入的食物" value={selectedFood?.id ?? ''} disabled={busy} options={foods.map(food => ({ value: food.id, label: `${food.name} · 背包 ${state.foodInventory[food.id] ?? 0}` }))} onChange={id => { setFoodId(id); setQuantity(1) }} /><input aria-label="装入份数" title={`最多可装 ${maximum} 份`} type="number" min={1} max={Math.max(1, maximum)} step={1} value={loadQuantity} disabled={busy || maximum <= 0} onChange={event => setQuantity(Math.max(1, Math.min(maximum, Math.trunc(event.currentTarget.valueAsNumber) || 1)))} /><Button variant="ghost" disabled={busy || !selectedFood || (stock > 0 && free <= 0)} aria-label={stock > 0 ? '装入食物' : `购买${selectedFood?.name ?? '食物'}`} title={stock > 0 ? free > 0 ? '从背包装入储粮仓' : '储粮仓已满' : '前往商店补给'} onClick={() => { if (selectedFood) { if (stock > 0) run({ type: 'device-load-food', foodId: selectedFood.id, quantity: loadQuantity }); else openDeviceProduct(navigation, selectedFood) } }}><DeviceIcon kind={stock > 0 ? 'fill' : 'shop'} /></Button></div>
        {state.devices.foodQueue.length > 0 ? <ol className="pet-reservoir-queue" aria-label="储粮投放顺序">{state.devices.foodQueue.map((batch, index) => { const food = foods.find(food => food.id === batch.foodId); return <li key={`${index}:${batch.foodId}`}><PetFoodArt id={batch.foodId} /><div><strong>{food?.name ?? batch.foodId} × {batch.quantity}</strong><small>营养 {food?.fullness ?? 0} · 精力 +{food?.energy ?? 0} · 心情 +{food?.mood ?? 0}</small></div></li> })}</ol> : <small className="pet-reservoir-empty">储粮仓为空 · 装入后才会自动喂食</small>}
        <small className="pet-reservoir-note">按装入顺序投放；实际饱食恢复随宠物体重和吸收能力变化。</small></>}
      {capacity.tier < 3 ? <div className="pet-reservoir-upgrade"><small>升级至 Lv.{capacity.tier + 1} · 容量 {nextCapacity} · 每轮 {nextService} 只</small><Button variant="ghost" disabled={busy || state.wallet.balance < upgradeCost} title={`升级需 ${upgradeCost} 宠物币`} aria-label={`升级${item.name}，${upgradeCost} 宠物币`} onClick={() => run({type:'device-upgrade',device:item.device!})}><DeviceIcon kind="upgrade" />{upgradeCost}</Button></div> : <small>Lv.3 · 已达最高级</small>}
    </div>}
  </section>
}
export const PET_DEVICE_STYLES = `${PET_DEVICE_ART_STYLES}

.pet-reservoir{display:flex;flex-direction:column;min-width:0;border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent);padding:8px 0}.pet-reservoir:last-child{border-bottom:0}
.pet-reservoir-heading{display:flex;align-items:center;gap:8px}.pet-reservoir-summary{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.pet-reservoir-summary:focus-visible{outline:2px solid #78b8cb;outline-offset:3px;border-radius:6px}.pet-reservoir-summary .pet-device-art{width:56px}.pet-reservoir-summary>span:nth-child(2){display:flex;flex-direction:column;gap:5px;flex:1}.pet-reservoir-summary strong{font-size:13px;font-weight:550}.pet-reservoir-summary em{font-size:10px;font-style:normal;opacity:.45;margin-left:8px}.pet-reservoir small{font-size:11px;line-height:1.4;opacity:.65}.pet-reservoir-chevron{opacity:.4;font-size:13px}.pet-reservoir-management:not([hidden]){display:flex;flex-direction:column;gap:10px;padding:4px 4px 12px 66px}.pet-reservoir-management[hidden]{display:none}
.pet-reservoir-level{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px}.pet-reservoir meter{width:100%;height:8px;accent-color:#78b8cb}.pet-reservoir-fill,.pet-reservoir-upgrade{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pet-reservoir-loader{display:grid;grid-template-columns:minmax(0,1fr) 48px auto;align-items:center;gap:6px}.pet-reservoir-loader input{box-sizing:border-box;width:48px;min-width:0;padding:8px 3px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:8px;text-align:center;color:inherit;background:transparent;font:inherit}.pet-reservoir-loader input:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.pet-reservoir-queue{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;margin:0;padding:4px 0 8px;list-style:none}.pet-reservoir-queue li{display:flex;align-items:center;gap:8px;flex:0 0 auto;max-width:220px;padding:8px;border-radius:10px;background:color-mix(in srgb,currentColor 4%,transparent)}.pet-reservoir-queue img{width:42px;height:42px;flex:none}.pet-reservoir-queue li>div{display:flex;flex-direction:column;gap:4px}.pet-reservoir-queue strong{font-size:12px}.pet-reservoir-note,.pet-reservoir-empty{display:block}
`
