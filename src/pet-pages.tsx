import { careWarning, initialPetCare, petWeightLabel } from './pet-care.js'
import { useMemo, useState, useSyncExternalStore } from 'cordisx/react'
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
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }
function Preview({ entity, skinId }: { entity: PetEntity; skinId?: string }) {
  const definition = useMemo(() => petAppearance(entity, skinId), [entity.species, entity.skinId, skinId])
  return <div className="pet-preview-stage"><Avatar className="pet-page-preview" definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`}
    style={{ width: 152, height: 152, alignSelf: 'center', flexShrink: 0 }} /></div>
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
function Glyph({ kind }: { kind: 'paw' | 'coin' | 'food' | 'heart' | 'energy' | 'outfit' | 'arrow' }) {
  const paths = { paw: 'M8 14c-4 7 12 7 8 0l-4-4Z M5 6v2 M10 3v2 M15 3v2 M20 6v2', coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12', food: 'M3 11h18c0 11-18 11-18 0Z M8 3v4 M13 2v5 M18 3v4', heart: 'M12 20 3 11C-2 2 10 1 12 7c2-6 14-5 9 4Z', energy: 'M14 2 5 14h7l-2 8 9-13h-7Z', outfit: 'M8 3 2 7l3 5 3-2v11h8V10l3 2 3-5-6-4c0 5-8 5-8 0Z', arrow: 'M8 4l8 8-8 8' }
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
function ProductPreview({ item }: { item: PetProduct }) {
  return item.kind === 'pet' || item.kind === 'skin' ? <Preview entity={productEntity(item)} /> : <div className="pet-preview-stage"><PetFoodArt id={item.id} /></div>
}
function Shop(props: Commands) {
  const { state, busy, navigation, usage } = props
  const [filter, setFilter] = useState(navigation?.session.filter ?? 'all')
  const [hideOwned, setHideOwned] = useState(navigation?.session.hideOwned ?? false)
  const products = PET_CATALOG.filter(item => (filter === 'all' || item.kind === filter) && (!hideOwned || !ownedProduct(state, item)))
  return <Stack gap="medium">
    <Stack direction="row" align="center" justify="space-between" wrap gap="small"><Text><Glyph kind="coin" /> <strong>{state.wallet.balance.toLocaleString()} 宠物币</strong></Text><Button disabled={busy} onClick={() => navigation?.open('ledger')}>钱包与记录 <Glyph kind="arrow" /></Button></Stack>
    {usage?.status !== 'ready' && <Text tone="muted">{usage?.status === 'initializing' ? '正在同步使用奖励…' : usage?.status === 'unavailable' && usage.reason === 'permission-denied' ? '允许读取本机 Token 使用量后，即可积累宠物币。' : '使用奖励暂不可用，恢复后继续同步。'}</Text>}
    <Stack direction="row" gap="small" wrap align="center"><div className="pet-filters" role="group" aria-label="商品类型">{[['all','全部'],['pet','宠物'],['skin','皮肤'],['food','食物'],['item','道具']].map(([id,label]) => <Button key={id} disabled={busy} aria-pressed={filter === id} variant={filter === id ? 'primary' : 'ghost'} onClick={() => { setFilter(id!); if (navigation) navigation.session.filter = id! }}>{label}</Button>)}</div>
      <label className="pet-check"><input type="checkbox" checked={hideOwned} disabled={busy} onChange={event => { setHideOwned(event.target.checked); if (navigation) navigation.session.hideOwned = event.target.checked }} />隐藏已拥有</label>
    </Stack>
    <div style={grid}>{products.map(item => <Card key={item.id}><Stack gap="small"><button className="pet-card-open" data-pet-anchor={item.id} ref={node => { if (node && navigation?.session.anchor === item.id) { node.scrollIntoView({ block: 'nearest' }); navigation.session.anchor = undefined } }} onClick={() => { if (navigation) { navigation.session.product = item.id; navigation.session.anchor = item.id; navigation.open('product-detail') } }}><ProductPreview item={item} /><strong>{item.name}</strong><span className="pet-badge">{ownedProduct(state,item) ? item.kind === 'skin' && state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已拥有' : item.kind === 'food' || item.kind === 'item' ? '消耗品' : '永久解锁'}</span></button><Text><Glyph kind="coin" /> {item.price === 0 ? '免费' : item.price.toLocaleString()}</Text><ProductActions {...props} item={item} /></Stack></Card>)}</div>
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
function QuickFeed({ entity, state, busy, run, navigation }: Commands & { entity: PetEntity }) {
  const [expanded, setExpanded] = useState(false)
  const foods = PET_CATALOG.filter(item => item.kind === 'food' && (state.foodInventory[item.id] ?? 0) > 0)
  return <Stack gap="small"><Button disabled={busy || entity.status !== 'alive'} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Glyph kind="food" /> 喂食</Button>{expanded && <Stack gap="small">{foods.map(food => <Button key={food.id} disabled={busy} onClick={() => { run({type:'feed',petId:entity.id,foodId:food.id}); setExpanded(false) }}>{food.name} · {state.foodInventory[food.id]} 份</Button>)}{!foods.length && <Button disabled={busy} onClick={() => { if (navigation) { navigation.session.filter = 'food'; navigation.open('shop') } }}>补充食物</Button>}</Stack>}</Stack>
}
function Pets(props: Commands) {
  const { state, navigation, busy } = props
  return <Stack gap="medium"><Stack direction="row" justify="space-between" wrap gap="small"><Text><Glyph kind="paw" /> 已出场 {state.activePetIds.length}/{state.settings.maxActivePets}</Text><Button disabled={busy} onClick={() => navigation?.open('shop')}>发现新伙伴</Button></Stack>
    <div style={grid}>{state.pets.map(entity => <Card key={entity.id}><Stack gap="small"><button className="pet-card-open" data-pet-anchor={entity.id} ref={node => { if (node && navigation?.session.anchor === entity.id) { node.scrollIntoView({ block: 'nearest' }); navigation.session.anchor = undefined } }} onClick={() => { if (navigation) { navigation.session.selectedPet = entity.id; navigation.session.anchor = entity.id; navigation.open('pet-detail') } }}><Preview entity={entity} /><strong>{entity.name}</strong><span className="pet-badge">{entity.id === state.mainPetId ? '主宠 · ' : ''}{entity.status === 'buried' ? '已安葬' : entity.status === 'dead' ? '已逝去' : state.activePetIds.includes(entity.id) ? '陪伴中' : '休息中'}</span></button>
      <Text tone="muted">{entity.status === 'alive' ? careWarning(entity.care) : '相伴的记忆会一直保留'}</Text>
      {entity.status === 'alive' && <Text><span title="饱食度" aria-label={`饱食度 ${Math.round(entity.care.fullness)}/100`}><Glyph kind="food" /> {Math.round(entity.care.fullness)}/100</span> <span className="pet-affinity" title="亲密度" aria-label={`亲密度 ${entity.affinity}`}><Glyph kind="heart" /> {entity.affinity}</span></Text>}
      <Stack direction="row" gap="small" wrap><QuickFeed {...props} entity={entity} /><Button disabled={busy} onClick={() => { if (navigation) { navigation.session.selectedPet = entity.id; navigation.session.anchor = entity.id; navigation.open('pet-detail') } }}>照顾与装扮 <Glyph kind="arrow" /></Button></Stack>
    </Stack></Card>)}</div></Stack>
}
function Bag(props: Commands) {
  const { state, navigation } = props
  const items = PET_CATALOG.filter(item => item.kind === 'skin' ? state.ownedSkinIds.includes(item.id) : item.kind === 'food' ? (state.foodInventory[item.id] ?? 0) > 0 : item.kind === 'item' && (state.itemInventory[item.id] ?? 0) > 0)
  return <Stack gap="medium"><Text tone="muted">选择物品，查看效果并为宠物使用。</Text><div style={grid}>{items.map(item => <Card key={item.id}><button className="pet-card-open" data-pet-anchor={item.id} ref={node => { if (node && navigation?.session.anchor === item.id) { node.scrollIntoView({ block: 'nearest' }); navigation.session.anchor = undefined } }} onClick={() => { if (navigation) { navigation.session.product = item.id; navigation.session.anchor = item.id; navigation.open('bag-detail') } }}><ProductPreview item={item} /><strong>{item.name}</strong><span className="pet-badge">{item.kind === 'skin' ? state.pets.some(pet => pet.skinId === item.id) ? '已装备' : '已解锁' : `× ${item.kind === 'food' ? state.foodInventory[item.id] : state.itemInventory[item.id]}`}</span></button></Card>)}</div>{!items.length && <EmptyState title="背包还是空的" description="到商店挑选一些补给吧。" />}</Stack>
}
function ProductDetail(props: Commands & { inventory?: boolean }) {
  const { state, navigation, busy, run, inventory } = props
  const item = PET_CATALOG.find(item => item.id === navigation?.session.product)
  const [selected, setSelected] = useState(navigation?.session.selectedPet ?? state.mainPetId)
  if (!item) return <EmptyState title="请选择一件商品" />
  const pets = state.pets.filter(pet => (!item.species || pet.species === item.species) && (item.kind === 'item' ? pet.status !== 'alive' : pet.status === 'alive'))
  const entity = pets.find(pet => pet.id === selected) ?? pets[0]
  const owned = ownedProduct(state,item)
  return <Stack gap="large">{item.kind === 'skin' && entity ? <Preview entity={entity} skinId={item.id} /> : <ProductPreview item={item} />}<Text><strong>{item.name}</strong></Text><Text tone="muted">{item.kind === 'food' ? `消耗 1 份，饱食度 +${item.fullness}，精力 +${item.energy}，亲密度 +${item.affinity}。` : item.kind === 'item' ? '消耗 1 枚复活宠物，保留名字、装备和亲密度。' : item.kind === 'skin' ? '试穿不会改变当前装备；解锁后可应用到适用宠物。' : '永久解锁一位新伙伴。'}</Text>
    {item.requiredAffinity && <Text>亲密度要求：{item.requiredAffinity}{item.kind === 'pet' ? '（达到后也可免费领养）' : ''}</Text>}
    {!inventory && <><Text><Glyph kind="coin" /> {item.price.toLocaleString()} 宠物币</Text><ProductActions {...props} item={item} /></>}
    {item.kind !== 'pet' && <Stack gap="medium">{pets.length ? <Select aria-label="选择使用物品的宠物" value={entity!.id} options={pets.map(pet => ({ value: pet.id, label: pet.name }))} onChange={id => { setSelected(id); if (navigation) navigation.session.selectedPet = id }} /> : <Text tone="muted">没有适用的宠物</Text>}
      {(item.kind === 'food' || item.kind === 'item') && <Text tone="muted">背包剩余 {item.kind === 'food' ? state.foodInventory[item.id] ?? 0 : state.itemInventory[item.id] ?? 0} 份</Text>}
      <Button disabled={busy || !entity || (item.kind === 'skin' ? !owned || entity.skinId === item.id : item.kind === 'food' ? !(state.foodInventory[item.id] > 0) : !(state.itemInventory[item.id] > 0))} onClick={() => { if (!entity) return; run(item.kind === 'skin' ? { type:'equip',petId:entity.id,skinId:item.id } : item.kind === 'food' ? {type:'feed',petId:entity.id,foodId:item.id} : {type:'revive',petId:entity.id}) }}>{item.kind === 'skin' ? entity?.skinId === item.id ? '已装备' : '装备皮肤' : item.kind === 'food' ? '喂食' : '使用重启核心'}</Button>
    </Stack>}
  </Stack>
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
export function PetPage({ client, section, navigation }: { client: PetClient; section: PetPageSection; navigation?: PetPageNavigation; sleep?: (id: string) => void }) {
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const [notice, setNotice] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const run = (command: PetCommand) => {
    setLocalError(null); setNotice(null)
    void client.execute(command).then(() => { if (client.getSnapshot().error) return; setNotice(command.type === 'feed' ? '喂食成功' : command.type === 'equip' ? '已换上新装扮' : command.type === 'buy' || command.type === 'claim' ? '已放入背包或宠物列表' : '已保存') }).catch(error => setLocalError(error instanceof Error ? error.message : '操作失败，请重试'))
  }
  if (!snapshot.state) return <EmptyState title={snapshot.error ? '暂时无法读取宠物' : '正在准备宠物…'} description={snapshot.error ?? undefined} />
  const props = { state: snapshot.state, busy: snapshot.busy, usage: snapshot.usage, run, navigation, sleep: client.requestSleep }
  return <Stack gap="large" aria-busy={snapshot.busy}>
    <style>{`
      .pet-glyph{display:inline-block;vertical-align:middle;flex-shrink:0}
      .pet-preview-stage{display:flex;align-items:center;justify-content:center;height:156px;width:100%;border-radius:12px;background:#c8cbd1;color:#20242c;overflow:hidden}
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
    {notice && <Text role="status">{notice}</Text>}
    {(localError || snapshot.error) && <Text role="alert" tone="danger">{localError || snapshot.error}</Text>}
    {section === 'shop' ? <Shop {...props} /> : section === 'pets' ? <Pets {...props} /> : section === 'bag' ? <Bag {...props} />
      : section === 'pet-detail' ? <PetDetail {...props} /> : section === 'product-detail' || section === 'bag-detail' ? <ProductDetail {...props} inventory={section === 'bag-detail'} /> : section === 'settings' ? <Settings {...props} /> : <Ledger state={snapshot.state} usage={snapshot.usage} />}
  </Stack>
}

function PetDetail(props: Commands) {
  const entity = props.state.pets.find(pet => pet.id === props.navigation?.session.selectedPet) ?? props.state.pets[0]
  return entity ? <Stack gap="large"><PetCard {...props} entity={entity} /><Button disabled={props.busy || entity.status !== 'alive'} onClick={() => props.navigation?.open('bag')}><Glyph kind="outfit" /> 前往背包装扮与喂食</Button></Stack> : <EmptyState title="没有找到这只宠物" />
}
