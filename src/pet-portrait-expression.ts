import { useEffect, type RefObject } from 'cordisx/react'
import { parseAvatarAnimationClip } from '@oneworks/avatar'
import type { AvatarHandle } from '@oneworks/avatar-react/renderer'

const neutral = { leftEyeHeight: 70, rightEyeHeight: 70, leftEyeWidth: 24, rightEyeWidth: 24 }
const clip = (label: string, face: typeof neutral, durationMs: number) => parseAvatarAnimationClip({
  label, anchor: 'absolute', playback: 'once', durationMs,
  keyframes: [{ atMs: 0, patch: { face: neutral } }, { atMs: Math.round(durationMs * .35), patch: { face } },
    { atMs: Math.round(durationMs * .65), patch: { face } }, { atMs: durationMs, patch: { face: neutral } }],
})
const blink = clip('Portrait blink', { ...neutral, leftEyeHeight: 4, rightEyeHeight: 4 }, 600)
const curious = clip('Portrait curiosity', { ...neutral, leftEyeHeight: 82, rightEyeHeight: 48, leftEyeWidth: 30 }, 700)
const greeting = clip('Portrait greeting', { ...neutral, leftEyeHeight: 12, rightEyeHeight: 12, leftEyeWidth: 32, rightEyeWidth: 32 }, 620)

/** Sparse native face clips; no permanent per-card requestAnimationFrame loop. */
export function usePortraitExpression(root: RefObject<HTMLDivElement | null>, avatar: RefObject<AvatarHandle | null>, id: string, enabled: boolean) {
  useEffect(() => {
    const element = root.current
    const button = element?.closest('button')
    if (!enabled || !element || !button) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastInteraction = 0
    let cycle = 0
    const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const allowed = () => visible && !document.hidden && !media.matches
    const play = (animation: typeof blink) => {
      if (!allowed()) return
      void avatar.current?.play(animation, { playback: 'once', trackId: 'portrait-expression' }).catch(error => console.warn('[pet] Portrait expression failed', error))
    }
    const schedule = () => {
      clearTimeout(timer)
      if (!allowed()) { avatar.current?.stop({ reset: true, trackId: 'portrait-expression' }); return }
      timer = setTimeout(() => {
        if (Date.now() - lastInteraction > 1200) play(blink)
        cycle++; schedule()
      }, 4300 + (seed * 37 + cycle * 1103) % 4200)
    }
    const hover = () => { if (Date.now() - lastInteraction < 900) return; lastInteraction = Date.now(); play(curious); schedule() }
    const click = () => { lastInteraction = Date.now(); play(greeting); schedule() }
    const observer = new IntersectionObserver(entries => { visible = !!entries[0]?.isIntersecting; schedule() }, { threshold: .25 })
    observer.observe(element)
    button.addEventListener('pointerenter', hover)
    button.addEventListener('focus', hover)
    button.addEventListener('click', click)
    document.addEventListener('visibilitychange', schedule)
    media.addEventListener('change', schedule)
    return () => {
      clearTimeout(timer); observer.disconnect()
      button.removeEventListener('pointerenter', hover); button.removeEventListener('focus', hover); button.removeEventListener('click', click)
      document.removeEventListener('visibilitychange', schedule); media.removeEventListener('change', schedule)
      avatar.current?.stop({ reset: true, trackId: 'portrait-expression' })
    }
  }, [id, enabled])
}
