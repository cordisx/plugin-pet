import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAvatarDefinition } from '@oneworks/avatar'
import { avatarColor, composerAvatarDefinition } from '../src/avatar-model.ts'

test('real Avatar definition uses the built-in cat, transparent background and mouthless face across gaze targets', () => {
  for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 1]]) {
    const { scene } = parseAvatarDefinition(composerAvatarDefinition('#475569', x, y))
    assert.equal(scene.camera.background, 'transparent')
    assert.equal(scene.entity.preset, 'cat')
    assert.equal(scene.entity.parts.length, 0)
    assert.equal(scene.appearance.paletteId, 'white')
    assert.equal(scene.face.mouthEnabled, false)
    assert.equal(scene.face.noseEnabled, false)
    assert.equal(scene.face.eyeShape, 'rounded')
    assert.ok(scene.face.height > scene.face.width)
    assert.ok(Math.abs(scene.view.yaw) <= 0.3)
  }
})
test('dictation changes the large avatar independently of native primary semantics', () => {
  const state = { schemaVersion: 2, theme: 'light', enabled: true, busy: false, action: 'send', dictation: 'recording' }
  assert.equal(avatarColor(state, true), '#dc2626')
  assert.equal(avatarColor(state, false), '#16a34a')
  assert.equal(avatarColor({ ...state, dictation: 'transcribing' }, true), '#d97706')
  assert.equal(avatarColor({ ...state, dictation: 'idle' }, true), '#475569')
})
