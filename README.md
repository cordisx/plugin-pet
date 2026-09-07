# pet

A small pet system living on Composer, rendered with real OneWorks Avatar cats, dogs and rabbits. The Host retains native button actions, keyboard behavior and accessibility. [简体中文](README.zh-Hans.md)

## Current development

- Shop, collection, inventory and outfits, interaction settings, and transaction history.
- A free starter cat, two skins and three snacks; companion affinity can unlock a dog and rabbit, with coin purchases as another path.
- Independent companions on Composer: drag, lift and drop, roll, hop and sleep. The selected main pet also appears on the primary action button.
- Host-controlled context menus for feeding, outfits, main-pet selection, hiding and settings.
- Per-pet fullness, energy, health, weight and affinity. Weight gradually affects visible size.
- **Care pauses offline.** Prolonged online starvation damages health. A deceased pet can be buried or revived with a Reboot Core, preserving its name, appearance and affinity.
- Static sleep still restores energy when autonomous animation is disabled or reduced motion is enabled.

Open My Pets from the upper companion's context menu or the settings navigation. Only owned skins can be equipped; unowned skins can be previewed. Food is consumed, and permanent goods cannot be bought twice. Changes apply immediately.

Trusted local Token usage integration is in progress. Until connected, the interface explicitly marks rewards unavailable and never creates a test balance. Pet coins do not consume model quota. See the [pet system guide](docs/pet-system.md) for care timing, recovery and implementation boundaries.

## Development

```sh
npm install
npm run check
npm run dev
```

The `cordisx` development dependency uses a sibling `../cordisx/packages/cli` checkout. The current multi-entity development input is experimental Host [PR #375](https://github.com/cordisx/cordisx/pull/375), commit `368417dd224cf11f7da4ae186882d5ccdec6997b`, consuming formally merged Protocol `7ab6861b943989d71781ada94d28704fbbc9f793`. This is not yet a formal release compatibility set.

Pet uses public CordisX services and exact Avatar 1.0.0-rc.8 packages. Plugin changes use Vite HMR; Host, dependency or launch-configuration changes require replacing the development runtime. Launcher-verified local visual permissions are automatically authorized; installed plugins retain normal review and do not gain microphone access.

## Previous published release

Download `plugin-composer-animal-0.1.1.tgz` and `SHA256SUMS` from [pet v0.1.1](https://github.com/cordisx/plugin-pet/releases/tag/v0.1.1). **That archive contains the earlier single-companion experience, not the new pet system above.** Verify and extract it, then point the pet entry in your existing CordisX composition to `package/dist/runtime/module.js`, retaining other plugins.

The earlier archive uses verified Host `d3e28dc37a357d94b0c177111fdaae4c189d14f0`. It includes the runtime graph, package manifest and dependency notices, without requiring plugin compilation. Distribution is through GitHub Release, not npm, and does not add a one-click marketplace installer.

Public, MIT licensed, and listed in the [CordisX catalog](https://github.com/cordisx/marketplace/blob/main/marketplace.json). The package's `private` flag prevents accidental npm publication.
