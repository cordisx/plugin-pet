import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

// node scripts/slice-item-sheet.mjs INPUT.png OUTPUT_DIR [sharp module path]
const [input, output, sharpModule = 'sharp'] = process.argv.slice(2)
if (!input || !output) throw new Error('Expected input sheet and output directory')
const sharp = createRequire(import.meta.url)(sharpModule)
const rows = [
  'apple pear banana orange watermelon strawberry blueberry peach cherry',
  'carrot broccoli pumpkin corn peas cucumber lettuce sweetpotato mushroom',
  'salmon sardine tuna shrimp crab chicken turkey steak egg',
  'cookie biscuit toast croissant pretzel bagel pancake waffle muffin',
  'pudding jelly mochi donut cupcake cheesecake macaroon icecream riceball',
  'waterbowl waterbottle coconutwater milk berrydrink orangejuice thermos tea soup',
  'yarn tennisball featherwand frisbee rubberduck bell book ribbon toyfish',
  'sleepmask cushion blanket brush soap towel firstaid bandage goldenkey',
  'greencrystal bluecrystal purplecrystal goldstar heartcharm clover chest gift totem',
].map(row => row.split(' '))
const { width, height, hasAlpha } = await sharp(input).metadata()
if (!width || !height || !hasAlpha) throw new Error('Expected a transparent 9×9 sheet')
await mkdir(output, { recursive: true })
// Detect alpha-connected silhouettes before assigning cells: generated grids can
// drift a few pixels, so cutting blindly at ninths would sever an object.
const { data } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const seen = new Uint8Array(width * height)
const components = new Map()
for (let i = 0; i < seen.length; i++) {
  if (seen[i] || data[i * 4 + 3] < 32) continue
  const pixels = [i]; seen[i] = 1
  let left = width, top = height, right = 0, bottom = 0
  for (let k = 0; k < pixels.length; k++) {
    const p = pixels[k], x = p % width, y = Math.floor(p / width)
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
    for (const n of [x ? p - 1 : -1, x + 1 < width ? p + 1 : -1, y ? p - width : -1, y + 1 < height ? p + width : -1]) {
      if (n >= 0 && !seen[n] && data[n * 4 + 3] >= 32) { seen[n] = 1; pixels.push(n) }
    }
  }
  if (pixels.length < 100) continue
  const col = Math.floor((left + right + 1) / 2 / width * 9)
  const row = Math.floor((top + bottom + 1) / 2 / height * 9)
  const key = `${row}:${col}`
  if (components.has(key)) throw new Error(`Ambiguous silhouettes in cell ${key}; inspect the sheet`)
  components.set(key, { rect: { left, top, width: right - left + 1, height: bottom - top + 1 }, pixels })
}
if (components.size !== 81) throw new Error(`Expected 81 silhouettes, got ${components.size}`)
const manifest = []
for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
  const id = rows[row][col], component = components.get(`${row}:${col}`)
  if (!component) throw new Error(`Missing ${id}`)
  const { rect, pixels } = component
  const isolated = Buffer.alloc(rect.width * rect.height * 4)
  // Keep the silhouette and its one-pixel antialias fringe, excluding neighbours.
  for (const p of pixels) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = p % width + dx, y = Math.floor(p / width) + dy
    if (x < rect.left || x >= rect.left + rect.width || y < rect.top || y >= rect.top + rect.height) continue
    const source = (y * width + x) * 4, target = ((y - rect.top) * rect.width + x - rect.left) * 4
    data.copy(isolated, target, source, source + 4)
  }
  const cell = await sharp(isolated, { raw: { width: rect.width, height: rect.height, channels: 4 } }).png().toBuffer()
  await sharp(cell).resize(224, 224, { fit: 'contain', background: '#00000000' })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
    .png().toFile(resolve(output, `${id}.png`))
  manifest.push({ id, row, col, ...rect, file: `${id}.png` })
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ columns: 9, rows: 9, sourceWidth: width, sourceHeight: height, items: manifest }, null, 2) + '\n')
console.log(`Cropped ${manifest.length} transparent items`)
