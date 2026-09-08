# Merged-source Avatar dependency

Pet consumes `@oneworks/avatar-react` through `dependencies/avatar-react-a06ba84-rc9.tgz`, built from the canonical merged source of [Avatar PR #39](https://github.com/oneworks-ai/avatar/pull/39).

- Source commit: `a06ba84c123cf82e2b1a59c36b403392e22f9d08`.
- Source tree: `3200bd922aa2fbdc2d54af679e6d423cf54314a5`.
- Package version: `1.0.0-rc.9`.
- SHA-256: `de162336a62e33fcb336e7097eb87531a5747a7f222ef362c0541888c4d0d021`.
- Core dependency: registry `@oneworks/avatar@1.0.0-rc.9`.
- Consumer entry points: `@oneworks/avatar-react/renderer` and `@oneworks/avatar-react/renderer.css`, excluding the editor surface from the Pet runtime.

This is a package built from merged source, **not** an npm registry publication of Avatar React rc.9. The file dependency and lockfile identify its actual artifact. The former `f1a366c` feature-branch tarball has been removed. Machine-readable provenance and upstream validation are in [SOURCE.json](SOURCE.json).

The merged renderer includes native preset/breed palette and coat resolution, bounded scene caching and a renderer-only entry. Keep the precise source record when integrating this checkout. Publishing another Pet release remains a separate delivery step requiring compatible dependency revisions and full package verification.
