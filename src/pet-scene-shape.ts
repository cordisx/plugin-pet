import { parseAvatarAnimationClip, type AvatarDefinition } from '@oneworks/avatar'
import { catDeformationTimeline } from './avatar-deformation.js'

export function createPetShapeTimeline(definition: AvatarDefinition, lifted = false) {
  const parts = definition.scene.entity.parts
  const head = parts.find(part => part.face)
  if (!head) return undefined
  // Shrink every auxiliary shape toward the head. No assumption about ears,
  // limbs or species; skin materials and surface decals remain Avatar-owned.
  const transforms = Object.fromEntries(parts.map(part => [part.id, part.face
    ? { scaleX: (part.scaleX + part.scaleY) / 2, scaleY: (part.scaleX + part.scaleY) / 2 }
    : { x: head.x + (part.x - head.x) * .25, y: head.y + (part.y - head.y) * .25,
      scaleX: part.scaleX * .15, scaleY: part.scaleY * .15 }]))
  return catDeformationTimeline(parseAvatarAnimationClip({
    label: 'Pet curls into a ball', anchor: 'absolute', playback: 'once', durationMs: 1000,
    keyframes: [
      { atMs: 0, patch: { partShapeMorphs: { [head.id]: { fromShape: head.shape, toShape: lifted ? 'teardrop' : 'sphere', progress: 0 } },
        partTransforms: Object.fromEntries(parts.map(part => [part.id, { x: part.x, y: part.y, scaleX: part.scaleX, scaleY: part.scaleY }])) } },
      { atMs: 1000, patch: { partShapeMorphs: { [head.id]: { fromShape: head.shape, toShape: lifted ? 'teardrop' : 'sphere', progress: lifted ? .22 : 1 } }, partTransforms: lifted ? Object.fromEntries(parts.filter(part => !part.face).map(part => [part.id, { x: head.x + (part.x - head.x) * .9, y: head.y + (part.y - head.y) * .9 }])) : transforms } },
    ],
  }))
}
