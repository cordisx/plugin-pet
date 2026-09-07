import { applyPetCommand, migratePetState, settlePetUsage } from './pet-domain.js'
import type { PetCommand, PetState, PetTransition, TrustedPetUsage } from './pet-domain.js'
export type PetSnapshot = { revision: string | null; value: unknown }
/** Bind to the public owner document API; CAS must atomically replace the whole document. */
export type PetStorageAdapter = {
  load(): Promise<PetSnapshot>
  compareAndSwap(expectedRevision: string | null, state: PetState): Promise<boolean>
}
export class PetStore {
  readonly #adapter: PetStorageAdapter
  readonly #trustedUsageEnabled: boolean
  readonly #now: () => number
  constructor(adapter: PetStorageAdapter, options: { trustedUsageEnabled?: boolean; now?: () => number } = {}) {
    this.#adapter = adapter
    this.#trustedUsageEnabled = options.trustedUsageEnabled ?? false
    this.#now = options.now ?? Date.now
  }
  async read(): Promise<PetState> { return migratePetState((await this.#adapter.load()).value) }
  async execute(command: PetCommand, idempotencyKey: string): Promise<PetTransition> {
    const input = structuredClone(command)
    return this.#commit((state, now) => applyPetCommand(state, input, { key: idempotencyKey, now }))
  }
  async settleUsage(usage: TrustedPetUsage, idempotencyKey: string, isCurrent: () => boolean = () => true): Promise<PetTransition> {
    if (!this.#trustedUsageEnabled) throw new Error('可信 Token 用量接口尚未接入，奖励结算暂不可用')
    const input = structuredClone(usage)
    return this.#commit((state, now) => settlePetUsage(state, input, { key: idempotencyKey, now }), isCurrent)
  }
  async #commit(transition: (state: PetState, now: number) => PetTransition, isCurrent: () => boolean = () => true): Promise<PetTransition> {
    const now = this.#now()
    for (let attempt = 0; attempt < 12; attempt++) {
      if (!isCurrent()) throw new Error('本次用量读取已失效')
      const snapshot = await this.#adapter.load()
      if (!isCurrent()) throw new Error('本次用量读取已失效')
      const result = transition(migratePetState(snapshot.value), now)
      if (result.duplicate) return result
      migratePetState(result.state)
      if (new TextEncoder().encode(JSON.stringify(result.state)).byteLength > 512 * 1024) throw new Error('宠物存档空间不足，本次操作未保存')
      if (!isCurrent()) throw new Error('本次用量读取已失效')
      if (await this.#adapter.compareAndSwap(snapshot.revision, result.state)) return result
    }
    throw new Error('其他窗口正在更新宠物数据，请稍后重试')
  }
}
