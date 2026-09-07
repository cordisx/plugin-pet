import { parseAvatarAnimationClip } from '@oneworks/avatar'

// Morph the built-in cat head through the public animation channel; ear roots move with the narrowing upper contour.
export const liftedCatClip = parseAvatarAnimationClip({
  label: 'Lifted cat', anchor: 'absolute', playback: 'once', durationMs: 180,
  keyframes: [
    { atMs: 0, patch: { partTransforms: { 'cat-ear-left': { x: -56, y: -78 }, 'cat-ear-right': { x: 56, y: -78 } }, partShapeMorphs: { 'cat-head': { fromShape: 'ellipse', toShape: 'teardrop', progress: 0 } } } },
    { atMs: 180, patch: { partTransforms: { 'cat-ear-left': { x: -50, y: -68 }, 'cat-ear-right': { x: 50, y: -68 } }, partShapeMorphs: { 'cat-head': { fromShape: 'ellipse', toShape: 'teardrop', progress: .22 } } } },
  ],
})
// Timeline playback retains its final sample in Avatar rc.8; one-shot clip
// playback resets to frame zero on completion in that version.
export function catDeformationTimeline(clip: import('@oneworks/avatar').AvatarAnimationClip): import('@oneworks/avatar').AvatarAnimationTimeline {
  return { version: 1, durationMs: clip.durationMs + 1, tracks: [{ trackId: 'head-shape', clips: [{
    instanceId: 'head-shape', startMs: 0, durationMs: clip.durationMs + 1, sourceOffsetMs: 0,
    playbackRate: 1, weight: 1, source: { type: 'inline', version: 1, clip },
  }] }] }
}
export const liftedCatTimeline = catDeformationTimeline(liftedCatClip)
/** Changing direction starts at the current sample, including quick release/re-grab. */
export function advanceDeformationTime(current: number, target: number, elapsedMs: number): number {
  const step = Math.max(0, Math.min(32, elapsedMs))
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step)
}
