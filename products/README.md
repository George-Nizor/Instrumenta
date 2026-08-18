# Product registry

`catalog.json` is the suite boundary. Each entry points to a sibling checkout and names the
adapter Instrumenta uses to discover, prepare, launch, package, and expose the product's MCP.

To add another product:

1. Put the checkout beside `Instrumenta/` and add `instrumenta/product.json` to that checkout.
2. Add one stable lowercase ID, source directory, adapter, package policy, and tile entry to
   `catalog.json`.
3. Keep the product's build, launch, MCP, and version details in its own manifest. Add its AI
   skill under that product's `ai/skills/` directory.
4. Run `node scripts/product-registry.cjs` and the launcher tests before packaging.

The supported adapters are intentionally small and explicit:

- `web-vite` — install dependencies, run the product's build command, and serve its output.
- `web-static` — run the product's static build command and serve the resulting directory.
- `web-service` — install and build the product, then start and supervise its own local server.
- `native-bundle` — discover a verified self-contained desktop bundle and use its launch probe.

A `web-service` manifest sets `launch.type` to `service` and adds `launch.command` (a
`node`, `npm`, `pnpm`, or `corepack` invocation), an optional `launch.cwd` inside the product
root, an optional `launch.env` of uppercase variables, and a `launch.health` URL path such as
`/api/health`. Instrumenta chooses the registered port (or its fallback), passes `PORT` and
`HOST`, waits for the health path to answer, applies its own response security headers, and
stops the whole process tree when the product window closes.

If a product needs a different lifecycle, add a new adapter implementation and tests in the
Instrumenta repository rather than adding product-specific conditionals throughout the launcher.
