import { createDefaultAvatarDefinition, DEFAULT_AVATAR_COAT_PATTERN, getAvatarPalette, type AvatarDefinition, type AvatarEntityPart } from '@oneworks/avatar'
import { petProduct, PET_DEFAULT_SKINS, type PetSpecies } from './pet-catalog.js'
import type { PetEntity } from './pet-domain.js'
const base = createDefaultAvatarDefinition()
const cache = new Map<string, AvatarDefinition>()
/** Immutable presets and their existing coats remain owned by Avatar. */
export function petAppearance(pet: PetEntity | PetSpecies, skinId?: string): AvatarDefinition {
  const species = typeof pet === 'string' ? pet : pet.species
  const skin = petProduct(skinId ?? (typeof pet === 'string' ? PET_DEFAULT_SKINS[species] : pet.skinId))
  const key = `${species}/${skin.id}`
  const existing = cache.get(key)
  if (existing) return existing
  const palette = getAvatarPalette(skin.paletteId ?? 'white')
  const fur = { baseColor: palette.background, foregroundColor: palette.foreground, highlightColor: palette.gradient[1], shadowColor: palette.shadow }
  // Pet-owned controllable head shapes; Avatar owns coat projection and morphing.
  const head: AvatarEntityPart = { ...fur, ...(palette.entityMaterials?.primary ?? palette.entityMaterials?.[`${species}-head`]),
    id: 'primary', label: 'Head', face: true, shape: species === 'dog' ? 'rounded' : 'ellipse',
    x: 0, y: 12, z: 0, scaleX: species === 'dog' ? .76 : .73, scaleY: .68 }
  const parts: AvatarEntityPart[] = [-1, 1].map(side => {
    const id = side < 0 ? 'ear-left' : 'ear-right'
    const shape = species === 'cat' ? 'cone' : 'ellipse'
    return { ...fur, ...(palette.entityMaterials?.[id] ?? palette.entityMaterials?.[`${species}-${id}`]), id, label: 'Ear', face: false, occludedByFace: true,
      shape, x: side * (species === 'rabbit' ? 43 : species === 'dog' ? 73 : 56),
      y: species === 'rabbit' ? -94 : species === 'dog' ? -22 : -78, z: -8,
      scaleX: species === 'rabbit' ? .17 : .24, scaleY: species === 'rabbit' ? .48 : species === 'dog' ? .43 : .29,
      rotationZ: side * (species === 'dog' ? -12 : 9), roundness: species === 'dog' ? 70 : 48 }
  })
  parts.push(head)
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
      entity: { preset: species, parts },
      view: { ...base.scene.view, scale: 1.18, yaw: 0, pitch: -.28 },
    },
  }
  cache.set(key, definition)
  return definition
}
