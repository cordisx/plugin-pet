# Local dependency candidate

Pet currently consumes `@oneworks/avatar-react` through the committed development tarball in `dependencies/avatar-react-f1a366c.tgz`.

- Source repository: `oneworks-ai/avatar`
- Base commit: `473341758fc479f5e963135cdb9bd08b9d2f3d10`
- Fix commit: `f1a366cfc7ebf5c47ccbab10c9d070366f7d5936`
- Tarball SHA-256: `975ff921725b0bfcc1025254b79b8d532748731822580ddbbccafabd4324f365`
- Fix: resolve the complete native preset/breed scene, including topology, organ materials and surface decals, before generating procedural coats. Explicitly supplied parts retain their materials and explicit decals override same-ID native decals. Includes the previous e77997f fix.
- Performance: bounded native scene cache and memoized coat/decal resolution keep geometry references stable during expression and care updates. Three cache/reference regression tests pass.
- Verification: 35 rendering tests plus explicit-decal override regression, strict React package typecheck, public core and React package builds.

The tarball retains upstream's `1.0.0-rc.8` package version but is a local source candidate, **not** the registry artifact with that version. Its file dependency and lockfile integrity make this distinction explicit. The framework-neutral core remains the registry `@oneworks/avatar@1.0.0-rc.8`.

Replace this file dependency with the exact formal upstream release before publishing the next Pet package. No remote release has been performed for this candidate. Native preset part morphing remains a separate public API gap; Pet uses whole-entity motion rather than private geometry imports.
