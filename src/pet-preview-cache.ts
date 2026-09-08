import { useEffect } from 'cordisx/react'

export type PetPreviewImage = { src: string; onload: (() => void) | null; onerror: (() => void) | null }
export type PetPreviewCacheRuntime = { createImage(): PetPreviewImage; idle(callback: () => void): () => void }
type Request = { active: boolean; urls: Set<string>; priorities: Map<string, number>; cancelIdle?: () => void }
type Entry = { url: string; image?: PetPreviewImage; state: 'queued' | 'loading' | 'loaded'; priority: number; owners: Set<Request> }

/** Browser image requests only: no Avatar components, animation loops, or persisted user data. */
export function createPetPreviewCache(runtime: PetPreviewCacheRuntime, capacity = 128, concurrency = 4) {
  const entries = new Map<string, Entry>()
  const requests = new Set<Request>()
  let active = 0, disposed = false
  const detach = (entry: Entry) => {
    if (!entry.image) return
    entry.image.onload = null; entry.image.onerror = null
    if (entry.state === 'loading') { entry.image.src = ''; active-- }
    entry.image = undefined
  }
  const trim = () => {
    while (entries.size >= capacity) {
      const unused = [...entries.values()].find(entry => entry.owners.size === 0)
      if (!unused) return false
      detach(unused); entries.delete(unused.url)
    }
    return true
  }
  const pump = () => {
    if (disposed) return
    while (active < concurrency) {
      const entry = [...entries.values()].filter(item => item.state === 'queued' && item.owners.size > 0).sort((a,b) => a.priority - b.priority)[0]
      if (!entry) break
      entry.state = 'loading'; active++
      const image = runtime.createImage(); entry.image = image
      const settle = (loaded: boolean) => {
        if (disposed || entries.get(entry.url) !== entry || entry.state !== 'loading' || entry.image !== image) return
        active--; image.onload = null; image.onerror = null
        if (loaded) { entry.state = 'loaded'; entries.delete(entry.url); entries.set(entry.url, entry) }
        else { entry.image = undefined; entries.delete(entry.url) }
        pump()
      }
      image.onload = () => settle(true); image.onerror = () => settle(false)
      image.src = entry.url
    }
  }
  const add = (request: Request, urls: readonly string[], priority: number) => {
    for (const url of new Set(urls.filter(Boolean))) {
      let entry = entries.get(url)
      if (!entry) {
        if (!trim()) continue
        entry = { url, state: 'queued', priority, owners: new Set() }; entries.set(url, entry)
      } else {
        entry.priority = Math.min(entry.priority, priority)
        entries.delete(url); entries.set(url, entry)
      }
      entry.owners.add(request); request.urls.add(url); request.priorities.set(url, Math.min(request.priorities.get(url) ?? priority, priority))
    }
    if (priority === 0 && [...entries.values()].some(entry => entry.state === 'queued' && entry.priority === 0)) {
      for (const entry of entries.values()) if (entry.state === 'loading' && entry.priority > 0) { detach(entry); entry.state = 'queued' }
    }
    pump()
  }
  return {
    acquire(currentUrls: readonly string[], nextUrls: readonly string[] = []) {
      if (disposed) return () => {}
      const request: Request = { active: true, urls: new Set(), priorities: new Map() }
      requests.add(request)
      add(request, currentUrls, 0)
      request.cancelIdle = runtime.idle(() => { if (request.active && !disposed) add(request, nextUrls, 1) })
      return () => {
        if (!request.active) return
        request.active = false; request.cancelIdle?.()
        for (const url of request.urls) {
          const entry = entries.get(url)
          if (!entry) continue
          entry.owners.delete(request)
          if (entry.owners.size > 0) entry.priority = Math.min(...[...entry.owners].map(owner => owner.priorities.get(url) ?? 1))
          if (entry.owners.size === 0 && entry.state !== 'loaded') { detach(entry); entries.delete(url) }
        }
        request.urls.clear(); requests.delete(request); pump()
      }
    },
    dispose() {
      disposed = true
      for (const request of requests) { request.active = false; request.cancelIdle?.() }
      requests.clear()
      for (const entry of entries.values()) { for (const owner of entry.owners) { owner.active = false; owner.cancelIdle?.() } detach(entry) }
      entries.clear()
    },
    snapshot: () => ({ size: entries.size, active, queued: [...entries.values()].filter(item => item.state === 'queued').length }),
  }
}
let browserCache: ReturnType<typeof createPetPreviewCache> | undefined
export function usePetPreviewCache(currentUrls: readonly string[], nextUrls: readonly string[] = []) {
  const currentKey = JSON.stringify(currentUrls), nextKey = JSON.stringify(nextUrls)
  useEffect(() => {
    browserCache ??= createPetPreviewCache({
      createImage: () => new Image() as unknown as PetPreviewImage,
      idle(callback) {
        if (typeof window.requestIdleCallback === 'function') { const id = window.requestIdleCallback(callback); return () => window.cancelIdleCallback(id) }
        const id = window.setTimeout(callback, 100); return () => window.clearTimeout(id)
      },
    })
    return browserCache.acquire(JSON.parse(currentKey) as string[], JSON.parse(nextKey) as string[])
  }, [currentKey, nextKey])
}
