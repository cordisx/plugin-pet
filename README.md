# pet

A small pet system living on Composer, with 32 native OneWorks Avatar characters and 142 breed/color skins. The Host retains native button actions, keyboard behavior and accessibility. [简体中文](README.zh-Hans.md)

## Current development

- Unlock species and adopt multiple independent companions of the same species. Each has its own name, sex, attributes, personality, care state and outfit.
- A free starter cat, two skins and three snacks. First-time species unlocks include one companion; further adoptions have a displayed pet-coin price.
- Independent companions on Composer: drag, lift and drop, roll, hop and sleep. The main pet also appears on the primary action button.
- Host menu v2 groups feeding, care, outfits and management into icon submenus; older Hosts receive a flat fallback. Outfit actions open the selected pet's wardrobe, where locked skins can be unlocked and equipped.
- Per-pet fullness, hydration, energy, mood, health, weight and affinity. Metabolism, food absorption and actual body weight affect care; intelligence and luck participate in interactions and online discoveries.
- Shared water dispensers and feeders store real supplies, rotate between active pets and support paid capacity upgrades. Food must be loaded from inventory.
- **Care pauses offline.** Prolonged online hunger or thirst damages health. Deceased pets can be buried or revived with a Totem of Undying, preserving identity and appearance.
- Shop and inventory grids use static native Avatar snapshots with bounded image prefetching; they do not create live Avatar renderers on hover. Companion portraits retain sparse expressions with reduced-motion support.

Open Pet from a companion's context menu or the settings navigation. Use food, water and owned outfits directly from the selected pet's care panel. Skins unlock once and can be equipped independently on compatible companions. Consumables support quantity purchases; species unlocks and companion adoption are separate transactions.

Pet can bind an economy instance and account shared with games. Purchases use durable server receipts and recoverable local delivery. Existing saves are backed up before a controlled one-time import; local balances are not trusted cloud assets. Profile usage rewards are paused because aggregate counters cannot exclude game inference, and no deferred rewards accrue. See [shared economy and migration](docs/shared-economy.md) and the [pet system guide](docs/pet-system.md).

## Development

```sh
npm install
npm run check
npm run dev
```

This experimental economy branch uses exact source-built package artifacts recorded in [the economy dependency record](.development/economy-dependencies.json). Its current baseline Host package is `b75fa2c6f9563924feca271242e2709c136033a3`; the public HTTP contract is experimental Protocol `8adc1aab908263e692bd56ca6165b9aeadabe4b9`. The baseline Host does not yet run that HTTP service: a compatible provider artifact must replace it before native use. Unit/HTTP integration evidence does not establish native App acceptance. Do not use the older release baseline below for this source tree.

Avatar dependency provenance is recorded in [the source dependency record](.development/README.md), including the exact source commit and tarball checksum. A tarball built from merged source is not an npm publication; the package manifest and lockfile identify the actual artifact. Avatar React rc.9 is built from canonical merged commit `a06ba84c123cf82e2b1a59c36b403392e22f9d08`; the core is pinned to registry rc.9.

Pet uses public CordisX services. Plugin source updates use Vite development transport; native dependency changes require rebuilding that dependency graph. A full document reload can recover stale React module generations; this release does not claim to fix every Fast Refresh fallback. Launcher-verified local-development visual and usage permissions avoid repeated review; installed plugins retain normal permission review and do not gain microphone access.

## Previous published release

Download `plugin-composer-animal-0.1.1.tgz` and `SHA256SUMS` from [pet v0.1.1](https://github.com/cordisx/plugin-pet/releases/tag/v0.1.1). **That archive contains the earlier single-companion experience, not the new pet system above.** Verify and extract it, then point the pet entry in your existing CordisX composition to `package/dist/runtime/module.js`, retaining other plugins.

The earlier archive uses verified Host `d3e28dc37a357d94b0c177111fdaae4c189d14f0`. It includes the runtime graph, package manifest and dependency notices, without requiring plugin compilation. Distribution is through GitHub Release, not npm, and does not add a one-click marketplace installer.

Public, MIT licensed, and listed in the [CordisX catalog](https://github.com/cordisx/marketplace/blob/main/marketplace.json). The package's `private` flag prevents accidental npm publication.
