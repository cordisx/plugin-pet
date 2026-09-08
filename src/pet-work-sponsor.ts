import { EconomyClient } from '@cordisx/economy/client'
import type { HttpClientV1 } from '@cordisx/protocol/plugin-http/v1'
import { petHostTransport } from './pet-economy-host.js'
import type { RewardIdentity } from './pet-work-reward-state.js'
import type { WorkSponsor } from './pet-work-rewards.js'
/** Separate masked service consent. Neither service credentials nor handles enter Pet documents. */
export function petWorkSponsorConnector(
  http: HttpClientV1 | undefined,
  sourceId: string | undefined,
): ((identity: Omit<RewardIdentity, 'sourceId'>) => Promise<WorkSponsor>) | undefined {
  if (!http || !sourceId?.trim()) return undefined
  const source = sourceId.trim()
  return async wallet => {
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(source)) throw new Error('工作赞助来源标识无效')
    const origin = new URL(wallet.baseUrl).origin
    const result = await http.authorize({ origin, credential: 'bearer' })
    if (result.status !== 'accepted') throw new Error(`工作赞助授权未完成：${result.code}`)
    const connection = result.value
    const lifetime = new AbortController()
    const dispose = () => {
      lifetime.abort()
      void http.revoke(connection)
    }
    try {
      if (
        connection.contract !== 'cordisx.http-connection/v1' || connection.origin !== origin
        || connection.credential !== 'bearer'
      ) {
        throw new Error('工作赞助授权范围不匹配')
      }
      const sdk = new EconomyClient(wallet.baseUrl, petHostTransport(http, connection, lifetime.signal))
      const state = await sdk.rewardSource(source, wallet.accountId)
      if (state.instanceId !== wallet.instanceId || state.accountId !== wallet.accountId || state.sourceId !== source) {
        throw new Error('工作赞助来源与钱包不属于同一实例或账户')
      }
      return { sdk, identity: { ...wallet, sourceId: source }, dispose }
    } catch (error) {
      dispose()
      throw error
    }
  }
}
