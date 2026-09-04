/* A slow drift of accent-tinted motes behind the stage.
   Deliberately quiet: this is atmosphere, not a screensaver. Everything here is
   sprite-based (one pre-rendered dot, drawn scaled) so a full field costs one
   texture and N drawImage calls rather than N gradients per frame. */
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const SPRITE = 64;

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
    let width = 0;
    let height = 0;
    let ratio = 1;
    let sprite = makeSprite('242, 138, 50');
    let warm = makeSprite('240, 237, 230');
    let running = false;
    let frame = 0;
    let last = 0;
    // Eased toward the accent so a product change is a wash of colour, not a cut.
    let tint = { r: 242, g: 138, b: 50 };
    let target = { ...tint };

    function resize() {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
    }

    function seed() {
      // Density follows area so a wide window is not sparse and a small one is not busy.
      const wanted = Math.round(Math.min(110, Math.max(28, (width * height) / 16000)));
      motes.length = 0;
      for (let index = 0; index < wanted; index += 1) motes.push(spawn(true));
    }

    function spawn(anywhere) {
      // Depth drives size, speed and opacity together, which is what reads as parallax.
      const depth = Math.random();
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : height + 20,
        depth,
        radius: 1.1 + depth * 5.2,
        alpha: 0.05 + (1 - depth) * 0.16,
        drift: (Math.random() - 0.5) * 5,
        rise: 3 + depth * 11,
        phase: Math.random() * Math.PI * 2,
        sway: 3 + Math.random() * 9,
        warm: Math.random() < 0.22,
      };
    }

    function step(now) {
      if (!running) return;
      const elapsed = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;

      // Ease the tint, then only rebuild the sprite when it has actually moved.
      const before = `${Math.round(tint.r)},${Math.round(tint.g)},${Math.round(tint.b)}`;
      for (const key of ['r', 'g', 'b']) tint[key] += (target[key] - tint[key]) * Math.min(1, elapsed * 2.4);
      const after = `${Math.round(tint.r)},${Math.round(tint.g)},${Math.round(tint.b)}`;
      if (before !== after) sprite = makeSprite(after.replaceAll(',', ', '));

      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      for (const mote of motes) {
        mote.phase += elapsed * 0.55;
        mote.y -= mote.rise * elapsed;
        mote.x += (mote.drift + Math.sin(mote.phase) * mote.sway) * elapsed;
        if (mote.y < -24 || mote.x < -40 || mote.x > width + 40) Object.assign(mote, spawn(false));
        const size = mote.radius * 6;
        context.globalAlpha = mote.alpha;
        context.drawImage(mote.warm ? warm : sprite, mote.x - size / 2, mote.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(step);
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
        render();
      }
    }

    function render() {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      for (const mote of motes) {
        const size = mote.radius * 6;
        context.globalAlpha = mote.alpha;
        context.drawImage(mote.warm ? warm : sprite, mote.x - size / 2, mote.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
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

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('blur', stop);
    window.addEventListener('focus', start);
    REDUCED.addEventListener('change', () => (REDUCED.matches ? stop() : start()));
    if (REDUCED.matches) render(); else start();
    return { setAccent, pulse, start, stop };
  }

  const canvas = document.querySelector('#particles');
  window.instrumentaField = canvas ? createField(canvas) : { setAccent() {}, pulse() {}, start() {}, stop() {} };
})();
