import { useEffect, useState, type ComponentType } from 'cordisx/react'
import { Text } from 'cordisx/ui'
import type { PetClient } from './pet-client.js'
import type { PetPageSection, PetPageNavigation } from './pet-pages.js'
export function createPetPage(client: PetClient, section: PetPageSection, navigation?: PetPageNavigation) {
  return function PetPageEntry() {
    const [Page, setPage] = useState<ComponentType<{ client: PetClient; section: PetPageSection; navigation?: PetPageNavigation }> | null>(null)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
      let active = true
      void import('./pet-pages.js').then(module => { if (active) setPage(() => module.PetPage) }, () => { if (active) setError('宠物页面暂时无法加载，请重新打开') })
      return () => { active = false }
    }, [])
    return Page ? <Page client={client} section={section} navigation={navigation} /> : <Text>{error ?? '正在打开宠物之家…'}</Text>
  }
}
