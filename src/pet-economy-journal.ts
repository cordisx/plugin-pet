import { migratePetState, type PetState } from './pet-domain.js'
import {
  type PetEconomyBinding,
  type PetPurchaseCommand,
  type PetSharedReceipt,
  samePetBinding,
} from './pet-economy-state.js'
import { grantPetPurchase, preparePetPurchase } from './pet-purchase.js'
import type { PetStorageAdapter } from './pet-store.js'

export type PetBackup = { snapshotHash: string; value: unknown }
export type PetBackupAdapter = {
  /** Create only; a pre-existing backup must never be overwritten. */
  create(id: string, backup: PetBackup): Promise<void>
  load(id: string): Promise<PetBackup>
}
export async function petSnapshotHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
}
export function assertPetDocumentSize(value: unknown, reserve = 0): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength + reserve > 512 * 1024) {
    throw new Error('宠物存档空间不足，尚未调用经济服务；请保留备份')
  }
}
/** This local journal never moves cloud money. Only the SDK coordinator can finish
 * it after validating the authenticated service receipt against the frozen intent. */
export class PetEconomyJournal {
  constructor(
    private readonly storage: PetStorageAdapter,
    private readonly backups: PetBackupAdapter,
    private readonly now = Date.now,
  ) {}
  async read(): Promise<PetState> {
    return migratePetState((await this.storage.load()).value)
  }
  async prepareMigration(binding: PetEconomyBinding, sourceId: string, baseUrl: string): Promise<PetState> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const snapshot = await this.storage.load()
      const state = migratePetState(snapshot.value)
      if (state.economy) {
        this.assertBinding(state, binding)
        if (state.economy.baseUrl !== baseUrl) throw new Error('经济服务地址与原存档不匹配')
        if (state.economy.migration.sourceId !== sourceId) throw new Error('迁移来源已绑定，不能重复导入')
        return state
      }
      const original = snapshot.value ?? state
      const snapshotHash = await petSnapshotHash(original)
      const backupDocumentId = `pet-backup-${snapshotHash}`
      const backup = { snapshotHash, value: original }
      assertPetDocumentSize(backup)
      await this.backups.create(backupDocumentId, backup)
      const stored = await this.backups.load(backupDocumentId)
      if (stored.snapshotHash !== snapshotHash || await petSnapshotHash(stored.value) !== snapshotHash) {
        throw new Error('迁移备份校验失败，原存档未切换')
      }
      state.version = 2
      state.economy = {
        storeId: crypto.randomUUID(),
        baseUrl,
        binding: structuredClone(binding),
        migration: {
          status: 'pending',
          key: `pet-import:${snapshotHash}`,
          sourceId,
          snapshotHash,
          backupDocumentId,
          legacyBalance: state.wallet.balance,
        },
        receipts: [],
      }
      if (await this.save(snapshot.revision, state)) return state
    }
    throw new Error('宠物存档正在更新，尚未开始云端迁移')
  }
  async completeMigration(binding: PetEconomyBinding, key: string, receiptId: string): Promise<PetState> {
    return this.change(state => {
      this.assertBinding(state, binding)
      const migration = state.economy!.migration
      if (migration.key !== key) throw new Error('迁移收据不匹配')
      if (migration.status === 'complete' && migration.receiptId !== receiptId) throw new Error('重复迁移收据不一致')
      migration.status = 'complete'
      migration.receiptId = receiptId
      return state
    })
  }
  async preparePurchase(binding: PetEconomyBinding, command: PetPurchaseCommand, key: string): Promise<PetState> {
    return this.change(state => {
      this.assertBinding(state, binding)
      const economy = state.economy!
      if (economy.migration.status !== 'complete') throw new Error('旧钱包尚待受控迁移批准')
      const prior = economy.receipts.find(item => item.key === key)
      if (prior) {
        if (JSON.stringify(prior.command) !== JSON.stringify(command)) throw new Error('购买标识已用于另一条命令')
        return state
      }
      if (economy.pending) {
        if (economy.pending.key !== key || JSON.stringify(economy.pending.command) !== JSON.stringify(command)) {
          throw new Error('上一笔购买待对账，请先恢复原订单')
        }
        return state
      }
      const intent = preparePetPurchase(state, command, key, this.now())
      const delivered = grantPetPurchase(state, intent).state
      delivered.economy!.receipts.push({
        key,
        command: structuredClone(command),
        orderId: 'x'.repeat(200),
        itemId: intent.itemId,
        quantity: intent.quantity,
        total: intent.total,
        at: intent.at,
      })
      // Reserve enough space for the largest valid receipt and actual delivered state.
      assertPetDocumentSize(delivered, 2048)
      economy.pending = intent
      return state
    })
  }
  async completePurchase(binding: PetEconomyBinding, receipt: PetSharedReceipt): Promise<PetState> {
    return this.change(state => {
      this.assertBinding(state, binding)
      const economy = state.economy!
      const prior = economy.receipts.find(item => item.key === receipt.key)
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(receipt)) throw new Error('订单重放收据不一致')
        return state
      }
      const pending = economy.pending
      if (
        !pending || pending.key !== receipt.key || pending.itemId !== receipt.itemId
        || pending.quantity !== receipt.quantity || pending.total !== receipt.total || pending.at !== receipt.at
        || JSON.stringify(pending.command) !== JSON.stringify(receipt.command)
      ) throw new Error('商品收据与待发货意图不一致')
      const delivered = grantPetPurchase(state, pending).state
      delete delivered.economy!.pending
      delivered.economy!.receipts.push(structuredClone(receipt))
      return delivered
    })
  }
  private assertBinding(state: PetState, binding: PetEconomyBinding): void {
    if (!state.economy || !samePetBinding(state.economy.binding, binding)) {
      throw new Error('经济实例或账户不匹配，禁止切换或回退本地钱包')
    }
  }
  private async save(revision: string | null, state: PetState): Promise<boolean> {
    migratePetState(state)
    assertPetDocumentSize(state)
    return this.storage.compareAndSwap(revision, state)
  }
  private async change(update: (state: PetState) => PetState): Promise<PetState> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const snapshot = await this.storage.load()
      const state = update(migratePetState(snapshot.value))
      if (await this.save(snapshot.revision, state)) return state
    }
    throw new Error('其他窗口正在对账，请稍后重试原订单')
  }
}
