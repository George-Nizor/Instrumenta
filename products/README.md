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
- `native-bundle` — discover a verified self-contained desktop bundle and use its launch probe.

If a product needs a different lifecycle, add a new adapter implementation and tests in the
Instrumenta repository rather than adding product-specific conditionals throughout the launcher.
