import { idleDuration, idlePose, blendIdlePose, REST_POSE, type PetIdleKind, type PetIdlePose } from './pet-idle.js'

export interface SceneEntity { id: string; x: number; sizeScale?: number }
export interface SceneBody {
  id: string; sizeScale: number; storedX: number; expectedPositions: number[]; x: number; y: number; velocity: number; menuOpen: boolean; dragging: boolean; pressed: boolean;
  startX: number; startY: number; mode: PetIdleKind; started: number; lastInteraction: number;
  sleepRequested?: boolean; sleepBlendUntil: number; recoverUntil: number; pausedSince?: number; lift: number; nextAction: number; distance: number; pose: PetIdlePose; irritation: number; landing: number;
}
export interface SceneBounds { width: number; height: number }
export type SceneInput = { phase: string; menuOpen?: boolean; deltaX: number; deltaY: number }
export const sceneDiameter = (width: number) => Math.max(1, Math.min(128, width))
const clamp = (value: number, max: number) => Math.max(0, Math.min(Math.max(0, max), value))
export function createSceneBody(entity: SceneEntity, width: number, now: number, index: number): SceneBody {
  return { id: entity.id, sizeScale: clampSceneScale(entity.sizeScale), storedX: entity.x, expectedPositions: [], x: clamp(entity.x, 1) * Math.max(0, width - sceneDiameter(width)), y: 0, velocity: 0,
    menuOpen: false, dragging: false, pressed: false, lift: 0, sleepBlendUntil: 0, recoverUntil: 0, startX: 0, startY: 0, mode: 'rest', started: now, lastInteraction: now,
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
export function requestSceneRest(body: SceneBody, now: number) {
  interruptSceneBody(body, now)
  body.irritation = 0
  body.sleepRequested = true
}
export function inputSceneBody(body: SceneBody, input: SceneInput, bounds: SceneBounds, now: number, settings: { draggable?: boolean; clickFeedback?: boolean } = {}) {
  if (input.phase === 'start') body.sleepRequested = false
  if (input.menuOpen !== undefined) body.menuOpen = input.menuOpen
  if (body.menuOpen) {
    // A Host publish may coalesce cancellation and the following menu snapshot.
    // Menu state itself must end capture presentation, even without cancel.
    body.dragging = false; body.pressed = false; body.velocity = 0
    return
  }
  if (settings.draggable === false && input.phase === 'move') return
  if (settings.draggable === false && input.phase === 'end') input = { ...input, deltaX: 0, deltaY: 0 }
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
    else body.irritation = settings.clickFeedback === false ? 0 : Math.min(1, body.irritation + .26)
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
    if (x < body.x) low = Math.max(low, x + sceneSeparation(body, other, diameter))
    else high = Math.min(high, x - sceneSeparation(body, other, diameter))
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
    if (body.menuOpen || options.pausedIds?.includes(body.id)) { body.pausedSince ??= now; continue }
    if (body.pausedSince !== undefined) {
      const pausedFor = now - body.pausedSince
      body.started += pausedFor; body.lastInteraction += pausedFor; body.nextAction += pausedFor
      body.pausedSince = undefined
    }
    body.irritation *= Math.exp(-dt / 1000)
    if (body.irritation < .001) body.irritation = 0
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
        const separation = (other: SceneBody) => sceneSeparation(body, other, sceneDiameter(bounds.width))
        const candidates = [body.x, 0, max, ...occupied.flatMap(other => [other.x - separation(other), other.x + separation(other)])]
          .filter(x => x >= 0 && x <= max && occupied.every(other => Math.abs(x - other.x) >= separation(other) - .01))
        if (candidates.length) body.x = candidates.sort((a, b) => Math.abs(a - body.x) - Math.abs(b - body.x))[0]
      }
    }
    const controlled = body.dragging || body.pressed || body.y < 0 || body.irritation > .01
    if (controlled || now < body.recoverUntil) {
      if (body.mode !== 'rest' && body.mode !== 'wake') interruptSceneBody(body, now)
      body.pose = blendIdlePose(body.pose, REST_POSE, options.reducedMotion ? 1 : 1 - Math.exp(-dt / 110))
      if (controlled) body.lastInteraction = now
      continue
    }
    if (body.sleepRequested) {
      body.sleepRequested = false; body.mode = 'sleep'; body.started = now
      body.lastInteraction = now - 60000; body.sleepBlendUntil = now + 600
    }
    if (!options.idleAnimations || options.reducedMotion) {
      // Resting is a care state, independent from optional decorative motion.
      // Static settings must not prevent pets from recovering their energy.
      if (body.mode === 'roll' || body.mode === 'hop') {
        interruptSceneBody(body, now)
        body.pose = options.reducedMotion ? { ...REST_POSE } : blendIdlePose(body.pose, REST_POSE, 1 - Math.exp(-dt / 110))
        continue
      }
      const sleeping = now - body.lastInteraction >= 60000
      if (sleeping && body.mode !== 'sleep') {
        body.mode = 'sleep'
        // Already settled closed; re-enabling motion must not replay eye closure.
        body.started = now - 1200
      } else if (!sleeping) body.mode = 'rest'
      body.pose = { ...REST_POSE, eyes: sleeping ? .06 : 1 }
      body.sleepBlendUntil = sleeping ? now + 600 : 0
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
    const targetPose = idlePose(body.mode, now - body.started, body.distance)
    body.pose = body.mode === 'sleep' && now < body.sleepBlendUntil
      ? blendIdlePose(body.pose, targetPose, 1 - Math.exp(-dt / 110)) : targetPose
  }
}

/** Acknowledge our own asynchronous writes without resetting transient idle motion. */
export function reportScenePosition(body: SceneBody, width: number): number {
  const range = width - sceneDiameter(width)
  const x = range > 0 ? body.x / range : 0
  body.expectedPositions.push(x)
  if (body.expectedPositions.length > 16) body.expectedPositions.shift()
  return x
}
export function syncScenePosition(body: SceneBody, externalX: number, width: number, now: number) {
  if (Math.abs(body.storedX - externalX) < .000001) return false
  body.storedX = externalX
  const ack = body.expectedPositions.findIndex(x => Math.abs(x - externalX) < .000001)
  if (ack >= 0) { body.expectedPositions.splice(0, ack + 1); return false }
  body.expectedPositions = []
  interruptSceneBody(body, now)
  body.dragging = false; body.pressed = false
  body.x = clamp(externalX, 1) * Math.max(0, width - sceneDiameter(width))
  return true
}

/** Scale the rendered canvas around its existing head baseline, not its position. */
export function clampSceneScale(scale?: number): number {
  return typeof scale === 'number' && Number.isFinite(scale) ? Math.max(.85, Math.min(1.18, scale)) : 1
}
export function advanceSceneScale(current: number, target: number | undefined, elapsedMs: number, reduced: boolean): number {
  const goal = clampSceneScale(target)
  if (reduced || Math.abs(goal - current) < .0001) return goal
  return current + (goal - current) * (1 - Math.exp(-Math.max(0, Math.min(64, elapsedMs)) / 550))
}
function sceneSeparation(a: SceneBody, b: SceneBody, diameter: number): number {
  return diameter * (.34 * (a.sizeScale + b.sizeScale) + .02)
}
export function sceneHitRegion(body: SceneBody, bounds: SceneBounds) {
  const diameter = sceneDiameter(bounds.width)
  const size = .68 * diameter * body.sizeScale
  return { x: body.x + body.pose.dx + diameter * .5 - size / 2,
    y: bounds.height + 56 - diameter + body.y + body.pose.y + diameter * .86 - size,
    width: size, height: size }
}
export function restingSceneIds(bodies: readonly SceneBody[]): string[] {
  return bodies.filter(body => body.mode === 'sleep' && !body.dragging && !body.pressed).map(body => body.id).sort()
}

/** New arrivals find a nearby free place; existing bodies are never relocated. */
export function placeNewSceneBody(body: SceneBody, occupied: readonly SceneBody[], width: number): void {
  const diameter = sceneDiameter(width)
  const max = Math.max(0, width - diameter)
  const xOf = (other: SceneBody) => other.x + other.pose.dx
  const gap = (other: SceneBody) => sceneSeparation(body, other, diameter) + 6
  const sorted = [...occupied].sort((a,b) => xOf(a)-xOf(b))
  const candidates = [body.x, 0, max, ...occupied.flatMap(other => [xOf(other)-gap(other), xOf(other)+gap(other)]),
    ...sorted.slice(1).map((other,index) => (xOf(sorted[index]) + xOf(other)) / 2)]
    .filter(x => x >= 0 && x <= max)
  const free = candidates.filter(x => occupied.every(other => Math.abs(x-xOf(other)) >= gap(other)-.001))
  if (free.length) { body.x = free.sort((a,b) => Math.abs(a-body.x)-Math.abs(b-body.x))[0]; return }
  // A narrow composer may have no free slot. Minimize overlap inside the seat
  // rather than pushing existing pets or placing an inaccessible pet outside it.
  const clearance = (x: number) => Math.min(...occupied.map(other => Math.abs(x-xOf(other))-gap(other)))
  body.x = candidates.sort((a,b) => clearance(b)-clearance(a) || Math.abs(a-body.x)-Math.abs(b-body.x))[0] ?? 0
}
export function reconcileSceneBodies(previous: readonly SceneBody[], entities: readonly SceneEntity[], width: number, now: number): SceneBody[] {
  const active = new Set(entities.map(entity => entity.id))
  const occupied = previous.filter(body => active.has(body.id))
  return entities.map((entity,index) => {
    const retained = previous.find(body => body.id === entity.id)
    if (retained) return retained
    const body = createSceneBody(entity,width,now,index)
    placeNewSceneBody(body,occupied,width)
    occupied.push(body)
    return body
  })
}
