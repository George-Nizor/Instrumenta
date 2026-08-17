# GitHub repository migration

The local worktree now has four independent repositories. Remote repository administration is
deliberately left as a human-controlled step because renaming and changing default branches affect
GitHub URLs and branch protection settings.

Use this order:

1. In GitHub, rename `VideoEditorProject` to `Motus` and `Photo-Editor` to `Imago`. Enable the
   automatic redirects. Create public empty repositories named `Instrumenta` and `Ludere`.
2. On the local checkout, update Motus and Imago remotes to their renamed URLs. Their local
   histories are preserved; Imago is already on the local `main` branch.
3. In each checkout, review the generated/dependency ignores, stage intentionally, commit, and
   push `main`. Do not commit `dist/`, `build/`, `node_modules/`, release binaries, or local AI
   configuration.
4. Set `main` as the default branch in all four GitHub repositories. Add the MIT license and
   enable the checked-in CI workflow in each repository.
5. Verify a clean sibling workspace by cloning all four repositories into one parent directory,
   then run the registry check, launcher tests, product tests, and the product builds.

The parent directory is not a fifth repository. Instrumenta's `products/catalog.json` is the
integration manifest, so future products are added by registering a sibling checkout and its
`instrumenta/product.json` rather than by importing that product's source into the launcher.
