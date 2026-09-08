import type { Context } from '@deepseek-ai/cordis'
import { defineReactPage } from 'cordisx/react'
import { CORDISX_PAGE_SCHEMA_V3, CORDISX_ROUTE_SCHEMA_V2, CORDISX_MANAGER_CONTENT_NAVIGATION_SCHEMA_V1 } from 'cordisx/contracts'
import type { PetClient } from './pet-client.js'
import type { PetPageNavigation } from './pet-pages.js'
import { createPetPage } from './pet-page-entry.js'
export const PET_SECTIONS = ['pets', 'shop', 'bag', 'settings', 'ledger'] as const
export type PetSection = typeof PET_SECTIONS[number]
const labels: Record<PetSection, string> = { pets: '宠物', shop: '商店', bag: '背包', settings: '设置', ledger: '收支与记录' }
const descriptions: Record<PetSection, string> = { pets: '照顾宠物，选择一起陪伴工作的伙伴', shop: '解锁新伙伴、皮肤和算力补给', bag: '装备已拥有的皮肤，给宠物补充能量', settings: '调整宠物的出场方式和互动效果', ledger: '查看宠物币和物品的变化记录' }
const text = (key: string, fallback: string) => ({ namespace: 'pet', key, fallback })
export function installPetPages(ctx: Context, client: PetClient): (section: PetSection) => Promise<void> {
  const navigation: PetPageNavigation = { session: { filter: 'all', hideOwned: false }, open: section => { void ctx.routes.navigate({ id: `pet.${section}` }) } }
  const tabs = PET_SECTIONS.filter(section => section !== 'ledger').map(id => ({ id, route: { id: `pet.${id}` } }))
  for (const section of PET_SECTIONS) {
    const id = `pet.${section}`
    const description = text(`${id}.description`, descriptions[section])
    ctx.pages.register({ $schema: CORDISX_PAGE_SCHEMA_V3, schemaVersion: 3, id, title: text(id, labels[section]), description, icon: section === 'shop' ? 'host:marketplace' : section === 'bag' ? 'host:archive' : section === 'settings' ? 'host:settings' : section === 'ledger' ? 'host:history' : 'host:people', chrome: 'standard' }, defineReactPage(createPetPage(client, section, navigation)))
    ctx.routes.register({ $schema: CORDISX_ROUTE_SCHEMA_V2, schemaVersion: 2, id, path: `/manager/extensions/pet/${section}`, outlet: 'manager.content', page: id, title: text(id, labels[section]), description })
    ctx.managerContent.register({ $schema: CORDISX_MANAGER_CONTENT_NAVIGATION_SCHEMA_V1, schemaVersion: 1, id, route: { id }, header: { title: { kind: 'route' } }, ...(section === 'ledger' ? { parentRoute: { id: 'pet.shop' } } : { tabs }) })
  }
  for (const [section, title, parent] of [['pet-detail', '宠物详情', 'pets'], ['product-detail', '商品详情', 'shop'], ['bag-detail', '使用物品', 'bag']] as const) {
    const id = `pet.${section}`
    const titleText = text(id, title)
    ctx.pages.register({ $schema: CORDISX_PAGE_SCHEMA_V3, schemaVersion: 3, id, title: titleText, description: titleText, icon: 'host:people', chrome: 'standard' }, defineReactPage(createPetPage(client, section, navigation)))
    ctx.routes.register({ $schema: CORDISX_ROUTE_SCHEMA_V2, schemaVersion: 2, id, path: `/manager/extensions/pet/${section}`, outlet: 'manager.content', page: id, title: titleText, description: titleText })
    ctx.managerContent.register({ $schema: CORDISX_MANAGER_CONTENT_NAVIGATION_SCHEMA_V1, schemaVersion: 1, id, route: { id }, parentRoute: { id: `pet.${parent}` }, header: { title: { kind: 'route' } } })
  }
  ctx.slots.register({ name: 'manager.settings.navigation-items', id: 'pet', group: 'after-settings', order: 170 }, { route: { id: 'pet.pets' } })
  return section => ctx.routes.navigate({ id: `pet.${section}` })
}
