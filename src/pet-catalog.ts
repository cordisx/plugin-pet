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
  { id: 'food-fish', kind: 'food', name: '向量小鱼干', price: 10, affinity: 4, fullness: 32, energy: 10 },
  { id: 'food-chicken', kind: 'food', name: '张量鸡块', price: 15, affinity: 5, fullness: 50, energy: 18 },
  { id: 'food-carrot', kind: 'food', name: '线程胡萝卜', price: 6, affinity: 2, fullness: 24, energy: 8 },
  { id: 'food-berry', kind: 'food', name: '缓存莓果', price: 8, affinity: 4, fullness: 18, energy: 20 },
  { id: 'food-pudding', kind: 'food', name: '梯度布丁', price: 18, affinity: 8, fullness: 40, energy: 24 },
  { id: 'food-apple', kind: 'food', name: '红苹果', price: 5, affinity: 2, fullness: 16, energy: 6 },
  { id: 'food-corn', kind: 'food', name: '玉米棒', price: 7, affinity: 2, fullness: 28, energy: 8 },
  { id: 'food-shrimp', kind: 'food', name: '脆脆虾', price: 13, affinity: 5, fullness: 35, energy: 16 },
  { id: 'food-egg', kind: 'food', name: '元气蛋', price: 8, affinity: 3, fullness: 30, energy: 10 },
  { id: 'food-croissant', kind: 'food', name: '月牙可颂', price: 12, affinity: 4, fullness: 42, energy: 12 },
  { id: 'food-riceball', kind: 'food', name: '饭团补给', price: 14, affinity: 4, fullness: 55, energy: 15 },
  { id: 'food-watermelon', kind: 'food', name: '冰镇西瓜', price: 6, affinity: 3, fullness: 15, energy: 18 },
  { id: 'food-pancake', kind: 'food', name: '松饼叠叠乐', price: 16, affinity: 6, fullness: 48, energy: 22 },
  { id: 'item-reboot-core', kind: 'item', name: '复活图腾', price: 80 },
]
export const PET_DEFAULT_SKINS: Record<PetSpecies, string> = { cat: 'skin-white', dog: 'skin-shiba', rabbit: 'skin-lop' }
export function petProduct(id: string): PetProduct {
  const product = PET_CATALOG.find(item => item.id === id)
  if (!product) throw new Error('找不到这件商品')
  return product
}
