import type { AvatarFace } from '@oneworks/avatar'
import type { CatReaction } from './avatar-motion.js'

export function upperCatExpression(dragging: boolean, falling: boolean, reaction: CatReaction): Partial<AvatarFace> | null {
  // The mouthless preset represents pupils with its two eyes.
  if (dragging) return { leftEyeWidth: 70, leftEyeHeight: 70, rightEyeWidth: 48, rightEyeHeight: 48, gap: 52,
    leftEyeShape: 'ellipse', rightEyeShape: 'ellipse',
    leftEyeRotation: 0, rightEyeRotation: 0 }
  if (falling) return { leftEyeWidth: 82, leftEyeHeight: 82, rightEyeWidth: 82, rightEyeHeight: 82, gap: 72,
    leftEyeShape: 'ellipse', rightEyeShape: 'ellipse',
    leftEyeRotation: 0, rightEyeRotation: 0 }
  if (reaction === 'closed') return { leftEyeHeight: 4, rightEyeHeight: 4, leftEyeRotation: 0, rightEyeRotation: 0 }
  if (reaction === 'angry') return { leftEyeHeight: 36, rightEyeHeight: 36, leftEyeRotation: -20, rightEyeRotation: 20 }
  return null
}
