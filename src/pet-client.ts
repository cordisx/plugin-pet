import type { Context } from '@deepseek-ai/cordis'
import type { CordisXJsonValue, UsageV1 } from 'cordisx/contracts'
import { migratePetState, type PetCommand, type PetState } from './pet-domain.js'
import { PetStore } from './pet-store.js'
import { PetUsageController, type PetUsageStatus } from './pet-usage.js'

export type PetClientSnapshot = {
  state: PetState | null
  error: string | null
  busy: boolean
  usage?: PetUsageStatus
  feedback?: { id: string; sequence: number; kind: 'feed' | 'pet' | 'sleep' }
}
export type PetClientRuntime = {
  now: () => number
  monotonicNow: () => number
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
  randomId: () => string
}
const defaultRuntime: PetClientRuntime = {
  now: Date.now, monotonicNow: () => performance.now(),
  setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis),
  randomId: () => crypto.randomUUID(),
}
const DOCUMENT = 'pet-system'
const CONTRACT = 'cordisx.owner-documents/v1' as const
/** One plugin-generation client; Host owns persistence, scope and cross-window notifications. */
export class PetClient {
  readonly #listeners = new Set<() => void>()
  readonly #store: PetStore
  readonly #usage: PetUsageController | undefined
  #snapshot: PetClientSnapshot = { state: null, error: null, busy: false }
  #revision = -1
  #pending = 0
  #closed = false
  #feedback = 0
  #started = false
  #careTimer: ReturnType<typeof setTimeout> | undefined
  #lastPulse = 0
  #lastWallPulse = 0
  #careReady = false
  #resting: string[] = []
  readonly #unsubscribe: () => void
  constructor(private readonly documents: Context['documents'], private readonly runtime: PetClientRuntime = defaultRuntime, usage?: UsageV1) {
    this.#store = new PetStore({
      load: async () => {
        if (this.#closed) throw new Error('宠物服务已关闭')
        const result = await documents.load(DOCUMENT)
        if (result.status === 'unavailable') throw new Error(result.diagnostic)
        if (result.status === 'loaded') this.accept(result.snapshot.revision, result.snapshot.value)
        return result.status === 'missing'
          ? { revision: null, value: null }
          : { revision: String(result.snapshot.revision), value: result.snapshot.value }
      },
      compareAndSwap: async (expectedRevision, state) => {
        if (this.#closed) throw new Error('宠物服务已关闭')
        const result = await documents.transaction({
          contract: CONTRACT, documentId: DOCUMENT,
          expectedRevision: expectedRevision === null ? 0 : Number(expectedRevision), schemaVersion: 1,
          value: state as unknown as CordisXJsonValue,
        })
        if (result.status === 'unavailable') throw new Error(result.diagnostic)
        if (result.status === 'accepted') this.accept(result.snapshot.revision, result.snapshot.value)
        return result.status === 'accepted'
      },
    }, { now: runtime.now, trustedUsageEnabled: usage !== undefined })
    this.#usage = usage ? new PetUsageController(usage, async (input, key, isCurrent) => { await this.#store.settleUsage(input, key, isCurrent) }, status => this.update({ usage: status })) : undefined
    this.#snapshot.usage = usage ? { status: 'initializing' } : { status: 'unavailable', reason: 'host-unavailable' }
    this.#unsubscribe = documents.subscribe(DOCUMENT, result => {
      if (result.status === 'loaded') this.accept(result.snapshot.revision, result.snapshot.value)
      else if (result.status === 'unavailable') this.update({ error: result.diagnostic })
    })
  }
  getSnapshot = (): PetClientSnapshot => this.#snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  private update(value: Partial<PetClientSnapshot>): void {
    if (this.#closed) return
    this.#snapshot = { ...this.#snapshot, ...value }
    for (const listener of this.#listeners) listener()
  }
  private accept(revision: number, value: unknown): void {
    if (revision < this.#revision || this.#closed) return
    if (revision === this.#revision) {
      if (this.#snapshot.error) this.update({ error: null })
      return
    }
    try {
      const state = migratePetState(value)
      this.#revision = revision
      this.update({ state, error: null })
    } catch (error) { this.update({ error: error instanceof Error ? error.message : '宠物存档读取失败' }) }
  }
  async start(): Promise<void> {
    if (this.#started || this.#closed) return
    this.#started = true
    try { await this.initializeCare() }
    catch (error) { this.update({ error: error instanceof Error ? error.message : '宠物数据暂不可用' }) }
    finally {
      this.scheduleCare()
      if (!this.#closed) await this.#usage?.start()
    }
  }
  private async initializeCare(): Promise<void> {
    if (this.#closed) return
    const result = await this.documents.load(DOCUMENT)
    if (this.#closed) return
    if (result.status === 'unavailable') throw new Error(result.diagnostic)
    if (result.status === 'loaded') this.accept(result.snapshot.revision, result.snapshot.value)
    else {
      await this.#store.execute({ type: 'settings', value: {} }, 'welcome:v1')
      // CAS losers hydrate immediately instead of waiting for a subscription poll.
      const initialized = await this.documents.load(DOCUMENT)
      if (initialized.status === 'loaded') this.accept(initialized.snapshot.revision, initialized.snapshot.value)
      else throw new Error(initialized.status === 'unavailable' ? initialized.diagnostic : '宠物数据暂不可用')
    }
    if (!this.#closed && this.#snapshot.state) {
      await this.#store.execute({ type: 'carePulse', elapsedMs: 0 }, this.runtime.randomId())
      this.#lastPulse = this.runtime.monotonicNow()
      this.#lastWallPulse = this.runtime.now()
      this.#careReady = true
    }
  }
  requestSleep = (id: string): void => {
    if (this.#closed) return
    const pet = this.getSnapshot().state?.pets.find(pet => pet.id === id)
    if (pet?.status === 'alive') this.update({ feedback: { id, kind: 'sleep', sequence: ++this.#feedback } })
  }
  setRestingPets = (ids: string[]): void => { this.#resting = [...ids] }
  reportError = (message: string): void => { this.update({ error: message }) }
  refreshUsage = (): Promise<void> => this.#usage?.refresh() ?? Promise.resolve()
  private scheduleCare(): void {
    if (this.#closed) return
    this.#careTimer = this.runtime.setTimeout(async () => {
      this.#careTimer = undefined
      if (this.#closed) return
      try {
        if (!this.#careReady) await this.initializeCare()
        else {
          const now = this.runtime.monotonicNow()
          const wallNow = this.runtime.now()
          const elapsed = now - this.#lastPulse
          const wallElapsed = wallNow - this.#lastWallPulse
          this.#lastPulse = now
          this.#lastWallPulse = wallNow
          // Some platforms pause performance.now during sleep. Either clock detecting
          // a suspension (or rollback) pauses care; neither may create offline debt.
          const paused = elapsed < 0 || wallElapsed < 0 || elapsed > 65_000 || wallElapsed > 65_000
          await this.#store.execute({ type: 'carePulse', elapsedMs: paused ? 0 : Math.min(elapsed, wallElapsed), restingPetIds: this.#resting }, this.runtime.randomId())
        }
      } catch (error) {
        this.#careReady = false
        this.update({ error: error instanceof Error ? error.message : '宠物状态保存失败' })
      }
      this.scheduleCare()
    }, 60_000)
  }
  async execute(command: PetCommand): Promise<void> {
    if (this.#closed) return
    this.#pending++
    this.update({ busy: true, error: null })
    try {
      await this.#store.execute(command, this.runtime.randomId())
      if (command.type === 'feed') this.update({ feedback: { id: command.petId, kind: 'feed', sequence: ++this.#feedback } })
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : '操作失败，请重试' })
    } finally { this.update({ busy: --this.#pending > 0 }) }
  }
  dispose(): void {
    this.#closed = true
    if (this.#careTimer !== undefined) this.runtime.clearTimeout(this.#careTimer)
    this.#careTimer = undefined
    this.#usage?.dispose()
    this.#unsubscribe()
    this.#listeners.clear()
  }
}
