import { useEffect, useState } from 'cordisx/react'
import type { CordisXReactVisualProps } from 'cordisx/contracts'

const colors = { voice: '#7c3aed', send: '#16a34a', stop: '#dc2626', cancel: '#ea580c', queue: '#0891b2', steer: '#2563eb', resume: '#16a34a', 'end-voice': '#be123c' }
function Eyes({ state }: CordisXReactVisualProps) {
  const [lastPointer, setLastPointer] = useState({ x: 0.5, y: 0.5 })
  const x = state.pointer?.x
  const y = state.pointer?.y
  useEffect(() => {
    if (x !== undefined && y !== undefined) setLastPointer({ x, y })
  }, [x, y])
  const pointer = state.pointer ?? lastPointer
  const dx = (pointer.x - 0.5) * 5
  const dy = (pointer.y - 0.5) * 5
  return <g style={{ transform: `translate(${dx}px, ${dy}px)`, transition: state.reducedMotion ? 'none' : 'transform 160ms ease-out' }}>
    <rect x="-7" y="-5" width="4" height="10" rx="2" fill="white" />
    <rect x="3" y="-5" width="4" height="10" rx="2" fill="white" />
  </g>
}
export function AnimalVisual({ state }: CordisXReactVisualProps) {
  const color = !state.enabled ? '#737373' : state.busy ? '#d97706' : colors[state.action]
  return <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill={color} />
    <g transform="translate(20 20)"><Eyes state={state} /></g>
  </svg>
}
export function GazeVisual({ state }: CordisXReactVisualProps) {
  const dictation = state.schemaVersion === 2 ? state.dictation : 'unavailable'
  const dictationColor = dictation === 'recording' ? '#dc2626'
    : dictation === 'transcribing' || dictation === 'starting' ? '#d97706' : undefined
  const diameter = Math.min(128, state.bounds.width)
  const radius = diameter / 2
  return <svg viewBox={`0 0 ${state.bounds.width} ${state.bounds.height}`} width="100%" height="100%" aria-hidden="true">
    <g transform={`translate(${state.bounds.width - radius - 40} ${state.bounds.height - radius + 56})`}>
      <circle cx="0" cy="0" r={radius} fill={dictationColor ?? (state.theme === 'dark' ? '#d4d4d4' : '#475569')} />
      <g transform={`translate(0 ${-diameter / 8}) scale(${diameter / 40})`}><Eyes state={state} /></g>
    </g>
  </svg>
}
