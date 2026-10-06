// The Instrumenta icon family (brand v2): freestanding objects with depth, one per product.
// This file is the single source for every icon. It runs in a page as `window.InstrumentaIcons`
// and in Node as a module, where brand/scripts/build-icons.cjs uses it to write the SVG, PNG and
// ICO files. Edit a glyph here and rebuild; never edit the generated files.
//
// Output uses presentation attributes only (no style attributes, no <style>), so an icon can be
// inserted into a page whose Content-Security-Policy forbids inline styles. Motion comes from
// instrumenta-icons.css: an icon animates while an ancestor has `ii-play`, or while an
// `ii-hover` ancestor is hovered or focused.
(function expose(root, factory) {
  const icons = factory();
  if (typeof module === 'object' && module.exports) module.exports = icons;
  else root.InstrumentaIcons = icons;
}(typeof self !== 'undefined' ? self : this, () => {
  // ---- Colour -------------------------------------------------------------------------------
  // Every accent shares one OKLCH lightness and chroma; only the hue differs, so no product reads
  // louder than another. Converted to sRGB hex here so files and old renderers need no OKLCH.
  const PRODUCTS = [
    { id: 'instrumenta', name: 'Instrumenta', hue: 75 },
    { id: 'fabula', name: 'Fabula', hue: 10 },
    { id: 'imago', name: 'Imago', hue: 185 },
    { id: 'ludere', name: 'Ludere', hue: 305 },
    { id: 'discere', name: 'Discere', hue: 258 },
    { id: 'learnchess', name: 'LearnChess', hue: 150 },
    { id: 'luna', name: 'Luna', hue: 235, chroma: 0.07 },
    { id: 'forge3d', name: 'Forge3D', hue: 38 },
  ];

  function oklchToHex(L, C, h) {
    const a = C * Math.cos((h * Math.PI) / 180);
    const b = C * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return '#' + linear.map((x) => {
      const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  function colours(product) {
    const p = typeof product === 'string' ? PRODUCTS.find((x) => x.id === product) : product;
    const c = p.chroma ?? 0.155;
    return {
      accent: oklchToHex(0.70, c, p.hue),
      light: oklchToHex(0.86, Math.min(c, 0.09), p.hue),
      deep: oklchToHex(0.42, Math.min(c, 0.11), p.hue),
      ink: oklchToHex(0.20, 0.035, p.hue),
      suite: oklchToHex(0.72, c, p.hue),
    };
  }

  // ---- Glyphs -------------------------------------------------------------------------------
  // A 48-unit grid. Class tokens say what each shape is, not how it looks:
  //   f / f2   fill areas (accent / light)       s      line (ink), solid  filled in ink
  //   k0..k6   filled in another product's colour, in catalogue order after Instrumenta
  //   thin     a lighter line                    dt     detail, dropped at 16 and 24 px
  //   flat     casts no depth (floats in front)
  //   m-*      a moving part                     w0..w9 its delay, in tenths of a second
  const SUITE = PRODUCTS.slice(1);
  const organX = [...Array(7)].map((_, i) => 4.6 + i * 5.6);
  const organH = [13, 18, 23, 28, 23, 18, 13];

  const GLYPHS = {
    instrumenta: organX.map((x, i) => `<g class="m-pipe w${Math.abs(i - 3) * 1}">`
      + `<rect class="k${i}" x="${x}" y="${33 - organH[i]}" width="4.6" height="${organH[i]}" rx=".8"/>`
      + `<rect class="s thin" x="${x}" y="${33 - organH[i]}" width="4.6" height="${organH[i]}" rx=".8"/>`
      + `<path class="s thin dt" d="M${(x + 1.3).toFixed(1)} 29.5h2"/></g>`).join('')
      + '<rect class="f" x="3" y="33" width="42" height="9" rx="1.5"/><rect class="s" x="3" y="33" width="42" height="9" rx="1.5"/>'
      + '<path class="s dt" d="M8 37.5H40"/>',
    fabula: '<rect class="f" x="7" y="19" width="34" height="23" rx="2"/><rect class="s" x="7" y="19" width="34" height="23" rx="2"/>'
      + '<rect class="f2" x="18" y="28.3" width="13" height="4.4" rx="1"/>'
      + '<path class="s" d="M12 25.5H33M12 35.5H28"/><path class="s dt" d="M12 30.5H16M33 30.5H36"/>'
      + '<g class="m-clap"><path class="f2" d="M7 18.5 38.5 10 40 14.8 8.5 23.3Z"/><path class="s" d="M7 18.5 38.5 10 40 14.8 8.5 23.3Z"/>'
      + '<path class="s" d="M15 16.3 18.5 21.2M23 14.2 26.5 19M31 12 34.5 16.9"/></g>',
    imago: '<rect class="f" x="6" y="12" width="30" height="26" rx="2"/><rect class="s" x="6" y="12" width="30" height="26" rx="2"/>'
      + '<path class="s" d="M9 34L17 25L23 31L27 27L33 33"/><circle class="f2 dt" cx="14" cy="19" r="2.2"/><circle class="s dt" cx="14" cy="19" r="2.2"/>'
      + '<g class="m-twinkle"><path class="f2 flat" d="M37 3Q38 10.5 45 12Q38 13.5 37 21Q36 13.5 29 12Q36 10.5 37 3Z"/>'
      + '<path class="s flat" d="M37 3Q38 10.5 45 12Q38 13.5 37 21Q36 13.5 29 12Q36 10.5 37 3Z"/></g>',
    ludere: '<path class="f" d="M11 6H30L38 14V42H11Z"/><path class="s" d="M11 6H30L38 14V42H11Z"/>'
      + '<path class="f2" d="M30 6V14H38Z"/><path class="s" d="M30 6V14H38"/>'
      + '<path class="s m-type" d="M20.5 21H28.5"/><path class="s m-type w3" d="M16.5 26.5H32.5"/>'
      + '<path class="s m-type w6 dt" d="M16.5 31.5H30"/><path class="s m-type w9 dt" d="M20.5 37H28.5"/>',
    discere: '<path class="f" d="M24 14C19 10 12 10 6 12V36C12 34 19 34 24 38Z"/><path class="s" d="M24 14C19 10 12 10 6 12V36C12 34 19 34 24 38Z"/>'
      + '<g class="m-flip"><path class="f2" d="M24 14C29 10 36 10 42 12V36C36 34 29 34 24 38Z"/><path class="s" d="M24 14C29 10 36 10 42 12V36C36 34 29 34 24 38Z"/></g>'
      + '<path class="s dt" d="M31 19.5L35 16.5M31 24.5L36 21"/>',
    learnchess: '<g class="m-hop"><path class="f" d="M13 41H35V36.5H31.5L29.5 22H32.5V10H27.5V14.5H25.5V10H22.5V14.5H20.5V10H15.5V22H18.5L16.5 36.5H13Z"/>'
      + '<path class="s" d="M13 41H35V36.5H31.5L29.5 22H32.5V10H27.5V14.5H25.5V10H22.5V14.5H20.5V10H15.5V22H18.5L16.5 36.5H13Z"/>'
      + '<path class="s dt" d="M18.5 22H29.5"/></g>',
    luna: '<path class="f" d="M26 6A17.5 17.5 0 1 0 39 35A14.5 14.5 0 0 1 26 6Z"/><path class="s" d="M26 6A17.5 17.5 0 1 0 39 35A14.5 14.5 0 0 1 26 6Z"/>'
      + '<path class="s m-bar" d="M33.5 19V28"/><path class="s m-bar w2" d="M38.5 15V32"/><path class="s m-bar w4" d="M43.5 19.5V27.5"/>',
    forge3d: '<g class="m-forge"><path class="f2" d="M24 7L39 15.5L24 24L9 15.5Z"/><path class="s" d="M24 7L39 15.5L24 24L9 15.5Z"/></g>'
      + '<path class="f" d="M9 19V32L24 41V27.5Z"/><path class="f2" d="M39 19V32L24 41V27.5Z"/>'
      + '<path class="s" d="M9 19V32L24 41L39 32V19M24 27.5V41M9 19L24 27.5L39 19"/>',
  };

  // Simplification by size: fewer depth layers, heavier lines, details dropped.
  const TIERS = {
    full: { steps: 6, dx: 0.5, dy: 0.55, line: 2.3, thin: 1.7, depthLine: 3.2, details: true },
    medium: { steps: 3, dx: 0.85, dy: 0.95, line: 2.8, thin: 2.1, depthLine: 3.4, details: false },
    small: { steps: 2, dx: 1.1, dy: 1.25, line: 3.4, thin: 2.6, depthLine: 3.6, details: false },
  };
  const tierFor = (size) => (size && size <= 16 ? 'small' : size && size <= 24 ? 'medium' : 'full');

  const TAG = /<(\/?)(g|rect|path|circle)\b([^>]*?)(\/?)>/g;

  function paint(markup, look) {
    return markup.replace(TAG, (whole, closing, tag, attrs, selfClose) => {
      if (closing) return whole;
      const classMatch = attrs.match(/\sclass="([^"]*)"/);
      const tokens = classMatch ? classMatch[1].split(/\s+/) : [];
      const rest = attrs.replace(/\sclass="[^"]*"/, '');
      const motion = tokens.filter((t) => /^(m-|w\d)/.test(t));
      const extra = look(tag, tokens);
      if (extra === null) return '';
      const cls = motion.length ? ` class="${motion.join(' ')}"` : '';
      return `<${tag}${cls}${rest}${extra}${selfClose ? '/' : ''}>`;
    });
  }

  function dropDetails(markup) {
    // Detail shapes are always single, self-closing elements.
    return markup.replace(/<(rect|path|circle)\b[^>]*\bclass="[^"]*\bdt\b[^"]*"[^>]*\/>/g, '');
  }

  function render(id, options = {}) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) throw new Error(`Unknown Instrumenta product icon: ${id}`);
    const tier = TIERS[options.tier || tierFor(options.size)];
    const col = colours(product);
    let glyph = GLYPHS[id];
    if (!tier.details) glyph = dropDetails(glyph);
    const round = ' stroke-linecap="round" stroke-linejoin="round"';

    const front = paint(glyph, (tag, t) => {
      if (tag === 'g') return '';
      const k = t.find((x) => /^k\d$/.test(x));
      if (k) return ` fill="${colours(SUITE[Number(k[1])]).suite}"`;
      if (t.includes('f')) return ` fill="${col.accent}"`;
      if (t.includes('f2')) return ` fill="${col.light}"`;
      if (t.includes('solid')) return ` fill="${col.ink}"`;
      if (t.includes('s')) return ` fill="none" stroke="${col.ink}" stroke-width="${t.includes('thin') ? tier.thin : tier.line}"${round}`;
      return '';
    });
    const depthLayer = paint(glyph, (tag, t) => {
      if (tag === 'g') return '';
      if (t.includes('flat')) return null;
      return ` fill="${col.deep}" stroke="${col.deep}" stroke-width="${tier.depthLine}" stroke-linejoin="round"`;
    });
    const depth = [...Array(tier.steps)].map((_, i) => {
      const n = tier.steps - i;
      return `<g transform="translate(${(n * tier.dx).toFixed(2)} ${(n * tier.dy).toFixed(2)})">${depthLayer}</g>`;
    }).join('');
    const shift = `translate(${(-tier.steps * tier.dx * 0.5).toFixed(2)} ${(-tier.steps * tier.dy * 0.5).toFixed(2)})`;

    const viewBox = options.viewBox || '0 0 48 48';
    const size = options.size ? ` width="${options.size}" height="${options.size}"` : '';
    const label = options.label === '' ? ' aria-hidden="true"' : ` role="img" aria-label="${options.label || product.name}"`;
    const ns = options.standalone ? ' xmlns="http://www.w3.org/2000/svg"' : '';
    const style = options.embedCss ? `<style>${options.embedCss}</style>` : '';
    const cls = options.className ? ` class="${options.className}"` : '';
    return `<svg${ns} viewBox="${viewBox}"${size}${cls}${label}>${style}<g transform="${shift}"><g class="ii-body">`
      + `<g>${depth}</g><g>${front}</g></g></g></svg>`;
  }

  return { PRODUCTS, GLYPHS, TIERS, colours, oklchToHex, render, tierFor };
}));
