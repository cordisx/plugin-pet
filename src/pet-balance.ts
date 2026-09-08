import type { PetState } from './pet-domain.js'
import type { PetEconomyStatus } from './pet-economy.js'

/** Unavailable shared funds are unknown, never a synthetic zero balance. */
export function petVisibleBalance(state: PetState, economy?: PetEconomyStatus): number | null {
  if (state.economy || economy?.binding) return economy?.status === 'ready' ? economy.wallet?.available ?? null : null
  return state.wallet.balance
}
export function petCanAfford(state: PetState, cost: number, economy?: PetEconomyStatus): boolean {
  const balance = petVisibleBalance(state, economy)
  return balance !== null && balance >= cost
}
