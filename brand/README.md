# Instrumenta brand system

Each app has its own sculptural mark. The family resemblance comes from depth, material, transparent
canvas, and disciplined placement. It does not come from stuffing every idea into the same rounded
square.

| Product | Mark | Accent |
| --- | --- | --- |
| Instrumenta | an opening software threshold | orange `#F28A32` |
| Motus | time-slices moving through an edit | magenta-coral `#E95087` |
| Imago | composition planes around an image aperture | teal `#28C7B7` |
| Ludere | a page or stage fold opening into story space | violet `#9A72EA` |
| Discere | ascending learning planes | cobalt `#3E83F8` |
| Luna | lunar and acoustic shells around a voice core | icy cyan `#59D9F2` |
| Forge3D | topology becoming a finished surface | forge orange `#D06B37` |

## Canonical assets

The selected concept renders live under `brand/concepts/`. Production marks are transparent RGBA PNGs.
Run `scripts/build-approved-brand-assets.py` with the workspace dependency Python to remove exterior
backdrop residue, create the standard sizes, copy approved assets into sibling apps, and build the
Motus and Luna Windows icon sets.

Do not retrace, simplify, recolour, add a container, or put lettering inside a mark. Keep the clear
space already present in its canvas. Launcher cards and banners may place atmosphere behind the
transparent art.

## README banners

Every repository carries a 1600×500 PNG under `docs/images/`. The set uses a charcoal radial field,
the product accent at the edges, Space Grotesk for the name, and the unchanged approved mark.

The editable source documents were composed in Imago. The exported PNG belongs to the repository that
uses it, so GitHub rendering has no dependency on a running Imago instance.

## Type

Segoe UI Variable is the Windows interface face for Instrumenta and shared controls. Product display
type remains specific where it already has a reason to be; Forge3D uses Space Grotesk, Ludere keeps
Courier on the screenplay page, and Imago exposes several composition fonts.

Brand unity comes from the marks and their handling. Forcing one font into every working surface would
solve a problem nobody currently has.
