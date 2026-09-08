import { PET_SPECIES, PET_SPECIES_IDS, type PetSpecies } from './pet-species.js'
import type { PetProduct } from './pet-catalog.js'
export type PetAttributes = { intelligence: number; luck: number; metabolism: number; absorption: number; talent: 'none' | 'double-nutrition' }
export function petSeed(seed: string): number { let value = 2166136261; for (const c of seed) value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0; return value }
export function initialPetAttributes(id: string): PetAttributes {
  const n = petSeed(`attributes:${id}`)
  return { intelligence: 30 + n % 61, luck: 20 + (n >>> 7) % 71, metabolism: .85 + ((n >>> 14) % 7) * .05, absorption: .9 + ((n >>> 19) % 5) * .05, talent: n % 5 === 0 ? 'double-nutrition' : 'none' }
}
export const PET_SPECIES_METABOLISM: Record<PetSpecies, number> = Object.fromEntries(PET_SPECIES_IDS.map(species => [species, PET_SPECIES[species].metabolism])) as Record<PetSpecies, number>
export function foodEffect(pet: { care: { weight: number }; attributes: PetAttributes }, food: PetProduct) {
  // Catalog nutrition is calibrated to a 4 kg animal. A larger body needs more food.
  const factor = 4 / pet.care.weight * pet.attributes.absorption * (pet.attributes.talent === 'double-nutrition' ? 2 : 1)
  return { fullness: (food.fullness ?? 0) * factor, energy: food.energy ?? 0, mood: food.mood ?? 0, affinity: food.affinity ?? 0 }
}
