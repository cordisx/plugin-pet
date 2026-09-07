import type { Context } from '@deepseek-ai/cordis'
import { defineReactPage } from 'cordisx/react'
import { CORDISX_PAGE_SCHEMA_V3, CORDISX_ROUTE_SCHEMA_V2, CORDISX_MANAGER_CONTENT_NAVIGATION_SCHEMA_V1 } from 'cordisx/contracts'
import type { PetClient } from './pet-client.js'
import { createPetPage } from './pet-page-entry.js'
export const PET_SECTIONS = ['pets', 'shop', 'bag', 'settings', 'ledger'] as const
export type PetSection = typeof PET_SECTIONS[number]
const labels: Record<PetSection, string> = { pets: '我的宠物', shop: '宠物商店', bag: '背包与装扮', settings: '互动设置', ledger: '收支与记录' }
const descriptions: Record<PetSection, string> = { pets: '照顾宠物，选择一起陪伴工作的伙伴', shop: '解锁新伙伴、皮肤和算力补给', bag: '装备已拥有的皮肤，给宠物补充能量', settings: '调整宠物的出场方式和互动效果', ledger: '查看宠物币和物品的变化记录' }
const text = (key: string, fallback: string) => ({ namespace: 'pet', key, fallback })
export function installPetPages(ctx: Context, client: PetClient): (section: PetSection) => Promise<void> {
  const tabs = PET_SECTIONS.map(id => ({ id, route: { id: `pet.${id}` } }))
  for (const section of PET_SECTIONS) {
    const id = `pet.${section}`
    const description = text(`${id}.description`, descriptions[section])
    ctx.pages.register({ $schema: CORDISX_PAGE_SCHEMA_V3, schemaVersion: 3, id, title: text(id, labels[section]), description, icon: 'host:people', chrome: 'standard' }, defineReactPage(createPetPage(client, section)))
    ctx.routes.register({ $schema: CORDISX_ROUTE_SCHEMA_V2, schemaVersion: 2, id, path: `/manager/extensions/pet/${section}`, outlet: 'manager.content', page: id, title: text(id, labels[section]), description })
    ctx.managerContent.register({ $schema: CORDISX_MANAGER_CONTENT_NAVIGATION_SCHEMA_V1, schemaVersion: 1, id, route: { id }, header: { title: { kind: 'route' } }, tabs })
  }
  ctx.slots.register({ name: 'manager.settings.navigation-items', id: 'pet', group: 'after-settings', order: 170 }, { route: { id: 'pet.pets' } })
  return section => ctx.routes.navigate({ id: `pet.${section}` })
}
