# Brand v1 (archived 2026-10-06)

The rendered, sculptural marks Instrumenta used until brand v2 was chosen. Kept so the decision can
be undone. Nothing here ships in the installer.

- `artwork/`, `instrumenta-mark.png`, `packaging-icon.png`: the production marks as they were.
- `tokens.json`, `README.md`: the v1 palette and brand guide.
- `artwork/prompts.json`: the image-generation prompts that made the marks.
- `scripts/build-approved-brand-assets.py`: the v1 asset pipeline. Its paths assume it lives in
  `Instrumenta/scripts/`, and it copies art into sibling repositories, so move it back before running.
- `luna/`: Luna's 1-bit look, copied from the Luna repository at the commit in `SOURCE-COMMIT`:
  its icon, its source image, its `.ico`, and the stylesheet (`luna-1bit-styles.css`, from
  `app/static/styles.css`). Luna itself is unchanged.

Sibling repositories still carry their own copies of v1 art until each product's brand review.
