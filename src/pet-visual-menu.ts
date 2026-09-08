import { PET_CATALOG } from './pet-catalog.js'
import type { PetState } from './pet-domain.js'

/** A context menu is a shortcut, not the whole catalog. Host permits at most 20 items. */
export function petVisualMenu(state: Pick<PetState, 'foodInventory' | 'mainPetId'>, id: string) {
  const foods = PET_CATALOG.filter(item => item.kind === 'food' && (state.foodInventory[item.id] ?? 0) > 0).slice(0, 4)
  return [
    ...foods.map(food => ({ id: `feed:${food.id}`, label: `喂${food.name} · ${state.foodInventory[food.id]}` })),
    { id: 'pets', label: foods.length ? '更多喂食与照顾…' : '喂食与照顾…' },
    { id: 'main', label: state.mainPetId === id ? '当前主宠' : '设为主宠', disabled: state.mainPetId === id },
    { id: 'bag', label: '换装与背包' }, { id: 'shop', label: '宠物商店' },
    { id: 'reset', label: '重置位置' }, { id: 'hide', label: '暂时收起' }, { id: 'settings', label: '互动设置' },
  ]
}
