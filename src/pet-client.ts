import type { EconomyClient } from '@cordisx/economy/client'
import type { Context } from '@deepseek-ai/cordis'
import type { CordisXJsonValue, UsageV1 } from 'cordisx/contracts'
import { migratePetState, type PetCommand, type PetState } from './pet-domain.js'
import { type PetBackup, PetEconomyJournal } from './pet-economy-journal.js'
import { isPetPurchase, type PetEconomyBinding, petEconomyLocked } from './pet-economy-state.js'
import { PetEconomy, type PetEconomyStatus } from './pet-economy.js'
import { type PetStorageAdapter, PetStore } from './pet-store.js'
import { PetUsageController, type PetUsageStatus } from './pet-usage.js'

export type PetClientSnapshot = {
  state: PetState | null
  error: string | null
  busy: boolean
  usage?: PetUsageStatus
  economy?: PetEconomyStatus
  canConnectEconomy?: boolean
  restingPetIds?: string[]
  feedback?: { id: string; sequence: number; kind: 'feed' | 'pet' | 'sleep' | 'wake' }
}
export type PetClientRuntime = {
  now: () => number
  monotonicNow: () => number
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
  randomId: () => string
}
const defaultRuntime: PetClientRuntime = {
  now: Date.now,
  monotonicNow: () => performance.now(),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  randomId: () => crypto.randomUUID(),
}
export type PetEconomyConnection = {
  sdk: EconomyClient
  binding: PetEconomyBinding
  sourceId: string
  dispose?: () => void
}
const DOCUMENT = 'pet-system'
const CONTRACT = 'cordisx.owner-documents/v1' as const
/** One plugin-generation client; Host owns persistence, scope and cross-window notifications. */
export class PetClient {
  readonly #listeners = new Set<() => void>()
  readonly #store: PetStore
  #economy: PetEconomy | undefined
  readonly #journal: PetEconomyJournal
  #disposeConnection: (() => void) | undefined
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
  constructor(
    private readonly documents: Context['documents'],
    private readonly runtime: PetClientRuntime = defaultRuntime,
    usage?: UsageV1,
    economy?: PetEconomyConnection,
    private readonly connector?: () => Promise<PetEconomyConnection>,
  ) {
    const storage: PetStorageAdapter = {
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
          contract: CONTRACT,
          documentId: DOCUMENT,
          expectedRevision: expectedRevision === null ? 0 : Number(expectedRevision),
          schemaVersion: state.version,
          value: state as unknown as CordisXJsonValue,
        })
        if (result.status === 'unavailable') throw new Error(result.diagnostic)
        if (result.status === 'accepted') this.accept(result.snapshot.revision, result.snapshot.value)
        return result.status === 'accepted'
      },
    }
    this.#store = new PetStore(storage, { now: runtime.now })
    this.#journal = new PetEconomyJournal(storage, {
      create: async (id, backup) => {
        if (this.#closed) throw new Error('宠物服务已关闭')
        const existing = await documents.load(id)
        if (existing.status === 'unavailable') throw new Error(existing.diagnostic)
        if (existing.status === 'loaded') return
        if (this.#closed) throw new Error('宠物服务已关闭')
        const result = await documents.transaction({
          contract: CONTRACT,
          documentId: id,
          expectedRevision: 0,
          schemaVersion: 1,
          value: backup as unknown as CordisXJsonValue,
        })
        if (result.status === 'unavailable') throw new Error(result.diagnostic)
      },
      load: async id => {
        if (this.#closed) throw new Error('宠物服务已关闭')
        const result = await documents.load(id)
        if (result.status !== 'loaded') throw new Error('原始备份不可用，迁移暂停')
        return result.snapshot.value as unknown as PetBackup
      },
    }, runtime.now)
    if (economy) this.bindEconomy(economy)
    this.#snapshot.canConnectEconomy = connector !== undefined
    this.#snapshot.economy = {
      status: 'unavailable',
      reason: economy
        ? '正在连接共享钱包'
        : connector
        ? '请连接共享钱包；重载后需要重新授权同一账户'
        : '请在插件设置配置共享经济地址，并使用支持安全连接的 Host',
    }
    this.#usage = usage
      ? new PetUsageController(usage, status => this.update({ usage: status }))
      : undefined
    this.#snapshot.usage = usage ? { status: 'initializing' } : { status: 'unavailable', reason: 'host-unavailable' }
    this.#unsubscribe = documents.subscribe(DOCUMENT, result => {
      if (result.status === 'loaded') this.accept(result.snapshot.revision, result.snapshot.value)
      else if (result.status === 'unavailable') this.update({ error: result.diagnostic })
    })
  }
  getSnapshot = (): PetClientSnapshot => this.#snapshot
  subscribe = (listener: () => void): () => void => {
    if (this.#closed) return () => {}
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
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
      this.#resting = this.#resting.filter(id =>
        state.activePetIds.includes(id) && state.pets.some(pet => pet.id === id && pet.status === 'alive')
      )
      this.update({ state, error: null, restingPetIds: [...this.#resting] })
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : '宠物存档读取失败' })
    }
  }
  async start(): Promise<void> {
    if (this.#started || this.#closed) return
    this.#started = true
    try {
      await this.initializeCare()
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : '宠物数据暂不可用' })
    } finally {
      this.scheduleCare()
      if (!this.#closed) await this.refreshEconomy()
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
    if (!this.#closed && this.#snapshot.state && !petEconomyLocked(this.#snapshot.state)) {
      await this.#store.execute({ type: 'carePulse', elapsedMs: 0 }, this.runtime.randomId())
      this.#lastPulse = this.runtime.monotonicNow()
      this.#lastWallPulse = this.runtime.now()
      this.#careReady = true
    }
  }
  private canRest(id: string): boolean {
    const state = this.#snapshot.state
    return !this.#closed && !!state?.activePetIds.includes(id)
      && state.pets.some(pet => pet.id === id && pet.status === 'alive')
  }
  requestSleep = (id: string): void => {
    if (this.canRest(id)) this.update({ feedback: { id, kind: 'sleep', sequence: ++this.#feedback } })
  }
  requestWake = (id: string): void => {
    if (this.canRest(id)) this.update({ feedback: { id, kind: 'wake', sequence: ++this.#feedback } })
  }
  /** Scene reports actual resting state after processing input; requests alone do not grant recovery. */
  setRestingPets = (ids: string[]): void => {
    if (this.#closed) return
    const next = [...new Set(ids.filter(id => this.canRest(id)))].sort()
    if (next.length === this.#resting.length && next.every((id, index) => id === this.#resting[index])) return
    this.#resting = next
    this.update({ restingPetIds: [...next] })
  }
  reportError = (message: string): void => {
    this.update({ error: message })
  }
  refreshUsage = (): Promise<void> => this.#closed ? Promise.resolve() : this.#usage?.refresh() ?? Promise.resolve()
  private scheduleCare(): void {
    if (this.#closed) return
    this.#careTimer = this.runtime.setTimeout(async () => {
      this.#careTimer = undefined
      if (this.#closed) return
      try {
        await this.refreshEconomy()
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
          await this.#store.execute({
            type: 'carePulse',
            elapsedMs: paused ? 0 : Math.min(elapsed, wallElapsed),
            restingPetIds: this.#resting,
          }, this.runtime.randomId())
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
      if (isPetPurchase(command) && this.#economy) await this.#economy.purchase(command, this.runtime.randomId())
      else await this.#store.execute(command, this.runtime.randomId())
      if (command.type === 'feed' || command.type === 'water' || command.type === 'interact') {
        this.update({
          feedback: {
            id: command.petId,
            kind: command.type === 'interact' ? 'pet' : 'feed',
            sequence: ++this.#feedback,
          },
        })
      }
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : '操作失败，请重试' })
    } finally {
      this.update({ busy: --this.#pending > 0 })
    }
  }
  private bindEconomy(connection: PetEconomyConnection): void {
    this.#economy?.dispose()
    this.#disposeConnection?.()
    this.#disposeConnection = connection.dispose
    this.#economy = new PetEconomy(
      connection.sdk,
      this.#journal,
      connection.binding,
      connection.sourceId,
      status => this.update({ economy: status }),
    )
  }
  connectEconomy = async (): Promise<void> => {
    if (this.#closed || !this.connector || this.#pending) return
    this.#pending++
    this.update({ busy: true, error: null })
    try {
      const connection = await this.connector()
      if (this.#closed) {
        connection.dispose?.()
        return
      }
      this.bindEconomy(connection)
      await this.#economy!.refresh()
    } catch (error) {
      this.reportError(error instanceof Error ? error.message : '共享钱包连接失败')
    } finally {
      this.update({ busy: --this.#pending > 0 })
    }
  }
  refreshEconomy = async (): Promise<void> => {
    if (this.#closed || !this.#economy) return
    try {
      await this.#economy.refresh()
    } catch (error) {
      this.reportError(error instanceof Error ? error.message : '共享经济暂不可用')
    }
  }
  migrateEconomy = async (): Promise<void> => {
    if (this.#closed || !this.#economy) return
    this.#pending++
    this.update({ busy: true, error: null })
    try {
      await this.#economy.migrate()
    } catch (error) {
      this.reportError(error instanceof Error ? error.message : '迁移待恢复')
    } finally {
      this.update({ busy: --this.#pending > 0 })
    }
  }
  dispose(): void {
    this.#closed = true
    if (this.#careTimer !== undefined) this.runtime.clearTimeout(this.#careTimer)
    this.#careTimer = undefined
    this.#usage?.dispose()
    this.#economy?.dispose()
    this.#disposeConnection?.()
    this.#unsubscribe()
    this.#listeners.clear()
  }
}
