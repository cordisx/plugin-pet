import { useEffect, useMemo, useState, useSyncExternalStore } from 'cordisx/react'
import type { CordisXReactVisualProps } from 'cordisx/contracts'
import type { PetClient } from './pet-client.js'
import type { PetNavigate } from './pet-navigation.js'
import { petComposerAppearance } from './pet-appearance.js'
import { PetScene } from './pet-scene.js'
import { petVisualMenu, executePetVisualAction } from './pet-visual-menu.js'
import { petWeightScale } from './pet-care.js'

export function createPetOverlay(client: PetClient, navigate: PetNavigate) {
  return function PetOverlay(props: CordisXReactVisualProps) {
    const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
    const state = snapshot.state
    const activeIds = state?.settings.visible ? state.activePetIds.join('|') : ''
    const handles = useMemo(() => new Map<string, ReturnType<NonNullable<CordisXReactVisualProps['interactions']>['create']>>(), [props.interactions])
    const [handleRevision, updateHandles] = useState(0)
    useEffect(() => {
      const wanted = new Set(activeIds ? activeIds.split('|') : [])
      for (const [id, handle] of handles) if (!wanted.has(id)) { handle.dispose(); handles.delete(id) }
      for (const id of wanted) if (!handles.has(id) && props.interactions) handles.set(id, props.interactions.create(id))
      updateHandles(value => value + 1)
    }, [handles, props.interactions, activeIds])
    useEffect(() => () => { for (const handle of handles.values()) handle.dispose(); handles.clear() }, [handles])
    const [pausedIds, setPausedIds] = useState<string[]>([])
    const menuKey = JSON.stringify([state?.foodInventory, state?.mainPetId, state?.ownedSkinIds, state?.pets.map(pet=>[pet.id,pet.species,pet.skinId]), snapshot.restingPetIds])
    useEffect(() => {
      const subscriptions = [...handles].map(([id, handle]) => {
        let sequence = handle.getSnapshot().sequence
        return handle.subscribe(() => {
          const current = handle.getSnapshot()
          setPausedIds(previous => current.menuOpen ? previous.includes(id) ? previous : [...previous, id] : previous.includes(id) ? previous.filter(item => item !== id) : previous)
          if (current.sequence <= sequence) return
          sequence = current.sequence
          const action = current.actionId
          if (!action) return
          void executePetVisualAction(client,id,action,navigate).catch(error => {
            console.warn('[pet] Menu action failed', error)
            client.reportError(String(error).includes('permission') ? '请在 CordisX 插件权限中允许宠物页面显示。' : '操作未完成，请稍后重试。')
          })
        })
      })
      return () => {
        for (const stop of subscriptions) stop()
        setPausedIds([])
      }
    }, [handles, props.interactions, handleRevision])
    useEffect(() => {
      if (!state) return
      for (const [id, handle] of handles) handle.setMenu(petVisualMenu(state, id, snapshot.restingPetIds?.includes(id), (props.interactions as {version?:string}|undefined)?.version === 'cordisx.extension-point-interactions/v2'))
    }, [handles, handleRevision, menuKey])
    const entities = useMemo(() => !state || !state.settings.visible ? [] : state.activePetIds.flatMap(id => {
      const pet = state.pets.find(item => item.id === id)
      return pet?.status === 'alive' ? [{ id: pet.id, name: pet.name, x: pet.x, definition: petComposerAppearance(pet), sizeScale: petWeightScale(pet) }] : []
    }), [state])
    const dragFor = useMemo(() => (id: string) => handles.get(id), [handles, handleRevision])
    if (!state || !state.settings.visible) return null
    return <><PetScene state={{ ...props.state, reducedMotion: props.state.reducedMotion || state.settings.reducedMotion }}
      entities={entities} dragFor={dragFor} pausedIds={pausedIds} feedback={snapshot.feedback}
      followPointer={state.settings.followPointer} draggable={state.settings.draggable} clickFeedback={state.settings.clickFeedback}
      idleAnimations={state.settings.idleAnimations}
      onRestingChange={client.setRestingPets}
      onPositionChange={(petId, x) => { void client.execute({ type: 'move', petId, x }) }}
      onInteract={petId => { void client.execute({ type: 'interact', petId }) }} />
      {snapshot.error && <span role="alert" style={{ position: 'absolute', top: 4, left: 8, maxWidth: 'min(320px, calc(100% - 16px))',
        fontSize: 12, lineHeight: 1.5, padding: '4px 8px', borderRadius: 6, background: 'Canvas', color: 'CanvasText', pointerEvents: 'none' }}>{snapshot.error}</span>}
    </>
  }
}

export { createPetPrimary } from './pet-primary.js'
