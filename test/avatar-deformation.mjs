import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAvatarAnimationFrame, resolveAvatarAnimationTimelineFrame } from '@oneworks/avatar'
import { composerAvatarDefinition } from '../src/avatar-model.ts'
import { advanceDeformationTime, liftedCatClip, liftedCatTimeline } from '../src/avatar-deformation.ts'

test('lift uses a partial true teardrop morph and release restores the original head', () => {
  const definition = composerAvatarDefinition('', .5, .5, true)
  const lifted = resolveAvatarAnimationFrame(definition, liftedCatClip, 180)
  assert.deepEqual(lifted.partShapeMorphs, { 'cat-head': { fromShape: 'ellipse', toShape: 'teardrop', progress: .22 } })
  const restored = resolveAvatarAnimationTimelineFrame(definition, liftedCatTimeline, 0)
  assert.equal(restored.partShapeMorphs['cat-head'].progress, 0)
  assert.equal(lifted.scene.entity.parts.find(part => part.id === 'cat-ear-left').y, -68)
  assert.equal(definition.scene.lighting.enabled, true)
  assert.equal(definition.scene.lighting.distance, 0)
})

test('quick release reverses from the current morph sample without jumping to full stretch', () => {
  const lifted = advanceDeformationTime(0, 180, 24)
  assert.equal(lifted, 24)
  const released = advanceDeformationTime(lifted, 0, 8)
  assert.equal(released, 16)
  assert.equal(advanceDeformationTime(released, 180, 8), 24)
  assert.equal(advanceDeformationTime(4, 0, 16), 0)
})

test('timeline moves both ear roots continuously with the head and restores their anchors', () => {
  const definition = composerAvatarDefinition('', .5, .5, true)
  const frames = [0, 90, 180].map(t => resolveAvatarAnimationTimelineFrame(definition, liftedCatTimeline, t))
  assert.deepEqual(frames.map(f => f.scene.entity.parts.find(p => p.id === 'cat-ear-left').y), [-78, -73, -68])
  assert.deepEqual(frames.map(f => f.scene.entity.parts.find(p => p.id === 'cat-ear-right').x), [56, 53, 50])
  assert.equal(frames[2].partTransforms['cat-ear-left'].y, -68)
})
