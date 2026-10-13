"""Proposed restructure of the drawing curriculum.

Each entry: id, phase, tier, track, gate hours [low, high] (my estimates), prerequisites,
from (original module ids absorbed), ongoing flag, spine flag.
Validates: every prerequisite exists, the graph is acyclic, no prerequisite sits in a later phase,
no spine module depends on a non-spine module. Prints counts and hours.
"""
import json, sys

P = []
def m(id, phase, tier, hours, pre, frm, track="core", ongoing=False, spine=False, title=""):
    P.append(dict(id=id, phase=phase, tier=tier, track=track, hours=hours, pre=pre, frm=frm,
                  ongoing=ongoing, spine=spine, title=title))

# Phase 1. Start drawing
m("start-kit-posture-warmup", 1, "essential", [3, 6], [], ["found-materials-setup", "found-posture-grip", "found-warmups"], spine=True, title="Start here: kit, posture and a five-minute warm-up")
m("found-practice-method", 1, "essential", [2, 5], ["start-kit-posture-warmup"], ["found-practice-method", "found-sketchbook-habits"], spine=True, title="How to practise: short sessions, a sketchbook, redraw from memory")
m("baseline-imagination-check", 1, "essential", [1, 2], [], [], spine=True, title="Baseline: draw ten things from imagination (repeat at every benchmark)")

# Phase 2. Line, form and looking
m("found-line-control", 2, "essential", [8, 15], ["start-kit-posture-warmup"], ["found-line-control"], spine=True)
m("found-ellipses", 2, "essential", [5, 10], ["found-line-control"], ["found-ellipses"], spine=True, title="Freehand circles and ellipses (motor drill only)")
m("found-basic-shapes", 2, "essential", [6, 12], ["found-line-control"], ["found-basic-shapes"], spine=True, title="Shape to form: simple volumes, overlap and cross-contours")
m("obs-seeing-and-contour", 2, "essential", [4, 8], [], ["obs-seeing-vs-symbols", "obs-contour-blind-contour"], spine=True)
m("found-line-weight", 2, "deepening", [3, 6], ["found-line-control"], ["found-line-weight"])
m("fig-gesture-line-of-action", 2, "essential", [3, 8], ["found-line-control"], ["fig-gesture-line-of-action"], spine=True)
m("fig-timed-gesture-progression", 2, "essential", [4, 8], ["fig-gesture-line-of-action"], ["fig-timed-gesture-progression"], ongoing=True, spine=True)
m("obs-visual-memory", 2, "essential", [3, 6], ["obs-seeing-and-contour"], ["obs-visual-memory"], ongoing=True, spine=True)
m("des-ideation-and-prompts", 2, "essential", [4, 8], ["found-practice-method"], ["des-ideation-sketching", "des-prompt-challenges"], track="play", ongoing=True, spine=True)
m("des-surreal-ideation", 2, "essential", [3, 6], ["des-ideation-and-prompts"], ["des-surreal-ideation"], track="play", ongoing=True, spine=True)
m("des-reference-visual-library", 2, "essential", [3, 6], ["obs-visual-memory"], ["des-reference-visual-library"], track="play", ongoing=True, spine=True, title="Visual library cycle: collect, study, recall, check")

# Phase 3. Boxes, measuring and first inventions
m("persp-box-basics", 3, "essential", [8, 20], ["found-line-control", "found-basic-shapes"], ["persp-box-basics"], spine=True)
m("persp-intuitive", 3, "essential", [30, 60], ["persp-box-basics"], ["persp-intuitive"], ongoing=True, spine=True, title="Freehand box challenge, spread over months")
m("obs-measuring", 3, "essential", [6, 14], ["obs-seeing-and-contour"], ["obs-negative-space", "obs-comparative-measuring"], spine=True)
m("obs-block-in", 3, "essential", [4, 8], ["obs-measuring"], ["obs-block-in"], spine=True)
m("obs-still-life-from-life", 3, "essential", [6, 14], ["obs-block-in"], ["obs-still-life-from-life", "obs-photo-vs-life", "nat-food-organic-still-life"], spine=True)
m("check-your-drawing", 3, "essential", [3, 6], ["obs-measuring"], ["found-self-assessment", "obs-self-critique-error-log", "obs-sight-size-and-checks"], spine=True)
m("found-critique-feedback", 3, "deepening", [2, 4], ["check-your-drawing"], ["found-critique-feedback"])
m("light-values-squint", 3, "essential", [4, 8], ["found-line-control"], ["light-values-squint"], spine=True)
m("composition-and-thumbnails", 3, "essential", [8, 16], ["found-basic-shapes", "light-values-squint"], ["des-composition-fundamentals", "obs-thumbnails-essentials", "des-thumbnailing"], spine=True)
m("invent-objects-1", 3, "essential", [6, 12], ["persp-box-basics", "found-ellipses"], ["persp-imagination"], spine=True, title="Invent objects from boxes and cylinders")
m("master-copies", 3, "deepening", [8, 20], ["obs-block-in"], ["fig-master-studies", "col-color-studies-master-copies"], ongoing=True)
m("nature-journaling", 3, "deepening", [6, 14], ["obs-seeing-and-contour"], ["nat-field-sketching-habit", "obs-nature-study-journaling"], ongoing=True)
m("atelier-bargue-cast-sight-size", 3, "optional", [20, 80], ["obs-block-in", "check-your-drawing"], ["obs-master-copies-bargue", "light-bargue-cast", "obs-sight-size-and-checks"], track="optional")

# Phase 4. Perspective and construction
m("persp-horizon-one-point", 4, "essential", [8, 16], ["persp-box-basics"], ["persp-horizon-vps", "persp-one-point"], spine=True)
m("persp-two-point", 4, "essential", [6, 12], ["persp-horizon-one-point"], ["persp-two-point"], spine=True)
m("persp-ellipses-cylinders", 4, "essential", [6, 14], ["found-ellipses", "persp-horizon-one-point"], ["persp-ellipses-cylinders"], spine=True)
m("organic-forms-contours", 4, "essential", [6, 12], ["found-basic-shapes", "persp-box-basics"], [], spine=True, title="Organic forms, contour lines and soft intersections")
m("persp-construct-primitives", 4, "essential", [12, 30], ["persp-ellipses-cylinders", "persp-two-point", "organic-forms-contours"], ["persp-construct-primitives"], spine=True)
m("persp-depth-cues", 4, "essential", [4, 8], ["persp-horizon-one-point", "light-values-squint"], ["persp-depth-cues", "des-depth-overlap-atmosphere"], spine=True)
m("nat-everyday-objects", 4, "essential", [8, 16], ["persp-construct-primitives"], ["nat-everyday-objects"], spine=True)
m("invent-objects-2", 4, "essential", [10, 20], ["persp-construct-primitives", "invent-objects-1"], ["persp-imagination"], spine=True, title="Rotate, combine and redesign objects from imagination")
m("persp-measure-scale", 4, "deepening", [8, 20], ["persp-two-point"], ["persp-measure-scale"])
m("persp-three-point", 4, "deepening", [6, 12], ["persp-two-point"], ["persp-three-point"])
m("persp-parallel-projection", 4, "optional", [4, 10], ["persp-box-basics"], ["persp-parallel-projection"], track="optional")
m("persp-curvilinear", 4, "optional", [6, 14], ["persp-three-point", "persp-ellipses-cylinders"], ["persp-curvilinear"], track="optional")
m("simple-3d-blockout", 4, "deepening", [3, 6], ["persp-box-basics"], [], title="Simple 3D blockouts as reference (Blender or a posable figure app)")

# Phase 5. Figure and head
m("fig-simplified-construction", 5, "essential", [10, 20], ["fig-gesture-line-of-action", "persp-box-basics", "organic-forms-contours"], ["fig-simplified-construction"], spine=True)
m("fig-proportion-systems-variation", 5, "essential", [4, 10], ["fig-simplified-construction"], ["fig-proportion-systems-variation"], spine=True)
m("figures-from-imagination-1", 5, "essential", [8, 16], ["fig-simplified-construction", "fig-timed-gesture-progression"], ["fig-imagination-visual-library"], spine=True, title="Mannequin figures from imagination")
m("fig-head-construction", 5, "essential", [8, 20], ["found-basic-shapes", "found-ellipses", "persp-box-basics"], ["fig-head-construction"], spine=True)
m("fig-features-expression-hair", 5, "essential", [10, 20], ["fig-head-construction"], ["fig-facial-features-expressions", "fig-hair"], spine=True)
m("fig-hands", 5, "essential", [6, 12], ["fig-simplified-construction"], ["fig-hands"], spine=True)
m("fig-feet", 5, "deepening", [3, 8], ["fig-simplified-construction"], ["fig-feet"])
m("fig-clothing-drapery", 5, "essential", [6, 15], ["fig-simplified-construction"], ["fig-clothing-drapery"], spine=True)
m("des-shape-language-silhouette", 5, "essential", [4, 10], ["composition-and-thumbnails", "found-basic-shapes"], ["des-shape-language-silhouette"], spine=True)
m("anatomy-torso", 5, "deepening", [12, 30], ["fig-simplified-construction"], ["fig-anatomy-skeleton-muscle"])
m("anatomy-arms-hands", 5, "deepening", [10, 25], ["anatomy-torso", "fig-hands"], ["fig-anatomy-skeleton-muscle"])
m("anatomy-legs-feet", 5, "deepening", [10, 25], ["anatomy-torso", "fig-feet"], ["fig-anatomy-skeleton-muscle"])
m("foreshortening", 5, "deepening", [8, 20], ["fig-simplified-construction", "persp-ellipses-cylinders"], ["persp-foreshortening", "fig-foreshortening-perspective"])
m("fig-dynamic-poses-interaction", 5, "deepening", [10, 25], ["fig-timed-gesture-progression", "fig-simplified-construction"], ["fig-dynamic-poses-interaction"])
m("fig-life-drawing-session-routine", 5, "deepening", [10, 30], ["fig-timed-gesture-progression", "fig-simplified-construction"], ["fig-life-drawing-session-routine"], ongoing=True)
m("fig-portrait-likeness", 5, "deepening", [12, 30], ["fig-features-expression-hair", "obs-measuring"], ["fig-portrait-likeness"])

# Phase 6. Light, value and form
m("light-form-on-basic-forms", 6, "essential", [8, 16], ["light-values-squint", "found-basic-shapes"], ["light-form-anatomy", "light-basic-forms"], spine=True)
m("light-techniques", 6, "essential", [4, 8], ["light-values-squint"], ["light-techniques"], spine=True)
m("light-invented-light", 6, "essential", [6, 12], ["light-form-on-basic-forms", "invent-objects-1"], ["light-invented-light"], spine=True, title="Shading things you invented")
m("light-edges", 6, "deepening", [4, 8], ["light-form-on-basic-forms"], ["light-edges"])
m("light-value-composition", 6, "deepening", [3, 6], ["composition-and-thumbnails", "light-form-on-basic-forms"], ["light-value-composition"])
m("light-direction-types", 6, "deepening", [4, 8], ["light-form-on-basic-forms"], ["light-direction-types"])
m("cast-shadows", 6, "deepening", [8, 16], ["persp-two-point", "light-form-on-basic-forms"], ["persp-shadows", "light-cast-shadows-ao"])
m("light-materials-textures", 6, "deepening", [8, 18], ["light-edges", "light-direction-types"], ["light-materials-textures", "nat-texture-fur-feather-scale"])
m("light-still-life-render", 6, "stretch", [12, 30], ["light-materials-textures", "cast-shadows", "light-value-composition"], ["light-still-life-render"])

# Phase 7. Animals, nature and machines (Drawabox lessons 3 to 7 order)
m("nat-plants-flowers-trees", 7, "essential", [6, 12], ["organic-forms-contours"], ["nat-plants-flowers-trees"], spine=True)
m("nat-insects-arachnids", 7, "deepening", [6, 14], ["organic-forms-contours", "persp-construct-primitives"], ["nat-insects-arachnids"])
m("nat-birds", 7, "deepening", [8, 16], ["organic-forms-contours"], ["nat-birds"])
m("nat-reptiles-amphibians-fish", 7, "deepening", [6, 14], ["organic-forms-contours"], ["nat-reptiles-amphibians-fish"])
m("nat-mammal-anatomy-construction", 7, "essential", [12, 25], ["persp-construct-primitives", "fig-simplified-construction"], ["nat-mammal-anatomy-construction"], spine=True)
m("nat-animal-gesture-locomotion-expression", 7, "deepening", [10, 20], ["nat-mammal-anatomy-construction", "fig-gesture-line-of-action"], ["nat-animal-gesture-locomotion-expression"])
m("nat-hard-surface-vehicles-machines", 7, "deepening", [15, 35], ["nat-everyday-objects"], ["nat-hard-surface-vehicles-machines"])
m("nat-patterns-ornament-surface-detail", 7, "optional", [6, 12], ["found-line-control"], ["nat-patterns-ornament-surface-detail"], track="optional")

# Phase 8. Places and stories
m("des-environment-scene-building", 8, "essential", [10, 20], ["composition-and-thumbnails", "persp-two-point", "persp-depth-cues"], ["des-environment-scene-building"], spine=True)
m("des-visual-storytelling", 8, "essential", [8, 16], ["composition-and-thumbnails", "figures-from-imagination-1"], ["des-visual-storytelling"], spine=True)
m("landscape-elements-and-trees", 8, "deepening", [14, 30], ["light-form-on-basic-forms", "persp-horizon-one-point", "nat-plants-flowers-trees"], ["nat-landscape-elements", "nat-foliage-trees-in-landscape"])
m("architecture-and-slopes", 8, "deepening", [15, 30], ["persp-two-point", "persp-measure-scale"], ["nat-architecture-perspective", "persp-slopes"])
m("location-and-street-sketching", 8, "deepening", [12, 30], ["obs-block-in", "composition-and-thumbnails"], ["obs-quick-location-sketching", "nat-streets-cities-urban-clutter"], ongoing=True)
m("persp-scene-capstone", 8, "stretch", [15, 40], ["persp-measure-scale", "persp-three-point", "cast-shadows", "persp-construct-primitives"], ["persp-scene-capstone"])

# Phase 9. Characters, creatures and finished pieces
m("des-character-design-process", 9, "essential", [12, 25], ["des-shape-language-silhouette", "figures-from-imagination-1", "fig-features-expression-hair", "fig-clothing-drapery", "des-reference-visual-library"], ["des-character-design-process"], spine=True)
m("creature-design", 9, "essential", [12, 25], ["nat-mammal-anatomy-construction", "des-shape-language-silhouette", "des-surreal-ideation"], ["des-creature-monster-design", "nat-creature-design-invented-animals"], spine=True)
m("des-costume-props-accessories", 9, "deepening", [8, 16], ["des-character-design-process"], ["des-costume-props-accessories"])
m("des-expression-acting", 9, "deepening", [6, 15], ["fig-features-expression-hair", "figures-from-imagination-1"], ["des-expression-acting"])
m("des-cartooning-stylisation-caricature", 9, "deepening", [8, 20], ["des-shape-language-silhouette", "fig-features-expression-hair"], ["des-cartooning-stylisation-caricature"])
m("figures-from-imagination-2", 9, "deepening", [15, 40], ["figures-from-imagination-1", "anatomy-torso", "foreshortening"], ["fig-imagination-visual-library"])
m("des-visual-development-workflow", 9, "stretch", [20, 50], ["des-environment-scene-building", "des-character-design-process"], ["des-visual-development-workflow"])
m("col-style-development", 9, "deepening", [6, 20], ["des-character-design-process"], ["col-style-development"])

# Phase 10. Colour and media (branch, opens after phase 6 essentials)
m("col-color-theory-basics", 10, "essential", [4, 8], ["light-values-squint", "light-form-on-basic-forms"], ["col-color-theory-basics"], spine=True)
m("col-color-mixing-limited-palettes", 10, "deepening", [6, 12], ["col-color-theory-basics"], ["col-color-mixing-limited-palettes"])
m("col-color-light-shadow", 10, "deepening", [8, 16], ["col-color-theory-basics", "light-form-on-basic-forms"], ["col-color-light-shadow"])
m("col-color-script-mood", 10, "stretch", [8, 20], ["col-color-light-shadow"], ["col-color-script-mood"])
m("digital-setup-basics", 10, "optional", [4, 10], [], ["found-digital-setup", "col-digital-primer", "col-digital-brushes-layers"], track="optional")
m("col-digital-painting-fundamentals", 10, "deepening", [20, 40], ["digital-setup-basics", "col-color-light-shadow"], ["col-digital-painting-fundamentals"])
m("inking-line-art", 10, "deepening", [6, 14], ["found-line-weight", "light-techniques"], ["light-line-weight-inking", "col-inking-line-art"])
m("media-sampler", 10, "optional", [6, 30], ["light-values-squint"], ["light-media", "col-trad-coloured-pencil", "col-trad-markers", "col-trad-ink-brush-pen", "col-trad-watercolour", "col-trad-gouache", "col-trad-charcoal", "col-trad-pastel"], track="optional")
m("col-finishing-portfolio", 10, "deepening", [3, 8], ["check-your-drawing"], ["col-finishing-portfolio"])

# Overrides: gate hours count only the lesson and the drills needed to tick done_when.
# Ongoing practice (box challenge, gesture ladder, memory redraws, free play) is paid for from a
# separate weekly allowance and is listed in ONGOING with its own total.
ONGOING = {  # id: (gate hours, total ongoing hours spread over months)
    "persp-intuitive": ([4, 8], [25, 50]),
    "fig-timed-gesture-progression": ([2, 4], [15, 40]),
    "obs-visual-memory": ([2, 4], [10, 25]),
    "des-ideation-and-prompts": ([2, 4], [10, 30]),
    "des-surreal-ideation": ([2, 4], [10, 30]),
    "des-reference-visual-library": ([2, 4], [5, 15]),
}
TRIM = {  # spine modules with trimmed gate hours, my estimates
    "found-line-control": [4, 8], "found-ellipses": [3, 6], "found-basic-shapes": [4, 8], "obs-seeing-and-contour": [3, 6], "fig-gesture-line-of-action": [2, 5], "obs-still-life-from-life": [5, 10], "persp-depth-cues": [3, 6],
    "light-techniques": [3, 6], "composition-and-thumbnails": [6, 12], "persp-construct-primitives": [12, 25],
    "invent-objects-2": [8, 16], "fig-head-construction": [8, 16], "fig-features-expression-hair": [8, 16],
    "fig-proportion-systems-variation": [3, 6], "fig-hands": [5, 10], "fig-clothing-drapery": [5, 12],
    "des-character-design-process": [10, 20], "creature-design": [10, 20], "des-environment-scene-building": [8, 16],
    "des-visual-storytelling": [6, 12], "nat-mammal-anatomy-construction": [10, 20],
}
NOT_SPINE = {"nat-plants-flowers-trees"}
for x in P:
    if x["id"] in ONGOING:
        x["hours"] = ONGOING[x["id"]][0]
        x["ongoing_hours"] = ONGOING[x["id"]][1]
    if x["id"] in TRIM:
        x["hours"] = TRIM[x["id"]]
    if x["id"] in NOT_SPINE:
        x["spine"] = False
        x["tier"] = "deepening"

if __name__ == "__main__":
    print("ongoing practice inside the spine, total hours spread over months:",
          [sum(v[1][k] for v in ONGOING.values()) for k in (0, 1)])
    orig = json.load(open(sys.argv[1]))
    orig_ids = {x["id"] for x in orig["modules"]}
    byid = {x["id"]: x for x in P}
    assert len(byid) == len(P), "duplicate ids"
    errs = []
    for x in P:
        for q in x["pre"]:
            if q not in byid:
                errs.append(f"missing prereq {q} for {x['id']}")
            elif byid[q]["phase"] > x["phase"]:
                errs.append(f"phase order: {x['id']} (p{x['phase']}) <- {q} (p{byid[q]['phase']})")
            elif x["spine"] and not byid[q]["spine"]:
                errs.append(f"spine {x['id']} depends on non-spine {q}")
    # cycle check
    seen, stack = set(), set()
    def visit(n):
        if n in stack: errs.append("cycle at " + n); return
        if n in seen: return
        stack.add(n)
        for q in byid[n]["pre"]: visit(q)
        stack.discard(n); seen.add(n)
    for x in P: visit(x["id"])
    covered = set()
    for x in P: covered |= set(x["frm"])
    missing = sorted(orig_ids - covered)
    unknown = sorted(covered - orig_ids)
    print("errors:", errs or "none")
    print("original modules not mapped:", missing or "none")
    print("unknown source ids:", unknown or "none")
    print("proposed module count:", len(P))
    new = [x["id"] for x in P if not x["frm"]]
    print("new modules:", new)
    def hs(xs): return [sum(x["hours"][k] for x in xs) for k in (0, 1)]
    for ph in range(1, 11):
        xs = [x for x in P if x["phase"] == ph]
        sp = [x for x in xs if x["spine"]]
        print(f"phase {ph}: {len(xs)} modules, all {hs(xs)} h; spine {len(sp)} modules {hs(sp)} h")
    spine = [x for x in P if x["spine"]]
    print("spine:", len(spine), "modules, gate hours", hs(spine))
    for rate in (3, 4, 5):
        lo, hi = hs(spine)
        # assume 70 percent of weekly time goes to spine module work, the rest to free play and review
        print(f"  at {rate} h/week with 70% on spine work: {lo/(rate*0.7)/52:.1f} to {hi/(rate*0.7)/52:.1f} years")
    cum = [0, 0]
    for ph in range(1, 11):
        sp = [x for x in P if x["phase"] == ph and x["spine"]]
        h = hs(sp); cum = [cum[0] + h[0], cum[1] + h[1]]
        print(f"  spine through phase {ph}: {cum} h, weeks at 4 h/week x 0.7: {cum[0]/2.8:.0f} to {cum[1]/2.8:.0f}")
    core = [x for x in P if x["track"] != "optional"]
    print("non-optional total:", len(core), hs(core))
    print("all:", hs(P))
    out = sys.argv[2] if len(sys.argv) > 2 else None
    if out:
        json.dump(P, open(out, "w"), indent=1)
