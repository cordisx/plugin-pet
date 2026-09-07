/** Position is relative to the resting canvas: x is absolute within the seat, y is lift. */
export interface AvatarPosition { x: number; y: number }
export function clampAvatarPosition(position: AvatarPosition, width: number, height: number): AvatarPosition {
  const diameter = Math.min(128, width)
  return {
    x: Math.max(0, Math.min(Math.max(0, width - diameter), position.x)),
    y: Math.max(-Math.max(0, height + 56 - diameter), Math.min(0, position.y)),
  }
}
export function fallStep(position: AvatarPosition, velocity: number, elapsed: number) {
  const dt = Math.min(32, Math.max(0, elapsed)) / 1000
  const nextVelocity = velocity + 2200 * dt
  const y = Math.min(0, position.y + nextVelocity * dt)
  return { position: { ...position, y }, velocity: y === 0 ? 0 : nextVelocity, settled: y === 0 }
}
export type CatReaction = 'idle' | 'tremble' | 'closed' | 'angry'
export function reactionForClicks(count: number): CatReaction {
  return count >= 6 ? 'angry' : count >= 3 ? 'closed' : 'tremble'
}

export function decayIrritation(value: number, elapsedMs: number) {
  return value * Math.exp(-Math.max(0, elapsedMs) / 900)
}
