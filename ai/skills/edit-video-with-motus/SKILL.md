---
name: edit-video-with-motus
description: Create, inspect, repair, edit, graph, and export local Motus rough-cut video projects through the Motus MCP. Use for `.veproj` projects, probed audio/video imports, source-integrity checks and relinks, linked A/V moves or trims, clip splits, ripple deletion, timeline markers, track state, diagnostic MLT graphs, and supported H.264/AAC MP4 renders.
---

# Edit Video with Motus

Use Motus for durable, frame-accurate rough cuts that may be reopened in the desktop editor. Motus
references originals in place and fingerprints them read-only; never copy, rename, transcode, or
modify source media unless the user separately asks for that outside this workflow.

## Start from current state

1. Use absolute paths for projects, media, graphs, and exports.
2. Inspect an existing project before editing it. Retain its returned `revision` and pass that value
   as `expectedRevision` to every durable mutation.
3. If Motus rejects a stale revision, inspect again, reconcile IDs and timing against the latest
   project, then apply only the intended change.
4. Create or export to a new path by default. Set `overwrite: true` only after the user approves that
   exact destination; never target the `.veproj` or referenced source media.

## Import and verify media

- Prefer `motus_import_media`. It invokes the configured FFprobe directly, stores canonical stream
  metadata, fingerprints the source, and creates only the audio/video lanes that actually exist.
- Use `motus_refresh_media_integrity` before a substantial edit or export. Stop if an original is
  Missing, Modified, or Unsupported.
- Use `motus_relink_media` only with the user's replacement file. It preserves the asset ID and every
  referring clip ID while re-probing the replacement.
- Do not use the hidden provisional append compatibility operation. A fully probed import is required
  for truthful preview and export.

## Build the rough cut

- Read sequence, track, clip, marker, and asset IDs from `motus_inspect_project`; do not infer them
  from display names.
- Express edits in integer project frames. Split strictly inside a clip. Move and trim operate on the
  selected clip and its contemporaneous linked A/V counterpart.
- Use ripple deletion for a half-open `[startFrame, endFrame)` range. It changes every unlocked track
  and shifts affected markers, so inspect the result immediately afterwards.
- Set track lock/mute/visibility deliberately before edits or export. A locked linked counterpart can
  make an edit fail atomically; do not silently unlock it.
- Add markers for editorial intent and report their stable IDs. Inspect before removing one.

## Render and hand off

- Use `motus_export_simple` only after a fresh integrity check and inspection. The native renderer is
  intentionally strict: it supports a gapless visible video lane and its exactly mirrored, unmuted
  audio lane, rendered from originals to H.264/AAC MP4.
- MCP rendering is synchronous and bounded by `timeoutSeconds`; it is not protocol-cancellable.
  Choose a realistic timeout before calling. Timeout and renderer failure remove the private partial
  file, after which a later call may safely retry.
- If export rejects an unsupported timeline, preserve the project and explain the exact structural
  limitation. Do not claim that a diagnostic MLT graph is a finished video.
- Use `motus_generate_mlt_graph` only when the user wants diagnostic/interchange XML.
- After export, report the project path, output path, sequence, dimensions, frame rate, duration, and
  any integrity or renderer limitations.

Interactive preview transport, in/out marks, zoom/snap preferences, and desktop undo history are
session UI state rather than durable project operations. Read [the tool map](references/tools.md) for
the complete supported MCP surface.
