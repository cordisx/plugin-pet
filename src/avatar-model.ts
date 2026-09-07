import { type AvatarDefinition, type AvatarEntityPart, createDefaultAvatarDefinition } from '@oneworks/avatar'
import type { CordisXReactVisualProps } from 'cordisx/contracts'

type State = CordisXReactVisualProps['state']
const base = createDefaultAvatarDefinition()
// Explicit public parts let animation tracks resolve ear attachment transforms.
// The upper cat owns these anchors; the primary button keeps its built-in preset.
const fur = { baseColor: '#f7f7f4', foregroundColor: '#050608', highlightColor: '#ffffff', shadowColor: '#e8e8e5' }
const upperCatParts: AvatarEntityPart[] = [
  { ...fur, id: 'cat-ear-left', label: 'Left ear', face: false, occludedByFace: true, shape: 'cone', x: -56, y: -78, z: -8, scaleX: .24, scaleY: .29, rotationX: -7, rotationY: -13, rotationZ: -9, roundness: 48 },
  { ...fur, id: 'cat-ear-right', label: 'Right ear', face: false, occludedByFace: true, shape: 'cone', x: 56, y: -78, z: -10, scaleX: .23, scaleY: .28, rotationX: -6, rotationY: 13, rotationZ: 9, roundness: 52 },
  { ...fur, id: 'cat-head', label: 'Head', face: true, shape: 'ellipse', x: 0, y: 12, z: 0, scaleX: .73, scaleY: .68 },
]
const colors = {
  voice: '#7c3aed',
  send: '#16a34a',
  stop: '#dc2626',
  cancel: '#ea580c',
  queue: '#0891b2',
  steer: '#2563eb',
  resume: '#16a34a',
  'end-voice': '#be123c',
}
export function avatarColor(state: State, overlay: boolean): string {
  if (!overlay) return !state.enabled ? '#737373' : state.busy ? '#d97706' : colors[state.action]
  const dictation = state.schemaVersion === 2 ? state.dictation : 'unavailable'
  if (dictation === 'recording') return '#dc2626'
  if (dictation === 'transcribing' || dictation === 'starting') return '#d97706'
  return state.theme === 'dark' ? '#94a3b8' : '#475569'
}
/** A real Avatar definition owned by this plugin, independent of Host layout. */
export function composerAvatarDefinition(_color: string, x: number, y: number, overlay = false): AvatarDefinition {
  return {
    ...base,
    scene: {
      ...base.scene,
      appearance: { ...base.scene.appearance, paletteId: 'white' },
      // Public lighting opts implicit preset parts into the morphable renderer.
      lighting: { ...base.scene.lighting, enabled: overlay, distance: 0 },
      camera: { ...base.scene.camera, background: 'transparent', frame: 'square', showFrameShadow: false },
      effects: {
        ...base.scene.effects,
        showAvatarShadow: false,
        showOutline: false,
        showFaceShadow: false,

      },
      face: { ...base.scene.face, width: 24, height: 70, gap: 42, mouthEnabled: false, noseEnabled: false },
      entity: { preset: 'cat', parts: overlay ? upperCatParts : [] },
      view: { ...base.scene.view, scale: 1.18, pitch: (overlay ? -0.28 : 0) + (y - 0.5) * 0.3, yaw: (x - 0.5) * 0.6 },
    },
  }
}
