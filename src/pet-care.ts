export type PetLifeStatus = 'alive' | 'dead' | 'buried'
export type PetCare = { fullness: number; energy: number; health: number; lowFullnessMs: number; weight: number }
export const PET_CARE = {
  initialFullness: 80, initialEnergy: 100, initialHealth: 100,
  fullnessPerHour: 6, lowFullnessThreshold: 20, lowFullnessGraceMs: 60 * 60 * 1000,
  healthLossPerHour: 4, healthRecoveryPerHour: 2, energyLossPerHour: 8, restingEnergyPerHour: 20,
  pulseLimitMs: 65_000, revivedFullness: 80, revivedEnergy: 80, revivedHealth: 80,
} as const
export const PET_BASE_WEIGHT = { cat: 4, dog: 8, rabbit: 2 } as const
export function initialPetCare(species: keyof typeof PET_BASE_WEIGHT = 'cat'): PetCare {
  return { fullness: PET_CARE.initialFullness, energy: PET_CARE.initialEnergy, health: PET_CARE.initialHealth, lowFullnessMs: 0, weight: PET_BASE_WEIGHT[species] }
}
const HOUR = 3_600_000
const clamp = (value: number) => Math.min(100, Math.max(0, value))
/** Pure elapsed-online simulation. The caller owns the online clock and deduplication. */
export function advancePetCare<T extends { status: PetLifeStatus; care: PetCare; species: keyof typeof PET_BASE_WEIGHT }>(pet: T, elapsedMs: number, options: { resting?: boolean } = {}): T {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('照顾时长无效')
  if (pet.status !== 'alive' || elapsedMs === 0) return { ...pet, care: { ...pet.care } }
  const start = pet.care
  const healthyMs = Math.min(elapsedMs, Math.max(0, (start.fullness - PET_CARE.lowFullnessThreshold) / PET_CARE.fullnessPerHour * HOUR))
  const lowMs = elapsedMs - healthyMs
  const priorLow = start.fullness < PET_CARE.lowFullnessThreshold ? start.lowFullnessMs : 0
  const damagedMs = Math.max(0, priorLow + lowMs - PET_CARE.lowFullnessGraceMs) - Math.max(0, priorLow - PET_CARE.lowFullnessGraceMs)
  const recoveredHealth = clamp(start.health + healthyMs / HOUR * PET_CARE.healthRecoveryPerHour)
  const health = clamp(recoveredHealth - damagedMs / HOUR * PET_CARE.healthLossPerHour)
  // Freeze the body at the instant of death, including when one pure simulation spans many hours.
  const deathAfterMs = healthyMs + Math.max(0, PET_CARE.lowFullnessGraceMs - priorLow) + recoveredHealth / PET_CARE.healthLossPerHour * HOUR
  const livedMs = health <= 0 ? Math.min(elapsedMs, deathAfterMs) : elapsedMs
  const livedLowMs = Math.max(0, livedMs - healthyMs)
  const baseWeight = PET_BASE_WEIGHT[pet.species]
  const overfullMs = Math.min(livedMs, Math.max(0, (start.fullness - 90) / PET_CARE.fullnessPerHour * HOUR))
  const weight = Math.min(baseWeight * 1.5, Math.max(baseWeight * .65, start.weight + baseWeight * (.005 * overfullMs - .01 * livedLowMs) / HOUR))
  return {
    ...pet, status: health <= 0 ? 'dead' : 'alive',
    care: {
      fullness: clamp(start.fullness - livedMs / HOUR * PET_CARE.fullnessPerHour),
      energy: clamp(start.energy + livedMs / HOUR * (options.resting ? PET_CARE.restingEnergyPerHour : -PET_CARE.energyLossPerHour)),
      health, weight, lowFullnessMs: livedLowMs > 0 ? priorLow + livedLowMs : 0,
    },
  }
}
export function careWarning(care: PetCare): string {
  if (care.health <= 0) return '生命体征已停止'
  if (care.fullness < PET_CARE.lowFullnessThreshold) {
    const remaining = Math.max(0, PET_CARE.lowFullnessGraceMs - care.lowFullnessMs)
    return remaining > 0 ? `饱食度过低，约 ${Math.ceil(remaining / 60_000)} 分钟在线时间后健康开始下降` : '持续饥饿正在影响健康，请及时补充食物'
  }
  return care.energy < 20 ? '精力不足，休息时会逐渐恢复' : '状态良好'
}

export function petWeightScale(pet: { species: keyof typeof PET_BASE_WEIGHT; care: PetCare }): number {
  return Math.max(.85, Math.min(1.18, Math.sqrt(pet.care.weight / PET_BASE_WEIGHT[pet.species])))
}
export function petWeightLabel(pet: { species: keyof typeof PET_BASE_WEIGHT; care: PetCare }): string {
  const ratio = pet.care.weight / PET_BASE_WEIGHT[pet.species]
  return ratio < .85 ? '偏瘦' : ratio > 1.15 ? '偏重' : '正常'
}
