# Pet for CordisX

Pet adds interactive companions to the CordisX Composer and a complete care,
collection, shop, inventory, and settings experience. It includes 32 native
OneWorks Avatar characters and 142 breed and color variants. [简体中文](README.zh-Hans.md)

## Install

Register the public CordisX Marketplace source, then install the exact Pet
version by its manifest id:

```sh
npx cordisx@beta source add https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json --yes
npx cordisx@beta plugin install plugin-composer-animal --source https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json --version 0.1.2
```

`--source` selects an already configured and enabled discovery source. It does
not register the source temporarily or make it a trust root. `--yes` confirms
the source-management change; it does not approve plugin permissions. The CLI
does not support an `id@version` shorthand.

For a non-default Host profile, add the same `--profile <profile>` option to
both commands.

## Requirements

- CordisX `0.1.0-beta.11` or a newer compatible Host.
- Network access to GitHub release assets and the public Marketplace feed.
- Permission to render and interact with the controlled Composer visual seats.
- Optional access to local usage totals if you want usage-based pet coins.

The GitHub release archive is prebuilt. It does not require npm installation or
plugin compilation, and this package remains private to prevent accidental npm
publication.

## Use

After installation and Host permission review, open Pet from a companion's
context menu or from **Settings > Pet**.

- Adopt multiple companions, choose the primary pet, rename them, and manage
  which pets appear in Composer.
- Drag, lift, drop, roll, hop, rest, wake, feed, water, play with, and dress
  active companions.
- Browse the shop and inventory for species, skins, food, revival items, water
  dispensers, and feeders.
- Manage fullness, hydration, energy, mood, health, weight, affinity, devices,
  and online exploration for each companion.
- Enable the optional local usage permission to earn pet coins from newly
  observed, validated input and output token totals. Pet coins do not consume
  model quota.

State is stored by the Host for the current profile, plugin source, and plugin
identity. Reloading or upgrading from the same source preserves compatible
state; different profiles or sources do not share it automatically.

## Important Behavior

- Care time advances only while the app and plugin are running. Offline time
  does not consume food, water, energy, or health.
- Prolonged online hunger or thirst can reduce health. Deceased pets may be
  buried or revived with a Totem of Undying while retaining identity and
  appearance.
- Automatic feeders require food from inventory. Water dispensers require
  manual refilling. Neither device creates supplies or buys them automatically.
- The first successful usage connection establishes a baseline. It does not
  convert historical usage into a test balance, and unavailable or incomplete
  intervals are not estimated.
- Reduced-motion settings disable large movement and repeated expression
  animation while preserving core care behavior.

See the [Pet system guide](docs/pet-system.md) for detailed care rules,
progression, persistence, devices, and catalog behavior.

## Permissions

Pet requests controlled rendering for the Composer primary-action and frame
overlay seats. Pointer observation, dragging, and activation are optional and
limited to those seats. Local usage access is also optional and limited to the
current profile. Pet does not request microphone access or read Composer text.

Installation and source discovery never bypass Host permission review. Manage
permissions through the Host's plugin settings.

## Limitations

- Usage rewards cover only locally observable Codex input and output totals;
  they are not an account bill or a cross-device total.
- Care and exploration pause when the app is closed, the system sleeps, or
  persistence is unavailable.
- State is local to its Host profile and plugin source; account sync and
  cross-device migration are not provided.
- The release has been validated as a package and runtime graph. This guide
  does not claim a live installation or activation test for every Host setup.

## Troubleshooting

- **Source or plugin not found:** run the `source add` command first and use the
  exact manifest id `plugin-composer-animal` with `--version 0.1.2`.
- **Pet is not visible:** enable Pet in its settings, keep at least one living
  companion active, and review the Composer rendering permission.
- **Dragging or interaction is unavailable:** review the optional interaction
  permission for Pet in Host settings.
- **Usage rewards are unavailable:** review the optional current-profile usage
  permission. Existing pet state and coins remain available without it.
- **State cannot be saved:** check Host diagnostics and available local storage.
  Pet rejects unsafe writes rather than silently resetting the collection or
  wallet.

Pet is public, MIT licensed, and distributed through the
[CordisX Marketplace](https://github.com/cordisx/marketplace/blob/main/marketplace.json).
