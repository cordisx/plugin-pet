import { PET_CATALOG, PET_DEFAULT_SKINS, PET_ECONOMY, petProduct } from './pet-catalog.js'
import type { PetSpecies } from './pet-catalog.js'

export type PetEntity = {
  id: string
  species: PetSpecies
  name: string
  skinId: string
  affinity: number
  x: number
  interaction?: { day: string; count: number; lastAt: number }
}
export type PetSettings = {
  visible: boolean
  followPointer: boolean
  clickFeedback: boolean
  draggable: boolean
  idleAnimations: boolean
  reducedMotion: boolean
  maxActivePets: number
}
export type PetReceipt = { key: string; kind: string; at: number; coins: number; detail: string }
export type PetState = {
  version: 1
  pets: PetEntity[]
  mainPetId: string
  activePetIds: string[]
  wallet: { balance: number; earned: number; spent: number }
  ownedSkinIds: string[]
  foodInventory: Record<string, number>
  settings: PetSettings
  /** Economic effects retain permanent idempotency evidence. */
  receipts: PetReceipt[]
  /** Bounded retry window for non-economic preferences and interaction. */
  recentReceipts: PetReceipt[]
  usage: Record<string, { totalTokens: number; rewardedCoins: number; remainderTokens: number }>
}
export type PetCommand =
  | { type: 'buy'; productId: string; quantity?: number }
  | { type: 'claim'; productId: string }
  | { type: 'equip'; petId: string; skinId: string }
  | { type: 'feed'; petId: string; foodId: string }
  | { type: 'rename'; petId: string; name: string }
  | { type: 'setActive'; petIds: string[] }
  | { type: 'setMain'; petId: string }
  | { type: 'move'; petId: string; x: number }
  | { type: 'settings'; value: Partial<PetSettings> }
  | { type: 'interact'; petId: string }
export type PetTransaction = { key: string; now: number }
export type PetTransition = { state: PetState; duplicate: boolean; receipt: PetReceipt }
export const DEFAULT_PET_SETTINGS: PetSettings = {
  visible: true, followPointer: true, clickFeedback: true, draggable: true,
  idleAnimations: true, reducedMotion: false, maxActivePets: 3,
}
export function createPetState(): PetState {
  return {
    version: 1,
    pets: [{ id: 'pet:cat', species: 'cat', name: '猫猫', skinId: 'skin-white', affinity: 0, x: .7 }],
    mainPetId: 'pet:cat', activePetIds: ['pet:cat'],
    wallet: { balance: 0, earned: 0, spent: 0 }, ownedSkinIds: ['skin-white', 'skin-orange'],
    foodInventory: { 'food-snack': 3 }, settings: { ...DEFAULT_PET_SETTINGS }, receipts: [], recentReceipts: [], usage: {},
  }
}
export const PET_RECENT_RECEIPT_LIMIT = 128
const economicKinds = new Set(['buy', 'claim', 'feed', 'usage', 'usage-baseline'])
const recentKinds = new Set(['equip', 'rename', 'setActive', 'setMain', 'move', 'settings', 'interact'])
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function usageSource(value: string): boolean { return /^[a-zA-Z0-9:_-]{1,120}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value) }
function validReceipt(item: PetReceipt): boolean {
  return record(item) && typeof item.key === 'string' && item.key.length > 0 && item.key.length <= 200
    && integer(item.at) && item.at <= 8.64e15 && Number.isSafeInteger(item.coins)
    && typeof item.kind === 'string' && (economicKinds.has(item.kind) || recentKinds.has(item.kind))
    && typeof item.detail === 'string' && item.detail.length <= 256
    && (economicKinds.has(item.kind) || item.coins === 0)
}
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function pet(state: PetState, id: string): PetEntity {
  const result = state.pets.find(item => item.id === id)
  assert(result, '你还没有这只宠物')
  return result
}
function validSettings(value: PetSettings): boolean {
  return ['visible', 'followPointer', 'clickFeedback', 'draggable', 'idleAnimations', 'reducedMotion']
    .every(key => typeof value[key as keyof PetSettings] === 'boolean')
    && Number.isSafeInteger(value.maxActivePets) && value.maxActivePets >= 1 && value.maxActivePets <= 12
}
/** Fail closed on malformed economy data; never silently replace an existing wallet. */
export function migratePetState(raw: unknown): PetState {
  if (raw == null) return createPetState()
  assert(record(raw), '宠物存档无效')
  const state = structuredClone(raw) as PetState
  assert(state.version === 1, '宠物存档版本不兼容，请升级插件')
  assert(state.settings === undefined || record(state.settings), '宠物设置无效')
  state.settings = { ...DEFAULT_PET_SETTINGS, ...state.settings }
  assert(validSettings(state.settings), '宠物设置无效')
  assert(Array.isArray(state.pets) && state.pets.length > 0, '宠物存档缺少宠物')
  const ids = new Set<string>()
  for (const item of state.pets) {
    assert(record(item), '宠物状态无效')
    assert(typeof item.id === 'string' && item.id.length > 0 && !ids.has(item.id), '宠物身份重复或无效')
    ids.add(item.id)
    assert(['cat', 'dog', 'rabbit'].includes(item.species), '未知宠物类型')
    assert(typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 24, '宠物名字无效')
    assert(integer(item.affinity) && Number.isFinite(item.x) && item.x >= 0 && item.x <= 1, '宠物状态无效')
    const skin = petProduct(item.skinId)
    assert(skin.kind === 'skin' && skin.species === item.species, '宠物皮肤不兼容')
    if (item.interaction) assert(typeof item.interaction.day === 'string' && integer(item.interaction.count) && integer(item.interaction.lastAt), '互动记录无效')
  }
  assert(new Set(state.pets.map(item => item.species)).size === state.pets.length, '宠物类型重复')
  assert(ids.has(state.mainPetId), '主宠不存在')
  assert(Array.isArray(state.activePetIds) && new Set(state.activePetIds).size === state.activePetIds.length
    && state.activePetIds.every(id => ids.has(id)) && state.activePetIds.length <= state.settings.maxActivePets, '出场列表无效')
  assert(record(state.wallet) && integer(state.wallet.balance) && integer(state.wallet.earned) && integer(state.wallet.spent)
    && state.wallet.earned - state.wallet.spent === state.wallet.balance, '宠物币账目无效')
  assert(Array.isArray(state.ownedSkinIds) && new Set(state.ownedSkinIds).size === state.ownedSkinIds.length && state.ownedSkinIds.every(id => petProduct(id).kind === 'skin'), '皮肤库存无效')
  assert(state.pets.every(item => state.ownedSkinIds.includes(item.skinId)), '已装备未拥有皮肤')
  assert(record(state.foodInventory) && Object.entries(state.foodInventory).every(([id, count]) => petProduct(id).kind === 'food' && integer(count)), '食物库存无效')
  assert(Array.isArray(state.receipts) && state.receipts.every(validReceipt), '交易记录无效')
  assert(state.recentReceipts === undefined || (Array.isArray(state.recentReceipts) && state.recentReceipts.every(validReceipt)), '近期操作记录无效')
  const allReceipts = [...state.receipts, ...(state.recentReceipts ?? [])]
  assert(new Set(allReceipts.map(item => item.key)).size === allReceipts.length, '交易标识重复')
  // Early v1 builds kept preference events in the ledger. Migrate without losing any financial key.
  state.receipts = allReceipts.filter(item => economicKinds.has(item.kind))
  state.recentReceipts = allReceipts.filter(item => recentKinds.has(item.kind)).slice(-PET_RECENT_RECEIPT_LIMIT)
  const earned = state.receipts.reduce((total, item) => total + Math.max(0, item.coins), 0)
  const spent = state.receipts.reduce((total, item) => total + Math.max(0, -item.coins), 0)
  assert(earned === state.wallet.earned && spent === state.wallet.spent, '账目与交易记录不一致')
  assert(record(state.usage) && Object.entries(state.usage).every(([source, item]) => usageSource(source) && record(item)
    && integer(item.totalTokens) && integer(item.rewardedCoins) && integer(item.remainderTokens)
    && item.remainderTokens < PET_ECONOMY.tokensPerCoin), '用量结算记录无效')
  return state
}
function begin(state: PetState, transaction: PetTransaction): PetTransition | null {
  assert(typeof transaction.key === 'string' && transaction.key.length > 0 && transaction.key.length <= 200 && integer(transaction.now) && transaction.now <= 8.64e15, '交易标识无效')
  const receipt = state.receipts.find(item => item.key === transaction.key) ?? state.recentReceipts.find(item => item.key === transaction.key)
  return receipt ? { state, duplicate: true, receipt } : null
}
function finish(state: PetState, transaction: PetTransaction, kind: string, coins: number, detail: string): PetTransition {
  const receipt = { key: transaction.key, at: transaction.now, kind, coins, detail }
  if (economicKinds.has(kind)) state.receipts.push(receipt)
  else state.recentReceipts = [...state.recentReceipts, receipt].slice(-PET_RECENT_RECEIPT_LIMIT)
  return { state, duplicate: false, receipt }
}
function unlockAffinitySkins(state: PetState, entity: PetEntity): void {
  for (const item of PET_CATALOG) if (item.kind === 'skin' && item.species === entity.species
    && item.requiredAffinity && entity.affinity >= item.requiredAffinity && !state.ownedSkinIds.includes(item.id)) state.ownedSkinIds.push(item.id)
}
export function applyPetCommand(input: PetState, command: PetCommand, transaction: PetTransaction): PetTransition {
  const previous = begin(input, transaction)
  if (previous) return previous
  const state = structuredClone(input)
  let coins = 0
  let detail: string = command.type
  switch (command.type) {
    case 'claim': {
      const item = petProduct(command.productId)
      assert(item.kind === 'pet' && item.species && item.requiredAffinity, '这件商品不支持相伴解锁')
      assert(!state.pets.some(entity => entity.species === item.species), '你已拥有这只宠物')
      assert(state.pets.some(entity => entity.affinity >= item.requiredAffinity!), `需要一只宠物达到 ${item.requiredAffinity} 亲密度`)
      const skinId = PET_DEFAULT_SKINS[item.species]
      state.pets.push({ id: `pet:${item.species}`, species: item.species, name: item.name, skinId, affinity: 0, x: .3 })
      if (!state.ownedSkinIds.includes(skinId)) state.ownedSkinIds.push(skinId)
      detail = `${item.name} · 相伴解锁`
      break
    }
    case 'buy': {
      const item = petProduct(command.productId)
      const quantity = command.quantity ?? 1
      assert(integer(quantity) && quantity > 0 && quantity <= 99, '购买数量应为 1 至 99')
      assert(item.kind === 'food' || quantity === 1, '永久商品只能购买一次')
      if (item.kind === 'pet') assert(!state.pets.some(entity => entity.species === item.species), '你已拥有这只宠物')
      if (item.kind === 'skin') {
        assert(!state.ownedSkinIds.includes(item.id), '你已拥有这款皮肤')
        assert(state.pets.some(entity => entity.species === item.species && entity.affinity >= (item.requiredAffinity ?? 0)), '需要先拥有适用宠物并达到亲密度要求')
      }
      const cost = item.price * quantity
      assert(state.wallet.balance >= cost, '宠物币不足')
      state.wallet.balance -= cost
      state.wallet.spent += cost
      coins = -cost
      if (item.kind === 'pet') {
        const species = item.species!
        const skinId = PET_DEFAULT_SKINS[species]
        state.pets.push({ id: `pet:${species}`, species, name: item.name, skinId, affinity: 0, x: .3 })
        if (!state.ownedSkinIds.includes(skinId)) state.ownedSkinIds.push(skinId)
      } else if (item.kind === 'skin') state.ownedSkinIds.push(item.id)
      else {
        const count = (state.foodInventory[item.id] ?? 0) + quantity
        assert(integer(count), '食物库存超出可安全保存范围')
        state.foodInventory[item.id] = count
      }
      detail = `${item.name} × ${quantity}`
      break
    }
    case 'equip': {
      const entity = pet(state, command.petId)
      const skin = petProduct(command.skinId)
      assert(skin.kind === 'skin' && skin.species === entity.species, '这款皮肤不适用于该宠物')
      assert(state.ownedSkinIds.includes(skin.id), '请先解锁这款皮肤')
      entity.skinId = skin.id
      break
    }
    case 'feed': {
      const entity = pet(state, command.petId)
      const food = petProduct(command.foodId)
      assert(food.kind === 'food' && (state.foodInventory[food.id] ?? 0) > 0, '背包中没有这份食物')
      state.foodInventory[food.id]--
      entity.affinity += food.affinity ?? 0
      assert(integer(entity.affinity), '亲密度超出可安全保存范围')
      unlockAffinitySkins(state, entity)
      detail = `${entity.name} · ${food.name}`
      break
    }
    case 'rename': {
      const name = command.name.trim()
      assert(name.length > 0 && name.length <= 24, '名字应为 1 至 24 个字符')
      pet(state, command.petId).name = name
      break
    }
    case 'setActive':
      assert(new Set(command.petIds).size === command.petIds.length && command.petIds.length <= state.settings.maxActivePets, '出场数量超过当前设置或有重复宠物')
      command.petIds.forEach(id => pet(state, id))
      state.activePetIds = [...command.petIds]
      break
    case 'setMain': pet(state, command.petId); state.mainPetId = command.petId; break
    case 'move':
      assert(Number.isFinite(command.x), '宠物位置无效')
      pet(state, command.petId).x = Math.max(0, Math.min(1, command.x))
      break
    case 'settings': {
      const settings = { ...state.settings, ...command.value }
      assert(validSettings(settings) && state.activePetIds.length <= settings.maxActivePets, '设置无效，请先减少出场宠物')
      state.settings = settings
      break
    }
    case 'interact': {
      const entity = pet(state, command.petId)
      const day = new Date(transaction.now).toISOString().slice(0, 10)
      const history = entity.interaction
      const count = history?.day === day ? history.count : 0
      if ((!history || transaction.now - history.lastAt >= PET_ECONOMY.interactionCooldownMs) && count < PET_ECONOMY.interactionDailyLimit) {
        entity.affinity++
        assert(integer(entity.affinity), '亲密度超出可安全保存范围')
        entity.interaction = { day, count: count + 1, lastAt: transaction.now }
        unlockAffinitySkins(state, entity)
      }
      break
    }
  }
  return finish(state, transaction, command.type, coins, detail)
}
/** Only a trusted adapter may supply a monotonic aggregate of eligible tokens.
 * Its first snapshot establishes a baseline, so historical tokens are never reissued as new income. */
export type TrustedPetUsage = { sourceId: string; totalTokens: number }
export function settlePetUsage(input: PetState, usage: TrustedPetUsage, transaction: PetTransaction): PetTransition {
  const previous = begin(input, transaction)
  if (previous) return previous
  assert(usageSource(usage.sourceId) && integer(usage.totalTokens), '可信用量数据无效')
  const state = structuredClone(input)
  const prior = state.usage[usage.sourceId]
  if (!prior) {
    state.usage[usage.sourceId] = { totalTokens: usage.totalTokens, rewardedCoins: 0, remainderTokens: 0 }
    return finish(state, transaction, 'usage-baseline', 0, '已建立用量起点')
  }
  assert(usage.totalTokens >= prior.totalTokens, '用量回退，等待数据源恢复后再结算')
  const eligible = usage.totalTokens - prior.totalTokens + prior.remainderTokens
  assert(integer(eligible), '用量超出可安全结算范围')
  const reward = Math.floor(eligible / PET_ECONOMY.tokensPerCoin)
  assert(Number.isSafeInteger(state.wallet.earned + reward), '宠物币超出可安全结算范围')
  state.wallet.balance += reward
  state.wallet.earned += reward
  state.usage[usage.sourceId] = { totalTokens: usage.totalTokens, rewardedCoins: prior.rewardedCoins + reward, remainderTokens: eligible % PET_ECONOMY.tokensPerCoin }
  return finish(state, transaction, 'usage', reward, '正常使用奖励')
}
