# Ludere MCP tool map

## Project lifecycle

| Tool | Use |
| --- | --- |
| `ludere_create_document` | Create a screenplay/free-writing portable project. |
| `ludere_open_document` | Read the complete normalized project and edit hash. |
| `ludere_inspect_document` | Get compact metadata and structural counts. |
| `ludere_validate_document` | Validate a file or inline document without writing. |
| `ludere_save_document` | Atomically save a complete validated document. |
| `ludere_update_metadata` | Change title and title-page fields. |

## Screenplay blocks

| Tool | Use |
| --- | --- |
| `ludere_add_blocks` | Insert typed blocks at an index or before/after an ID. |
| `ludere_update_blocks` | Patch text, inline emphasis, or element type by ID. |
| `ludere_reorder_blocks` | Move a stable group of block IDs. |
| `ludere_delete_blocks` | Delete explicit block IDs. |
| `ludere_search_document` | Search blocks, beats, and metadata with filters. |

## Beat board

| Tool | Use |
| --- | --- |
| `ludere_add_beats` | Add beat cards. |
| `ludere_update_beats` | Change act, title, text, or color by beat ID. |
| `ludere_reorder_beats` | Reorder a stable group of beat IDs. |
| `ludere_delete_beats` | Delete explicit beat IDs. |
| `ludere_import_scenes_to_board` | Add missing scene headings across three acts. |

## Interchange

| Tool | Use |
| --- | --- |
| `ludere_import_document` | Import portable JSON, FDX, or plain/Fountain-like text. |
| `ludere_export_document` | Export Ludere, FDX, indented text, or printable HTML. |

All mutating tools accept or benefit from the latest `expectedHash`. Paths must be absolute. New destinations reject existing files unless `overwrite: true` is explicit.
