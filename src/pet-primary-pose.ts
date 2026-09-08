import type { CordisXReactVisualProps } from 'cordisx/contracts'
import type { AvatarDefinition } from '@oneworks/avatar'
import { PET_AVATAR_SCALE } from './pet-appearance.js'
export type PrimaryMode = 'idle' | 'recording' | 'thinking'
export interface PrimaryGaze { x: number; y: number }
export function primaryMode(state: CordisXReactVisualProps['state']): PrimaryMode {
  const dictation = state.schemaVersion === 2 ? state.dictation : 'unavailable'
  if (dictation === 'recording') return 'recording'
  if (dictation === 'starting' || dictation === 'transcribing') return 'thinking'
  return 'idle'
}
export function advancePrimaryGaze(current: PrimaryGaze, target: PrimaryGaze, elapsedMs: number, reducedMotion: boolean) {
  const weight = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, Math.min(64, elapsedMs)) / 55)
  const next = { x: current.x + (target.x - current.x) * weight, y: current.y + (target.y - current.y) * weight }
  const settled = Math.abs(next.x - target.x) + Math.abs(next.y - target.y) < .001
  return { gaze: settled ? target : next, settled }
}
/** Status changes only the face; the equipped skin and geometry remain intact. */
export function primaryDefinition(base: AvatarDefinition, gaze: PrimaryGaze, mode: PrimaryMode): AvatarDefinition {
  const face = mode === 'recording' ? { leftEyeWidth: 26, rightEyeWidth: 26, leftEyeHeight: 56, rightEyeHeight: 56 }
    : mode === 'thinking' ? { leftEyeWidth: 28, rightEyeWidth: 34, leftEyeHeight: 48, rightEyeHeight: 24, leftEyeRotation: -8, rightEyeRotation: 8 }
    : {}
  return { ...base, scene: { ...base.scene,
    face: { ...base.scene.face, ...face },
    view: { ...base.scene.view, scale: 1.9 * (base.scene.view.scale / PET_AVATAR_SCALE), positionY: 30,
      yaw: base.scene.view.yaw + Math.round((gaze.x - .5) * 60) / 100, pitch: base.scene.view.pitch + Math.round((gaze.y - .5) * 30) / 100 },
  } }
}

/** Half-percent steps prevent tiny care pulses from invalidating geometry. */
export function primaryWeightFactor(sizeScale: number): number {
  const factor = 1 + (Number.isFinite(sizeScale) ? sizeScale - 1 : 0) * .4
  return Math.max(.94, Math.min(1.06, Math.round(factor * 200) / 200))
}
export function primaryWeightDefinition(base: AvatarDefinition, factor: number): AvatarDefinition {
  if (factor === 1) return base
  // Native preset geometry is owned by Avatar; scale its complete rendered entity.
  return { ...base, scene: { ...base.scene, view: { ...base.scene.view, scale: base.scene.view.scale * factor } } }
}
