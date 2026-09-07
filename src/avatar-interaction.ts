import { usePokeResponse } from './avatar-poke.js'
import { useEffect, useRef, useState } from 'cordisx/react'
import type { CordisXReactVisualProps } from 'cordisx/contracts'
import { clampAvatarPosition, fallStep, type AvatarPosition } from './avatar-motion.js'

export function useAvatarInteraction({ state, drag }: CordisXReactVisualProps, overlay: boolean) {
  const { width, height } = state.bounds
  const [position, setPosition] = useState<AvatarPosition>(() => ({ x: Math.max(0, width - 168), y: 0 }))
  const positionRef = useRef(position)
  const options = useRef({ width, height, reducedMotion: state.reducedMotion })
  options.current = { width, height, reducedMotion: state.reducedMotion }
  const [dragging, setDragging] = useState(false)
  const response = usePokeResponse(state.reducedMotion)
  const responseRef = useRef(response)
  responseRef.current = response
  const pointerRef = useRef(state.pointer)
  pointerRef.current = state.pointer
  const frame = useRef<number | undefined>(undefined)
  useEffect(() => {
    // Every handle is a new interaction lifetime. Revocation/replacement must
    // discard the previous emotion and its animation loop.
    responseRef.current.cancel()
    setDragging(false)
    positionRef.current = { ...positionRef.current, y: 0 }
    setPosition(positionRef.current)
    if (!overlay || !drag) return
    let moved = false
    let start = positionRef.current
    let sequence = drag.getSnapshot().sequence
    const stop = () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      frame.current = undefined
    }
    const update = (next: AvatarPosition) => {
      positionRef.current = clampAvatarPosition(next, options.current.width, options.current.height)
      setPosition(positionRef.current)
    }
    const fall = () => {
      stop()
      if (options.current.reducedMotion) { update({ ...positionRef.current, y: 0 }); return }
      let velocity = 0
      let previous = performance.now()
      const tick = (now: number) => {
        const step = fallStep(positionRef.current, velocity, now - previous)
        previous = now
        velocity = step.velocity
        update(options.current.reducedMotion ? { ...step.position, y: 0 } : step.position)
        if (!step.settled && !options.current.reducedMotion) frame.current = requestAnimationFrame(tick)
        else frame.current = undefined
      }
      frame.current = requestAnimationFrame(tick)
    }
    const unsubscribe = drag.subscribe(() => {
      const snapshot = drag.getSnapshot()
      if (sequence === snapshot.sequence) return
      sequence = snapshot.sequence
      if (snapshot.phase === 'activate') {
        setDragging(false)
        fall()
        const pointerX = pointerRef.current?.x
        const offset = pointerX === undefined ? 0 : pointerX * options.current.width - positionRef.current.x - 64
        responseRef.current.poke(Math.max(-1, Math.min(1, -offset / 44)))
      } else if (snapshot.phase === 'start') {
        stop()
        start = positionRef.current
        // Pointer-down is shared by clicks and drags. Wait for the Host's
        // threshold-qualified movement before entering the drag presentation.
        moved = false
      } else if (snapshot.phase === 'move' || snapshot.phase === 'end') {
        if (!moved && (snapshot.phase === 'move' || snapshot.deltaX !== 0 || snapshot.deltaY !== 0)) {
          moved = true
          responseRef.current.cancel()
        }
        if (snapshot.phase === 'move') setDragging(true)
        update({ x: start.x + snapshot.deltaX, y: start.y + snapshot.deltaY })
        if (snapshot.phase === 'end') { setDragging(false); fall() }
      } else if (snapshot.phase === 'cancel') {
        setDragging(false)
        fall()
      }
    })
    return () => { unsubscribe(); stop(); responseRef.current.cancel(); drag.setRegion(null) }
  }, [drag, overlay])
  useEffect(() => {
    const next = clampAvatarPosition(positionRef.current, width, height)
    positionRef.current = next
    setPosition(next)
  }, [width, height])
  useEffect(() => {
    if (!overlay || !drag) return
    const diameter = Math.min(128, width)
    // The public hit region covers the head, rather than the empty transparent canvas.
    const inset = diameter * .16
    drag.setRegion({ x: position.x + inset, y: height + 56 - diameter + position.y + diameter * .18,
      width: diameter - inset * 2, height: diameter * .68, label: 'Move cat; click to play' })
  }, [drag, overlay, position.x, position.y, width, height])
  const { irritation, pressure } = response.pose
  const reaction = irritation > .62 ? 'annoyed' : irritation > .34 ? 'withdraw' : irritation > .008 || pressure > .002 ? 'poke' : 'idle'
  return { position, dragging, reaction, pokePose: response.pose }
}
