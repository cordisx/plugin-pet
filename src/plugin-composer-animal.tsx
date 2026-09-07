import type { Context } from '@deepseek-ai/cordis'
import { defineReactVisual } from 'cordisx/react'
import { CORDISX_PLUGIN_MANIFEST_SCHEMA_V10, type CordisXPluginManifestV10 } from 'cordisx/contracts'

export const manifest = {
  $schema: CORDISX_PLUGIN_MANIFEST_SCHEMA_V10,
  schemaVersion: 10,
  id: 'plugin-composer-animal',
  name: 'pet',
  services: [],
  capabilities: [
    { name: 'ui.extension-points.render', required: true, scope: { extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'] } },
    { name: 'ui.extension-points.interact', required: false, scope: { extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'], events: ['pointer.observe', 'drag', 'activate'] } },
  ],
} as const satisfies CordisXPluginManifestV10

export const inject = ['extensionPointVisuals']
export function apply(ctx: Context): void {
  ctx.extensionPointVisuals.register({ id: 'animal', pointId: 'composer.primary-action.visual', events: ['pointer.observe'] },
    async () => defineReactVisual((await import('./avatar-visual.js')).AnimalVisual, { kind: 'react-dom-v1' }))
  ctx.extensionPointVisuals.register({ id: 'gaze', pointId: 'composer.frame.overlay', snapshotVersion: 2, events: ['pointer.observe', 'drag', 'activate'] },
    async () => defineReactVisual((await import('./avatar-visual.js')).GazeVisual, { kind: 'react-dom-v1' }))
}
