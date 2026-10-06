/* What drifts behind the stage, by time and season: dust motes, fireflies, snow, falling leaves,
   blossom, or holiday lights. Deliberately quiet: this is atmosphere, not a screensaver.
   Glowing kinds use one pre-rendered sprite drawn scaled, so a full field costs one texture and
   N drawImage calls rather than N gradients per frame. */
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const SPRITE = 64;
  const SUITE = ['237, 112, 136', '0, 188, 171', '181, 131, 235', '94, 158, 253', '71, 185, 104', '115, 166, 196', '238, 119, 82', '213, 142, 0'];

  function makeSprite(rgb) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SPRITE;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.45, `rgba(${rgb}, 0.32)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, SPRITE, SPRITE);
    return canvas;
  }

  function createField(canvas) {
    const context = canvas.getContext('2d', { alpha: true });
    const motes = [];
    const sparks = [];
    const sprites = new Map();
    let width = 0;
    let height = 0;
    let ratio = 1;
    let mode = 'motes';
    let running = false;
    let frame = 0;
    let last = 0;
    // Eased toward the accent so a product change is a wash of colour, not a cut.
    let tint = { r: 213, g: 142, b: 0 };
    let target = { ...tint };
    let sprite = makeSprite('213, 142, 0');

    const spriteFor = (rgb) => { if (!sprites.has(rgb)) sprites.set(rgb, makeSprite(rgb)); return sprites.get(rgb); };

    function resize() {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
    }

    function wantedCount() {
      const base = (width * height) / 16000;
      if (mode === 'off') return 0;
      if (mode === 'fireflies') return Math.round(Math.min(40, Math.max(12, base * 0.4)));
      if (mode === 'stars') return Math.round(Math.min(70, Math.max(24, base * 0.7)));
      if (mode === 'leaves' || mode === 'blossom') return Math.round(Math.min(34, Math.max(12, base * 0.32)));
      return Math.round(Math.min(110, Math.max(28, base)));
    }

    function seed() {
      motes.length = 0;
      const wanted = wantedCount();
      for (let index = 0; index < wanted; index += 1) motes.push(spawn(true));
    }

    function spawn(anywhere) {
      // Depth drives size, speed and opacity together, which is what reads as parallax.
      const depth = Math.random();
      const falling = mode === 'snow' || mode === 'leaves' || mode === 'blossom';
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : falling ? -20 : height + 20,
        depth,
        radius: 1.1 + depth * 5.2,
        alpha: 0.05 + (1 - depth) * 0.16,
        drift: (Math.random() - 0.5) * 5,
        rise: 3 + depth * 11,
        fall: 8 + depth * 22,
        phase: Math.random() * Math.PI * 2,
        sway: 3 + Math.random() * 9,
        warm: Math.random() < 0.22,
        spin: Math.random() * Math.PI * 2,
        spinRate: (Math.random() - 0.5) * 2.4,
        hue: Math.floor(Math.random() * SUITE.length),
        blink: Math.random() * 6,
      };
    }

    function drawMote(mote, elapsed) {
      const size = mote.radius * 6;
      if (mode === 'motes') {
        mote.y -= mote.rise * elapsed;
        mote.x += (mote.drift + Math.sin(mote.phase) * mote.sway) * elapsed;
        if (mote.y < -24 || mote.x < -40 || mote.x > width + 40) Object.assign(mote, spawn(false));
        context.globalAlpha = mote.alpha;
        context.drawImage(mote.warm ? spriteFor('240, 237, 230') : sprite, mote.x - size / 2, mote.y - size / 2, size, size);
      } else if (mode === 'fireflies') {
        mote.x += (Math.cos(mote.phase * 0.7) * 9 + mote.drift) * elapsed;
        mote.y += Math.sin(mote.phase * 0.9) * 7 * elapsed;
        if (mote.x < -30) mote.x = width + 20; if (mote.x > width + 30) mote.x = -20;
        if (mote.y < -30) mote.y = height + 20; if (mote.y > height + 30) mote.y = -20;
        const glow = Math.max(0, Math.sin(mote.phase * 1.3 + mote.blink));
        context.globalAlpha = 0.08 + glow * 0.5 * (1 - mote.depth * 0.5);
        const s = size * 0.8;
        context.drawImage(spriteFor('255, 214, 120'), mote.x - s / 2, mote.y - s / 2, s, s);
      } else if (mode === 'snow') {
        mote.y += mote.fall * elapsed;
        mote.x += (Math.sin(mote.phase) * mote.sway * 0.6 + mote.drift * 0.3) * elapsed;
        if (mote.y > height + 20) Object.assign(mote, spawn(false));
        context.globalAlpha = 0.18 + (1 - mote.depth) * 0.3;
        const s = size * 0.55;
        context.drawImage(spriteFor('244, 246, 250'), mote.x - s / 2, mote.y - s / 2, s, s);
      } else if (mode === 'leaves' || mode === 'blossom') {
        mote.y += mote.fall * 0.7 * elapsed;
        mote.x += (Math.sin(mote.phase) * mote.sway * 1.4 + mote.drift) * elapsed;
        mote.spin += mote.spinRate * elapsed;
        if (mote.y > height + 20) Object.assign(mote, spawn(false));
        const leaf = mode === 'leaves';
        const colour = leaf ? ['196, 104, 42', '214, 150, 52', '160, 74, 40'][mote.hue % 3] : ['246, 190, 204', '255, 222, 230'][mote.hue % 2];
        context.save();
        context.translate(mote.x, mote.y);
        context.rotate(mote.spin);
        context.scale(1, Math.abs(Math.cos(mote.spin * 1.7)) * 0.7 + 0.3);
        context.globalAlpha = (leaf ? 0.4 : 0.5) + (1 - mote.depth) * 0.3;
        context.fillStyle = `rgb(${colour})`;
        context.beginPath();
        const r = (leaf ? 4 : 3) + mote.radius * 0.8;
        context.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      } else if (mode === 'stars') {
        const twinkle = (Math.sin(mote.phase * 2.1 + mote.blink) + 1) / 2;
        mote.y -= mote.rise * 0.15 * elapsed;
        if (mote.y < -20) Object.assign(mote, spawn(false));
        context.globalAlpha = 0.06 + twinkle * 0.34;
        const s = size * (0.45 + twinkle * 0.25);
        context.drawImage(spriteFor(SUITE[mote.hue]), mote.x - s / 2, mote.y - s / 2, s, s);
      }
    }

    function step(now) {
      if (!running) return;
      const elapsed = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      // Ease the tint, then only rebuild the sprite when it has actually moved.
      const before = `${Math.round(tint.r)}, ${Math.round(tint.g)}, ${Math.round(tint.b)}`;
      for (const key of ['r', 'g', 'b']) tint[key] += (target[key] - tint[key]) * Math.min(1, elapsed * 2.4);
      const after = `${Math.round(tint.r)}, ${Math.round(tint.g)}, ${Math.round(tint.b)}`;
      if (before !== after) sprite = makeSprite(after);

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = mode === 'leaves' || mode === 'blossom' ? 'source-over' : 'lighter';
      for (const mote of motes) { mote.phase += elapsed * 0.55; drawMote(mote, elapsed); }
      context.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.life -= elapsed;
        if (spark.life <= 0) { sparks.splice(i, 1); continue; }
        spark.vy += 220 * elapsed;
        spark.x += spark.vx * elapsed;
        spark.y += spark.vy * elapsed;
        context.globalAlpha = Math.min(1, spark.life * 1.6);
        context.drawImage(spriteFor(spark.rgb), spark.x - spark.size / 2, spark.y - spark.size / 2, spark.size, spark.size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(step);
    }

    function paintStill() {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      for (const mote of motes) {
        const size = mote.radius * 6;
        context.globalAlpha = mote.alpha;
        context.drawImage(sprite, mote.x - size / 2, mote.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    }

    function start() {
      if (running || REDUCED.matches) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    function setAccent(rgbString) {
      const parts = String(rgbString).match(/\d+(\.\d+)?/g);
      if (!parts || parts.length < 3) return;
      target = { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) };
      if (REDUCED.matches) {
        tint = { ...target };
        // One static frame so the field still reads as present without animating.
        sprite = makeSprite(`${target.r}, ${target.g}, ${target.b}`);
        paintStill();
      }
    }

    function setMode(next) {
      const wanted = ['motes', 'fireflies', 'snow', 'leaves', 'blossom', 'stars', 'off'].includes(next) ? next : 'motes';
      if (wanted === mode) return;
      mode = wanted;
      seed();
      if (REDUCED.matches) paintStill();
    }

    // A product change nudges the field outward from the mark, so the switch has
    // a physical cause rather than just a colour swap.
    function pulse(originX, originY) {
      if (REDUCED.matches) return;
      for (const mote of motes) {
        const dx = mote.x - originX;
        const dy = mote.y - originY;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance > 460) continue;
        const force = (1 - distance / 460) * 26;
        mote.drift += (dx / distance) * force;
        mote.rise += (-dy / distance) * force * 0.5;
        // Bleed the impulse off so the field settles back to its own drift.
        setTimeout(() => {
          mote.drift = (Math.random() - 0.5) * 5;
          mote.rise = 3 + mote.depth * 11;
        }, 1100 + Math.random() * 700);
      }
    }

    // A small celebration in one colour, from one point.
    function burst(originX, originY, rgbString) {
      if (REDUCED.matches) return;
      const parts = String(rgbString).match(/\d+(\.\d+)?/g);
      const rgb = parts && parts.length >= 3 ? `${Math.round(parts[0])}, ${Math.round(parts[1])}, ${Math.round(parts[2])}` : '213, 142, 0';
      for (let i = 0; i < 46; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 230;
        sparks.push({ x: originX, y: originY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 120, life: 0.7 + Math.random() * 0.8, size: 10 + Math.random() * 18, rgb: i % 4 ? rgb : '255, 250, 240' });
      }
      start();
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('blur', stop);
    window.addEventListener('focus', start);
    REDUCED.addEventListener('change', () => (REDUCED.matches ? stop() : start()));
    if (REDUCED.matches) paintStill(); else start();
    return { setAccent, setMode, pulse, burst, start, stop };
  }

  const canvas = document.querySelector('#particles');
  window.instrumentaField = canvas ? createField(canvas) : { setAccent() {}, setMode() {}, pulse() {}, burst() {}, start() {}, stop() {} };
})();
