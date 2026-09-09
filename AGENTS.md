# pet repository guide

Keep plugin behavior and documentation in this repository. Consume public CordisX and Avatar APIs; do not inspect private Host state from plugin code.

Before style changes, read the canonical [CSS ownership and maintenance rule](https://github.com/cordisx/cordisxmono/blob/main/.agents/rules/css.md). Style only the plugin-owned visual surface.

Use `npm run check` for code changes and verify interaction changes in the active isolated native preview. Do not restart the user's application merely to refresh plugin code.

Preserve exact experimental dependency evidence in development pull requests. Release only after dependencies have formal compatible revisions. Shop and progression issues are backlog unless explicitly selected.

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
