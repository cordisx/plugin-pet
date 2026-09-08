import type { UsageReadySnapshotV1, UsageSnapshotV1, UsageV1 } from 'cordisx/contracts'
export type PetUsageStatus =
  | { status: 'initializing' }
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; coverage: 'partial'; observedThrough: number; eligibleTokens: number }
function counter(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
function ready(value: UsageSnapshotV1): value is UsageReadySnapshotV1 {
  return value.schemaVersion === 1 && value.status === 'ready' && value.policyId === 'codex-local-input-output-v1'
    && typeof value.scopeId === 'string' && value.scopeId.length > 0 && value.scopeId.length <= 200
    && typeof value.sourceId === 'string' && value.sourceId.length > 0 && value.sourceId.length <= 200
    && typeof value.epoch === 'string' && value.epoch.length > 0 && value.epoch.length <= 200
    && counter(value.revision) && counter(value.eligibleTokens) && counter(value.inputTokens)
    && counter(value.outputTokens)
    && value.inputTokens + value.outputTokens === value.eligibleTokens && counter(value.observedThrough)
    && counter(value.enabledAt) && value.coverage === 'partial'
}
/** Public invalidations are hints. Serialize reads and fence every async stage so a
 * superseding permission change cannot publish stale attribution status. */
export class PetUsageController {
  #closed = false
  #started = false
  #generation = 0
  #dirty = false
  #running: Promise<void> | undefined
  #unsubscribe: (() => void) | undefined
  constructor(
    private readonly usage: UsageV1,
    private readonly publish: (status: PetUsageStatus) => void,
  ) {}
  async start(): Promise<void> {
    if (this.#closed || this.#started) return
    this.#started = true
    this.publish({ status: 'initializing' })
    try {
      this.#unsubscribe = this.usage.subscribe(() => {
        void this.refresh()
      })
      await this.refresh()
    } catch {
      this.publish({ status: 'unavailable', reason: 'host-unavailable' })
    }
  }
  refresh(): Promise<void> {
    if (this.#closed) return Promise.resolve()
    this.#generation++
    this.#dirty = true
    if (!this.#running) {
      this.#running = this.drain().finally(() => {
        this.#running = undefined
        if (this.#dirty && !this.#closed) void this.refresh()
      })
    }
    return this.#running
  }
  private async drain(): Promise<void> {
    while (this.#dirty && !this.#closed) {
      this.#dirty = false
      const generation = this.#generation
      const current = () => !this.#closed && generation === this.#generation
      try {
        const snapshot = await this.usage.read()
        if (!current()) continue
        if (snapshot.status === 'unavailable') {
          this.publish({ status: 'unavailable', reason: snapshot.reason })
          continue
        }
        if (!ready(snapshot)) {
          this.publish({ status: 'unavailable', reason: 'invalid-snapshot' })
          continue
        }
        // This profile aggregate cannot distinguish game inference from eligible work.
        // Do not persist a frontier or a deferred reward: neither is trusted evidence.
        this.publish({ status: 'unavailable', reason: 'usage-attribution-unavailable' })
      } catch {
        if (current()) this.publish({ status: 'unavailable', reason: 'host-unavailable' })
      }
    }
  }
  dispose(): void {
    this.#closed = true
    this.#generation++
    this.#dirty = false
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
  }
}
