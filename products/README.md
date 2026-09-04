# Product registry

`catalog.json` is Instrumenta's stable suite boundary. Every entry owns one product ID,
GitHub repository, release channel, adapter, optional sibling checkout, and tile. Product-specific
build and launch details stay in that product's `instrumenta/product.json`.

Instrumenta reads schema-v1 and schema-v2 product manifests. New release-managed products use v2.
A v2 manifest declares `id`, `name`, semantic `version`, GitHub `repository`, supported `platforms`,
and an adapter object with `releaseManifestAsset` and contained launch candidates.

## Lifecycle contract

Every adapter reports the same user-facing states: available, downloading, installing, installed,
update available, launching, running, or failed. The adapter controls the implementation:

- `web-vite`, `web-static`, and `web-service` retain their existing source/build behavior.
- `native-bundle` is the generic form of the former Motus-specific portable application behavior.
- `managed-bundle` installs a verified release into a versioned Instrumenta product directory and
  retains one prior version until the new version launches successfully.
- `managed-web` installs a released web build through the same verified, versioned path and serves
  it like a packaged web product. No catalog entry uses it yet.
- `installed-desktop` downloads and invokes a product-owned installer, probes Windows installation
  metadata, and launches the independently installed executable.

Git source state is deliberately outside this contract. Instrumenta does not create branches,
commit, merge, resolve conflicts, or silently update developer checkouts.

## Add a release-managed product

1. Create the independent repository and add `instrumenta/product.json` schema v2.
2. Add its stable lowercase ID and GitHub release metadata to `catalog.json`.
3. Package Windows x64 artifacts and attach `instrumenta-release.json` to the GitHub Release.
4. Ensure every asset name is a safe leaf name and every size and SHA-256 digest is exact.
5. Add adapter, offline, interruption, rollback, containment, renderer, and launch tests.
6. Test both the canonical release install and the explicit sibling-checkout developer override.

See `docs/product-lifecycle.md` for release verification, storage, rollback, onboarding, and the
reason repository management remains separate.