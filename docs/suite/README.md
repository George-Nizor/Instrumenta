# Instrumenta suite notes

The cross-project notes for the Instrumenta workspace: what every product is, what is planned, what
was decided, and what each working session did. They live in the Instrumenta repository, rather
than in the unversioned workspace folder, so they are versioned and come with a clone.

## Start here

- [Catalogue](catalogue.md): every product, with its stack, delivery, version, docs, and how to test it.
- [Backlog](backlog.md): ideas and decided work, at a high level. This is the tracker.
- [Decisions](decisions.md): what was chosen and why, one dated entry each.
- [Development environment](dev-environment.md): the WSL/Windows split and how to keep it working.
- [Known issues](known-issues.md): live failure register (K-numbers).
- [Session log](session-log.md): dated handoff notes, newest last.

Older notes, from before Fabula, Discere and the release adapters (verify them before relying on them):
[product brief](product-brief.md), [knowledge base](knowledge-base.md),
[editor UI system](editor-ui-system.md), [cleanup record](cleanup-record-2026-08-21.md),
[session template](session-template.md).

## How work is tracked

One person runs this, so the system has to cost almost nothing to keep up.

1. **An idea goes in the backlog** as one row, before it is designed. Status runs from Idea to Next
   to Doing to Done (or Parked). Nothing more detailed belongs here; the detail goes into the
   product repository when the work starts.
2. **A decision gets one entry in `decisions.md`**: the date, what was chosen, what was rejected,
   and why. This is how a later session knows not to undo it.
3. **A substantial session ends with a session-log entry**: what changed, what was verified, and
   what is still open. Five lines is fine.
4. **A shipped change is a tag.** A product's `v<version>` tag is its release, and its release notes
   are its changelog. No separate changelog files.
5. **The catalogue changes when a product's shape changes**: a new product, a new adapter, a new
   stack, or a version that moved. It also gets a new test-result date whenever someone reruns the
   checks.

## Documentation rules

1. Record observed facts separately from hypotheses.
2. Include paths and commands when they make a finding reproducible.
3. Update `known-issues.md` when a failure is fixed, reproduced, or superseded.
4. Keep app-specific implementation detail in that app's own `README.md` or `docs/` folder, and link
   to it here rather than duplicating it.
5. Follow [the documentation style](../documentation-style.md).
