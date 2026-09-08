import { EconomyClient, type Transport } from '@cordisx/economy/client'
import type { HttpClientV1, HttpConnectionV1, HttpRequestV1 } from '@cordisx/protocol/plugin-http/v1'
import type { PetEconomyConnection } from './pet-client.js'

export type PetEconomyConfig = { economyBaseUrl?: string; migrationSourceId?: string }
export function petHostTransport(http: HttpClientV1, connection: HttpConnectionV1, lifetime: AbortSignal): Transport {
  return async request => {
    const url = new URL(request.url)
    if (url.origin !== connection.origin || url.username || url.password || url.hash) {
      throw new Error('经济请求超出已授权地址')
    }
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) throw new Error('经济请求方法不受支持')
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers)) {
      const normalized = name.toLowerCase()
      if (!['accept', 'content-type', 'idempotency-key'].includes(normalized)) {
        throw new Error('经济请求包含不受支持的头部')
      }
      headers[normalized] = value
    }
    const result = await http.request({
      connection,
      path: url.pathname + url.search,
      method: request.method as HttpRequestV1['method'],
      headers,
      body: request.body,
      deadline: Date.now() + 30000,
      signal: request.signal ? AbortSignal.any([lifetime, request.signal]) : lifetime,
    })
    if (result.status !== 'accepted') {
      throw new Error(`共享经济连接不可用：${result.code}；原事务保留，可重新授权后恢复`)
    }
    return { status: result.value.statusCode, body: result.value.body }
  }
}
/** Called only from the wallet's connect action. Host captures the secret; Pet
 * receives an ephemeral generation-bound handle and never persists it. */
export function petEconomyConnector(
  http: HttpClientV1 | undefined,
  config: PetEconomyConfig,
): (() => Promise<PetEconomyConnection>) | undefined {
  if (!http || !config.economyBaseUrl?.trim()) return undefined
  return async () => {
    const baseUrl = config.economyBaseUrl!.trim()
    const url = new URL(baseUrl)
    // Validate the SDK URL and immutable migration-source shape before opening consent.
    new EconomyClient(baseUrl, async () => {
      throw new Error('not connected')
    })
    const sourceId = config.migrationSourceId?.trim() || 'pet-migration-v1'
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(sourceId)) throw new Error('迁移来源标识无效')
    const result = await http.authorize({ origin: url.origin, credential: 'bearer' })
    if (result.status !== 'accepted') throw new Error(`共享钱包授权未完成：${result.code}`)
    const connection = result.value
    if (
      connection.contract !== 'cordisx.http-connection/v1' || connection.origin !== url.origin
      || connection.credential !== 'bearer'
    ) throw new Error('共享钱包授权范围不匹配')
    const lifetime = new AbortController()
    const sdk = new EconomyClient(baseUrl, petHostTransport(http, connection, lifetime.signal))
    try {
      const wallet = await sdk.me()
      return {
        sdk,
        binding: { instanceId: wallet.instanceId, accountId: wallet.accountId },
        sourceId,
        dispose: () => {
          lifetime.abort()
          void http.revoke(connection)
        },
      }
    } catch (error) {
      lifetime.abort()
      await http.revoke(connection)
      throw error
    }
  }
}
