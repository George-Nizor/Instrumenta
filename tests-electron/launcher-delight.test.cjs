'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const delight = require('../electron/renderer/delight.js');
const icons = require('../brand/icons/instrumenta-icons.js');

const renderer = path.join(__dirname, '..', 'electron', 'renderer');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8'));

test('every product has a name to explain and a note on the organ', () => {
  for (const { id } of icons.PRODUCTS) {
    assert.ok(delight.meaning(id)?.gloss, `${id} has no meaning`);
    assert.ok(delight.NOTES[id] > 0, `${id} has no note`);
  }
  assert.equal(delight.meaning('nope'), null);
});

test('the ambience follows the hemisphere, the season and the hour', () => {
  const at = (iso) => new Date(iso);
  assert.deepEqual(delight.ambienceFor(at('2026-07-10T14:00:00'), 'Australia/Sydney'), { mode: 'snow', label: 'Winter afternoon' });
  assert.deepEqual(delight.ambienceFor(at('2026-07-10T14:00:00'), 'Europe/London'), { mode: 'motes', label: 'Summer afternoon' });
  assert.equal(delight.ambienceFor(at('2026-10-06T10:00:00'), 'Australia/Brisbane').mode, 'blossom');
  assert.equal(delight.ambienceFor(at('2026-10-06T10:00:00'), 'America/New_York').mode, 'leaves');
  assert.equal(delight.ambienceFor(at('2026-04-02T22:00:00'), 'Australia/Perth').mode, 'fireflies');
  assert.equal(delight.ambienceFor(at('2026-12-24T12:00:00'), 'Australia/Sydney').mode, 'stars');
});

test('the journal earns each milestone once and survives bad stored data', () => {
  let state = null;
  const earn = (event, iso) => {
    const result = delight.record(state, event, new Date(iso));
    state = result.journal;
    return result.earned.map((milestone) => milestone.key);
  };
  assert.deepEqual(earn({ type: 'start' }, '2026-10-06T09:00:00'), ['first-light']);
  assert.deepEqual(earn({ type: 'start' }, '2026-10-06T19:00:00'), []);
  assert.deepEqual(earn({ type: 'launch', id: 'fabula' }, '2026-10-07T02:30:00'), ['first-app', 'night-owl']);
  assert.deepEqual(earn({ type: 'launch', id: 'fabula' }, '2026-10-07T06:00:00'), ['early-bird']);
  for (let day = 8; day <= 13; day += 1) earn({ type: 'start' }, `2026-10-${String(day).padStart(2, '0')}T09:00:00`);
  assert.ok(state.earned.regular);
  assert.equal(state.launches.fabula, 2);
  assert.deepEqual(earn({ type: 'tune' }, '2026-10-14T09:00:00'), ['organist']);
  assert.deepEqual(earn({ type: 'tune' }, '2026-10-14T09:01:00'), []);
  const cleaned = delight.normaliseJournal({ earned: { 'first-light': 5, hacked: 'x' }, days: ['nope', '2026-01-01'], launches: { '../x': 3, ok: 2 }, total: 'many' });
  assert.deepEqual(cleaned, { earned: {}, days: ['2026-01-01'], launches: { ok: 2 }, total: 0 });
});

test('release notes become paragraphs and lists, never markup', () => {
  assert.deepEqual(delight.noteBlocks('## Faster\nRenders start sooner.\n\n- one\n* two\n<script>x</script>'), [
    { type: 'para', text: 'Faster' },
    { type: 'para', text: 'Renders start sooner.' },
    { type: 'gap' },
    { type: 'list', items: ['one', 'two'] },
    { type: 'para', text: '<script>x</script>' },
  ]);
});

test('the window keeps to its Content-Security-Policy and names only what preload exposes', () => {
  const html = fs.readFileSync(path.join(renderer, 'index.html'), 'utf8');
  assert.match(html, /style-src 'self';/);
  assert.doesNotMatch(html, /\sstyle="/, 'no inline style attributes');
  assert.doesNotMatch(html, /<script>(?!<\/script>)/, 'no inline scripts');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  for (const script of scripts) assert.ok(fs.existsSync(path.join(renderer, script)), script);
  const code = fs.readFileSync(path.join(renderer, 'renderer.js'), 'utf8');
  assert.doesNotMatch(code, /setAttribute\('style'/, 'styles go through the CSSOM, which the CSP allows');
  assert.doesNotMatch(code, /innerHTML\s*=\s*(?!\s|icons\.render|previousMarkup)/, 'innerHTML only ever receives a rendered icon');
  for (const product of catalog.products) assert.ok(icons.PRODUCTS.some((entry) => entry.id === product.id), `${product.id} needs a glyph`);
});
