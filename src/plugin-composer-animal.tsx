import '@oneworks/avatar-react/renderer.css'
import type { Context } from '@deepseek-ai/cordis'
import { defineReactVisual } from 'cordisx/react'
import { CORDISX_PLUGIN_MANIFEST_SCHEMA_V11, type CordisXPluginManifestV11 } from 'cordisx/contracts'

import { PetClient } from './pet-client.js'
import { installPetPages } from './pet-navigation.js'

export const manifest = {
  $schema: CORDISX_PLUGIN_MANIFEST_SCHEMA_V11,
  schemaVersion: 11,
  id: 'plugin-composer-animal',
  name: 'pet',
  services: [],
  capabilities: [
    { name: 'usage.read', required: false, scope: { profile: 'current' } },
    { name: 'ui.extension-points.render', required: true, scope: { extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'] } },
    { name: 'ui.extension-points.interact', required: false, scope: { extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'], events: ['pointer.observe', 'drag', 'activate'] } },
  ],
} as const satisfies CordisXPluginManifestV11

export const inject = ['extensionPointVisuals', 'documents', 'pages', 'routes', 'slots', 'managerContent', 'usage']
export function apply(ctx: Context): void {
  const client = new PetClient(ctx.documents, undefined, ctx.usage)
  const navigate = installPetPages(ctx, client)
  ctx.effect(() => {
    let visuals: (() => void)[] = []
    const update = () => {
      const state = client.getSnapshot().state
      const visible = state?.settings.visible === true && state.pets.some(pet => pet.status === 'alive')
      if (visible && visuals.length === 0) visuals = [
        ctx.extensionPointVisuals.register({ id: 'animal', pointId: 'composer.primary-action.visual', snapshotVersion: 2, events: ['pointer.observe'] },
          async () => defineReactVisual((await import('./pet-visuals.js')).createPetPrimary(client), { kind: 'react-dom-v1' })),
        ctx.extensionPointVisuals.register({ id: 'gaze', pointId: 'composer.frame.overlay', snapshotVersion: 2, events: ['pointer.observe', 'drag', 'activate'] },
          async () => defineReactVisual((await import('./pet-visuals.js')).createPetOverlay(client, navigate), { kind: 'react-dom-v1' })),
      ]
      else if (!visible && visuals.length) { for (const dispose of visuals) dispose(); visuals = [] }
    }
    const unsubscribe = client.subscribe(update)
    update()
    return () => { unsubscribe(); for (const dispose of visuals) dispose(); client.dispose() }
  })
  void client.start()
}
