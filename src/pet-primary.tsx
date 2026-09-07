import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'cordisx/react'
import { Avatar } from '@oneworks/avatar-react'
import { resolveAvatarAnimationFrame, type AvatarDefinition } from '@oneworks/avatar'
import type { CordisXReactVisualProps } from 'cordisx/contracts'
import type { PetClient } from './pet-client.js'
import { petAppearance } from './pet-appearance.js'
import { winkClip } from './avatar-wink.js'
import { advancePrimaryGaze, primaryDefinition, primaryMode, type PrimaryGaze, type PrimaryMode } from './pet-primary-pose.js'

const PrimaryGeometry = memo(function PrimaryGeometry({ definition, theme }: { definition: AvatarDefinition; theme: 'light' | 'dark' }) {
  return <Avatar definition={definition} theme={theme} interactive={false} autoplay={false}
    style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }} />
})
function usePrimaryPose(state: CordisXReactVisualProps['state'], mode: PrimaryMode, follow: boolean, reduced: boolean, visible: boolean) {
  const current = useRef<PrimaryGaze>({ x: .5, y: .5 })
  const [pose, setPose] = useState({ gaze: current.current, wink: -1 })
  const entered = useRef<number | null>(null)
  const hovered = Boolean(state.pointer?.inside)
  useEffect(() => {
    entered.current = hovered && mode === 'idle' && !reduced ? performance.now() : null
  }, [hovered, mode, reduced])
  const x = follow ? state.pointer?.x : .5
  const y = follow ? state.pointer?.y : .5
  useEffect(() => {
    if (!visible) return
    // Missing observations retain the last pose. Re-entry approaches its new
    // target from that pose rather than jumping to a default or new endpoint.
    const target = { x: x ?? current.current.x, y: y ?? current.current.y }
    if (reduced) {
      current.current = target
      setPose({ gaze: target, wink: -1 })
      return
    }
    let frame: number | undefined
    let previous = performance.now()
    const tick = (now: number) => {
      if (now - previous < 32) { frame = requestAnimationFrame(tick); return }
      const step = advancePrimaryGaze(current.current, target, now - previous, false)
      previous = now
      current.current = step.gaze
      const elapsed = entered.current === null ? -1 : now - entered.current
      const wink = mode === 'idle' && elapsed >= 0 && elapsed < winkClip.durationMs ? elapsed : -1
      setPose({ gaze: step.gaze, wink })
      // Breathing is a compositor transform. Once gaze and wink settle, no
      // JavaScript animation frame remains scheduled for the primary pet.
      if (!step.settled || wink >= 0) frame = requestAnimationFrame(tick)
      else frame = undefined
    }
    frame = requestAnimationFrame(tick)
    return () => { if (frame !== undefined) cancelAnimationFrame(frame) }
  }, [x, y, hovered, mode, reduced, visible])
  return pose
}
export function createPetPrimary(client: PetClient) {
  return function PetPrimary({ state }: CordisXReactVisualProps) {
    const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
    const data = snapshot.state
    const pet = data?.pets.find(item => item.id === data.mainPetId)
    const base = useMemo(() => pet ? petAppearance(pet) : null, [pet?.species, pet?.skinId])
    const visible = Boolean(data?.settings.visible && base)
    const reduced = state.reducedMotion || Boolean(data?.settings.reducedMotion)
    const mode = primaryMode(state)
    const pose = usePrimaryPose(state, mode, data?.settings.followPointer !== false, reduced, visible)
    const definition = useMemo(() => {
      if (!base) return null
      const result = primaryDefinition(base, pose.gaze, mode)
      return mode === 'idle' && pose.wink >= 0
        ? { ...result, scene: resolveAvatarAnimationFrame(result, winkClip, pose.wink).scene }
        : result
    }, [base, pose, mode])
    if (!visible || !definition) return null
    return <span className="pet-primary" data-pet-id={pet?.id} data-pet-status={mode}
      data-pet-reduced-motion={reduced} data-composer-avatar-state={state.schemaVersion === 2 ? state.dictation : state.action}
      aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}>
      <style>{'.pet-primary .oneworks-avatar,.pet-primary .oneworks-avatar *{box-sizing:border-box}.pet-primary .oneworks-avatar>.interactive-avatar{width:100%;height:100%}.pet-primary[data-pet-status="recording"][data-pet-reduced-motion="false"]>.pet-primary-body{animation:pet-primary-breathe 1800ms ease-in-out infinite}@keyframes pet-primary-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025,.975)}}@media(prefers-reduced-motion:reduce){.pet-primary>.pet-primary-body{animation:none}}'}</style>
      <span className="pet-primary-body" style={{ display: 'block', width: '100%', height: '100%', transformOrigin: '50% 75%' }}>
        <PrimaryGeometry definition={definition} theme={state.theme} />
      </span>
    </span>
  }
}
