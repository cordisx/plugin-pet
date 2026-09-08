import { PET_CATALOG, petAdoptionPrice, petProduct } from './pet-catalog.js'
import { deviceCapacity, PET_DEVICE_UPGRADE_COST } from './pet-devices.js'
import { applyPetCommand, migratePetState, type PetState, type PetTransition } from './pet-domain.js'
import type { PetPurchaseCommand, PetPurchaseIntent } from './pet-economy-state.js'
import { PET_SPECIES_IDS } from './pet-species.js'

/** Pet owns its catalogue. The service independently installs this versioned catalogue;
 * the customer request never establishes a price. */
export function petMerchantCatalog() {
  return [
    ...PET_CATALOG.map(item => ({ id: item.id, title: item.name, price: item.price, namespace: 'pet' })),
    ...PET_SPECIES_IDS.map(species => ({
      id: `adopt-${species}`,
      title: `再次领养 ${species}`,
      price: petAdoptionPrice(species),
      namespace: 'pet',
    })),
    ...(['water', 'feeder'] as const).flatMap(device =>
      [1, 2].map(level => ({
        id: `upgrade-${device}-${level + 1}`,
        title: `${device} Lv.${level + 1}`,
        price: PET_DEVICE_UPGRADE_COST[device][level]!,
        namespace: 'pet',
      }))
    ),
  ]
}
export function preparePetPurchase(
  state: PetState,
  command: PetPurchaseCommand,
  key: string,
  at: number,
): PetPurchaseIntent {
  let itemId: string, total: number, quantity = 1
  if (command.type === 'buy') {
    itemId = command.productId
    quantity = command.quantity ?? 1
    total = petProduct(itemId).price * quantity
  } else if (command.type === 'adopt') {
    itemId = `adopt-${command.species}`
    total = petAdoptionPrice(command.species)
  } else {
    const level = deviceCapacity(state, command.device).tier
    itemId = `upgrade-${command.device}-${level + 1}`
    total = PET_DEVICE_UPGRADE_COST[command.device][level]!
  }
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('商品价格无效')
  const intent = { key, command: structuredClone(command), itemId, quantity, total, at }
  // This proves complete local fulfilment is possible BEFORE creating a remote order.
  grantPetPurchase(state, intent)
  return intent
}
export function grantPetPurchase(state: PetState, intent: PetPurchaseIntent): PetTransition {
  const funded = structuredClone(state)
  // A temporary domain input is not a wallet credit: it is never persisted or sent.
  funded.wallet.balance = intent.total
  const result = applyPetCommand(funded, intent.command, { key: intent.key, now: intent.at })
  if (result.duplicate || result.receipt.coins !== -intent.total) throw new Error('购买意图与本地发货不一致')
  result.state.wallet = structuredClone(state.wallet)
  result.receipt.coins = 0
  migratePetState(result.state)
  return result
}
