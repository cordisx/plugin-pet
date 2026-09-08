import Schema from '@deepseek-ai/schemastery'
import { type PetEconomyConfig, petEconomyConnector } from './pet-economy-host.js'
import '@oneworks/avatar-react/renderer.css'
import type { Context } from '@deepseek-ai/cordis'
import { CORDISX_PLUGIN_MANIFEST_SCHEMA_V11, type CordisXPluginManifestV11 } from 'cordisx/contracts'
import { defineReactVisual } from 'cordisx/react'

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
    {
      name: 'ui.extension-points.render',
      required: true,
      scope: { extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'] },
    },
    {
      name: 'ui.extension-points.interact',
      required: false,
      scope: {
        extensionPoints: ['composer.primary-action.visual', 'composer.frame.overlay'],
        events: ['pointer.observe', 'drag', 'activate'],
      },
    },
  ],
} as const satisfies CordisXPluginManifestV11

export const Config = Schema.object({
  economyBaseUrl: Schema.string().default('').description(
    '共享经济服务地址；HTTPS 或本机回环地址。凭证由 Host 授权窗口管理。',
  ),
  migrationSourceId: Schema.string().default('pet-migration-v1').description(
    '管理员提供的永久迁移来源；迁移后不能更换。',
  ),
})
export const inject = [
  'extensionPointVisuals',
  'documents',
  'pages',
  'routes',
  'slots',
  'managerContent',
  'usage',
  'http',
]
export function apply(ctx: Context, config: PetEconomyConfig = {}): void {
  const client = new PetClient(ctx.documents, undefined, ctx.usage, undefined, petEconomyConnector(ctx.http, config))
  const navigate = installPetPages(ctx, client)
  ctx.effect(() => {
    let visuals: (() => void)[] = []
    const update = () => {
      const state = client.getSnapshot().state
      const visible = state?.settings.visible === true && state.pets.some(pet => pet.status === 'alive')
      if (visible && visuals.length === 0) {
        visuals = [
          ctx.extensionPointVisuals.register(
            {
              id: 'animal',
              pointId: 'composer.primary-action.visual',
              snapshotVersion: 2,
              events: ['pointer.observe'],
            },
            async () =>
              defineReactVisual((await import('./pet-visuals.js')).createPetPrimary(client), { kind: 'react-dom-v1' }),
          ),
          ctx.extensionPointVisuals.register({
            id: 'gaze',
            pointId: 'composer.frame.overlay',
            snapshotVersion: 2,
            events: ['pointer.observe', 'drag', 'activate'],
          }, async () =>
            defineReactVisual((await import('./pet-visuals.js')).createPetOverlay(client, navigate), {
              kind: 'react-dom-v1',
            })),
        ]
      } else if (!visible && visuals.length) {
        for (const dispose of visuals) dispose()
        visuals = []
      }
    }
    const unsubscribe = client.subscribe(update)
    update()
    return () => {
      unsubscribe()
      for (const dispose of visuals) dispose()
      client.dispose()
    }
  })
  void client.start()
}
