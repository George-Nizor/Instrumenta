# Forge3D visual handoff

- `forge3d-ui-claude-alignment-reference.png` is the approved UI alignment reference for the next renderer pass.
- The Forge3D mesh-to-surface loop logo is approved and complete. Preserve its geometry and do not redesign it.
- UI alignment remains open and should be handled separately from the approved logo.
- Known launcher defect: Forge3D artwork is currently blank in the installed Instrumenta build. The workspace catalog references `brand/artwork/forge3d-app-art.png`, while the already-installed Instrumenta package does not contain that newly added PNG at the renderer-relative packaged path. Repackage/reinstall Instrumenta or change artwork resolution so catalog assets are loaded from their actual catalog root.
