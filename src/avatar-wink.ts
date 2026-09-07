import { parseAvatarAnimationClip, type AvatarAnimationClip } from '@oneworks/avatar'
import type { CordisXReactVisualProps } from 'cordisx/contracts'

// Face-only Wink: leave pose, palette and the mouthless character intact.
export const winkClip: AvatarAnimationClip = parseAvatarAnimationClip({
  label: 'Wink', anchor: 'absolute', playback: 'once', durationMs: 600,
  keyframes: [
    { atMs: 0, patch: { face: { leftEyeHeight: 70 } } },
    { atMs: 160, patch: { face: { leftEyeHeight: 4 } } },
    { atMs: 320, patch: { face: { leftEyeHeight: 4 } } },
    { atMs: 600, patch: { face: { leftEyeHeight: 70 } } },
  ],
})
export function isAvatarHovered(state: CordisXReactVisualProps['state'], overlay: boolean): boolean {
  const pointer = state.pointer
  if (!pointer?.inside) return false
  if (!overlay) return true
  const diameter = Math.min(128, state.bounds.width)
  const x = pointer.x * state.bounds.width
  const y = pointer.y * state.bounds.height
  return x >= state.bounds.width - 40 - diameter && x <= state.bounds.width - 40
    && y >= state.bounds.height + 56 - diameter
}
