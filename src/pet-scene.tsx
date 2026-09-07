import { memo, useEffect, useMemo, useRef, useState } from 'cordisx/react'
import { Avatar } from '@oneworks/avatar-react'
import { type AvatarDefinition, type AvatarAnimationTimeline } from '@oneworks/avatar'
import type { CordisXReactVisualProps } from 'cordisx/contracts'
import { createPetShapeTimeline } from './pet-scene-shape.js'
import { advanceScene, reconcileSceneBodies, inputSceneBody, interruptSceneBody, sceneDiameter, advanceSceneScale, sceneHitRegion, restingSceneIds, reportScenePosition, syncScenePosition, type SceneBody } from './pet-scene-model.js'
import { advanceSceneGaze, captureSceneFrame, sameSceneRegion, secondarySceneMotion, type RenderBody, type SceneRegion } from './pet-scene-render.js'

export interface PetSceneEntity { id: string; name: string; x: number; sizeScale?: number; definition: AvatarDefinition }
export interface PetSceneProps {
  state: CordisXReactVisualProps['state']
  entities: readonly PetSceneEntity[]
  dragFor: (id: string) => CordisXReactVisualProps['drag']
  onRestingChange?: (ids: string[]) => void
  onPositionChange?: (id: string, x: number) => void
  onInteract?: (id: string, kind: 'activate' | 'drop') => void
  followPointer?: boolean
  clickFeedback?: boolean
  draggable?: boolean
  idleAnimations?: boolean
  pausedIds?: readonly string[]
  feedback?: { id: string; sequence: number; kind: 'feed' | 'pet' }
}
const PetAvatarGeometry = memo(function PetAvatarGeometry({ definition, theme, timeline, time }: {
  definition: AvatarDefinition; theme: 'light' | 'dark'; timeline?: AvatarAnimationTimeline; time: number
}) {
  return <Avatar definition={definition} theme={theme} interactive={false} autoplay={false}
    timeline={timeline} timelineTimeMs={time}
    style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }} />
})
const SceneAvatar = memo(function SceneAvatar({ entity, body, state, now }: {
  entity: PetSceneEntity; body: RenderBody; state: CordisXReactVisualProps['state']; now: number
}) {
  const diameter = sceneDiameter(state.bounds.width)
  const rollTimeline = useMemo(() => createPetShapeTimeline(entity.definition), [entity.definition])
  const liftTimeline = useMemo(() => createPetShapeTimeline(entity.definition, true), [entity.definition])
  const lifted = body.lift > .001 && body.pose.ball < .001
  // A zero-progress morph still makes Avatar project a complete surface mesh.
  // Resting, walking and hopping need only their ordinary shape and CSS motion.
  const timeline = lifted ? liftTimeline : body.pose.ball > .001 ? rollTimeline : undefined
  const falling = body.y < 0 && !body.dragging
  const pose = body.pose
  const yaw = body.gazeYaw
  const pitch = body.gazePitch
  const eyes = Math.round(pose.eyes * 100) / 100
  const irritation = Math.round(body.irritation * 100) / 100
  const definition = useMemo(() => ({ ...entity.definition, scene: { ...entity.definition.scene,
    view: { ...entity.definition.scene.view, yaw, pitch },
    face: { ...entity.definition.scene.face,
      leftEyeWidth: body.dragging ? 54 : falling ? 62 : 24 + irritation * 22,
      leftEyeHeight: body.dragging ? 54 : falling ? 62 : Math.max(4, 70 * eyes * (1 - .68 * irritation)),
      rightEyeWidth: body.dragging ? 40 : falling ? 54 : 24 + irritation * 22,
      rightEyeHeight: body.dragging ? 40 : falling ? 54 : Math.max(4, 70 * eyes * (1 - .75 * irritation)),
      leftEyeRotation: -16 * irritation, rightEyeRotation: 16 * irritation,
    },
  } }), [entity.definition, yaw, pitch, body.dragging, falling, eyes, irritation])
  const { bounce, poke } = secondarySceneMotion(body, now, state.reducedMotion)
  return <span className="pet-scene-entity" data-pet-id={entity.id} data-pet-behavior={body.dragging ? 'drag' : falling ? 'fall' : body.mode}
    aria-hidden="true" style={{ position: 'absolute', display: 'block', width: diameter, height: diameter,
      left: body.x + pose.dx, bottom: -56 - body.y - pose.y, pointerEvents: 'none', zIndex: body.dragging ? 2 : 1 }}>
    <span style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', transformOrigin: '50% 86%', transform: `scale(${body.sizeScale})` }}>
    <span style={{ display: 'block', width: '100%', height: '100%', transformOrigin: '50% 75%',
      transform: `rotate(${pose.angle}deg) scale(${pose.scaleX + bounce * .12 + poke * .06},${pose.scaleY - bounce * .16 - poke * .08})` }}>
      <PetAvatarGeometry definition={definition} theme={state.theme}
        timeline={timeline} time={Math.round((lifted ? body.lift : pose.ball) * 1000)} />
    </span>
    </span>
  </span>
}, (a,b) => a.body === b.body && a.entity.definition === b.entity.definition && a.entity.id === b.entity.id
  && a.state.theme === b.state.theme && a.state.bounds.width === b.state.bounds.width
  && a.state.reducedMotion === b.state.reducedMotion)

/** One owned animation loop and one public interaction subscription per entity. */
export function PetScene(props: PetSceneProps) {
  const latest = useRef(props)
  latest.current = props
  const bodies = useRef<SceneBody[]>([])
  const [frame, setFrame] = useState({ now: 0, bodies: [] as RenderBody[] })
  const entityKeys = props.entities.map(entity => entity.id).join('\0')
  const restingKey = useRef('')
  const reportResting = () => {
    const ids = restingSceneIds(bodies.current)
    const key = ids.join('\0')
    if (key !== restingKey.current) { restingKey.current = key; latest.current.onRestingChange?.(ids) }
  }
  const lastFeedback = useRef<number | undefined>(undefined)
  const bindings = useRef(new Map<string, { handle: NonNullable<CordisXReactVisualProps['drag']>; release: () => void; region?: SceneRegion }>())
  useEffect(() => {
    const now = performance.now()
    const retainedIds = new Set(bodies.current.map(body => body.id))
    bodies.current = reconcileSceneBodies(bodies.current, props.entities, props.state.bounds.width, now)
    for (const body of bodies.current) {
      if (!retainedIds.has(body.id)) {
        const range = Math.max(0, props.state.bounds.width - sceneDiameter(props.state.bounds.width))
        if (Math.abs(body.x - body.storedX * range) > .001) latest.current.onPositionChange?.(body.id, reportScenePosition(body, props.state.bounds.width))
      }
    }
    for (const [id, binding] of bindings.current) {
      if (!props.entities.some(entity => entity.id === id) || props.dragFor(id) !== binding.handle) {
        binding.release(); bindings.current.delete(id)
      }
    }
    for (const entity of props.entities) {
      const handle = props.dragFor(entity.id)
      const body = bodies.current.find(item => item.id === entity.id)!
      if (!handle || bindings.current.has(entity.id)) continue
      const initialSnapshot = handle.getSnapshot()
      body.menuOpen = Boolean('menuOpen' in initialSnapshot && initialSnapshot.menuOpen)
      let sequence = initialSnapshot.sequence
      const unsubscribe = handle.subscribe(() => {
        const snapshot = handle.getSnapshot()
        if (snapshot.sequence === sequence) return
        sequence = snapshot.sequence
        const wasDragging = body.dragging
        inputSceneBody(body, snapshot, latest.current.state.bounds, performance.now(), latest.current)
        if (snapshot.phase === 'activate') latest.current.onInteract?.(body.id, 'activate')
        if (snapshot.phase === 'end' && wasDragging && latest.current.draggable !== false) latest.current.onInteract?.(body.id, 'drop')
        if (snapshot.phase === 'end' || snapshot.phase === 'cancel') {
          latest.current.onPositionChange?.(body.id, reportScenePosition(body, latest.current.state.bounds.width))
        }
      })
      bindings.current.set(entity.id, { handle, release: () => {
        unsubscribe(); handle.setRegion(null); body.dragging = false; body.pressed = false; body.menuOpen = false
      } })
    }
    // Seed visible entities synchronously after reconciliation. A remount/fast
    // refresh must not depend on the first animation frame to show its pets.
    setFrame(previous => ({ now, bodies: captureSceneFrame(bodies.current,previous.bodies,now,props.state.reducedMotion) }))
    reportResting()
    // Retained ID/handle pairs keep gesture state when another pet joins/leaves.
  }, [entityKeys, props.dragFor])
  useEffect(() => () => {
    for (const binding of bindings.current.values()) binding.release()
    bindings.current.clear()
    if (restingKey.current) { restingKey.current = ''; latest.current.onRestingChange?.([]) }
  }, [])
  useEffect(() => {
    if (!entityKeys) return
    let animationFrame: number
    let previous = performance.now()
    let previousWidth = latest.current.state.bounds.width
    const tick = (now: number) => {
      animationFrame = requestAnimationFrame(tick)
      if (now - previous < 32) return
      const current = latest.current
      const elapsed = now - previous
      previous = now
      const { width, height } = current.state.bounds
      if (width !== previousWidth) {
        const oldRange = Math.max(1, previousWidth - sceneDiameter(previousWidth))
        const range = Math.max(0, width - sceneDiameter(width))
        for (const body of bodies.current) { interruptSceneBody(body, now); body.x = body.x / oldRange * range }
        previousWidth = width
      }
      for (const body of bodies.current) {
        const entity = current.entities.find(item => item.id === body.id)
        if (entity) {
          syncScenePosition(body, entity.x, width, now)
          body.sizeScale = advanceSceneScale(body.sizeScale, entity.sizeScale, elapsed, current.state.reducedMotion)
        }
        if (current.clickFeedback === false) body.irritation = 0
        if (current.draggable === false && body.dragging) {
          inputSceneBody(body, { phase: 'cancel', deltaX: 0, deltaY: 0 }, current.state.bounds, now)
        }
      }
      if (current.feedback && current.feedback.sequence !== lastFeedback.current) {
        lastFeedback.current = current.feedback.sequence
        const body = bodies.current.find(body => body.id === current.feedback!.id)
        if (body) { interruptSceneBody(body, now); body.mode = 'wake'; body.started = now; body.irritation = 0 }
      }
      const previousModes = new Map(bodies.current.map(body => [body.id, { mode: body.mode, y: body.y }]))
      advanceScene(bodies.current, { width, height }, now, elapsed, {
        reducedMotion: current.state.reducedMotion, idleAnimations: current.idleAnimations !== false,
        pausedIds: current.pausedIds,
      })
      for (const body of bodies.current) {
        const before = previousModes.get(body.id)
        if ((before?.mode !== 'rest' && body.mode === 'rest') || (before && before.y < 0 && body.y === 0)) {
          current.onPositionChange?.(body.id, reportScenePosition(body, width))
        }
        const entity = current.entities.find(item => item.id === body.id)
        // Implicit presets cannot be morphed through rc.8's public part API.
        // Preserve the full animal and use hopping instead of clipping it away.
        if (body.mode === 'roll' && !entity?.definition.scene.entity.parts.some(part => part.face)) {
          body.mode = 'hop'; body.started = now
        }
        advanceSceneGaze(body, { width, height }, current.state.pointer, current.followPointer !== false)
        const region = { ...sceneHitRegion(body, { width, height }),
          label: `${entity?.name ?? 'Pet'}: ${current.draggable === false ? 'click to play' : 'drag to move; click to play'}` }
        const binding = bindings.current.get(body.id)
        if (binding && !sameSceneRegion(binding.region,region)) {
          binding.region = region
          binding.handle.setRegion(region)
        }
      }
      reportResting()
      setFrame(previous => {
        const next = captureSceneFrame(bodies.current,previous.bodies,now,current.state.reducedMotion)
        return next.length === previous.bodies.length && next.every((body,index) => body === previous.bodies[index])
          ? previous : { now, bodies: next }
      })
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [Boolean(entityKeys)])
  return <span className="pet-scene" style={{ pointerEvents: 'none' }}>
    <style>{'.pet-scene .oneworks-avatar,.pet-scene .oneworks-avatar *{box-sizing:border-box}.pet-scene .oneworks-avatar>.interactive-avatar{width:100%;height:100%}'}</style>
    {props.entities.map(entity => {
      const body = frame.bodies.find(item => item.id === entity.id)
      return body ? <SceneAvatar key={entity.id} entity={entity} body={body} state={props.state} now={frame.now} /> : null
    })}
  </span>
}
