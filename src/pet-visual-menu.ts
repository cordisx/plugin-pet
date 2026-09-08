import { PET_CATALOG } from './pet-catalog.js'
import type { PetState } from './pet-domain.js'
import type { PetClient } from './pet-client.js'
import type { PetNavigate } from './pet-navigation.js'
export type PetVisualMenuItem = { id: string; label: string; icon?: string; disabled?: boolean; children?: PetVisualMenuItem[] }
type MenuState = Pick<PetState, 'foodInventory' | 'mainPetId' | 'pets' | 'ownedSkinIds'>
/** Two levels, at most 51 nodes. Large inventories keep a full-page escape hatch. */
export function petVisualMenu(state: MenuState, id: string, resting = false, nested = true): PetVisualMenuItem[] {
  const entity = state.pets.find(pet => pet.id === id)
  const foods = PET_CATALOG.filter(item => item.kind === 'food' && (state.foodInventory[item.id] ?? 0) > 0).slice(0,nested?18:4)
  const skins = PET_CATALOG.filter(item => item.kind === 'skin' && item.species === entity?.species && state.ownedSkinIds.includes(item.id)).slice(0,18)
  const detail = { id:'details',label:'宠物详情',icon:'navigation.overview' }
  const feed = foods.map(food=>({id:`feed:${food.id}`,label:`${food.name} · ${state.foodInventory[food.id]} 份`,icon:'content.layers'}))
  const care = [{id:'water',label:'喝水',icon:'action.reset'},{id:resting?'wake':'sleep',label:resting?'唤醒':'休息',icon:resting?'action.resume':'action.pause'},{id:'play',label:'陪它玩',icon:'action.favorite'}]
  const management = [{id:'main',label:state.mainPetId===id?'当前主宠':'设为主宠',icon:'action.favorite',disabled:state.mainPetId===id},{id:'reset',label:'重置位置',icon:'action.reset'},{id:'hide',label:'暂时收起',icon:'action.disable'},{id:'settings',label:'互动设置',icon:'action.settings'}]
  const wardrobe = {id:'wardrobe',label:'更多装扮与解锁',icon:'content.palette'}
  const shop = {id:'shop',label:'宠物商店',icon:'navigation.store'}
  if (!nested) return [detail,...feed,{id:'supplies',label:'购买食物补给',icon:'navigation.store'},...care,wardrobe,...management,shop].map(({icon,...item})=>item)
  return [detail,
    {id:'group-feed',label:'喂食',icon:'content.layers',children:[...feed,{id:'supplies',label:'购买食物补给',icon:'navigation.store'}]},
    {id:'group-care',label:'照料',icon:'action.favorite',children:care},
    {id:'group-outfit',label:'装扮',icon:'content.palette',children:[...skins.map(skin=>({id:`equip:${skin.id}`,label:skin.name+(entity?.skinId===skin.id?' · 已穿戴':''),disabled:entity?.skinId===skin.id,icon:'content.palette'})),wardrobe]},
    {id:'group-manage',label:'管理',icon:'action.settings',children:management},shop]
}
/** Dispatch only recognized leaves; submenu IDs can never become arbitrary routes. */
export async function executePetVisualAction(client: PetClient, id: string, action: string, navigate: PetNavigate): Promise<void> {
  if(action.startsWith('feed:')) await client.execute({type:'feed',petId:id,foodId:action.slice(5)})
  else if(action.startsWith('equip:')) await client.execute({type:'equip',petId:id,skinId:action.slice(6)})
  else if(action==='water') await client.execute({type:'water',petId:id})
  else if(action==='play') await client.execute({type:'interact',petId:id})
  else if(action==='sleep') client.requestSleep(id)
  else if(action==='wake') client.requestWake(id)
  else if(action==='main') await client.execute({type:'setMain',petId:id})
  else if(action==='reset') await client.execute({type:'move',petId:id,x:.7})
  else if(action==='hide') {const live=client.getSnapshot().state;if(live)await client.execute({type:'setActive',petIds:live.activePetIds.filter(item=>item!==id)})}
  else if(action==='details') await navigate('pet-detail',{selectedPet:id,detailTab:'status'})
  else if(action==='wardrobe') await navigate('pet-detail',{selectedPet:id,detailTab:'actions',carePanel:'skin'})
  else if(action==='supplies') await navigate('shop',{filter:'food',page:0})
  else if(action==='shop'||action==='settings') await navigate(action)
}
