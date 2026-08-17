---
name: write-screenplays-with-ludere
description: Create, inspect, revise, structure, search, import, and export local Ludere screenplay and story-board projects through the Ludere MCP. Use for screenplay drafting, scene or dialogue edits, beat-board planning, title-page metadata, `.ludere` files, Final Draft `.fdx` interchange, Fountain-like/plain-text imports, and printable screenplay exports. Do not use for browser theme, focus-sprint, or localStorage control.
---

# Write Screenplays with Ludere

Use Ludere's local MCP to produce a portable project the browser editor can open. Preserve stable block and beat IDs so the user can move between agent work and the visual editor without losing structure.

## Start safely

1. Resolve every project, source, and export path to an absolute path.
2. Open or inspect an existing project before changing it. Retain the returned `documentHash` and pass it as `expectedHash` on the next write.
3. Create a new `.ludere` file only at the user's requested location. If only a title was supplied, use a filesystem-safe title in the current working directory and tell the user the resolved path.
4. Never set `overwrite: true` unless the user requested replacement or already approved that exact destination.

## Draft and revise

- Add screenplay material as typed blocks: `scene`, `action`, `character`, `dialogue`, `parenthetical`, `transition`, `shot`, or `general`.
- Prefer one batched `ludere_add_blocks` or `ludere_update_blocks` call for a coherent passage. Use the IDs returned by the tool for later edits.
- Let committed-type inference classify pasted screenplay prose when useful; set explicit block types when format matters.
- Re-open the project after a stale-hash error, reconcile against the latest IDs and content, then retry only the intended change.
- Search before broad replacements. Update by stable ID; do not infer identity from repeated dialogue text.

## Plan the story

- Use beat tools for the three-act board. Treat act as `1`, `2`, or `3` and preserve the user's chosen color.
- Use `ludere_import_scenes_to_board` to seed missing scene-heading cards. It is deliberately additive and avoids headings already represented.
- Inspect after structural edits to confirm scene, block, beat, character, word, and estimated-page counts.

## Import and deliver

- Import `.fdx` as Final Draft, `.ludere`/`.json` as portable Ludere, and text/Fountain-like files as plain script. Keep the source untouched and write a separate `.ludere` destination.
- Export `.ludere`, `.fdx`, indented text, or printable HTML with `ludere_export_document`.
- Explain that PDF remains a browser print action: export printable HTML or open the project in Ludere, then print to PDF.
- State the final project path, export path, and a compact structural summary.

## Respect the boundary

Operate on explicit portable files only. Do not claim to mutate the browser's origin-scoped autosave, undo stack, theme, active view, or focus sprint. These are UI session features. Read [the tool map](references/tools.md) when choosing less common operations or handling conflicts.
