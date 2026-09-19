# pet repository guide

Keep plugin behavior and documentation in this repository. Consume public CordisX and Avatar APIs; do not inspect private Host state from plugin code.

Before style changes, read the canonical [CSS ownership and maintenance rule](https://github.com/cordisx/cordisxmono/blob/main/.agents/rules/css.md). Style only the plugin-owned visual surface.

Use `npm run check` for code changes and verify interaction changes in the active isolated native preview. Do not restart the user's application merely to refresh plugin code.

Preserve exact experimental dependency evidence in development pull requests. Release only after dependencies have formal compatible revisions. Shop and progression issues are backlog unless explicitly selected.

## Documentation ownership

- Keep `README.md` and `README.zh-Hans.md` focused on installation,
  prerequisites, permissions, use, limitations, and troubleshooting.
- Keep development, architecture, debugging, testing, contribution, dependency
  provenance, and release procedures in this file or an indexed maintainer
  guide. Do not mirror README prose in product tests.
- Keep detailed user-facing care and progression behavior in
  [the Pet system guide](./docs/pet-system.md).

## Development

Use the Node version declared in `package.json`. On a fresh checkout:

```sh
npm ci
npm run check
```

Reuse an existing compatible dependency installation for incremental work.
Use `npm run dev:dry-run` to validate development resolution without launching
an App. Use `npm run dev` only for an explicitly authorized isolated native
preview; do not restart or alter an unrelated running App.

The CordisX development dependency is pinned to canonical merged Host source.
Pet requires the public bounded Manager content seats, local-development usage
authorization, Composer menu v2, notifications, and the controlled visual and
interaction contracts used by the manifest. Keep the Protocol override so
public branded types resolve to one copy.

## Runtime boundaries

- Pet uses only public CordisX and OneWorks Avatar APIs. Do not inspect private
  Host state, native DOM, raw Composer text, raw pointer streams, microphone
  input, or private session files.
- Keep top-level evaluation declarative. Register visuals, pages, routes,
  documents, usage subscriptions, notifications, and cleanup through the Cordis
  lifecycle.
- The Host owns native button actions, menu behavior, accessibility, routing,
  controlled hit regions, permissions, persistence isolation, and contribution
  cleanup.
- Preserve state compatibility for existing pets, inventory, devices, wallet,
  receipts, settings, and usage settlement progress. Unknown or corrupt state
  must fail closed instead of resetting user data.
- Do not claim account billing or cross-device coverage from the local usage
  service. The first valid observation establishes a baseline; gaps remain
  explicit and are never estimated.

## Avatar dependency

Avatar dependency provenance is recorded in
[the source dependency record](./.development/README.md) and
`.development/SOURCE.json`. `@oneworks/avatar-react` rc.9 is the repository
archive built from canonical merged commit
`a06ba84c123cf82e2b1a59c36b403392e22f9d08`; `@oneworks/avatar` is pinned to
registry rc.9. Preserve the exact source, tree, package version, archive digest,
and renderer-only imports when updating this dependency.

A tarball built from merged source is not an npm publication. Do not replace
the recorded file dependency with a registry claim unless that exact upstream
artifact has actually been published and verified.

## Build and verification

`npm run check` runs type checking, the production Vite build, declaration
generation, package-manifest generation, and repository tests. The production
build must retain the complete `dist/runtime/artifact.json` graph, including
the stable entry, lazy modules, styles, and assets with their generated digests.

Before a release, also run:

```sh
npm pack --dry-run
git diff --check
```

Inspect `cordisx-package.json`, `dist/manifest.json`, and
`dist/runtime/artifact.json`; confirm the package version, manifest id,
runtime entry, indexed file set, byte lengths, and digests. Extract the final
archive into a clean temporary directory and verify its contents without
`node_modules`.

Package and static runtime checks do not prove live installation, activation,
permission acceptance, interaction, persistence, or user acceptance. State
each evidence layer separately.

## Release

- Keep `private: true`; Pet is not published to npm.
- Release prebuilt archives through the repository's existing GitHub prerelease
  convention. Use tag `v<version>`, asset
  `plugin-composer-animal-<version>.tgz`, and a matching `SHA256SUMS` file.
- Merge through a protected pull request before tagging. Do not force-push,
  bypass checks, invite reviewers, or publish from an unmerged source commit.
- Build and pack again from the exact merged commit. Upload that exact archive,
  download it from GitHub after publication, and verify SHA-256, package name,
  package version, manifest id, runtime entry, README files, portable package
  manifest, runtime manifest, and complete indexed graph.
- Marketplace publication is separate. Provide the exact tag, source commit,
  asset URL, size, and SHA-256 to the catalog owner; do not add an artifact or
  certification record before the release asset exists and is verified.

## Operation notifications

Use the public `ctx.notifications.show()` service for operation feedback and
require `notifications` in plugin injection. Do not create a custom Toast,
manually positioned alert, or page-wide success/error paragraph. Keep field
validation and durable business state beside the relevant object. Use stable
semantic `kind` values, localized safe text, and notification rules owned by Host;
never expose raw exceptions or notify on every polling attempt.
See the [Host notification guide](https://github.com/cordisx/cordisx/blob/3cfe370eb7abf33e16686fbd82659cd441247fbd/.agents/docs/notifications.md)
for the interaction contract and older-Host capability boundary.

Dependency setup: [notification migration](./.agents/docs/notifications.md).
