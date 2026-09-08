import type { CSSProperties } from 'cordisx/react'
import { itemImages } from './pet-food-art.js'

// The generated sprite cells retain their coordinates so contents align with each window.
const windows = {
  water: [
    'polygon(39% 34%,54% 37%,54% 60%,39% 57%)',
    'polygon(27% 29%,45% 33%,45% 62%,27% 58%)',
    'polygon(27% 28%,47% 32%,47% 64%,27% 60%)',
  ],
  feeder: [
    'polygon(39% 34%,54% 37%,54% 58%,39% 55%)',
    'polygon(24% 22%,47% 28%,47% 51%,24% 46%)',
    'polygon(24% 25%,47% 30%,47% 56%,24% 50%)',
  ],
} as const
export function PetDeviceArt({ device, tier = 1, fill = 0, foodId, enabled = true }: {
  device: 'water' | 'feeder'; tier?: number; fill?: number; foodId?: string; enabled?: boolean
}) {
  const level = Math.max(1, Math.min(3, tier))
  const fraction = Math.max(0, Math.min(1, fill))
  const id = (device === 'water' ? 'item-water-dispenser' : 'item-auto-feeder') + (level > 1 ? `-${level}` : '')
  const bounds = device === 'water' ? [[34,60],[29,62],[28,64]][level-1]! : [[34,58],[22,51],[25,56]][level-1]!
  const style = { '--device-window': windows[device][level-1], '--device-fill-top': `${bounds[1]! - fraction * (bounds[1]! - bounds[0]!)}%`, '--device-food': `url("${itemImages[foodId ?? 'food-snack']}")` } as CSSProperties
  return <span className="pet-device-art" data-kind={device} data-running={enabled && fraction > 0} style={style} role="img" aria-label={`${device === 'water' ? '饮水器' : '喂食器'} ${level} 级，剩余 ${Math.round(fraction * 100)}%`}><img src={itemImages[id]} alt="" draggable={false} /><span className="pet-device-window"><span className="pet-device-contents" /></span></span>
}
export const PET_DEVICE_ART_STYLES = `
.pet-device-art{position:relative;display:inline-block;flex:none;width:96px;aspect-ratio:1;isolation:isolate}
.pet-device-art>img{display:block;width:100%;height:100%;object-fit:contain}
.pet-device-art[data-running=false]>img{filter:saturate(.25) brightness(.8)}
.pet-device-window{position:absolute;inset:0;clip-path:var(--device-window);pointer-events:none}
.pet-device-contents{position:absolute;inset:var(--device-fill-top) 0 0;background:linear-gradient(180deg,#89f5ff 0 2px,#16b9d0aa 3px,#08719bbf);transition:top .4s ease}
.pet-device-art[data-kind=feeder] .pet-device-contents{background-image:var(--device-food);background-size:18px 18px;background-repeat:repeat;background-color:#8b5928}
@media(prefers-reduced-motion:reduce){.pet-device-contents{transition:none}}
`
