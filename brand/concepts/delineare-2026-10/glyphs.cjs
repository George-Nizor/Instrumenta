// Draft glyphs for the drawing app, rendered through the real brand icon library.
const path = require('path');
const Module = require('module');
const fs0 = require('fs');
const libPath = path.resolve(__dirname, '../../icons/instrumenta-icons.js');
const libSrc = fs0.readFileSync(libPath, 'utf8').replace('colours(SUITE[Number(k[1])])', 'colours(PRODUCTS.filter((p) => !p.draft).slice(1)[Number(k[1])])');
const m = new Module(libPath); m.filename = libPath; m.paths = Module._nodeModulePaths(path.dirname(libPath)); m._compile(libSrc, libPath);
const I = m.exports;

const HUE = Number(process.env.HUE || 215);

// Pencil in local coordinates: tip at the origin pointing left, body along +x, 8 units thick.
const pencil = (t, h = 5) => {
  const c = 9, b = c + 20, f = b + 4.6, e = f + 5.2, g = h * 0.34;
  return `<g transform="${t}">`
  + `<path class="f2" d="M0 0L${c} ${-h}L${c} ${h}Z"/><path class="s" d="M0 0L${c} ${-h}L${c} ${h}Z"/>`
  + `<path class="solid" d="M0 0L3.4 ${-h * 0.38}L3.4 ${h * 0.38}Z"/>`
  + `<rect class="f" x="${c}" y="${-h}" width="${b - c}" height="${2 * h}"/><rect class="f2" x="${c}" y="${-h}" width="${b - c}" height="${h * 0.62}"/>`
  + `<rect class="s" x="${c}" y="${-h}" width="${b - c}" height="${2 * h}"/><path class="s thin dt" d="M${c} ${g}H${b}"/>`
  + `<rect class="f2" x="${b}" y="${-h}" width="${f - b}" height="${2 * h}"/><rect class="s" x="${b}" y="${-h}" width="${f - b}" height="${2 * h}"/>`
  + `<path class="s thin dt" d="M${(b + f) / 2} ${-h}V${h}"/>`
  + `<rect class="f" x="${f}" y="${-h * 0.9}" width="${e - f}" height="${h * 1.8}" rx="${h * 0.6}"/><rect class="s" x="${f}" y="${-h * 0.9}" width="${e - f}" height="${h * 1.8}" rx="${h * 0.6}"/>`
  + '</g>';
};

// Capsule limb from (x1,y1) to (x2,y2), for the mannequin.
function limb(x1, y1, x2, y2, w = 3.6, extra = '') {
  const L = Math.hypot(x2 - x1, y2 - y1).toFixed(2);
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI).toFixed(1);
  const r = `x="0" y="${-w / 2}" width="${L}" height="${w}" rx="${w / 2}"`;
  return `<g transform="translate(${x1} ${y1}) rotate(${a})"${extra}><rect class="f" ${r}/><rect class="s" ${r}/></g>`;
}
const joint = (x, y, r = 1.7) => `<circle class="f2 dt" cx="${x}" cy="${y}" r="${r}"/><circle class="s thin dt" cx="${x}" cy="${y}" r="${r}"/>`;

const GLYPHS = {
  // A: a pencil that has just drawn a line. Motion: the pencil sweeps right as the line draws in.
  pencil: '<path class="s flat m-draw" d="M3 44.5C6 38 10.5 45 14.6 38.4"/><path class="s2 flat m-draw" d="M3 44.5C6 38 10.5 45 14.6 38.4"/>'
    + `<g class="m-sweep">${pencil('translate(15 38) rotate(-45)')}</g>`,
  // B: a spiral sketchbook with a box drawn on the page, pencil resting across it.
  sketchbook: '<rect class="f" x="9.5" y="10.5" width="30" height="32" rx="2"/><rect class="s" x="9.5" y="10.5" width="30" height="32" rx="2"/>'
    + '<rect class="f2" x="6" y="8" width="30" height="32" rx="1.5"/><rect class="s" x="6" y="8" width="30" height="32" rx="1.5"/>'
    + '<path class="s thin m-type" d="M14 20L21 16.5L28 20L21 23.5Z"/><path class="s thin m-type w3" d="M14 20V28.5L21 32V23.5M28 20V28.5L21 32"/>'
    + '<path class="s" d="M11 5.5V10.5M16.5 5.5V10.5M22 5.5V10.5M27.5 5.5V10.5"/><path class="s dt" d="M33 5.5V10.5"/>'
    + `<g class="m-sweep">${pencil('translate(27.5 44) rotate(-45)', 3.4)}</g>`,
  // C: an artist's wooden mannequin on its stand, one arm raised. Motion: the arm waves.
  mannequin: '<rect class="f2" x="13" y="41.5" width="22" height="3.2" rx="1.6"/><rect class="s" x="13" y="41.5" width="22" height="3.2" rx="1.6"/>'
    + '<path class="s" d="M24 41.5V31"/>'
    + limb(21.6, 30, 17.6, 36) + limb(17.6, 36, 15.6, 41.5)
    + limb(26.4, 30, 30.6, 35.6) + limb(30.6, 35.6, 33.4, 41.2)
    + limb(29.4, 15.4, 32.6, 22.4) + limb(32.6, 22.4, 33.6, 29)
    + `<g class="m-wave">${limb(18.6, 15.4, 13.4, 10.4)}${limb(13.4, 10.4, 11.8, 3.6)}${joint(13.4, 10.4, 1.5)}</g>`
    + '<path class="f" d="M20.4 26.6Q24 24.6 27.6 26.6L27.2 30.8Q24 32.6 20.8 30.8Z"/><path class="s" d="M20.4 26.6Q24 24.6 27.6 26.6L27.2 30.8Q24 32.6 20.8 30.8Z"/>'
    + '<path class="f" d="M18 14.6Q24 11.6 30 14.6L28.4 23.4Q24 25.8 19.6 23.4Z"/><path class="s" d="M18 14.6Q24 11.6 30 14.6L28.4 23.4Q24 25.8 19.6 23.4Z"/>'
    + joint(24, 25.2) + joint(17.6, 36, 1.5) + joint(30.6, 35.6, 1.5) + joint(32.6, 22.4, 1.5)
    + '<path class="s" d="M24 11.2V12.8"/><circle class="f" cx="24" cy="7.4" r="4.2"/><circle class="s" cx="24" cy="7.4" r="4.2"/>',
};

for (const [id, g] of Object.entries(GLYPHS)) {
  I.PRODUCTS.push({ id, name: id, hue: HUE, draft: true });
  I.GLYPHS[id] = g;
}

// The organ with an eighth pipe: one per catalogue product, the new one last.
const suiteHues = [10, 185, 305, 258, 150, [235, 0.07], 38, HUE];
const n = 8, w = 4.2, gap = 0.9, x0 = 3 + (42 - (n * w + (n - 1) * gap)) / 2;
const hs = [12, 16.5, 21, 26, 26, 21, 16.5, 12];
const organ8 = hs.map((h, i) => {
  const x = (x0 + i * (w + gap)).toFixed(2);
  return `<g class="m-pipe w${Math.min(Math.abs(i - 3.5) | 0, 9)}"><rect class="k${i}" x="${x}" y="${33 - h}" width="${w}" height="${h}" rx=".8"/>`
    + `<rect class="s thin" x="${x}" y="${33 - h}" width="${w}" height="${h}" rx=".8"/></g>`;
}).join('') + '<rect class="f" x="3" y="33" width="42" height="9" rx="1.5"/><rect class="s" x="3" y="33" width="42" height="9" rx="1.5"/><path class="s dt" d="M8 37.5H40"/>';

// The eighth pipe takes the new product's colour; it is pushed as a non-draft product at the end of the catalogue.
I.PRODUCTS.push({ id: 'newapp', name: 'New app', hue: HUE });
I.GLYPHS.organ8 = organ8;
I.PRODUCTS.push({ id: 'organ8', name: 'Instrumenta', hue: 75, draft: true });

module.exports = { I, GLYPHS, organ8, suiteHues, HUE };

if (require.main === module) {
  const fs = require('fs');
  const out = process.argv[3] || '.';
  for (const id of Object.keys(GLYPHS)) {
    for (const size of [128, 48, 24, 16]) {
      fs.writeFileSync(path.join(out, `${id}-${size}.svg`), I.render(id, { size, standalone: true }));
    }
  }
  console.log(JSON.stringify(I.colours({ id: 'x', hue: HUE })));
}
