import type { EconomyClient } from '@cordisx/economy/client'
import type { WorkUsageSnapshotV2 } from '@cordisx/protocol/usage/v2'
import { PET_ECONOMY } from './pet-catalog.js'
import {
  type RewardIdentity,
  sameRewardIdentity,
  validateWorkRewards,
  type WorkCursor,
  type WorkRewardState,
  type WorkRewardStorage,
} from './pet-work-reward-state.js'
export type WorkSnapshot = Extract<WorkUsageSnapshotV2, { status: 'ready' }>
export type WorkRewardStatus = { status: 'unavailable' | 'ready' | 'pending'; reason: string; earned?: number }
export type WorkSponsor = { sdk: EconomyClient; identity: RewardIdentity; dispose(): void }
export const workCursor = (s: WorkSnapshot): WorkCursor => ({
  scopeId: s.scopeId,
  sourceId: s.sourceId,
  epoch: s.epoch,
  revision: s.revision,
  tokens: s.eligibleTokens,
  observedThrough: s.observedThrough,
})
const sameEpoch = (a: WorkCursor, b: WorkCursor) =>
  a.scopeId === b.scopeId && a.sourceId === b.sourceId && a.epoch === b.epoch
async function eventId(identity: RewardIdentity, from: WorkCursor, to: WorkCursor): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([identity.baseUrl, identity.instanceId, identity.accountId, identity.sourceId, from, to]),
  )
  return 'pet-work:'
    + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0'))
      .join('')
}
/** At most one persisted grant. No local wallet writes, speculative credit, or catch-up queue. */
export class PetWorkRewards {
  #sponsor: WorkSponsor | undefined
  #baseline = true
  #closed = false
  #generation = 0
  #running: Promise<void> = Promise.resolve()
  constructor(
    private readonly storage: WorkRewardStorage,
    private readonly publish: (status: WorkRewardStatus) => void,
  ) {}
  connect(sponsor: WorkSponsor): void {
    this.#sponsor?.dispose()
    this.#sponsor = sponsor
    this.#generation++
    this.#baseline = true
  }
  pause(reason = '工作奖励未配置赞助连接；期间用量不补发'): void {
    this.#baseline = true
    this.publish({ status: 'unavailable', reason })
  }
  observe(snapshot: WorkSnapshot, wallet: RewardIdentity | undefined, valid: () => boolean): Promise<void> {
    const run = this.#running.then(() => this.process(snapshot, wallet, valid))
    this.#running = run.catch(() => {})
    return run
  }
  private async process(
    snapshot: WorkSnapshot,
    wallet: RewardIdentity | undefined,
    valid: () => boolean,
  ): Promise<void> {
    const sponsor = this.#sponsor, generation = this.#generation
    const current = () => !this.#closed && generation === this.#generation && valid()
    if (!current()) return
    if (!sponsor || !wallet) {
      this.pause()
      return
    }
    if (!sameRewardIdentity(wallet, sponsor.identity)) {
      this.pause('工作赞助与共享钱包身份不匹配')
      return
    }
    const cursor = workCursor(snapshot)
    try {
      for (let retry = 0; retry < 12 && current(); retry++) {
        const record = await this.storage.load()
        if (!current()) return
        const prior = record.value === null ? undefined : validateWorkRewards(record.value)
        if (prior && !sameRewardIdentity(prior.identity, wallet)) {
          throw new Error('请恢复原工作赞助来源与账户；不覆盖历史奖励记录')
        }
        if (prior?.pending) {
          // A newer observation during an unresolved intent is a gap, never queued work.
          if (
            (!sameEpoch(prior.cursor, cursor) || cursor.tokens > prior.cursor.tokens || this.#baseline)
            && !prior.pending.gap
          ) {
            prior.pending.gap = true
            if (!await this.storage.save(record.revision, prior)) continue
            continue
          }
          await this.deliver(prior, current)
          return
        }
        const source = await sponsor.sdk.rewardSource(wallet.sourceId, wallet.accountId)
        if (!current()) return
        if (
          source.instanceId !== wallet.instanceId || source.accountId !== wallet.accountId
          || source.sourceId !== wallet.sourceId
        ) {
          throw new Error('工作赞助服务身份不匹配')
        }
        if (
          prior && sameEpoch(prior.cursor, cursor)
          && (cursor.tokens < prior.cursor.tokens || cursor.revision < prior.cursor.revision
            || cursor.observedThrough < prior.cursor.observedThrough)
        ) throw new Error('工作用量快照回退；保留原水位')
        const reset = this.#baseline || !prior || !sameEpoch(prior.cursor, cursor)
          || cursor.tokens < prior.cursor.tokens || cursor.revision < prior.cursor.revision
          || cursor.observedThrough < prior.cursor.observedThrough
        if (!reset && cursor.revision === prior!.cursor.revision) {
          if (cursor.tokens !== prior!.cursor.tokens) throw new Error('同一工作修订的用量不一致')
          this.publish({
            status: 'ready',
            reason: '正常工作奖励已启用 · 每 10,000 Token 获得 1 币',
            earned: prior!.earned,
          })
          return
        }
        const eligible = reset ? 0 : cursor.tokens - prior!.cursor.tokens + prior!.remainder
        if (!Number.isSafeInteger(eligible)) throw new Error('工作用量超出安全范围')
        const amount = Math.floor(eligible / PET_ECONOMY.tokensPerCoin)
        const limited = amount > source.available || amount > source.dailyLimit - source.dailyGranted
          || amount > source.accountDailyLimit - source.accountDailyGranted
        const next: WorkRewardState = {
          version: 2,
          identity: wallet,
          cursor,
          earned: prior?.earned ?? 0,
          remainder: limited ? 0 : eligible % PET_ECONOMY.tokensPerCoin,
          ...(prior?.lastEventId ? { lastEventId: prior.lastEventId } : {}),
        }
        if (amount && !limited) {
          next.pending = { eventId: await eventId(wallet, prior!.cursor, cursor), amount, gap: false }
        }
        if (!current()) return
        if (!await this.storage.save(record.revision, next)) continue
        this.#baseline = false
        if (next.pending) await this.deliver(next, current)
        else if (current()) {
          this.publish({
            status: limited ? 'unavailable' : 'ready',
            earned: next.earned,
            reason: limited
              ? '赞助余额或当日额度不足；这段用量不补发'
              : reset
              ? '正常工作奖励已启用，已建立新基线'
              : '正常工作奖励已启用 · 每 10,000 Token 获得 1 币',
          })
        }
        return
      }
      if (current()) throw new Error('工作奖励记录繁忙，请稍后同步')
    } catch (error) {
      this.#baseline = true
      if (current()) {
        this.publish({
          status: 'pending',
          reason: `${
            error instanceof Error ? error.message : '工作奖励暂不可用'
          }；已记录的事务保留原标识恢复，期间不累计新欠账`,
        })
      }
    }
  }
  private async deliver(state: WorkRewardState, current: () => boolean): Promise<void> {
    const pending = state.pending!, sponsor = this.#sponsor!
    if (!current()) return
    const receipt = await sponsor.sdk.grant({
      sourceId: state.identity.sourceId,
      accountId: state.identity.accountId,
      expectedInstanceId: state.identity.instanceId,
      eventId: pending.eventId,
      amount: pending.amount,
    }, pending.eventId)
    if (!current()) return
    if (
      receipt.instanceId !== state.identity.instanceId || receipt.accountId !== state.identity.accountId
      || receipt.sourceId !== state.identity.sourceId || receipt.eventId !== pending.eventId
      || receipt.amount !== pending.amount
    ) {
      throw new Error('工作奖励收据身份不匹配')
    }
    for (let retry = 0; retry < 12 && current(); retry++) {
      const record = await this.storage.load()
      if (!current()) return
      const next = validateWorkRewards(record.value)
      if (!sameRewardIdentity(next.identity, state.identity)) throw new Error('工作奖励账户变化')
      if (next.lastEventId === pending.eventId && !next.pending) {
        this.#baseline ||= pending.gap
        this.publish({ status: 'ready', reason: '工作奖励已同步', earned: next.earned })
        return
      }
      if (next.pending?.eventId !== pending.eventId) throw new Error('工作奖励事务已改变，请重新同步')
      this.#baseline ||= next.pending.gap
      next.earned += pending.amount
      if (!Number.isSafeInteger(next.earned)) throw new Error('累计工作奖励超出安全范围')
      next.lastEventId = pending.eventId
      delete next.pending
      if (!await this.storage.save(record.revision, next)) continue
      if (current()) this.publish({ status: 'ready', reason: '工作奖励已存入共享钱包', earned: next.earned })
      return
    }
    if (current()) throw new Error('工作奖励收据保存繁忙')
  }
  dispose(): void {
    this.#closed = true
    this.#generation++
    this.#sponsor?.dispose()
    this.#sponsor = undefined
  }
}
