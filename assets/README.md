# Pet inventory artwork

Created with the built-in ImageGen tool on 2026-09-08. These are generated game illustrations; no Minecraft game texture file was extracted. The revival item is a generated interpretation of the requested Totem of Undying appearance.

- `source/items-sheet-v1.png`: the complete transparent 9 × 9 source sheet.
- `source/items-sheet-v1.prompt.txt`: exact sheet prompt.
- `source/individual-items.prompts.json`: subjects for the retained individual generation pass. Shared treatment: isolated transparent square casual-game item, no text/background shadow, warm polished illustration; the totem uses pixel art.
- `../src/assets/items/`: ten retained individual images, normalized to 256 px.
- `../src/assets/items/batch/`: 81 cropped transparent items and coordinate manifest. Sixteen foods are currently usable in the shop; the remaining artwork is a reserve, not a promise of implemented item behavior.

Regenerate the crops with Node.js and Sharp 0.35.4:

```
node scripts/slice-item-sheet.mjs assets/source/items-sheet-v1.png src/assets/items/batch /absolute/path/to/sharp
```

The script detects the 81 alpha-connected silhouettes and assigns them to grid cells. It rejects missing/ambiguous cells, preserves alpha, excludes adjacent objects, and adds consistent padding. Inspect the output after changing a source sheet. Keep the original individual images when adding new sprite-sheet variants.

## Cyber equipment

Six RGBA sprites in `src/assets/items/item-water-dispenser{,-2,-3}.png` and `item-auto-feeder{,-2,-3}.png` share a 256 px square canvas. The built-in image generation tool produced [the source sheet](source/cyber-devices-sheet.png); [the exact prompt and crop specification](source/cyber-devices-prompt.md) preserve provenance. Rows identify equipment, columns identify upgrade levels. The shop lists only the base type; higher sprites belong to upgrades. `pet-device-art.tsx` maps each generated reservoir window and layers actual supplies inside it without redrawing the device.
