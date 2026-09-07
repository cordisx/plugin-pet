import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAvatarAnimationFrame } from '@oneworks/avatar'
import { composerAvatarDefinition } from '../src/avatar-model.ts'
import { isAvatarHovered, winkClip } from '../src/avatar-wink.ts'

test('Wink closes one eye and restores it without changing the pose or adding a mouth', () => {
  const definition = composerAvatarDefinition('#475569', 1, 0)
  for (const [time, height] of [[0, 70], [240, 4], [600, 70]]) {
    const { scene } = resolveAvatarAnimationFrame(definition, winkClip, time)
    assert.equal(scene.face.leftEyeHeight, height)
    assert.equal(scene.face.mouthEnabled, false)
    assert.equal(scene.face.rightEyeHeight, definition.scene.face.rightEyeHeight)
    assert.deepEqual(scene.view, definition.scene.view)
  }
})
test('hover is limited to the primary seat or the visible overlay avatar', () => {
  const state = { bounds: { width: 600, height: 128 }, pointer: { inside: true, x: .8, y: .8 } }
  assert.equal(isAvatarHovered(state, true), true)
  assert.equal(isAvatarHovered({ ...state, pointer: { inside: true, x: .1, y: .8 } }, true), false)
  assert.equal(isAvatarHovered({ ...state, pointer: { inside: true, x: .8, y: .1 } }, true), false)
  assert.equal(isAvatarHovered(state, false), true)
  assert.equal(isAvatarHovered({ ...state, pointer: { inside: false, x: 1, y: 1 } }, false), false)
  assert.equal(isAvatarHovered({ ...state, pointer: null }, false), false)
})
