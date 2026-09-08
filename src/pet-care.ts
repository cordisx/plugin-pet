import { PET_SPECIES, PET_SPECIES_IDS, type PetSpecies } from './pet-species.js'
import { PET_SPECIES_METABOLISM, type PetAttributes } from './pet-attributes.js'
import { PET_PERSONALITIES, type PetTraits } from './pet-traits.js'
export type PetLifeStatus = 'alive' | 'dead' | 'buried'
export type PetCare = { fullness: number; hydration: number; mood: number; lowHydrationMs: number; energy: number; health: number; lowFullnessMs: number; weight: number }
export const PET_CARE = {
  initialHydration: 100, initialMood: 80, hydrationPerHour: 8, lowHydrationThreshold: 20, lowHydrationGraceMs: 3600000, thirstHealthLossPerHour: 6,
  initialFullness: 80, initialEnergy: 100, initialHealth: 100,
  fullnessPerHour: 6, lowFullnessThreshold: 20, lowFullnessGraceMs: 60 * 60 * 1000,
  healthLossPerHour: 4, healthRecoveryPerHour: 2, energyLossPerHour: 8, restingEnergyPerHour: 20,
  pulseLimitMs: 65_000, revivedFullness: 80, revivedEnergy: 80, revivedHealth: 80,
} as const
export const PET_BASE_WEIGHT: Record<PetSpecies, number> = Object.fromEntries(PET_SPECIES_IDS.map(species => [species, PET_SPECIES[species].weight])) as Record<PetSpecies, number>
export function initialPetCare(species: keyof typeof PET_BASE_WEIGHT = 'cat'): PetCare {
  return { hydration: PET_CARE.initialHydration, mood: PET_CARE.initialMood, lowHydrationMs: 0, fullness: PET_CARE.initialFullness, energy: PET_CARE.initialEnergy, health: PET_CARE.initialHealth, lowFullnessMs: 0, weight: PET_BASE_WEIGHT[species] }
}
const HOUR = 3_600_000
const clamp = (value: number) => Math.min(100, Math.max(0, value))
/** Pure elapsed-online simulation. The caller owns the online clock and deduplication. */
export function advancePetCare<T extends { status: PetLifeStatus; care: PetCare; species: keyof typeof PET_BASE_WEIGHT; traits?: PetTraits; attributes?: PetAttributes }>(pet: T, elapsedMs: number, options: { resting?: boolean } = {}): T {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('照顾时长无效')
  if (pet.status !== 'alive' || elapsedMs === 0) return { ...pet, care: { ...pet.care } }
  const start = pet.care
  // Fixed individual metabolism keeps simulation independent of pulse size; food uses actual body mass.
  const hungerRate = PET_CARE.fullnessPerHour * (pet.attributes?.metabolism ?? 1) * PET_SPECIES_METABOLISM[pet.species] / (pet.traits?.hungerResistance ?? 1)
  const thirstRate = PET_CARE.hydrationPerHour / (pet.traits?.thirstResistance ?? 1)
  const fedMs = Math.max(0, (start.fullness - PET_CARE.lowFullnessThreshold) / hungerRate * HOUR)
  const wateredMs = Math.max(0, (start.hydration - PET_CARE.lowHydrationThreshold) / thirstRate * HOUR)
  const priorHunger = start.fullness <= PET_CARE.lowFullnessThreshold ? start.lowFullnessMs : 0
  const priorThirst = start.hydration <= PET_CARE.lowHydrationThreshold ? start.lowHydrationMs : 0
  const hungerDamageAt = fedMs + Math.max(0, PET_CARE.lowFullnessGraceMs - priorHunger)
  const thirstDamageAt = wateredMs + Math.max(0, PET_CARE.lowHydrationGraceMs - priorThirst)
  const boundaries = [...new Set([0, elapsedMs, fedMs, wateredMs, hungerDamageAt, thirstDamageAt].filter(time => time >= 0 && time <= elapsedMs))].sort((a,b) => a-b)
  let health = start.health, livedMs = 0
  for (let i=1; i<boundaries.length; i++) {
    const from = boundaries[i-1]!, duration = boundaries[i]! - from
    const loss = (from >= hungerDamageAt ? PET_CARE.healthLossPerHour : 0) + (from >= thirstDamageAt ? PET_CARE.thirstHealthLossPerHour : 0)
    const rate = loss ? -loss : from < fedMs && from < wateredMs ? PET_CARE.healthRecoveryPerHour : 0
    if (rate < 0 && health + duration / HOUR * rate <= 0) { livedMs = from + health / -rate * HOUR; health = 0; break }
    health = clamp(health + duration / HOUR * rate)
    livedMs = boundaries[i]!
  }
  const lowHungerMs = Math.max(0,livedMs-fedMs), lowThirstMs = Math.max(0,livedMs-wateredMs)
  const baseWeight = PET_BASE_WEIGHT[pet.species]
  const overfullMs = Math.min(livedMs, Math.max(0,(start.fullness-90)/hungerRate*HOUR))
  const personality = pet.traits ? PET_PERSONALITIES[pet.traits.personality] : PET_PERSONALITIES.easygoing
  return { ...pet, status: health <= 0 ? 'dead' : 'alive', care: {
    fullness: clamp(start.fullness-livedMs/HOUR*hungerRate), hydration: clamp(start.hydration-livedMs/HOUR*thirstRate),
    energy: clamp(start.energy+livedMs/HOUR*(options.resting ? PET_CARE.restingEnergyPerHour : -PET_CARE.energyLossPerHour)),
    mood: clamp(start.mood-livedMs/HOUR*2*personality.moodDecay-(lowHungerMs+lowThirstMs)/HOUR*3),
    health, weight: Math.max(baseWeight*.65,Math.min(baseWeight*1.5,start.weight+baseWeight*.005*overfullMs/HOUR)-baseWeight*.01*lowHungerMs/HOUR),
    lowFullnessMs: lowHungerMs > 0 ? priorHunger+lowHungerMs : 0, lowHydrationMs: lowThirstMs > 0 ? priorThirst+lowThirstMs : 0,
  } }
}
export function careWarning(care: PetCare): string {
  if (care.health <= 0) return '生命体征已停止'
  if (care.hydration < PET_CARE.lowHydrationThreshold) return care.lowHydrationMs >= PET_CARE.lowHydrationGraceMs ? '持续缺水正在影响健康，请及时补水' : '有些口渴，请补充清水'
  if (care.fullness < PET_CARE.lowFullnessThreshold) {
    const remaining = Math.max(0, PET_CARE.lowFullnessGraceMs - care.lowFullnessMs)
    return remaining > 0 ? `饱食度过低，约 ${Math.ceil(remaining / 60_000)} 分钟在线时间后健康开始下降` : '持续饥饿正在影响健康，请及时补充食物'
  }
  if (care.mood < 30) return '心情低落，陪它玩一会儿吧'
  return care.energy < 20 ? '精力不足，休息时会逐渐恢复' : '状态良好'
}

export function petWeightScale(pet: { species: keyof typeof PET_BASE_WEIGHT; care: PetCare }): number {
  return Math.max(.85, Math.min(1.18, Math.sqrt(pet.care.weight / PET_BASE_WEIGHT[pet.species])))
}
export function petWeightLabel(pet: { species: keyof typeof PET_BASE_WEIGHT; care: PetCare }): string {
  const ratio = pet.care.weight / PET_BASE_WEIGHT[pet.species]
  return ratio < .85 ? '偏瘦' : ratio > 1.15 ? '偏重' : '正常'
}
