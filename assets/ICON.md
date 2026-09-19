# Pet brand icon

`icon.png` is the selected 256 × 256 Pet E artwork. Its SHA-256 is
`259888e036197964deb35af25423410d38054e765aa92c62ec280eec19da2bcb`.

The plugin entry imports the PNG with Vite's `?inline` query and exports the
public `CordisXPluginBrandIcon` descriptor (`mediaType`, base64 `data`). Host owns
validation and rendering in plugin lists; this does not replace semantic action
icons or change the permission manifest. The runtime embeds the bytes, and the
package file allowlist also retains the original PNG for distribution.

This artwork is available from the repository source. The previous v0.1.1
GitHub Release archive predates it and is not replaced by this source change.
Build and verify current source with `npm run check`; `npm pack` includes the
runtime graph and original artwork. No npm publication or version change is
implied.
