import type { SceneBody, SceneBounds } from './pet-scene-model.js'
export type RenderBody = SceneBody & { visualKey: string; gazeYaw: number; gazePitch: number }
export type SceneRegion = { x: number; y: number; width: number; height: number; label: string }
const round = (value: number, resolution: number) => Math.round(value / resolution) * resolution
export function sameSceneRegion(a: SceneRegion | undefined, b: SceneRegion): boolean {
  return !!a && a.label === b.label && ['x','y','width','height'].every(key => Math.abs(a[key as 'x'] - b[key as 'x']) < .1)
}
export function advanceSceneGaze(body: SceneBody, bounds: SceneBounds, pointer: { x: number; y: number } | null | undefined, follow: boolean) {
  const current = body as SceneBody & { gazeYaw?: number; gazePitch?: number }
  if (!follow || body.menuOpen || body.dragging || body.y < 0 || body.mode !== 'rest') {
    current.gazeYaw = 0; current.gazePitch = 0
  } else if (pointer) {
    const diameter = Math.min(128,bounds.width)
    const yaw = Math.max(-.3,Math.min(.3,(pointer.x*bounds.width-body.x-diameter/2)/700))
    const pitch = Math.max(-.25,Math.min(.25,(pointer.y*bounds.height-bounds.height-56+diameter/2)/700))
    current.gazeYaw = (current.gazeYaw ?? 0) + (yaw-(current.gazeYaw ?? 0))*.35
    current.gazePitch = (current.gazePitch ?? 0) + (pitch-(current.gazePitch ?? 0))*.35
  }
}
export function secondarySceneMotion(body: SceneBody, now: number, reduced: boolean) {
  if (reduced) return { bounce: 0, poke: 0 }
  const sampledNow = body.pausedSince ?? now
  const landed = sampledNow-body.landing
  return {
    bounce: landed >= 0 && landed < 340 ? Math.sin(landed/340*Math.PI*2)*Math.exp(-landed/140) : 0,
    poke: Math.sin((sampledNow-body.lastInteraction)/45)*Math.exp(-(sampledNow-body.lastInteraction)/250)*body.irritation,
  }
}
/** Reuse snapshots below visible thresholds, instead of invalidating every pet. */
export function captureSceneFrame(bodies: readonly SceneBody[], previous: readonly RenderBody[], now: number, reduced: boolean): RenderBody[] {
  return bodies.map(body => {
    const raw = body as SceneBody & { gazeYaw?: number; gazePitch?: number }
    const gazeYaw = round(raw.gazeYaw ?? 0,.01), gazePitch = round(raw.gazePitch ?? 0,.01)
    const motion = secondarySceneMotion(body,now,reduced)
    const p = body.pose
    const visualKey = [body.mode,body.dragging,body.y<0,round(body.x+p.dx,.1),round(body.y+p.y,.1),
      round(body.sizeScale,.001),round(body.lift,.001),round(p.ball,.001),round(p.angle,.1),
      round(p.scaleX,.001),round(p.scaleY,.001),round(p.eyes,.01),round(body.irritation,.01),
      round(motion.bounce,.001),round(motion.poke,.001),gazeYaw,gazePitch].join('|')
    const old = previous.find(item => item.id===body.id)
    return old?.visualKey===visualKey ? old : {...body,pose:{...p},visualKey,gazeYaw,gazePitch}
  })
}
