# pet repository guide

Keep plugin behavior and documentation in this repository. Consume public CordisX and Avatar APIs; do not inspect private Host state from plugin code.

Before style changes, read the canonical [CSS ownership and maintenance rule](https://github.com/cordisx/cordisxmono/blob/main/.agents/rules/css.md). Style only the plugin-owned visual surface.

Use `npm run check` for code changes and verify interaction changes in the active isolated native preview. Do not restart the user's application merely to refresh plugin code.

Preserve exact experimental dependency evidence in development pull requests. Release only after dependencies have formal compatible revisions. Shop and progression issues are backlog unless explicitly selected.
