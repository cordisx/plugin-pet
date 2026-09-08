import { DeviceControl, PET_DEVICE_STYLES } from './pet-device-controls.js'
import { initialPetAttributes, foodEffect } from './pet-attributes.js'
import { initialPetTraits, PET_PERSONALITIES } from './pet-traits.js'
import { careWarning, initialPetCare, petWeightLabel } from './pet-care.js'
import { useEffect, useLayoutEffect, useRef, useMemo, useState, useSyncExternalStore } from 'cordisx/react'
import { Avatar } from '@oneworks/avatar-react'
import { Button, Card, EmptyState, Select, Stack, Text } from 'cordisx/ui'
import { PET_CATALOG, PET_DEFAULT_SKINS, PET_ECONOMY, petProduct } from './pet-catalog.js'
import type { PetProduct } from './pet-catalog.js'
import type { PetCommand, PetEntity, PetSettings, PetState } from './pet-domain.js'
import type { PetClient } from './pet-client.js'
import type { PetUsageStatus } from './pet-usage.js'
import { petAppearance } from './pet-appearance.js'
import { PetFoodArt } from './pet-food-art.js'

export type PetPageSection = 'shop' | 'pets' | 'bag' | 'settings' | 'ledger' | 'pet-detail' | 'product-detail' | 'bag-detail'
export type PetPageSession = { filter: string; hideOwned: boolean; selectedPet?: string; product?: string; anchor?: string }
export type PetPageNavigation = { session: PetPageSession; open: (section: PetPageSection) => void }
type Commands = { state: PetState; busy: boolean; run: (command: PetCommand) => void; usage?: PetUsageStatus; navigation?: PetPageNavigation; sleep?: (id: string) => void; wake?: (id: string) => void; restingPetIds?: string[] }
function Preview({ entity, skinId, peek = false }: { entity: PetEntity; skinId?: string; peek?: boolean }) {
  const definition = useMemo(() => petAppearance(entity, skinId), [entity.id, entity.species, entity.skinId, skinId])
  const pose = peekPose(entity.id)
  return <div className={peek ? 'pet-preview-stage pet-peek' : 'pet-preview-stage'} data-peek={peek ? pose.side : undefined} style={peek ? { '--pet-peek-angle': `${pose.angle}deg`, '--pet-peek-offset': `${pose.offset}%`, '--pet-peek-tint': pose.tint } as import('cordisx/react').CSSProperties : undefined}><Avatar className="pet-page-preview" definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`}
    style={{ width: peek ? '100%' : 152, height: peek ? '100%' : 152, alignSelf: 'center', flexShrink: 0 }} /></div>
}
/** Stable framing: care updates, renaming and remounting never reshuffle a pet. */
export function peekPose(id: string) {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  const side = (['bottom', 'left', 'right'] as const)[hash % 3]!
  return { side, tint: ['#dce5e9', '#e9dfd2', '#e1ddeb', '#dce6dd'][hash % 4]!, angle: side === 'left' ? 22 : side === 'right' ? -22 : (hash % 17) - 8, offset: 36 + hash % 25 }
}
function useShelf() {
  const ref = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(entries => setWide(entries[0]!.contentRect.width >= 680))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest' }) }, [])
  return { ref, wide }
}
function productEntity(product: PetProduct): PetEntity {
  const species = product.species ?? 'cat'
  return { attributes: initialPetAttributes(product.id), exploration: { onlineMs: 0, eventIndex: 0, events: [] }, traits: initialPetTraits(product.id), id: `preview:${product.id}`, species, skinId: product.kind === 'skin' ? product.id : PET_DEFAULT_SKINS[species], name: product.name, affinity: 0, x: .5, status: 'alive', care: initialPetCare(species) }
}
function Wallet({ state, usage }: { state: PetState; usage?: PetUsageStatus; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  return <Stack gap="small">
    <Text><strong>{state.wallet.balance.toLocaleString()} 宠物币</strong></Text>
    {usage?.status === 'ready' ? <>
      <Text tone="muted">每新增 {PET_ECONOMY.tokensPerCoin.toLocaleString()} Token 获得 1 宠物币，不足部分会保留。</Text>
      <Text tone="muted">仅统计启用后本机可确认的使用量，不包含全部历史或其他设备。最近同步：{new Date(usage.observedThrough).toLocaleTimeString()}。</Text>
    </> : <Text tone="muted">{usage?.status === 'initializing' ? '正在同步使用奖励…'
      : usage?.status === 'unavailable' && usage.reason === 'permission-denied' ? '使用奖励未开启。可在插件权限中管理。'
      : '使用奖励暂不可用，恢复后会继续同步。免费外观、欢迎点心和相伴解锁仍可体验。'}</Text>}
  </Stack>
}
function ownedProduct(state: PetState, item: PetProduct) {
  return item.kind === 'pet' ? state.pets.some(pet => pet.species === item.species) : item.kind === 'skin' ? state.ownedSkinIds.includes(item.id) : item.device ? (state.itemInventory[item.id] ?? 0) > 0 : false
}
function Glyph({ kind }: { kind: 'water' | 'smile' | 'brain' | 'luck' | 'more' | 'edit' | 'back' | 'settings' | 'shop' | 'bag' | 'paw' | 'coin' | 'food' | 'heart' | 'energy' | 'outfit' | 'moon' | 'arrow' }) {
  const paths = { water: 'M12 2C8 8 4 11 4 15a8 8 0 0 0 16 0c0-4-4-7-8-13Z', smile: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0M8 9h.01M16 9h.01M7 14q5 7 10 0', brain: 'M12 21V3M12 5C3-4 0 13 7 13M7 13c-7 5 3 13 5 5M12 5c9-9 12 8 5 8m0 0c7 5-3 13-5 5', luck: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', more: 'M4 12h.01M12 12h.01M20 12h.01', edit: 'm15 4 5 5M4 15l12-12 5 5L9 20l-6 1Z', back: 'm14 5-7 7 7 7M7 12h14', settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0', shop: 'M3 10h18l-2-7H5ZM4 10v11h16V10M9 21v-7h6v7', bag: 'M4 6h16v15H4ZM8 6V4a4 4 0 0 1 8 0v2M8 10v2M16 10v2', moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z', paw: 'M8 14c-4 7 12 7 8 0l-4-4Z M5 6v2 M10 3v2 M15 3v2 M20 6v2', coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12', food: 'M3 11h18c0 11-18 11-18 0Z M8 3v4 M13 2v5 M18 3v4', heart: 'M12 20 3 11C-2 2 10 1 12 7c2-6 14-5 9 4Z', energy: 'M14 2 5 14h7l-2 8 9-13h-7Z', outfit: 'M8 3 2 7l3 5 3-2v11h8V10l3 2 3-5-6-4c0 5-8 5-8 0Z', arrow: 'M8 4l8 8-8 8' }
  return <svg className="pet-glyph" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
function ProductActions({ item, state, busy, run, quantity = 1 }: Commands & { item: PetProduct; quantity?: number }) {
  const owned = ownedProduct(state, item)
  if (owned) return null
  const applicable = item.kind !== 'skin' || state.pets.some(pet => pet.species === item.species && pet.affinity >= (item.requiredAffinity ?? 0))
  const affinity = Math.max(0, ...state.pets.map(pet => pet.affinity))
  const reason = owned ? '已拥有' : !applicable ? '需要适用宠物及亲密度' : state.wallet.balance < item.price * quantity ? '宠物币不足' : ''
  return <Stack gap="small"><Stack direction="row" wrap gap="small">
    <Button disabled={busy || !!reason} title={reason || undefined} onClick={() => run({ type: 'buy', productId: item.id, quantity })}>{owned ? '已拥有' : item.price === 0 ? '领取' : item.kind === 'pet' ? '领养' : '购买'}</Button>
    {item.kind === 'pet' && item.requiredAffinity && !owned && <Button disabled={busy || affinity < item.requiredAffinity} onClick={() => run({ type: 'claim', productId: item.id })}>相伴解锁 {Math.min(affinity, item.requiredAffinity)}/{item.requiredAffinity}</Button>}
  </Stack>{reason && !owned && <Text tone="muted">{reason}</Text>}</Stack>
}
function ProductPreview({ item, peek = false }: { item: PetProduct; peek?: boolean }) {
  return item.kind === 'pet' || item.kind === 'skin' ? <Preview entity={productEntity(item)} peek={peek} /> : <div className="pet-preview-stage"><PetFoodArt id={item.id} /></div>
}
function Shop(props: Commands) {
  const { state, busy, navigation } = props
  const shelf = useShelf()
  const [selected, setSelected] = useState(navigation?.session.product)
  const [filter, setFilter] = useState(navigation?.session.filter ?? 'all')
  const [hideOwned, setHideOwned] = useState(navigation?.session.hideOwned ?? false)
  const products = PET_CATALOG.filter(item => (filter === 'all' || (filter === 'device' ? !!item.device : item.kind === filter && !item.device)) && (!hideOwned || !ownedProduct(state, item)))
  return <Stack gap="medium" style={{ height: '100%', minHeight: 0 }}>
    <Stack direction="row" gap="small" wrap align="center"><div className="pet-filters" role="group" aria-label="商品类型">{[['all','全部'],['pet','宠物'],['skin','皮肤'],['food','食物'],['item','道具'],['device','设备']].map(([id,label]) => <Button key={id} disabled={busy} aria-pressed={filter === id} variant={filter === id ? 'primary' : 'ghost'} onClick={() => { setFilter(id!); if (navigation) navigation.session.filter = id! }}><Glyph kind={id === 'all' ? 'shop' : id === 'pet' ? 'paw' : id === 'skin' ? 'outfit' : id === 'food' ? 'food' : id === 'device' ? 'settings' : 'luck'} />{label}</Button>)}</div>
      <label className="pet-check"><input type="checkbox" checked={hideOwned} disabled={busy} onChange={event => { setHideOwned(event.target.checked); if (navigation) navigation.session.hideOwned = event.target.checked }} />隐藏已拥有</label>
    </Stack>
    <div ref={shelf.ref} className="pet-shelf" data-wide={shelf.wide} data-reduced-motion={state.settings.reducedMotion}><div className="pet-tile-grid pet-shop-grid">{products.map(item => <button type="button" key={item.id} className="pet-tile" data-kind={item.kind} aria-pressed={selected === item.id} data-pet-anchor={item.id} onClick={() => { setSelected(item.id); if (navigation) { navigation.session.product = item.id; navigation.session.anchor = item.id; if (!shelf.wide) navigation.open('product-detail') } }}><ProductPreview item={item} peek /><span className="pet-tile-copy"><strong title={item.name}>{item.name}</strong><span className="pet-badge">{ownedProduct(state,item) ? state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已拥有' : item.price === 0 ? '免费' : <><Glyph kind="coin" />{item.price.toLocaleString()}</>}</span></span></button>)}</div>
      {shelf.wide && <aside className="pet-inspector" aria-label="选中商品详情">{products.some(item => item.id === selected) ? <ProductDetail key={selected} {...props} productId={selected} /> : <EmptyState title="挑一件喜欢的" description="选择左侧商品，查看外观与解锁方式。" />}</aside>}
    </div>
    {!products.length && <EmptyState title="没有符合条件的商品" description="试试其他分类，或显示已拥有的商品。" />}
  </Stack>
}
function CareStats({ entity }: { entity: PetEntity }) {
  return <Stack gap="small">
    <Text>{entity.status === 'dead' ? '已逝去' : entity.status === 'buried' ? '已安葬' : careWarning(entity.care)}</Text>
    {(['fullness', 'hydration', 'energy', 'mood', 'health'] as const).map((key, index) => <label className="pet-care-stat" data-stat={key} key={key}>
      <span className="pet-care-stat-label"><span><Glyph kind={(['food', 'water', 'energy', 'smile', 'heart'] as const)[index]!} /> {['饱食度', '饮水', '精力', '心情', '健康'][index]}</span><span>{Math.round(entity.care[key])}/100</span></span>
      <meter aria-label={['饱食度', '饮水', '精力', '心情', '健康'][index]} min={0} max={100} value={entity.care[key]} />
    </label>)}
    <Text tone="muted">体重 {entity.care.weight.toFixed(2)} kg · {petWeightLabel(entity)}</Text>
  </Stack>
}
function Afterlife({ entity, state, busy, run }: Commands & { entity: PetEntity }) {
  const [confirm, setConfirm] = useState(false)
  return <Stack gap="small"><Text tone="muted">可以安葬并保留纪念，也可以使用复活图腾复活。</Text><Stack direction="row" gap="small" wrap>
    {entity.status === 'dead' && <Button disabled={busy} onClick={() => { if (confirm) run({ type: 'bury', petId: entity.id }); else setConfirm(true) }}>{confirm ? '确认安葬并保留纪念' : '安葬'}</Button>}
    <Button disabled={busy || !(state.itemInventory['item-reboot-core'] > 0)} onClick={() => run({ type: 'revive', petId: entity.id })}>复活图腾复活（{state.itemInventory['item-reboot-core'] ?? 0}）</Button>
  </Stack></Stack>
}
function PetCard(props: Commands & { entity: PetEntity }) {
  const { entity, state, busy, run } = props
  const [name, setName] = useState(entity.name)
  const [editing, setEditing] = useState(false)
  const active = state.activePetIds.includes(entity.id)
  const alive = entity.status === 'alive'
  const definition = useMemo(() => petAppearance(entity), [entity.id, entity.species, entity.skinId])
  const tint = entity.skinId.includes('orange') ? '#ffc38c' : peekPose(entity.id).tint
  return <div className="pet-character-layout"><div className="pet-character">
    <div className="pet-character-portrait" style={{ background: tint }}>
      <span className="pet-character-species">{entity.species === 'cat' ? 'CAT' : entity.species === 'dog' ? 'DOG' : 'RABBIT'}</span>
      <Avatar definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`} style={{ width: '100%', height: '100%' }} />
      <span className="pet-character-sticker">{petProduct(entity.skinId).name}</span>
    </div>
    <div className="pet-character-info">
      <div className="pet-character-identity"><h2>{entity.name}</h2><Button variant="ghost" aria-label="修改名字" aria-expanded={editing} onClick={() => { setName(entity.name); setEditing(!editing) }}><Glyph kind="edit" /></Button>{entity.id === state.mainPetId && <span className="pet-character-main">★ 主宠</span>}</div>
      {editing && <form onSubmit={event => { event.preventDefault(); run({ type: 'rename', petId: entity.id, name }) }}><Stack direction="row" gap="small"><label className="pet-name-label" htmlFor={`name-${entity.id}`}>名字</label><input autoFocus className="pet-name-input" id={`name-${entity.id}`} value={name} maxLength={24} required disabled={busy} onChange={event => setName(event.currentTarget.value)} /><Button type="submit" disabled={busy || !name.trim() || name.trim() === entity.name}>保存</Button><Button variant="ghost" onClick={() => setEditing(false)}>完成</Button></Stack></form>}
      <div className="pet-character-bond"><Glyph kind="heart" /><strong>{entity.affinity}</strong><span>亲密度</span></div>
      <CareStats entity={entity} />
      <div className="pet-trait-chips"><span title={PET_PERSONALITIES[entity.traits.personality].description}>{PET_PERSONALITIES[entity.traits.personality].name}</span><span title="越高越容易通过互动获得好心情"><Glyph kind="brain" /> 智力 {entity.attributes.intelligence}</span><span title="参与在线散步发现食物的概率"><Glyph kind="luck" /> 幸运 {entity.attributes.luck}</span><span title="基础代谢倍率，越低饱食度消耗越慢">代谢 ×{entity.attributes.metabolism.toFixed(2)}</span><span title="营养吸收倍率">吸收 ×{entity.attributes.absorption.toFixed(2)}</span><span title="延缓饥饿的个体特征">耐饿 ×{entity.traits.hungerResistance.toFixed(1)}</span>{entity.attributes.talent === 'double-nutrition' && <span>天赋 · 双倍营养</span>}</div>
      {alive && <CareActions {...props} />}
      {entity.exploration.events.length > 0 && <div className="pet-exploration"><Glyph kind="luck" /> {entity.exploration.events.at(-1)!.detail}</div>}
      {!alive && <Afterlife entity={entity} state={state} busy={busy} run={run} />}
    </div>
  </div></div>
}
export function availableFoods(state: PetState) {
  return PET_CATALOG.filter(item => item.kind === 'food' && (state.foodInventory[item.id] ?? 0) > 0)
}
function openProduct(navigation: PetPageNavigation | undefined, item: PetProduct) {
  if (!navigation) return
  navigation.session.filter = item.device ? 'device' : item.kind
  navigation.session.product = item.id
  navigation.session.anchor = item.id
  navigation.session.hideOwned = false
  navigation.open('shop')
}
function FeedingTray({ entity, state, busy, run, navigation }: Commands & { entity: PetEntity }) {
  const foods = PET_CATALOG.filter(item => item.kind === 'food')
  const [selected, setSelected] = useState<string | undefined>()
  const food = foods.find(item => item.id === selected) ?? availableFoods(state)[0] ?? foods[0]
  if (!food) return null
  const stocked = (state.foodInventory[food.id] ?? 0) > 0
  const label = stocked ? `喂给${entity.name}` : `购买${food.name}`
  return <div className="pet-feeding-tray">
    <div className="pet-food-rail" role="group" aria-label="选择食物">{foods.map(item => <button type="button" className="pet-food-choice" key={item.id} aria-pressed={food.id === item.id} aria-label={`${item.name}，剩余 ${state.foodInventory[item.id] ?? 0} 份`} title={item.name} onClick={() => setSelected(item.id)}><PetFoodArt id={item.id} /><span className="pet-food-count">{state.foodInventory[item.id] ?? 0}</span></button>)}</div>
    <div className="pet-food-use"><div><strong>{food.name}</strong><div className="pet-food-effects"><span title="饱食度"><Glyph kind="food" /> +{Math.min(100-entity.care.fullness, foodEffect(entity, food).fullness).toFixed(1)}</span><span title="精力"><Glyph kind="energy" /> +{food.energy}</span><span title="心情"><Glyph kind="smile" /> +{Math.min(100-entity.care.mood,(food.mood ?? 0)*entity.traits.cheerfulness).toFixed(1)}</span><span title="亲密度"><Glyph kind="heart" /> +{food.affinity}</span></div></div><Button className="pet-care-icon" variant="ghost" aria-label={label} title={stocked && entity.care.fullness >= 100 ? '饱食度已满' : label} disabled={busy || (stocked && (entity.status !== 'alive' || entity.care.fullness >= 100))} onClick={() => stocked ? run({type:'feed',petId:entity.id,foodId:food.id}) : openProduct(navigation,food)}><Glyph kind={stocked ? 'food' : 'shop'} /></Button></div>
  </div>
}
function CareActions(props: Commands & { entity: PetEntity }) {
  const { entity, state, busy, run, navigation } = props
  const [panel, setPanel] = useState('food')
  const [skin, setSkin] = useState(entity.skinId)
  const [menu, setMenu] = useState(false)
  const menuRoot = useRef<HTMLDivElement>(null)
  const sleeping = props.restingPetIds?.includes(entity.id) ?? false
  const active = state.activePetIds.includes(entity.id)
  const alive = entity.status === 'alive'
  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => { if (!menuRoot.current?.contains(event.target as Node)) setMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(false); menuRoot.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',escape)
    menuRoot.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    return () => { document.removeEventListener('pointerdown',close); document.removeEventListener('keydown',escape) }
  },[menu])
  if (!alive) return <Afterlife {...props} />
  const skins = PET_CATALOG.filter(item => item.kind === 'skin' && item.species === entity.species && state.ownedSkinIds.includes(item.id))
  return <div className="pet-care-actions"><div className="pet-action-row">{([['food','food','喂食'],['water','water','饮水'],['skin','outfit','装扮'],['play','smile','互动'],['devices','settings','自动设备']] as const).map(([id,icon,label]) => <Button key={id} variant="ghost" aria-label={label} title={label} aria-pressed={panel === id} onClick={() => setPanel(id)}><Glyph kind={icon} /></Button>)}<Button variant="ghost" disabled={busy || !active} aria-label={sleeping ? '唤醒' : '休息'} title={active ? sleeping ? '唤醒' : '休息' : '出场后可以休息'} onClick={() => sleeping ? props.wake?.(entity.id) : props.sleep?.(entity.id)}><Glyph kind="moon" /></Button><div className="pet-more" ref={menuRoot}><Button variant="ghost" aria-label="更多操作" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Glyph kind="more" /></Button>{menu && <div className="pet-more-menu" role="menu" onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const index = items.indexOf(document.activeElement as HTMLButtonElement); items[(index+(event.key === 'ArrowDown' ? 1 : -1)+items.length)%items.length]?.focus() } }}><Button role="menuitem" variant="ghost" disabled={busy || (!active && state.activePetIds.length >= state.settings.maxActivePets)} onClick={() => { run({type:'setActive',petIds:active ? state.activePetIds.filter(id=>id!==entity.id) : [...state.activePetIds,entity.id]});setMenu(false) }}><Glyph kind="paw" />{active ? '收起' : '出场'}</Button><Button role="menuitem" variant="ghost" disabled={busy || entity.id === state.mainPetId} onClick={() => {run({type:'setMain',petId:entity.id});setMenu(false)}}><Glyph kind="luck" />设为主宠</Button><Button role="menuitem" variant="ghost" disabled={busy} onClick={() => {run({type:'move',petId:entity.id,x:.5});setMenu(false)}}><Glyph kind="back" />重置位置</Button></div>}</div></div>
    <div className="pet-care-panel">{panel === 'devices' && <div className="pet-device-list">{PET_CATALOG.filter(item=>item.device).map(item=><DeviceControl key={item.id} {...props} item={item} />)}</div>}{panel === 'food' && <FeedingTray {...props} />}{panel === 'water' && <div className="pet-water-use"><PetFoodArt id="water" /><span title="本次恢复饮水"><Glyph kind="water" /> +{Math.min(35,100-entity.care.hydration).toFixed(0)}</span><Button variant="ghost" className="pet-care-icon" aria-label="喝水" title="喝水" disabled={busy || entity.care.hydration >= 100} onClick={() => run({type:'water',petId:entity.id})}><Glyph kind="water" /></Button></div>}{panel === 'skin' && <><div className="pet-outfit-rail">{skins.map(item => <button className="pet-outfit-choice" key={item.id} aria-pressed={skin === item.id} onClick={() => setSkin(item.id)}><Preview entity={entity} skinId={item.id} /><span>{item.name}{entity.skinId === item.id ? ' · 已穿戴' : ''}</span></button>)}</div><div className="pet-food-use"><Button disabled={busy || skin === entity.skinId} onClick={() => run({type:'equip',petId:entity.id,skinId:skin})}>{skin === entity.skinId ? '已穿戴' : '穿上这件'}</Button><Button variant="ghost" onClick={() => { if(navigation){navigation.session.filter='skin';navigation.open('shop')} }}>更多装扮</Button></div></>}{panel === 'play' && <div className="pet-inline-use"><Glyph kind="smile" /><div><strong>{PET_PERSONALITIES[entity.traits.personality].name}的{entity.name}</strong><p>{PET_PERSONALITIES[entity.traits.personality].description}</p></div><Button disabled={busy || sleeping} onClick={() => run({type:'interact',petId:entity.id})}>陪它玩</Button></div>}</div>
  </div>
}
function AlbumPortrait({ entity, main }: { entity: PetEntity; main: boolean }) {
  const definition = useMemo(() => petAppearance(entity), [entity.id, entity.species, entity.skinId])
  const pose = peekPose(entity.id)
  const side = main ? 'bottom' : pose.side === 'bottom' ? 'right' : pose.side
  const tint = entity.skinId.includes('orange') ? '#ffc38c' : entity.species === 'dog' ? '#d7c9ec' : entity.species === 'rabbit' ? '#d9e6c9' : '#b9d1ee'
  return <div className="pet-album-art" data-peek={side} style={{ '--pet-album-tint': tint, '--pet-album-angle': `${main ? -5 : pose.angle}deg` } as import('cordisx/react').CSSProperties}><div className="pet-album-avatar"><Avatar definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`} style={{ width: '100%', height: '100%' }} /></div></div>
}
function Pets(props: Commands) {
  const { state, navigation, busy } = props
  const [selected, setSelected] = useState(navigation?.session.selectedPet ?? state.mainPetId)
  const entity = state.pets.find(pet => pet.id === selected) ?? state.pets[0]
  const gallery = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const strip = gallery.current
    const card = strip?.querySelector<HTMLElement>('[aria-pressed=true]')
    if (strip && card) strip.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - strip.clientWidth / 2, behavior: 'instant' })
  }, [entity?.id])
  if (!entity) return <EmptyState title="还没有宠物" description="前往商店领养一位伙伴。" />
  const alive = entity.status === 'alive'
  const active = state.activePetIds.includes(entity.id)
  const warning = alive ? careWarning(entity.care) : entity.status === 'dead' ? '已逝去' : '已安葬'
  return <div className="pet-album" data-reduced-motion={state.settings.reducedMotion}>
    <div ref={gallery} className="pet-album-gallery" role="group" aria-label="选择宠物">{state.pets.map((pet,index) => <button type="button" className="pet-album-portrait" key={pet.id} aria-pressed={entity.id === pet.id} onClick={() => { setSelected(pet.id); if (navigation) navigation.session.selectedPet = pet.id }}><AlbumPortrait entity={pet} main={pet.id === state.mainPetId} /><span className="pet-album-number" aria-hidden="true">{String(index + 1).padStart(2,'0')}</span>{pet.id === state.mainPetId && <span className="pet-album-main">★ 主宠</span>}<span className="pet-album-name">{pet.name}</span>{pet.status !== 'alive' && <span className="pet-album-status">{pet.status === 'dead' ? '已逝去' : '已安葬'}</span>}</button>)}</div>
    <section className="pet-album-care" aria-label="选中宠物"><div className="pet-album-summary"><button type="button" className="pet-album-selected-name" aria-label={`查看${entity.name}详情`} onClick={() => { if (navigation) { navigation.session.selectedPet = entity.id; navigation.open('pet-detail') } }}>{entity.name}</button><span className="pet-album-stat" title="亲密度" aria-label={`亲密度 ${entity.affinity}`}><Glyph kind="heart" /> {entity.affinity}</span><span className="pet-album-stat" title="饱食度" aria-label={`饱食度 ${Math.round(entity.care.fullness)}`}><Glyph kind="food" /> {Math.round(entity.care.fullness)}</span></div>
      {warning !== '状态良好' && <Text tone={alive ? 'muted' : 'danger'}>{warning}</Text>}
      <CareActions key={entity.id} {...props} entity={entity} />
    </section>
  </div>
}
function Bag(props: Commands) {
  const { state, navigation } = props
  const shelf = useShelf()
  const [selected, setSelected] = useState(navigation?.session.product)
  const items = PET_CATALOG.filter(item => item.kind === 'skin' ? state.ownedSkinIds.includes(item.id) : item.kind === 'food' ? (state.foodInventory[item.id] ?? 0) > 0 : item.kind === 'item' && (state.itemInventory[item.id] ?? 0) > 0)
  return <div ref={shelf.ref} className="pet-shelf" data-wide={shelf.wide} data-reduced-motion={state.settings.reducedMotion}><div className="pet-tile-grid">{items.map(item => <button type="button" key={item.id} className="pet-tile" data-kind={item.kind} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); if (navigation) { navigation.session.product = item.id; if (!shelf.wide) navigation.open('bag-detail') } }}><ProductPreview item={item} peek /><span className="pet-tile-copy"><strong>{item.name}</strong><span className="pet-badge">{item.kind === 'skin' ? state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已解锁' : `× ${item.kind === 'food' ? state.foodInventory[item.id] : state.itemInventory[item.id]}`}</span></span></button>)}{!items.length && <EmptyState title="背包还是空的" description="到商店挑选一些补给吧。" />}</div>{shelf.wide && <aside className="pet-inspector" aria-label="选中物品详情">{items.some(item => item.id === selected) ? <ProductDetail key={selected} {...props} inventory productId={selected} /> : <EmptyState title="选择一件物品" description="在这里试穿装扮，或为宠物补充能量。" />}</aside>}</div>
}
function ProductDetail(props: Commands & { inventory?: boolean; productId?: string }) {
  const { state, navigation, busy, run, inventory, productId } = props
  const item = PET_CATALOG.find(item => item.id === (productId ?? navigation?.session.product))
  const [selected, setSelected] = useState(navigation?.session.selectedPet ?? state.mainPetId)
  const [quantity, setQuantity] = useState(1)
  useEffect(() => setQuantity(1), [item?.id])
  if (!item) return <EmptyState title="请选择一件商品" />
  const consumable = item.kind === 'food' || (item.kind === 'item' && !item.device)
  const pets = state.pets.filter(pet => (!item.species || pet.species === item.species) && (item.kind === 'item' ? pet.status !== 'alive' : pet.status === 'alive'))
  const entity = pets.find(pet => pet.id === selected) ?? pets[0]
  const owned = ownedProduct(state, item)
  const count = item.kind === 'food' ? state.foodInventory[item.id] ?? 0 : state.itemInventory[item.id] ?? 0
  const foodFullness = item.kind === 'food' && inventory && entity ? Math.min(100 - entity.care.fullness, foodEffect(entity, item).fullness) : item.fullness
  const updateQuantity = (value: number) => setQuantity(Math.min(99, Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1)))
  return <div className="pet-product-detail"><div className="pet-product-scroll"><Stack gap="medium">
    {inventory && item.kind === 'skin' && entity ? <Preview entity={entity} skinId={item.id} /> : <ProductPreview item={item} />}
    <h3 className="pet-product-title">{item.name}</h3>{inventory && item.device && <DeviceControl {...props} item={item} />}
    <div className="pet-product-facts">
      {item.kind === 'food' ? <><span><Glyph kind="food" /><span>{inventory ? '本次饱食' : '营养'}<strong>+{Number(foodFullness).toFixed(1)}</strong></span></span><span><Glyph kind="energy" /><span>精力<strong>+{item.energy}</strong></span></span><span><Glyph kind="heart" /><span>亲密度<strong>+{item.affinity}</strong></span></span></>
      : item.device ? <span><Glyph kind="settings" /><span>自动照料<strong>{item.device === 'water' ? '储水供全体共用 · 需定期加水' : '装粮后自动投放 · 空仓停止供给'}</strong></span></span> : item.kind === 'item' ? <span><Glyph kind="heart" /><span>复活伙伴<strong>保留名字、装扮与亲密度</strong></span></span>
      : item.kind === 'skin' ? <span><Glyph kind="outfit" /><span>永久装扮<strong>{item.species === 'cat' ? '猫猫' : item.species === 'dog' ? '小狗' : '兔兔'}适用</strong></span></span>
      : <span><Glyph kind="paw" /><span>永久领养<strong>加入你的伙伴收藏</strong></span></span>}
    </div>
    {item.kind === 'food' && !inventory && <Text tone="muted">营养以 4 kg 体重为基准，实际恢复受体重和吸收能力影响。</Text>}
    {!!item.requiredAffinity && <Text><Glyph kind="heart" /> 亲密度 {item.requiredAffinity}{item.kind === 'pet' ? ' · 达成后可免费领养' : ''}</Text>}
    {inventory && item.kind !== 'pet' && !item.device && <Stack gap="medium">
      {pets.length ? <label className="pet-recipient"><span><Glyph kind="paw" /> 使用对象</span><Select aria-label="选择使用物品的宠物" value={entity!.id} options={pets.map(pet => ({ value: pet.id, label: pet.name }))} onChange={id => { setSelected(id); if (navigation) navigation.session.selectedPet = id }} /></label> : <Text tone="muted">没有适用的宠物</Text>}
      {consumable && <Text><Glyph kind="bag" /> 背包剩余 {count} 份</Text>}
    </Stack>}
    {!inventory && consumable && <div className="pet-quantity"><label htmlFor={`quantity-${item.id}`}>购买数量</label><div><Button variant="ghost" aria-label="减少购买数量" disabled={busy || quantity <= 1} onClick={() => updateQuantity(quantity - 1)}>−</Button><input id={`quantity-${item.id}`} aria-label="购买数量" type="number" min={1} max={99} step={1} value={quantity} disabled={busy} onChange={event => updateQuantity(event.currentTarget.valueAsNumber)} /><Button variant="ghost" aria-label="增加购买数量" disabled={busy || quantity >= 99} onClick={() => updateQuantity(quantity + 1)}>+</Button></div></div>}
  </Stack></div><div className="pet-product-actions">
    {!inventory && <><div className="pet-purchase-total"><span>{consumable ? `合计 · ${quantity} 份` : owned ? '已拥有' : '价格'}</span><strong><Glyph kind="coin" /> {(item.price * quantity).toLocaleString()}</strong></div><ProductActions {...props} item={item} quantity={quantity} />{item.device && owned && <Button variant="ghost" onClick={()=>{if(navigation){navigation.session.product=item.id;navigation.open('bag-detail')}}}><Glyph kind="settings" />管理设备</Button>}</>}
    {inventory && item.kind !== 'pet' && !item.device && <Button variant="primary" disabled={busy || !entity || (item.kind === 'skin' ? !owned || entity.skinId === item.id : count <= 0 || (item.kind === 'food' && entity.care.fullness >= 100))} onClick={() => { if (!entity) return; run(item.kind === 'skin' ? { type: 'equip', petId: entity.id, skinId: item.id } : item.kind === 'food' ? { type: 'feed', petId: entity.id, foodId: item.id } : { type: 'revive', petId: entity.id }) }}><Glyph kind={item.kind === 'skin' ? 'outfit' : item.kind === 'food' ? 'food' : 'heart'} />{item.kind === 'skin' ? entity?.skinId === item.id ? '已装备' : '装备皮肤' : item.kind === 'food' ? '喂食' : '使用复活图腾'}</Button>}
  </div></div>
}

const toggles: readonly [keyof Omit<PetSettings, 'maxActivePets'>, string][] = [
  ['visible', '显示宠物'], ['followPointer', '跟随鼠标'], ['clickFeedback', '点击回应'],
  ['draggable', '允许拖拽'], ['idleAnimations', '自主待机动作'], ['reducedMotion', '减少动态效果'],
]
function Settings({ state, busy, run }: Commands) {
  return <Stack gap="large">
    {toggles.map(([key, label]) => <Stack key={key} direction="row" align="center" justify="space-between" gap="medium">
      <Text>{label}</Text>
      <Select aria-label={label} disabled={busy} value={String(state.settings[key])} options={[{ value: 'true', label: '开启' }, { value: 'false', label: '关闭' }]}
        onChange={value => run({ type: 'settings', value: { [key]: value === 'true' } })} />
    </Stack>)}
    <Stack direction="row" align="center" justify="space-between" gap="medium">
      <Text>最多同时出场</Text>
      <Select aria-label="最多同时出场" disabled={busy} value={String(state.settings.maxActivePets)} options={Array.from({ length: 12 }, (_, index) => index + 1)
        .filter(count => count >= state.activePetIds.length).map(count => ({ value: String(count), label: `${count} 只${count === 3 ? '（推荐）' : ''}` }))}
        onChange={value => run({ type: 'settings', value: { maxActivePets: Number(value) } })} />
    </Stack>
    <Text tone="muted">减少动态效果会停用滚动、跳跃和大幅形变。离线时暂停饱食度、精力和健康变化；在线长期饥饿可能导致死亡。</Text>
  </Stack>
}
function Ledger({ state, usage }: { state: PetState; usage?: PetUsageStatus; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  const records = state.receipts.filter(item => ['buy', 'claim', 'feed', 'water', 'forage', 'usage', 'usage-baseline', 'bury', 'revive'].includes(item.kind)).slice().reverse()
  return <Stack gap="large">
    <Wallet state={state} usage={usage} />
    <Text tone="muted">累计获得 {state.wallet.earned} · 累计花费 {state.wallet.spent}</Text>
    {!records.length ? <EmptyState title="还没有收支记录" description="购买、喂食和相伴解锁会记录在这里。" /> : records.map(item => <Stack key={item.key} direction="row" justify="space-between" gap="medium">
      <Stack gap="small"><Text>{item.detail}</Text><Text tone="muted">{new Date(item.at).toLocaleString()}</Text></Stack>
      <Text>{item.coins > 0 ? '+' : ''}{item.coins} 宠物币</Text>
    </Stack>)}
    {state.careHistory.filter(item => item.kind === 'death').slice().reverse().map(item => <Text key={item.key} tone="muted">{state.pets.find(entity => entity.id === item.petId)?.name} · 已逝去 · {new Date(item.at).toLocaleString()}</Text>)}
  </Stack>
}
function PetToolbar({ section, state, navigation, back }: { section: PetPageSection; state: PetState; navigation?: PetPageNavigation; back?: () => void }) {
  const active = section === 'product-detail' ? 'shop' : section === 'bag-detail' ? 'bag' : section === 'pet-detail' ? 'pets' : section
  return <div className="pet-toolbar">{back && <Button variant="ghost" className="pet-local-back" aria-label="返回上一层" onClick={back}><Glyph kind="back" /></Button>}<nav aria-label="宠物页面">{([['pets','伙伴'],['shop','商店'],['bag','背包']] as const).map(([id,label]) => <Button key={id} variant={active === id ? 'primary' : 'ghost'} aria-current={active === id ? 'page' : undefined} onClick={() => navigation?.open(id)}>{id === 'pets' ? <Glyph kind="paw" /> : id === 'shop' ? <Glyph kind="shop" /> : <Glyph kind="bag" />}{label}</Button>)}</nav><span className="pet-nav-divider" aria-hidden="true" /><Button variant="ghost" title="宠物币 · 查看钱包" aria-label={`宠物币 ${state.wallet.balance.toLocaleString()}，查看钱包`} onClick={() => navigation?.open('ledger')}><Glyph kind="coin" /> {state.wallet.balance.toLocaleString()}</Button><span className="pet-nav-divider" aria-hidden="true" /><Button variant="ghost" aria-label="宠物设置" title="宠物设置" onClick={() => navigation?.open('settings')}><Glyph kind="settings" /></Button></div>
}
export function PetPage({ client, section: initialSection, navigation: routeNavigation }: { client: PetClient; section: PetPageSection; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  const [section, setSection] = useState(initialSection)
  useLayoutEffect(() => setSection(initialSection), [initialSection])
  const content = useRef<HTMLDivElement>(null)
  const scrollPositions = useRef(new Map<PetPageSection, number[]>())
  const navigation = useMemo(() => routeNavigation && ({
    session: routeNavigation.session,
    open(next: PetPageSection) {
      if (['pets', 'shop', 'bag'].includes(initialSection)) {
        scrollPositions.current.set(section, [content.current?.scrollTop ?? 0, content.current?.querySelector('.pet-tile-grid')?.scrollTop ?? 0])
        setSection(next)
      } else routeNavigation.open(next)
    },
  }), [routeNavigation, initialSection, section])
  useLayoutEffect(() => {
    const positions = scrollPositions.current.get(section)
    if (content.current) content.current.scrollTop = positions?.[0] ?? 0
    const grid = content.current?.querySelector('.pet-tile-grid')
    if (grid) grid.scrollTop = positions?.[1] ?? 0
  }, [section])
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const [notice, setNotice] = useState<{ message: string; error?: boolean; command?: PetCommand } | null>(null)
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  const run = (command: PetCommand) => {
    setNotice(null)
    void client.execute(command).then(() => { const error = client.getSnapshot().error; setNotice(error ? { message: error, error: true, command } : { message: command.type === 'water' ? '喝过水啦' : command.type === 'interact' ? '陪伴已回应' : command.type === 'feed' ? '喂食成功' : command.type === 'equip' ? '已换上新装扮' : command.type === 'buy' || command.type === 'claim' ? '已放入背包或宠物列表' : '已保存' }) }).catch(error => setNotice({ message: error instanceof Error ? error.message : '操作失败，请重试', error: true, command }))
  }
  if (!snapshot.state) return <EmptyState title={snapshot.error ? '暂时无法读取宠物' : '正在准备宠物…'} description={snapshot.error ?? undefined} />
  const props = { state: snapshot.state, busy: snapshot.busy, usage: snapshot.usage, run, navigation, sleep: client.requestSleep, wake: client.requestWake, restingPetIds: snapshot.restingPetIds }
  return <Stack fill gap="medium" className="pet-page-layout" aria-busy={snapshot.busy}>
    <style>{`
      .pet-page-layout{position:relative;isolation:isolate}
      .pet-toolbar{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:2px 0 10px}
      .pet-local-back{margin-inline-end:auto;width:24px;padding-inline:0}.pet-nav-divider{width:1px;height:20px;background:color-mix(in srgb,currentColor 16%,transparent);flex:none}
      .pet-toolbar nav{display:flex;align-items:center;gap:6px;margin-inline-end:12px}
      .pet-content{flex:1;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
      .pet-content[data-section=shop],.pet-content[data-section=bag]{overflow:hidden;display:flex;flex-direction:column}
      .pet-toast{position:absolute;z-index:5;right:12px;bottom:14px;display:flex;align-items:center;gap:10px;max-width:min(460px,calc(100% - 24px));box-sizing:border-box;padding:10px 14px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:12px;background:var(--cx-surface-raised,Canvas);color:var(--cx-text,CanvasText)}
      .pet-toast>span:nth-child(2){min-width:0;overflow-wrap:anywhere}
      .pet-product-title{font-size:22px;line-height:1.2;margin:0}
      .pet-product-facts{display:flex;flex-wrap:wrap;gap:14px}.pet-product-facts>span{display:flex;gap:8px;align-items:flex-start;font-size:12px}.pet-product-facts>span>span{display:flex;flex-direction:column;gap:5px}.pet-product-facts strong{font-size:14px;font-weight:600}
      .pet-quantity,.pet-purchase-total{display:flex;align-items:center;justify-content:space-between;gap:10px}.pet-quantity>div{display:flex;align-items:center;gap:4px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:10px}.pet-quantity input{width:44px;min-width:0;padding:6px 0;text-align:center;border:0;background:transparent;color:inherit;font:inherit;appearance:textfield}.pet-quantity input::-webkit-inner-spin-button{appearance:none}.pet-purchase-total strong{display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}.pet-purchase-total>span{font-size:12px;opacity:.7}.pet-recipient{display:flex;flex-direction:column;gap:10px}
      .pet-product-detail{height:100%;min-height:0;display:flex;flex-direction:column;gap:16px}
      .pet-product-scroll{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
      .pet-product-actions{flex:none;display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
      .pet-content[data-section=product-detail],.pet-content[data-section=bag-detail]{overflow:hidden}
      .pet-album{container-type:inline-size;--pet-album-accent:#ed7335;--pet-main-width:min(50cqw,440px,max(240px,calc(100dvh - 540px)))}
      .pet-album-gallery{position:relative;display:flex;align-items:end;gap:22px;overflow-x:auto;overflow-y:hidden;padding:6px 0 24px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:thin}
      .pet-album-gallery::before,.pet-album-gallery::after{content:"";flex:0 0 calc((100% - var(--pet-main-width))/2 - 22px)}
      .pet-album-portrait{position:relative;flex:0 0 min(26cqw,240px);min-width:0;aspect-ratio:1;height:auto;padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;scroll-snap-align:center}
      .pet-album-portrait[aria-pressed=true]{flex-basis:var(--pet-main-width);height:auto;aspect-ratio:1}
      .pet-album-portrait:focus-visible{outline:3px solid var(--pet-album-accent);outline-offset:4px;border-radius:18px}
      .pet-album-art{position:absolute;inset:0;overflow:hidden;border-radius:20px;background:var(--pet-album-tint);isolation:isolate}
      .pet-album-portrait[aria-pressed=true] .pet-album-art{outline:2px solid var(--pet-album-accent);outline-offset:-2px}
      .pet-album-avatar{position:absolute;inset:0;height:100%;width:100%;pointer-events:none}
      .pet-album-avatar>.interactive-avatar{width:100%;height:100%}
      .pet-album-art[data-peek=bottom] .pet-album-avatar{inset:0;translate:none}
      .pet-album-art[data-peek=left] .pet-album-avatar{inset:0;translate:none}
      .pet-album-art[data-peek=right] .pet-album-avatar{inset:0;translate:none}
      .pet-album-number{position:absolute;top:14px;left:16px;font-size:13px;color:#343434;opacity:.55}
      .pet-album-main{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:6px;border-radius:18px;padding:6px 12px;background:#ed7335;color:#fff;font-size:12px;font-weight:650}
      .pet-album-name{position:absolute;left:18px;bottom:-6px;padding:6px 14px;border-radius:3px;background:#fff9ed;color:#353128;font-size:17px;font-weight:700;transform:rotate(-4deg)}
      .pet-album-portrait:nth-child(even) .pet-album-name{left:auto;right:18px;transform:rotate(4deg)}
      .pet-album-status{position:absolute;bottom:28px;right:12px;background:#fff9ed;color:#353128;border-radius:4px;padding:4px 8px;font-size:12px}
      .pet-album-care{width:min(100%,440px);margin-inline:auto;padding-top:18px;padding-bottom:16px}
      .pet-album-summary{display:flex;justify-content:center;align-items:center;gap:18px;flex-wrap:wrap}
      .pet-album-selected-name{border:0;padding:0;background:none;color:inherit;font-family:inherit;font-weight:700;cursor:pointer;font-size:28px;line-height:1.25;letter-spacing:-.04em;margin-inline-end:8px}
      .pet-album-selected-name:hover{text-decoration:underline;text-underline-offset:5px}.pet-album-selected-name:focus-visible{outline:2px solid currentColor;outline-offset:5px;border-radius:3px}
      .pet-album-stat{display:inline-flex;align-items:center;gap:8px;font-size:18px;font-variant-numeric:tabular-nums}
      .pet-album-stat .pet-glyph{width:22px;height:22px}
      .pet-album-actions{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:20px}
      .pet-feeding-tray{margin-top:18px;padding:14px;border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:18px}
      .pet-food-rail{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;padding:4px;scroll-snap-type:x proximity}
      .pet-food-choice{position:relative;display:grid;place-items:center;flex:0 0 54px;min-height:66px;padding:2px;border:0;border-radius:0;background:transparent;color:inherit;cursor:pointer;scroll-snap-align:start}
      .pet-food-choice>img{width:46px;height:46px;object-fit:contain}.pet-food-choice[aria-pressed=true]::after{content:"";position:absolute;bottom:0;left:calc(50% - 6px);width:12px;height:2px;border-radius:2px;background:#ed965a}
      .pet-food-choice:focus-visible{outline:2px solid var(--pet-album-accent);outline-offset:2px}
      .pet-food-count{position:absolute;right:1px;top:0;min-width:12px;padding:0;background:transparent;color:inherit;opacity:.65;font-size:10px;text-align:center}
      .pet-water-use{display:flex;align-items:center;gap:14px}.pet-water-use>img{width:64px;height:64px}.pet-water-use>span{font-size:12px;opacity:.75}.pet-water-use>.pet-care-icon{margin-left:auto}
      ${PET_DEVICE_STYLES}
      .pet-device-list{display:grid;gap:12px}.pet-device-control{display:grid;gap:8px}.pet-device-heading{display:flex;align-items:center;gap:10px}.pet-device-heading>img{width:48px;height:48px}.pet-device-heading>div{flex:1}.pet-device-heading strong{font-size:12px}.pet-device-control small{display:block;font-size:11px;opacity:.65}.pet-care-icon{min-width:34px;min-height:34px}.pet-action-row>button[aria-pressed=true]{color:#ed965a}
      .pet-food-use{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 4px 0}
      .pet-food-effects{display:flex;flex-wrap:wrap;gap:14px;margin-top:7px;font-size:12px;opacity:.7}
      .pet-feeding-empty{display:flex;align-items:center;gap:16px;margin-top:18px}
      @container(max-width:580px){.pet-album-gallery{gap:12px}.pet-album-portrait{flex-basis:145px;height:auto;aspect-ratio:1} .pet-album-gallery{--pet-main-width:min(72cqw,340px)}.pet-album-summary{gap:14px}.pet-album-selected-name{border:0;padding:0;background:none;color:inherit;font-family:inherit;font-weight:700;cursor:pointer;font-size:24px}.pet-album-actions{gap:10px}.pet-album-art[data-peek=bottom] .pet-album-avatar{inset:0;translate:none}}
      .pet-shelf{flex:1;height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,320px);gap:28px;grid-template-rows:minmax(0,1fr);align-items:stretch}
      .pet-shelf[data-wide=false]{grid-template-columns:minmax(0,1fr)}
      .pet-tile-grid{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;align-content:start;display:grid;grid-auto-rows:max-content;grid-template-columns:repeat(auto-fill,minmax(min(100%,112px),1fr));gap:22px 16px;align-items:start}
      .pet-tile{display:flex;flex-direction:column;width:100%;min-width:0;position:relative;padding:3px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:start;font:inherit;cursor:pointer}
      .pet-tile[data-kind]>.pet-preview-stage{height:auto;aspect-ratio:1;width:100%;border-radius:16px;box-sizing:border-box;background:color-mix(in srgb,var(--pet-peek-tint,#c8cbd1) 25%,transparent);outline:2px solid transparent;outline-offset:0}
      .pet-tile[aria-pressed=true]>.pet-preview-stage{outline-color:#ed965a;background:color-mix(in srgb,var(--pet-peek-tint,#c8cbd1) 45%,transparent)}
      .pet-tile:hover>.pet-preview-stage{outline-color:color-mix(in srgb,currentColor 35%,transparent)}
      .pet-tile:focus-visible{outline:2px solid #ed965a;outline-offset:3px}
      .pet-tile-copy{display:flex;flex-direction:column;gap:5px;padding:10px 3px 0;font-size:13px;line-height:1.3}
      .pet-tile-copy strong{font-weight:550}
      .pet-tile-copy .pet-badge{font-size:11px}
      .pet-tile[data-kind=food]>.pet-preview-stage,.pet-tile[data-kind=item]>.pet-preview-stage{padding:12px}
      .pet-shop-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,78px),1fr));gap:16px 12px;padding:3px 4px 10px}
      .pet-shop-grid .pet-tile{min-height:0;height:auto;box-sizing:border-box;aspect-ratio:1;padding:0;border-radius:10px;outline:1px solid transparent;outline-offset:2px}
      .pet-shop-grid .pet-tile[data-kind]>.pet-preview-stage{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:1;padding:0;border-radius:0;background:transparent;outline:none}
      .pet-shop-grid .pet-tile:hover{outline-color:color-mix(in srgb,currentColor 24%,transparent)}
      .pet-shop-grid .pet-tile[aria-pressed=true],.pet-shop-grid .pet-tile:focus-visible{outline-color:#ed965a}
      .pet-shop-grid .pet-preview-stage>img{width:82%;height:82%;max-width:100%;object-fit:contain}
      .pet-shop-grid .pet-tile-copy{position:absolute;inset:0;display:block;padding:0;pointer-events:none}
      .pet-shop-grid .pet-tile-copy strong{position:absolute;bottom:3px;left:1px;max-width:calc(100% - 8px);box-sizing:border-box;padding:4px 6px;background:#fff4df;color:#433423;border-radius:2px;font-size:10px;line-height:1.15;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:rotate(-3deg)}
      .pet-shop-grid .pet-tile:nth-child(even) .pet-tile-copy strong{transform:rotate(2deg)}
      .pet-shop-grid .pet-badge{position:absolute;top:0;right:1px;display:flex;align-items:center;gap:3px;font-size:10px;line-height:16px;opacity:.85}
      .pet-content[data-section=shop] .pet-product-detail .pet-preview-stage{background:transparent}
      .pet-shop-grid .pet-badge .pet-glyph{width:12px;height:12px}
      .pet-character-layout{container-type:inline-size;padding:24px 18px;box-sizing:border-box}
      .pet-character{display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:36px;align-items:start;max-width:840px;margin-inline:auto}
      .pet-character-portrait{position:relative;aspect-ratio:1;min-width:0;border-radius:32px 32px 72px 32px;isolation:isolate;overflow:hidden}
      .pet-character-portrait>.interactive-avatar{position:absolute;inset:0;pointer-events:none}
      .pet-character-species{position:absolute;top:24px;left:24px;font-size:clamp(28px,5cqw,64px);font-weight:850;letter-spacing:-.07em;color:#342316;opacity:.16}
      .pet-character-sticker{position:absolute;bottom:24px;left:24px;padding:8px 14px;background:#fff9ed;color:#403329;font-size:14px;font-weight:650;border-radius:3px;transform:rotate(5deg)}
      .pet-character-info{display:flex;flex-direction:column;gap:22px;min-width:0}
      .pet-character-identity{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .pet-character-identity h2{margin:0;font-size:34px;line-height:1.15;letter-spacing:-.04em}
      .pet-character-main{font-size:11px;color:#ecaa79;border:1px solid color-mix(in srgb,#ecaa79 40%,transparent);padding:5px 9px;border-radius:20px}
      .pet-character-bond{display:flex;align-items:center;gap:8px;color:#d990aa;font-size:16px}
      .pet-character-bond span{font-size:12px;opacity:.75}
      .pet-character-care{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .pet-name-label{align-self:center;font-size:12px;white-space:nowrap}
      .pet-character-info .pet-care-stat{gap:8px;padding-bottom:12px}
      .pet-character-info .pet-care-stat-label{font-size:12px}
      .pet-character-info .pet-care-stat meter{appearance:none;border:0;border-radius:6px;background:color-mix(in srgb,currentColor 8%,transparent);height:6px}
      .pet-character-info .pet-care-stat meter::-webkit-meter-bar{background:color-mix(in srgb,currentColor 8%,transparent);border:0;border-radius:6px}
      .pet-character-info .pet-care-stat meter::-webkit-meter-optimum-value{background:var(--pet-stat-color);border-radius:6px}
      .pet-care-stat[data-stat=fullness]{--pet-stat-color:#dda66d}.pet-care-stat[data-stat=energy]{--pet-stat-color:#9ca6da}.pet-care-stat[data-stat=health]{--pet-stat-color:#8ab6a0}
      @container(max-width:620px){.pet-character{grid-template-columns:1fr;gap:30px}.pet-character-portrait{width:min(100%,300px);justify-self:center;aspect-ratio:1}.pet-character-info{width:min(100%,420px);justify-self:center}}
      .pet-inspector{height:100%;min-height:0;overflow:hidden;min-width:0;padding-inline-start:24px;border-inline-start:1px solid color-mix(in srgb,currentColor 14%,transparent)}
      .pet-peek{position:relative;overflow:hidden;flex-shrink:0;height:132px;border-radius:0;background:var(--pet-peek-tint,#dce5e9)}
      .pet-peek .pet-page-preview{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .pet-glyph{display:inline-block;vertical-align:middle;flex-shrink:0}
      .pet-preview-stage:not(.pet-peek){display:flex;align-items:center;justify-content:center;height:156px;width:100%;border-radius:12px;background:#c8cbd1;color:#20242c;overflow:hidden}
      .pet-card-open{display:flex;flex-direction:column;align-items:flex-start;gap:10px;width:100%;border:0;padding:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
      .pet-card-open:focus-visible{outline:2px solid currentColor;outline-offset:4px;border-radius:12px}
      .pet-badge{font-size:.8em;opacity:.7}.pet-affinity{margin-inline-start:16px}
      .pet-filters{display:flex;gap:4px;flex-wrap:wrap}.pet-check{display:flex;align-items:center;gap:6px;font-size:.9em}
      .pet-care-stat-label svg{vertical-align:middle}
      .pet-page-preview>.interactive-avatar{width:100%;height:100%;box-sizing:border-box}
      .pet-care-stat{display:grid;gap:6px}
      .pet-care-stat-label{display:flex;justify-content:space-between;gap:12px;font-size:.9em}
      .pet-care-stat meter{display:block;width:100%;height:8px}
      .pet-name-input{min-width:0;width:100%;flex:1;box-sizing:border-box;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:8px;padding:8px 10px;background:transparent;color:inherit;font:inherit}
      .pet-name-input:focus-visible{outline:2px solid currentColor;outline-offset:2px}
      .pet-name-input:disabled{opacity:.55}

      .pet-character-info{gap:16px}.pet-trait-chips{display:flex;flex-wrap:wrap;gap:8px}.pet-trait-chips>span{font-size:11px;background:color-mix(in srgb,currentColor 6%,transparent);padding:5px 8px;border-radius:6px}
      .pet-care-stat[data-stat=hydration]{--pet-stat-color:#7cbbd8}.pet-care-stat[data-stat=mood]{--pet-stat-color:#d89fa9}
      .pet-action-row{display:flex;gap:3px;align-items:center;flex-wrap:wrap}.pet-action-row>button{font-size:12px;padding:7px}.pet-more{position:relative;margin-inline-start:auto}
      .pet-more-menu{position:absolute;right:0;top:100%;z-index:6;width:156px;padding:6px;background:var(--cx-surface-raised,Canvas);border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:10px;display:flex;flex-direction:column;gap:3px}.pet-more-menu button{justify-content:flex-start}
      .pet-care-panel{margin-top:12px;min-height:132px}.pet-care-panel .pet-feeding-tray{margin-top:0;padding:8px;border:0}.pet-inline-use{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:color-mix(in srgb,currentColor 4%,transparent)}.pet-inline-use>div{flex:1}.pet-inline-use p{font-size:12px;opacity:.7}
      .pet-outfit-rail{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;padding:4px}.pet-outfit-choice{flex:0 0 120px;color:inherit;background:transparent;border:1px solid transparent;padding:4px;border-radius:12px;cursor:pointer}.pet-outfit-choice[aria-pressed=true]{border-color:#ed965a}.pet-outfit-choice .pet-preview-stage{height:110px}.pet-outfit-choice .pet-page-preview{max-width:110px;max-height:110px}.pet-outfit-choice span{font-size:11px}.pet-exploration{font-size:12px;opacity:.7}
    `}</style>
    <PetToolbar section={section} state={snapshot.state} navigation={navigation} back={['pets', 'shop', 'bag'].includes(initialSection) && !['pets', 'shop', 'bag'].includes(section) ? () => navigation?.open(section === 'product-detail' || section === 'ledger' ? 'shop' : section === 'bag-detail' ? 'bag' : 'pets') : undefined} />
    {snapshot.error && !notice && <Text role="alert" tone="danger">{snapshot.error}</Text>}
    {notice && <div className="pet-toast" role={notice.error ? 'alert' : 'status'}><span>{notice.error ? '!' : '✓'}</span><span>{notice.message}</span>{notice.error && notice.command && <Button variant="ghost" disabled={snapshot.busy} onClick={() => run(notice.command!)}>重试</Button>}<Button variant="ghost" aria-label="关闭提示" onClick={() => setNotice(null)}>×</Button></div>}
    <div ref={content} className="pet-content" data-section={section}>
    {section === 'shop' ? <Shop {...props} /> : section === 'pets' ? <Pets {...props} /> : section === 'bag' ? <Bag {...props} />
      : section === 'pet-detail' ? <PetDetail {...props} /> : section === 'product-detail' || section === 'bag-detail' ? <ProductDetail {...props} inventory={section === 'bag-detail'} /> : section === 'settings' ? <Settings {...props} /> : <Ledger state={snapshot.state} usage={snapshot.usage} />}
    </div>
  </Stack>
}

function PetDetail(props: Commands) {
  const entity = props.state.pets.find(pet => pet.id === props.navigation?.session.selectedPet) ?? props.state.pets[0]
  return entity ? <PetCard {...props} entity={entity} /> : <EmptyState title="没有找到这只宠物" />
}
