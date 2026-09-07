/** Pure poses sampled by the scene's one shared clock. No per-pet timers. */
export type PetIdleKind = 'rest' | 'roll' | 'hop' | 'sleep' | 'wake'
export interface PetIdlePose { dx: number; y: number; angle: number; ball: number; eyes: number; scaleX: number; scaleY: number }
export const REST_POSE: PetIdlePose = { dx: 0, y: 0, angle: 0, ball: 0, eyes: 1, scaleX: 1, scaleY: 1 }
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
export function idleDuration(kind: PetIdleKind): number {
  return kind === 'roll' ? 2600 : kind === 'hop' ? 1500 : kind === 'wake' ? 650 : Infinity
}
export function idlePose(kind: PetIdleKind, elapsedMs: number, distance = 0): PetIdlePose {
  const pose = { ...REST_POSE }
  if (kind === 'roll') {
    const travel = smooth((elapsedMs - 450) / 1600)
    pose.ball = smooth(elapsedMs / 450) * (1 - smooth((elapsedMs - 2050) / 550))
    pose.dx = distance * travel
    // End at a complete turn so opening the ball cannot snap its orientation.
    pose.angle = Math.sign(distance) * 360 * travel
    pose.scaleX = 1 - .08 * pose.ball
    pose.scaleY = 1 - .08 * pose.ball
    pose.eyes = 1 - .75 * pose.ball
  } else if (kind === 'hop') {
    const t = clamp(elapsedMs / 1500)
    pose.dx = distance * smooth(t)
    const flight = Math.max(0, Math.sin(Math.PI * clamp((t - .12) / .76)))
    pose.y = -30 * flight
    const squash = t < .12 ? Math.sin(t / .12 * Math.PI) : t > .88 ? Math.sin((t - .88) / .12 * Math.PI) : 0
    pose.scaleX = 1 + squash * .1
    pose.scaleY = 1 - squash * .13
  } else if (kind === 'sleep') {
    const asleep = smooth(elapsedMs / 1200)
    pose.eyes = 1 - .94 * asleep
    pose.scaleY = 1 - .045 * asleep + Math.sin(elapsedMs / 1500) * .008 * asleep
  } else if (kind === 'wake') {
    pose.eyes = .06 + .94 * smooth(elapsedMs / 650)
    pose.scaleY = 1 + .025 * Math.sin(clamp(elapsedMs / 650) * Math.PI)
  } else {
    pose.scaleY = 1 + Math.sin(elapsedMs / 1800) * .006
  }
  return pose
}
export function blendIdlePose(from: PetIdlePose, to: PetIdlePose, weight: number): PetIdlePose {
  const result = { ...from }
  for (const key of Object.keys(from) as (keyof PetIdlePose)[]) result[key] = from[key] + (to[key] - from[key]) * clamp(weight)
  return result
}
