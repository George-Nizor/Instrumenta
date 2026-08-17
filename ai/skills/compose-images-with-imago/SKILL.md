---
name: compose-images-with-imago
description: Create, inspect, edit, render, and open local Imago graphics through the Imago MCP. Use for YouTube thumbnails, title cards, social graphics, reusable template slots, backgrounds, subject cutouts, image grades, beauty passes, layered text effects, short GIF or PNG-sequence animation, brand-kit work, `.imago.json` documents, and PNG/JPG exports.
---

# Compose Images with Imago

Use editable Imago documents for work that may be revised. Use one-shot artifact tools only when the user wants a final render and no layer-level handoff.

## Choose the workflow

- For thumbnails, start with `list_templates`, then `create_document` using a 16:9 template and the requested 4K, 1080p, or 720p size.
- For reusable compositions, replace named slots instead of manually rebuilding geometry. Fill background, title, subject, and support slots in that order unless the content suggests otherwise.
- For custom canvases or title cards, create an editable document, then add image and text layers.
- For a single finished artifact, use the relevant `create_*` tool and skip document creation.

## Build an editable composition

1. Use a stable lowercase `documentId` and caller-chosen layer IDs.
2. Inspect the document after creation to learn exact slot and layer IDs.
3. Use absolute local paths for imported media. Preserve source files; media is embedded into the document.
4. Prefer normalized template placement and `replace_slot` for repeated thumbnails.
5. Apply cutout before outline, then grade or beauty. These operations are local and may take longer on first use.
6. Tune text with a named effect before reaching for individual effect parameters. Keep thumbnail copy short and legible at small size.
7. Export only after checking size, visibility, layer order, and frame count.

## Animate and export

- Use `edit_animation` to duplicate, select, move, or delete frames and to set 1–30 FPS.
- Export one frame as PNG/JPG, or all frames as GIF/numbered PNG sequence.
- Keep dimensions paired. Avoid an unnecessary upscaled export when the source composition is smaller.
- Do not overwrite an existing export unless the user approves the exact target.
- Use `open_document_in_imago_source` when the user wants to continue visually in a source checkout,
  and report the persisted document and export paths. This handoff intentionally does not pretend to
  control an already-installed static editor.

## Preserve user intent

- Inspect before deleting a document or free layer. Template-slot layers intentionally resist delete, duplicate, and reorder; replace their contents instead.
- Treat `open_imago`, `open_document_in_imago_source`, and `open_export` as visible UI actions. Invoke
  them only when the user asked to open something.
- Update the saved brand kit only when the user explicitly wants a persistent default; use per-composition overrides otherwise.
- Read [the tool map](references/tools.md) for the complete editable and one-shot surface.
