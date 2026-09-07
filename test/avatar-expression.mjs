import assert from 'node:assert/strict'
import test from 'node:test'
import { upperCatExpression } from '../src/avatar-expression.ts'

test('lift and fall override click reactions, then return to the base face on landing', () => {
  const lifted = upperCatExpression(true, false, 'angry')
  assert.notEqual(lifted.leftEyeHeight, lifted.rightEyeHeight)
  assert.equal(lifted.leftEyeRotation, 0)
  assert.equal(lifted.leftEyeWidth, lifted.leftEyeHeight)
  assert.equal(lifted.rightEyeWidth, lifted.rightEyeHeight)
  const falling = upperCatExpression(false, true, 'closed')
  assert.equal(falling.leftEyeWidth, falling.rightEyeWidth)
  assert.ok(falling.leftEyeWidth > lifted.leftEyeWidth)
  assert.ok(falling.leftEyeHeight > 70)
  assert.equal(falling.leftEyeWidth, falling.leftEyeHeight)
  assert.equal(falling.rightEyeWidth, falling.rightEyeHeight)
  assert.equal(upperCatExpression(false, false, 'idle'), null)
  assert.equal(Object.hasOwn(falling, 'mouthEnabled'), false)
})
