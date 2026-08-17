# Instrumenta project notes

This folder is the cross-project handoff point for the Instrumenta workspace. It records the
product direction, known failure modes, durable implementation facts, and the work completed in
each agent session.

## Start here

- [Product brief](product-brief.md) — what the owner asked for and the acceptance bar.
- [Known issues](known-issues.md) — current symptoms, evidence, mitigations, and next checks.
- [Knowledge base](knowledge-base.md) — facts future agents should treat as project context.
- [Session log](session-log.md) — chronological handoff notes.
- [Session template](session-template.md) — copy this for each new agent session.

## Documentation rules

1. Record observed facts separately from hypotheses.
2. Include paths and commands when they make a finding reproducible.
3. Update `known-issues.md` when a failure is fixed, reproduced, or superseded.
4. Add one dated entry to `session-log.md` at the end of each substantial session.
5. Keep app-specific implementation detail in that app's own `README.md` or `docs/` folder; link to it
   here rather than duplicating it.
