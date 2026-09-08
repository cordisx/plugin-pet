import { foodEffect } from './pet-attributes.js'
import { petProduct } from './pet-catalog.js'
import { PET_CARE } from './pet-care.js'
import type { PetState, PetEntity } from './pet-domain.js'

export type PetDeviceKind = 'water' | 'feeder'
export type PetDeviceSettings = {
  waterEnabled: boolean; feederEnabled: boolean; foodId: string; waterLevel: number; feederLevel: number
  waterStored: number; foodQueue: { foodId: string; quantity: number }[]
  waterCursor: number; feederCursor: number
}
export const DEFAULT_PET_DEVICES: PetDeviceSettings = { waterEnabled: false, feederEnabled: false, waterLevel: 0, feederLevel: 0, foodId: 'food-snack', waterStored: 0, foodQueue: [], waterCursor: 0, feederCursor: 0 }
export const PET_DEVICE_IDS = { water: 'item-water-dispenser', feeder: 'item-auto-feeder' } as const
export function deviceCapacity(state: Pick<PetState, 'devices'>, kind: PetDeviceKind) {
  const tier = kind === 'water' ? state.devices.waterLevel : state.devices.feederLevel
  return { tier, capacity: (kind === 'water' ? [0,300,800,2000] : [0,6,18,48])[tier]!, serviceLimit: [0,2,4,8][tier]! }
}
export const PET_DEVICE_UPGRADE_COST = { water: [0,240,480], feeder: [0,360,720] } as const
export function deviceFoodCount(devices: PetDeviceSettings): number { return devices.foodQueue.reduce((total, batch) => total + batch.quantity, 0) }
/** A shared device serves a bounded number of pets per online tick, resuming after its last recipient. */
function serve(state: PetState, kind: PetDeviceKind, use: (pet: PetEntity) => boolean): void {
  const candidates = state.activePetIds.map(id => state.pets.find(pet => pet.id === id)).filter((pet): pet is PetEntity => !!pet && pet.status === 'alive')
  if (!candidates.length) return
  const cursorKey = kind === 'water' ? 'waterCursor' : 'feederCursor'
  const start = state.devices[cursorKey] % candidates.length
  const limit = deviceCapacity(state, kind).serviceLimit
  let served = 0
  for (let offset = 0; offset < candidates.length && served < limit; offset++) {
    const index = (start + offset) % candidates.length
    if (use(candidates[index]!)) { served++; state.devices[cursorKey] = (index + 1) % candidates.length }
  }
}
/** Runs inside the same CAS transaction as online care; all supplies come from stored reservoirs. */
export function applyPetDevices(state: PetState, now: number): void {
  const devices = state.devices
  if (devices.waterEnabled) serve(state, 'water', pet => {
    if (pet.care.hydration >= 35 || devices.waterStored <= 0) return false
    const amount = Math.min(80 - pet.care.hydration, devices.waterStored)
    devices.waterStored = Math.max(0, devices.waterStored - amount)
    pet.care.hydration += amount
    if (pet.care.hydration >= PET_CARE.lowHydrationThreshold) pet.care.lowHydrationMs = 0
    state.receipts.push({ key: `device-water:${pet.id}:${now}`, kind: 'device-water', at: now, coins: 0, detail: `自动饮水机为${pet.name}补充了清水` })
    return true
  })
  if (devices.feederEnabled) serve(state, 'feeder', pet => {
    const batch = devices.foodQueue[0]
    if (pet.care.fullness >= 35 || !batch) return false
    const food = petProduct(batch.foodId)
    const effect = foodEffect(pet, food)
    batch.quantity--
    if (batch.quantity === 0) devices.foodQueue.shift()
    pet.care.fullness = Math.min(100, pet.care.fullness + effect.fullness)
    pet.care.energy = Math.min(100, pet.care.energy + effect.energy)
    pet.care.mood = Math.min(100, pet.care.mood + effect.mood * pet.traits.cheerfulness)
    if (pet.care.fullness >= PET_CARE.lowFullnessThreshold) pet.care.lowFullnessMs = 0
    state.receipts.push({ key: `device-feed:${pet.id}:${now}`, kind: 'device-feed', at: now, coins: 0, detail: `自动喂食器给${pet.name}投放了${food.name} × 1` })
    return true
  })
}
