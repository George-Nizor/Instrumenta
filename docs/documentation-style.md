# Documentation style

These repositories explain software. They are not landing pages.

## Write the useful sentence first

Name the app, say what it does, and state the current boundary. Put setup commands near the top.
Record file locations exactly. If a feature is unfinished, use the word unfinished.

Prefer `is`, `has`, `runs`, and `writes`. Phrases such as “serves as”, “stands as”, “seamlessly
enables”, and “in today's landscape” usually mean the sentence has wandered off.

## Keep the prose human

- Use sentence-case headings.
- Skip the ceremonial overview and closing summary.
- Do not manufacture importance, vague expert agreement, or product claims.
- Avoid forced groups of three and “not X, but Y” constructions.
- Keep em dashes rare. Parentheses are allowed; civilisation continues.
- Use bold for a label that needs scanning, not as confetti.
- A dry aside is fine when it clarifies a bad trade-off. One is usually enough.

Wikipedia's [field guide to signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
is a useful smell test. It is descriptive rather than a grammar law, so judgment still has a job.

## Keep facts from going stale

Versions come from package metadata. Commands come from the checked-in scripts. Paths come from the
current product manifests. Link detailed architecture instead of copying it into several READMEs.

Before merging a documentation change:

1. Run the repository's normal verification command.
2. Check every relative Markdown link.
3. Search for retired product names, paths, and versions.
4. Read the rendered README at desktop and narrow widths.

## Images

README banners use the approved transparent marks without redrawing them. The current set was composed
as editable Imago documents on a 1600×500 canvas and exported as repository-owned PNG files under
`docs/images/`.

Use a short alt label such as “Luna banner”. The surrounding text contains the useful description;
alt text does not need to recite the artwork.
