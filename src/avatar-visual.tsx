import { memo, useEffect, useMemo, useRef, useState } from 'cordisx/react'
import { Avatar } from '@oneworks/avatar-react/renderer'
import { resolveAvatarAnimationFrame, type AvatarDefinition, type AvatarAnimationTimeline } from '@oneworks/avatar'
import { advanceDeformationTime, liftedCatTimeline } from './avatar-deformation.js'
import { upperCatExpression } from './avatar-expression.js'
import { useAvatarInteraction } from './avatar-interaction.js'
import { isAvatarHovered, winkClip } from './avatar-wink.js'
import type { CordisXReactVisualProps } from 'cordisx/contracts'
import { avatarColor, composerAvatarDefinition } from './avatar-model.js'

function useGaze({ state }: CordisXReactVisualProps, paused = false) {
  const [gaze, setGaze] = useState({ x: 0.5, y: 0.5 })
  const current = useRef(gaze)
  const target = useRef(gaze)
  const frame = useRef<number | undefined>(undefined)
  const lastTime = useRef<number | undefined>(undefined)
  const x = paused ? 0.5 : state.pointer?.x
  const y = paused ? 0.5 : state.pointer?.y
  useEffect(() => {
    const stop = () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      frame.current = undefined
      lastTime.current = undefined
    }
    if (x === undefined || y === undefined) {
      stop()
      return
    }
    target.current = { x, y }
    if (state.reducedMotion) {
      stop()
      current.current = target.current
      setGaze(target.current)
      return
    }
    if (frame.current !== undefined) return
    const tick = (time: number) => {
      const elapsed = lastTime.current === undefined ? 32 : Math.min(64, time - lastTime.current)
      // SVG geometry does not benefit from 120 Hz monitor callbacks; coalesce to 30 pose updates/s.
      if (elapsed < 32) {
        frame.current = requestAnimationFrame(tick)
        return
      }
      lastTime.current = time
      const weight = 1 - Math.exp(-elapsed / 45)
      const next = {
        x: current.current.x + (target.current.x - current.current.x) * weight,
        y: current.current.y + (target.current.y - current.current.y) * weight,
      }
      const settled = Math.abs(next.x - target.current.x) + Math.abs(next.y - target.current.y) < 0.002
      current.current = settled ? target.current : next
      setGaze(current.current)
      if (settled) {
        frame.current = undefined
        lastTime.current = undefined
      } else frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [x, y, state.reducedMotion])
  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    lastTime.current = undefined
  }, [])
  return gaze
}
function useWink(hovered: boolean, reducedMotion: boolean) {
  const [time, setTime] = useState<number | null>(null)
  useEffect(() => {
    if (!hovered || reducedMotion) {
      setTime(null)
      return
    }
    const start = performance.now()
    let frame: number
    let last = -Infinity
    setTime(0)
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed >= winkClip.durationMs) {
        setTime(null)
        return
      }
      if (now - last >= 32) {
        last = now
        setTime(elapsed)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [hovered, reducedMotion])
  return time
}
// Host snapshot updates do not rerender the expensive Avatar unless its pose or theme changes.
const AvatarRenderer = memo(
  function AvatarRenderer(
    { definition, theme, animation, targetTime = 0, reducedMotion = false }: {
      definition: AvatarDefinition; theme: 'light' | 'dark'; animation?: AvatarAnimationTimeline;
      targetTime?: number; reducedMotion?: boolean;
    },
  ) {
    const [time, setTime] = useState(0)
    const currentTime = useRef(0)
    useEffect(() => {
      if (!animation || reducedMotion) {
        currentTime.current = 0
        setTime(0)
        return
      }
      let previous = performance.now()
      let frame: number
      const tick = (now: number) => {
        const next = advanceDeformationTime(currentTime.current, targetTime, now - previous)
        previous = now
        currentTime.current = next
        setTime(next)
        if (next !== targetTime) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frame)
    }, [animation, targetTime, reducedMotion])
    return (
      <Avatar
        definition={definition}
        interactive={false}
        timeline={animation}
        timelineTimeMs={time}
        autoplay={false}
        theme={theme}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: 'transparent',
        }}
      />
    )
  },
)
function ComposerAvatar({ state, drag, overlay }: CordisXReactVisualProps & { overlay: boolean }) {
  const interaction = useAvatarInteraction({ state, drag }, overlay)
  const diameter = overlay ? Math.min(128, state.bounds.width) : state.bounds.width
  const pointer = state.pointer
  const localPointer = overlay && pointer ? {
    ...pointer,
    x: Math.max(0, Math.min(1, .5 + (pointer.x * state.bounds.width - interaction.position.x - diameter / 2) / 256)),
    y: Math.max(0, Math.min(1, .5 + (pointer.y * state.bounds.height - (state.bounds.height + 56 - diameter / 2 + interaction.position.y)) / 256)),
  } : pointer
  const fixedFacing = overlay && (interaction.dragging || interaction.position.y < 0)
  const gaze = useGaze({ state: { ...state, pointer: localPointer } }, fixedFacing)
  const hovered = overlay ? Boolean(state.pointer?.inside
    && state.pointer.x * state.bounds.width >= interaction.position.x + diameter * .16
    && state.pointer.x * state.bounds.width <= interaction.position.x + diameter * .84
    && state.pointer.y * state.bounds.height >= state.bounds.height + 56 - diameter + interaction.position.y + diameter * .18
    && state.pointer.y * state.bounds.height <= state.bounds.height + 56 - diameter + interaction.position.y + diameter * .86) : isAvatarHovered(state, false)
  const falling = overlay && !interaction.dragging && interaction.position.y < 0
  const wasFalling = useRef(false)
  const [landing, setLanding] = useState(false)
  useEffect(() => {
    const landed = wasFalling.current && !falling && !interaction.dragging
    wasFalling.current = falling
    if (!landed || state.reducedMotion) { setLanding(false); return }
    setLanding(true)
    const timer = setTimeout(() => setLanding(false), 340)
    return () => clearTimeout(timer)
  }, [falling, interaction.dragging, state.reducedMotion])
  const deformation = overlay ? liftedCatTimeline : undefined
  const winkTime = useWink(!overlay && hovered, state.reducedMotion)
  const color = avatarColor(state, overlay)
  // Keep geometry, materials and face references stable while the pointer moves.
  const baseDefinition = useMemo(() => composerAvatarDefinition(color, 0.5, 0.5, overlay), [color, overlay])
  const attentive = overlay ? Math.max(0, 1 - interaction.pokePose.irritation / .65) : 1
  const yaw = fixedFacing ? 0 : attentive * Math.round((gaze.x - 0.5) * 60) / 100
  const pitch = fixedFacing ? 0 : attentive * Math.round((baseDefinition.scene.view.pitch + (gaze.y - 0.5) * 0.3) * 100) / 100
  const definition = useMemo(() => ({
    ...baseDefinition,
    scene: {
      ...baseDefinition.scene,
      view: {
        ...baseDefinition.scene.view,
        scale: overlay ? 1.18 : 1.9,
        positionY: overlay ? baseDefinition.scene.view.positionY : 30,
        yaw,
        pitch,
      },
    },
  }), [baseDefinition, yaw, pitch, overlay])
  const reactedDefinition = useMemo(() => {
    const face = overlay ? upperCatExpression(interaction.dragging, falling, 'idle') : null
    const mood = interaction.pokePose
    const reactionFace = overlay && !interaction.dragging && !falling && interaction.reaction !== 'idle' ? {
      leftEyeWidth: 24 + 22 * mood.irritation, rightEyeWidth: 24 + 22 * mood.irritation,
      leftEyeHeight: 70 * (1 - .68 * mood.irritation - Math.min(.2, mood.pressure)),
      rightEyeHeight: 70 * (1 - .75 * mood.irritation - Math.min(.2, mood.pressure)),
      leftEyeRotation: -16 * mood.irritation, rightEyeRotation: 16 * mood.irritation,
    } : face
    return reactionFace ? { ...definition, scene: { ...definition.scene, face: { ...definition.scene.face, ...reactionFace } } } : definition
  }, [definition, overlay, interaction.dragging, falling, interaction.reaction, interaction.pokePose])
  const animatedDefinition = useMemo(() => winkTime === null ? reactedDefinition : ({
    ...reactedDefinition,
    scene: resolveAvatarAnimationFrame(reactedDefinition, winkClip, winkTime).scene,
  }), [reactedDefinition, winkTime])
  return (
    <span
      className="composer-avatar"
      data-avatar-reaction={interaction.reaction}
      data-avatar-dragging={interaction.dragging}
      data-avatar-falling={falling}
      data-avatar-landing={landing}
      data-avatar-expression={overlay ? interaction.dragging ? 'surprised' : falling ? 'dilated' : interaction.reaction : 'idle'}
      data-avatar-wink={winkTime === null ? 'idle' : 'playing'}
      data-avatar-hovered={hovered}
      data-avatar-update-mode="pose-only-30fps"
      data-avatar-color={color}
      data-composer-avatar-state={state.schemaVersion === 2 ? state.dictation : state.action}
      style={{
        display: 'block',
        position: 'absolute',
        width: diameter,
        height: diameter,
        left: overlay ? interaction.position.x : undefined,
        right: overlay ? undefined : 0,
        bottom: overlay ? -56 - interaction.position.y : 0,
        pointerEvents: 'none',
      }}
    >
      <style>
        {'@keyframes composer-cat-land{0%,100%{transform:scale(1)}28%{transform:scale(1.07,.88)}65%{transform:scale(.98,1.035)}}.composer-avatar .oneworks-avatar,.composer-avatar .oneworks-avatar *{box-sizing:border-box}.composer-avatar .oneworks-avatar>.interactive-avatar{width:100%;height:100%}'}
      </style>
      <span style={{ display: 'block', width: '100%', height: '100%',
        transformOrigin: '50% 75%',
        animation: landing ? 'composer-cat-land 340ms ease-out' : undefined,
        transform: overlay && !interaction.dragging && !falling && !state.reducedMotion ? `translate(${interaction.pokePose.direction * interaction.pokePose.irritation * 3}px, ${interaction.pokePose.irritation * 2}px) scale(${1 + interaction.pokePose.pressure * .12}, ${1 - interaction.pokePose.pressure * .18 - interaction.pokePose.irritation * .025})` : undefined,
      }}><AvatarRenderer definition={animatedDefinition} theme={state.theme} animation={deformation}
        targetTime={overlay && interaction.dragging ? 180 : 0} reducedMotion={state.reducedMotion} /></span>
    </span>
  )
}
export function AnimalVisual(props: CordisXReactVisualProps) {
  return <ComposerAvatar key="primary" {...props} overlay={false} />
}
export function GazeVisual(props: CordisXReactVisualProps) {
  return <ComposerAvatar key="overlay" {...props} overlay />
}
