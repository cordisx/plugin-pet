export type PetSpecies = 'cat' | 'dog' | 'rabbit'
export type PetProduct = {
  id: string
  kind: 'pet' | 'skin' | 'food' | 'item'
  name: string
  price: number
  species?: PetSpecies
  paletteId?: string
  fullness?: number
  energy?: number
  affinity?: number
  requiredAffinity?: number
}
/** Initial tuning, deliberately independent from a model's monetary price. */
export const PET_ECONOMY = { tokensPerCoin: 10_000, interactionCooldownMs: 60_000, interactionDailyLimit: 10 } as const
export const PET_CATALOG: readonly PetProduct[] = [
  { id: 'pet-cat', kind: 'pet', name: '猫猫', species: 'cat', price: 0 },
  { id: 'pet-dog', kind: 'pet', name: '小狗', species: 'dog', price: 150, requiredAffinity: 6 },
  { id: 'pet-rabbit', kind: 'pet', name: '兔兔', species: 'rabbit', price: 200, requiredAffinity: 12 },
  { id: 'skin-white', kind: 'skin', name: '云朵白', species: 'cat', paletteId: 'white', price: 0 },
  { id: 'skin-orange', kind: 'skin', name: '橘子汽水', species: 'cat', paletteId: 'orange-tabby', price: 60 },
  { id: 'skin-siamese', kind: 'skin', name: '奶咖', species: 'cat', paletteId: 'siamese', price: 80 },
  { id: 'skin-shiba', kind: 'skin', name: '柴犬', species: 'dog', paletteId: 'shiba-inu', price: 0 },
  { id: 'skin-husky', kind: 'skin', name: '雪原', species: 'dog', paletteId: 'husky', price: 80 },
  { id: 'skin-lop', kind: 'skin', name: '垂耳奶糖', species: 'rabbit', paletteId: 'holland-lop', price: 0 },
  { id: 'skin-dutch', kind: 'skin', name: '黑白布丁', species: 'rabbit', paletteId: 'dutch-rabbit', price: 80 },
  { id: 'skin-friend', kind: 'skin', name: '相伴纪念', species: 'cat', paletteId: 'british-shorthair', price: 0, requiredAffinity: 30 },
  { id: 'food-snack', kind: 'food', name: '比特脆脆', price: 5, affinity: 2, fullness: 20, energy: 5 },
  { id: 'food-meal', kind: 'food', name: '显存糯米团', price: 12, affinity: 6, fullness: 45, energy: 15 },
  { id: 'food-feast', kind: 'food', name: '满血火锅', price: 25, affinity: 14, fullness: 80, energy: 30 },
  { id: 'item-reboot-core', kind: 'item', name: '重启核心', price: 80 },
]
export const PET_DEFAULT_SKINS: Record<PetSpecies, string> = { cat: 'skin-white', dog: 'skin-shiba', rabbit: 'skin-lop' }
export function petProduct(id: string): PetProduct {
  const product = PET_CATALOG.find(item => item.id === id)
  if (!product) throw new Error('找不到这件商品')
  return product
}
