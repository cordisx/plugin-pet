import { decayIrritation } from './avatar-motion.js'
import { useEffect, useRef, useState } from 'cordisx/react'

export interface PokePose { irritation: number; pressure: number; direction: number }
const resting: PokePose = { irritation: 0, pressure: 0, direction: 0 }
export function usePokeResponse(reducedMotion: boolean) {
  const [pose, setPose] = useState(resting)
  const live = useRef({ ...resting, energy: 0, velocity: 0, lastPoke: -Infinity, previous: 0 })
  const frame = useRef<number | undefined>(undefined)
  const reduced = useRef(reducedMotion)
  reduced.current = reducedMotion
  const cancel = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    live.current = { ...resting, energy: 0, velocity: 0, lastPoke: -Infinity, previous: 0 }
    setPose(resting)
  }
  const poke = (direction: number) => {
    const now = performance.now(), current = live.current
    current.energy = Math.min(1, decayIrritation(current.energy, now - current.lastPoke) + .3)
    current.lastPoke = now
    current.direction = direction
    // Add a small impulse to the current spring; repeated clicks never rewind it.
    current.velocity = Math.min(9, current.velocity + 6 * (1 - current.energy * .8))
    if (frame.current !== undefined) return
    current.previous = now
    let rendered = -Infinity
    const tick = (time: number) => {
      const dt = Math.min(32, time - current.previous) / 1000
      current.previous = time
      const target = current.energy * Math.exp(-Math.max(0, time - current.lastPoke - 550) / 1000)
      current.irritation += (target - current.irritation) * (1 - Math.exp(-dt / .13))
      current.velocity += (-150 * current.pressure - 20 * current.velocity) * dt
      current.pressure += current.velocity * dt
      const settled = time - current.lastPoke > 700 && current.irritation < .008 && Math.abs(current.pressure) < .002
      if (settled) { cancel(); return }
      if (time - rendered >= 32) {
        rendered = time
        setPose({ irritation: current.irritation, pressure: reduced.current ? 0 : current.pressure, direction: current.direction })
      }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current) }, [])
  return { pose, poke, cancel }
}
