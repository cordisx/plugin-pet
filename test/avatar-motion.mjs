import assert from 'node:assert/strict'
import test from 'node:test'
import { decayIrritation, clampAvatarPosition, fallStep, reactionForClicks } from '../src/avatar-motion.ts'

test('lift and resize remain inside the available canvas and resting baseline', () => {
  assert.deepEqual(clampAvatarPosition({ x: 800, y: -900 }, 600, 300), { x: 472, y: -228 })
  assert.deepEqual(clampAvatarPosition({ x: -8, y: 40 }, 64, 128), { x: 0, y: 0 })
  assert.deepEqual(clampAvatarPosition({ x: 380, y: -100 }, 250, 128), { x: 122, y: -56 })
})
test('fall accelerates, lands exactly, and preserves horizontal placement', () => {
  let position = { x: 203, y: -200 }
  let velocity = 0
  let settled = false
  const first = fallStep(position, velocity, 16)
  const second = fallStep(first.position, first.velocity, 16)
  assert.ok(second.velocity > first.velocity)
  assert.ok(second.position.y - first.position.y > first.position.y - position.y)
  for (let i = 0; i < 100 && !settled; i++) ({ position, velocity, settled } = fallStep(position, velocity, 16))
  assert.deepEqual(position, { x: 203, y: 0 })
  assert.equal(settled, true)
  assert.equal(velocity, 0)
})
test('click progression moves from tremble through closed eyes to annoyed', () => {
  assert.deepEqual([1, 2, 3, 5, 6, 12].map(reactionForClicks), ['tremble', 'tremble', 'closed', 'closed', 'angry', 'angry'])
})

test('disturbance accumulates for rapid pokes and fades between slow pokes', () => {
  const burst = Array.from({length: 6}).reduce(value => Math.min(1, decayIrritation(value, 180) + .3), 0)
  const slow = Array.from({length: 6}).reduce(value => Math.min(1, decayIrritation(value, 2200) + .3), 0)
  assert.ok(burst > .8)
  assert.ok(slow < .34)
  assert.ok(decayIrritation(burst, 5000) < .008)
})
