import { careWarning, initialPetCare, petWeightLabel } from './pet-care.js'
import { useEffect, useRef, useMemo, useState, useSyncExternalStore } from 'cordisx/react'
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
type Commands = { state: PetState; busy: boolean; run: (command: PetCommand) => void; usage?: PetUsageStatus; navigation?: PetPageNavigation; sleep?: (id: string) => void }
function Preview({ entity, skinId, peek = false }: { entity: PetEntity; skinId?: string; peek?: boolean }) {
  const definition = useMemo(() => petAppearance(entity, skinId), [entity.species, entity.skinId, skinId])
  const pose = peekPose(entity.id)
  return <div className={peek ? 'pet-preview-stage pet-peek' : 'pet-preview-stage'} data-peek={peek ? pose.side : undefined} style={peek ? { '--pet-peek-angle': `${pose.angle}deg`, '--pet-peek-offset': `${pose.offset}%`, '--pet-peek-tint': pose.tint } as import('cordisx/react').CSSProperties : undefined}><Avatar className="pet-page-preview" definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`}
    style={{ width: 152, height: 152, alignSelf: 'center', flexShrink: 0 }} /></div>
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
  return { id: `preview:${product.id}`, species, skinId: product.kind === 'skin' ? product.id : PET_DEFAULT_SKINS[species], name: product.name, affinity: 0, x: .5, status: 'alive', care: initialPetCare(species) }
}
function Wallet({ state, usage }: { state: PetState; usage?: PetUsageStatus; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  return <Stack gap="small">
    <Text><strong>{state.wallet.balance.toLocaleString()} 宠物币</strong></Text>
    {usage?.status === 'ready' ? <>
      <Text tone="muted">每新增 {PET_ECONOMY.tokensPerCoin.toLocaleString()} Token 获得 1 宠物币，不足部分会保留。</Text>
      <Text tone="muted">仅统计启用后本机可确认的使用量，不包含全部历史或其他设备。最近同步：{new Date(usage.observedThrough).toLocaleTimeString()}。</Text>
    </> : <Text tone="muted">{usage?.status === 'initializing' ? '正在同步使用奖励…'
      : usage?.status === 'unavailable' && usage.reason === 'permission-denied' ? '允许读取本机 Token 使用量后，即可积累宠物币。可在 CordisX 插件权限中开启。'
      : '使用奖励暂不可用，恢复后会继续同步。免费外观、欢迎点心和相伴解锁仍可体验。'}</Text>}
  </Stack>
}
function ownedProduct(state: PetState, item: PetProduct) {
  return item.kind === 'pet' ? state.pets.some(pet => pet.species === item.species) : item.kind === 'skin' ? state.ownedSkinIds.includes(item.id) : false
}
function Glyph({ kind }: { kind: 'settings' | 'shop' | 'bag' | 'paw' | 'coin' | 'food' | 'heart' | 'energy' | 'outfit' | 'moon' | 'arrow' }) {
  const paths = { settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0', shop: 'M3 10h18l-2-7H5ZM4 10v11h16V10M9 21v-7h6v7', bag: 'M4 6h16v15H4ZM8 6V4a4 4 0 0 1 8 0v2M8 10v2M16 10v2', moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z', paw: 'M8 14c-4 7 12 7 8 0l-4-4Z M5 6v2 M10 3v2 M15 3v2 M20 6v2', coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12', food: 'M3 11h18c0 11-18 11-18 0Z M8 3v4 M13 2v5 M18 3v4', heart: 'M12 20 3 11C-2 2 10 1 12 7c2-6 14-5 9 4Z', energy: 'M14 2 5 14h7l-2 8 9-13h-7Z', outfit: 'M8 3 2 7l3 5 3-2v11h8V10l3 2 3-5-6-4c0 5-8 5-8 0Z', arrow: 'M8 4l8 8-8 8' }
  return <svg className="pet-glyph" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
function ProductActions({ item, state, busy, run }: Commands & { item: PetProduct }) {
  const owned = ownedProduct(state, item)
  if (owned) return null
  const applicable = item.kind !== 'skin' || state.pets.some(pet => pet.species === item.species && pet.affinity >= (item.requiredAffinity ?? 0))
  const affinity = Math.max(0, ...state.pets.map(pet => pet.affinity))
  const reason = owned ? '已拥有' : !applicable ? '需要适用宠物及亲密度' : state.wallet.balance < item.price ? '宠物币不足' : ''
  return <Stack gap="small"><Stack direction="row" wrap gap="small">
    <Button disabled={busy || !!reason} title={reason || undefined} onClick={() => run({ type: 'buy', productId: item.id })}>{owned ? '已拥有' : item.price === 0 ? '领取' : item.kind === 'pet' ? '领养' : '购买'}</Button>
    {item.kind === 'pet' && item.requiredAffinity && !owned && <Button disabled={busy || affinity < item.requiredAffinity} onClick={() => run({ type: 'claim', productId: item.id })}>相伴解锁 {Math.min(affinity, item.requiredAffinity)}/{item.requiredAffinity}</Button>}
  </Stack>{reason && !owned && <Text tone="muted">{reason}</Text>}</Stack>
}
function ProductPreview({ item, peek = false }: { item: PetProduct; peek?: boolean }) {
  return item.kind === 'pet' || item.kind === 'skin' ? <Preview entity={productEntity(item)} peek={peek} /> : <div className="pet-preview-stage"><PetFoodArt id={item.id} /></div>
}
function Shop(props: Commands) {
  const { state, busy, navigation, usage } = props
  const shelf = useShelf()
  const [selected, setSelected] = useState(navigation?.session.product)
  const [filter, setFilter] = useState(navigation?.session.filter ?? 'all')
  const [hideOwned, setHideOwned] = useState(navigation?.session.hideOwned ?? false)
  const products = PET_CATALOG.filter(item => (filter === 'all' || item.kind === filter) && (!hideOwned || !ownedProduct(state, item)))
  return <Stack gap="medium" style={{ height: '100%', minHeight: 0 }}>
    {usage?.status !== 'ready' && <Text tone="muted">{usage?.status === 'initializing' ? '正在同步使用奖励…' : usage?.status === 'unavailable' && usage.reason === 'permission-denied' ? '允许读取本机 Token 使用量后，即可积累宠物币。' : '使用奖励暂不可用，恢复后继续同步。'}</Text>}
    <Stack direction="row" gap="small" wrap align="center"><div className="pet-filters" role="group" aria-label="商品类型">{[['all','全部'],['pet','宠物'],['skin','皮肤'],['food','食物'],['item','道具']].map(([id,label]) => <Button key={id} disabled={busy} aria-pressed={filter === id} variant={filter === id ? 'primary' : 'ghost'} onClick={() => { setFilter(id!); if (navigation) navigation.session.filter = id! }}>{label}</Button>)}</div>
      <label className="pet-check"><input type="checkbox" checked={hideOwned} disabled={busy} onChange={event => { setHideOwned(event.target.checked); if (navigation) navigation.session.hideOwned = event.target.checked }} />隐藏已拥有</label>
    </Stack>
    <div ref={shelf.ref} className="pet-shelf" data-wide={shelf.wide} data-reduced-motion={state.settings.reducedMotion}><div className="pet-tile-grid">{products.map(item => <button type="button" key={item.id} className="pet-tile" aria-pressed={selected === item.id} data-pet-anchor={item.id} onClick={() => { setSelected(item.id); if (navigation) { navigation.session.product = item.id; navigation.session.anchor = item.id; if (!shelf.wide) navigation.open('product-detail') } }}><ProductPreview item={item} peek /><span className="pet-tile-copy"><strong>{item.name}</strong><span className="pet-badge">{ownedProduct(state,item) ? state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已拥有' : item.price === 0 ? '免费' : `${item.price.toLocaleString()} 宠物币`}</span></span></button>)}</div>
      {shelf.wide && <aside className="pet-inspector" aria-label="选中商品详情">{products.some(item => item.id === selected) ? <ProductDetail key={selected} {...props} productId={selected} /> : <EmptyState title="挑一件喜欢的" description="选择左侧商品，查看外观与解锁方式。" />}</aside>}
    </div>
    {!products.length && <EmptyState title="没有符合条件的商品" description="试试其他分类，或显示已拥有的商品。" />}
  </Stack>
}
function CareStats({ entity }: { entity: PetEntity }) {
  return <Stack gap="small">
    <Text>{entity.status === 'dead' ? '已逝去' : entity.status === 'buried' ? '已安葬' : careWarning(entity.care)}</Text>
    {(['fullness', 'energy', 'health'] as const).map((key, index) => <label className="pet-care-stat" key={key}>
      <span className="pet-care-stat-label"><span><Glyph kind={(['food', 'energy', 'heart'] as const)[index]!} /> {['饱食度', '精力', '健康'][index]}</span><span>{Math.round(entity.care[key])}/100</span></span>
      <meter aria-label={['饱食度', '精力', '健康'][index]} min={0} max={100} value={entity.care[key]} />
    </label>)}
    <Text tone="muted">体重 {entity.care.weight.toFixed(2)} kg · {petWeightLabel(entity)}</Text>
  </Stack>
}
function Afterlife({ entity, state, busy, run }: Commands & { entity: PetEntity }) {
  const [confirm, setConfirm] = useState(false)
  return <Stack gap="small"><Text tone="muted">可以安葬并保留纪念，也可以使用重启核心复活。</Text><Stack direction="row" gap="small" wrap>
    {entity.status === 'dead' && <Button disabled={busy} onClick={() => { if (confirm) run({ type: 'bury', petId: entity.id }); else setConfirm(true) }}>{confirm ? '确认安葬并保留纪念' : '安葬'}</Button>}
    <Button disabled={busy || !(state.itemInventory['item-reboot-core'] > 0)} onClick={() => run({ type: 'revive', petId: entity.id })}>重启核心复活（{state.itemInventory['item-reboot-core'] ?? 0}）</Button>
  </Stack></Stack>
}
function PetCard({ entity, state, busy, run, sleep }: Commands & { entity: PetEntity }) {
  const [name, setName] = useState(entity.name)
  const active = state.activePetIds.includes(entity.id)
  const alive = entity.status === 'alive'
  return <Card><Stack gap="medium">
    <Preview entity={entity} />
    <Text><strong>{entity.name}</strong>{entity.id === state.mainPetId ? ' · 主宠' : ''}</Text>
    <Text tone="muted">亲密度 {entity.affinity} · {petProduct(entity.skinId).name}</Text>
    <CareStats entity={entity} />
    {alive && <Button disabled={busy || !active} title={active ? undefined : '出场后可以让宠物睡觉'} onClick={() => sleep?.(entity.id)}><Glyph kind="energy" /> 休息一会儿</Button>}
    <form onSubmit={event => { event.preventDefault(); run({ type: 'rename', petId: entity.id, name }) }}>
      <Stack gap="small">
        <label htmlFor={`name-${entity.id}`}>名字</label>
        <Stack direction="row" gap="small" align="center">
          <input className="pet-name-input" id={`name-${entity.id}`} value={name} maxLength={24} required disabled={busy} onChange={event => setName(event.currentTarget.value)} />
          <Button type="submit" disabled={busy || !name.trim() || name.trim() === entity.name}>保存</Button>
        </Stack>
      </Stack>
    </form>
    <Stack direction="row" wrap gap="small">
      <Button disabled={busy || !alive || (!active && state.activePetIds.length >= state.settings.maxActivePets)}
        onClick={() => run({ type: 'setActive', petIds: active ? state.activePetIds.filter(id => id !== entity.id) : [...state.activePetIds, entity.id] })}>{active ? '收起' : '出场'}</Button>
      <Button disabled={busy || !alive || entity.id === state.mainPetId} onClick={() => run({ type: 'setMain', petId: entity.id })}>设为主宠</Button>
      <Button disabled={busy || !alive} onClick={() => run({ type: 'move', petId: entity.id, x: .5 })}>重置位置</Button>
    </Stack>
    {!alive && <Afterlife entity={entity} state={state} busy={busy} run={run} />}
  </Stack></Card>
}
export function availableFoods(state: PetState) {
  return PET_CATALOG.filter(item => item.kind === 'food' && (state.foodInventory[item.id] ?? 0) > 0)
}
function FeedingTray({ entity, state, busy, run, navigation }: Commands & { entity: PetEntity }) {
  const foods = availableFoods(state)
  const [selected, setSelected] = useState<string | undefined>()
  const food = foods.find(item => item.id === selected) ?? foods[0]
  if (!food) return <div className="pet-feeding-empty"><Text tone="muted">食物用完了</Text><Button disabled={busy} onClick={() => { if (navigation) { navigation.session.filter = 'food'; navigation.open('shop') } }}>去商店补给 <Glyph kind="arrow" /></Button></div>
  return <div className="pet-feeding-tray">
    <div className="pet-food-rail" role="group" aria-label="背包里的食物">{foods.map(item => <button type="button" className="pet-food-choice" key={item.id} aria-pressed={food.id === item.id} aria-label={`${item.name}，剩余 ${state.foodInventory[item.id]} 份`} title={item.name} onClick={() => setSelected(item.id)}><PetFoodArt id={item.id} /><span className="pet-food-count">{state.foodInventory[item.id]}</span></button>)}</div>
    <div className="pet-food-use"><div><strong>{food.name}</strong><div className="pet-food-effects"><span title="饱食度"><Glyph kind="food" /> +{food.fullness}</span><span title="精力"><Glyph kind="energy" /> +{food.energy}</span><span title="亲密度"><Glyph kind="heart" /> +{food.affinity}</span></div></div><Button variant="primary" disabled={busy || entity.status !== 'alive'} onClick={() => run({ type: 'feed', petId: entity.id, foodId: food.id })}>喂给{entity.name}</Button></div>
  </div>
}
function AlbumPortrait({ entity, main }: { entity: PetEntity; main: boolean }) {
  const definition = useMemo(() => petAppearance(entity), [entity.species, entity.skinId])
  const pose = peekPose(entity.id)
  const side = main ? 'bottom' : pose.side === 'bottom' ? 'right' : pose.side
  const tint = entity.skinId.includes('orange') ? '#ffc38c' : entity.species === 'dog' ? '#d7c9ec' : entity.species === 'rabbit' ? '#d9e6c9' : '#b9d1ee'
  return <div className="pet-album-art" data-peek={side} style={{ '--pet-album-tint': tint, '--pet-album-angle': `${main ? -5 : pose.angle}deg` } as import('cordisx/react').CSSProperties}><div className="pet-album-avatar"><Avatar definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`} style={{ width: '100%', height: '100%' }} /></div></div>
}
function Pets(props: Commands) {
  const { state, navigation, busy } = props
  const [selected, setSelected] = useState(navigation?.session.selectedPet ?? state.mainPetId)
  const [feeding, setFeeding] = useState(false)
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
    <div ref={gallery} className="pet-album-gallery" role="group" aria-label="选择宠物">{state.pets.map((pet,index) => <button type="button" className="pet-album-portrait" key={pet.id} aria-pressed={entity.id === pet.id} onClick={() => { setSelected(pet.id); setFeeding(false); if (navigation) navigation.session.selectedPet = pet.id }}><AlbumPortrait entity={pet} main={pet.id === state.mainPetId} /><span className="pet-album-number" aria-hidden="true">{String(index + 1).padStart(2,'0')}</span>{pet.id === state.mainPetId && <span className="pet-album-main">★ 主宠</span>}<span className="pet-album-name">{pet.name}</span>{pet.status !== 'alive' && <span className="pet-album-status">{pet.status === 'dead' ? '已逝去' : '已安葬'}</span>}</button>)}</div>
    <section className="pet-album-care" aria-label="选中宠物"><div className="pet-album-summary"><strong className="pet-album-selected-name">{entity.name}</strong><span className="pet-album-stat" title="亲密度" aria-label={`亲密度 ${entity.affinity}`}><Glyph kind="heart" /> {entity.affinity}</span><span className="pet-album-stat" title="饱食度" aria-label={`饱食度 ${Math.round(entity.care.fullness)}`}><Glyph kind="food" /> {Math.round(entity.care.fullness)}</span><Button variant="ghost" disabled={busy} onClick={() => { if (navigation) { navigation.session.selectedPet = entity.id; navigation.open('pet-detail') } }}>查看档案 <Glyph kind="arrow" /></Button></div>
      {warning !== '状态良好' && <Text tone={alive ? 'muted' : 'danger'}>{warning}</Text>}
      <div className="pet-album-actions"><Button variant={feeding ? 'primary' : 'secondary'} disabled={busy || !alive} aria-expanded={feeding} onClick={() => setFeeding(!feeding)}><Glyph kind="food" /> 喂食</Button><Button variant="ghost" disabled={busy || !alive} onClick={() => { if (navigation) { navigation.session.selectedPet = entity.id; navigation.session.product = entity.skinId; navigation.open('bag') } }}><Glyph kind="outfit" /> 装扮</Button><Button variant="ghost" disabled={busy || !alive || !active} title={active ? '休息恢复精力' : '出场后可以休息'} onClick={() => props.sleep?.(entity.id)}><Glyph kind="moon" /> 休息</Button></div>
      {feeding && <FeedingTray key={entity.id} {...props} entity={entity} />}
    </section>
  </div>
}
function Bag(props: Commands) {
  const { state, navigation } = props
  const shelf = useShelf()
  const [selected, setSelected] = useState(navigation?.session.product)
  const items = PET_CATALOG.filter(item => item.kind === 'skin' ? state.ownedSkinIds.includes(item.id) : item.kind === 'food' ? (state.foodInventory[item.id] ?? 0) > 0 : item.kind === 'item' && (state.itemInventory[item.id] ?? 0) > 0)
  return <div ref={shelf.ref} className="pet-shelf" data-wide={shelf.wide} data-reduced-motion={state.settings.reducedMotion}><div className="pet-tile-grid">{items.map(item => <button type="button" key={item.id} className="pet-tile" aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); if (navigation) { navigation.session.product = item.id; if (!shelf.wide) navigation.open('bag-detail') } }}><ProductPreview item={item} peek /><span className="pet-tile-copy"><strong>{item.name}</strong><span className="pet-badge">{item.kind === 'skin' ? state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已解锁' : `× ${item.kind === 'food' ? state.foodInventory[item.id] : state.itemInventory[item.id]}`}</span></span></button>)}{!items.length && <EmptyState title="背包还是空的" description="到商店挑选一些补给吧。" />}</div>{shelf.wide && <aside className="pet-inspector" aria-label="选中物品详情">{items.some(item => item.id === selected) ? <ProductDetail key={selected} {...props} inventory productId={selected} /> : <EmptyState title="选择一件物品" description="在这里试穿装扮，或为宠物补充能量。" />}</aside>}</div>
}
function ProductDetail(props: Commands & { inventory?: boolean; productId?: string }) {
  const { state, navigation, busy, run, inventory, productId } = props
  const item = PET_CATALOG.find(item => item.id === (productId ?? navigation?.session.product))
  const [selected, setSelected] = useState(navigation?.session.selectedPet ?? state.mainPetId)
  if (!item) return <EmptyState title="请选择一件商品" />
  const pets = state.pets.filter(pet => (!item.species || pet.species === item.species) && (item.kind === 'item' ? pet.status !== 'alive' : pet.status === 'alive'))
  const entity = pets.find(pet => pet.id === selected) ?? pets[0]
  const owned = ownedProduct(state,item)
  return <div className="pet-product-detail"><div className="pet-product-scroll"><Stack gap="medium">{item.kind === 'skin' && entity ? <Preview entity={entity} skinId={item.id} /> : <ProductPreview item={item} />}<Text><strong>{item.name}</strong></Text><Text tone="muted">{item.kind === 'food' ? `消耗 1 份，饱食度 +${item.fullness}，精力 +${item.energy}，亲密度 +${item.affinity}。` : item.kind === 'item' ? '消耗 1 枚复活宠物，保留名字、装备和亲密度。' : item.kind === 'skin' ? '试穿不会改变当前装备；解锁后可应用到适用宠物。' : '永久解锁一位新伙伴。'}</Text>
    {item.requiredAffinity && <Text>亲密度要求：{item.requiredAffinity}{item.kind === 'pet' ? '（达到后也可免费领养）' : ''}</Text>}
    {!inventory && <><Text><Glyph kind="coin" /> {item.price.toLocaleString()} 宠物币</Text></>}
    {item.kind !== 'pet' && <Stack gap="medium">{pets.length ? <Select aria-label="选择使用物品的宠物" value={entity!.id} options={pets.map(pet => ({ value: pet.id, label: pet.name }))} onChange={id => { setSelected(id); if (navigation) navigation.session.selectedPet = id }} /> : <Text tone="muted">没有适用的宠物</Text>}
      {(item.kind === 'food' || item.kind === 'item') && <Text tone="muted">背包剩余 {item.kind === 'food' ? state.foodInventory[item.id] ?? 0 : state.itemInventory[item.id] ?? 0} 份</Text>}

    </Stack>}
  </Stack></div><div className="pet-product-actions">{!inventory && <ProductActions {...props} item={item} />}{item.kind !== 'pet' && <Button disabled={busy || !entity || (item.kind === 'skin' ? !owned || entity.skinId === item.id : item.kind === 'food' ? !(state.foodInventory[item.id] > 0) : !(state.itemInventory[item.id] > 0))} onClick={() => { if (!entity) return; run(item.kind === 'skin' ? { type:'equip',petId:entity.id,skinId:item.id } : item.kind === 'food' ? {type:'feed',petId:entity.id,foodId:item.id} : {type:'revive',petId:entity.id}) }}>{item.kind === 'skin' ? entity?.skinId === item.id ? '已装备' : '装备皮肤' : item.kind === 'food' ? '喂食' : '使用重启核心'}</Button>}</div></div>
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
  const records = state.receipts.filter(item => ['buy', 'claim', 'feed', 'usage', 'usage-baseline', 'bury', 'revive'].includes(item.kind)).slice().reverse()
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
function PetToolbar({ section, state, navigation }: { section: PetPageSection; state: PetState; navigation?: PetPageNavigation }) {
  const active = section === 'product-detail' ? 'shop' : section === 'bag-detail' ? 'bag' : section === 'pet-detail' ? 'pets' : section
  return <div className="pet-toolbar"><nav aria-label="宠物页面">{([['pets','伙伴'],['shop','商店'],['bag','背包']] as const).map(([id,label]) => <Button key={id} variant={active === id ? 'primary' : 'ghost'} aria-current={active === id ? 'page' : undefined} onClick={() => navigation?.open(id)}>{id === 'pets' ? <Glyph kind="paw" /> : id === 'shop' ? <Glyph kind="shop" /> : <Glyph kind="bag" />}{label}</Button>)}</nav><Button variant="ghost" title="宠物币 · 查看钱包" aria-label={`宠物币 ${state.wallet.balance.toLocaleString()}，查看钱包`} onClick={() => navigation?.open('ledger')}><Glyph kind="coin" /> {state.wallet.balance.toLocaleString()}</Button><Button variant="ghost" aria-label="宠物设置" title="宠物设置" onClick={() => navigation?.open('settings')}><Glyph kind="settings" /></Button></div>
}
export function PetPage({ client, section, navigation }: { client: PetClient; section: PetPageSection; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const [notice, setNotice] = useState<{ message: string; error?: boolean; command?: PetCommand } | null>(null)
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  const run = (command: PetCommand) => {
    setNotice(null)
    void client.execute(command).then(() => { const error = client.getSnapshot().error; setNotice(error ? { message: error, error: true, command } : { message: command.type === 'feed' ? '喂食成功' : command.type === 'equip' ? '已换上新装扮' : command.type === 'buy' || command.type === 'claim' ? '已放入背包或宠物列表' : '已保存' }) }).catch(error => setNotice({ message: error instanceof Error ? error.message : '操作失败，请重试', error: true, command }))
  }
  if (!snapshot.state) return <EmptyState title={snapshot.error ? '暂时无法读取宠物' : '正在准备宠物…'} description={snapshot.error ?? undefined} />
  const props = { state: snapshot.state, busy: snapshot.busy, usage: snapshot.usage, run, navigation, sleep: client.requestSleep }
  return <Stack fill gap="medium" className="pet-page-layout" aria-busy={snapshot.busy}>
    <style>{`
      .pet-page-layout{position:relative;isolation:isolate}
      .pet-toolbar{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:2px 0 10px}
      .pet-toolbar nav{display:flex;align-items:center;gap:6px;margin-inline-end:12px}
      .pet-content{flex:1;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
      .pet-content[data-section=shop],.pet-content[data-section=bag]{overflow:hidden;display:flex;flex-direction:column}
      .pet-toast{position:absolute;z-index:5;right:12px;bottom:14px;display:flex;align-items:center;gap:10px;max-width:min(460px,calc(100% - 24px));box-sizing:border-box;padding:10px 14px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:12px;background:var(--cx-surface-raised,Canvas);color:var(--cx-text,CanvasText)}
      .pet-toast>span:nth-child(2){min-width:0;overflow-wrap:anywhere}
      .pet-product-detail{height:100%;min-height:0;display:flex;flex-direction:column;gap:16px}
      .pet-product-scroll{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
      .pet-product-actions{flex:none;display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
      .pet-content[data-section=product-detail],.pet-content[data-section=bag-detail]{overflow:hidden}
      .pet-album{container-type:inline-size;--pet-album-accent:#ed7335;--pet-main-width:min(50cqw,440px)}
      .pet-album-gallery{position:relative;display:flex;align-items:end;gap:22px;overflow-x:auto;overflow-y:hidden;padding:6px 0 24px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:thin}
      .pet-album-gallery::before,.pet-album-gallery::after{content:"";flex:0 0 calc((100% - var(--pet-main-width))/2 - 22px)}
      .pet-album-portrait{position:relative;flex:0 0 min(26cqw,240px);min-width:0;height:clamp(210px,27cqw,280px);padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;scroll-snap-align:center}
      .pet-album-portrait[aria-pressed=true]{flex-basis:var(--pet-main-width);height:clamp(250px,33cqw,340px)}
      .pet-album-portrait:focus-visible{outline:3px solid var(--pet-album-accent);outline-offset:4px;border-radius:18px}
      .pet-album-art{position:absolute;inset:0;overflow:hidden;border-radius:20px;background:var(--pet-album-tint);isolation:isolate}
      .pet-album-portrait[aria-pressed=true] .pet-album-art{outline:2px solid var(--pet-album-accent);outline-offset:-2px}
      .pet-album-avatar{position:absolute;height:200%;aspect-ratio:1;transform:rotate(var(--pet-album-angle));pointer-events:none}
      .pet-album-avatar>.interactive-avatar{width:100%;height:100%}
      .pet-album-art[data-peek=bottom] .pet-album-avatar{left:50%;top:-30%;translate:-50% 0;}
      .pet-album-art[data-peek=left] .pet-album-avatar{left:-48%;top:-30%}
      .pet-album-art[data-peek=right] .pet-album-avatar{right:-48%;top:-30%}
      .pet-album-number{position:absolute;top:14px;left:16px;font-size:13px;color:#343434;opacity:.55}
      .pet-album-main{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:6px;border-radius:18px;padding:6px 12px;background:#ed7335;color:#fff;font-size:12px;font-weight:650}
      .pet-album-name{position:absolute;left:18px;bottom:-6px;padding:6px 14px;border-radius:3px;background:#fff9ed;color:#353128;font-size:17px;font-weight:700;transform:rotate(-4deg)}
      .pet-album-portrait:nth-child(even) .pet-album-name{left:auto;right:18px;transform:rotate(4deg)}
      .pet-album-status{position:absolute;bottom:28px;right:12px;background:#fff9ed;color:#353128;border-radius:4px;padding:4px 8px;font-size:12px}
      .pet-album-care{width:min(100%,440px);margin-inline:auto;padding-top:18px;padding-bottom:16px}
      .pet-album-summary{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
      .pet-album-selected-name{font-size:28px;line-height:1.25;letter-spacing:-.04em;margin-inline-end:8px}
      .pet-album-stat{display:inline-flex;align-items:center;gap:8px;font-size:18px;font-variant-numeric:tabular-nums}
      .pet-album-stat .pet-glyph{width:22px;height:22px}
      .pet-album-actions{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:20px}
      .pet-feeding-tray{margin-top:18px;padding:14px;border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:18px}
      .pet-food-rail{display:flex;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;padding:4px;scroll-snap-type:x proximity}
      .pet-food-choice{position:relative;display:grid;place-items:center;flex:0 0 120px;min-height:96px;padding:8px;border:1px solid transparent;border-radius:12px;background:color-mix(in srgb,currentColor 4%,transparent);color:inherit;cursor:pointer;scroll-snap-align:start}
      .pet-food-choice[aria-pressed=true]{border-color:var(--pet-album-accent);background:color-mix(in srgb,#ed7335 9%,transparent)}
      .pet-food-choice:focus-visible{outline:2px solid var(--pet-album-accent);outline-offset:2px}
      .pet-food-count{position:absolute;right:6px;top:5px;min-width:20px;border-radius:12px;padding:2px 5px;background:#ed7335;color:white;font-size:12px;text-align:center}
      .pet-food-use{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 4px 0}
      .pet-food-effects{display:flex;flex-wrap:wrap;gap:14px;margin-top:7px;font-size:12px;opacity:.7}
      .pet-feeding-empty{display:flex;align-items:center;gap:16px;margin-top:18px}
      @container(max-width:580px){.pet-album-gallery{gap:12px}.pet-album-portrait{flex-basis:145px;height:210px} .pet-album-gallery{--pet-main-width:min(72cqw,340px)}.pet-album-summary{gap:14px}.pet-album-selected-name{font-size:24px}.pet-album-actions{gap:10px}.pet-album-art[data-peek=bottom] .pet-album-avatar{top:-30%}}
      .pet-shelf{flex:1;height:100%;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,320px);gap:28px;grid-template-rows:minmax(0,1fr);align-items:stretch}
      .pet-shelf[data-wide=false]{grid-template-columns:minmax(0,1fr)}
      .pet-tile-grid{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;align-content:start;display:grid;grid-auto-rows:max-content;grid-template-columns:repeat(auto-fill,minmax(min(100%,160px),1fr));gap:14px;align-items:start}
      .pet-tile{display:flex;flex-direction:column;width:100%;position:relative;padding:0;border:1px solid transparent;border-radius:18px;overflow:hidden;background:color-mix(in srgb,currentColor 3%,transparent);color:inherit;text-align:start;font:inherit;cursor:pointer}
      .pet-tile[aria-pressed=true]{border-color:color-mix(in srgb,currentColor 35%,transparent)}
      .pet-tile[aria-pressed=true]::after{content:"✓";position:absolute;right:10px;top:10px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#303d38;font-size:13px}
      .pet-tile:hover{background:color-mix(in srgb,currentColor 6%,transparent)}
      .pet-tile:focus-visible{outline:3px solid currentColor;outline-offset:3px}
      .pet-tile-copy{display:flex;flex-direction:column;gap:4px;padding:12px 14px 14px;font-size:.92em}
      .pet-inspector{height:100%;min-height:0;overflow:hidden;min-width:0;padding-inline-start:24px;border-inline-start:1px solid color-mix(in srgb,currentColor 14%,transparent)}
      .pet-peek{position:relative;overflow:hidden;flex-shrink:0;height:132px;border-radius:0;background:var(--pet-peek-tint,#dce5e9)}
      .pet-peek .pet-page-preview{position:absolute;transition:translate 220ms ease;transform:rotate(var(--pet-peek-angle));transform-origin:center}
      .pet-peek[data-peek=bottom] .pet-page-preview{left:calc(var(--pet-peek-offset) - 76px);bottom:-34px}
      .pet-peek[data-peek=left] .pet-page-preview{left:-38px;bottom:-12px}
      .pet-peek[data-peek=right] .pet-page-preview{right:-38px;bottom:-12px}
      .pet-tile[aria-pressed=true] .pet-peek[data-peek=bottom] .pet-page-preview{translate:0 -8px}
      .pet-tile[aria-pressed=true] .pet-peek[data-peek=left] .pet-page-preview{translate:8px 0}
      .pet-tile[aria-pressed=true] .pet-peek[data-peek=right] .pet-page-preview{translate:-8px 0}
      .pet-shelf[data-reduced-motion=true] .pet-tile[aria-pressed=true] .pet-peek .pet-page-preview{transition:none;translate:none}
      @media(prefers-reduced-motion:reduce){.pet-tile[aria-pressed=true] .pet-peek .pet-page-preview{transition:none;translate:none}}
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
    `}</style>
    <PetToolbar section={section} state={snapshot.state} navigation={navigation} />
    {snapshot.error && !notice && <Text role="alert" tone="danger">{snapshot.error}</Text>}
    {notice && <div className="pet-toast" role={notice.error ? 'alert' : 'status'}><span>{notice.error ? '!' : '✓'}</span><span>{notice.message}</span>{notice.error && notice.command && <Button variant="ghost" disabled={snapshot.busy} onClick={() => run(notice.command!)}>重试</Button>}<Button variant="ghost" aria-label="关闭提示" onClick={() => setNotice(null)}>×</Button></div>}
    <div className="pet-content" data-section={section}>
    {section === 'shop' ? <Shop {...props} /> : section === 'pets' ? <Pets {...props} /> : section === 'bag' ? <Bag {...props} />
      : section === 'pet-detail' ? <PetDetail {...props} /> : section === 'product-detail' || section === 'bag-detail' ? <ProductDetail {...props} inventory={section === 'bag-detail'} /> : section === 'settings' ? <Settings {...props} /> : <Ledger state={snapshot.state} usage={snapshot.usage} />}
    </div>
  </Stack>
}

function PetDetail(props: Commands) {
  const entity = props.state.pets.find(pet => pet.id === props.navigation?.session.selectedPet) ?? props.state.pets[0]
  return entity ? <Stack gap="large"><PetCard {...props} entity={entity} /><Button disabled={props.busy || entity.status !== 'alive'} onClick={() => props.navigation?.open('bag')}><Glyph kind="outfit" /> 前往背包装扮与喂食</Button></Stack> : <EmptyState title="没有找到这只宠物" />
}
