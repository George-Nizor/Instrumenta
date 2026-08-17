# Imago MCP tool map

## Editable documents

| Tool | Use |
| --- | --- |
| `list_templates` | Discover exact templates, slots, sizes, backgrounds, and effects. |
| `create_document` | Create a thumbnail, title card, or custom `.imago.json` document. |
| `list_documents` / `get_document` | Find and inspect persisted documents. |
| `delete_document` | Delete one confirmed document, never exports or source media. |
| `replace_slot` | Replace background/subject/support content while preserving geometry. |
| `import_image` | Embed a free image layer. |
| `add_text` / `update_text` | Create and tune typography/effects. |
| `update_layer` | Change visibility, opacity, lock, role, blend, transform, or outline. |
| `set_background` | Generate a deterministic seeded background. |
| `duplicate_layer` / `reorder_layer` / `delete_layer` | Manage non-template layers. |
| `cutout_layer` | Apply local ONNX background removal to an editable layer. |
| `set_image_grade` | Set or bake brightness, contrast, and saturation. |
| `apply_beauty` | Bake the editor's local beauty pass. |
| `edit_image_pixels` | Bake a bounded erase or liquify warp/bloat/pucker stroke. |
| `edit_animation` | Manage frames and FPS. |
| `export_document` | Export active frame as PNG/JPG. |
| `export_animation` | Export GIF or numbered PNG frames. |
| `open_document_in_imago_source` | Hand an MCP document into the source/Vite visual editor. |

## One-shot output and shared defaults

| Tool | Use |
| --- | --- |
| `create_youtube_thumbnail` | Make a finished conventional thumbnail. |
| `create_guided_thumbnail` | Make a constrained high-legibility thumbnail. |
| `create_title_card` | Make a transparent title PNG. |
| `create_video_artefact` | Make intros, chapters, lower thirds, slates, tags, or quote cards. |
| `create_modern_artefact` | Make stylized posters/photo compositions. |
| `remove_background` | Export a standalone transparent PNG cutout. |
| `list_background_variants` / `list_fonts` | Discover supported recipes. |
| `get_brand_kit` / `update_brand_kit` | Read or persist MCP composition defaults. |
| `open_imago` / `open_export` | Perform an explicitly requested visible open action. |

All paths must be absolute. Editable documents live in Imago's local MCP document directory; exports are confined to Imago's exports directory. Existing files reject replacement unless the tool exposes and receives `overwrite: true`.
