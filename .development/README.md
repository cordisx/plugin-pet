# Local dependency candidate

Pet currently consumes `@oneworks/avatar-react` through the committed development tarball in `dependencies/avatar-react-e77997f.tgz`.

- Source repository: `oneworks-ai/avatar`
- Base commit: `473341758fc479f5e963135cdb9bd08b9d2f3d10`
- Fix commit: `e77997f1a08ca84e0755d8cea57ed0f9fca891be`
- Tarball SHA-256: `698ffd460ddf4802f922bf460dcef3981852243c3a3380445cdbca232c18752a`
- Fix: resolve native preset parts and apply their palette before generating coat decals. Explicitly supplied parts retain their materials.
- Verification: 31 rendering tests, strict React package typecheck, public core and React package builds.

The tarball retains upstream's `1.0.0-rc.8` package version but is a local source candidate, **not** the registry artifact with that version. Its file dependency and lockfile integrity make this distinction explicit. The framework-neutral core remains the registry `@oneworks/avatar@1.0.0-rc.8`.

Replace this file dependency with the exact formal upstream release before publishing the next Pet package. No remote release has been performed for this candidate. Native preset part morphing remains a separate public API gap; Pet uses whole-entity motion rather than private geometry imports.
