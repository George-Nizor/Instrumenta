#!/usr/bin/env node
// Renders a README banner (1600x500) from the brand files: the product's dark `surface` field with
// its accent glowing at the left and right edges, the name in Fraunces, the freestanding icon from
// icons/svg/<id>.svg and a one-line description in the product's light tint.
//
//   node brand/scripts/build-readme-banner.mjs <id> "<description>" <out.png>
//
// Needs playwright-core (any checkout that has it in node_modules; set PLAYWRIGHT_CORE to its path
// if it is not resolvable from here) and a headless Chromium: set CHROMIUM to its executable, or the
// newest ~/.cache/ms-playwright/chromium_headless_shell-*/ one is used. On WSL, Chromium also needs
// libnspr4, libnss3 and libasound2 on LD_LIBRARY_PATH (see Imago/scripts/setup-chromium-libs.sh).
// The launcher has no block in tokens.json; it uses the family surface and the brass from the icon
// library.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const brand = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [id, description, out] = process.argv.slice(2);
if (!id || !description || !out) {
  console.error('usage: build-readme-banner.mjs <id> "<description>" <out.png>');
  process.exit(2);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const icons = require(join(brand, 'icons/instrumenta-icons.js'));

const tokens = JSON.parse(readFileSync(join(brand, 'tokens.json'), 'utf8'));
let colour;
if (tokens[id]) colour = { accent: tokens[id].accent, light: tokens[id].secondary, surface: tokens[id].surface };
else if (id === 'instrumenta') {
  const k = icons.colours('instrumenta');
  colour = { accent: k.accent, light: k.light, surface: tokens.family.surface };
} else throw new Error(`No colours for ${id}`);

const svg = readFileSync(join(brand, 'icons/svg', `${id}.svg`), 'utf8');
const name = id === 'instrumenta' ? 'Instrumenta' : icons.PRODUCTS.find((p) => p.id === id).name;
const hex = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (a, b, t) => { const p = (h) => [16, 8, 0].map((s) => (parseInt(h.slice(1), 16) >> s) & 255);
  return '#' + p(a).map((v, i) => Math.round(v * (1 - t) + p(b)[i] * t).toString(16).padStart(2, '0')).join(''); };
const fontUrl = (f) => pathToFileURL(join(brand, 'fonts', f)).href;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-weight:100 900;src:url(${fontUrl('fraunces-normal-latin.woff2')}) format('woff2')}
@font-face{font-family:Commissioner;font-weight:100 900;font-style:oblique 0deg 12deg;src:url(${fontUrl('commissioner-oblique-latin.woff2')}) format('woff2')}
html,body{margin:0;width:1600px;height:500px;overflow:hidden}
body{position:relative;background:
  radial-gradient(ellipse 380px 330px at 0% 50%, ${hex(colour.accent, 0.35)}, transparent),
  radial-gradient(ellipse 380px 330px at 100% 50%, ${hex(colour.accent, 0.35)}, transparent),
  ${colour.surface};display:flex;align-items:center;justify-content:center;gap:36px}
.icon{width:260px;height:260px;flex:none}.icon svg{width:100%;height:100%;display:block}
h1{margin:0;font:650 140px/1 Fraunces;font-variation-settings:"SOFT" 100,"WONK" 1;letter-spacing:-.01em;color:${mix(colour.light, '#ffffff', 0.88)}}
p{margin:14px 0 0;width:0;min-width:100%;font:500 34px/1.3 Commissioner;font-variation-settings:"FLAR" 40;color:${colour.light}}
</style><div class="icon">${svg}</div><div style="display:inline-block;min-width:600px"><h1 style="white-space:nowrap">${esc(name)}</h1><p>${esc(description)}</p></div>`;

const shells = join(homedir(), '.cache/ms-playwright');
const shell = process.env.CHROMIUM || (existsSync(shells) && readdirSync(shells).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
  .map((d) => join(shells, d, readdirSync(join(shells, d)).find((x) => x.startsWith('chrome-')) || '', 'chrome-headless-shell')).find(existsSync));
const browser = await chromium.launch({ executablePath: shell, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 500 } });
const tmp = join(tmpdir(), `banner-${id}-${process.pid}.html`);
writeFileSync(tmp, html);
await page.goto(pathToFileURL(tmp).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
writeFileSync(out, await page.screenshot({ type: 'png' }));
await browser.close();
unlinkSync(tmp);
console.log(`${out}: ${name}`);
