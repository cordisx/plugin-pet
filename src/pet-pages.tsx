import { useMemo, useState, useSyncExternalStore } from 'cordisx/react'
import { Avatar } from '@oneworks/avatar-react'
import { Button, Card, EmptyState, Select, Stack, Text } from 'cordisx/ui'
import { PET_CATALOG, PET_DEFAULT_SKINS, petProduct } from './pet-catalog.js'
import type { PetProduct } from './pet-catalog.js'
import type { PetCommand, PetEntity, PetSettings, PetState } from './pet-domain.js'
import type { PetClient } from './pet-client.js'
import { petAppearance } from './pet-appearance.js'

export type PetPageSection = 'shop' | 'pets' | 'bag' | 'settings' | 'ledger'
type Commands = { state: PetState; busy: boolean; run: (command: PetCommand) => void }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }
function Preview({ entity, skinId }: { entity: PetEntity; skinId?: string }) {
  const definition = useMemo(() => petAppearance(entity, skinId), [entity.species, entity.skinId, skinId])
  return <Avatar className="pet-page-preview" definition={definition} interactive={false} autoplay={false} aria-label={`${entity.name}外观预览`}
    style={{ width: 112, height: 112, alignSelf: 'center', flexShrink: 0 }} />
}
function productEntity(product: PetProduct): PetEntity {
  const species = product.species ?? 'cat'
  return { id: `preview:${product.id}`, species, skinId: product.kind === 'skin' ? product.id : PET_DEFAULT_SKINS[species], name: product.name, affinity: 0, x: .5 }
}
function Wallet({ state }: { state: PetState }) {
  return <Stack gap="small">
    <Text><strong>{state.wallet.balance.toLocaleString()} 宠物币</strong></Text>
    <Text tone="muted">使用奖励暂未开放。免费外观、欢迎点心和相伴解锁现在就可以体验。</Text>
  </Stack>
}
function Shop({ state, busy, run }: Commands) {
  const [filter, setFilter] = useState('all')
  const products = PET_CATALOG.filter(item => filter === 'all' || item.kind === filter)
  return <Stack gap="large">
    <Wallet state={state} />
    <Select aria-label="商品类型" value={filter} onChange={setFilter} options={[
      { value: 'all', label: '全部商品' }, { value: 'pet', label: '宠物' }, { value: 'skin', label: '皮肤' }, { value: 'food', label: '食物' },
    ]} />
    <div style={grid}>{products.map(item => {
      const owned = item.kind === 'pet' ? state.pets.some(entity => entity.species === item.species)
        : item.kind === 'skin' && state.ownedSkinIds.includes(item.id)
      const applicable = item.kind !== 'skin' || state.pets.some(entity => entity.species === item.species && entity.affinity >= (item.requiredAffinity ?? 0))
      const affinity = Math.max(0, ...state.pets.map(entity => entity.affinity))
      const canClaim = item.kind === 'pet' && !!item.requiredAffinity && affinity >= item.requiredAffinity
      const reason = owned ? '已拥有' : !applicable ? '尚未满足适用宠物或亲密度要求' : state.wallet.balance < item.price ? '宠物币不足' : ''
      return <Card key={item.id}>
        <Stack gap="medium" style={{ height: '100%' }}>
          {item.kind !== 'food' ? <Preview entity={productEntity(item)} /> : <Text style={{ fontSize: 48, textAlign: 'center' }} aria-hidden="true">{item.id === 'food-snack' ? '🍪' : item.id === 'food-meal' ? '🍱' : '🎂'}</Text>}
          <Text><strong>{item.name}</strong></Text>
          <Text tone="muted">{item.kind === 'food' ? `消耗品 · 亲密度 +${item.affinity}` : `永久解锁${item.species ? ` · ${item.species === 'cat' ? '猫猫' : item.species === 'dog' ? '小狗' : '兔兔'}` : ''}`}</Text>
          <Text>{item.price === 0 ? '免费' : `${item.price} 宠物币`}{item.requiredAffinity ? ` · ${item.kind === 'pet' ? '或' : '需要'}亲密度 ${item.requiredAffinity}` : ''}</Text>
          {item.kind === 'skin' && !owned && <Text tone="muted">当前仅预览；解锁后才能装备。</Text>}
          <Stack direction="row" gap="small" wrap style={{ marginTop: 'auto' }}>
            <Button disabled={busy || !!reason} title={reason || undefined} onClick={() => run({ type: 'buy', productId: item.id })}>
              {owned ? '已拥有' : item.price === 0 ? '领取' : '购买'}
            </Button>
            {item.kind === 'pet' && item.requiredAffinity && !owned && <Button disabled={busy || !canClaim}
              title={canClaim ? undefined : `任一宠物亲密度达到 ${item.requiredAffinity} 即可免费领养`}
              onClick={() => run({ type: 'claim', productId: item.id })}>相伴解锁 {Math.min(affinity, item.requiredAffinity)}/{item.requiredAffinity}</Button>}
          </Stack>
          {reason && !owned && <Text tone="muted">{reason}</Text>}
        </Stack>
      </Card>
    })}</div>
  </Stack>
}
function PetCard({ entity, state, busy, run }: Commands & { entity: PetEntity }) {
  const [name, setName] = useState(entity.name)
  const active = state.activePetIds.includes(entity.id)
  return <Card><Stack gap="medium">
    <Preview entity={entity} />
    <Text><strong>{entity.name}</strong>{entity.id === state.mainPetId ? ' · 主宠' : ''}</Text>
    <Text tone="muted">亲密度 {entity.affinity} · {petProduct(entity.skinId).name}</Text>
    <form onSubmit={event => { event.preventDefault(); run({ type: 'rename', petId: entity.id, name }) }}>
      <Stack gap="small">
        <label htmlFor={`name-${entity.id}`}>名字</label>
        <input id={`name-${entity.id}`} value={name} maxLength={24} required disabled={busy} onChange={event => setName(event.currentTarget.value)} />
        <Button type="submit" disabled={busy || !name.trim() || name.trim() === entity.name}>保存名字</Button>
      </Stack>
    </form>
    <Stack direction="row" wrap gap="small">
      <Button disabled={busy || (!active && state.activePetIds.length >= state.settings.maxActivePets)}
        onClick={() => run({ type: 'setActive', petIds: active ? state.activePetIds.filter(id => id !== entity.id) : [...state.activePetIds, entity.id] })}>{active ? '收起' : '出场'}</Button>
      <Button disabled={busy || entity.id === state.mainPetId} onClick={() => run({ type: 'setMain', petId: entity.id })}>设为主宠</Button>
      <Button disabled={busy} onClick={() => run({ type: 'move', petId: entity.id, x: .5 })}>重置位置</Button>
    </Stack>
  </Stack></Card>
}
function Pets(props: Commands) {
  return <Stack gap="large">
    <Text tone="muted">已出场 {props.state.activePetIds.length}/{props.state.settings.maxActivePets}。主宠同时陪伴在发送按钮上；收起不会影响亲密度。</Text>
    <div style={grid}>{props.state.pets.map(entity => <PetCard key={entity.id} {...props} entity={entity} />)}</div>
  </Stack>
}
function Bag({ state, busy, run }: Commands) {
  const [selectedId, setSelectedId] = useState(state.mainPetId)
  const [previewSkin, setPreviewSkin] = useState<string | null>(null)
  const entity = state.pets.find(item => item.id === selectedId) ?? state.pets[0]!
  const skins = PET_CATALOG.filter(item => item.kind === 'skin' && item.species === entity.species)
  const skin = previewSkin && skins.some(item => item.id === previewSkin) ? previewSkin : entity.skinId
  const owned = state.ownedSkinIds.includes(skin)
  return <Stack gap="large">
    <Select aria-label="照顾哪只宠物" value={entity.id} options={state.pets.map(item => ({ value: item.id, label: item.name }))}
      onChange={id => { setSelectedId(id); setPreviewSkin(null) }} />
    <Card><Stack gap="medium">
      <Preview entity={entity} skinId={skin} />
      <Select aria-label="试穿皮肤" value={skin} onChange={setPreviewSkin} options={skins.map(item => ({ value: item.id, label: `${item.name}${state.ownedSkinIds.includes(item.id) ? '' : ' · 未解锁'}` }))} />
      <Text tone="muted">{owned ? '已拥有，可装备。' : '仅试穿，不会改变宠物当前装备。'}</Text>
      <Button disabled={busy || !owned || skin === entity.skinId} onClick={() => run({ type: 'equip', petId: entity.id, skinId: skin })}>{skin === entity.skinId ? '已装备' : '装备皮肤'}</Button>
    </Stack></Card>
    <div style={grid}>{PET_CATALOG.filter(item => item.kind === 'food').map(item => <Card key={item.id}><Stack gap="medium">
      <Text><strong>{item.name}</strong> · {state.foodInventory[item.id] ?? 0} 份</Text>
      <Text tone="muted">消耗 1 份，{entity.name}的亲密度 +{item.affinity}。</Text>
      <Button disabled={busy || !(state.foodInventory[item.id] > 0)} onClick={() => run({ type: 'feed', petId: entity.id, foodId: item.id })}>喂给{entity.name}</Button>
    </Stack></Card>)}</div>
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
    <Text tone="muted">减少动态效果会停用滚动、跳跃和大幅形变。离开或不喂食不会扣除亲密度。</Text>
  </Stack>
}
function Ledger({ state }: { state: PetState }) {
  const records = state.receipts.filter(item => ['buy', 'claim', 'feed', 'usage', 'usage-baseline'].includes(item.kind)).slice().reverse()
  return <Stack gap="large">
    <Wallet state={state} />
    <Text tone="muted">累计获得 {state.wallet.earned} · 累计花费 {state.wallet.spent}</Text>
    {!records.length ? <EmptyState title="还没有收支记录" description="购买、喂食和相伴解锁会记录在这里。" /> : records.map(item => <Stack key={item.key} direction="row" justify="space-between" gap="medium">
      <Stack gap="small"><Text>{item.detail}</Text><Text tone="muted">{new Date(item.at).toLocaleString()}</Text></Stack>
      <Text>{item.coins > 0 ? '+' : ''}{item.coins} 宠物币</Text>
    </Stack>)}
  </Stack>
}
export function PetPage({ client, section }: { client: PetClient; section: PetPageSection }) {
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
  const [localError, setLocalError] = useState<string | null>(null)
  const run = (command: PetCommand) => {
    setLocalError(null)
    void client.execute(command).catch(error => setLocalError(error instanceof Error ? error.message : '操作失败，请重试'))
  }
  if (!snapshot.state) return <EmptyState title={snapshot.error ? '暂时无法读取宠物' : '正在准备宠物…'} description={snapshot.error ?? undefined} />
  const props = { state: snapshot.state, busy: snapshot.busy, run }
  return <Stack gap="large" aria-busy={snapshot.busy}>
    <style>{'.pet-page-preview>.interactive-avatar{width:100%;height:100%;box-sizing:border-box}'}</style>
    {(localError || snapshot.error) && <Text role="alert" tone="danger">{localError || snapshot.error}</Text>}
    {section === 'shop' ? <Shop {...props} /> : section === 'pets' ? <Pets {...props} /> : section === 'bag' ? <Bag {...props} />
      : section === 'settings' ? <Settings {...props} /> : <Ledger state={snapshot.state} />}
  </Stack>
}
