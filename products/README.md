# Product registry

`catalog.json` is Instrumenta's stable suite boundary. Every entry owns one product ID,
GitHub repository, release channel, adapter, optional sibling checkout, and tile. Product-specific
build and launch details stay in that product's `instrumenta/product.json`.

Instrumenta reads schema-v1 and schema-v2 product manifests. New release-managed executables
(`managed-bundle`, `installed-desktop`) use v2. A v2 manifest declares `id`, `name`, semantic
`version`, GitHub `repository`, supported `platforms`, and an adapter object with
`releaseManifestAsset` and contained launch candidates. A `managed-web` product keeps its schema-v1
web manifest (launch port and CSP profile) and takes its repository, and `releaseManifestAsset` if
the entry names one, from its catalog entry.

The catalog's order is the order the launcher lists products in. Fabula is first.

## Lifecycle contract

Every adapter reports the same user-facing states: available, downloading, installing, installed,
update available, launching, running, or failed. A product that runs from a source checkout reports
`developer-only` while no workspace holds one. The adapter controls the implementation:

- `web-vite`, `web-static`, and `web-service` retain their existing source/build behavior.
- `native-bundle` is a deployed folder with `<id>-bundle.json` naming an executable and optional
  launch arguments. Fabula (an Electron runtime handed the checkout as its application) uses it;
  see `docs/product-lifecycle.md` for the manifest and launch-check contract.
- `managed-bundle` installs a verified release into a versioned Instrumenta product directory and
  retains one prior version for rollback; older versions are pruned.
- `managed-web` installs a released web build through the same verified, versioned path, serves it
  like a packaged web product, and is polled for updates like the other release adapters. Imago,
  Ludere and LearnChess use it; their own manifests still say `web-vite` or `web-static`, which is
  how they are built (`builtAs`).
- `installed-desktop` downloads and invokes a product-owned installer, probes Windows installation
  metadata, and launches the independently installed executable.

Git source state is deliberately outside this contract. Instrumenta does not create branches,
commit, merge, resolve conflicts, or silently update developer checkouts.

## Add a release-managed product

1. Create the independent repository and add `instrumenta/product.json` (schema v2, or schema v1
   for a `managed-web` product).
2. Add its stable lowercase ID and GitHub release metadata to `catalog.json`.
3. Package Windows x64 artifacts and attach `instrumenta-release.json` to the GitHub Release.
4. Ensure every asset name is a safe leaf name and every size and SHA-256 digest is exact.
5. Add adapter, offline, interruption, rollback, containment, renderer, and launch tests.
6. Test both the canonical release install and the explicit sibling-checkout developer override.

See `docs/product-lifecycle.md` for release verification, storage, rollback, onboarding, and the
reason repository management remains separate.