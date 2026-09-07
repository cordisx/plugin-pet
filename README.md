# pet

## Prebuilt download

Download `plugin-composer-animal-0.1.1.tgz` from [pet v0.1.1](https://github.com/cordisx/plugin-pet/releases/tag/v0.1.1), verify it against `SHA256SUMS`, and extract it. The archive includes the complete prebuilt runtime, the formal `cordisx-package.json` installation manifest, and dependency license notices. No `npm install` or plugin compilation is needed.

Use the compatible Host source revision below. In your existing CordisX composition, point the pet entry to the extracted `package/dist/runtime/module.js` and retain the other configured plugins. The package directory also passes the Host's formal local-package resolver and immutable-store staging checks. This release does not add a one-click marketplace installer or publish to the npm registry. Normal installed-plugin permission review still applies.


Experimental CordisX plugin using two controlled visual seats. The native
Composer retains its button, actions, keyboard handling and accessibility.

The built-in white cat (`entity.preset: cat`, `paletteId: white`) uses a real OneWorks Avatar (`@oneworks/avatar` and `@oneworks/avatar-react`, exact
1.0.0-rc.8) with two rounded vertical eyes and its original palette. Both the primary face and 128px peeking overlay follow
normalized pointer movement only after a separate review. Gaze holds its last
direction when the pointer is unavailable and eases toward new positions.
The upper cat opts into snapshot v2 for recording and transcription state. The native dictation button remains unchanged; no audio or transcript
is received. The plugin never
receives draft text.

```sh
npm install
npm run check
npm run dev
```

The `cordisx` dependency uses a sibling Host source checkout; see the exact
development revisions below. This repository is public and MIT licensed. The
package remains private to prevent accidental npm publication. The
[community marketplace](https://github.com/cordisx/marketplace/blob/main/marketplace.json)
provides discovery metadata; prebuilt archives are available through GitHub Releases.

Only component exports live in the lazy Avatar module. The original SVG test
orb remains in `src/animal-visual.tsx` as a reference. Definition changes must be
verified in the preview; this integration used a cold load after a stale model
update, so model-module Fast Refresh is not yet claimed.
The entry wraps components with `defineReactVisual(Component, { kind: 'react-dom-v1' })` after the Host authorizes an
available seat. `cordisx/vite` produces the complete indexed ESM graph under
`dist/runtime`; no custom HMR transport or editor UI is mounted.

Avatar editing remains future work. Artwork stays inert; the Host supplies an optional controlled hit region for the upper cat. Unrecognized native operations retain native visuals.
Interaction permission lasts for one plugin generation and can be revoked
independently of rendering.

For optional visual design defaults, see the Host [Composer visual recommendations](https://github.com/cordisx/cordisx/blob/main/.agents/docs/composer-visuals.md#recommended-visual-defaults). These are guidance, not additional validation requirements.

Launcher-verified local development previews automatically authorize declared
visual rendering and pointer observation for this session. Installed plugins
retain their permission review; this does not grant microphone access.

The Avatar component itself is non-interactive. This plugin owns its definition, scoped styles,
color/state mapping and a disposed animation-frame gaze scheduler; reduced motion
applies orientation immediately. Pose updates are coalesced to at most 30/s,
with stable geometry/material references and memoized rendering. The small cat
retains the complete head and ears in a square transparent viewport, with no added
background disk. The Host hides the native button background while a replacement is mounted. The Host supplies snapshots, not Avatar
behavior. Editing and custom asset selection are not exposed.

The cat uses the built-in preset geometry (including ears) and its native palette,
without a CSS color filter. State color values remain projected in plugin data; a visible
recording/transcription treatment is still pending after removing the rejected tint. Its frame stays transparent and does not apply the orb
reference's circular clipping. The preset/palette are configured in
`src/avatar-model.ts`.

Hovering the lower cat plays a single mouthless Wink through the public Avatar animation resolver. Leaving restores the face, re-entry can replay, and pointer following continues. Reduced motion skips the animation.

With authorized `drag` and `activate` events, the upper cat can be lifted and moved sideways. Releasing drops it to the Composer edge while retaining its horizontal position; grabbing it during a fall continues from its current position. Bounds changes clamp the position. Reduced motion returns it immediately. No position is persisted across reloads.

Upper-avatar clicks use eyes and whole-head motion without ear-specific animation: a soft compression and rebound, gradual withdrawal under repeated pokes, then a restrained half-lidded stare. Disturbance accumulates with rapid input and fades during rest. Each poke adds a small impulse to the current motion instead of restarting it; actual dragging clears both feedback and accumulated emotion. Lifting the upper cat shows asymmetric surprised eyes; falling widens both pupils, and landing restores the face. The upper cat has no hover Wink. Dragging and falling take priority over click reactions. The lower cat retains its current hover animation; state animations are not selected yet. All hit testing and pointer capture belong to the Host through the public drag handle.

The upper head gently morphs toward a teardrop while lifted and returns from its current shape on release. A single public, controlled Avatar timeline preserves continuity during quick release and re-grab. Landing adds a short squash and rebound. Reduced motion skips both effects. The upper definition enables public lighting with distance zero: Avatar 1.0.0-rc.8 needs that rendering path to keep implicit preset head geometry visible during a shape morph. No vendor code or preset geometry is copied. The white palette keeps the head and ears consistent.

## Development dependency checkpoint

The source integration uses formally merged CordisX Host `d3e28dc37a357d94b0c177111fdaae4c189d14f0` ([PR 349](https://github.com/cordisx/cordisx/pull/349)) and Protocol `06277f9d117893a9215c991db8c0881df0f0b0f3` ([PR 119](https://github.com/cordisx/cordisx-protocol/pull/119)). This records the tested source baseline required by the marketplace entry; the older published Host beta does not contain the required APIs. Use the prebuilt download above to avoid compiling the plugin.

Place the Host checkout at `../cordisx`, select the exact revision recorded in this PR, install/build it using its own guide, then run `npm ci` and `npm run check` here. The relative dependency supports the canonical Mono sibling layout; no machine-specific path is required.

Shop and progression are deferred to [issue 1](https://github.com/cordisx/plugin-pet/issues/1). Existing Avatar skin capabilities will be reused, not rebuilt.
