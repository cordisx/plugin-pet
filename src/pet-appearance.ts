import { createDefaultAvatarDefinition, DEFAULT_AVATAR_COAT_PATTERN, getAvatarPalette, type AvatarDefinition, resolveSeededAvatarView } from '@oneworks/avatar'
import { petProduct, PET_DEFAULT_SKINS, type PetSpecies } from './pet-catalog.js'
import type { PetEntity } from './pet-domain.js'
export const PET_AVATAR_SCALE = 1.08
const base = createDefaultAvatarDefinition()
const cache = new Map<string, AvatarDefinition>()
/** Immutable presets and their existing coats remain owned by Avatar. */
export function petAppearance(pet: PetEntity | PetSpecies, skinId?: string): AvatarDefinition {
  const species = typeof pet === 'string' ? pet : pet.species
  const skin = petProduct(skinId ?? (typeof pet === 'string' ? PET_DEFAULT_SKINS[species] : pet.skinId))
  const seed = `pet-${typeof pet === 'string' ? species : pet.id}`
  const key = `${species}/${skin.id}/${seed}`
  const existing = cache.get(key)
  if (existing) return existing
  const palette = getAvatarPalette(skin.paletteId ?? 'white')
  const definition: AvatarDefinition = {
    ...base,
    scene: {
      ...base.scene,
      appearance: { ...base.scene.appearance, paletteId: skin.paletteId ?? 'white',
        // Keep these procedural so Avatar projects them onto each morphed head.
        // Siamese needs its dark facial patch, without orange-tabby stripes.
        coatPattern: { ...DEFAULT_AVATAR_COAT_PATTERN, enabled: Boolean(palette.coat),
          density: palette.id === 'siamese' ? 0 : DEFAULT_AVATAR_COAT_PATTERN.density,
          seed: `pet-${palette.id}`, algorithmSeed: `pet-${palette.id}` },
      },
      camera: { ...base.scene.camera, background: 'transparent', frame: 'square', showFrameShadow: false },
      effects: { ...base.scene.effects, showAvatarShadow: false, showOutline: false, showFaceShadow: false },
      lighting: { ...base.scene.lighting, enabled: false, distance: 0 },
      face: { ...base.scene.face, width: 24, height: 70, gap: 42, mouthEnabled: false, noseEnabled: false },
      entity: { preset: species, parts: [] },
      view: { ...resolveSeededAvatarView(seed, base.scene.view), scale: PET_AVATAR_SCALE },
    },
  }
  cache.set(key, definition)
  return definition
}
