import type { PetCommand, PetState } from './pet-domain.js'

export type PetPurchaseCommand = Extract<PetCommand, { type: 'buy' | 'adopt' | 'device-upgrade' }>
export type PetEconomyBinding = { instanceId: string; accountId: string }
export type PetPurchaseIntent = {
  key: string
  command: PetPurchaseCommand
  itemId: string
  quantity: number
  total: number
  at: number
}
export type PetSharedReceipt = {
  key: string
  orderId: string
  command: PetPurchaseCommand
  itemId: string
  quantity: number
  total: number
  at: number
}
export type PetEconomyState = {
  storeId: string
  baseUrl: string
  binding: PetEconomyBinding
  migration: {
    status: 'pending' | 'complete'
    key: string
    sourceId: string
    snapshotHash: string
    backupDocumentId: string
    legacyBalance: number
    receiptId?: string
  }
  pending?: PetPurchaseIntent
  receipts: PetSharedReceipt[]
}
export function samePetBinding(a: PetEconomyBinding, b: PetEconomyBinding): boolean {
  return a.instanceId === b.instanceId && a.accountId === b.accountId
}
export function isPetPurchase(command: PetCommand): command is PetPurchaseCommand {
  return ['buy', 'adopt', 'device-upgrade'].includes(command.type)
}
export function petEconomyLocked(state: PetState): boolean {
  return !!state.economy && (state.economy.migration.status === 'pending' || !!state.economy.pending)
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error('共享经济存档无效；保留原存档等待恢复')
}
export function validatePetEconomy(value: unknown): asserts value is PetEconomyState {
  assert(
    object(value) && object(value.binding) && typeof value.storeId === 'string'
      && /^[a-f0-9-]{36}$/.test(value.storeId),
  )
  assert(id(value.binding.instanceId) && id(value.binding.accountId))
  assert(typeof value.baseUrl === 'string' && value.baseUrl.length <= 2048)
  const endpoint = new URL(value.baseUrl)
  assert(
    ['http:', 'https:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password && !endpoint.search
      && !endpoint.hash,
  )
  const migration = value.migration
  assert(object(migration) && ['pending', 'complete'].includes(String(migration.status)))
  assert(id(migration.key) && id(migration.sourceId) && id(migration.backupDocumentId))
  assert(
    typeof migration.snapshotHash === 'string' && /^[a-f0-9]{64}$/.test(migration.snapshotHash)
      && count(migration.legacyBalance),
  )
  assert(migration.status !== 'complete' || id(migration.receiptId))
  assert(Array.isArray(value.receipts))
  for (const receipt of value.receipts) {
    assert(
      object(receipt) && object(receipt.command)
        && ['buy', 'adopt', 'device-upgrade'].includes(String(receipt.command.type)) && id(receipt.key)
        && id(receipt.orderId) && id(receipt.itemId),
    )
    assert(
      count(receipt.quantity) && receipt.quantity > 0 && receipt.quantity <= 99 && count(receipt.total)
        && count(receipt.at),
    )
  }
  assert(new Set(value.receipts.map(receipt => receipt.key)).size === value.receipts.length)
  assert(new Set(value.receipts.map(receipt => receipt.orderId)).size === value.receipts.length)
  if (value.pending !== undefined) {
    const pending = value.pending
    assert(migration.status === 'complete' && object(pending) && object(pending.command))
    assert(
      id(pending.key) && id(pending.itemId) && count(pending.quantity) && pending.quantity > 0
        && pending.quantity <= 99,
    )
    assert(
      count(pending.total) && count(pending.at)
        && ['buy', 'adopt', 'device-upgrade'].includes(String(pending.command.type)),
    )
    assert(!value.receipts.some(receipt => receipt.key === pending.key))
  }
}
