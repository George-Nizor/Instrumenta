# Motus MCP tool map

## Project and media

| Tool | Use |
| --- | --- |
| `motus_create_project` | Create a versioned `.veproj` with an explicit profile. |
| `motus_inspect_project` | Validate and read profile, revision, assets/probes, sequences, tracks, clips, and markers. |
| `motus_refresh_media_integrity` | Re-fingerprint originals read-only and persist Online/Missing/Modified state. |
| `motus_import_media` | Probe and fingerprint a real source, then append its actual linked lanes. |
| `motus_relink_media` | Re-probe a replacement while preserving the asset and clip identity graph. |

## Timeline

| Tool | Use |
| --- | --- |
| `motus_split_clip` | Split a clip and contemporaneous linked counterpart at a project frame. |
| `motus_move_clip` | Move a linked clip pair to an exact start frame. |
| `motus_trim_clip_start` | Move the linked pair's source/timeline start inside the clip. |
| `motus_trim_clip_end` | Set the linked pair's exclusive end frame inside the clip. |
| `motus_ripple_delete` | Remove a half-open range across unlocked tracks and close the gap. |
| `motus_add_marker` | Add a durable labelled marker to a sequence. |
| `motus_remove_marker` | Remove one marker by stable ID. |
| `motus_set_track_state` | Patch lock, mute, and/or visibility without changing omitted flags. |

## Output

| Tool | Use |
| --- | --- |
| `motus_export_simple` | Render the currently supported gapless linked rough-cut subset as MP4. |
| `motus_generate_mlt_graph` | Write diagnostic original-media MLT XML, not a finished render. |

All durable mutations require the latest `expectedRevision`. Paths are absolute. Existing projects,
graphs, and renders reject replacement unless `overwrite: true` is explicit. Motus never modifies
source media and rejects any output that resolves to a project or referenced original.
