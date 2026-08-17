# Instrumenta editor UI system

Imago and Motus are sibling instruments, not skins of the same application. They share interaction
geometry, icon language, accessibility, and surface hierarchy while using colour to communicate their
different media domains.

## Shared interaction contract

- Frequent and conventional commands use a 24-by-24 outline icon inside a 36–40 px target.
- Every icon-only control has an accessible name, a full-word tooltip on hover and keyboard focus,
  and a visible pressed/checked state when it toggles.
- Product and panel names remain visible. Destructive, uncommon, and ambiguous commands keep words.
- The top bar stays compact and does not wrap into a wall of commands. Selection-specific actions
  appear contextually near the canvas/viewer or in the inspector.
- Canvas/viewer, assets/layers, inspector, and timeline/filmstrip retain stable positions so muscle
  memory transfers between the image and motion instruments.
- Focus is never communicated by colour alone. Keyboard focus receives a family-brass outline;
  selected tools and objects also change surface or shape.
- Motion lasts 120–220 ms and respects the operating system's reduced-motion preference.

## Family geometry

| Element | Contract |
| --- | --- |
| Top bar | 52 px, one-pixel lower divider |
| Primary tool | 40 px target, 20 px icon |
| Compact action | 36 px target, 18 px icon |
| Control radius | 6–8 px |
| Floating panel radius | 10–12 px |
| Icon stroke | 1.6–1.8 px, round caps and joins |
| Divider | one pixel; shadows only on floating surfaces |

## Colour roles

| Semantic role | Imago | Motus |
| --- | --- | --- |
| Workspace | optical violet-black `#0E0B13` | cinematic blue-black `#091018` |
| Panel | `#18121F` | `#111A24` |
| Primary action/selection | mineral `#729488` | clay/coral `#E27A67` |
| Secondary meaning | amber `#B89C67` for presets and output | cyan `#62D3E8` for transport and time |
| Text | family limestone `#F0EDE6` | family limestone `#F0EDE6` |
| Focus | family brass `#C9A85A` | family brass `#C9A85A` |
| Ready/status | sea-glass `#63D1C5` | sea-glass `#63D1C5` |

Do not use the secondary colour as decoration everywhere. In Imago, amber calls attention to
template automation and export. In Motus, cyan is reserved for playback, timecode, and the playhead;
coral marks edit selection and temporal changes.

## Workflow rules

### Imago

The first decision is composition, not document dimensions. The home surface leads with visual
templates whose slots can be replaced without disturbing layout. Subject, supporting image,
background, and title are explicit roles. Selecting a slot reveals only the actions relevant to it,
such as replace, cut out, outline, grade, and text styling.

Template geometry is normalized to the canvas, allowing the same composition to render at 720p,
1080p, or 4K 16:9. Manual tools remain available after the fast path creates a useful starting point.

### Motus

The first decision is media and sequence assembly. Media selection drives the source context;
timeline selection drives the inspector. Edit commands must mutate the canonical project through
undoable commands before the QML view reflects them.

Controls that depend on the pending MLT runtime remain visibly unavailable with an explanatory
tooltip. The shell must not imply that playback, probing, proxies, or export work before their native
gates pass.

## Influences

The shared system applies three established editor patterns:

- Contextual actions reduce panel-hunting by showing relevant commands for the current selection.
- Templates expose replaceable media while preserving composition and styling.
- Media/layers on the left, viewer/canvas in the centre, and a selection-driven inspector on the
  right provide a stable editing workspace.

These are interaction lessons, not visual imitation. Instrumenta keeps its own marks, colours,
typography, and restrained surface treatment.
