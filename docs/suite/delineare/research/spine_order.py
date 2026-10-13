import json, sys
P = json.load(open(sys.argv[1]))
N = {m["id"]: m for m in P}
BLOCKS = [
    ("A. First marks, looking and play", ["start-kit-posture-warmup", "baseline-imagination-check", "found-practice-method",
      "found-line-control", "obs-seeing-and-contour", "fig-gesture-line-of-action", "des-ideation-and-prompts",
      "found-ellipses", "fig-timed-gesture-progression", "found-basic-shapes", "obs-visual-memory",
      "des-surreal-ideation", "des-reference-visual-library"]),
    ("B. Boxes, measuring, first inventions", ["persp-box-basics", "persp-intuitive", "invent-objects-1", "obs-measuring",
      "light-values-squint", "obs-block-in", "composition-and-thumbnails", "check-your-drawing", "obs-still-life-from-life"]),
    ("C. Construction, figure and head", ["organic-forms-contours", "fig-simplified-construction", "figures-from-imagination-1",
      "des-shape-language-silhouette", "fig-head-construction", "persp-horizon-one-point", "persp-two-point",
      "persp-ellipses-cylinders", "fig-proportion-systems-variation", "persp-construct-primitives",
      "fig-features-expression-hair", "persp-depth-cues", "fig-hands", "nat-everyday-objects", "invent-objects-2",
      "fig-clothing-drapery"]),
    ("D. Light, animals, places, characters", ["light-form-on-basic-forms", "light-techniques", "light-invented-light",
      "nat-mammal-anatomy-construction", "des-environment-scene-building", "des-visual-storytelling",
      "des-character-design-process", "creature-design", "col-color-theory-basics"]),
]
order = [i for _, ids in BLOCKS for i in ids]
spine = {m["id"] for m in P if m["spine"]}
assert set(order) == spine, (spine - set(order), set(order) - spine)
pos = {i: k for k, i in enumerate(order)}
for i in order:
    for q in N[i]["pre"]:
        assert pos[q] < pos[i], f"{i} before its prerequisite {q}"
cum = [0, 0]
for name, ids in BLOCKS:
    h = [sum(N[i]["hours"][k] for i in ids) for k in (0, 1)]
    cum = [cum[0] + h[0], cum[1] + h[1]]
    w3 = (cum[0] / (3 * 0.7), cum[1] / (3 * 0.7))
    w5 = (cum[0] / (5 * 0.7), cum[1] / (5 * 0.7))
    print(f"{name}: {len(ids)} modules, block {h} h, cumulative {cum} h; week reached at 3 h/wk {w3[0]:.0f}-{w3[1]:.0f}, at 5 h/wk {w5[0]:.0f}-{w5[1]:.0f}")
    print("   ", ", ".join(f"{i} {N[i]['hours']}" for i in ids))
