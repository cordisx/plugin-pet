import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { build } from 'esbuild'
const built=await build({entryPoints:['src/pet-native-snapshots.ts','src/pet-catalog.ts'],bundle:true,write:false,format:'esm',platform:'node',outdir:'test-output',loader:{'.svg':'dataurl'}})
const modules=await Promise.all(built.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))))
const {petNativeSnapshot,petNativePreviewDefinition}=modules[0],{PET_CATALOG,PET_DEFAULT_SKINS,petProduct}=modules[1]
test('every catalog skin and default pet uses exact native static artwork without mounting a model',()=>{
  for(const item of PET_CATALOG.filter(item=>item.kind==='skin')) {
    const url=petNativeSnapshot(item.species,item.paletteId)
    assert.ok(url?.startsWith('data:image/svg+xml'),item.id)
  }
  for(const [species,skin] of Object.entries(PET_DEFAULT_SKINS)) assert.ok(petNativeSnapshot(species,petProduct(skin).paletteId),species)
  assert.equal(petNativeSnapshot('cat','missing-palette'),undefined)
  assert.notEqual(petNativeSnapshot('cat','white'),petNativeSnapshot('cat','orange-tabby'))
})
test('exact native preview definitions and offline SVG files match their provenance digests',async()=>{
  const root=new URL('../src/assets/pet-preview/',import.meta.url)
  const manifest=JSON.parse(await readFile(new URL('SOURCE.json',root),'utf8'))
  for(const item of manifest.files) {
    const definition=petNativePreviewDefinition(item.species,item.paletteId)
    assert.deepEqual(definition,item.definition,item.file)
    assert.equal(petNativePreviewDefinition(item.species,item.paletteId),definition,'stable cached live definition')
    assert.equal(definition.scene.view.scale,1.72)
    assert.equal(definition.scene.view.roll,-Math.sign(definition.scene.view.positionX)*7*Math.PI/180)
    assert.deepEqual(definition.scene.entity.parts,[])
    const bytes=await readFile(new URL(item.file,root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file)
    const svg=bytes.toString()
    assert.ok(svg.includes('<svg'),item.file)
    const opening=svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
    assert.equal((opening.match(/\sxmlns=/g) ?? []).length,1,`valid single SVG namespace: ${item.file}`)
  }
  assert.equal(manifest.files.length,142)
})
