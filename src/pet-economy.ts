import { EconomyClient, type Wallet } from '@cordisx/economy/client'
import { PetEconomyJournal } from './pet-economy-journal.js'
import { type PetEconomyBinding, type PetPurchaseCommand, samePetBinding } from './pet-economy-state.js'

export type PetEconomyStatus = {
  status: 'unavailable' | 'migration-required' | 'migration-pending' | 'reconciling' | 'ready'
  reason?: string
  binding?: PetEconomyBinding
  wallet?: Wallet
}
/** All server effects use the owner's SDK and its permanent idempotency contract.
 * No local reward/credit API is exposed to Pet. */
export class PetEconomy {
  #closed = false
  #tail: Promise<unknown> = Promise.resolve()
  constructor(
    private readonly sdk: EconomyClient,
    private readonly journal: PetEconomyJournal,
    readonly binding: PetEconomyBinding,
    readonly sourceId: string,
    private readonly publish: (status: PetEconomyStatus) => void,
  ) {}
  refresh(): Promise<void> {
    return this.run(() => this.reconcile())
  }
  migrate(): Promise<void> {
    return this.run(async () => {
      await this.wallet()
      this.active()
      await this.journal.prepareMigration(this.binding, this.sourceId, this.sdk.baseUrl)
      await this.reconcile()
    })
  }
  purchase(command: PetPurchaseCommand, key: string): Promise<void> {
    return this.run(async () => {
      await this.wallet()
      this.active()
      const state = await this.journal.read()
      if (state.economy && state.economy.baseUrl !== this.sdk.baseUrl) throw new Error('经济服务地址与原存档不匹配')
      const pending = state.economy?.pending
      if (pending && JSON.stringify(pending.command) !== JSON.stringify(command)) {
        throw new Error('上一笔购买待对账，请先恢复原订单')
      }
      await this.journal.preparePurchase(this.binding, command, pending?.key ?? key)
      await this.reconcile()
    })
  }
  private async reconcile(): Promise<void> {
    const wallet = await this.wallet()
    this.active()
    let state = await this.journal.read()
    if (!state.economy) {
      this.publish({ status: 'migration-required', binding: this.binding, wallet })
      return
    }
    if (
      state.economy.baseUrl !== this.sdk.baseUrl || !samePetBinding(state.economy.binding, this.binding)
      || state.economy.migration.sourceId !== this.sourceId
    ) {
      throw new Error('经济实例、账户或迁移来源不匹配')
    }
    const migration = state.economy.migration
    if (migration.status === 'pending' && migration.legacyBalance === 0) {
      this.active()
      state = await this.journal.completeMigration(
        this.binding,
        migration.key,
        `zero-balance:${migration.snapshotHash}`,
      )
    } else if (migration.status === 'pending') {
      this.publish({ status: 'migration-pending', binding: this.binding, reason: '等待服务端批准原始备份的导入资格' })
      this.active()
      const result = await this.sdk.claim(
        { sourceId: migration.sourceId, entitlementId: migration.snapshotHash },
        migration.key,
      )
      this.active()
      if (
        !samePetBinding(result, this.binding) || result.sourceId !== migration.sourceId
        || result.entitlementId !== migration.snapshotHash || result.amount !== migration.legacyBalance
      ) throw new Error('迁移批准与原始备份不匹配，保留待对账状态')
      await this.wallet()
      this.active()
      state = await this.journal.completeMigration(this.binding, migration.key, `migration:${migration.snapshotHash}`)
    }
    if (state.economy?.pending) {
      const intent = state.economy.pending
      this.publish({ status: 'reconciling', binding: this.binding, reason: '正在恢复原订单；请勿重新购买' })
      this.active()
      // The owner catalogue is immutable. Compare before debit as well as on receipt.
      const items = await this.sdk.items()
      this.active()
      const item = items.find(item => item.id === intent.itemId)
      if (!item || item.namespace !== 'pet' || item.price * intent.quantity !== intent.total) {
        throw new Error('服务端 Pet 商品目录与当前版本不兼容，原订单保留待对账')
      }
      // Even a pre-commit rejection must retain the journal: another window can
      // still have the same key in flight. The service does not tombstone failures.
      const order = await this.sdk.purchase({
        itemId: intent.itemId,
        quantity: intent.quantity,
        expectedTotal: intent.total,
        fulfillmentTarget: { namespace: 'pet', storeId: state.economy.storeId },
      }, intent.key)
      this.active()
      // Retrieve the authenticated account's durable entitlement, not a caller receipt.
      const confirmed = await this.sdk.order(order.id)
      this.active()
      if (
        !samePetBinding(order, this.binding) || !samePetBinding(confirmed, this.binding)
        || confirmed.fulfillmentTarget?.namespace !== 'pet'
        || confirmed.fulfillmentTarget?.storeId !== state.economy.storeId
        || order.fulfillmentTarget?.storeId !== state.economy.storeId || confirmed.id !== order.id
        || confirmed.itemId !== intent.itemId || confirmed.quantity !== intent.quantity
        || confirmed.total !== intent.total
      ) throw new Error('服务端物品收据与原订单不匹配')
      await this.wallet()
      this.active()
      await this.journal.completePurchase(this.binding, {
        key: intent.key,
        command: intent.command,
        orderId: confirmed.id,
        itemId: confirmed.itemId,
        quantity: confirmed.quantity,
        total: confirmed.total,
        at: intent.at,
      })
    }
    const latest = await this.wallet()
    this.active()
    this.publish({ status: 'ready', binding: this.binding, wallet: latest })
  }
  private async wallet(): Promise<Wallet> {
    this.active()
    const wallet = await this.sdk.me()
    this.active()
    if (
      !samePetBinding(wallet, this.binding) || !Number.isSafeInteger(wallet.available) || wallet.available < 0
      || !Number.isSafeInteger(wallet.reserved) || wallet.reserved < 0
    ) throw new Error('共享钱包身份或余额无效')
    return wallet
  }
  private active(): void {
    if (this.#closed) throw new Error('经济连接已关闭，持久化事务将由下次连接恢复')
  }
  private run(work: () => Promise<void>): Promise<void> {
    const next = this.#tail.then(async () => {
      this.active()
      try {
        await work()
      } catch (error) {
        if (!this.#closed) {
          this.publish({
            status: 'unavailable',
            binding: this.binding,
            reason: error instanceof Error ? error.message : '经济服务暂不可用；原事务保留',
          })
        }
        throw error
      }
    })
    this.#tail = next.catch(() => {})
    return next
  }
  dispose(): void {
    this.#closed = true
  }
}
