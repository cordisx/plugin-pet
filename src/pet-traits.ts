export type PetPersonality = 'easygoing' | 'playful' | 'independent'
export type PetTraits = { personality: PetPersonality; hungerResistance: number; thirstResistance: number; cheerfulness: number }
export const PET_PERSONALITIES: Record<PetPersonality, { name: string; description: string; moodDecay: number; playGain: number }> = {
  easygoing: { name: '随和', description: '容易满足，心情更稳定', moodDecay: .75, playGain: 1 },
  playful: { name: '活泼', description: '喜欢陪玩，互动更容易开心', moodDecay: 1.1, playGain: 1.4 },
  independent: { name: '独立', description: '自己待着也自在，心情消耗较慢', moodDecay: .55, playGain: .8 },
}
/** Stable individual traits; migration and reload never reroll a companion. */
export function initialPetTraits(id: string): PetTraits {
  let seed = 2166136261
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  return { personality: (['easygoing', 'playful', 'independent'] as const)[seed % 3]!, hungerResistance: 1 + (seed % 4) * .1, thirstResistance: 1 + ((seed >>> 4) % 4) * .1, cheerfulness: 1 + ((seed >>> 8) % 4) * .1 }
}
