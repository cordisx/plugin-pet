import autofeeder3 from './assets/items/item-auto-feeder-3.png'
import autofeeder2 from './assets/items/item-auto-feeder-2.png'
import autofeeder1 from './assets/items/item-auto-feeder.png'
import waterdispenser3 from './assets/items/item-water-dispenser-3.png'
import waterdispenser2 from './assets/items/item-water-dispenser-2.png'
import waterdispenser1 from './assets/items/item-water-dispenser.png'
import apple from './assets/items/batch/apple.png'
import corn from './assets/items/batch/corn.png'
import shrimp from './assets/items/batch/shrimp.png'
import egg from './assets/items/batch/egg.png'
import croissant from './assets/items/batch/croissant.png'
import riceball from './assets/items/batch/riceball.png'
import watermelon from './assets/items/batch/watermelon.png'
import pancake from './assets/items/batch/pancake.png'
import snack from './assets/items/food-snack.png'
import meal from './assets/items/food-meal.png'
import feast from './assets/items/food-feast.png'
import fish from './assets/items/food-fish.png'
import chicken from './assets/items/food-chicken.png'
import carrot from './assets/items/food-carrot.png'
import berry from './assets/items/food-berry.png'
import pudding from './assets/items/food-pudding.png'
import water from './assets/items/water.png'
import totem from './assets/items/totem.png'

export const itemImages: Record<string, string> = {
  'item-water-dispenser': waterdispenser1,
  'item-water-dispenser-2': waterdispenser2,
  'item-water-dispenser-3': waterdispenser3,
  'item-auto-feeder': autofeeder1,
  'item-auto-feeder-2': autofeeder2,
  'item-auto-feeder-3': autofeeder3,

  'food-apple': apple,
  'food-corn': corn,
  'food-shrimp': shrimp,
  'food-egg': egg,
  'food-croissant': croissant,
  'food-riceball': riceball,
  'food-watermelon': watermelon,
  'food-pancake': pancake,

  'food-snack': snack, 'food-meal': meal, 'food-feast': feast,
  'food-fish': fish, 'food-chicken': chicken, 'food-carrot': carrot,
  'food-berry': berry, 'food-pudding': pudding, water, 'item-reboot-core': totem,
}
/** Generated transparent raster assets shared by care, shop and inventory. */
export function PetFoodArt({ id }: { id: string }) {
  const src = itemImages[id]
  return src ? <img className="pet-food-art" src={src} width="96" height="80" alt="" aria-hidden="true" draggable={false} style={{ objectFit: 'contain', alignSelf: 'center', flexShrink: 0 }} /> : null
}
