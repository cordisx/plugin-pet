import { idleDuration, idlePose, blendIdlePose, REST_POSE, type PetIdleKind, type PetIdlePose } from './pet-idle.js'

export interface SceneEntity { id: string; x: number }
export interface SceneBody {
  id: string; x: number; y: number; velocity: number; dragging: boolean; pressed: boolean;
  startX: number; startY: number; mode: PetIdleKind; started: number; lastInteraction: number;
  recoverUntil: number; pausedSince?: number; lift: number; nextAction: number; distance: number; pose: PetIdlePose; irritation: number; landing: number;
}
export interface SceneBounds { width: number; height: number }
export type SceneInput = { phase: string; deltaX: number; deltaY: number }
export const sceneDiameter = (width: number) => Math.max(1, Math.min(128, width))
const clamp = (value: number, max: number) => Math.max(0, Math.min(Math.max(0, max), value))
export function createSceneBody(entity: SceneEntity, width: number, now: number, index: number): SceneBody {
  return { id: entity.id, x: clamp(entity.x, 1) * Math.max(0, width - sceneDiameter(width)), y: 0, velocity: 0,
    dragging: false, pressed: false, lift: 0, recoverUntil: 0, startX: 0, startY: 0, mode: 'rest', started: now, lastInteraction: now,
    nextAction: now + 6000 + index * 2300, distance: 0, pose: { ...REST_POSE }, irritation: 0, landing: -Infinity }
}
/** Commit the visible position before interruption, preserving the current visual pose. */
export function interruptSceneBody(body: SceneBody, now: number) {
  body.x += body.pose.dx
  body.y += body.pose.y
  body.pose = { ...body.pose, dx: 0, y: 0, angle: ((body.pose.angle + 180) % 360 + 360) % 360 - 180 }
  body.mode = 'rest'; body.started = now; body.distance = 0; body.recoverUntil = now + 400
  body.lastInteraction = now; body.nextAction = now + 9000
}
export function inputSceneBody(body: SceneBody, input: SceneInput, bounds: SceneBounds, now: number) {
  if (input.phase === 'start') {
    const asleep = body.mode === 'sleep'
    interruptSceneBody(body, now)
    if (asleep) { body.mode = 'wake'; body.started = now }
    body.pressed = true; body.startX = body.x; body.startY = body.y
  } else if (input.phase === 'move' || input.phase === 'end') {
    const moved = input.phase === 'move' || input.deltaX !== 0 || input.deltaY !== 0
    if (moved) {
      body.x = clamp(body.startX + input.deltaX, bounds.width - sceneDiameter(bounds.width))
      body.y = Math.min(0, Math.max(-Math.max(0, bounds.height + 56 - sceneDiameter(bounds.width)), body.startY + input.deltaY))
      body.irritation = 0
    }
    body.dragging = input.phase === 'move'
    if (input.phase === 'end') { body.pressed = false; body.velocity = 0; body.lastInteraction = now }
  } else if (input.phase === 'activate') {
    const waking = body.mode === 'sleep' || body.mode === 'wake'
    interruptSceneBody(body, now)
    body.pressed = false; body.dragging = false
    if (waking) { body.mode = 'wake'; body.started = now; body.recoverUntil = 0 }
    else body.irritation = Math.min(1, body.irritation + .26)
  } else if (input.phase === 'cancel') {
    body.pressed = false; body.dragging = false; body.velocity = 0
    body.lastInteraction = now; body.nextAction = now + 9000
  }
}
/** Select an unobstructed destination without passing through another head. */
export function sceneTravel(body: SceneBody, bodies: SceneBody[], width: number, direction: number, distance: number) {
  const diameter = sceneDiameter(width)
  let low = 0, high = Math.max(0, width - diameter)
  for (const other of bodies) {
    if (other === body || other.y < -diameter * .7) continue
    const x = other.x + other.pose.dx
    if (x < body.x) low = Math.max(low, x + diameter * .7)
    else high = Math.min(high, x - diameter * .7)
  }
  if (low > high || body.x < low || body.x > high) return 0
  return Math.max(low, Math.min(high, body.x + direction * distance)) - body.x
}
/** Mutates scene bodies together; caller owns one frame loop for the scene. */
export function advanceScene(bodies: SceneBody[], bounds: SceneBounds, now: number, elapsed: number,
  options: { reducedMotion: boolean; idleAnimations: boolean; pausedIds?: readonly string[]; random?: () => number }) {
  const dt = Math.min(64, Math.max(0, elapsed))
  const random = options.random ?? Math.random
  let moving = bodies.some(body => body.mode === 'roll' || body.mode === 'hop')
  for (const body of bodies) {
    body.x = clamp(body.x, bounds.width - sceneDiameter(bounds.width))
    body.irritation *= Math.exp(-dt / 1000)
    if (body.irritation < .001) body.irritation = 0
    if (options.pausedIds?.includes(body.id)) { body.pausedSince ??= now; continue }
    if (body.pausedSince !== undefined) {
      const pausedFor = now - body.pausedSince
      body.started += pausedFor; body.lastInteraction += pausedFor; body.nextAction += pausedFor
      body.pausedSince = undefined
    }
    body.lift += ((body.dragging && !options.reducedMotion ? 1 : 0) - body.lift) * (1 - Math.exp(-dt / 85))
    body.y = Math.max(-Math.max(0, bounds.height + 56 - sceneDiameter(bounds.width)), body.y)
    if (!body.dragging && !body.pressed && body.y < 0) {
      body.velocity += 2200 * dt / 1000
      body.y = options.reducedMotion ? 0 : Math.min(0, body.y + body.velocity * dt / 1000)
      if (body.y === 0) {
        body.landing = now; body.velocity = 0
        // Small displacement resolves a landing overlap when the seat has room.
        const occupied = bodies.filter(other => other !== body && other.y === 0)
        const max = Math.max(0, bounds.width - sceneDiameter(bounds.width))
        const gap = sceneDiameter(bounds.width) * .7
        const candidates = [body.x, 0, max, ...occupied.flatMap(other => [other.x - gap, other.x + gap])]
          .filter(x => x >= 0 && x <= max && occupied.every(other => Math.abs(x - other.x) >= gap - .01))
        if (candidates.length) body.x = candidates.sort((a, b) => Math.abs(a - body.x) - Math.abs(b - body.x))[0]
      }
    }
    const controlled = body.dragging || body.pressed || body.y < 0 || body.irritation > .01
    if (controlled || now < body.recoverUntil || !options.idleAnimations || options.reducedMotion) {
      if (body.mode !== 'rest' && body.mode !== 'wake') interruptSceneBody(body, now)
      body.pose = blendIdlePose(body.pose, REST_POSE, options.reducedMotion ? 1 : 1 - Math.exp(-dt / 110))
      if (controlled) body.lastInteraction = now
      continue
    }
    if (now - body.started >= idleDuration(body.mode)) {
      body.x = clamp(body.x + body.distance, bounds.width - sceneDiameter(bounds.width))
      body.mode = 'rest'; body.started = now; body.distance = 0; body.recoverUntil = now + 400
      body.pose = { ...REST_POSE }; body.nextAction = now + 8000 + random() * 9000
    }
    if (body.mode === 'rest' && now >= body.nextAction) {
      body.started = now
      if (now - body.lastInteraction >= 60000) body.mode = 'sleep'
      else if (!moving) {
        const direction = random() < .5 ? -1 : 1
        body.distance = sceneTravel(body, bodies, bounds.width, direction, 60 + random() * 70)
        if (Math.abs(body.distance) < 20) body.distance = sceneTravel(body, bodies, bounds.width, -direction, 80)
        if (Math.abs(body.distance) >= 20) { body.mode = random() < .5 ? 'roll' : 'hop'; moving = true }
        else body.nextAction = now + 5000
      }
    }
    body.pose = idlePose(body.mode, now - body.started, body.distance)
  }
}
