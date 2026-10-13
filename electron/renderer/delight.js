// The parts of the launcher that are there because they are nice: the organ's notes, the
// ambience for the time and season, the workshop journal and the credits.
// Pure where it can be, so it runs in the page as `window.InstrumentaDelight` and in the Node
// tests as a module. Nothing here leaves the computer.
(function expose(root, factory) {
  const delight = factory();
  if (typeof module === 'object' && module.exports) module.exports = delight;
  else root.InstrumentaDelight = delight;
}(typeof self !== 'undefined' ? self : this, () => {
  // ---- The organ ----------------------------------------------------------------------------
  // C major pentatonic, so notes heard one after another always sit together. Instrumenta is
  // the lowest.
  const NOTES = {
    instrumenta: 261.63, fabula: 293.66, imago: 329.63, ludere: 392.0, discere: 440.0,
    learnchess: 523.25, luna: 587.33, forge3d: 659.25, delineare: 783.99,
  };
  // The greeting: G, C, E and G rising, the same four notes however many apps are installed.
  const JINGLE = [392.0, 523.25, 659.25, 783.99];
  // Beethoven's Ode to Joy (public domain), the first phrase, in beats.
  const TUNE = [[329.63, 1], [329.63, 1], [349.23, 1], [392.0, 1], [392.0, 1], [349.23, 1], [329.63, 1], [293.66, 1],
    [261.63, 1], [261.63, 1], [293.66, 1], [329.63, 1], [329.63, 1.5], [293.66, 0.5], [293.66, 2]];
  // Quiet on purpose: every sound here is a cue in the background, never a fanfare.
  const VOLUME = 0.12;

  function createOrgan() {
    let context = null;
    let bus = null;
    function audio() {
      if (context) return context;
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return null;
      context = new Context();
      bus = context.createGain(); bus.gain.value = VOLUME;
      bus.connect(context.destination);
      return context;
    }
    // A soft chime: a sine with a trace of its octave, a gentle start and a long, even fade.
    function chime(frequency, start, length, level = 0.7) {
      const ctx = audio();
      if (!ctx) return;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level, start + 0.03);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
      envelope.connect(bus);
      for (const [multiple, gain] of [[1, 1], [2, 0.08]]) {
        const tone = ctx.createOscillator();
        tone.type = 'sine';
        tone.frequency.value = frequency * multiple;
        const partial = ctx.createGain(); partial.gain.value = gain;
        tone.connect(partial).connect(envelope);
        tone.start(start);
        tone.stop(start + length + 0.05);
      }
    }
    function now() { const ctx = audio(); if (ctx?.state === 'suspended') ctx.resume(); return ctx ? ctx.currentTime + 0.02 : 0; }
    return {
      note(id, length = 1) { if (NOTES[id]) chime(NOTES[id], now(), length); },
      // About 1.6 seconds, start to silence.
      jingle() {
        const start = now();
        JINGLE.forEach((frequency, index) => {
          const last = index === JINGLE.length - 1;
          chime(frequency, start + index * 0.15, last ? 1.15 : 0.9, last ? 0.65 : 0.55);
        });
      },
      tune() {
        let start = now();
        for (const [frequency, beats] of TUNE) { chime(frequency, start, beats * 0.34 + 0.3, 0.6); start += beats * 0.34; }
        return TUNE.reduce((sum, [, beats]) => sum + beats * 0.34, 0);
      },
    };
  }

  // ---- Ambience -----------------------------------------------------------------------------
  // Seasons follow the hemisphere, which the time zone gives away well enough for this.
  const SOUTHERN = /^(Australia|Antarctica|Pacific\/(Auckland|Chatham|Fiji|Noumea)|America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Maseru|Mbabane|Lusaka))/;

  function ambienceFor(date = new Date(), timeZone = '') {
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();
    if ((month === 11 && day >= 20) || (month === 0 && day === 1)) return { mode: 'stars', label: 'Holiday lights' };
    const southern = SOUTHERN.test(timeZone);
    const seasons = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    let season = seasons[month];
    if (southern) season = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[season];
    const part = hour >= 20 || hour < 5 ? 'night' : hour >= 17 ? 'evening' : hour < 12 ? 'morning' : 'afternoon';
    const label = `${season[0].toUpperCase()}${season.slice(1)} ${part}`;
    if (season === 'winter') return { mode: 'snow', label };
    if (part === 'night' || part === 'evening') return { mode: 'fireflies', label };
    if (season === 'autumn') return { mode: 'leaves', label };
    if (season === 'spring') return { mode: 'blossom', label };
    return { mode: 'motes', label };
  }

  // ---- Workshop journal ---------------------------------------------------------------------
  // Milestones kept in this window's local storage. Never sent anywhere; clearing the launcher's
  // data clears them.
  const MILESTONES = [
    { key: 'first-light', title: 'First light', hint: 'Open Instrumenta.', text: 'Opened Instrumenta for the first time.' },
    { key: 'first-app', title: 'Into the workshop', hint: 'Open any app.', text: 'Opened an app from the launcher.' },
    { key: 'full-house', title: 'Full house', hint: 'Have every app ready at once.', text: 'Had every app in the suite installed and ready.' },
    { key: 'night-owl', title: 'Night owl', hint: 'Work while the house sleeps.', text: 'Opened an app between midnight and four.' },
    { key: 'early-bird', title: 'Early bird', hint: 'Beat the sunrise.', text: 'Opened an app between five and seven in the morning.' },
    { key: 'regular', title: 'A regular', hint: 'Come back, day after day.', text: 'Opened Instrumenta on seven different days.' },
    { key: 'hundred', title: 'A hundred openings', hint: 'Keep at it.', text: 'Opened apps a hundred times.' },
    { key: 'fresh', title: 'Fresh paint', hint: 'Let an app update itself.', text: 'Saw an app update itself.' },
    { key: 'tidy', title: 'Swept the floor', hint: 'Look in Storage.', text: 'Cleaned up after the apps.' },
    { key: 'curious', title: 'Stayed for the credits', hint: 'Find out who made what.', text: 'Watched the credits roll.' },
    { key: 'organist', title: 'The organist', hint: 'The organ knows a tune.', text: 'Played the organ’s tune.' },
  ];

  function emptyJournal() { return { earned: {}, days: [], launches: {}, total: 0 }; }

  function normaliseJournal(value) {
    const journal = emptyJournal();
    if (!value || typeof value !== 'object') return journal;
    if (value.earned && typeof value.earned === 'object') {
      for (const { key } of MILESTONES) if (typeof value.earned[key] === 'string') journal.earned[key] = value.earned[key];
    }
    if (Array.isArray(value.days)) journal.days = value.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-60);
    if (value.launches && typeof value.launches === 'object') {
      for (const [id, count] of Object.entries(value.launches)) if (/^[a-z][a-z0-9-]*$/.test(id) && Number.isSafeInteger(count)) journal.launches[id] = count;
    }
    journal.total = Number.isSafeInteger(value.total) ? value.total : 0;
    return journal;
  }

  const dayOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // Apply one event; returns the new journal and the milestones it earned.
  function record(previous, event, date = new Date()) {
    const journal = normaliseJournal(previous);
    const before = new Set(Object.keys(journal.earned));
    const earn = (key) => { if (!journal.earned[key]) journal.earned[key] = date.toISOString(); };
    const today = dayOf(date);
    if (event.type === 'start') {
      earn('first-light');
      if (!journal.days.includes(today)) journal.days.push(today);
      if (journal.days.length >= 7) earn('regular');
    } else if (event.type === 'launch') {
      journal.launches[event.id] = (journal.launches[event.id] || 0) + 1;
      journal.total += 1;
      earn('first-app');
      const hour = date.getHours();
      if (hour < 4) earn('night-owl');
      if (hour >= 5 && hour < 7) earn('early-bird');
      if (journal.total >= 100) earn('hundred');
    } else if (event.type === 'all-ready') earn('full-house');
    else if (event.type === 'updated') earn('fresh');
    else if (event.type === 'cleaned') earn('tidy');
    else if (event.type === 'credits') earn('curious');
    else if (event.type === 'tune') earn('organist');
    const earned = MILESTONES.filter((m) => journal.earned[m.key] && !before.has(m.key));
    return { journal, earned };
  }

  // ---- Release notes ------------------------------------------------------------------------
  // Notes arrive as plain text from a release manifest. Lines starting "- " or "* " become a
  // list; everything else is a paragraph. Never HTML.
  function noteBlocks(text) {
    const blocks = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { blocks.push({ type: 'gap' }); continue; }
      const item = line.match(/^[-*]\s+(.*)$/);
      if (item) {
        const last = blocks[blocks.length - 1];
        if (last?.type === 'list') last.items.push(item[1]); else blocks.push({ type: 'list', items: [item[1]] });
      } else blocks.push({ type: 'para', text: line.replace(/^#+\s*/, '') });
    }
    return blocks.filter((block, index, all) => block.type !== 'gap' || (index > 0 && index < all.length - 1 && all[index - 1].type !== 'gap'));
  }

  // ---- Credits ------------------------------------------------------------------------------
  const CREDITS = [
    { heading: 'Instrumenta', lines: ['Made at Bonehead Labs, Australia', 'Electron and electron-builder', 'NSIS, for the installer'] },
    { heading: 'Fabula', lines: ['WhisperX, for the words and their times', 'FFmpeg, for every cut', 'Chromium, for rendered scenes', 'xterm.js and the Model Context Protocol SDK', 'Claude Code and Codex, at the desk'] },
    { heading: 'Imago', lines: ['Konva and React', 'IMG.LY background removal', 'gifenc, sharp and @napi-rs/canvas', 'Anton, Archivo Black, Bebas Neue, Cinzel, DM Serif Display, IBM Plex Mono, Inter, Oswald, Playfair Display, Rubik and Space Grotesk, via Fontsource'] },
    { heading: 'Ludere', lines: ['Courier Prime, for the page', 'Plain JavaScript, on purpose'] },
    { heading: 'Discere', lines: ['React, Fastify and SQLite', 'Drizzle ORM, KaTeX and Motion', 'The Codex CLI, as tutor'] },
    { heading: 'LearnChess', lines: ['Stockfish, the engine', 'Chessground and chess.js', 'Lichess, for puzzles, games and tablebases', 'CBurnett, Merida and Pirouetti pieces', 'SQLite WASM, in the public domain'] },
    { heading: 'Luna', lines: ['Qwen TTS and Coqui XTTS, the voices', 'FastAPI, NumPy and soundfile'] },
    { heading: 'Forge3D', lines: ['Blender and Godot', 'three.js and Spark, for splats', 'The Codex App Server'] },
    { heading: 'Delineare', lines: ['React and Dexie', 'Every teacher and museum it points to, credited where they are named', 'Newsreader, by Production Type'] },
    { heading: 'Type', lines: ['Fraunces, by Undercase Type', 'Commissioner, by Kostas Bartsokas', 'Spline Sans Mono, by Eben Sorkin and Mirko Velimirovic', 'All under the SIL Open Font License'] },
    { heading: 'And', lines: ['Every open-source author whose work sits underneath', 'Full notices ship inside each app'] },
  ];

  return { CREDITS, JINGLE, MILESTONES, NOTES, TUNE, VOLUME, ambienceFor, createOrgan, emptyJournal, noteBlocks, normaliseJournal, record };
}));
