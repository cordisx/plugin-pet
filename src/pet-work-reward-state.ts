import type { Context } from '@deepseek-ai/cordis'
import type { CordisXJsonValue } from 'cordisx/contracts'
export type WorkCursor = {
  scopeId: string
  sourceId: string
  epoch: string
  revision: number
  tokens: number
  observedThrough: number
}
export type RewardIdentity = { baseUrl: string; instanceId: string; accountId: string; sourceId: string }
export type WorkRewardState = {
  version: 2
  identity: RewardIdentity
  cursor: WorkCursor
  remainder: number
  earned: number
  pending?: { eventId: string; amount: number; gap: boolean }
  lastEventId?: string
}
export interface WorkRewardStorage {
  load(): Promise<{ revision: number; value: unknown }>
  save(revision: number, value: WorkRewardState): Promise<boolean>
}
export const sameRewardIdentity = (a: RewardIdentity, b: RewardIdentity): boolean =>
  a.baseUrl === b.baseUrl && a.instanceId === b.instanceId && a.accountId === b.accountId && a.sourceId === b.sourceId
export function validateWorkRewards(value: unknown): WorkRewardState {
  const v = value as WorkRewardState
  const id = (x: unknown) => typeof x === 'string' && x.length > 0 && x.length <= 2048
  const count = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 0
  if (
    !v || v.version !== 2 || !v.identity || !Object.values(v.identity).every(id)
    || !['baseUrl', 'instanceId', 'accountId', 'sourceId'].every(k => id(v.identity[k as keyof RewardIdentity]))
    || !v.cursor || !id(v.cursor.scopeId) || !id(v.cursor.sourceId) || !id(v.cursor.epoch)
    || !count(v.cursor.revision) || !count(v.cursor.tokens) || !count(v.cursor.observedThrough)
    || !count(v.remainder) || v.remainder >= 10000 || !count(v.earned)
    || (v.pending && (!/^pet-work:[a-f0-9]{64}$/.test(v.pending.eventId) || !count(v.pending.amount)
      || v.pending.amount < 1 || typeof v.pending.gap !== 'boolean'))
    || (v.lastEventId !== undefined && !/^pet-work:[a-f0-9]{64}$/.test(v.lastEventId))
  ) {
    throw new Error('工作奖励记录无效；原记录保留等待恢复')
  }
  return structuredClone(v)
}
export function workRewardStorage(documents: Context['documents']): WorkRewardStorage {
  const documentId = 'pet-work-rewards-v2'
  return {
    async load() {
      const result = await documents.load(documentId)
      if (result.status === 'unavailable') throw new Error(result.diagnostic)
      return result.status === 'missing'
        ? { revision: 0, value: null }
        : { revision: result.snapshot.revision, value: result.snapshot.value }
    },
    async save(revision, value) {
      validateWorkRewards(value)
      const result = await documents.transaction({
        contract: 'cordisx.owner-documents/v1',
        documentId,
        expectedRevision: revision,
        schemaVersion: 2,
        value: value as unknown as CordisXJsonValue,
      })
      if (result.status === 'unavailable') throw new Error(result.diagnostic)
      return result.status === 'accepted'
    },
  }
}
