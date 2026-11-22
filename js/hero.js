/* hero.js – Momoko, painted and animated as a lit, cel-shaded character.

   One painter serves every place she appears (gameplay, the customize
   preview and its option tiles, title, intro, beach and the floss
   dance), always in the same 28 x 34 sprite box so the callers keep
   their own placement and scale.

   The look is built the way a 2D game character is inked and coloured:
   every shape is filled in its deep shadow tone, then its own outline,
   nudged toward the light, lays the mid band and the lit body over it,
   so each part gets a hard two-step terminator on its shadow side. The
   key comes from the surface (above, a little in front of her) and is
   counter-rotated as her body tilts, so the light stays put while she
   rolls through a stroke. Shadows on cloth and hair cool toward the deep
   water, skin shadows stay warm, and a sliver of cool light bounces up
   along the lower back edges. Outlines take the hue of what they
   surround instead of black.

   Animation is driven by a Rig (one per gameplay Momoko, stepped at the
   fixed 60 Hz simulation rate): she pitches into the swim direction,
   flutter-kicks (or dolphin-kicks with the monofin), strokes with her
   free arm while the wand arm points the way, treads water with slow
   sculling hands when idle, coils before a dash and rocks back when she
   brakes. Hair, skirt, ribbons and charms hang off damped springs that
   live in world space, so they trail behind her velocity, float up as
   she sinks, swing round when she turns and drift past and settle when
   she stops. She blinks on a random clock, glances around when idle,
   turns through a quick squash instead of an instant mirror, and reacts
   to casting, pickups, hits and wins. Menus without a rig get an idle
   rig driven by the wall clock. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var TAU = Math.PI * 2, PI = Math.PI;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function rnd() { return Math.random(); }

  /* ---------- Colour ---------- */
  function rgbOf(hex) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexOf(r, g, b) {
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  }
  function mix(a, b, k) {
    var x = rgbOf(a), y = rgbOf(b);
    return hexOf(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
  }
  function scale(a, k) {
    var x = rgbOf(a);
    return hexOf(Math.min(255, x[0] * k), Math.min(255, x[1] * k), Math.min(255, x[2] * k));
  }
  function lum(a) {
    var x = rgbOf(a);
    return (x[0] * 0.3 + x[1] * 0.59 + x[2] * 0.11) / 255;
  }
  /* A dark line in the fill's own hue, pulled a third of the way toward
     the house ink so every outline belongs to one family. */
  var HOUSE = [40, 20, 58];
  function inkOf(fill) {
    var x = rgbOf(fill);
    var r = x[0] / 255, g = x[1] / 255, b = x[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, d = max - min;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var out;
    if (s < 0.15) {
      out = hexOf(HOUSE[0], HOUSE[1], HOUSE[2]);
    } else {
      var h;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      var l2 = Math.min(0.24, l * 0.45), s2 = Math.min(1, s * 0.8 + 0.2);
      var cc = (1 - Math.abs(2 * l2 - 1)) * s2, xx = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = l2 - cc / 2;
      var rgb = h < 60 ? [cc, xx, 0] : h < 120 ? [xx, cc, 0] : h < 180 ? [0, cc, xx] : h < 240 ? [0, xx, cc] : h < 300 ? [xx, 0, cc] : [cc, 0, xx];
      out = hexOf((rgb[0] + m) * 255 * 0.66 + HOUSE[0] * 0.34, (rgb[1] + m) * 255 * 0.66 + HOUSE[1] * 0.34, (rgb[2] + m) * 255 * 0.66 + HOUSE[2] * 0.34);
    }
    /* Near-black fills (black hair) get a line darker than themselves */
    if (lum(out) > lum(fill) * 0.75) out = scale(fill, 0.45);
    return out;
  }
  /* Tones of one base colour: d1 / d2 the mid and deep shadow bands,
     hi the sunlit sheen, ink the outline. Skin shadows warm toward
     blood, everything else cools toward the deep water. */
  var TONE = {};
  function tone(col, kind, warm) {
    var key = col + kind + (warm ? 'w' : '');
    var v = TONE[key];
    if (v) return v;
    if (kind === 'd1') v = warm ? scale(mix(col, '#e0606a', 0.16), 0.93) : scale(mix(col, '#3a46a8', 0.2), 0.86);
    else if (kind === 'd2') v = warm ? scale(mix(col, '#b8404e', 0.32), 0.82) : scale(mix(col, '#1e2678', 0.38), 0.68);
    else if (kind === 'hi') v = mix(col, '#fff6dc', lum(col) < 0.25 ? 0.42 : 0.4);
    else v = inkOf(col);
    TONE[key] = v;
    return v;
  }

  /* ---------- Shading primitives ---------- */
  /* Step toward the key light in the current part's space. The key sits
     above and a little in front; setLight() turns it against the part's
     own rotation so tilting her doesn't drag the light along. */
  var LX = 0.38, LY = -1;
  function setLight(a) {
    var ca = Math.cos(a), sa = Math.sin(a);
    LX = 0.38 * ca - sa;
    LY = -0.38 * sa - ca;
  }

  /* Fill a shape with a two-band cel terminator, an optional cool rim
     along its lower back edge, then ink it. o: { warm, s (band size),
     ink (line width, 0 for none), rim (alpha), y0, y1 (shape extent for
     the rim gradient), x0, x1 } */
  function cel(c, path, col, o) {
    o = o || {};
    var s = o.s === undefined ? 1.2 : o.s;
    path();
    c.fillStyle = tone(col, 'd2', o.warm);
    c.fill();
    c.save();
    path();
    c.clip();
    c.translate(LX * s * 0.55, LY * s * 0.55);
    path();
    c.fillStyle = tone(col, 'd1', o.warm);
    c.fill();
    c.translate(LX * s * 0.45, LY * s * 0.45);
    path();
    c.fillStyle = col;
    c.fill();
    c.restore();
    if (o.rim) rim(c, path, o.x0, o.y0, o.x1, o.y1, o.rim);
    if (o.ink !== 0) {
      path();
      c.strokeStyle = tone(col, 'ink');
      c.lineWidth = o.ink || 0.6;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    }
  }
  /* Bounce light off the water: an inner band along the shape's edge,
     faded in only toward its lower back corner. */
  function rim(c, path, x0, y0, x1, y1, a) {
    c.save();
    path();
    c.clip();
    var g = c.createLinearGradient(x1, y0, x0, y1);
    g.addColorStop(0, 'rgba(150, 236, 255, 0)');
    g.addColorStop(0.55, 'rgba(150, 236, 255, 0)');
    g.addColorStop(1, 'rgba(160, 240, 255, ' + a + ')');
    c.strokeStyle = g;
    c.lineWidth = 1.3;
    path();
    c.stroke();
    c.restore();
  }
  function stroke(c, col, w) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }
  function ellipsePath(c, x, y, rx, ry, rot) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }
  /* A limb: a tapered capsule from (x1, y1, r1) to (x2, y2, r2) */
  function capsule(c, x1, y1, r1, x2, y2, r2) {
    var a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath();
    c.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2);
    c.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
  }
  /* A jointed limb as one closed outline: root (x0, y0, r0) through the
     joint (x1, y1, r1) to the end (x2, y2, r2). Each side is a curve that
     passes through the joint's offset point, so the elbow / knee rounds
     off instead of showing a seam between two capsules. */
  function limbPath(c, x0, y0, r0, x1, y1, r1, x2, y2, r2) {
    var d1x = x1 - x0, d1y = y1 - y0, l1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1e-3;
    var d2x = x2 - x1, d2y = y2 - y1, l2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1e-3;
    d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
    var n1x = -d1y, n1y = d1x, n2x = -d2y, n2y = d2x;
    var nmx = n1x + n2x, nmy = n1y + n2y, nl = Math.sqrt(nmx * nmx + nmy * nmy);
    if (nl < 0.3) { nmx = n1x; nmy = n1y; nl = 1; } else { nmx /= nl; nmy /= nl; }
    var k = 1 / Math.max(0.62, nmx * n1x + nmy * n1y);
    var aLx = x0 + n1x * r0, aLy = y0 + n1y * r0, aRx = x0 - n1x * r0, aRy = y0 - n1y * r0;
    var eLx = x1 + nmx * r1 * k, eLy = y1 + nmy * r1 * k, eRx = x1 - nmx * r1 * k, eRy = y1 - nmy * r1 * k;
    var wLx = x2 + n2x * r2, wLy = y2 + n2y * r2, wRx = x2 - n2x * r2, wRy = y2 - n2y * r2;
    var an1 = Math.atan2(n1y, n1x), an2 = Math.atan2(n2y, n2x);
    c.beginPath();
    c.moveTo(aLx, aLy);
    c.quadraticCurveTo(2 * eLx - (aLx + wLx) / 2, 2 * eLy - (aLy + wLy) / 2, wLx, wLy);
    c.arc(x2, y2, r2, an2, an2 - PI, true);
    c.quadraticCurveTo(2 * eRx - (aRx + wRx) / 2, 2 * eRy - (aRy + wRy) / 2, aRx, aRy);
    c.arc(x0, y0, r0, an1 + PI, an1, true);
    c.closePath();
  }
  function starPath(c, cx, cy, r, inner) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * (inner || 0.42);
      if (i === 0) c.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      else c.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    c.closePath();
  }
  function heartPath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y + r * 1.15);
    c.bezierCurveTo(x - r * 1.6, y + r * 0.1, x - r * 1.1, y - r * 1.1, x, y - r * 0.35);
    c.bezierCurveTo(x + r * 1.1, y - r * 1.1, x + r * 1.6, y + r * 0.1, x, y + r * 1.15);
    c.closePath();
  }
  function gem(c, x, y, r, col) {
    ellipsePath(c, x, y, r, r);
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, mix(col, '#ffffff', 0.35));
    g.addColorStop(1, scale(col, 0.7));
    c.fillStyle = g;
    c.fill();
  }

  /* ---------- Options ----------
     Every value the customize screen can write, so a stale or hand-edited
     customization falls back to the default instead of breaking a draw. */
  var OPTIONS = {
    hairStyle: ['twinTails', 'longBraids', 'buns', 'ponytail', 'longWavy', 'bob', 'sideTail', 'himeCut', 'ringlets', 'pixie'],
    outfit: ['frillyDress', 'sailorDress', 'starDress', 'tutuDress', 'shellDress', 'yukata', 'ballGown', 'jellyDress', 'hulaDress',
      'sailorSwimsuit', 'onePiece', 'frillyBikini', 'wetsuit', 'rashGuard', 'stripeSuit', 'skirtSuit', 'mermaidSuit', 'sharkSuit', 'tshirt'],
    shoes: ['maryJane', 'sneaker', 'flipper', 'monofin', 'sandals', 'rainBoots', 'ballet', 'geta', 'anklet'],
    acc: ['tiara', 'flowerCrown', 'bigBow', 'starClips', 'goggles', 'shellNecklace', 'pearlNecklace', 'kittyEars',
      'strawHat', 'sailorCap', 'starfish', 'coralCrown', 'snorkel', 'none'],
    back: ['none', 'finWings', 'cape', 'swimRing', 'scubaTank', 'balloon'],
    wand: ['star', 'heart', 'shell', 'trident', 'flower', 'moon', 'bubble'],
    food: ['none', 'iceCream', 'onigiri', 'donut', 'crepe', 'taiyaki', 'parfait', 'macaron', 'strawberry',
      'watermelon', 'shavedIce', 'popsicle', 'dango', 'bubbleTea'],
    crab: ['none', 'red', 'blue', 'gold', 'pink', 'hermit', 'turtle', 'octopus', 'puffer', 'seahorse'],
  };
  var DEFAULTS = {
    hair: '#e06088', suit: '#e06088', skin: '#ffddbb', flipper: '#ff99cc', trim: '#ff4f8b',
    hairStyle: 'twinTails', outfit: 'frillyDress', shoes: 'maryJane', acc: 'tiara', back: 'none', wand: 'star',
    food: 'none', crab: 'none',
  };
  var DRESSES = ['frillyDress', 'sailorDress', 'starDress', 'tutuDress', 'shellDress', 'yukata', 'ballGown', 'jellyDress', 'hulaDress'];
  function opt(cust, key) {
    var v = cust && cust[key];
    return OPTIONS[key].indexOf(v) >= 0 ? v : DEFAULTS[key];
  }
  function colour(cust, key) {
    var v = cust && cust[key];
    return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : DEFAULTS[key];
  }

  /* ---------- Rig: the animation state of one Momoko ---------- */
  function spring() { return { x: 0, y: 0, vx: 0, vy: 0 }; }
  /* Damped spring toward (tx, ty): w the natural frequency (rad/s), z
     the damping ratio. Under 1 it overshoots and drifts back, which is
     what hair does in water. */
  function springTo(s, tx, ty, w, z, dt) {
    s.vx += (w * w * (tx - s.x) - 2 * z * w * s.vx) * dt;
    s.vy += (w * w * (ty - s.y) - 2 * z * w * s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  /* Swim pitch by heading: straight up, up-forward, forward, down-forward, down */
  var PITCHES = [0.12, 0.5, 0.92, 1.05, 1.12];

  function Rig(k) {
    this.k = k || 1;
    this.t = 0;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = 1; this.sx = 1; this.turnFrom = 1; this.turnT = 1;
    this.key = 0; this.swim = 0; this.hx = 1; this.hy = 0;
    this.pitch = 0.05; this.pitchV = 0;
    this.kickPh = 0; this.strokePh = 0; this.kickAmp = 0.25;
    this.antic = 0; this.burst = 0; this.brake = 0;
    this.hair = [spring(), spring()];
    this.skirt = spring();
    this.charm = spring();
    this.blinkIn = 1.5; this.blinkT = -1; this.dbl = false;
    this.look = spring(); this.lookTx = 0; this.lookTy = 0; this.glanceIn = 2;
    this.react = null; this.reactT = 0; this.reactDur = 1;
    this.cast = 0;
    this.ear = 0; this.earIn = 3;
    this.bubbles = []; this.mouthIn = 2.5; this.kickSign = 0;
    this.emits = false;
    /* Turbo (0 at normal speed, 1 at 2x): longer kick, streamlined
       lean, streaming hair and soft speed streaks in the water */
    this.turbo = 0; this.streaks = []; this.streakIn = 0;
  }

  /* One-shot reactions from gameplay */
  Rig.prototype.event = function (name) {
    if (name === 'cast') {
      this.cast = 1;
      this.pitchV -= 0.9;
    } else if (name === 'hurt') {
      this.react = 'hurt'; this.reactT = this.reactDur = 0.75;
      this.pitchV -= 7;
      this.hair[0].vx += 14 * this.facing; this.hair[1].vx += 20 * this.facing;
      this.hair[0].vy -= 10; this.hair[1].vy -= 14;
    } else if (name === 'happy') {
      if (this.react !== 'cheer') { this.react = 'happy'; this.reactT = this.reactDur = 0.75; }
      this.hair[1].vy -= 12;
    } else if (name === 'cheer') {
      this.react = 'cheer'; this.reactT = this.reactDur = 5;
    }
  };
  /* 0..1 strength of the current reaction: quick in, short release */
  Rig.prototype.reactEnv = function () {
    if (!this.react) return 0;
    var into = this.reactDur - this.reactT;
    return Math.min(1, into / 0.08) * Math.min(1, this.reactT / 0.18);
  };

  /* s = { x, y (hitbox top-left), vx, vy (px per frame), facing, keys, turbo (0..1) } */
  Rig.prototype.step = function (dt, s) {
    var keys = s.keys || {};
    this.t += dt;
    var T = this.turbo = s.turbo || 0;
    this.x = s.x; this.y = s.y;
    var vx = s.vx || 0, vy = s.vy || 0;
    this.vx = vx; this.vy = vy;
    var speed = Math.sqrt(vx * vx + vy * vy);

    /* Turn: a quick squash through the profile instead of a snap */
    var facing = s.facing || 1;
    if (facing !== this.facing) { this.turnFrom = this.sx; this.facing = facing; this.turnT = 0; }
    if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / 0.2);
    var raw = lerp(this.turnFrom, this.facing, smooth(this.turnT));
    this.sx = (raw > 0 || (raw === 0 && this.facing > 0) ? 1 : -1) * Math.max(0.5, Math.abs(raw));

    /* Intent, anticipation and braking */
    var ix = keys.left || keys.right ? 1 : 0;
    var iy = keys.up ? -1 : keys.down ? 1 : 0;
    var key = ix || iy ? 1 : 0;
    if (key && !this.key && this.swim < 0.35) this.antic = 0.11;
    if (!key && this.key && speed > 1.3) this.brake = 1;
    this.key = key;
    if (key) this.brake = 0;
    if (this.antic > 0) {
      this.antic -= dt;
      if (this.antic <= 0) {
        this.antic = 0;
        this.burst = 1;
        if (this.emits) { this.emit(11, 35, 2, 2); this.emit(17, 35, 2, 2); }
      }
    }
    this.burst = Math.max(0, this.burst - dt * 2.2);
    this.brake = Math.max(0, this.brake - dt * 2.2);
    this.swim += (key - this.swim) * Math.min(1, dt / (key ? 0.12 : 0.42));
    var sw = this.swim;

    /* Heading in her facing frame (hx >= 0, hy < 0 is up), eased toward
       the swim intent so pitch, aim and stroke turn through a change of
       direction instead of jumping; held while she glides to a stop */
    if (key) {
      var hn = 1 / Math.sqrt(ix * ix + iy * iy), hk = Math.min(1, dt / 0.1);
      this.hx += (ix * hn - this.hx) * hk;
      this.hy += (iy * hn - this.hy) * hk;
    }

    /* Body pitch: into the heading, easing back upright as the stroke
       fades (a glide, not a snap), rocking back on a brake and rolling
       up through a turn */
    var ha = clamp(Math.atan2(this.hy, Math.max(0, this.hx)) / (PI / 4) + 2, 0, 4), hi = Math.min(3, Math.floor(ha));
    var glide = key ? sw : Math.min(sw, Math.abs(vx) / 2.6);
    var target = lerp(0.05 + Math.sin(this.t * 0.9) * 0.04, lerp(PITCHES[hi], PITCHES[hi + 1], ha - hi), glide);
    if (this.antic > 0) target -= 0.24;
    target -= 0.4 * this.brake;
    if (this.turnT < 1) target -= 0.4 * Math.sin(this.turnT * PI) * sw;
    if (this.react === 'hurt') target -= 0.3 * this.reactEnv();
    target += 0.14 * T * glide * Math.max(0, this.hx);
    this.pitchV += (81 * (target - this.pitch) - 2 * 0.75 * 9 * this.pitchV) * dt;
    this.pitch += this.pitchV * dt;

    /* Kick and stroke clocks. Cadence tops out at normal top speed
       (~3.3 kicks a second); boosted, the kick gets longer instead */
    var cs = Math.min(speed, 3.2);
    var f = lerp(1.0, 2.2 + cs * 0.35, sw) * (1 + this.burst * 0.7);
    this.kickPh += dt * TAU * f;
    this.kickAmp = lerp(0.25, 0.62 + 0.2 * T, sw) + this.burst * 0.45;
    this.strokePh += dt * TAU * lerp(0.7, 0.95 + cs * 0.2, sw) * (1 + this.burst * 0.5);
    var ks = Math.sin(this.kickPh) > 0 ? 1 : -1;
    if (ks !== this.kickSign) {
      this.kickSign = ks;
      if (this.emits && sw > 0.45 && rnd() < 0.55 + 0.4 * T) this.emit(ks > 0 ? 11 : 17, 35, T > 0.5 ? 2 : 1, 1.2);
    }

    /* Secondary motion, all in world space (sprite units); boosted, the
       hair streams further back and flutters */
    var dx = clamp(-vx * 1.1, -3.4 - 2 * T, 3.4 + 2 * T), dy = clamp(-vy * 1.0, -3 - T, 2.4 + T);
    var w1 = Math.sin(this.t * 1.3) * 0.55, w2 = Math.sin(this.t * 1.7 + 1) * 0.35 + Math.sin(this.t * 8.5) * 0.7 * T;
    springTo(this.hair[0], dx + w1 * 0.5, dy + w2 * 0.5, 7, 0.45, dt);
    springTo(this.hair[1], this.hair[0].x * 1.3 + dx * 0.5 + w1, this.hair[0].y * 1.3 + dy * 0.4 + w2, 4.6, 0.38, dt);
    this.hair[1].x = clamp(this.hair[1].x, -6.5 - 2 * T, 6.5 + 2 * T);
    this.hair[1].y = clamp(this.hair[1].y, -5.5 - T, 4.5 + T);
    springTo(this.skirt, dx * 0.6, dy * 0.7, 9, 0.5, dt);
    springTo(this.charm, dx * 0.9 + Math.sin(this.t * 2.1) * 0.3, dy * 0.9, 6, 0.3, dt);

    /* Eyes: random blinks (sometimes a double), saccadic glances */
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.15) {
        this.blinkT = -1;
        if (this.dbl) { this.dbl = false; this.blinkIn = 0.1; } else this.blinkIn = 1.8 + rnd() * 3.2;
      }
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) { this.blinkT = 0; this.dbl = rnd() < 0.22; }
    }
    if (key) {
      this.lookTx = ix ? 0.5 : 0; this.lookTy = iy * 0.45; this.glanceIn = 1.2;
    } else {
      this.glanceIn -= dt;
      if (this.glanceIn <= 0) {
        this.glanceIn = 1.1 + rnd() * 2.6;
        if (rnd() < 0.35) { this.lookTx = 0; this.lookTy = 0; }
        else { this.lookTx = rnd() * 1.3 - 0.65; this.lookTy = rnd() * 0.8 - 0.5; }
      }
    }
    springTo(this.look, this.lookTx, this.lookTy, 26, 0.85, dt);

    /* Ears twitch now and then (kitty band) */
    this.earIn -= dt;
    if (this.earIn <= 0) { this.earIn = 2 + rnd() * 4; this.ear = 1; }
    this.ear = Math.max(0, this.ear - dt * 5);

    if (this.react) { this.reactT -= dt; if (this.reactT <= 0) { this.react = null; this.reactT = 0; } }
    this.cast = Math.max(0, this.cast - dt / 0.3);

    /* A breath of bubbles now and then while she hovers */
    if (this.emits && sw < 0.2) {
      this.mouthIn -= dt;
      if (this.mouthIn <= 0) { this.mouthIn = 2.5 + rnd() * 3; this.emit(15, 18, 2, 0.6); }
    }
    /* Speed streaks: left in the water along her body, so they trail
       behind her as she pulls away, and fade in ~0.35 s */
    if (this.emits && T > 0.02 && sw > 0.5 && speed > 2) {
      this.streakIn -= dt * 18 * T;
      while (this.streakIn <= 0) {
        this.streakIn += 1;
        if (this.streaks.length < 16) {
          var sp = this.toWorld(4 + rnd() * 20, 6 + rnd() * 30);
          this.streaks.push({ x: sp.x, y: sp.y, ux: -vx / speed, uy: -vy / speed, len: 8 + 10 * T, life: 0, max: 0.28 + rnd() * 0.14, a: T });
        }
      }
    }
    for (var j = this.streaks.length - 1; j >= 0; j--) {
      this.streaks[j].life += dt;
      if (this.streaks[j].life >= this.streaks[j].max) this.streaks.splice(j, 1);
    }
    for (var i = this.bubbles.length - 1; i >= 0; i--) {
      var b = this.bubbles[i];
      b.life += dt;
      if (b.life >= b.max) { this.bubbles.splice(i, 1); continue; }
      b.vy = Math.max(-1.5, b.vy - 0.025 * dt * 60);
      b.vx *= Math.pow(0.95, dt * 60);
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
    }
  };

  /* Sprite point (before pitch) to world, matching the draw transform */
  Rig.prototype.toWorld = function (lx, ly) {
    var a = this.pitch, ca = Math.cos(a), sa = Math.sin(a);
    var dx = lx - 14, dy = ly - 21;
    var rx = 14 + dx * ca - dy * sa, ry = 21 + dx * sa + dy * ca;
    return { x: this.x + 14 + this.sx * this.k * (rx - 14), y: this.y + 31 + this.k * (ry - 31) };
  };
  Rig.prototype.emit = function (lx, ly, n, spread) {
    var w = this.toWorld(lx, ly);
    for (var i = 0; i < n && this.bubbles.length < 28; i++) {
      this.bubbles.push({
        x: w.x + (rnd() - 0.5) * spread * 2, y: w.y + (rnd() - 0.5) * spread,
        vx: this.vx * 0.25 + (rnd() - 0.5) * 0.4, vy: this.vy * 0.2 - 0.3 - rnd() * 0.4,
        r: 0.7 + rnd() * 1.1, life: 0, max: 1 + rnd() * 0.9, ph: rnd() * 6,
      });
    }
  };
  Rig.prototype.drawBubbles = function (c, camX, camY) {
    var n = this.bubbles.length, ns = this.streaks.length;
    if (!n && !ns) return;
    c.save();
    if (ns) {
      c.lineCap = 'round';
      c.lineWidth = 1.1;
      c.strokeStyle = '#e8fbff';
      for (var k = 0; k < ns; k++) {
        var st = this.streaks[k], u = st.life / st.max;
        var sx = st.x - camX, sy = st.y - camY, l = st.len * (0.6 + 0.4 * u);
        c.globalAlpha = Math.min(1, u / 0.15) * (1 - u) * 0.5 * st.a;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + st.ux * l, sy + st.uy * l);
        c.stroke();
      }
    }
    c.lineWidth = 0.7;
    for (var i = 0; i < n; i++) {
      var b = this.bubbles[i];
      var a = Math.min(1, b.life / 0.08) * (1 - b.life / b.max);
      var x = b.x - camX + Math.sin(b.ph + b.life * 7) * 0.7, y = b.y - camY;
      c.globalAlpha = a * 0.85;
      c.strokeStyle = '#e4f8ff';
      c.beginPath();
      c.arc(x, y, b.r, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(200, 240, 255, 0.25)';
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.32, 0, TAU);
      c.fill();
    }
    c.restore();
  };

  /* ---------- Pose ---------- */
  /* Everything the parts need, worked out once per draw */
  function basePose(cust) {
    var P = {
      t: 0, breathe: 0, headY: 0, bob: 0, pitch: 0, headRot: 0, sx: 1, sq: 0, swim: 0, wave: 0,
      hm: { x: 0, y: 0 }, ht: { x: 0, y: 0 }, sk: { x: 0, y: 0 }, ch: { x: 0, y: 0 }, cr: { x: 0, y: 0 },
      legs: [{ a1: 0, a2: 0.3, f: 0.3 }, { a1: 0, a2: 0.3, f: 0.3 }], monoFlex: 0,
      armB: { a1: 0.85, a2: -0.5 }, armF: { a1: -1.05, a2: -0.45 },
      eyeOpen: 1, look: { x: 0, y: 0 }, expr: 'normal', cast: 0, ear: 0, noWand: false,
      hair: colour(cust, 'hair'),
      suit: colour(cust, 'suit'),
      skin: colour(cust, 'skin'),
      shoe: colour(cust, 'flipper'),
      trim: colour(cust, 'trim'),
      hairStyle: opt(cust, 'hairStyle'),
      outfit: opt(cust, 'outfit'),
      shoes: opt(cust, 'shoes'),
      acc: opt(cust, 'acc'),
      back: opt(cust, 'back'),
      wand: opt(cust, 'wand'),
      food: opt(cust, 'food'),
    };
    var o = P.outfit;
    P.dress = DRESSES.indexOf(o) >= 0;
    P.legCol = o === 'yukata' || o === 'hulaDress' ? P.skin : P.dress ? '#ffe8ee' : o === 'wetsuit' ? P.suit :
      o === 'tshirt' ? '#3a2a18' : P.skin;
    /* sleeves: 1 short, 2 long, 3 hanging kimono sleeve, 4 puff */
    P.sleeve = o === 'wetsuit' || o === 'rashGuard' ? 2 : o === 'tshirt' ? 1 : o === 'yukata' ? 3 : o === 'ballGown' ? 4 : 0;
    P.mono = P.shoes === 'monofin';
    return P;
  }

  /* Head-local copy of a world-space spring offset */
  function toLocal(out, s, sg, a) {
    var x = s.x * sg, y = s.y, ca = Math.cos(a), sa = Math.sin(a);
    out.x = x * ca + y * sa;
    out.y = -x * sa + y * ca;
  }

  function rigPose(P, R) {
    var t = R.t, sw = R.swim, env = R.reactEnv();
    P.t = t;
    P.swim = sw;
    P.breathe = Math.sin(t * 2.2);
    P.headY = P.breathe * 0.22;
    P.sx = R.sx;
    var hop = R.react === 'happy' ? Math.sin(clamp((R.reactDur - R.reactT) / R.reactDur, 0, 1) * PI) * 1.6 : 0;
    if (R.react === 'cheer') hop = Math.abs(Math.sin(t * 6)) * 1.2 * env;
    /* Swimming straight up is drawn upright, so it gets its own stroke:
       a wide side pull with the free arm, a pumping knee kick and a
       little surge on each pull, or it reads as treading water */
    var up = smooth((-R.hy - 0.55) / 0.4) * sw, ph = R.strokePh % TAU;
    P.bob = Math.sin(t * 1.9) * 0.9 * (1 - sw) + Math.sin(R.kickPh * 2) * 0.2 * sw - hop - 0.45 * Math.sin(ph) * up;
    P.pitch = R.pitch;
    /* Squash and stretch along the body: coil before the dash, stretch
       out of it, a squeeze through the turn */
    P.sq = R.burst * 0.07 - (R.antic > 0 ? 0.06 : 0) - (R.turnT < 1 ? Math.sin(R.turnT * PI) * 0.04 : 0);
    P.headRot = -R.pitch * 0.6 + R.look.y * 0.06 + Math.sin(t * 0.7) * 0.04 * (1 - sw) - 0.1 * up;
    if (R.react === 'hurt') P.headRot += 0.18 * env;
    var sg = R.sx >= 0 ? 1 : -1, ha = P.pitch + P.headRot;
    toLocal(P.hm, R.hair[0], sg, ha);
    toLocal(P.ht, R.hair[1], sg, ha);
    toLocal(P.ch, R.charm, sg, ha);
    toLocal(P.sk, R.skirt, sg, P.pitch);
    toLocal(P.cr, R.charm, sg, P.pitch);
    P.wave = Math.sin(t * 5.2) * 0.45 * sw;

    /* Legs: a flutter kick (dolphin kick with the monofin) blended with
       a slow bicycle tread while she hovers */
    var amp = R.kickAmp, mono = P.mono;
    for (var i = 0; i < 2; i++) {
      var L = P.legs[i];
      var phi = R.kickPh + (mono ? 0 : i * PI), w = t * 2.6 + i * PI;
      var s1 = 0.08 + amp * 0.42 * (1 - 0.5 * up) * Math.sin(phi);
      var s2 = amp * 0.62 * (1 + 0.8 * up) * (0.5 + 0.5 * Math.sin(phi + 1.6));
      var s3 = 1.05 + 0.35 * amp * Math.sin(phi - 0.9);
      var i1 = -0.05 + 0.2 * Math.sin(w), i2 = 0.42 + 0.32 * Math.sin(w + 1.4), i3 = 0.3 + 0.15 * Math.sin(w + 0.6);
      if (mono) { i1 = 0.02 + 0.12 * Math.sin(t * 2.2); i2 = 0.22 + 0.2 * Math.sin(t * 2.2 + 1.2); i3 = 0.7; }
      L.a1 = lerp(i1, s1, sw) - 0.6 * R.brake - (R.antic > 0 ? 0.35 : 0);
      L.a2 = lerp(i2, s2, sw) + 0.3 * R.brake + (R.antic > 0 ? 0.9 : 0);
      L.f = lerp(i3, s3, sw);
      if (R.react === 'hurt') { L.a1 -= 0.35 * env; L.a2 += 0.5 * env; }
      if ((R.react === 'happy' || R.react === 'cheer') && i === 0) L.a2 += 0.9 * env;
    }
    P.monoFlex = 0.5 * Math.sin(R.kickPh - 1.3) * amp * sw + 0.15 * Math.sin(t * 2.2 - 0.8) * (1 - sw);

    /* Free arm: sculls by her hip when idle, strokes while swimming
       (straight up: reaches out wide and pulls down to her hip, elbow
       leading the recovery) */
    var bS1 = lerp(-0.9, 1.15, 0.5 - 0.5 * Math.cos(ph));
    var bS2 = ph < PI ? -0.2 : -0.2 - 1.1 * Math.sin(ph - PI);
    bS1 = lerp(bS1, lerp(0.3, 2.0, 0.5 + 0.5 * Math.cos(ph)), up);
    bS2 = lerp(bS2, ph < PI ? 0.15 * Math.sin(ph) : -0.95 * Math.sin(ph - PI), up);
    if (P.food !== 'none') { bS1 = lerp(bS1, 0.4, 0.55); bS2 = lerp(bS2, -0.8, 0.55); }
    var w2 = t * 2.4;
    var B = P.armB;
    B.a1 = lerp(0.85 + 0.12 * Math.sin(w2), bS1, sw);
    B.a2 = lerp(-0.5 + 0.28 * Math.sin(w2 + 1.2), bS2, sw);
    if (R.brake > 0) { B.a1 = lerp(B.a1, -1.3, R.brake); B.a2 = lerp(B.a2, -0.3, R.brake); }
    if (R.antic > 0) { B.a1 = 1.2; B.a2 = -0.4; }
    /* Wand arm: points the way she swims (lifting toward her heading
       when she swims up), thrusts on a cast */
    var F = P.armF, fwd = -PI / 2 - P.pitch * 0.85 + 0.7 * Math.min(0, Math.atan2(R.hy, R.hx)) * sw;
    /* boosted, the wand arm straightens into a streamlined reach */
    F.a1 = lerp(-1.05 + 0.06 * Math.sin(t * 1.9 + 0.5), fwd + 0.22 - 0.12 * R.turbo, sw);
    F.a2 = lerp(-0.45 + 0.05 * Math.sin(t * 1.9), -0.22 + 0.18 * R.turbo, sw);
    if (R.cast > 0) {
      var cu = 1 - R.cast, ck = smooth(cu / 0.12) * smooth(R.cast * 1.6);
      F.a1 = lerp(F.a1, fwd - 0.05 - 0.14 * Math.sin(clamp(cu / 0.35, 0, 1) * PI), ck);
      F.a2 = lerp(F.a2, 0, ck);
    }
    if (env > 0) {
      if (R.react === 'hurt') {
        B.a1 = lerp(B.a1, 1.5, env); B.a2 = lerp(B.a2, -0.6, env);
        F.a1 = lerp(F.a1, -0.5, env); F.a2 = lerp(F.a2, -1.0, env);
      } else if (R.react === 'happy') {
        B.a1 = lerp(B.a1, 2.6, env); B.a2 = lerp(B.a2, 0.3, env);
        F.a1 = lerp(F.a1, -2.1, env); F.a2 = lerp(F.a2, -0.4, env);
      } else if (R.react === 'cheer') {
        B.a1 = lerp(B.a1, 2.5 + Math.sin(t * 9 + 1) * 0.2, env); B.a2 = lerp(B.a2, 0.3, env);
        F.a1 = lerp(F.a1, -2.8 + Math.sin(t * 8) * 0.3, env); F.a2 = lerp(F.a2, -0.35, env);
      }
    }

    /* Face */
    if (R.blinkT >= 0) {
      var u = R.blinkT / 0.15;
      P.eyeOpen = 1 - (u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6);
    } else P.eyeOpen = 1;
    P.look.x = R.look.x;
    P.look.y = R.look.y;
    P.cast = R.cast;
    P.expr = R.react === 'hurt' ? 'hurt' : R.react ? 'happy' : R.cast > 0.35 ? 'cast' : 'normal';
    if (P.expr === 'cast') P.eyeOpen = Math.min(P.eyeOpen, 0.8);
    P.ear = R.ear;
  }

  /* Walking on the beach: { t, fwd, vy } plus, from the beach scene,
     phase (stride clock, advanced only while she walks, so her feet
     step instead of paddling in place), air (off the ground), land (0..1 just after a
     landing) and sx (0.5..1 width through a turn). No swim tilt.
     turbo (0..1, at 2x) lengthens the stride into a run with a forward
     lean, pumping arms and streaming hair. */
  function walkPose(P, m, frame) {
    var t = m.t !== undefined ? m.t : Date.now() * 0.001;
    var fwd = m.fwd || 0, vy = m.vy || 0, T = m.turbo || 0;
    var walk = Math.min(1, Math.abs(fwd) / 1.8);
    var air = m.air ? clamp(0.55 - vy * 0.3, 0.2, 1) : 0, land = m.land || 0;
    P.t = t;
    P.sx = m.sx || 1;
    P.breathe = Math.sin(t * 2.2);
    P.headY = P.breathe * 0.22;
    var ph = m.phase !== undefined ? m.phase * 1.5 : t * 9 + (frame || 0) * 0.3;
    var reach = 0.75 * (1 + 0.35 * T);
    for (var i = 0; i < 2; i++) {
      var s = Math.sin(ph + i * PI);
      P.legs[i].a1 = -reach * s * walk;
      P.legs[i].a2 = 0.1 + (0.75 + 0.45 * T) * Math.max(0, Math.sin(ph + i * PI + 0.8)) * walk;
      P.legs[i].f = -P.legs[i].a1 - P.legs[i].a2 * 0.6;
      /* tuck in the air (front knee higher), soak up the landing */
      P.legs[i].a1 = lerp(P.legs[i].a1, i ? -0.25 : -0.6, air) - 0.35 * land;
      P.legs[i].a2 = lerp(P.legs[i].a2, i ? 0.55 : 1.1, air) + 0.7 * land;
      P.legs[i].f = lerp(P.legs[i].f, 0.25, air);
    }
    /* stance legs angle out, so drop the body to keep her feet down */
    P.bob = 2.6 * walk * (1 - Math.cos(reach * Math.sin(ph))) * (1 - 0.35 * T) * (1 - air) + 1.1 * land;
    P.headY -= 0.3 * P.bob;
    P.pitch = (0.08 + 0.12 * T) * walk * (1 - air);
    P.sq = air * clamp(-vy * 0.03, -0.03, 0.05) - 0.05 * land;
    /* relaxed arms swinging against the legs, soft elbows; the wand
       arm drops from its held-out stance as she walks */
    P.armB.a1 = lerp(0.35 + (0.55 + 0.3 * T) * Math.sin(ph) * walk, 1.6, air * 0.7);
    P.armB.a2 = -0.3 - (0.25 + 0.6 * T) * walk;
    P.armF.a1 = lerp(P.armF.a1, -0.5 + (0.35 + 0.1 * T) * Math.sin(ph + PI), walk) - 0.35 * air;
    P.armF.a2 = lerp(P.armF.a2, -0.6 - 0.3 * T, walk);
    P.hm.x = -clamp(fwd * 0.5, -1.4, 1.4) * (1 + 0.8 * T) + Math.sin(t * 2.3) * 0.3;
    P.hm.y = clamp(-vy * 0.6, -1.4, 1.4) + Math.sin(t * 9) * 0.35 * T;
    P.ht.x = P.hm.x * 1.8 + Math.sin(t * 2.3 - 0.6) * 0.4;
    P.ht.y = P.hm.y * 1.6 + Math.sin(t * 9 - 0.8) * 0.4 * T;
    P.sk.y = P.hm.y * 0.5;
    P.ch.x = P.hm.x * 1.2;
    P.cr.x = P.ch.x;
    P.eyeOpen = (t % 3.7) < 0.13 ? 0 : 1;
  }

  /* The wall-clock idle rig behind every menu pose */
  var menuRig = null, menuLast = 0, IDLE = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, keys: {} };
  function menuPose(P) {
    if (!menuRig) menuRig = new Rig(1);
    var now = Date.now();
    var dt = menuLast ? Math.min(0.05, (now - menuLast) / 1000) : 0;
    menuLast = now;
    /* in steps no longer than the simulation's: the stiff springs
       (her glance) blow up on a slow frame taken in one go */
    for (var n = Math.ceil(dt * 60), i = 0; i < n; i++) menuRig.step(dt / n, IDLE);
    rigPose(P, menuRig);
  }
  /* A fixed, open-eyed pose for the option tiles */
  var stillRig = null;
  function stillPose(P) {
    if (!stillRig) { stillRig = new Rig(1); stillRig.t = 0.65; }
    rigPose(P, stillRig);
  }

  /* ---------- Hair ---------- */
  /* Cranium plus the back mass that falls to her shoulders */
  function backHairPath(c, y) {
    c.beginPath();
    c.ellipse(14, 9.8 + y, 10.7, 9.9, 0, Math.PI * 0.94, Math.PI * 2.06);
    c.bezierCurveTo(25.4, 15 + y, 25, 19.5 + y, 23.6, 23.4 + y);
    c.quadraticCurveTo(22.4, 21.6 + y, 21, 22.6 + y);
    c.lineTo(7, 22.6 + y);
    c.quadraticCurveTo(5.6, 21.6 + y, 4.4, 23.4 + y);
    c.bezierCurveTo(3, 19.5 + y, 2.6, 15 + y, 3.4, 11.5 + y);
    c.closePath();
  }
  /* Chin-length bob: the back mass stops at the jaw and its tips curl in */
  function bobPath(c, P) {
    var y = P.headY, mx = P.hm.x * 0.3, my = P.hm.y * 0.3, tx = P.ht.x * 0.3, ty = P.ht.y * 0.3;
    c.beginPath();
    c.ellipse(14, 9.8 + y, 11.2, 10.2, 0, Math.PI * 0.94, Math.PI * 2.06);
    c.bezierCurveTo(26.2 + mx, 13.5 + y + my, 26 + tx, 17.4 + y + ty, 24.2 + tx, 19.8 + y + ty);
    c.quadraticCurveTo(22.6 + tx, 20.6 + y + ty, 21.4, 18.6 + y);
    c.lineTo(6.6, 18.6 + y);
    c.quadraticCurveTo(5.4 + tx, 20.6 + y + ty, 3.8 + tx, 19.8 + y + ty);
    c.bezierCurveTo(2 + tx, 17.4 + y + ty, 1.8 + mx, 13.5 + y + my, 3.2, 11.4 + y);
    c.closePath();
  }
  /* Long loose waves down her back: the mass streams with the springs
     and its hem ripples */
  function wavyPath(c, P) {
    var y = P.headY, mx = P.hm.x + P.wave * 0.5, my = P.hm.y, tx = P.ht.x + P.wave, ty = P.ht.y;
    c.beginPath();
    c.ellipse(14, 9.8 + y, 10.9, 10.1, 0, Math.PI * 0.94, Math.PI * 2.06);
    c.bezierCurveTo(26.2, 15 + y, 26.8 + mx, 24 + y + my, 25.2 + tx, 32.6 + y + ty);
    var x0 = 25.2 + tx, x1 = 2.8 + tx, yb = 32.6 + y + ty;
    for (var j = 1; j <= 5; j++) {
      var xa = lerp(x0, x1, (j - 0.5) / 5), xb = lerp(x0, x1, j / 5);
      c.quadraticCurveTo(xa, yb + 1.7 + Math.sin(P.t * 2 + j * 1.3) * 0.45, xb, yb - (j < 5 ? 0.5 : 0));
    }
    c.bezierCurveTo(1.2 + mx, 24 + y + my, 1.8, 15 + y, 3.1, 11.5 + y);
    c.closePath();
  }

  /* One twin tail. side -1 left, +1 right; the sway is in head space
     (both tails stream the same way). Two locks: the main one and a
     slimmer one curling off it. */
  function twinTail(c, P, side) {
    var y = P.headY;
    var X = function (v) { return 14 + side * v; };
    var lag = Math.sin(P.t * 2.1 + side) * 0.25;
    /* the tail on the leading side swings round behind her head */
    var fold = Math.min(0, P.ht.x * side) * 1.3 * side;
    var mx = P.hm.x + P.wave * 0.4 + fold * 0.6, my = P.hm.y, sx = P.ht.x + P.wave + lag + fold, sy = P.ht.y;
    var main = function () {
      c.beginPath();
      c.moveTo(X(10.2), 8.6 + y);
      c.bezierCurveTo(X(16.6), 12 + y, X(17.6) + mx, 21 + y + my, X(14.4) + sx, 30.2 + y + sy);
      c.quadraticCurveTo(X(13.2) + sx, 31 + y + sy, X(12.6) + sx * 0.9, 29.2 + y + sy * 0.9);
      c.bezierCurveTo(X(14.2) + mx * 0.9, 23.4 + y + my, X(12.6), 16 + y, X(8.4), 11.6 + y);
      c.closePath();
    };
    var lock = function () {
      c.beginPath();
      c.moveTo(X(10.6), 11 + y);
      c.bezierCurveTo(X(13.2), 15 + y, X(12.6) + mx, 21 + y + my, X(11.2) + sx * 0.8, 25.6 + y + sy * 0.8);
      c.quadraticCurveTo(X(10.8) + mx, 23 + y + my * 0.8, X(11.4), 17.5 + y);
      c.closePath();
    };
    var o = { s: 1.5, ink: 0.55, rim: 0.55, x0: X(17), x1: X(9), y0: 9 + y, y1: 31 + y };
    if (side > 0) { o.x0 = X(9); o.x1 = X(17); }
    cel(c, main, P.hair, o);
    cel(c, lock, P.hair, { s: 1, ink: 0.45 });
    /* strand line and a sheen down the outer curve */
    c.beginPath();
    c.moveTo(X(11.6), 12 + y);
    c.bezierCurveTo(X(15), 16 + y, X(15.4) + mx, 23 + y + my, X(13.8) + sx * 0.9, 28.4 + y + sy * 0.9);
    stroke(c, tone(P.hair, 'ink'), 0.35);
    c.beginPath();
    c.moveTo(X(13.4), 12.6 + y);
    c.quadraticCurveTo(X(16.4), 16 + y, X(16.2) + mx * 0.6, 20 + y + my * 0.6);
    c.globalAlpha = 0.75;
    stroke(c, tone(P.hair, 'hi'), 0.55);
    c.globalAlpha = 1;
  }

  function ribbonBow(c, P, x, y) {
    var col = P.suit;
    var loop = function (dir) {
      return function () {
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + dir * 1.2, y - 2.6, x + dir * 3.6, y - 2.2, x + dir * 3.2, y);
        c.bezierCurveTo(x + dir * 3.6, y + 2.2, x + dir * 1.2, y + 2.4, x, y);
        c.closePath();
      };
    };
    cel(c, loop(-1), col, { s: 0.8, ink: 0.4 });
    cel(c, loop(1), col, { s: 0.8, ink: 0.4 });
    ellipsePath(c, x, y, 0.9, 1);
    c.fillStyle = tone(col, 'd1');
    c.fill();
    stroke(c, tone(col, 'ink'), 0.35);
  }

  function braid(c, P, side) {
    var y = P.headY;
    for (var b = 0; b < 6; b++) {
      var k = b / 5, q1 = 2 * k * (1 - k), q2 = k * k;
      var bx = 14 + side * 11.6 + (b % 2 ? 0.7 : -0.7) * side + P.hm.x * q1 + (P.ht.x + P.wave * k) * q2;
      var by = 10.4 + b * 3.7 + y + P.hm.y * q1 + P.ht.y * q2;
      (function (bx, by) {
        cel(c, function () { ellipsePath(c, bx, by, 2.5, 2.7, side * (b % 2 ? 0.35 : -0.35)); }, P.hair,
          { s: 1, ink: 0.45, rim: 0.4, x0: bx - side * 2.5, x1: bx + side * 2.5, y0: by - 2.7, y1: by + 2.7 });
        c.beginPath();
        c.moveTo(bx - 1.2, by - 0.9);
        c.quadraticCurveTo(bx, by - 1.8, bx + 1.2, by - 0.9);
        c.globalAlpha = 0.7;
        stroke(c, tone(P.hair, 'hi'), 0.45);
        c.globalAlpha = 1;
      })(bx, by);
    }
    var tx = 14 + side * 11.6 + P.ht.x * 1.15 + P.wave, ty = 31.6 + y + P.ht.y;
    var tw = P.ht.x * 0.25;
    /* tuft below the tie */
    cel(c, function () {
      c.beginPath();
      c.moveTo(tx - 1.3, ty);
      c.quadraticCurveTo(tx - 1.8 + tw, ty + 2.6, tx - 0.4 + tw * 1.5, ty + 3.4);
      c.quadraticCurveTo(tx + 0.3 + tw, ty + 2, tx + 1.4 + tw * 1.5, ty + 3);
      c.quadraticCurveTo(tx + 1.6, ty + 1.4, tx + 1.3, ty);
      c.closePath();
    }, P.hair, { s: 0.6, ink: 0.4 });
    cel(c, function () { ellipsePath(c, tx, ty - 0.2, 1.9, 1.05); }, P.suit, { s: 0.6, ink: 0.4 });
  }

  function bun(c, P, x, y) {
    cel(c, function () { ellipsePath(c, x, y, 4.3, 4.1); }, P.hair,
      { s: 1.3, ink: 0.55, rim: 0.4, x0: x - 4, x1: x + 4, y0: y - 4, y1: y + 4 });
    /* coil strands and a gloss crescent */
    var ink = tone(P.hair, 'ink');
    c.beginPath(); c.arc(x + 0.3, y + 0.3, 2.4, Math.PI * 0.8, Math.PI * 2.1); stroke(c, ink, 0.35);
    c.beginPath(); c.arc(x - 0.2, y + 0.5, 1.1, Math.PI * 1.1, Math.PI * 2.3); stroke(c, ink, 0.3);
    c.beginPath(); c.arc(x, y + 0.2, 3.2, Math.PI * 1.15, Math.PI * 1.6);
    stroke(c, tone(P.hair, 'hi'), 0.8);
    ellipsePath(c, x - 1.6, y - 2.2, 0.5, 0.35);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
  }
  function bunRibbon(c, P, side) {
    var y = P.headY, mx = P.hm.x * 0.8, my = P.hm.y * 0.6, sx = P.ht.x + P.wave, sy = P.ht.y;
    var X = function (v) { return 14 + side * v; };
    cel(c, function () {
      c.beginPath();
      c.moveTo(X(10.4), 5.6 + y);
      c.quadraticCurveTo(X(14.6) + mx, 14 + y + my, X(12.6) + sx, 24.4 + y + sy);
      c.lineTo(X(11.4) + sx, 22.6 + y + sy);
      c.lineTo(X(10.2) + sx * 0.95, 24.2 + y + sy);
      c.quadraticCurveTo(X(11.4) + mx, 14 + y + my, X(7.6), 6.4 + y);
      c.closePath();
    }, P.suit, { s: 1, ink: 0.45, rim: 0.35, x0: X(13), x1: X(8), y0: 6, y1: 24 });
  }

  /* High ponytail tied at the back of her crown, streaming behind */
  function ponytail(c, P) {
    var y = P.headY, mx = P.hm.x + P.wave * 0.5, my = P.hm.y, tx = P.ht.x + P.wave, ty = P.ht.y;
    var path = function () {
      c.beginPath();
      c.moveTo(7.2, 1.2 + y);
      c.bezierCurveTo(1.4, 0.2 + y, -3.6 + mx * 0.6, 8 + y + my * 0.6, -3 + mx, 15 + y + my);
      c.bezierCurveTo(-2.6 + mx, 19.6 + y + my, -0.8 + tx, 23.4 + y + ty, 0.6 + tx, 26 + y + ty);
      c.quadraticCurveTo(0.4 + tx * 0.9, 22 + y + ty * 0.9, 1.6 + mx, 17 + y + my);
      c.bezierCurveTo(2.6 + mx * 0.7, 12 + y + my * 0.6, 3.4, 7 + y, 6.4, 5 + y);
      c.closePath();
    };
    cel(c, path, P.hair, { s: 1.5, ink: 0.55, rim: 0.55, x0: -3, x1: 6, y0: y, y1: 26 + y });
    c.beginPath();
    c.moveTo(4.6, 3 + y);
    c.bezierCurveTo(0.4, 4 + y, -1.4 + mx * 0.7, 11 + y + my * 0.7, -0.8 + mx, 16 + y + my);
    c.quadraticCurveTo(-0.2 + tx * 0.8, 21 + y + ty * 0.8, 0.4 + tx, 24.6 + y + ty);
    stroke(c, tone(P.hair, 'ink'), 0.35);
    c.beginPath();
    c.moveTo(4.4, 1.4 + y);
    c.quadraticCurveTo(0.2, 2.2 + y, -1.6 + mx * 0.5, 8 + y + my * 0.5);
    c.globalAlpha = 0.75;
    stroke(c, tone(P.hair, 'hi'), 0.6);
    c.globalAlpha = 1;
  }
  function scrunchie(c, P) {
    var y = P.headY;
    cel(c, function () { ellipsePath(c, 6.4, 3 + y, 1.9, 2.4, -0.6); }, P.suit, { s: 0.7, ink: 0.45 });
    c.beginPath();
    c.moveTo(5.4, 2.2 + y); c.lineTo(6.8, 3.8 + y);
    c.moveTo(6.2, 1.4 + y); c.lineTo(7.4, 2.8 + y);
    stroke(c, tone(P.suit, 'd1'), 0.3);
  }

  /* Waist-length straight hair with a blunt hem (hime cut) */
  function himePath(c, P) {
    var y = P.headY, mx = P.hm.x * 0.7, my = P.hm.y * 0.6, tx = P.ht.x * 0.8 + P.wave * 0.4, ty = P.ht.y * 0.7;
    c.beginPath();
    c.ellipse(14, 9.8 + y, 10.9, 10.1, 0, Math.PI * 0.94, Math.PI * 2.06);
    c.bezierCurveTo(25.9, 15 + y, 26.3 + mx, 24 + y + my, 25.5 + tx, 31.8 + y + ty);
    c.quadraticCurveTo(14 + tx, 33.4 + y + ty, 2.5 + tx, 31.8 + y + ty);
    c.bezierCurveTo(1.7 + mx, 24 + y + my, 2.1, 15 + y, 3.1, 11.5 + y);
    c.closePath();
  }
  /* Pixie cut: hugs the head, with flicked tips over the ears and nape */
  function pixiePath(c, P) {
    var y = P.headY, tx = P.ht.x * 0.22, ty = P.ht.y * 0.18;
    c.beginPath();
    c.ellipse(14, 9.8 + y, 10.8, 10, 0, Math.PI * 0.94, Math.PI * 2.06);
    c.quadraticCurveTo(25.5 + tx, 13.8 + y, 25.7 + tx, 16.5 + y + ty);
    c.quadraticCurveTo(25, 16 + y, 23.8, 15.2 + y);
    c.quadraticCurveTo(24.4, 17.8 + y, 23 + tx, 20.6 + y + ty);
    c.quadraticCurveTo(22, 18.6 + y, 20.6, 17.6 + y);
    c.lineTo(7.4, 17.6 + y);
    c.quadraticCurveTo(6, 18.6 + y, 5 + tx, 20.6 + y + ty);
    c.quadraticCurveTo(3.6, 17.8 + y, 4.2, 15.2 + y);
    c.quadraticCurveTo(3, 16 + y, 2.3 + tx, 16.5 + y + ty);
    c.quadraticCurveTo(2.5 + tx, 13.8 + y, 3.2, 11.5 + y);
    c.closePath();
  }
  /* The pixie cut's cowlick, bouncing on the hair spring */
  function ahoge(c, P) {
    var y = P.headY, tx = P.ht.x * 0.5, ty = P.ht.y * 0.3;
    cel(c, function () {
      c.beginPath();
      c.moveTo(12.6, 0.2 + y);
      c.bezierCurveTo(12.4, -3 + y, 15.4 + tx, -5.6 + y + ty, 18.6 + tx, -4.4 + y + ty);
      c.bezierCurveTo(16.4 + tx, -3.6 + y + ty, 15.2, -1.8 + y, 15.4, 0.4 + y);
      c.closePath();
    }, P.hair, { s: 0.7, ink: 0.45 });
  }

  /* One fat side tail tied high over her ear, curling in at the tip */
  function sideTail(c, P) {
    var y = P.headY, X = function (v) { return 14 + v; };
    var lag = Math.sin(P.t * 2.1 + 1) * 0.25;
    var fold = Math.min(0, P.ht.x) * 1.2;
    var mx = P.hm.x + P.wave * 0.4 + fold * 0.6, my = P.hm.y, sx = P.ht.x + P.wave + lag + fold, sy = P.ht.y;
    var main = function () {
      c.beginPath();
      c.moveTo(X(8.8), 5 + y);
      c.bezierCurveTo(X(18.4), 5.6 + y, X(21) + mx, 17 + y + my, X(16.6) + sx, 27.2 + y + sy);
      c.quadraticCurveTo(X(15.2) + sx, 31 + y + sy, X(11.6) + sx, 29.6 + y + sy);
      c.quadraticCurveTo(X(14) + sx, 28.4 + y + sy, X(13.6) + sx * 0.85, 25.2 + y + sy * 0.85);
      c.bezierCurveTo(X(14.6) + mx * 0.8, 19 + y + my, X(12.6), 13 + y, X(7.6), 9.8 + y);
      c.closePath();
    };
    var lock = function () {
      c.beginPath();
      c.moveTo(X(10), 9.4 + y);
      c.bezierCurveTo(X(13.4), 13 + y, X(13.4) + mx, 19.6 + y + my, X(11.2) + sx * 0.75, 24.8 + y + sy * 0.75);
      c.quadraticCurveTo(X(11) + mx, 21 + y + my * 0.8, X(10.6), 15.6 + y);
      c.closePath();
    };
    cel(c, main, P.hair, { s: 1.6, ink: 0.55, rim: 0.55, x0: X(9), x1: X(19), y0: 5 + y, y1: 31 + y });
    cel(c, lock, P.hair, { s: 1, ink: 0.45 });
    c.beginPath();
    c.moveTo(X(11.4), 8.4 + y);
    c.bezierCurveTo(X(16.6), 11 + y, X(17.8) + mx, 20 + y + my, X(15) + sx * 0.9, 27 + y + sy * 0.9);
    c.moveTo(X(10.6), 10.6 + y);
    c.bezierCurveTo(X(14.4), 14 + y, X(15.6) + mx, 20 + y + my, X(14.2) + sx * 0.85, 25 + y + sy * 0.85);
    stroke(c, tone(P.hair, 'ink'), 0.33);
    c.beginPath();
    c.moveTo(X(13.6), 7.6 + y);
    c.bezierCurveTo(X(17.8), 9.6 + y, X(19.4) + mx * 0.6, 15 + y + my * 0.6, X(18.6) + mx * 0.8, 20 + y + my * 0.8);
    c.globalAlpha = 0.75;
    stroke(c, tone(P.hair, 'hi'), 0.65);
    c.globalAlpha = 1;
  }

  /* A ringlet: fat coils stacked down a springy curve, tapering to a
     point. Drawn tip first so each coil overlaps the one below it. */
  function ringlet(c, P, side) {
    var y = P.headY, ink = tone(P.hair, 'ink'), hi = tone(P.hair, 'hi'), rot = side * 0.4;
    var at = function (b) {
      var k = b / 5, q1 = 2 * k * (1 - k), q2 = k * k;
      return [14 + side * (11.6 + 0.5 * Math.sin(b * 2.2)) + P.hm.x * q1 + (P.ht.x + P.wave * k) * q2,
        10 + b * 3.9 + y + P.hm.y * q1 + P.ht.y * q2];
    };
    var tip = at(4.75), last = at(4);
    cel(c, function () {
      c.beginPath();
      c.moveTo(last[0] - 1.5, last[1] + 0.6);
      c.quadraticCurveTo(tip[0] - 1.2, tip[1], tip[0] + side * 0.5, tip[1] + 1.2);
      c.quadraticCurveTo(tip[0] + 1.3, tip[1] - 0.4, last[0] + 1.5, last[1] + 0.6);
      c.closePath();
    }, P.hair, { s: 0.6, ink: 0.4 });
    for (var b = 4; b >= 0; b--) {
      (function (p, rx, ry) {
        cel(c, function () { ellipsePath(c, p[0], p[1], rx, ry, rot); }, P.hair,
          { s: 1.1, ink: 0.45, rim: 0.4, x0: p[0] - side * rx, x1: p[0] + side * rx, y0: p[1] - ry, y1: p[1] + ry });
        /* the groove where the curl wraps round, and its sheen */
        c.beginPath();
        c.ellipse(p[0], p[1] + ry * 0.5, rx * 0.9, ry * 0.7, rot, PI * 1.12, PI * 1.88);
        stroke(c, ink, 0.3);
        c.beginPath();
        c.ellipse(p[0] + 0.2, p[1] - ry * 0.1, rx * 0.62, ry * 0.5, rot, PI * 1.2, PI * 1.7);
        c.globalAlpha = 0.8;
        stroke(c, hi, 0.55);
        c.globalAlpha = 1;
      })(at(b), 3.5 - b * 0.4, 2.7 - b * 0.22);
    }
  }

  /* Fringe: five curved locks with pointed tips across the forehead */
  function bangsPath(c, y) {
    c.beginPath();
    c.moveTo(4.6, 13 + y);
    c.bezierCurveTo(3.4, 4.6 + y, 7.6, -1.6 + y, 14, -1.6 + y);
    c.bezierCurveTo(20.4, -1.6 + y, 24.6, 4.6 + y, 23.4, 13 + y);
    c.quadraticCurveTo(22.4, 9.8 + y, 21.2, 8.4 + y);
    c.quadraticCurveTo(21.6, 10.6 + y, 20.4, 12.2 + y);
    c.quadraticCurveTo(19.6, 9.4 + y, 17.8, 8.2 + y);
    c.quadraticCurveTo(18, 10 + y, 16.8, 11.2 + y);
    c.quadraticCurveTo(15.8, 8.8 + y, 14.2, 7.9 + y);
    c.quadraticCurveTo(14, 10.4 + y, 12.8, 11.7 + y);
    c.quadraticCurveTo(12.2, 9.2 + y, 10.4, 8.3 + y);
    c.quadraticCurveTo(10.2, 10.4 + y, 9, 11.4 + y);
    c.quadraticCurveTo(8.2, 9.4 + y, 6.8, 8.6 + y);
    c.quadraticCurveTo(6, 10.6 + y, 4.6, 13 + y);
    c.closePath();
  }
  /* Straight-cut fringe for the hime cut */
  function bluntBangsPath(c, y) {
    c.beginPath();
    c.moveTo(4.6, 12.6 + y);
    c.bezierCurveTo(3.4, 4.6 + y, 7.6, -1.6 + y, 14, -1.6 + y);
    c.bezierCurveTo(20.4, -1.6 + y, 24.6, 4.6 + y, 23.4, 12.6 + y);
    c.quadraticCurveTo(22.8, 10 + y, 21.6, 9.2 + y);
    c.lineTo(18.3, 9.7 + y); c.lineTo(18, 8.9 + y); c.lineTo(17.7, 9.75 + y);
    c.lineTo(14.3, 9.9 + y); c.lineTo(14, 9.1 + y); c.lineTo(13.7, 9.9 + y);
    c.lineTo(10.3, 9.75 + y); c.lineTo(10, 8.9 + y); c.lineTo(9.7, 9.7 + y);
    c.lineTo(6.4, 9.2 + y);
    c.quadraticCurveTo(5.2, 10 + y, 4.6, 12.6 + y);
    c.closePath();
  }
  function fringePath(c, P, y) {
    if (P.hairStyle === 'himeCut') bluntBangsPath(c, y);
    else bangsPath(c, y);
  }
  /* The hime cut's cheek-length side panels, cut square */
  function himeLock(c, P, side) {
    var y = P.headY, X = function (v) { return 14 + side * v; };
    var sw = P.hm.x * 0.25, sy = P.hm.y * 0.15;
    cel(c, function () {
      c.beginPath();
      c.moveTo(X(10.3), 6 + y);
      c.bezierCurveTo(X(10.9), 10 + y, X(10.7) + sw, 14 + y, X(10.2) + sw, 17.4 + y + sy);
      c.quadraticCurveTo(X(8.8) + sw, 18.2 + y + sy, X(7.3) + sw, 17.5 + y + sy);
      c.quadraticCurveTo(X(7.5), 12 + y, X(7.9), 7.4 + y);
      c.closePath();
    }, P.hair, { s: 0.9, ink: 0.45 });
    c.beginPath();
    c.moveTo(X(9.2), 8.4 + y);
    c.quadraticCurveTo(X(9.5) + sw * 0.5, 13 + y, X(9) + sw, 17.2 + y + sy);
    stroke(c, tone(P.hair, 'ink'), 0.28);
  }
  function sideLock(c, P, side, len) {
    var y = P.headY, X = function (v) { return 14 + side * v; };
    var sw = P.hm.x * 0.3, sy = P.hm.y * 0.2;
    len = len || 0;
    cel(c, function () {
      c.beginPath();
      c.moveTo(X(9.8), 6.4 + y);
      c.bezierCurveTo(X(10.4), 11 + y, X(9.8) + sw, 15.6 + y + len * 0.5, X(8.6) + sw, 19.6 + y + len + sy);
      c.quadraticCurveTo(X(8.2) + sw, 17 + y + len * 0.7, X(7.4), 14.4 + y);
      c.quadraticCurveTo(X(7.4), 10.2 + y, X(8), 7.6 + y);
      c.closePath();
    }, P.hair, { s: 0.9, ink: 0.45 });
  }

  function hairBack(c, P) {
    var y = P.headY, st = P.hairStyle;
    if (st === 'twinTails') { twinTail(c, P, -1); twinTail(c, P, 1); }
    else if (st === 'longBraids') { braid(c, P, -1); braid(c, P, 1); }
    else if (st === 'buns') { bunRibbon(c, P, -1); bunRibbon(c, P, 1); }
    else if (st === 'ponytail') ponytail(c, P);
    else if (st === 'sideTail') sideTail(c, P);
    else if (st === 'ringlets') { ringlet(c, P, -1); ringlet(c, P, 1); }
    var path, y1 = 24 + y, long = st === 'longWavy' || st === 'himeCut';
    if (st === 'longWavy') { path = function () { wavyPath(c, P); }; y1 = 34 + y; }
    else if (st === 'himeCut') { path = function () { himePath(c, P); }; y1 = 33 + y; }
    else if (st === 'bob') { path = function () { bobPath(c, P); }; y1 = 20 + y; }
    else if (st === 'pixie') { path = function () { pixiePath(c, P); }; y1 = 20 + y; }
    else path = function () { backHairPath(c, y); };
    cel(c, path, P.hair, { s: 1.6, ink: 0.55, rim: 0.45, x0: 4, x1: 24, y0: y, y1: y1 });
    /* underside of the back hair sits in the head's shadow */
    c.save();
    path();
    c.clip();
    c.fillStyle = tone(P.hair, 'd2');
    c.globalAlpha = 0.6;
    ellipsePath(c, 14, (st === 'bob' || st === 'pixie' ? 18 : 21) + y, 9, 4.5);
    c.fill();
    if (long) {
      /* strands and a sheen down the length */
      c.globalAlpha = 1;
      var ink = tone(P.hair, 'ink'), mx = P.hm.x + P.wave * 0.5, tx = P.ht.x + P.wave, ty = P.ht.y;
      c.beginPath();
      for (var s = 0; s < 4; s++) {
        var sx0 = s < 2 ? 4.4 + s * 1.6 : 21 + (s - 2) * 1.6;
        c.moveTo(sx0, 14 + y);
        c.bezierCurveTo(sx0 - 0.6 + mx * 0.5, 20 + y, sx0 + 0.6 + mx, 26 + y, sx0 + tx, 31.6 + y + ty);
      }
      stroke(c, ink, 0.32);
      c.beginPath();
      c.moveTo(24.6, 13 + y);
      c.bezierCurveTo(25.6, 18 + y, 25.4 + mx * 0.6, 23 + y, 24.6 + tx * 0.8, 28 + y + ty * 0.8);
      c.globalAlpha = 0.7;
      stroke(c, tone(P.hair, 'hi'), 0.6);
    }
    c.restore();
    if (st === 'ponytail') scrunchie(c, P);
  }

  /* ---------- Face ---------- */
  function facePath(c, y) {
    c.beginPath();
    c.moveTo(5.8, 11.6 + y);
    c.ellipse(14, 11.6 + y, 8.2, 8, 0, Math.PI, 0);
    c.bezierCurveTo(22.2, 15.4 + y, 18.6, 19.5 + y, 14, 19.5 + y);
    c.bezierCurveTo(9.4, 19.5 + y, 5.8, 15.4 + y, 5.8, 11.6 + y);
    c.closePath();
  }

  /* Upper lash line: heavy, thinning to the inside, with an outer flick */
  function lashPath(c, x, y, o) {
    c.beginPath();
    c.moveTo(x - o * 2.4, y - 2.1);
    c.quadraticCurveTo(x, y - 4.2, x + o * 2.8, y - 2);
    c.lineTo(x + o * 3.8, y - 3.1);
    c.lineTo(x + o * 3.1, y - 1.3);
    c.quadraticCurveTo(x, y - 3.4, x - o * 2.4, y - 2.1);
    c.closePath();
  }

  function eye(c, P, x, y, side) {
    var open = P.eyeOpen;
    if (open < 0.22) {
      c.beginPath();
      c.moveTo(x - 2.5, y + 0.4);
      c.quadraticCurveTo(x, y + 1.9, x + 2.5, y + 0.4);
      stroke(c, '#2a1222', 0.75);
      return;
    }
    var drop = (1 - open) * 4.6;
    var lx = P.look.x * 0.6, ly = P.look.y * 0.55;
    c.save();
    if (drop > 0) { c.beginPath(); c.rect(x - 4, y - 3.4 + drop, 8, 9); c.clip(); }
    /* sclera, shadowed under the lid */
    ellipsePath(c, x, y, 2.75, 3.2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.save();
    ellipsePath(c, x, y, 2.75, 3.2);
    c.clip();
    c.fillStyle = 'rgba(120, 128, 200, 0.4)';
    ellipsePath(c, x, y - 3 + drop, 3.6, 2.2);
    c.fill();
    /* iris: dark wine at the top glowing to rose at the bottom */
    var ix = x + 0.2 + lx, iy = y + 0.35 + ly;
    var g = c.createLinearGradient(0, iy - 3.2, 0, iy + 2.6);
    g.addColorStop(0, '#2c0f22');
    g.addColorStop(0.45, '#7a3550');
    g.addColorStop(1, '#f08aa6');
    ellipsePath(c, ix, iy, 2.25, 2.85);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#2a0c1e';
    c.lineWidth = 0.35;
    c.stroke();
    /* pupil */
    ellipsePath(c, ix, iy + 0.15, 0.95, 1.35);
    c.fillStyle = '#1a0812';
    c.fill();
    /* lower-iris glow ring */
    c.beginPath();
    c.ellipse(ix, iy + 0.25, 1.6, 1.9, 0, 0.3, Math.PI - 0.3);
    c.strokeStyle = 'rgba(255, 196, 214, 0.75)';
    c.lineWidth = 0.4;
    c.stroke();
    c.restore();
    /* catchlights: her star, a round one, a fleck (they lag the iris) */
    var cx = x + lx * 0.5, cy = y + ly * 0.5;
    c.fillStyle = '#ffffff';
    starPath(c, cx + 0.8, cy - 1, 1.25);
    c.fill();
    ellipsePath(c, cx - 0.9, cy + 1.5, 0.55, 0.5);
    c.fill();
    ellipsePath(c, cx + 1.3, cy + 1.3, 0.25, 0.25);
    c.fill();
    c.restore();
    c.save();
    c.translate(0, drop * 0.92);
    lashPath(c, x, y, side);
    c.fillStyle = '#2a1222';
    c.fill();
    c.restore();
    /* lower lash hint at the outer corner */
    c.beginPath();
    c.moveTo(x + side * 1.2, y + 3.05);
    c.quadraticCurveTo(x + side * 2.3, y + 2.6, x + side * 2.75, y + 1.3);
    stroke(c, 'rgba(60, 20, 40, 0.65)', 0.35);
  }

  function happyEye(c, x, y) {
    c.beginPath();
    c.moveTo(x - 2.2, y + 0.9);
    c.quadraticCurveTo(x, y - 1.8, x + 2.2, y + 0.9);
    stroke(c, '#2a1222', 0.8);
  }
  /* Squeezed shut: > < */
  function hurtEye(c, x, y, side) {
    c.beginPath();
    c.moveTo(x + side * 2, y - 1.7);
    c.lineTo(x - side * 1.6, y);
    c.lineTo(x + side * 2, y + 1.7);
    stroke(c, '#2a1222', 0.8);
  }

  function face(c, P) {
    var y = P.headY, skin = P.skin, expr = P.expr;
    cel(c, function () { facePath(c, y); }, skin,
      { warm: true, s: 1.4, ink: 0.55, rim: 0.3, x0: 6, x1: 22, y0: 4 + y, y1: 19.5 + y });
    c.save();
    facePath(c, y);
    c.clip();
    /* the fringe casts a hard shadow on the forehead */
    c.translate(0.2, 0.85);
    fringePath(c, P, y);
    c.fillStyle = tone(skin, 'd1', true);
    c.fill();
    c.restore();
    /* blush with a few hatch strokes */
    c.fillStyle = expr === 'hurt' ? 'rgba(255, 110, 140, 0.55)' : 'rgba(255, 120, 150, 0.4)';
    ellipsePath(c, 8.4, 16.7 + y, 2, 1.15);
    c.fill();
    ellipsePath(c, 19.6, 16.7 + y, 2, 1.15);
    c.fill();
    c.beginPath();
    for (var h = 0; h < 3; h++) {
      c.moveTo(7.6 + h * 0.8, 17.2 + y); c.lineTo(8.2 + h * 0.8, 16.2 + y);
      c.moveTo(18.8 + h * 0.8, 17.2 + y); c.lineTo(19.4 + h * 0.8, 16.2 + y);
    }
    stroke(c, 'rgba(230, 80, 120, 0.45)', 0.25);
    if (expr === 'happy') {
      happyEye(c, 10.3, 13.6 + y);
      happyEye(c, 17.7, 13.6 + y);
      /* open grin */
      c.beginPath();
      c.moveTo(12, 16.6 + y);
      c.quadraticCurveTo(14, 16.9 + y, 16, 16.6 + y);
      c.quadraticCurveTo(15.6, 19.2 + y, 14, 19.2 + y);
      c.quadraticCurveTo(12.4, 19.2 + y, 12, 16.6 + y);
      c.closePath();
      c.fillStyle = '#8a2840';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#ffffff';
      c.fillRect(12, 16.4 + y, 4, 0.8);
      c.fillStyle = '#ff8098';
      ellipsePath(c, 14, 19.2 + y, 1.4, 0.9);
      c.fill();
      c.restore();
      return;
    }
    if (expr === 'hurt') {
      hurtEye(c, 10.2, 13.8 + y, -1);
      hurtEye(c, 17.8, 13.8 + y, 1);
      /* wobbly mouth and a sweat drop */
      c.beginPath();
      c.moveTo(12.4, 18 + y);
      c.quadraticCurveTo(13.2, 17.2 + y, 14, 18 + y);
      c.quadraticCurveTo(14.8, 18.8 + y, 15.6, 18 + y);
      stroke(c, '#7a2238', 0.5);
      c.beginPath();
      c.moveTo(21.6, 9.4 + y);
      c.quadraticCurveTo(22.8, 11.4 + y, 21.6, 11.8 + y);
      c.quadraticCurveTo(20.4, 11.4 + y, 21.6, 9.4 + y);
      c.fillStyle = 'rgba(190, 236, 255, 0.95)';
      c.fill();
      stroke(c, 'rgba(60, 120, 170, 0.8)', 0.25);
      return;
    }
    eye(c, P, 10.2, 13.8 + y, -1);
    eye(c, P, 17.8, 13.8 + y, 1);
    /* nose: a warm fleck */
    c.beginPath();
    c.moveTo(14.3, 16 + y);
    c.lineTo(14.6, 16.6 + y);
    stroke(c, tone(skin, 'd2', true), 0.4);
    if (expr === 'cast') {
      /* a determined little "ha!" */
      ellipsePath(c, 14, 18.2 + y, 0.85, 0.95);
      c.fillStyle = '#9a3048';
      c.fill();
      ellipsePath(c, 14, 18.6 + y, 0.5, 0.35);
      c.fillStyle = '#ff8aa0';
      c.fill();
      return;
    }
    /* small open smile */
    c.beginPath();
    c.moveTo(12.9, 17.6 + y);
    c.quadraticCurveTo(14, 18.1 + y, 15.1, 17.6 + y);
    c.quadraticCurveTo(14.8, 18.9 + y, 14, 18.9 + y);
    c.quadraticCurveTo(13.2, 18.9 + y, 12.9, 17.6 + y);
    c.closePath();
    c.fillStyle = '#9a3048';
    c.fill();
    ellipsePath(c, 14, 18.7 + y, 0.7, 0.35);
    c.fillStyle = '#ff8aa0';
    c.fill();
  }

  /* Hair in front of the face: fringe, side locks, gloss, buns, bows */
  function hairFront(c, P) {
    var y = P.headY, hair = P.hair;
    /* The fringe's crown lies inside the cranium's outline, so its own
       line only shows along the locks */
    c.save();
    ellipsePath(c, 14, 9.8 + y, 10.45, 9.65);
    c.clip();
    cel(c, function () { fringePath(c, P, y); }, hair, { s: 1.4, ink: 0.55 });
    c.restore();
    /* strand lines up from each notch */
    c.beginPath();
    var notches = P.hairStyle === 'himeCut' ? [[6.4, 9.2], [10, 8.9], [14, 9.1], [18, 8.9], [21.6, 9.2]] :
      [[6.8, 8.6], [10.4, 8.3], [14.2, 7.9], [17.8, 8.2], [21.2, 8.4]];
    for (var n = 0; n < notches.length; n++) {
      var nx = notches[n][0], ny = notches[n][1] + y;
      c.moveTo(nx, ny);
      c.quadraticCurveTo(nx + (14 - nx) * 0.15, ny - 2.4, nx + (14 - nx) * 0.35, ny - 4.6);
    }
    stroke(c, tone(hair, 'ink'), 0.32);
    if (P.hairStyle === 'himeCut') {
      himeLock(c, P, -1);
      himeLock(c, P, 1);
    } else {
      var len = P.hairStyle === 'bob' ? -1.4 : P.hairStyle === 'pixie' ? -3 : P.hairStyle === 'longWavy' ? 2.4 : 0;
      sideLock(c, P, -1, len);
      sideLock(c, P, 1, len);
    }
    /* angel-ring gloss: broken strokes around the crown */
    c.save();
    fringePath(c, P, y);
    c.clip();
    c.strokeStyle = tone(hair, 'hi');
    c.lineCap = 'round';
    var segs = [[-2.55, -2.22], [-2.08, -1.72], [-1.58, -1.18], [-1.04, -0.68]];
    for (var s = 0; s < segs.length; s++) {
      c.beginPath();
      c.ellipse(14, 9.2 + y, 8.3, 5.4, 0, segs[s][0], segs[s][1]);
      c.lineWidth = s === 1 || s === 2 ? 1.05 : 0.8;
      c.stroke();
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ellipsePath(c, 10.6, 4.6 + y, 0.65, 0.4, -0.5);
    c.fill();
    c.restore();
    if (P.hairStyle === 'buns') {
      bun(c, P, 5, 3 + y);
      bun(c, P, 23, 3 + y);
    }
    if (P.hairStyle === 'twinTails') {
      ribbonBow(c, P, 4.1, 10.6 + y);
      ribbonBow(c, P, 23.9, 10.6 + y);
    } else if (P.hairStyle === 'ringlets') {
      ribbonBow(c, P, 3.6, 8.6 + y);
      ribbonBow(c, P, 24.4, 8.6 + y);
    } else if (P.hairStyle === 'sideTail') {
      ribbonBow(c, P, 23.6, 6.4 + y);
    } else if (P.hairStyle === 'pixie' && !HATS[P.acc]) {
      ahoge(c, P);
    }
  }

  /* Polished gold along a path: dark core, body, a sheen nudged toward
     the light */
  function gold(c, path, w) {
    path();
    stroke(c, '#8a5a12', w + 0.65);
    path();
    stroke(c, '#ffc93a', w);
    c.save();
    c.translate(LX * w * 0.2, LY * w * 0.2);
    path();
    stroke(c, '#fff3b0', w * 0.35);
    c.restore();
  }
  /* A cut stone: lit dome, a dark setting line, one facet edge and a hot spot */
  function jewel(c, x, y, r, col) {
    gem(c, x, y, r, col);
    stroke(c, tone(col, 'ink'), 0.25);
    c.beginPath();
    c.moveTo(x - r * 0.75, y + r * 0.15);
    c.lineTo(x, y + r * 0.7);
    c.lineTo(x + r * 0.75, y + r * 0.15);
    stroke(c, 'rgba(255,255,255,0.45)', 0.2);
    ellipsePath(c, x - r * 0.3, y - r * 0.35, r * 0.28, r * 0.2, -0.5);
    c.fillStyle = '#ffffff';
    c.fill();
  }
  /* A four-point glint */
  function glint(c, x, y, r, a) {
    c.save();
    c.globalAlpha = a === undefined ? 1 : a;
    c.fillStyle = '#ffffff';
    starPath(c, x, y, r, 0.28);
    c.fill();
    c.restore();
  }

  function tiara(c, P) {
    var y = P.headY;
    gold(c, function () { c.beginPath(); c.arc(14, 8.2 + y, 6.5, Math.PI + 0.55, -0.55); }, 1.25);
    /* filigree scrolls climbing to the centre stone, a pearl on each */
    for (var e = -1; e <= 1; e += 2) {
      (function (e) {
        gold(c, function () {
          c.beginPath();
          c.moveTo(14 + e * 5.2, 4.4 + y);
          c.quadraticCurveTo(14 + e * 4.6, 1.6 + y, 14 + e * 2.6, 1.9 + y);
        }, 0.55);
        jewel(c, 14 + e * 4.7, 4.9 + y, 0.8, e < 0 ? '#ff9ad0' : '#9adcff');
        gem(c, 14 + e * 3.5, 1.5 + y, 0.5, '#fff6fa');
      })(e);
    }
    /* peach gem */
    var px = 14, py = 2.9 + y;
    c.beginPath();
    c.arc(px - 0.7, py, 1.95, 0, TAU);
    c.arc(px + 0.7, py, 1.95, 0, TAU);
    var g = c.createRadialGradient(px - 1, py - 1, 0.2, px, py, 2.6);
    g.addColorStop(0, '#fff0e0');
    g.addColorStop(0.4, '#ffb8a0');
    g.addColorStop(1, '#e8705e');
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    c.arc(px - 0.7, py, 1.95, Math.PI * 0.5, Math.PI * 1.5);
    c.arc(px + 0.7, py, 1.95, Math.PI * 1.5, Math.PI * 2.5);
    stroke(c, '#9a3a32', 0.4);
    c.beginPath();
    c.moveTo(px, py - 1.2);
    c.quadraticCurveTo(px + 0.4, py + 0.4, px, py + 1.6);
    stroke(c, 'rgba(180, 70, 60, 0.6)', 0.3);
    /* leaf */
    ellipsePath(c, px - 1.6, py - 2.2, 1.2, 0.6, -0.6);
    c.fillStyle = '#5cbd5c';
    c.fill();
    stroke(c, '#2c6a34', 0.3);
    c.beginPath(); c.moveTo(px - 2.4, py - 1.7); c.lineTo(px - 0.9, py - 2.6);
    stroke(c, '#2c6a34', 0.2);
    ellipsePath(c, px - 1, py - 0.6, 0.5, 0.4);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
    glint(c, px + 2.9, py - 1.6, 0.9, 0.5 + 0.5 * Math.sin(P.t * 3));
  }

  /* ---------- Accessories ---------- */
  /* A ribbon streamer hanging from (x, y), trailing on the charm spring */
  function streamer(c, P, x, y, len, col, ph) {
    var wob = Math.sin(P.t * 3 + ph) * 0.4;
    var mx = P.ch.x * 0.5 + wob * 0.5, my = P.ch.y * 0.4, tx = P.ch.x + wob, ty = P.ch.y * 0.8;
    cel(c, function () {
      c.beginPath();
      c.moveTo(x - 0.65, y);
      c.bezierCurveTo(x - 0.9 + mx, y + len * 0.4 + my, x - 1.1 + tx * 0.8, y + len * 0.75 + ty * 0.8, x - 0.8 + tx, y + len + ty);
      c.lineTo(x + tx, y + len - 0.9 + ty);
      c.lineTo(x + 0.8 + tx, y + len + 0.2 + ty);
      c.bezierCurveTo(x + 0.6 + tx * 0.8, y + len * 0.75 + ty * 0.8, x + 0.6 + mx, y + len * 0.4 + my, x + 0.65, y);
      c.closePath();
    }, col, { s: 0.6, ink: 0.4 });
  }
  /* Behind the hair: streamers and bow tails */
  function accBack(c, P) {
    var y = P.headY;
    if (P.acc === 'flowerCrown') {
      streamer(c, P, 4.6, 8 + y, 11, '#ffffff', 0);
      streamer(c, P, 5.8, 8.6 + y, 9, '#ffb3d1', 1.7);
    } else if (P.acc === 'bigBow') {
      streamer(c, P, 7.6, 2.6 + y, 8, P.trim, 0.5);
      streamer(c, P, 9.6, 2.8 + y, 6.5, P.trim, 2.2);
    }
  }
  function flower(c, x, y, r, col, rot) {
    cel(c, function () {
      c.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = rot + i * TAU / 5;
        c.moveTo(x, y);
        c.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.62, r * 0.4, a, 0, TAU);
      }
    }, col, { s: 0.45, ink: 0.3 });
    ellipsePath(c, x, y, r * 0.32, r * 0.32);
    c.fillStyle = '#ffcf3a';
    c.fill();
  }
  /* A soft bow: two puffed loops with fold shadows, a sheen on each
     and a wrapped knot. Drawn about the origin. */
  function bow(c, col, w, h, dots) {
    var loop = function (dir) {
      return function () {
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(dir * w * 0.3, -h * 1.25, dir * w * 1.08, -h * 1.1, dir * w, 0);
        c.bezierCurveTo(dir * w * 1.08, h, dir * w * 0.3, h * 1.05, 0, 0);
        c.closePath();
      };
    };
    for (var d = -1; d <= 1; d += 2) {
      cel(c, loop(d), col, { s: w * 0.22, ink: 0.5 });
      c.save();
      loop(d)();
      c.clip();
      /* the fold running out from the knot */
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(d * w * 0.8, -h * 0.28);
      c.lineTo(d * w * 0.86, h * 0.2);
      c.closePath();
      c.fillStyle = tone(col, 'd1');
      c.fill();
      c.beginPath();
      c.moveTo(d * w * 0.3, -h * 0.72);
      c.quadraticCurveTo(d * w * 0.68, -h * 0.98, d * w * 0.94, -h * 0.4);
      c.globalAlpha = 0.8;
      stroke(c, tone(col, 'hi'), w * 0.1);
      c.globalAlpha = 1;
      if (dots) {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        var ds = [[0.5, -0.5], [0.78, 0.35], [0.36, 0.42]];
        for (var i = 0; i < ds.length; i++) { ellipsePath(c, d * w * ds[i][0], h * ds[i][1], w * 0.075, w * 0.075); c.fill(); }
      }
      c.restore();
    }
    cel(c, function () { ellipsePath(c, 0, 0, w * 0.27, h * 0.42); }, col, { s: 0.3, ink: 0.4 });
    c.beginPath();
    c.moveTo(-w * 0.1, -h * 0.25); c.quadraticCurveTo(-w * 0.02, 0, -w * 0.1, h * 0.25);
    c.moveTo(w * 0.1, -h * 0.25); c.quadraticCurveTo(w * 0.02, 0, w * 0.1, h * 0.25);
    stroke(c, tone(col, 'd2'), 0.25);
  }
  /* A branch of coral: stem and two twigs as round strokes, shaded by
     laying the lit pass a little toward the light */
  function coral(c, x, y, lean, h, col) {
    var path = function () {
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + lean * h * 0.1, y - h * 0.55, x + lean * h * 0.45, y - h);
      c.moveTo(x + lean * h * 0.08, y - h * 0.38);
      c.quadraticCurveTo(x - h * 0.22, y - h * 0.5, x + lean * h * 0.1 - h * 0.26, y - h * 0.8);
      c.moveTo(x + lean * h * 0.16, y - h * 0.58);
      c.quadraticCurveTo(x + lean * h * 0.2 + h * 0.2, y - h * 0.66, x + lean * h * 0.3 + h * 0.24, y - h * 0.92);
    };
    path();
    stroke(c, tone(col, 'ink'), 1.6);
    path();
    stroke(c, tone(col, 'd1'), 1.05);
    c.save();
    c.translate(LX * 0.22, LY * 0.22);
    path();
    stroke(c, col, 0.7);
    c.translate(LX * 0.16, LY * 0.16);
    path();
    c.globalAlpha = 0.7;
    stroke(c, tone(col, 'hi'), 0.22);
    c.restore();
  }
  /* A starfish with rounded arms, about the origin */
  function starfish(c, r, col) {
    var path = function () {
      c.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = -PI / 2 + i * TAU / 5, b = a + TAU / 10, a0 = a - TAU / 10;
        if (i === 0) c.moveTo(Math.cos(a0) * r * 0.42, Math.sin(a0) * r * 0.42);
        c.quadraticCurveTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, Math.cos(b) * r * 0.42, Math.sin(b) * r * 0.42);
      }
      c.closePath();
    };
    cel(c, path, col, { s: r * 0.22, ink: 0.45, rim: 0.35, x0: -r, x1: r, y0: -r, y1: r });
    c.fillStyle = tone(col, 'hi');
    for (var i = 0; i < 5; i++) {
      var a = -PI / 2 + i * TAU / 5;
      for (var k = 1; k <= 3; k++) {
        ellipsePath(c, Math.cos(a) * r * 0.26 * k, Math.sin(a) * r * 0.26 * k, r * (0.1 - k * 0.018), r * (0.1 - k * 0.018));
        c.fill();
      }
    }
    ellipsePath(c, 0, 0, r * 0.13, r * 0.13);
    c.fill();
  }
  function strawHat(c, P) {
    var y = P.headY, straw = '#f6dc94', d1 = '#d9b566';
    /* ribbon tails off the back of the brim */
    streamer(c, P, 25.4, 5 + y, 8, P.trim, 0.5);
    streamer(c, P, 26.6, 4.6 + y, 6, P.trim, 2.2);
    c.save();
    c.translate(14, 3.6 + y);
    c.rotate(-0.07);
    var brim = function () { ellipsePath(c, 0, 0.6, 13.4, 3.5); };
    cel(c, brim, straw, { s: 1.1, ink: 0.5, rim: 0.4, x0: -13, x1: 13, y0: -3, y1: 4 });
    c.save();
    brim();
    c.clip();
    /* woven rings, and the crown's shadow on the brim */
    c.beginPath();
    c.ellipse(0, 0.6, 11.6, 2.9, 0, 0, TAU);
    c.moveTo(10, 0.6);
    c.ellipse(0, 0.6, 10, 2.35, 0, 0, TAU);
    stroke(c, d1, 0.25);
    c.beginPath();
    for (var i = 0; i < 22; i++) {
      var a = i * TAU / 22;
      c.moveTo(Math.cos(a) * 12.2, 0.6 + Math.sin(a) * 3.1);
      c.lineTo(Math.cos(a + 0.05) * 13.3, 0.6 + Math.sin(a + 0.05) * 3.45);
    }
    stroke(c, d1, 0.25);
    ellipsePath(c, 0.6, 1.9, 8.2, 1.5);
    c.fillStyle = 'rgba(150, 100, 60, 0.3)';
    c.fill();
    c.restore();
    var crown = function () {
      c.beginPath();
      c.moveTo(-7.3, 0.6);
      c.bezierCurveTo(-7.6, -5.2, -4.8, -7.3, 0, -7.3);
      c.bezierCurveTo(4.8, -7.3, 7.6, -5.2, 7.3, 0.6);
      c.quadraticCurveTo(0, 2.7, -7.3, 0.6);
      c.closePath();
    };
    cel(c, crown, straw, { s: 1.4, ink: 0.5, rim: 0.3, x0: -7, x1: 7, y0: -7, y1: 2 });
    c.save();
    crown();
    c.clip();
    c.beginPath();
    for (var r = 0; r < 5; r++) {
      c.moveTo(-7.6, -5.6 + r * 1.25);
      c.quadraticCurveTo(0, -3.9 + r * 1.25, 7.6, -5.6 + r * 1.25);
    }
    for (var k = -5; k <= 5; k++) { c.moveTo(k * 1.3, -7.4); c.quadraticCurveTo(k * 1.5, -3, k * 1.42, 2.4); }
    stroke(c, d1, 0.22);
    c.restore();
    /* ribbon band and its bow */
    cel(c, function () {
      c.beginPath();
      c.moveTo(-7.42, -1.5);
      c.quadraticCurveTo(0, 0.6, 7.42, -1.5);
      c.lineTo(7.3, 0.6);
      c.quadraticCurveTo(0, 2.7, -7.3, 0.6);
      c.closePath();
    }, P.trim, { s: 0.7, ink: 0.45 });
    c.beginPath();
    c.moveTo(-7.2, -0.9); c.quadraticCurveTo(0, 1.2, 7.2, -0.9);
    c.globalAlpha = 0.6;
    stroke(c, tone(P.trim, 'hi'), 0.3);
    c.globalAlpha = 1;
    c.save();
    c.translate(6.5, -0.2);
    c.rotate(0.25);
    bow(c, P.trim, 2.6, 1.7);
    c.restore();
    flower(c, -3.4, 0.9, 1.5, '#ffffff', 0.4);
    c.beginPath();
    c.moveTo(-4.6, -5.2); c.quadraticCurveTo(-2.4, -6.6, 0.6, -6.5);
    c.globalAlpha = 0.8;
    stroke(c, '#fff8dc', 0.6);
    c.globalAlpha = 1;
    c.restore();
  }
  function sailorCap(c, P) {
    var y = P.headY, col = P.trim;
    streamer(c, P, 3.4, 3.2 + y, 8.5, col, 0.5);
    streamer(c, P, 4.8, 3.6 + y, 6.5, col, 2.2);
    c.save();
    c.translate(14, 1.6 + y);
    c.rotate(-0.1);
    var top = function () {
      c.beginPath();
      c.moveTo(-9.4, 1.2);
      c.bezierCurveTo(-12.6, -1.4, -8.4, -6.9, 0, -6.7);
      c.bezierCurveTo(8.4, -6.9, 12.6, -1.4, 9.4, 1.2);
      c.quadraticCurveTo(0, -1.9, -9.4, 1.2);
      c.closePath();
    };
    cel(c, top, '#ffffff', { s: 1.5, ink: 0.5, rim: 0.4, x0: -11, x1: 11, y0: -7, y1: 1 });
    /* the puffed crown's seams */
    c.beginPath();
    c.moveTo(-5.4, -5.6); c.quadraticCurveTo(-3.4, -3.4, -4.2, -0.9);
    c.moveTo(5.4, -5.6); c.quadraticCurveTo(3.4, -3.4, 4.2, -0.9);
    c.moveTo(0, -6.6); c.lineTo(0, -1.6);
    stroke(c, tone('#ffffff', 'd1'), 0.3);
    var band = function () {
      c.beginPath();
      c.moveTo(-9, 1);
      c.quadraticCurveTo(0, -2.1, 9, 1);
      c.lineTo(9.2, 3.5);
      c.quadraticCurveTo(0, 0.6, -9.2, 3.5);
      c.closePath();
    };
    cel(c, band, col, { s: 0.8, ink: 0.5 });
    c.beginPath();
    c.moveTo(-9, 2.8); c.quadraticCurveTo(0, -0.1, 9, 2.8);
    stroke(c, '#ffffff', 0.35);
    /* gold anchor badge */
    gold(c, function () {
      c.beginPath();
      c.moveTo(0, -0.9); c.lineTo(0, 1.5);
      c.moveTo(-0.8, -0.3); c.lineTo(0.8, -0.3);
      c.moveTo(-1.2, 0.7); c.quadraticCurveTo(-0.9, 1.7, 0, 1.6); c.quadraticCurveTo(0.9, 1.7, 1.2, 0.7);
    }, 0.4);
    ellipsePath(c, 0, -1.25, 0.42, 0.42);
    stroke(c, '#8a5a12', 0.5);
    ellipsePath(c, 0, -1.25, 0.42, 0.42);
    stroke(c, '#ffc93a', 0.28);
    c.beginPath();
    c.moveTo(-6.4, -4.6); c.quadraticCurveTo(-3, -6.2, 1, -6.1);
    stroke(c, 'rgba(255,255,255,0.9)', 0.6);
    c.restore();
  }
  /* Dive mask pushed up on her forehead, snorkel clipped beside her ear */
  function snorkel(c, P) {
    var y = P.headY, col = P.trim, ink = tone(col, 'ink');
    c.beginPath();
    c.ellipse(14, 8.6 + y, 10.5, 5.8, 0, PI + 0.12, TAU - 0.12);
    stroke(c, ink, 1.7);
    c.beginPath();
    c.ellipse(14, 8.4 + y, 10.5, 5.8, 0, PI + 0.3, TAU - 0.3);
    stroke(c, tone(col, 'd1'), 0.7);
    var mask = function (k) {
      return function () {
        var X = function (v) { return 14 + (v - 14) * k; }, Y = function (v) { return 4.1 + y + (v - 4.1) * k; };
        c.beginPath();
        c.moveTo(X(8), Y(3));
        c.quadraticCurveTo(X(7.9), Y(1.2), X(10), Y(1.1));
        c.lineTo(X(18), Y(1.1));
        c.quadraticCurveTo(X(20.1), Y(1.2), X(20), Y(3));
        c.quadraticCurveTo(X(20), Y(6.8), X(17), Y(7.1));
        c.quadraticCurveTo(X(15.2), Y(7.2), X(14.7), Y(6));
        c.quadraticCurveTo(X(14), Y(5.1), X(13.3), Y(6));
        c.quadraticCurveTo(X(12.8), Y(7.2), X(11), Y(7.1));
        c.quadraticCurveTo(X(8), Y(6.8), X(8), Y(3));
        c.closePath();
      };
    };
    cel(c, mask(1), col, { s: 0.8, ink: 0.5 });
    var lens = mask(0.78);
    lens();
    var lg = c.createLinearGradient(0, 1.4 + y, 0, 6.8 + y);
    lg.addColorStop(0, '#e2fdff');
    lg.addColorStop(0.5, '#6ad6ec');
    lg.addColorStop(1, '#167a9c');
    c.fillStyle = lg;
    c.fill();
    stroke(c, '#0d4a66', 0.3);
    c.save();
    lens();
    c.clip();
    c.beginPath();
    c.moveTo(9.6, 5.4 + y); c.lineTo(12.4, 1.6 + y);
    c.moveTo(11, 5.8 + y); c.lineTo(13.2, 2.8 + y);
    stroke(c, 'rgba(255,255,255,0.8)', 0.55);
    c.restore();
    /* the tube, with a bright safety tip */
    var tube = function () {
      c.beginPath();
      c.moveTo(24.6, 13.4 + y);
      c.bezierCurveTo(25.9, 9 + y, 26, 2 + y, 25.2, -2.6 + y);
      c.quadraticCurveTo(24.9, -4.4 + y, 23.6, -4.9 + y);
    };
    tube();
    stroke(c, ink, 2.3);
    tube();
    stroke(c, tone(col, 'd1'), 1.6);
    c.save();
    c.translate(LX * 0.3, LY * 0.1);
    tube();
    stroke(c, col, 1);
    c.restore();
    c.beginPath();
    c.moveTo(25.45, -0.4 + y); c.lineTo(25.2, -2.6 + y);
    stroke(c, '#ffffff', 1.6);
    c.beginPath();
    c.moveTo(26.2, 9 + y); c.quadraticCurveTo(26.4, 5 + y, 26, 1.6 + y);
    c.globalAlpha = 0.7;
    stroke(c, tone(col, 'hi'), 0.3);
    c.globalAlpha = 1;
    /* clip to the strap, and the mouthpiece */
    cel(c, function () { ellipsePath(c, 24.4, 8.4 + y, 1.3, 0.9, 0.2); }, '#3a4660', { s: 0.3, ink: 0.35 });
    c.beginPath();
    c.moveTo(24.6, 13.4 + y); c.quadraticCurveTo(24.2, 15.4 + y, 22.8, 15.8 + y);
    stroke(c, '#232a40', 1.9);
    c.beginPath();
    c.moveTo(24.6, 13.4 + y); c.quadraticCurveTo(24.2, 15.4 + y, 22.8, 15.8 + y);
    stroke(c, '#4a5878', 1.1);
  }
  var HATS = { strawHat: 1, sailorCap: 1 };
  function accFront(c, P) {
    var y = P.headY, a = P.acc;
    if (a === 'tiara') tiara(c, P);
    else if (a === 'flowerCrown') {
      var cols = ['#ff8fb8', '#ffffff', '#ffd25a', '#ff8fb8', '#b9a4ff', '#ffffff', '#ff8fb8'];
      for (var i = 0; i < 7; i++) {
        var ang = PI + 0.32 + i * (PI - 0.64) / 6;
        var fx = 14 + Math.cos(ang) * 9.6, fy = 8.6 + y + Math.sin(ang) * 6.6;
        if (i < 6) {
          var la = ang + (PI - 0.64) / 12;
          ellipsePath(c, 14 + Math.cos(la) * 9.8, 8.6 + y + Math.sin(la) * 6.8, 1.2, 0.55, la + PI / 2);
          c.fillStyle = '#4fb85c';
          c.fill();
          stroke(c, '#23663a', 0.25);
        }
        flower(c, fx, fy, i === 3 ? 2 : 1.55, cols[i], i * 0.7);
      }
    } else if (a === 'bigBow') {
      c.save();
      c.translate(8.4, 1.4 + y);
      c.rotate(-0.35);
      bow(c, P.trim, 5.3, 3.4, true);
      c.restore();
    } else if (a === 'starClips') {
      var st = [[19.6, 5.2, 1.9, 0.2], [22.2, 8.2, 1.3, -0.3], [7.2, 6, 1.45, 0.1]];
      for (var s = 0; s < st.length; s++) {
        (function (x, yy, r, rot) {
          c.save();
          c.translate(x, yy + y);
          c.rotate(rot);
          var sp = function () { starPath(c, 0, 0, r, 0.5); };
          cel(c, sp, '#ffcf3a', { s: 0.5, ink: 0.4 });
          /* faceted: the lit half of each point */
          c.save();
          sp();
          c.clip();
          c.beginPath();
          for (var i = 0; i < 5; i++) {
            var a0 = -PI / 2 + i * TAU / 5;
            c.moveTo(0, 0);
            c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
            c.lineTo(Math.cos(a0 - TAU / 10) * r * 0.5, Math.sin(a0 - TAU / 10) * r * 0.5);
            c.closePath();
          }
          c.fillStyle = 'rgba(255, 250, 200, 0.75)';
          c.fill();
          c.restore();
          ellipsePath(c, -r * 0.2, -r * 0.3, r * 0.2, r * 0.14, -0.5);
          c.fillStyle = '#ffffff';
          c.fill();
          c.restore();
        })(st[s][0], st[s][1], st[s][2], st[s][3]);
      }
      glint(c, 22.4, 3.4 + y, 1, 0.5 + 0.5 * Math.sin(P.t * 3.4));
    } else if (a === 'goggles') {
      var gc = P.trim;
      c.beginPath();
      c.ellipse(14, 8.6 + y, 10.5, 5.8, 0, PI + 0.12, TAU - 0.12);
      stroke(c, tone(gc, 'ink'), 1.7);
      c.beginPath();
      c.ellipse(14, 8.4 + y, 10.5, 5.8, 0, PI + 0.3, TAU - 0.3);
      stroke(c, tone(gc, 'd1'), 0.6);
      c.beginPath(); c.moveTo(12, 4.4 + y); c.quadraticCurveTo(14, 3.6 + y, 16, 4.4 + y);
      stroke(c, tone(gc, 'd2'), 0.9);
      for (var e = -1; e <= 1; e += 2) {
        (function (gx, gy) {
          cel(c, function () { ellipsePath(c, gx, gy, 2.8, 2.5); }, gc, { s: 0.6, ink: 0.45 });
          ellipsePath(c, gx, gy, 1.9, 1.65);
          var lg = c.createLinearGradient(0, gy - 1.6, 0, gy + 1.6);
          lg.addColorStop(0, '#d6fbff');
          lg.addColorStop(0.5, '#56cfe8');
          lg.addColorStop(1, '#13708f');
          c.fillStyle = lg;
          c.fill();
          stroke(c, '#0d4a66', 0.3);
          c.beginPath(); c.moveTo(gx - 1, gy - 0.2); c.lineTo(gx - 0.1, gy - 1.1);
          c.moveTo(gx - 0.4, gy + 0.5); c.lineTo(gx + 0.5, gy - 0.5);
          stroke(c, 'rgba(255,255,255,0.95)', 0.4);
        })(14 + e * 3.7, 4.6 + y);
      }
    } else if (a === 'kittyEars') {
      var ear = function (side, tw) {
        var bx0 = 14 + side * 4, bx1 = 14 + side * 8.6, tipx = 14 + side * 7.4;
        c.save();
        c.translate(14 + side * 6.3, 1.4 + y);
        c.rotate(side * (0.08 + tw * 0.22));
        c.translate(-(14 + side * 6.3), -(1.4 + y));
        cel(c, function () {
          c.beginPath();
          c.moveTo(bx0, 1.4 + y);
          c.quadraticCurveTo(tipx - side * 1.6, -2.4 + y, tipx, -4.2 + y);
          c.quadraticCurveTo(bx1 + side * 0.4, -1 + y, bx1, 3.2 + y);
          c.closePath();
        }, P.hair, { s: 0.8, ink: 0.45 });
        c.beginPath();
        c.moveTo(14 + side * 5, 1.4 + y);
        c.quadraticCurveTo(tipx - side * 1, -1.6 + y, tipx - side * 0.2, -2.9 + y);
        c.quadraticCurveTo(14 + side * 8, -0.4 + y, 14 + side * 7.9, 2.4 + y);
        c.closePath();
        var eg = c.createLinearGradient(0, -3 + y, 0, 2.4 + y);
        eg.addColorStop(0, '#ffd0de');
        eg.addColorStop(1, '#ff8fb0');
        c.fillStyle = eg;
        c.fill();
        /* fluff at the root of the ear */
        c.beginPath();
        for (var f = 0; f < 3; f++) {
          c.moveTo(14 + side * (5.6 + f * 0.8), 1.8 + y);
          c.lineTo(14 + side * (5.9 + f * 0.8), 0.2 + y - (f === 1 ? 0.6 : 0));
        }
        stroke(c, '#ffffff', 0.4);
        c.restore();
      };
      ear(-1, 0);
      ear(1, P.ear);
      c.beginPath();
      c.ellipse(14, 8.8 + y, 10.2, 7.4, 0, PI + 0.32, TAU - 0.32);
      stroke(c, tone(P.suit, 'ink'), 1.5);
      c.beginPath();
      c.ellipse(14, 8.8 + y, 10.2, 7.4, 0, PI + 0.32, TAU - 0.32);
      stroke(c, P.suit, 0.9);
      c.beginPath();
      c.ellipse(14, 8.6 + y, 10.2, 7.4, 0, PI + 0.6, PI + 1.2);
      stroke(c, tone(P.suit, 'hi'), 0.3);
    } else if (a === 'strawHat') strawHat(c, P);
    else if (a === 'sailorCap') sailorCap(c, P);
    else if (a === 'snorkel') snorkel(c, P);
    else if (a === 'starfish') {
      c.save();
      c.translate(20.8, 4.4 + y);
      c.rotate(0.28);
      starfish(c, 3.9, P.trim);
      c.restore();
      gem(c, 16.6, 2.3 + y, 0.75, '#fff6fa');
      gem(c, 24.4, 9.4 + y, 0.65, '#fff6fa');
    } else if (a === 'coralCrown') {
      var cb = [[8.4, 5.4, -0.7, 4.8], [11, 3.2, -0.3, 6.4], [14, 2.2, 0, 8], [17, 3.2, 0.3, 6.4], [19.6, 5.4, 0.7, 4.8]];
      for (var b = 0; b < cb.length; b++) coral(c, cb[b][0], cb[b][1] + y, cb[b][2], cb[b][3], P.trim);
      gold(c, function () { c.beginPath(); c.arc(14, 8.2 + y, 6.5, Math.PI + 0.55, -0.55); }, 1.25);
      for (var q = 0; q < cb.length; q++) gem(c, cb[q][0], cb[q][1] + y + 0.25, q === 2 ? 0.95 : 0.7, '#fff6fa');
    }
    /* buns sit in front of a hat's brim */
    if (HATS[a] && P.hairStyle === 'buns') {
      bun(c, P, 5, 3 + y);
      bun(c, P, 23, 3 + y);
    }
  }
  /* Necklaces sit on the outfit; the pendant swings on the charm spring */
  function necklace(c, P) {
    var a = P.acc;
    if (a !== 'shellNecklace' && a !== 'pearlNecklace') return;
    var px = 14 + clamp(P.cr.x * 0.35, -1.2, 1.2), py = 24.3 + clamp(P.cr.y * 0.2, -0.6, 0.4);
    var rot = Math.atan2(px - 14, 1.6);
    if (a === 'shellNecklace') {
      /* a beaded cord with a scallop pendant */
      c.beginPath();
      c.moveTo(10.6, 20.3);
      c.quadraticCurveTo(14, 24.2, 17.4, 20.3);
      stroke(c, '#6a3c24', 0.45);
      gem(c, 11.5, 21.5, 0.55, '#5fd3c4');
      gem(c, 12.6, 22.3, 0.5, '#fff6fa');
      gem(c, 15.4, 22.3, 0.5, '#fff6fa');
      gem(c, 16.5, 21.5, 0.55, '#5fd3c4');
      c.save();
      c.translate(px, py - 1.4);
      c.rotate(-rot);
      var shell = function () {
        c.beginPath();
        c.moveTo(-0.9, 0);
        c.lineTo(-2.9, 1.5);
        for (var i = 0; i < 4; i++) {
          var a0 = PI * (0.82 - i * 0.16), a1 = PI * (0.82 - (i + 1) * 0.16), am = (a0 + a1) / 2;
          c.quadraticCurveTo(Math.cos(am) * 3.9, 0.3 + Math.sin(am) * 3.9, Math.cos(a1) * 3.2, 0.3 + Math.sin(a1) * 3.2);
        }
        c.lineTo(0.9, 0);
        c.closePath();
      };
      cel(c, shell, '#ffc6d6', { s: 0.7, ink: 0.4 });
      c.beginPath();
      for (var r = 1; r < 4; r++) {
        var ra = PI * (0.82 - r * 0.16);
        c.moveTo(0, 0.2); c.lineTo(Math.cos(ra) * 3, 0.3 + Math.sin(ra) * 3);
      }
      stroke(c, tone('#ffc6d6', 'd2'), 0.25);
      c.beginPath();
      c.arc(0, 0.3, 2.5, PI * 0.56, PI * 0.8);
      stroke(c, 'rgba(255,255,255,0.85)', 0.35);
      cel(c, function () { rr(c, -0.95, -0.55, 1.9, 0.9, 0.3); }, '#ffd24a', { s: 0.2, ink: 0.3 });
      c.restore();
    } else {
      /* graded pearls, a teardrop at the centre */
      for (var i = 0; i <= 8; i++) {
        var u = i / 8, x = lerp(lerp(10.4, 14, u), lerp(14, 17.6, u), u), yy = lerp(lerp(20.3, 23.8, u), lerp(23.8, 20.3, u), u);
        gem(c, x, yy, 0.5 + 0.22 * Math.sin(u * PI), '#f4eef6');
        stroke(c, 'rgba(120, 100, 150, 0.6)', 0.18);
      }
      c.beginPath(); c.moveTo(14, 22.4); c.lineTo(px, py - 0.4);
      stroke(c, '#c8b9c8', 0.3);
      c.beginPath();
      c.moveTo(px, py - 0.9);
      c.bezierCurveTo(px + 1.5, py + 0.6, px + 0.9, py + 1.7, px, py + 1.7);
      c.bezierCurveTo(px - 0.9, py + 1.7, px - 1.5, py + 0.6, px, py - 0.9);
      c.closePath();
      var g = c.createRadialGradient(px - 0.4, py + 0.3, 0.1, px, py + 0.6, 1.5);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#ffeaf3');
      g.addColorStop(1, '#d8a8c4');
      c.fillStyle = g;
      c.fill();
      stroke(c, 'rgba(120, 80, 130, 0.7)', 0.22);
    }
  }

  /* ---------- Back items ----------
     Worn behind her, in body space: backItem() goes down after her back
     hair and before her arms and body, backFront() lays the straps,
     clasps and near halves over her outfit. */
  function finWing(c, P, side) {
    var col = P.trim, flap = Math.sin(P.t * 4.2 + (side > 0 ? 0.5 : 0)) * 0.09 + clamp(P.cr.x * 0.05 * side, -0.25, 0.25);
    c.save();
    c.translate(14 + side * 2.4, 22.4);
    c.rotate(side * flap);
    var X = function (v) { return side * v; };
    var upper = function () {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(X(4), -7.4, X(11), -12.8, X(16.4), -11.6);
      c.quadraticCurveTo(X(14.8), -8.6, X(12.8), -7.2);
      c.quadraticCurveTo(X(12.6), -4.6, X(9.8), -3.4);
      c.quadraticCurveTo(X(9), -1, X(5.8), -0.2);
      c.quadraticCurveTo(X(3), 1.2, 0, 0.8);
      c.closePath();
    };
    var lower = function () {
      c.beginPath();
      c.moveTo(0, 0.6);
      c.bezierCurveTo(X(4.4), 1.2, X(9.8), 3.8, X(11.8), 8.8);
      c.quadraticCurveTo(X(9), 8, X(7.6), 6.6);
      c.quadraticCurveTo(X(6.2), 7.4, X(4.4), 6);
      c.quadraticCurveTo(X(2.4), 5.4, 0, 2.4);
      c.closePath();
    };
    var lobes = [lower, upper];
    for (var i = 0; i < 2; i++) {
      var path = lobes[i], up = i === 1;
      var g = c.createLinearGradient(0, 0, X(up ? 15 : 10), up ? -11 : 8);
      g.addColorStop(0, col);
      g.addColorStop(0.45, mix(col, '#9ff3ff', 0.55));
      g.addColorStop(1, '#f4ffff');
      c.globalAlpha = 0.86;
      path();
      c.fillStyle = g;
      c.fill();
      c.globalAlpha = 1;
      c.save();
      path();
      c.clip();
      /* fin rays fanning from the root, a pearly sheen across them */
      c.beginPath();
      for (var r = 0; r < 6; r++) {
        var k = r / 5;
        if (up) { c.moveTo(X(0.6), -0.2); c.quadraticCurveTo(X(lerp(5, 8, k)), lerp(-7, -1, k), X(lerp(15.6, 6, k)), lerp(-11, -0.4, k)); }
        else { c.moveTo(X(0.6), 1); c.quadraticCurveTo(X(lerp(6, 2.4, k)), lerp(2.6, 3.6, k), X(lerp(11.4, 2.6, k)), lerp(8.4, 5, k)); }
      }
      stroke(c, tone(col, 'd1'), 0.28);
      var sg = c.createLinearGradient(X(2), up ? -9 : 0, X(12), up ? -2 : 8);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sg.addColorStop(0.62, 'rgba(255,255,255,0)');
      c.fillStyle = sg;
      c.fillRect(-18, -14, 36, 26);
      c.restore();
      path();
      stroke(c, tone(col, 'ink'), 0.5);
    }
    glint(c, X(12.6), -9.4, 0.9, 0.5 + 0.5 * Math.sin(P.t * 3 + side));
    c.restore();
  }
  function capePath(c, P) {
    var sx = clamp(P.sk.x * 0.7, -2.4, 2.4) + Math.sin(P.t * 2.2) * 0.3, lift = clamp(-P.sk.y * 0.5, -1.5, 1.5);
    var yb = 32.4 - lift;
    c.beginPath();
    c.moveTo(8.4, 20.4);
    c.lineTo(19.6, 20.4);
    c.bezierCurveTo(25.2, 21.6, 27.8 + sx * 0.5, 27, 28 + sx, yb);
    for (var j = 1; j <= 6; j++) {
      var xa = lerp(28, 0, (j - 0.5) / 6) + sx, xb = lerp(28, 0, j / 6) + sx;
      c.quadraticCurveTo(xa, yb + 1.9, xb, yb - (j < 6 ? 0.3 : 0));
    }
    c.bezierCurveTo(0.2 + sx * 0.5, 27, 2.8, 21.6, 8.4, 20.4);
    c.closePath();
  }
  function ringPath(c, dy) {
    c.beginPath();
    c.ellipse(14, 26.4 + dy, 11.2, 4.3, 0, 0, TAU);
    c.moveTo(20.4, 25.6 + dy);
    c.ellipse(14, 25.6 + dy, 6.4, 1.7, 0, 0, TAU, true);
  }
  /* The swim ring: front is the near half of the tube */
  function swimRing(c, P, front) {
    var col = P.trim, dy = Math.sin(P.t * 2) * 0.25 + clamp(P.cr.y * 0.15, -0.5, 0.5);
    var path = function () { ringPath(c, dy); };
    c.save();
    c.beginPath();
    if (front) c.rect(0, 25.6 + dy, 28, 8);
    else c.rect(0, 18, 28, 7.6 + dy);
    c.clip();
    cel(c, path, col, { s: 1.5, ink: 0.55, rim: 0.5, x0: 3, x1: 25, y0: 22 + dy, y1: 31 + dy });
    c.save();
    path();
    c.clip();
    /* white wedges round the tube */
    c.beginPath();
    for (var i = 0; i < 6; i++) {
      var a0 = i * TAU / 6 + 0.25, a1 = a0 + TAU / 12;
      c.moveTo(14, 25.8 + dy);
      c.lineTo(14 + Math.cos(a0) * 14, 25.8 + dy + Math.sin(a0) * 6);
      c.lineTo(14 + Math.cos(a1) * 14, 25.8 + dy + Math.sin(a1) * 6);
      c.closePath();
    }
    c.fillStyle = '#ffffff';
    c.fill();
    /* the tube's shaded underside and its gloss */
    var sh = c.createLinearGradient(0, 22 + dy, 0, 31 + dy);
    sh.addColorStop(0.5, 'rgba(60, 40, 120, 0)');
    sh.addColorStop(1, 'rgba(60, 40, 120, 0.4)');
    c.fillStyle = sh;
    c.fillRect(2, 22 + dy, 24, 9);
    c.restore();
    path();
    stroke(c, tone(col, 'ink'), 0.55);
    if (front) {
      c.beginPath();
      c.ellipse(14, 26.6 + dy, 9.4, 2.9, 0, PI * 0.55, PI * 0.95);
      stroke(c, 'rgba(255,255,255,0.85)', 0.7);
      ellipsePath(c, 6.2, 27.4 + dy, 0.5, 0.35, 0.5);
      c.fillStyle = '#ffffff';
      c.fill();
      /* valve */
      cel(c, function () { ellipsePath(c, 23.6, 26.2 + dy, 0.8, 0.65); }, '#ffffff', { s: 0.3, ink: 0.35 });
    }
    c.restore();
  }
  function scubaTank(c, P) {
    var col = P.trim;
    /* breath bubbles off the valve */
    for (var b = 0; b < 3; b++) {
      var ph = (P.t * 0.5 + b / 3) % 1;
      ellipsePath(c, 4.4 - ph * 2.4 + Math.sin(ph * 9 + b) * 0.6, 16.4 - ph * 9, 0.5 + ph * 0.6, 0.5 + ph * 0.6);
      c.globalAlpha = 1 - ph;
      c.fillStyle = 'rgba(210, 245, 255, 0.5)';
      c.fill();
      stroke(c, '#ffffff', 0.25);
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(5.2, 24.4);
    c.rotate(0.1);
    /* valve and its knob */
    cel(c, function () { c.beginPath(); c.rect(-0.9, -8.2, 1.8, 1.6); }, '#aab4c8', { s: 0.4, ink: 0.4 });
    cel(c, function () { ellipsePath(c, 0, -8.6, 1.7, 0.75); }, '#3a4660', { s: 0.3, ink: 0.35 });
    var body = function () {
      c.beginPath();
      c.moveTo(-2.6, -4.6);
      c.quadraticCurveTo(-2.6, -6.9, 0, -6.9);
      c.quadraticCurveTo(2.6, -6.9, 2.6, -4.6);
      c.lineTo(2.6, 5.2);
      c.quadraticCurveTo(2.6, 6.4, 0, 6.4);
      c.quadraticCurveTo(-2.6, 6.4, -2.6, 5.2);
      c.closePath();
    };
    cel(c, body, col, { s: 1.1, ink: 0.55, rim: 0.5, x0: -2.6, x1: 2.6, y0: -7, y1: 6.4 });
    c.save();
    body();
    c.clip();
    /* steel bands, and the cylinder's sheen */
    c.fillStyle = '#c6d0e2';
    c.fillRect(-3, -3.2, 6, 1.1);
    c.fillRect(-3, 2.6, 6, 1.1);
    c.fillStyle = 'rgba(40, 50, 90, 0.35)';
    c.fillRect(-3, -2.4, 6, 0.3);
    c.fillRect(-3, 3.4, 6, 0.3);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0.5, -6.4, 0.9, 12.4);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(-1.8, -6.4, 0.4, 12.4);
    c.restore();
    c.restore();
  }
  /* A jellyfish balloon on a string: it floats up and behind her in
     world space whatever her pitch, and drags on the charm spring */
  function balloon(c, P) {
    var col = mix(P.trim, '#ffffff', 0.3), ca = Math.cos(P.pitch), sa = Math.sin(P.pitch);
    var wx = -14 + Math.sin(P.t * 1.3) * 0.8, wy = -31 + Math.sin(P.t * 1.9) * 0.6;
    var bx = 10 + wx * ca + wy * sa + clamp(P.cr.x * 2, -7, 7), by = 24 - wx * sa + wy * ca + clamp(P.cr.y * 1.6, -5, 5);
    c.beginPath();
    c.moveTo(10, 24);
    c.quadraticCurveTo(lerp(10, bx, 0.3) - 2, lerp(24, by, 0.6), bx, by + 5.4);
    stroke(c, 'rgba(255,255,255,0.85)', 0.3);
    c.save();
    c.translate(bx, by);
    c.rotate(-P.pitch + clamp(P.cr.x * 0.08, -0.4, 0.4));
    /* frilled tentacles under the bell */
    for (var i = 0; i < 4; i++) {
      (function (x0, ph) {
        var path = function () {
          c.beginPath();
          c.moveTo(x0, 1);
          c.bezierCurveTo(x0 + Math.sin(ph) * 1.2, 2.6, x0 - Math.sin(ph) * 1.2, 4, x0 + Math.sin(ph + 1) * 0.7, 5.6);
        };
        path();
        stroke(c, tone(col, 'ink'), 1.15);
        path();
        stroke(c, col, 0.65);
      })(-3 + i * 2, P.t * 3 + i * 1.4);
    }
    var bell = function () {
      c.beginPath();
      c.moveTo(-5.4, 0.6);
      c.bezierCurveTo(-5.6, -6.8, 5.6, -6.8, 5.4, 0.6);
      for (var j = 1; j <= 4; j++) c.quadraticCurveTo(5.4 - (j - 0.5) * 2.7, 2.6, 5.4 - j * 2.7, 0.6);
      c.closePath();
    };
    c.globalAlpha = 0.93;
    cel(c, bell, col, { s: 1.3, ink: 0.5, rim: 0.5, x0: -5.4, x1: 5.4, y0: -5, y1: 2 });
    c.globalAlpha = 1;
    c.save();
    bell();
    c.clip();
    var g = c.createRadialGradient(-1.6, -3, 0.5, 0, -1.6, 6);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-6, -6, 12, 9);
    c.restore();
    /* a sleepy little face */
    c.fillStyle = '#3a1c40';
    ellipsePath(c, -1.8, -1.2, 0.5, 0.65); c.fill();
    ellipsePath(c, 1.8, -1.2, 0.5, 0.65); c.fill();
    c.beginPath(); c.moveTo(-0.7, -0.3); c.quadraticCurveTo(0, 0.4, 0.7, -0.3);
    stroke(c, '#3a1c40', 0.3);
    c.fillStyle = 'rgba(255, 120, 160, 0.5)';
    ellipsePath(c, -3, -0.3, 0.8, 0.45); c.fill();
    ellipsePath(c, 3, -0.3, 0.8, 0.45); c.fill();
    c.beginPath();
    c.arc(0, -1.2, 4.3, PI * 1.12, PI * 1.45);
    stroke(c, 'rgba(255,255,255,0.9)', 0.7);
    c.restore();
  }
  function backItem(c, P) {
    var b = P.back;
    if (b === 'finWings') { finWing(c, P, -1); finWing(c, P, 1); }
    else if (b === 'cape') {
      var path = function () { capePath(c, P); };
      cel(c, path, P.trim, { s: 1.6, ink: 0.55, rim: 0.55, x0: 0, x1: 28, y0: 20, y1: 34 });
      c.save();
      path();
      c.clip();
      /* folds falling from the shoulders, gold stars along the hem */
      var sx = clamp(P.sk.x * 0.7, -2.4, 2.4);
      c.beginPath();
      c.moveTo(8.4, 20.6); c.lineTo(2.6 + sx, 35); c.lineTo(5.8 + sx, 35); c.closePath();
      c.moveTo(19.6, 20.6); c.lineTo(22.4 + sx, 35); c.lineTo(25.4 + sx, 35); c.closePath();
      c.fillStyle = tone(P.trim, 'd1');
      c.fill();
      c.beginPath();
      c.moveTo(23, 21.8); c.quadraticCurveTo(27.2 + sx * 0.5, 26.6, 27.6 + sx, 31.6);
      c.globalAlpha = 0.6;
      stroke(c, tone(P.trim, 'hi'), 0.5);
      c.globalAlpha = 1;
      c.fillStyle = '#ffd86a';
      var st = [[1.4, 30.4, 1], [4, 26.6, 0.7], [26.6, 30.2, 1], [24.2, 26.2, 0.7], [27.2, 26.6, 0.55], [1.6, 25.6, 0.5]];
      for (var i = 0; i < st.length; i++) { starPath(c, st[i][0] + sx * 0.8, st[i][1], st[i][2]); c.fill(); }
      c.restore();
    } else if (b === 'swimRing') swimRing(c, P, false);
    else if (b === 'scubaTank') scubaTank(c, P);
    else if (b === 'balloon') balloon(c, P);
  }
  function backFront(c, P) {
    var b = P.back;
    if (b === 'cape') {
      /* collar ties and a gem clasp under her chin */
      cel(c, function () {
        c.beginPath();
        c.moveTo(9, 20.2); c.quadraticCurveTo(14, 22.6, 19, 20.2);
        c.lineTo(18.4, 21.6); c.quadraticCurveTo(14, 23.6, 9.6, 21.6); c.closePath();
      }, P.trim, { s: 0.5, ink: 0.4 });
      gold(c, function () { ellipsePath(c, 14, 22.2, 0.95, 0.95); }, 0.4);
      jewel(c, 14, 22.2, 0.8, '#7fe0ff');
    } else if (b === 'swimRing') swimRing(c, P, true);
    else if (b === 'scubaTank') {
      /* harness (when it is on her), hose and regulator */
      if (!P.solo) {
        var straps = function () {
          c.beginPath();
          c.moveTo(8.8, 20.8); c.lineTo(10.4, 25.2);
          c.moveTo(8.6, 24.4); c.quadraticCurveTo(14, 25.2, 19.4, 24.4);
        };
        straps();
        stroke(c, '#232a40', 1.1);
        straps();
        stroke(c, '#56648a', 0.6);
        cel(c, function () { c.beginPath(); c.rect(13.2, 24, 1.6, 1.5); }, '#d4dcec', { s: 0.3, ink: 0.3 });
      }
      c.beginPath();
      c.moveTo(6.6, 18.6); c.bezierCurveTo(8.4, 17.8, 10.6, 19.6, 11.8, 22);
      stroke(c, '#1c2236', 0.95);
      c.beginPath();
      c.moveTo(6.6, 18.6); c.bezierCurveTo(8.4, 17.8, 10.6, 19.6, 11.8, 22);
      stroke(c, '#4a5878', 0.45);
      cel(c, function () { ellipsePath(c, 12, 22.4, 1.25, 1.05); }, P.trim, { s: 0.4, ink: 0.4 });
      ellipsePath(c, 12, 22.4, 0.5, 0.42);
      c.fillStyle = '#e8f0ff';
      c.fill();
    } else if (b === 'finWings') {
      /* the little shell clasp that holds them on */
      gem(c, 14, 20.9, 0.6, '#fff6fa');
    }
  }

  /* ---------- Body ---------- */
  function legGeo(P, i) {
    var L = P.legs[i];
    var hx = P.mono ? (i ? 15.6 : 12.4) : (i ? 16.8 : 11.2), hy = 27;
    var kx = hx - Math.sin(L.a1) * 2.7, ky = hy + Math.cos(L.a1) * 2.7;
    var b = L.a1 + L.a2;
    return { hx: hx, hy: hy, kx: kx, ky: ky, ax: kx - Math.sin(b) * 2.6, ay: ky + Math.cos(b) * 2.6, b: b, f: L.f };
  }
  function legs(c, P) {
    var col = P.legCol, warm = col === P.skin;
    var g0 = legGeo(P, 0), g1 = legGeo(P, 1);
    var gs = [g0, g1];
    for (var i = 0; i < 2; i++) {
      var g = gs[i];
      (function (g) {
        cel(c, function () { limbPath(c, g.hx, g.hy, 1.95, g.kx, g.ky, 1.5, g.ax, g.ay, 1.15); }, col,
          { warm: warm, s: 0.9, ink: 0.45, rim: 0.3, x0: g.hx - 2, x1: g.hx + 2, y0: g.hy, y1: g.ay + 1 });
      })(g);
      if (P.outfit === 'wetsuit') {
        c.save();
        c.translate(g.ax, g.ay);
        c.rotate(g.b);
        c.beginPath(); c.moveTo(-1.15, -0.5); c.lineTo(1.15, -0.5);
        stroke(c, lum(P.suit) > 0.6 ? '#2a4a8a' : '#7fe6ff', 0.45);
        c.restore();
      }
      if (P.outfit === 'stripeSuit') {
        /* striped leg of the suit down to mid-thigh */
        (function (g) {
          var mx = lerp(g.kx, g.ax, 0.35), my = lerp(g.ky, g.ay, 0.35), a = Math.atan2(g.ay - g.ky, g.ax - g.kx);
          cel(c, function () { limbPath(c, g.hx, g.hy, 2.1, g.kx, g.ky, 1.75, mx, my, 1.6); }, P.suit, { s: 0.8, ink: 0.45 });
          c.beginPath();
          c.moveTo(mx - Math.sin(a) * 1.7, my + Math.cos(a) * 1.7); c.lineTo(mx + Math.sin(a) * 1.7, my - Math.cos(a) * 1.7);
          stroke(c, '#ffffff', 0.7);
        })(g);
      }
      if (!P.mono) {
        c.save();
        c.translate(g.ax, g.ay);
        c.rotate(g.b);
        shin(c, P);
        c.rotate(g.f);
        shoe(c, P, 0, 0.9, P.legs[i].a1);
        c.restore();
      }
    }
    if (P.mono) {
      c.save();
      c.translate((g0.ax + g1.ax) / 2, (g0.ay + g1.ay) / 2);
      c.rotate((g0.b + g1.b) / 2);
      monofin(c, P);
      c.restore();
    }
  }

  /* Mermaid monofin: one foot pocket, a fluke that flexes with the kick */
  function monofin(c, P) {
    var col = P.shoe, flex = P.monoFlex;
    cel(c, function () {
      c.beginPath();
      c.moveTo(-3, -0.6);
      c.quadraticCurveTo(0, -1.6, 3, -0.6);
      c.lineTo(2.6, 2.2);
      c.quadraticCurveTo(0, 2.9, -2.6, 2.2);
      c.closePath();
    }, col, { s: 0.6, ink: 0.45 });
    c.save();
    c.translate(0, 2.2);
    c.rotate(flex);
    var blade = function () {
      c.beginPath();
      c.moveTo(-2.3, 0);
      c.bezierCurveTo(-4.4, 1.4, -6.4, 3.4, -6.8, 6.4);
      c.quadraticCurveTo(-3.4, 4.6, 0, 5.2);
      c.quadraticCurveTo(3.4, 4.6, 6.8, 6.4);
      c.bezierCurveTo(6.4, 3.4, 4.4, 1.4, 2.3, 0);
      c.closePath();
    };
    c.save();
    c.globalAlpha = 0.92;
    cel(c, blade, mix(col, '#ffffff', 0.15), { s: 0.8, ink: 0.45 });
    c.restore();
    c.save();
    blade();
    c.clip();
    var ig = c.createLinearGradient(-6, 0, 6, 6);
    ig.addColorStop(0, 'rgba(160, 255, 240, 0.35)');
    ig.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    ig.addColorStop(1, 'rgba(255, 170, 240, 0.35)');
    c.fillStyle = ig;
    c.fillRect(-7, 0, 14, 7);
    c.beginPath();
    for (var r = -2; r <= 2; r++) { c.moveTo(r * 0.6, 0.4); c.quadraticCurveTo(r * 1.6, 2.6, r * 2.6, 5.4); }
    stroke(c, tone(col, 'd1'), 0.3);
    c.restore();
    c.restore();
    /* scale arcs on the pocket */
    c.beginPath();
    for (var s = -1; s <= 1; s++) { c.moveTo(s * 1.6 - 0.8, 0.8); c.arc(s * 1.6, 0.8, 0.8, PI, 0, true); }
    stroke(c, tone(col, 'hi'), 0.3);
  }

  /* What the footwear adds up the shin, in the lower leg's own frame:
     the ankle is the origin and the knee is 2.6 up */
  function shin(c, P) {
    var col = P.shoe, k = P.shoes;
    if (k === 'rainBoots') {
      cel(c, function () { capsule(c, 0, -1.9, 1.75, 0, 0.3, 1.6); }, col, { s: 0.8, ink: 0.45 });
      /* rolled cuff and the rubber's shine */
      cel(c, function () { c.beginPath(); c.rect(-1.95, -2.7, 3.9, 1); }, tone(col, 'hi'), { s: 0.3, ink: 0.35 });
      c.beginPath(); c.moveTo(0.8, -1.4); c.lineTo(0.8, 0.2);
      stroke(c, 'rgba(255,255,255,0.75)', 0.35);
    } else if (k === 'ballet') {
      /* ribbons laced up the calf, tied in a bow */
      var lace = function () {
        c.beginPath();
        c.moveTo(-1.1, 0); c.lineTo(1.25, -1.05);
        c.moveTo(1.1, 0); c.lineTo(-1.25, -1.05);
        c.moveTo(-1.3, -1.7); c.lineTo(1.3, -1.7);
      };
      lace();
      stroke(c, tone(col, 'ink'), 0.75);
      lace();
      stroke(c, col, 0.42);
      c.save();
      c.translate(1.2, -1.8);
      bow(c, col, 1.05, 0.7);
      c.restore();
    } else if (k === 'maryJane') {
      /* frilled sock top */
      for (var f = -1; f <= 1; f++) {
        cel(c, (function (f) { return function () { c.beginPath(); c.arc(f * 0.85, -0.55, 0.62, PI, 0); c.closePath(); }; })(f),
          '#ffffff', { s: 0.3, ink: 0.3 });
      }
    } else if (k === 'geta') {
      /* split-toe sock */
      cel(c, function () { capsule(c, 0, -1.2, 1.3, 0, -0.2, 1.2); }, '#ffffff', { s: 0.5, ink: 0.35 });
    }
  }
  function shoe(c, P, x, y, dk) {
    var col = P.shoe;
    if (P.shoes === 'flipper') {
      /* a fin blade trailing back behind the foot, flexing with the kick */
      var bend = dk * 0.9;
      cel(c, function () {
        c.beginPath();
        c.moveTo(x + 1.6, y - 0.9);
        c.quadraticCurveTo(x + 0.4, y - 1.8, x - 2.4, y - 1.2 + bend);
        c.lineTo(x - 5.6, y - 1.9 + bend * 2);
        c.quadraticCurveTo(x - 5, y + 0.6 + bend * 1.6, x - 5.8, y + 2.2 + bend * 2);
        c.lineTo(x - 2.2, y + 1.3 + bend);
        c.quadraticCurveTo(x + 1.8, y + 1.6, x + 1.6, y - 0.9);
        c.closePath();
      }, col, { s: 0.7, ink: 0.45 });
      c.beginPath();
      c.moveTo(x - 1.6, y - 0.4 + bend); c.lineTo(x - 5, y - 1.2 + bend * 2);
      c.moveTo(x - 1.6, y + 0.6 + bend); c.lineTo(x - 5, y + 1.4 + bend * 2);
      stroke(c, tone(col, 'd2'), 0.35);
      ellipsePath(c, x + 0.4, y - 0.6, 1.1, 0.35);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fill();
      return;
    }
    var path = function () {
      c.beginPath();
      c.moveTo(x - 2.4, y + 0.9);
      c.quadraticCurveTo(x - 2.8, y - 1.5, x - 0.2, y - 1.5);
      c.quadraticCurveTo(x + 2.2, y - 1.4, x + 3, y + 0.2);
      c.quadraticCurveTo(x + 3.2, y + 1.2, x + 2.2, y + 1.3);
      c.lineTo(x - 1.8, y + 1.3);
      c.closePath();
    };
    var bare = function () {
      cel(c, path, P.skin, { warm: true, s: 0.75, ink: 0.4 });
      c.beginPath(); c.moveTo(x + 1.6, y - 0.4); c.lineTo(x + 1.7, y + 0.6);
      c.moveTo(x + 2.3, y - 0.2); c.lineTo(x + 2.4, y + 0.7);
      stroke(c, tone(P.skin, 'd2', true), 0.2);
    };
    if (P.shoes === 'anklet') {
      /* barefoot, with a string of beads and a gold star charm */
      bare();
      for (var ab = -2; ab <= 2; ab++) gem(c, x - 0.5 + ab * 0.66, y - 1.4 + Math.abs(ab) * 0.12, 0.5, col);
      starPath(c, x + 1.3, y - 0.5, 0.85);
      c.fillStyle = '#ffd24a';
      c.fill();
      stroke(c, '#a06a10', 0.2);
      return;
    }
    if (P.shoes === 'geta') {
      /* wooden clogs on two teeth, a padded thong between her toes */
      var wood = '#c98f52';
      c.translate(0, -1.5);
      bare();
      cel(c, function () { c.beginPath(); c.rect(x - 1.7, y + 1.9, 1.2, 1.45); c.rect(x + 0.9, y + 1.9, 1.2, 1.45); }, wood, { s: 0.4, ink: 0.4 });
      cel(c, function () {
        c.beginPath();
        c.moveTo(x - 2.7, y + 1.2); c.lineTo(x + 3.3, y + 1.2);
        c.quadraticCurveTo(x + 3.5, y + 2.1, x + 2.9, y + 2.1); c.lineTo(x - 2.5, y + 2.1);
        c.quadraticCurveTo(x - 3, y + 1.7, x - 2.7, y + 1.2);
        c.closePath();
      }, wood, { s: 0.4, ink: 0.4 });
      c.beginPath(); c.moveTo(x - 1.6, y + 1.65); c.lineTo(x + 2.4, y + 1.65);
      stroke(c, 'rgba(110, 66, 30, 0.5)', 0.2);
      var thong = function () {
        c.beginPath();
        c.moveTo(x + 2.2, y + 0.9); c.quadraticCurveTo(x + 1, y - 0.9, x - 0.9, y - 1);
        c.moveTo(x + 2.2, y + 0.9); c.quadraticCurveTo(x + 0.6, y + 0.3, x - 1.3, y + 0.9);
      };
      thong();
      stroke(c, tone(col, 'ink'), 1);
      thong();
      stroke(c, col, 0.6);
      return;
    }
    if (P.shoes === 'ballet') {
      /* satin slipper cut low over the instep */
      cel(c, path, col, { s: 0.75, ink: 0.45 });
      c.save();
      path();
      c.clip();
      ellipsePath(c, x - 0.5, y - 1.5, 2, 1.25, 0.1);
      c.fillStyle = P.legCol;
      c.fill();
      stroke(c, tone(col, 'ink'), 0.35);
      c.restore();
      c.beginPath(); c.moveTo(x - 2.3, y + 1.3); c.lineTo(x + 2.5, y + 1.3);
      stroke(c, tone(col, 'd2'), 0.35);
      ellipsePath(c, x + 2, y - 0.1, 0.7, 0.3, 0.6);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fill();
      return;
    }
    if (P.shoes === 'rainBoots') {
      /* chunky welly foot with a ridged sole */
      var boot = function () {
        c.beginPath();
        c.moveTo(x - 2.5, y + 1);
        c.quadraticCurveTo(x - 2.9, y - 1.7, x - 0.2, y - 1.7);
        c.quadraticCurveTo(x + 2.6, y - 1.6, x + 3.4, y + 0.1);
        c.quadraticCurveTo(x + 3.7, y + 1.4, x + 2.6, y + 1.5);
        c.lineTo(x - 1.9, y + 1.5);
        c.closePath();
      };
      cel(c, boot, col, { s: 0.8, ink: 0.45 });
      c.save();
      boot();
      c.clip();
      c.fillStyle = tone(col, 'd2');
      c.fillRect(x - 3, y + 0.95, 7, 0.8);
      c.restore();
      c.beginPath();
      c.moveTo(x + 0.4, y - 1.2); c.quadraticCurveTo(x + 2.2, y - 1, x + 2.8, y);
      stroke(c, 'rgba(255,255,255,0.8)', 0.4);
      return;
    }
    if (P.shoes === 'sandals') {
      /* bare foot in a clear jelly sandal */
      bare();
      c.save();
      c.globalAlpha = 0.78;
      c.beginPath();
      c.moveTo(x - 2.6, y - 0.2); c.quadraticCurveTo(x - 1.5, y - 1.9, x - 0.4, y - 0.2);
      c.moveTo(x + 0.4, y - 1.3); c.lineTo(x + 0.9, y + 0.9);
      c.moveTo(x + 1.6, y - 1.1); c.lineTo(x + 2.1, y + 0.9);
      stroke(c, col, 0.75);
      c.restore();
      c.beginPath(); c.moveTo(x - 2.6, y + 1.45); c.lineTo(x + 2.8, y + 1.45);
      stroke(c, tone(col, 'd1'), 0.6);
      ellipsePath(c, x + 0.7, y - 0.9, 0.45, 0.2, 0.9);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fill();
      return;
    }
    cel(c, path, col, { s: 0.75, ink: 0.45 });
    if (P.shoes === 'sneaker') {
      c.save();
      path();
      c.clip();
      c.fillStyle = '#ffffff';
      c.fillRect(x - 3, y + 0.5, 6.4, 1);
      c.fillStyle = '#c8d0e8';
      c.fillRect(x - 3, y + 1.1, 6.4, 0.4);
      c.restore();
      c.beginPath();
      c.moveTo(x - 0.8, y - 1.2); c.lineTo(x + 0.4, y - 0.4);
      c.moveTo(x + 0.4, y - 1.3); c.lineTo(x + 1.4, y - 0.5);
      stroke(c, '#ffffff', 0.35);
    } else {
      /* mary-jane sole, strap and button */
      c.beginPath(); c.moveTo(x - 2.2, y + 1.3); c.lineTo(x + 2.5, y + 1.3);
      stroke(c, tone(col, 'd2'), 0.4);
      c.beginPath();
      c.moveTo(x - 1.8, y - 0.9);
      c.lineTo(x + 1.6, y - 1.1);
      stroke(c, tone(col, 'ink'), 0.55);
      gem(c, x + 1.4, y - 1.05, 0.5, '#ffe680');
    }
    ellipsePath(c, x + 0.6, y - 0.7, 0.9, 0.3, -0.15);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fill();
  }

  /* Arm: shoulder -> elbow -> wrist; ang is the forearm's heading */
  function armGeo(sx, sy, A) {
    var ex = sx - Math.sin(A.a1) * 2.6, ey = sy + Math.cos(A.a1) * 2.6;
    var b = A.a1 + A.a2;
    var dx = -Math.sin(b), dy = Math.cos(b);
    return { sx: sx, sy: sy, ex: ex, ey: ey, wx: ex + dx * 2.35, wy: ey + dy * 2.35, dx: dx, dy: dy, ang: Math.atan2(dy, dx) };
  }
  function arm(c, P, g) {
    var skin = P.skin;
    cel(c, function () { limbPath(c, g.sx, g.sy, 1.5, g.ex, g.ey, 1.18, g.wx, g.wy, 0.92); }, skin,
      { warm: true, s: 0.8, ink: 0.45, rim: 0.3, x0: g.sx - 2, x1: g.sx + 2, y0: g.sy, y1: g.wy + 1 });
    if (P.sleeve === 2) {
      var cx = g.ex + g.dx * 1.9, cy = g.ey + g.dy * 1.9;
      cel(c, function () { limbPath(c, g.sx, g.sy, 1.68, g.ex, g.ey, 1.34, cx, cy, 1.12); }, P.suit, { s: 0.8, ink: 0.45 });
      c.beginPath();
      c.moveTo(cx - g.dy * 1.1, cy + g.dx * 1.1); c.lineTo(cx + g.dy * 1.1, cy - g.dx * 1.1);
      stroke(c, P.outfit === 'wetsuit' ? (lum(P.suit) > 0.6 ? '#2a4a8a' : '#7fe6ff') : '#ffffff', 0.45);
    } else if (P.sleeve === 1) {
      var mx = lerp(g.sx, g.ex, 0.55), my = lerp(g.sy, g.ey, 0.55);
      cel(c, function () { capsule(c, g.sx, g.sy, 1.72, mx, my, 1.5); }, P.suit, { s: 0.8, ink: 0.45 });
    } else if (P.sleeve === 3) {
      /* kimono sleeve: a wide panel hanging off the upper arm */
      var ux = (g.ex - g.sx) / 2.6, uy = (g.ey - g.sy) / 2.6, nx = -uy, ny = ux;
      if (ny < 0) { nx = -nx; ny = -ny; }
      var sw = clamp(P.cr.x * 0.3, -1, 1);
      var tx = g.ex + ux * 1.2, ty = g.ey + uy * 1.2;
      cel(c, function () {
        c.beginPath();
        c.moveTo(g.sx - nx * 1.7, g.sy - ny * 1.7);
        c.lineTo(tx - nx * 1.5, ty - ny * 1.5);
        c.lineTo(tx + nx * 3.8 + sw, ty + ny * 3.8);
        c.quadraticCurveTo(g.ex - ux * 0.8 + nx * 4.2 + sw, g.ey - uy * 0.8 + ny * 4.2, g.sx + nx * 1.9, g.sy + ny * 1.9);
        c.closePath();
      }, P.suit, { s: 0.9, ink: 0.45 });
      c.beginPath();
      c.moveTo(tx - nx * 1.1 - ux * 0.5, ty - ny * 1.1 - uy * 0.5); c.lineTo(tx + nx * 3.3 + sw - ux * 0.5, ty + ny * 3.3 - uy * 0.5);
      stroke(c, tone(P.suit, 'hi'), 0.4);
    } else if (P.sleeve === 4) {
      /* puffed sleeve gathered into a white band */
      var px = lerp(g.sx, g.ex, 0.3), py = lerp(g.sy, g.ey, 0.3), pa = Math.atan2(g.ey - g.sy, g.ex - g.sx);
      cel(c, function () { ellipsePath(c, px, py, 2.5, 2.15, pa); }, P.suit, { s: 0.9, ink: 0.45 });
      var bx = lerp(g.sx, g.ex, 1.02), by = lerp(g.sy, g.ey, 1.02);
      var cuff = function () {
        c.beginPath();
        c.moveTo(bx - Math.sin(pa) * 1.05, by + Math.cos(pa) * 1.05); c.lineTo(bx + Math.sin(pa) * 1.05, by - Math.cos(pa) * 1.05);
      };
      cuff();
      stroke(c, tone(P.suit, 'ink'), 1.15);
      cuff();
      stroke(c, '#ffffff', 0.65);
    }
  }
  /* Hands in their own frame: +y runs down the forearm to the fingers,
     +x is the thumb side. 'open' is a relaxed paddling hand, 'fist'
     wraps the wand. */
  function hand(c, P, g, kind) {
    var skin = P.skin, x = g.wx + g.dx * 0.15, y = g.wy + g.dy * 0.15;
    c.save();
    c.translate(x, y);
    c.rotate(g.ang - PI / 2);
    if (kind === 'fist') {
      cel(c, function () { ellipsePath(c, 0, 0.8, 1.38, 1.22); }, skin, { warm: true, s: 0.6, ink: 0.4 });
      c.beginPath();
      c.moveTo(0.35, 0.15); c.lineTo(1.25, 0.25);
      c.moveTo(0.35, 0.8); c.lineTo(1.35, 0.85);
      c.moveTo(0.35, 1.4); c.lineTo(1.2, 1.5);
      stroke(c, tone(skin, 'd2', true), 0.22);
      cel(c, function () { ellipsePath(c, -0.45, 0.35, 0.95, 0.55, 0.5); }, skin, { warm: true, s: 0.3, ink: 0.3 });
    } else {
      cel(c, function () { ellipsePath(c, 1.0, 0.75, 0.42, 0.78, -0.5); }, skin, { warm: true, s: 0.3, ink: 0.35 });
      cel(c, function () {
        c.beginPath();
        c.moveTo(-0.85, -0.1);
        c.quadraticCurveTo(-1.25, 1.6, -0.6, 2.35);
        c.quadraticCurveTo(0.1, 2.9, 0.75, 2.3);
        c.quadraticCurveTo(1.15, 1.5, 0.85, -0.1);
        c.closePath();
      }, skin, { warm: true, s: 0.5, ink: 0.4 });
      c.beginPath();
      c.moveTo(-0.25, 1.75); c.lineTo(-0.3, 2.45);
      c.moveTo(0.3, 1.8); c.lineTo(0.3, 2.45);
      stroke(c, tone(skin, 'd2', true), 0.2);
    }
    c.restore();
  }

  /* Bodice shared by the dresses and the t-shirt */
  function bodicePath(c, bottom) {
    c.beginPath();
    c.moveTo(8, 21.4);
    c.quadraticCurveTo(10.4, 19.7, 14, 20.1);
    c.quadraticCurveTo(17.6, 19.7, 20, 21.4);
    c.quadraticCurveTo(20.2, 23.6, 19.4, bottom);
    c.lineTo(8.6, bottom);
    c.quadraticCurveTo(7.8, 23.6, 8, 21.4);
    c.closePath();
  }

  /* Hem sway from the skirt spring: lift as she sinks, flare off the
     trailing side */
  function hemSway(P) {
    var t = P.t;
    var lift = clamp(-P.sk.y * 0.5, -1.2, 1.2);
    var push = clamp(P.sk.x * 0.45, -1.4, 1.4);
    return {
      lift: lift,
      fl: Math.sin(t * 3.1) * 0.35 + push - Math.max(0, push) * 0.3,
      fr: Math.sin(t * 3.1 + 1.6) * 0.35 + push - Math.min(0, push) * 0.3,
    };
  }

  function skirt(c, P) {
    var col = P.suit, H = hemSway(P);
    var lift = H.lift, fl = H.fl, fr = H.fr;
    var hem = function () {
      c.beginPath();
      c.moveTo(8.6, 25.2);
      c.lineTo(19.4, 25.2);
      c.quadraticCurveTo(21.6, 27.4, 23.4 + fr, 29.8 - lift + fr * 0.3);
      c.quadraticCurveTo(14, 31.6 - lift * 0.4, 4.6 + fl, 29.8 - lift + fl * 0.3);
      c.quadraticCurveTo(6.4, 27.4, 8.6, 25.2);
      c.closePath();
    };
    cel(c, hem, col, { s: 1.4, ink: 0.55, rim: 0.5, x0: 5, x1: 23, y0: 25, y1: 31 });
    /* fold shadows fanning out from the waist */
    c.save();
    hem();
    c.clip();
    c.fillStyle = tone(col, 'd1');
    c.beginPath();
    c.moveTo(12.4, 25.4); c.lineTo(10.4 + fl * 0.5, 31.5); c.lineTo(12.2 + fl * 0.5, 31.5); c.closePath();
    c.moveTo(16.2, 25.4); c.lineTo(17.4 + fr * 0.5, 31.5); c.lineTo(19.2 + fr * 0.5, 31.5); c.closePath();
    c.fill();
    c.fillStyle = tone(col, 'hi');
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(14, 25.4); c.lineTo(13.4, 31); c.lineTo(15, 31); c.closePath();
    c.fill();
    c.restore();
    if (P.outfit === 'starDress') {
      c.fillStyle = '#ffd24a';
      var st = [[7.6, 28.6, 0.9], [11, 29.6, 0.8], [15, 28.4, 0.9], [19.6, 29.4, 0.8]];
      for (var i = 0; i < st.length; i++) {
        starPath(c, st[i][0], st[i][1] - lift * 0.5, st[i][2]);
        c.fill();
      }
      c.beginPath();
      c.moveTo(4.8 + fl, 29.6 - lift + fl * 0.3);
      c.quadraticCurveTo(14, 31.4 - lift * 0.4, 23.2 + fr, 29.6 - lift + fr * 0.3);
      stroke(c, '#ffffff', 0.6);
    } else {
      /* scalloped white frill along the hem */
      for (var sI = 0; sI < 6; sI++) {
        var u = sI / 5;
        var hx = 5.6 + u * 16.8 + (fl * (1 - u) + fr * u);
        var hy = 29.8 + Math.sin(u * Math.PI) * 1.2 - lift + (fl * (1 - u) + fr * u) * 0.3 + Math.sin(u * Math.PI) * lift * 0.6;
        (function (hx, hy) {
          cel(c, function () { c.beginPath(); c.arc(hx, hy, 1.55, Math.PI * 0.05, Math.PI * 0.95, true); c.closePath(); },
            '#ffffff', { s: 0.6, ink: 0.35 });
        })(hx, hy);
      }
    }
  }

  /* Ballet tutu: three translucent tulle layers with zig-zag hems */
  function tutu(c, P) {
    var col = P.suit, H = hemSway(P);
    var layers = [[12.4, 28.2, mix(col, '#ffffff', 0.62), 0.82], [11.2, 28.9, mix(col, '#ffffff', 0.35), 0.88], [9.8, 29.4, col, 1]];
    for (var l = 0; l < 3; l++) {
      (function (w, yb, lc, a) {
        var lift = H.lift * (1 - l * 0.2), fl = H.fl, fr = H.fr;
        var path = function () {
          c.beginPath();
          c.moveTo(8.8, 25.2);
          c.lineTo(19.2, 25.2);
          c.quadraticCurveTo(14 + w * 0.8, 26.4, 14 + w + fr, yb - lift + fr * 0.3);
          for (var j = 1; j <= 10; j++) {
            var u = j / 10;
            c.lineTo(14 + w - u * 2 * w + lerp(fr, fl, u), yb + (j % 2 ? 1 : 0) + Math.sin(u * PI) * 0.8 - lift + lerp(fr, fl, u) * 0.3);
          }
          c.quadraticCurveTo(14 - w * 0.8, 26.4, 8.8, 25.2);
          c.closePath();
        };
        c.save();
        c.globalAlpha = a;
        cel(c, path, lc, { s: 0.9, ink: 0.4 });
        c.restore();
      })(layers[l][0], layers[l][1], layers[l][2], layers[l][3]);
    }
    c.fillStyle = '#ffffff';
    var sp = [[9, 28], [12.6, 29.6], [16.4, 28.6], [19.6, 29.2], [14.4, 27.4]];
    for (var s = 0; s < sp.length; s++) {
      if (Math.sin(P.t * 3 + s * 1.9) < 0) continue;
      starPath(c, sp[s][0], sp[s][1] - H.lift, 0.55, 0.35);
      c.fill();
    }
  }

  /* Seashell dress: a wavy hem with fish-scale ripples and pearl trim */
  function shellSkirt(c, P) {
    var col = P.suit, H = hemSway(P), lift = H.lift, fl = H.fl, fr = H.fr;
    var pts = [];
    for (var j = 0; j <= 5; j++) {
      var u = j / 5;
      pts.push([lerp(23 + fr, 5 + fl, u), 30.4 - lift + Math.sin(u * PI) * 0.9 + lerp(fr, fl, u) * 0.3]);
    }
    var hem = function () {
      c.beginPath();
      c.moveTo(8.6, 25.2);
      c.lineTo(19.4, 25.2);
      c.quadraticCurveTo(22, 27.6, pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) {
        c.quadraticCurveTo((pts[k - 1][0] + pts[k][0]) / 2, Math.max(pts[k - 1][1], pts[k][1]) + 1.5, pts[k][0], pts[k][1]);
      }
      c.quadraticCurveTo(6, 27.6, 8.6, 25.2);
      c.closePath();
    };
    cel(c, hem, col, { s: 1.4, ink: 0.55, rim: 0.5, x0: 5, x1: 23, y0: 25, y1: 32 });
    c.save();
    hem();
    c.clip();
    c.beginPath();
    for (var r = 0; r < 4; r++) {
      var yy = 26.4 + r * 1.5 - lift * r * 0.25;
      for (var x = 5 + (r % 2); x < 24; x += 2) { c.moveTo(x + 1, yy); c.arc(x, yy, 1, 0, PI); }
    }
    stroke(c, tone(col, 'd1'), 0.3);
    c.restore();
    for (var p = 0; p < pts.length; p++) gem(c, pts[p][0], pts[p][1] - 0.2, 0.5, '#fff4f8');
  }

  function scallop(c, x, y, r, rot, col) {
    col = col || '#ffe2ea';
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    cel(c, function () {
      c.beginPath();
      c.moveTo(0, r * 0.9);
      c.arc(0, r * 0.9, r * 1.6, -PI * 0.8, -PI * 0.2);
      c.closePath();
    }, col, { s: 0.4, ink: 0.3 });
    c.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = -PI * (0.72 - i * 0.13);
      c.moveTo(0, r * 0.7); c.lineTo(Math.cos(a) * r * 1.4, r * 0.9 + Math.sin(a) * r * 1.4);
    }
    stroke(c, tone(col, 'd2'), 0.2);
    c.restore();
  }

  /* A five-petal blossom print */
  function blossom(c, x, y, r, col) {
    c.fillStyle = col;
    c.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -PI / 2 + i * TAU / 5;
      c.moveTo(x + Math.cos(a) * r * 0.55 + r * 0.5, y + Math.sin(a) * r * 0.55);
      c.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, TAU);
    }
    c.fill();
    ellipsePath(c, x, y, r * 0.3, r * 0.3);
    c.fillStyle = '#ffd24a';
    c.fill();
  }
  /* Skin showing between a top and a bottom */
  function midriff(c, P, y0, h) {
    cel(c, function () { c.beginPath(); c.rect(8.8, y0, 10.4, h); }, P.skin, { warm: true, s: 0.9, ink: 0 });
    c.beginPath(); c.moveTo(8.8, y0); c.lineTo(8.8, y0 + h); c.moveTo(19.2, y0); c.lineTo(19.2, y0 + h);
    stroke(c, tone(P.skin, 'ink', true), 0.5);
    c.beginPath(); c.moveTo(14, y0 + h * 0.5); c.lineTo(14, y0 + h * 0.5 + 0.6);
    stroke(c, tone(P.skin, 'd2', true), 0.35);
  }

  /* Summer yukata: wrapped collar, a wide sash tied in a butterfly bow
     behind her, a blossom print, and a narrow wrap skirt */
  function yukata(c, P) {
    var col = P.suit, H = hemSway(P), lift = H.lift * 0.5, fl = H.fl * 0.5, fr = H.fr * 0.5;
    var obi = lum(col) > 0.62 ? '#e8587c' : '#ffd45e', print = lum(col) > 0.62 ? mix(col, '#e8587c', 0.6) : '#ffffff';
    /* the bow's wings peek out either side of her waist */
    for (var e = -1; e <= 1; e += 2) {
      (function (e) {
        cel(c, function () { ellipsePath(c, 14 + e * 6.6, 24 + Math.sin(P.t * 2.4 + e) * 0.15, 2.9, 2, e * 0.55); }, obi,
          { s: 0.7, ink: 0.45 });
      })(e);
    }
    var hem = function () {
      c.beginPath();
      c.moveTo(8.6, 25.2);
      c.lineTo(19.4, 25.2);
      c.quadraticCurveTo(21.2, 28, 21.6 + fr, 31.4 - lift);
      c.quadraticCurveTo(14, 32.8 - lift * 0.4, 6.4 + fl, 31.4 - lift);
      c.quadraticCurveTo(6.8, 28, 8.6, 25.2);
      c.closePath();
    };
    cel(c, hem, col, { s: 1.3, ink: 0.55, rim: 0.5, x0: 6, x1: 22, y0: 25, y1: 32 });
    c.save();
    hem();
    c.clip();
    /* the front panel wraps left over right */
    c.beginPath();
    c.moveTo(15.8, 25); c.lineTo(12 + fl * 0.5, 33); c.lineTo(13.8 + fl * 0.5, 33); c.closePath();
    c.fillStyle = tone(col, 'd1');
    c.fill();
    c.beginPath(); c.moveTo(15.8, 25); c.lineTo(12 + fl * 0.5, 33);
    stroke(c, tone(col, 'ink'), 0.35);
    blossom(c, 9.4 + fl * 0.5, 28.6, 1, print);
    blossom(c, 17.8 + fr * 0.5, 29.8 - lift * 0.5, 1.1, print);
    blossom(c, 19.6 + fr * 0.5, 26.9, 0.75, print);
    blossom(c, 11.6 + fl * 0.5, 31.2 - lift * 0.5, 0.75, print);
    c.restore();
    cel(c, function () { bodicePath(c, 25.6); }, col, { s: 1.1, ink: 0.55, rim: 0.35, x0: 8, x1: 20, y0: 20, y1: 26 });
    blossom(c, 10.2, 22.3, 0.8, print);
    blossom(c, 18, 22.6, 0.65, print);
    /* white under-collar, then the lapels crossing over it */
    cel(c, function () {
      c.beginPath();
      c.moveTo(10.4, 20); c.lineTo(14.7, 24.2); c.lineTo(18, 20.1);
      c.lineTo(16.5, 19.9); c.lineTo(14.6, 22.5); c.lineTo(11.9, 19.8); c.closePath();
    }, '#ffffff', { s: 0.5, ink: 0.35 });
    c.beginPath();
    c.moveTo(18.4, 20.4); c.lineTo(14.8, 24.4);
    c.moveTo(10, 20.3); c.lineTo(15.6, 25.2);
    stroke(c, tone(col, 'ink'), 0.4);
    /* sash, its cord and knot */
    cel(c, function () {
      c.beginPath();
      c.moveTo(8.4, 23.5); c.quadraticCurveTo(14, 24.2, 19.6, 23.5);
      c.lineTo(19.6, 26.2); c.quadraticCurveTo(14, 26.9, 8.4, 26.2); c.closePath();
    }, obi, { s: 0.9, ink: 0.5 });
    c.beginPath(); c.moveTo(8.5, 24.9); c.quadraticCurveTo(14, 25.6, 19.5, 24.9);
    stroke(c, lum(col) > 0.62 ? '#ffd45e' : '#e8587c', 0.5);
    gem(c, 14, 25.25, 0.7, '#fff6fa');
  }

  /* Ball gown: a floor-length bell split over a ruffled underskirt */
  function ballGown(c, P) {
    var col = P.suit, H = hemSway(P), lift = H.lift * 0.6, fl = H.fl, fr = H.fr;
    var under = mix(col, '#ffffff', 0.82), frill = mix(col, '#ffffff', 0.5);
    var bell = function () {
      c.beginPath();
      c.moveTo(8.8, 25.2);
      c.lineTo(19.2, 25.2);
      c.bezierCurveTo(23.6, 26.2, 26.2 + fr, 30, 26.6 + fr, 33.2 - lift);
      c.quadraticCurveTo(14, 35.4 - lift * 0.4, 1.4 + fl, 33.2 - lift);
      c.bezierCurveTo(1.8 + fl, 30, 4.4, 26.2, 8.8, 25.2);
      c.closePath();
    };
    cel(c, bell, col, { s: 1.7, ink: 0.55, rim: 0.55, x0: 2, x1: 26, y0: 25, y1: 35 });
    c.save();
    bell();
    c.clip();
    /* deep folds in the overskirt */
    c.fillStyle = tone(col, 'd1');
    c.beginPath();
    c.moveTo(10.2, 25.4); c.lineTo(3.4 + fl, 36); c.lineTo(6 + fl, 36); c.closePath();
    c.moveTo(18.6, 25.4); c.lineTo(21 + fr, 36); c.lineTo(23.8 + fr, 36); c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(21, 26.6); c.quadraticCurveTo(24.6 + fr * 0.5, 29, 25.4 + fr, 32.6);
    c.globalAlpha = 0.6;
    stroke(c, tone(col, 'hi'), 0.6);
    c.globalAlpha = 1;
    /* the underskirt panel and its three tiers of ruffles */
    var panel = function () {
      c.beginPath();
      c.moveTo(14, 25.4); c.lineTo(19 + fr * 0.5, 36); c.lineTo(9 + fl * 0.5, 36); c.closePath();
    };
    panel();
    c.fillStyle = under;
    c.fill();
    c.save();
    panel();
    c.clip();
    for (var r = 0; r < 3; r++) {
      var ry = 28.6 + r * 2.3 - lift * 0.4;
      c.beginPath();
      for (var x = 8; x < 20; x += 1.6) { c.moveTo(x, ry); c.arc(x + 0.8, ry, 0.8, PI, 0, true); }
      stroke(c, frill, 0.45);
    }
    c.restore();
    c.beginPath();
    c.moveTo(14, 25.4); c.lineTo(19 + fr * 0.5, 36);
    c.moveTo(14, 25.4); c.lineTo(9 + fl * 0.5, 36);
    stroke(c, '#b9811a', 0.75);
    c.beginPath();
    c.moveTo(14, 25.4); c.lineTo(19 + fr * 0.5, 36);
    c.moveTo(14, 25.4); c.lineTo(9 + fl * 0.5, 36);
    stroke(c, '#ffd86a', 0.4);
    c.restore();
    cel(c, function () { bodicePath(c, 25.6); }, col, { s: 1.1, ink: 0.55, rim: 0.35, x0: 8, x1: 20, y0: 20, y1: 26 });
    /* sweetheart neckline, pointed waist in gold, a jewelled brooch */
    cel(c, function () {
      c.beginPath();
      c.moveTo(9.4, 20.4);
      c.quadraticCurveTo(11.6, 19.6, 14, 21.4);
      c.quadraticCurveTo(16.4, 19.6, 18.6, 20.4);
      c.quadraticCurveTo(16.6, 19.4, 14, 19.9);
      c.quadraticCurveTo(11.4, 19.4, 9.4, 20.4);
      c.closePath();
    }, P.skin, { warm: true, s: 0.4, ink: 0 });
    gold(c, function () {
      c.beginPath(); c.moveTo(9.4, 20.5); c.quadraticCurveTo(11.6, 19.7, 14, 21.5); c.quadraticCurveTo(16.4, 19.7, 18.6, 20.5);
    }, 0.4);
    gold(c, function () { c.beginPath(); c.moveTo(8.7, 24.7); c.lineTo(14, 26.5); c.lineTo(19.3, 24.7); }, 0.45);
    gold(c, function () { ellipsePath(c, 14, 23, 1.05, 1.05); }, 0.35);
    jewel(c, 14, 23, 0.9, '#7fe0ff');
  }

  /* Jellyfish dress: a glassy bell with a scalloped rim and trailing ribbons */
  function jellyDress(c, P) {
    var col = P.suit, H = hemSway(P), lift = H.lift, fl = H.fl, fr = H.fr, pale = mix(col, '#ffffff', 0.5);
    for (var i = 0; i < 5; i++) {
      (function (x0, ph, len) {
        var sw = lerp(fl, fr, i / 4) + clamp(P.sk.x * 0.4, -1.5, 1.5);
        var path = function () {
          c.beginPath();
          c.moveTo(x0, 29.6 - lift);
          c.bezierCurveTo(x0 + Math.sin(ph) * 1.1 + sw * 0.5, 31.2 - lift, x0 - Math.sin(ph) * 1.1 + sw, 32.6 - lift * 0.6,
            x0 + Math.sin(ph + 1) * 0.8 + sw * 1.4, 29.6 + len - lift * 0.5);
        };
        path();
        stroke(c, tone(pale, 'ink'), 1.25);
        path();
        stroke(c, i % 2 ? '#ffffff' : pale, 0.7);
      })(6.4 + i * 3.8, P.t * 2.6 + i * 1.3, i % 2 ? 4.4 : 5.6);
    }
    var bell = function () {
      c.beginPath();
      c.moveTo(8.8, 25.2);
      c.lineTo(19.2, 25.2);
      c.bezierCurveTo(24.8, 25.4, 25.8 + fr, 28.8, 24 + fr, 30.2 - lift);
      for (var j = 1; j <= 5; j++) {
        var xa = lerp(24, 4, (j - 0.5) / 5) + lerp(fr, fl, (j - 0.5) / 5), xb = lerp(24, 4, j / 5) + lerp(fr, fl, j / 5);
        c.quadraticCurveTo(xa, 32 - lift, xb, 30.2 - lift);
      }
      c.bezierCurveTo(2.2 + fl, 28.8, 3.2, 25.4, 8.8, 25.2);
      c.closePath();
    };
    c.globalAlpha = 0.93;
    cel(c, bell, pale, { s: 1.5, ink: 0.55, rim: 0.6, x0: 4, x1: 24, y0: 25, y1: 32 });
    c.globalAlpha = 1;
    c.save();
    bell();
    c.clip();
    /* glow inside the bell, clover rings like a moon jelly */
    var g = c.createRadialGradient(11, 26.4, 0.5, 14, 28, 9);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(2, 24, 24, 10);
    c.beginPath();
    for (var k = 0; k < 4; k++) {
      var rx = 9.8 + k * 2.8, ry = 28 - lift * 0.4 + (k % 2 ? 0.5 : 0);
      c.moveTo(rx + 1, ry); c.ellipse(rx, ry, 1, 0.75, 0, 0, TAU);
    }
    stroke(c, col, 0.4);
    c.restore();
    c.beginPath();
    c.moveTo(6.4, 26.4); c.quadraticCurveTo(4.4 + fl * 0.5, 27.6, 4.4 + fl, 29.2 - lift);
    stroke(c, 'rgba(255,255,255,0.9)', 0.6);
    cel(c, function () { bodicePath(c, 25.6); }, col, { s: 1.1, ink: 0.55, rim: 0.35, x0: 8, x1: 20, y0: 20, y1: 26 });
    /* ruffled bubble collar and waistband */
    for (var q = 0; q < 4; q++) {
      (function (x) {
        cel(c, function () { c.beginPath(); c.arc(x, 20.9, 1.5, 0, PI); c.closePath(); }, '#ffffff', { s: 0.5, ink: 0.35 });
      })(9.8 + q * 2.8);
    }
    c.beginPath(); c.moveTo(8.7, 25); c.quadraticCurveTo(14, 25.7, 19.3, 25);
    stroke(c, pale, 0.9);
    gem(c, 14, 23.4, 0.7, '#fff6fa');
  }

  /* Hula outfit: a lei over a bandeau, and a swishing grass skirt */
  function hulaDress(c, P) {
    var col = P.suit, H = hemSway(P), lift = H.lift, fl = H.fl, fr = H.fr, pale = mix(col, '#fff6c0', 0.4);
    midriff(c, P, 23.4, 2.6);
    for (var i = 0; i <= 12; i++) {
      (function (i) {
        var u = i / 12, sw = lerp(fl, fr, u) + Math.sin(P.t * 2.6 + i * 1.7) * 0.25;
        var x0 = 8.6 + u * 10.8, x1 = 4.6 + u * 18.8 + sw;
        var y1 = 30.6 + Math.sin(u * PI) * 1.3 - lift + (i % 2) * 0.7;
        cel(c, function () {
          c.beginPath();
          c.moveTo(x0 - 0.8, 25.8); c.lineTo(x0 + 0.8, 25.8);
          c.quadraticCurveTo(lerp(x0, x1, 0.6) + 0.9, lerp(25.8, y1, 0.6), x1 + 0.3, y1);
          c.quadraticCurveTo(lerp(x0, x1, 0.6) - 0.8, lerp(25.8, y1, 0.6), x0 - 0.8, 25.8);
          c.closePath();
        }, i % 2 ? pale : col, { s: 0.5, ink: 0.35 });
      })(i);
    }
    /* leafy waistband with a hibiscus */
    cel(c, function () {
      c.beginPath();
      c.moveTo(8.4, 25); c.quadraticCurveTo(14, 25.7, 19.6, 25);
      c.lineTo(19.7, 26.6); c.quadraticCurveTo(14, 27.3, 8.3, 26.6); c.closePath();
    }, '#5cc46a', { s: 0.5, ink: 0.4 });
    flower(c, 10.4, 25.9, 1.6, '#ff6a8a', 0.3);
    cel(c, function () {
      c.beginPath();
      c.moveTo(8.2, 21.2); c.quadraticCurveTo(14, 19.8, 19.8, 21.2);
      c.lineTo(19.5, 23.7); c.quadraticCurveTo(14, 24.5, 8.5, 23.7); c.closePath();
    }, col, { s: 0.9, ink: 0.5 });
    var lc = ['#ffffff', '#ffd25a', '#ff8fb8', '#ffffff', '#ffd25a', '#ff8fb8', '#ffffff'];
    for (var f = 0; f < 7; f++) {
      var v = f / 6, lx = lerp(lerp(9.2, 14, v), lerp(14, 18.8, v), v), ly = lerp(lerp(20.2, 25.4, v), lerp(25.4, 20.2, v), v);
      flower(c, lx, ly, 1.2, lc[f], f * 0.9);
    }
  }

  /* Hip fins for the mermaid and shark suits */
  function hipFin(c, P, side, col, a) {
    var sw = clamp(P.sk.x * 0.3, -1, 1) + Math.sin(P.t * 3 + side) * 0.25;
    var X = function (v) { return 14 + side * v; };
    var path = function () {
      c.beginPath();
      c.moveTo(X(5.2), 26.4);
      c.quadraticCurveTo(X(8.6) + sw, 26.6, X(10.6) + sw, 29.8);
      c.quadraticCurveTo(X(8.4) + sw * 0.6, 29, X(7.6) + sw * 0.5, 30);
      c.quadraticCurveTo(X(6.4), 29, X(5), 29.4);
      c.closePath();
    };
    c.globalAlpha = a;
    cel(c, path, col, { s: 0.6, ink: 0.4 });
    c.globalAlpha = 1;
    c.beginPath();
    c.moveTo(X(5.6), 26.9); c.lineTo(X(9.6) + sw, 29.2);
    c.moveTo(X(5.4), 27.6); c.lineTo(X(7.6) + sw * 0.5, 29.4);
    stroke(c, tone(col, 'd1'), 0.25);
  }

  function outfit(c, P) {
    var col = P.suit, o = P.outfit, skin = P.skin;
    var ink = tone(col, 'ink');
    if (o === 'yukata') { yukata(c, P); return; }
    if (o === 'ballGown') { ballGown(c, P); return; }
    if (o === 'jellyDress') { jellyDress(c, P); return; }
    if (o === 'hulaDress') { hulaDress(c, P); return; }
    if (P.dress) {
      if (o === 'tutuDress') tutu(c, P);
      else if (o === 'shellDress') shellSkirt(c, P);
      else skirt(c, P);
      cel(c, function () { bodicePath(c, 25.6); }, col, { s: 1.1, ink: 0.55, rim: 0.35, x0: 8, x1: 20, y0: 20, y1: 26 });
      /* waist seam */
      c.beginPath(); c.moveTo(8.7, 25.3); c.quadraticCurveTo(14, 25.9, 19.3, 25.3);
      stroke(c, ink, 0.4);
      if (o === 'frillyDress') {
        cel(c, function () {
          c.beginPath();
          c.moveTo(9.6, 20.2);
          c.quadraticCurveTo(14, 22.4, 18.4, 20.2);
          c.lineTo(18, 21.5);
          for (var k = 0; k < 4; k++) c.quadraticCurveTo(17.4 - k * 2.1, 23.1 - (k % 3 ? 0 : 0.2), 16.9 - k * 2.1 - 0.4, 22.2);
          c.lineTo(10, 21.5);
          c.closePath();
        }, '#ffffff', { s: 0.6, ink: 0.4 });
        heartPath(c, 14, 23.2, 0.85);
        c.fillStyle = '#ff4a70';
        c.fill();
        stroke(c, '#8a1a38', 0.3);
        ellipsePath(c, 13.6, 22.9, 0.3, 0.22);
        c.fillStyle = '#ffffff';
        c.fill();
      } else if (o === 'sailorDress') {
        sailorCollar(c, col);
      } else if (o === 'tutuDress') {
        /* sweetheart neckline and a satin sash */
        cel(c, function () {
          c.beginPath();
          c.moveTo(9.4, 20.4);
          c.quadraticCurveTo(11.6, 19.6, 14, 21.4);
          c.quadraticCurveTo(16.4, 19.6, 18.6, 20.4);
          c.quadraticCurveTo(16.6, 19.4, 14, 19.9);
          c.quadraticCurveTo(11.4, 19.4, 9.4, 20.4);
          c.closePath();
        }, skin, { warm: true, s: 0.4, ink: 0 });
        c.beginPath(); c.moveTo(9.4, 20.5); c.quadraticCurveTo(11.6, 19.7, 14, 21.5); c.quadraticCurveTo(16.4, 19.7, 18.6, 20.5);
        stroke(c, '#ffffff', 0.55);
        c.beginPath(); c.moveTo(8.7, 24.7); c.quadraticCurveTo(14, 25.4, 19.3, 24.7);
        stroke(c, mix(col, '#ffffff', 0.55), 0.9);
        bowKnot(c, 14, 24.9, 0.9);
      } else if (o === 'shellDress') {
        scallop(c, 12.3, 22.4, 1.4, -0.25);
        scallop(c, 15.7, 22.4, 1.4, 0.25);
        gem(c, 14, 23.4, 0.55, '#fff4f8');
      } else {
        /* star dress: gold bow and star medallion */
        cel(c, function () { ellipsePath(c, 12.4, 21.3, 1.6, 1.2, -0.3); }, '#ffd24a', { s: 0.6, ink: 0.35 });
        cel(c, function () { ellipsePath(c, 15.6, 21.3, 1.6, 1.2, 0.3); }, '#ffd24a', { s: 0.6, ink: 0.35 });
        ellipsePath(c, 14, 21.3, 0.75, 0.75);
        c.fillStyle = '#c88a1a';
        c.fill();
        starPath(c, 14, 23.6, 1.45);
        c.fillStyle = '#fff4a8';
        c.fill();
        stroke(c, '#b07a10', 0.3);
      }
      return;
    }
    if (o === 'frillyBikini') {
      /* midriff */
      cel(c, function () { c.beginPath(); c.rect(8.8, 23.6, 10.4, 4.2); }, skin, { warm: true, s: 0.9, ink: 0 });
      c.beginPath(); c.moveTo(14, 25.6); c.lineTo(14, 26.2);
      stroke(c, tone(skin, 'd2', true), 0.35);
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.2, 21.2); c.quadraticCurveTo(14, 19.8, 19.8, 21.2);
        c.lineTo(19.6, 24); c.lineTo(8.4, 24); c.closePath();
      }, col, { s: 0.9, ink: 0.5 });
      for (var fb = 0; fb < 5; fb++) {
        (function (fx) {
          cel(c, function () { c.beginPath(); c.arc(fx, 24, 1.15, 0, Math.PI); c.closePath(); }, '#ffffff', { s: 0.5, ink: 0.3 });
        })(9.4 + fb * 2.3);
      }
      bowKnot(c, 14, 22.2, 0.9);
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.4, 27.2); c.quadraticCurveTo(14, 28.4, 19.6, 27.2);
        c.lineTo(18.6, 30.2); c.quadraticCurveTo(14, 31, 9.4, 30.2); c.closePath();
      }, col, { s: 0.9, ink: 0.5, rim: 0.4, x0: 8, x1: 20, y0: 27, y1: 31 });
      bowKnot(c, 19.6, 28.2, 1.1);
      return;
    }
    if (o === 'sailorSwimsuit') {
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.2, 21.2); c.quadraticCurveTo(14, 19.8, 19.8, 21.2);
        c.lineTo(19.6, 27.4); c.lineTo(20, 27.6); c.lineTo(18.2, 30.4);
        c.quadraticCurveTo(14, 31, 9.8, 30.4); c.lineTo(8, 27.6); c.lineTo(8.4, 27.4); c.closePath();
      }, col, { s: 1.1, ink: 0.55, rim: 0.4, x0: 8, x1: 20, y0: 20, y1: 31 });
      sailorCollar(c, col);
      cel(c, function () { ellipsePath(c, 13, 23.6, 1.3, 1, -0.3); }, '#ff4466', { s: 0.6, ink: 0.35 });
      cel(c, function () { ellipsePath(c, 15, 23.6, 1.3, 1, 0.3); }, '#ff4466', { s: 0.6, ink: 0.35 });
      ellipsePath(c, 14, 23.6, 0.55, 0.55);
      c.fillStyle = '#b82a40';
      c.fill();
      return;
    }
    if (o === 'onePiece') {
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.8, 20.8); c.quadraticCurveTo(14, 19.2, 19.2, 20.8);
        c.quadraticCurveTo(19.6, 25, 19.2, 29); c.quadraticCurveTo(14, 30.8, 8.8, 29);
        c.quadraticCurveTo(8.4, 25, 8.8, 20.8); c.closePath();
      }, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 9, x1: 19, y0: 20, y1: 30 });
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.8, 20.8); c.quadraticCurveTo(14, 19.2, 19.2, 20.8);
        for (var k = 0; k < 4; k++) c.quadraticCurveTo(18.6 - k * 2.6, 22.8, 17.9 - k * 2.6 - 0.6, 21.6);
        c.lineTo(8.8, 21.6); c.closePath();
      }, tone(col, 'hi'), { s: 0.5, ink: 0.35 });
      starPath(c, 14, 25, 1.5);
      c.fillStyle = '#fff4a8';
      c.fill();
      stroke(c, '#b07a10', 0.3);
      return;
    }
    var suitBody = function () {
      c.beginPath();
      c.moveTo(8.8, 20.8); c.quadraticCurveTo(14, 19.2, 19.2, 20.8);
      c.quadraticCurveTo(19.6, 25, 19.2, 29); c.quadraticCurveTo(14, 30.8, 8.8, 29);
      c.quadraticCurveTo(8.4, 25, 8.8, 20.8); c.closePath();
    };
    if (o === 'stripeSuit') {
      /* old-time bathing suit: bold hoops, white piping, a bow */
      cel(c, suitBody, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 9, x1: 19, y0: 20, y1: 30 });
      c.save();
      suitBody();
      c.clip();
      c.beginPath();
      for (var sb = 0; sb < 4; sb++) {
        c.moveTo(8, 22.6 + sb * 2.2); c.quadraticCurveTo(14, 23.5 + sb * 2.2, 20, 22.6 + sb * 2.2);
      }
      stroke(c, '#ffffff', 0.95);
      c.restore();
      suitBody();
      stroke(c, ink, 0.55);
      c.beginPath(); c.moveTo(9.4, 20.7); c.quadraticCurveTo(14, 19.3, 18.6, 20.7);
      stroke(c, '#ffffff', 0.6);
      c.save();
      c.translate(14, 21.5);
      bow(c, '#ff5068', 1.5, 0.9);
      c.restore();
      return;
    }
    if (o === 'skirtSuit') {
      /* polka-dot swim dress with a ruffled skirt */
      cel(c, suitBody, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 9, x1: 19, y0: 20, y1: 30 });
      var HS = hemSway(P), rl = HS.lift * 0.6, rf = mix(col, '#ffffff', 0.3);
      var ruffle = function () {
        c.beginPath();
        c.moveTo(8.6, 25.6);
        c.lineTo(19.4, 25.6);
        c.quadraticCurveTo(21.4, 27, 22.2 + HS.fr * 0.6, 28.8 - rl);
        for (var j = 1; j <= 6; j++) {
          var u0 = (j - 0.5) / 6, u1 = j / 6;
          c.quadraticCurveTo(lerp(22.2, 5.8, u0) + lerp(HS.fr, HS.fl, u0) * 0.6, 30.5 - rl, lerp(22.2, 5.8, u1) + lerp(HS.fr, HS.fl, u1) * 0.6, 28.8 - rl + Math.sin(u1 * PI) * 0.8);
        }
        c.quadraticCurveTo(6.6, 27, 8.6, 25.6);
        c.closePath();
      };
      cel(c, ruffle, rf, { s: 1, ink: 0.5, rim: 0.45, x0: 6, x1: 22, y0: 25, y1: 31 });
      c.save();
      c.beginPath();
      suitBody();
      ruffle();
      c.clip();
      c.fillStyle = '#ffffff';
      var dots = [[10.4, 22.2], [13.2, 23.6], [16.4, 22.4], [18, 24.6], [11.4, 24.8], [9.2, 27.6], [12.6, 28.4], [15.8, 27.4], [19, 28.2], [14.2, 26.4]];
      for (var d = 0; d < dots.length; d++) { ellipsePath(c, dots[d][0], dots[d][1], 0.48, 0.48); c.fill(); }
      c.restore();
      c.beginPath(); c.moveTo(8.7, 25.6); c.quadraticCurveTo(14, 26.3, 19.3, 25.6);
      stroke(c, ink, 0.4);
      c.save();
      c.translate(14, 21.4);
      bow(c, '#ffffff', 1.7, 1);
      c.restore();
      return;
    }
    if (o === 'mermaidSuit') {
      /* shell top, pearl belt, scaled bottoms with a fin on each hip */
      var pale2 = mix(col, '#ffffff', 0.45);
      hipFin(c, P, -1, pale2, 0.9);
      hipFin(c, P, 1, pale2, 0.9);
      midriff(c, P, 23.2, 4);
      var bottoms = function () {
        c.beginPath();
        c.moveTo(8.4, 26.6); c.quadraticCurveTo(14, 27.6, 19.6, 26.6);
        c.lineTo(19, 29.8); c.quadraticCurveTo(14, 31, 9, 29.8); c.closePath();
      };
      cel(c, bottoms, col, { s: 0.9, ink: 0.5, rim: 0.4, x0: 8, x1: 20, y0: 26, y1: 31 });
      c.save();
      bottoms();
      c.clip();
      c.beginPath();
      for (var sr = 0; sr < 3; sr++) {
        for (var sx2 = 8 + (sr % 2); sx2 < 21; sx2 += 2) { c.moveTo(sx2 + 1, 27.6 + sr * 1.2); c.arc(sx2, 27.6 + sr * 1.2, 1, 0, PI); }
      }
      stroke(c, tone(col, 'hi'), 0.3);
      c.restore();
      for (var pb = 0; pb < 6; pb++) gem(c, 9.2 + pb * 1.92, 26.9 + Math.sin(pb / 5 * PI) * 0.5, 0.48, '#fff6fa');
      c.beginPath(); c.moveTo(8.6, 21.8); c.quadraticCurveTo(14, 20.6, 19.4, 21.8);
      stroke(c, tone(pale2, 'ink'), 0.4);
      scallop(c, 11.6, 22.2, 1.5, -0.2, pale2);
      scallop(c, 16.4, 22.2, 1.5, 0.2, pale2);
      gem(c, 14, 22.9, 0.6, '#fff6fa');
      return;
    }
    if (o === 'sharkSuit') {
      /* shark costume: pale belly, gill slits, a tooth collar, hip fins */
      hipFin(c, P, -1, col, 1);
      hipFin(c, P, 1, col, 1);
      cel(c, suitBody, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 9, x1: 19, y0: 20, y1: 30 });
      c.save();
      suitBody();
      c.clip();
      ellipsePath(c, 14, 27, 3.6, 4.6);
      c.fillStyle = '#ffffff';
      c.fill();
      ellipsePath(c, 14, 28.4, 3.6, 4.6);
      c.fillStyle = 'rgba(120, 130, 190, 0.22)';
      c.fill();
      c.restore();
      c.beginPath();
      for (var gl = 0; gl < 3; gl++) {
        c.moveTo(9.6, 22.6 + gl * 0.95); c.quadraticCurveTo(10.5, 23 + gl * 0.95, 11, 22.4 + gl * 0.95);
        c.moveTo(18.4, 22.6 + gl * 0.95); c.quadraticCurveTo(17.5, 23 + gl * 0.95, 17, 22.4 + gl * 0.95);
      }
      stroke(c, tone(col, 'd2'), 0.35);
      cel(c, function () {
        c.beginPath();
        c.moveTo(9.2, 20.6); c.quadraticCurveTo(14, 19.2, 18.8, 20.6);
        for (var tk = 0; tk < 6; tk++) {
          c.lineTo(18 - tk * 1.6, 22.4 - Math.abs(tk - 2.5) * 0.12);
          c.lineTo(17.2 - tk * 1.6, 21 - Math.abs(tk - 2.5) * 0.1);
        }
        c.closePath();
      }, '#ffffff', { s: 0.4, ink: 0.35 });
      return;
    }
    if (o === 'wetsuit') {
      var acc = lum(col) > 0.6 ? '#2a4a8a' : '#7fe6ff';
      var body = function () {
        c.beginPath();
        c.moveTo(8.4, 20.9); c.quadraticCurveTo(14, 19.3, 19.6, 20.9);
        c.quadraticCurveTo(20.1, 25, 19.2, 29.2); c.quadraticCurveTo(14, 30.2, 8.8, 29.2);
        c.quadraticCurveTo(7.9, 25, 8.4, 20.9); c.closePath();
      };
      cel(c, body, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 9, x1: 19, y0: 20, y1: 30 });
      c.save();
      body();
      c.clip();
      c.beginPath();
      c.moveTo(9.4, 20.6); c.quadraticCurveTo(10.6, 25, 9.6, 30);
      c.moveTo(18.6, 20.6); c.quadraticCurveTo(17.4, 25, 18.4, 30);
      stroke(c, acc, 0.8);
      c.restore();
      c.beginPath(); c.moveTo(14, 20.4); c.lineTo(14, 26.8);
      stroke(c, tone(col, 'd2'), 0.5);
      c.fillStyle = '#ffd24a';
      c.fillRect(13.6, 20.6, 0.8, 1.3);
      c.beginPath(); c.moveTo(11.6, 20.2); c.quadraticCurveTo(14, 21.2, 16.4, 20.2);
      stroke(c, tone(col, 'd1'), 0.9);
      return;
    }
    if (o === 'rashGuard') {
      var shorts = mix(col, '#1c2a5a', 0.55);
      cel(c, function () {
        c.beginPath();
        c.moveTo(8.6, 25.8); c.lineTo(19.4, 25.8); c.lineTo(19.9, 29.4);
        c.quadraticCurveTo(17.6, 30, 15.2, 29.4); c.lineTo(14, 28); c.lineTo(12.8, 29.4);
        c.quadraticCurveTo(10.4, 30, 8.1, 29.4); c.closePath();
      }, shorts, { s: 0.9, ink: 0.5, rim: 0.4, x0: 8, x1: 20, y0: 26, y1: 30 });
      var top = function () { bodicePath(c, 26.6); };
      cel(c, top, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 8, x1: 20, y0: 20, y1: 27 });
      c.save();
      top();
      c.clip();
      c.beginPath();
      c.moveTo(7, 23.4);
      for (var wv = 0; wv <= 7; wv++) c.quadraticCurveTo(7.9 + wv * 2, 22.4 + (wv % 2) * 2, 8.8 + wv * 2, 23.4);
      c.lineTo(22, 26); c.lineTo(7, 26); c.closePath();
      c.fillStyle = '#ffffff';
      c.globalAlpha = 0.9;
      c.fill();
      c.restore();
      c.beginPath(); c.moveTo(11.8, 20.2); c.quadraticCurveTo(14, 21.6, 16.2, 20.2);
      stroke(c, tone(col, 'hi'), 0.6);
      return;
    }
    /* classic t-shirt */
    cel(c, function () {
      bodicePath(c, 26.4);
    }, col, { s: 1.2, ink: 0.55, rim: 0.4, x0: 8, x1: 20, y0: 20, y1: 27 });
    c.beginPath();
    c.moveTo(11.8, 20.2); c.quadraticCurveTo(14, 21.8, 16.2, 20.2);
    stroke(c, tone(col, 'hi'), 0.6);
    c.beginPath(); c.moveTo(13.2, 23.4); c.lineTo(12.8, 26);
    stroke(c, tone(col, 'd1'), 0.4);
  }

  function sailorCollar(c, col) {
    cel(c, function () {
      c.beginPath();
      c.moveTo(9, 20.6); c.lineTo(14, 24); c.lineTo(19, 20.6);
      c.lineTo(17, 20.4); c.lineTo(14, 22.4); c.lineTo(11, 20.4); c.closePath();
    }, '#ffffff', { s: 0.6, ink: 0.4 });
    c.beginPath();
    c.moveTo(9.9, 21.1); c.lineTo(14, 23.5); c.lineTo(18.1, 21.1);
    stroke(c, tone(col, 'd1'), 0.45);
  }

  function bowKnot(c, x, y, r) {
    cel(c, function () { ellipsePath(c, x - r, y, r, r * 0.75, -0.3); }, '#ffd24a', { s: 0.4, ink: 0.3 });
    cel(c, function () { ellipsePath(c, x + r, y, r, r * 0.75, 0.3); }, '#ffd24a', { s: 0.4, ink: 0.3 });
    ellipsePath(c, x, y, r * 0.45, r * 0.45);
    c.fillStyle = '#c88a1a';
    c.fill();
  }

  function neck(c, P) {
    var skin = P.skin;
    c.beginPath();
    c.rect(12.5, 18 + P.headY, 3, 3.2 - P.headY);
    c.fillStyle = tone(skin, 'd1', true);
    c.fill();
    /* the chin's shadow */
    c.beginPath();
    c.rect(12.5, 18 + P.headY, 3, 1.6);
    c.fillStyle = tone(skin, 'd2', true);
    c.fill();
  }

  /* ---------- Bubble wand ----------
     Drawn along +x from the fist at the origin. The handle takes the
     accent colour; the head is the chosen wand. */
  function wandHead(c, P, sx, sy, tw) {
    var k = P.wand, t = P.t;
    if (k === 'heart') {
      c.save();
      c.translate(sx + 0.5, sy);
      c.rotate(PI / 2);
      c.scale(tw, tw);
      /* a ruby heart in a gold setting */
      gold(c, function () { heartPath(c, 0, -0.2, 2.75); }, 0.5);
      var hp = function () { heartPath(c, 0, -0.2, 2.2); };
      hp();
      var hg = c.createRadialGradient(-0.9, -1.2, 0.2, 0, 0, 3.2);
      hg.addColorStop(0, '#ffd0dc');
      hg.addColorStop(0.4, '#ff5c8a');
      hg.addColorStop(1, '#c81e56');
      c.fillStyle = hg;
      c.fill();
      stroke(c, '#8a123a', 0.4);
      c.beginPath();
      c.moveTo(-1.5, -0.2); c.lineTo(0, 1.2); c.lineTo(1.5, -0.2);
      stroke(c, 'rgba(255,255,255,0.4)', 0.22);
      ellipsePath(c, -1, -1.1, 0.6, 0.4, -0.6);
      c.fillStyle = '#ffffff';
      c.fill();
      c.restore();
      c.save();
      c.translate(sx - 2.9, sy);
      c.rotate(PI / 2);
      bow(c, P.trim, 1.5, 0.95);
      c.restore();
    } else if (k === 'shell') {
      c.save();
      c.translate(sx - 1.6, sy);
      c.rotate(PI / 2);
      c.scale(tw, tw);
      var fan = function () {
        c.beginPath();
        c.moveTo(-1, 0.3);
        c.lineTo(-3.4, -2);
        for (var i = 0; i < 5; i++) {
          var a0 = PI * (1.2 + i * 0.12), a1 = PI * (1.2 + (i + 1) * 0.12), am = (a0 + a1) / 2;
          c.quadraticCurveTo(Math.cos(am) * 5, 0.4 + Math.sin(am) * 5, Math.cos(a1) * 4.1, 0.4 + Math.sin(a1) * 4.1);
        }
        c.lineTo(1, 0.3);
        c.closePath();
      };
      cel(c, fan, '#ffd3e2', { s: 0.9, ink: 0.45 });
      c.beginPath();
      for (var r = 1; r < 5; r++) {
        var ra = PI * (1.2 + r * 0.12);
        c.moveTo(0, 0); c.lineTo(Math.cos(ra) * 3.9, 0.4 + Math.sin(ra) * 3.9);
      }
      stroke(c, '#e58aa6', 0.28);
      c.beginPath();
      c.arc(0, 0.4, 3.3, PI * 1.25, PI * 1.5);
      stroke(c, 'rgba(255,255,255,0.8)', 0.4);
      gem(c, 0, 0.2, 1, '#fff6fa');
      c.restore();
    } else if (k === 'trident') {
      gold(c, function () {
        c.beginPath();
        c.moveTo(sx - 2.4, sy); c.lineTo(sx + 3.6, sy);
        c.moveTo(sx - 1.2, sy - 2.2); c.lineTo(sx - 1.2, sy + 2.2);
        c.moveTo(sx - 1.2, sy - 2.2); c.quadraticCurveTo(sx + 0.2, sy - 2.5, sx + 2.6, sy - 2.2);
        c.moveTo(sx - 1.2, sy + 2.2); c.quadraticCurveTo(sx + 0.2, sy + 2.5, sx + 2.6, sy + 2.2);
      }, 0.75);
      /* barbed tips */
      var tips = [[3.6, 0, 1.25], [2.6, -2.2, 1], [2.6, 2.2, 1]];
      for (var p = 0; p < 3; p++) {
        (function (x, y, r) {
          cel(c, function () {
            c.beginPath();
            c.moveTo(x + r * 1.4, y); c.lineTo(x - r * 0.5, y - r * 0.8); c.lineTo(x - r * 0.1, y); c.lineTo(x - r * 0.5, y + r * 0.8);
            c.closePath();
          }, '#ffd24a', { s: 0.3, ink: 0.35 });
        })(sx + tips[p][0], sy + tips[p][1], tips[p][2] * tw);
      }
      jewel(c, sx - 1.2, sy, 0.75, '#5fd8ff');
    } else if (k === 'flower') {
      /* two leaves on the stem, then the bloom */
      for (var l = -1; l <= 1; l += 2) {
        cel(c, (function (l) { return function () { ellipsePath(c, sx - 3.4, sy + l * 1.1, 1.5, 0.65, l * 0.7); }; })(l),
          '#5cc46a', { s: 0.3, ink: 0.3 });
      }
      c.save();
      c.translate(sx + 0.2, sy);
      c.rotate(t * 0.6);
      flower(c, 0, 0, 2.9 * tw, '#ff9cc6', 0);
      cel(c, function () { ellipsePath(c, 0, 0, 1.05, 1.05); }, '#ffd24a', { s: 0.3, ink: 0.3 });
      c.restore();
    } else if (k === 'moon') {
      c.save();
      c.translate(sx + 0.4, sy);
      c.rotate(-0.5);
      c.scale(tw, tw);
      var moon = function () {
        c.beginPath();
        c.arc(0, 0, 2.9, PI * 0.28, PI * 1.72);
        c.arc(1.5, 0, 2.3, PI * 1.6, PI * 0.4, true);
        c.closePath();
      };
      cel(c, moon, '#ffd95a', { s: 0.7, ink: 0.45 });
      c.beginPath();
      c.arc(0, 0, 2.2, PI * 0.85, PI * 1.3);
      stroke(c, '#fff8d0', 0.5);
      c.restore();
      /* a star hanging off the lower horn */
      var dx = sx + 1.8 + Math.sin(t * 2.4) * 0.3, dy = sy + 3.4;
      c.beginPath(); c.moveTo(sx + 1.6, sy + 1.6); c.lineTo(dx, dy - 0.8);
      stroke(c, '#c08a1a', 0.2);
      starPath(c, dx, dy, 1);
      c.fillStyle = '#fff6b0';
      c.fill();
      stroke(c, '#c08a1a', 0.25);
    } else if (k === 'bubble') {
      /* a soap film across a gold hoop, bubbles drifting off it */
      ellipsePath(c, sx + 0.4, sy, 2.7 * tw, 2.7 * tw);
      var fg = c.createLinearGradient(sx - 2.4, sy - 2.4, sx + 3, sy + 2.6);
      fg.addColorStop(0, 'rgba(255, 190, 240, 0.75)');
      fg.addColorStop(0.5, 'rgba(190, 250, 255, 0.6)');
      fg.addColorStop(1, 'rgba(200, 190, 255, 0.75)');
      c.fillStyle = fg;
      c.fill();
      gold(c, function () { ellipsePath(c, sx + 0.4, sy, 2.7 * tw, 2.7 * tw); }, 0.6);
      c.beginPath();
      c.arc(sx + 0.4, sy, 1.7, PI * 1.1, PI * 1.5);
      stroke(c, 'rgba(255,255,255,0.95)', 0.45);
      for (var b = 0; b < 3; b++) {
        var ph = (t * 0.45 + b / 3) % 1, br = 0.5 + ph * 0.7;
        ellipsePath(c, sx + 3 + ph * 3.2, sy - 1 - ph * 3 + Math.sin(ph * 7 + b * 2) * 0.6, br, br);
        c.globalAlpha = 1 - ph;
        c.fillStyle = 'rgba(220, 248, 255, 0.45)';
        c.fill();
        stroke(c, '#ffffff', 0.25);
        c.globalAlpha = 1;
      }
    } else {
      starPath(c, sx, sy, 2.5 * tw);
      c.fillStyle = '#ffffff';
      c.fill();
      stroke(c, '#c08a1a', 0.4);
      starPath(c, sx, sy + 0.2, 1.75 * tw);
      var g = c.createLinearGradient(0, sy - 1.6, 0, sy + 2);
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(1, '#ffb820');
      c.fillStyle = g;
      c.fill();
      ellipsePath(c, sx - 0.6, sy - 0.8, 0.55, 0.4);
      c.fillStyle = '#ffffff';
      c.fill();
    }
  }
  function wand(c, P) {
    var t = P.t, grip = mix(P.trim, '#ffffff', 0.38);
    /* gold shaft with a sheen */
    gold(c, function () { c.beginPath(); c.moveTo(3.2, -0.1); c.lineTo(9, -0.1); }, 1.1);
    /* handle: a wrapped grip with a pommel bead */
    cel(c, function () { capsule(c, -0.8, -0.1, 1.6, 3.4, -0.1, 1.4); }, grip, { s: 0.8, ink: 0.45 });
    c.beginPath();
    c.moveTo(-0.4, -1.5); c.lineTo(0.5, 1.3);
    c.moveTo(1.1, -1.5); c.lineTo(2, 1.2);
    stroke(c, tone(grip, 'd1'), 0.3);
    c.fillStyle = '#ffd24a';
    c.fillRect(3, -1.4, 1.1, 2.6);
    c.strokeStyle = '#8a5a12';
    c.lineWidth = 0.25;
    c.strokeRect(3, -1.4, 1.1, 2.6);
    gem(c, -2.2, -0.1, 0.8, '#fff6fa');
    /* the head, twinkling */
    var tw = 1 + Math.sin(t * 5) * 0.08 + P.cast * 0.25;
    var sx = 10.6, sy = -0.1;
    if (P.cast > 0) {
      /* casting flash: a soft halo and four rays */
      c.save();
      c.globalAlpha = P.cast;
      var hg = c.createRadialGradient(sx, sy, 0.5, sx, sy, 6);
      hg.addColorStop(0, 'rgba(255, 255, 230, 0.9)');
      hg.addColorStop(1, 'rgba(255, 220, 120, 0)');
      c.fillStyle = hg;
      c.fillRect(sx - 6, sy - 6, 12, 12);
      c.beginPath();
      var rl = 3 + (1 - P.cast) * 3;
      c.moveTo(sx - rl - 2, sy); c.lineTo(sx + rl + 2, sy);
      c.moveTo(sx, sy - rl); c.lineTo(sx, sy + rl);
      stroke(c, '#ffffff', 0.5);
      c.restore();
    }
    wandHead(c, P, sx, sy, tw);
    /* sparkles orbiting the tip */
    c.fillStyle = '#ffffff';
    for (var s = 0; s < 3; s++) {
      var a = Math.sin(t * 4 + s * 2.1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      var px = sx + Math.cos(s * 2.3 + 0.6) * 3.6, py = sy + Math.sin(s * 2.3 + 0.6) * 2.8;
      starPath(c, px, py, 0.7 * a, 0.3);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ---------- Held food (back hand) ----------
     Each snack is painted about the origin in a box roughly 6 wide and
     8 tall, with the part she grips at the bottom. */
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  function shine(c, x, y, rx, ry, rot, a) {
    ellipsePath(c, x, y, rx, ry, rot);
    c.fillStyle = 'rgba(255,255,255,' + (a || 0.8) + ')';
    c.fill();
  }
  function cherry(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r * 0.6); c.quadraticCurveTo(x + r * 0.5, y - r * 2, x + r * 1.3, y - r * 2.1);
    stroke(c, '#3f8a3a', 0.3);
    cel(c, function () { ellipsePath(c, x, y, r, r); }, '#e8283e', { s: 0.4, ink: 0.3 });
    shine(c, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.2, -0.5);
  }
  var FOODS = {
    iceCream: function (c) {
      var cone = function () { c.beginPath(); c.moveTo(-1.9, 0.4); c.lineTo(1.9, 0.4); c.lineTo(0.2, 4.6); c.lineTo(-0.2, 4.6); c.closePath(); };
      cel(c, cone, '#e9b672', { s: 0.6, ink: 0.4 });
      c.save();
      cone();
      c.clip();
      c.beginPath();
      for (var i = -3; i <= 3; i++) { c.moveTo(i - 2, 0); c.lineTo(i + 1.4, 5); c.moveTo(i + 2, 0); c.lineTo(i - 1.4, 5); }
      stroke(c, '#b9813f', 0.22);
      c.restore();
      /* two scoops, the lower one melting over the rim */
      cel(c, function () {
        c.beginPath();
        c.moveTo(-2.5, 0.2);
        c.bezierCurveTo(-3, -3.4, 3, -3.4, 2.5, 0.2);
        c.quadraticCurveTo(2.3, 1.3, 1.5, 0.7);
        c.quadraticCurveTo(0.9, 1.9, 0.1, 0.8);
        c.quadraticCurveTo(-0.8, 1.6, -1.4, 0.7);
        c.quadraticCurveTo(-2.2, 1.2, -2.5, 0.2);
        c.closePath();
      }, '#ffb4cc', { s: 0.8, ink: 0.4 });
      cel(c, function () { ellipsePath(c, 0.2, -2.9, 1.9, 1.7); }, '#bff0d8', { s: 0.6, ink: 0.4 });
      shine(c, -1.2, -1.2, 0.7, 0.35, -0.6);
      shine(c, -0.5, -3.5, 0.5, 0.3, -0.5);
      cherry(c, 0.5, -4.7, 0.7);
    },
    onigiri: function (c) {
      var rice = function () {
        c.beginPath();
        c.moveTo(0, -3.4);
        c.bezierCurveTo(1.4, -3.4, 3.4, 0.4, 3.3, 1.8);
        c.quadraticCurveTo(3.2, 3.2, 1.6, 3.2);
        c.lineTo(-1.6, 3.2);
        c.quadraticCurveTo(-3.2, 3.2, -3.3, 1.8);
        c.bezierCurveTo(-3.4, 0.4, -1.4, -3.4, 0, -3.4);
        c.closePath();
      };
      cel(c, rice, '#ffffff', { s: 0.9, ink: 0.4 });
      c.beginPath();
      var gr = [[-1.6, -0.6], [1.4, -1], [0.2, -2.2], [-0.6, 0.2], [2, 0.6], [-2.2, 1]];
      for (var i = 0; i < gr.length; i++) { c.moveTo(gr[i][0], gr[i][1]); c.lineTo(gr[i][0] + 0.45, gr[i][1] + 0.2); }
      stroke(c, 'rgba(150, 160, 205, 0.6)', 0.25);
      c.save();
      rice();
      c.clip();
      cel(c, function () { rr(c, -1.9, 0.9, 3.8, 3, 0.3); }, '#2e4a3c', { s: 0.5, ink: 0.35 });
      c.restore();
      /* a happy face on the rice */
      c.fillStyle = '#3a2430';
      ellipsePath(c, -0.9, -0.5, 0.3, 0.38); c.fill();
      ellipsePath(c, 0.9, -0.5, 0.3, 0.38); c.fill();
      c.beginPath(); c.moveTo(-0.4, 0.05); c.quadraticCurveTo(0, 0.45, 0.4, 0.05);
      stroke(c, '#3a2430', 0.22);
      c.fillStyle = 'rgba(255, 130, 160, 0.6)';
      ellipsePath(c, -1.7, 0, 0.45, 0.28); c.fill();
      ellipsePath(c, 1.7, 0, 0.45, 0.28); c.fill();
    },
    donut: function (c) {
      var ring = function () {
        c.beginPath();
        c.ellipse(0, 0.6, 3.2, 3, 0, 0, TAU);
        c.moveTo(1, 0.5);
        c.ellipse(0, 0.5, 1, 0.85, 0, 0, TAU, true);
      };
      cel(c, ring, '#d79a5c', { s: 0.8, ink: 0.4 });
      /* icing with a dripping edge */
      cel(c, function () {
        c.beginPath();
        c.moveTo(-2.9, 0.4);
        c.bezierCurveTo(-3, -3.2, 3, -3.2, 2.9, 0.4);
        c.quadraticCurveTo(2.6, 1.9, 2, 1);
        c.quadraticCurveTo(1.5, 2.3, 1, 1.3);
        c.lineTo(1, 0.5);
        c.ellipse(0, 0.5, 1, 0.85, 0, 0, PI, true);
        c.lineTo(-1, 1.2);
        c.quadraticCurveTo(-1.6, 2.4, -2.1, 1.1);
        c.quadraticCurveTo(-2.6, 1.7, -2.9, 0.4);
        c.closePath();
      }, '#ff8fc0', { s: 0.6, ink: 0.35 });
      var sp = [[-1.9, -0.6, '#fff46a', 0.5], [-0.6, -1.6, '#6adcff', -0.4], [0.9, -1.4, '#ffffff', 0.9], [2, -0.4, '#9af09a', -0.7], [-2.1, 0.6, '#ffffff', 1.2], [1.7, 0.7, '#fff46a', 0.2]];
      for (var i = 0; i < sp.length; i++) {
        c.beginPath();
        c.moveTo(sp[i][0] - Math.cos(sp[i][3]) * 0.38, sp[i][1] - Math.sin(sp[i][3]) * 0.38);
        c.lineTo(sp[i][0] + Math.cos(sp[i][3]) * 0.38, sp[i][1] + Math.sin(sp[i][3]) * 0.38);
        stroke(c, sp[i][2], 0.38);
      }
      c.beginPath(); c.arc(0, 0.4, 2.4, PI * 1.15, PI * 1.5);
      stroke(c, 'rgba(255,255,255,0.75)', 0.4);
    },
    crepe: function (c) {
      /* whipped cream and a strawberry over the folded edge */
      cel(c, function () { ellipsePath(c, -0.9, -2.6, 1.6, 1.4); }, '#fffaf0', { s: 0.5, ink: 0.35 });
      cel(c, function () { ellipsePath(c, 1, -2.4, 1.5, 1.3); }, '#fffaf0', { s: 0.5, ink: 0.35 });
      cel(c, function () {
        c.beginPath(); c.moveTo(-0.4, -4.6); c.quadraticCurveTo(1.6, -4.6, 0.7, -2.4); c.quadraticCurveTo(-1.2, -2.6, -0.4, -4.6); c.closePath();
      }, '#ea3a50', { s: 0.4, ink: 0.3 });
      shine(c, -0.1, -3.9, 0.25, 0.4, 0.3);
      cel(c, function () {
        c.beginPath();
        c.moveTo(-2.9, -2);
        c.quadraticCurveTo(0, -0.6, 2.9, -2);
        c.lineTo(0.3, 4.6); c.lineTo(-0.3, 4.6);
        c.closePath();
      }, '#f6d79a', { s: 0.8, ink: 0.4 });
      c.beginPath();
      c.moveTo(-1.6, -1.2); c.quadraticCurveTo(-0.4, 0.4, -0.2, 3.6);
      c.moveTo(1.6, -1.2); c.quadraticCurveTo(0.6, 0.6, 0.3, 3.4);
      stroke(c, '#cf9f58', 0.25);
      /* paper wrap with a stripe */
      cel(c, function () {
        c.beginPath(); c.moveTo(-1.75, 1.2); c.lineTo(1.75, 1.2); c.lineTo(0.3, 4.8); c.lineTo(-0.3, 4.8); c.closePath();
      }, '#ff9ec4', { s: 0.5, ink: 0.4 });
      c.beginPath(); c.moveTo(-1.2, 2.4); c.lineTo(1.2, 2.4);
      stroke(c, '#ffffff', 0.4);
      c.beginPath(); c.moveTo(-2, -2.6); c.quadraticCurveTo(-0.6, -1.6, 0.4, -2.6); c.quadraticCurveTo(1.2, -1.8, 2.2, -2.5);
      stroke(c, '#6a3a1c', 0.3);
    },
    taiyaki: function (c) {
      var body = function () {
        c.beginPath();
        c.moveTo(-3.6, 0.2);
        c.bezierCurveTo(-3.4, -2.4, 0.6, -2.8, 1.8, -0.8);
        c.lineTo(3.7, -2.2);
        c.quadraticCurveTo(3.2, 0.2, 3.7, 2.6);
        c.lineTo(1.8, 1.2);
        c.bezierCurveTo(0.6, 3.2, -3.4, 2.8, -3.6, 0.2);
        c.closePath();
      };
      cel(c, body, '#dc9a4c', { s: 0.8, ink: 0.4 });
      c.save();
      body();
      c.clip();
      c.beginPath();
      for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) { var x = -1.4 + k * 1.2 + (r % 2) * 0.6, y = -1 + r * 1; c.moveTo(x + 0.6, y); c.arc(x, y, 0.6, 0, PI); }
      c.moveTo(2.4, -1.2); c.lineTo(3.4, -1.6); c.moveTo(2.4, 0.2); c.lineTo(3.5, 0.2); c.moveTo(2.4, 1.6); c.lineTo(3.4, 2);
      stroke(c, '#a8672a', 0.25);
      c.restore();
      c.beginPath(); c.arc(-1.9, 0.1, 1.5, PI * 0.6, PI * 1.4, true);
      stroke(c, '#a8672a', 0.25);
      ellipsePath(c, -2.7, -0.4, 0.42, 0.42);
      c.fillStyle = '#3a2014';
      c.fill();
      shine(c, -0.6, -1.7, 1.2, 0.3, -0.1, 0.6);
    },
    parfait: function (c) {
      /* a tall glass: layers seen through it, cream and a cherry on top */
      cel(c, function () { c.beginPath(); c.rect(1.2, -5, 0.7, 3.4); }, '#f1c98a', { s: 0.3, ink: 0.3 });
      cel(c, function () { ellipsePath(c, -0.6, -2.8, 1.7, 1.4); }, '#fffaf0', { s: 0.5, ink: 0.35 });
      cel(c, function () { ellipsePath(c, 0.7, -2.5, 1.4, 1.2); }, '#fffaf0', { s: 0.5, ink: 0.35 });
      cherry(c, -0.5, -4.2, 0.7);
      var glass = function () {
        c.beginPath();
        c.moveTo(-2.6, -2); c.lineTo(2.6, -2);
        c.quadraticCurveTo(2.2, 1.8, 0.6, 2.6); c.lineTo(0.6, 3.6); c.lineTo(1.8, 4.3); c.lineTo(-1.8, 4.3); c.lineTo(-0.6, 3.6); c.lineTo(-0.6, 2.6);
        c.quadraticCurveTo(-2.2, 1.8, -2.6, -2);
        c.closePath();
      };
      glass();
      c.fillStyle = 'rgba(220, 245, 255, 0.55)';
      c.fill();
      c.save();
      glass();
      c.clip();
      c.fillStyle = '#ff7896'; c.fillRect(-3, -1.6, 6, 1.3);
      c.fillStyle = '#fff4dc'; c.fillRect(-3, -0.3, 6, 1.2);
      c.fillStyle = '#7a4420'; c.fillRect(-3, 0.9, 6, 1.9);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-2, -2, 0.6, 4.2);
      c.restore();
      glass();
      stroke(c, '#5a86b0', 0.35);
    },
    macaron: function (c) {
      var shell = function (y, col) {
        cel(c, function () {
          c.beginPath();
          c.moveTo(-3.1, y + 0.9);
          c.bezierCurveTo(-3.1, y - 1.5, 3.1, y - 1.5, 3.1, y + 0.9);
          for (var i = 0; i < 6; i++) c.quadraticCurveTo(2.6 - i * 1.04, y + 1.6, 2.07 - i * 1.04, y + 0.9);
          c.closePath();
        }, col, { s: 0.6, ink: 0.4 });
      };
      c.save();
      c.translate(0, 2.6);
      c.scale(1, -1);
      shell(0, '#ff9ac2');
      c.restore();
      cel(c, function () { rr(c, -2.8, 0.1, 5.6, 1.5, 0.7); }, '#fff6e6', { s: 0.4, ink: 0.35 });
      shell(-1.2, '#ffb4d2');
      shine(c, -1.2, -1.5, 1, 0.3, -0.15);
    },
    strawberry: function (c) {
      var berry = function () {
        c.beginPath();
        c.moveTo(0, -1.8);
        c.bezierCurveTo(2.6, -3, 4, 0, 2, 2.4);
        c.quadraticCurveTo(0.6, 4, 0, 4);
        c.quadraticCurveTo(-0.6, 4, -2, 2.4);
        c.bezierCurveTo(-4, 0, -2.6, -3, 0, -1.8);
        c.closePath();
      };
      cel(c, berry, '#f03a52', { s: 0.9, ink: 0.4 });
      c.fillStyle = '#ffe9a0';
      var sd = [[-1.4, -0.4], [0, 0.2], [1.4, -0.4], [-0.8, 1.4], [0.8, 1.4], [0, 2.6], [-1.9, 0.9], [1.9, 0.9]];
      for (var i = 0; i < sd.length; i++) { ellipsePath(c, sd[i][0], sd[i][1], 0.22, 0.32); c.fill(); }
      shine(c, -1.5, -1.1, 0.7, 0.35, -0.6, 0.7);
      cel(c, function () {
        c.beginPath();
        c.moveTo(0, -1.5);
        c.lineTo(-2.6, -1.4); c.lineTo(-1.2, -2.2); c.lineTo(-1.8, -3.4); c.lineTo(-0.4, -2.6);
        c.lineTo(0, -4); c.lineTo(0.4, -2.6); c.lineTo(1.8, -3.4); c.lineTo(1.2, -2.2); c.lineTo(2.6, -1.4);
        c.closePath();
      }, '#4fb85c', { s: 0.4, ink: 0.35 });
    },
    watermelon: function (c) {
      var wedge = function (r) {
        return function () { c.beginPath(); c.moveTo(-r, -1.6); c.lineTo(r, -1.6); c.arc(0, -1.6, r, 0, PI); c.closePath(); };
      };
      cel(c, wedge(3.9), '#3fa858', { s: 0.6, ink: 0.4 });
      wedge(3.35)();
      c.fillStyle = '#e9f7c8';
      c.fill();
      cel(c, wedge(2.95), '#ff4f6a', { s: 0.8, ink: 0 });
      c.fillStyle = '#3a1c20';
      var sd = [[-1.6, -0.6], [0, -0.3], [1.6, -0.6], [-0.8, 0.6], [0.8, 0.6]];
      for (var i = 0; i < sd.length; i++) {
        c.beginPath(); c.moveTo(sd[i][0], sd[i][1] - 0.35); c.quadraticCurveTo(sd[i][0] + 0.3, sd[i][1] + 0.3, sd[i][0], sd[i][1] + 0.3);
        c.quadraticCurveTo(sd[i][0] - 0.3, sd[i][1] + 0.3, sd[i][0], sd[i][1] - 0.35); c.fill();
      }
      /* rind stripes and a wet sheen */
      c.beginPath();
      for (var k = 0; k < 4; k++) { var a = PI * (0.2 + k * 0.2); c.moveTo(Math.cos(a) * 3.45, -1.6 + Math.sin(a) * 3.45); c.lineTo(Math.cos(a) * 3.85, -1.6 + Math.sin(a) * 3.85); }
      stroke(c, '#1f6a34', 0.4);
      shine(c, -1.4, -1.1, 1.1, 0.22, 0, 0.6);
    },
    shavedIce: function (c) {
      /* a mound of ice soaked in syrup, in a paper cup */
      cel(c, function () {
        c.beginPath();
        c.moveTo(-3, 0.4);
        c.bezierCurveTo(-3.6, -2.2, -1.8, -4.8, 0, -4.8);
        c.bezierCurveTo(1.8, -4.8, 3.6, -2.2, 3, 0.4);
        c.closePath();
      }, '#f2fbff', { s: 0.9, ink: 0.4 });
      c.save();
      c.beginPath();
      c.moveTo(-3, 0.4); c.bezierCurveTo(-3.6, -2.2, -1.8, -4.8, 0, -4.8); c.bezierCurveTo(1.8, -4.8, 3.6, -2.2, 3, 0.4); c.closePath();
      c.clip();
      c.beginPath();
      c.moveTo(-2.6, -2.2);
      c.bezierCurveTo(-1.8, -5.4, 1.8, -5.4, 2.6, -2.2);
      c.quadraticCurveTo(2.2, -0.8, 1.6, -1.8);
      c.quadraticCurveTo(1, 0, 0.3, -1.6);
      c.quadraticCurveTo(-0.6, -0.4, -1.2, -1.8);
      c.quadraticCurveTo(-2, -0.9, -2.6, -2.2);
      c.closePath();
      c.fillStyle = '#ff6a8e';
      c.fill();
      c.restore();
      shine(c, -1, -3.6, 0.7, 0.3, -0.5);
      var cup = function () { c.beginPath(); c.moveTo(-3.1, 0.2); c.lineTo(3.1, 0.2); c.lineTo(2.2, 4.4); c.lineTo(-2.2, 4.4); c.closePath(); };
      cel(c, cup, '#ffffff', { s: 0.7, ink: 0.4 });
      c.save();
      cup();
      c.clip();
      c.beginPath();
      c.moveTo(-3.4, 2.2);
      for (var i = 0; i < 4; i++) c.quadraticCurveTo(-2.55 + i * 1.7, 1 + (i % 2) * 2.4, -1.7 + i * 1.7, 2.2);
      stroke(c, '#4aa8ff', 0.7);
      c.restore();
      /* spoon-straw */
      c.beginPath(); c.moveTo(1.2, -2.4); c.lineTo(2.9, -5.6);
      stroke(c, '#c0283e', 0.75);
      c.beginPath(); c.moveTo(1.2, -2.4); c.lineTo(2.9, -5.6);
      stroke(c, '#ff5a6e', 0.4);
    },
    popsicle: function (c) {
      cel(c, function () { rr(c, -0.55, 1.6, 1.1, 3.2, 0.5); }, '#eac58c', { s: 0.3, ink: 0.35 });
      var bar = function () {
        c.beginPath();
        c.moveTo(-2.4, 2.2);
        c.lineTo(-2.4, -2.4);
        c.bezierCurveTo(-2.4, -5.2, 2.4, -5.2, 2.4, -2.4);
        c.lineTo(2.4, 2.2);
        c.quadraticCurveTo(2.4, 2.6, 2, 2.6); c.lineTo(-2, 2.6); c.quadraticCurveTo(-2.4, 2.6, -2.4, 2.2);
        c.closePath();
      };
      /* a bite out of the corner */
      c.save();
      c.beginPath();
      c.rect(-4, -6, 8, 10);
      c.moveTo(3.75, -4.3);
      c.arc(2.5, -4.3, 1.25, 0, TAU, true);
      c.clip('evenodd');
      cel(c, bar, '#7fe0ff', { s: 0.9, ink: 0.4 });
      c.save();
      bar();
      c.clip();
      /* three flavours, frosty sheen */
      c.fillStyle = '#ff8fb8'; c.fillRect(-3, -5, 6, 2.6);
      c.fillStyle = '#fff6a0'; c.fillRect(-3, -2.4, 6, 2.4);
      c.fillStyle = 'rgba(60, 60, 150, 0.16)'; c.fillRect(1.2, -5, 1.4, 8);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-1.7, -3.6, 0.6, 4.6);
      c.restore();
      bar();
      stroke(c, '#3a7a9a', 0.4);
      c.restore();
      c.beginPath(); c.arc(2.5, -4.3, 1.25, PI * 0.55, PI * 1.0);
      stroke(c, '#3a7a9a', 0.4);
    },
    dango: function (c) {
      c.beginPath(); c.moveTo(0, -4.4); c.lineTo(0, 4.8);
      stroke(c, '#8a5a30', 0.75);
      c.beginPath(); c.moveTo(0, -4.4); c.lineTo(0, 4.8);
      stroke(c, '#e9c48a', 0.4);
      var cols = ['#8fd88a', '#ffffff', '#ff9ec0'];
      for (var i = 0; i < 3; i++) {
        (function (y, col) {
          cel(c, function () { ellipsePath(c, 0, y, 2.2, 2); }, col, { s: 0.8, ink: 0.4 });
          shine(c, -0.8, y - 0.8, 0.6, 0.32, -0.5);
        })(2.2 - i * 3, cols[i]);
      }
    },
    bubbleTea: function (c) {
      /* fat straw, domed lid, milk tea and pearls in a clear cup */
      c.beginPath(); c.moveTo(0.6, -2); c.lineTo(1.5, -5.8);
      stroke(c, '#b8286a', 1.2);
      c.beginPath(); c.moveTo(0.6, -2); c.lineTo(1.5, -5.8);
      stroke(c, '#ff6aa8', 0.75);
      var cup = function () { c.beginPath(); c.moveTo(-2.7, -1.6); c.lineTo(2.7, -1.6); c.lineTo(2, 4.3); c.quadraticCurveTo(0, 4.8, -2, 4.3); c.closePath(); };
      cup();
      c.fillStyle = 'rgba(225, 245, 255, 0.6)';
      c.fill();
      c.save();
      cup();
      c.clip();
      cel(c, function () { c.beginPath(); c.rect(-3, -0.4, 6, 6); }, '#e8bf94', { s: 0.8, ink: 0 });
      c.fillStyle = '#3a2218';
      var pe = [[-1.3, 3.4], [-0.2, 3.7], [1, 3.4], [-0.7, 2.5], [0.5, 2.6], [1.5, 2.4], [-1.6, 2.2]];
      for (var i = 0; i < pe.length; i++) { ellipsePath(c, pe[i][0], pe[i][1], 0.5, 0.5); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(-2, -1.4, 0.6, 5);
      c.restore();
      cup();
      stroke(c, '#5a86b0', 0.35);
      c.beginPath(); c.moveTo(-2.9, -1.6); c.quadraticCurveTo(0, -3.6, 2.9, -1.6); c.closePath();
      c.fillStyle = 'rgba(235, 250, 255, 0.7)';
      c.fill();
      stroke(c, '#5a86b0', 0.35);
      c.beginPath(); c.moveTo(-3, -1.6); c.lineTo(3, -1.6);
      stroke(c, '#5a86b0', 0.5);
    },
  };
  function food(c, P, fx, fy) {
    var fn = FOODS[P.food];
    if (!fn) return;
    c.save();
    c.translate(fx, fy);
    c.scale(0.82, 0.82);
    fn(c);
    c.restore();
  }

  /* ---------- Whole figure ---------- */
  function headSpace(c, P, fn) {
    c.save();
    c.translate(14, 19.6);
    c.rotate(P.headRot);
    /* the big head narrows less than the body through a turn, so it
       reads as turning round instead of a card flipping */
    var ax = Math.abs(P.sx);
    if (ax < 0.8) c.scale(0.8 / ax, 1);
    c.translate(-14, -19.6);
    setLight(P.pitch + P.headRot);
    fn();
    c.restore();
    setLight(P.pitch);
  }

  function backArm(c, P, g) {
    arm(c, P, g);
    var holding = P.food !== 'none';
    hand(c, P, g, holding ? 'fist' : 'open');
    if (holding) food(c, P, g.wx - 0.8, g.wy - 2.4);
  }
  function frontArm(c, P, g) {
    arm(c, P, g);
    if (P.noWand) { hand(c, P, g, 'open'); return; }
    c.save();
    c.translate(g.wx + g.dx * 0.95, g.wy + g.dy * 0.95);
    c.rotate(g.ang);
    wand(c, P);
    c.restore();
    hand(c, P, g, 'fist');
  }

  function drawPose(c, P) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    /* mirror for her facing, buoyant bob, body pitch about her middle,
       squash and stretch along the body */
    c.translate(14, 0);
    c.scale(P.sx, 1);
    c.translate(-14, P.bob);
    c.translate(14, 21);
    c.rotate(P.pitch);
    c.scale(1 - P.sq * 0.5, 1 + P.sq);
    c.translate(-14, -21);
    setLight(P.pitch);
    headSpace(c, P, function () { hairBack(c, P); accBack(c, P); });
    backItem(c, P);
    if (P.noWand) P.armF = { a1: -P.armB.a1, a2: -P.armB.a2 };
    var gB = armGeo(8.8, 21.6, P.armB), gF = armGeo(19.2, 21.6, P.armF);
    backArm(c, P, gB);
    legs(c, P);
    neck(c, P);
    outfit(c, P);
    backFront(c, P);
    necklace(c, P);
    headSpace(c, P, function () { face(c, P); hairFront(c, P); accFront(c, P); });
    frontArm(c, P, gF);
    setLight(0);
  }

  /* motion: { rig } from gameplay, { still: true, noWand, stand } for the option tiles,
     the legacy { t, fwd, vy } for the beach walk, or nothing for the
     menu idle loop. */
  function drawSprite(c, sx, sy, cust, frame, motion) {
    var P = basePose(cust);
    if (motion && motion.rig) rigPose(P, motion.rig);
    else if (motion && motion.still) {
      stillPose(P);
      P.noWand = !!motion.noWand;
      /* feet together on the ground, to show off shoes */
      if (motion.stand) for (var i = 0; i < 2; i++) { P.legs[i].a1 = i ? -0.14 : 0.14; P.legs[i].a2 = 0.06; P.legs[i].f = i ? 0.1 : -0.18; }
    }
    else if (motion) walkPose(P, motion, frame);
    else menuPose(P);
    c.save();
    c.translate(sx, sy);
    drawPose(c, P);
    c.restore();
  }

  /* A back item (kind 'back') or the wand ('wand', along +x from the
     origin) on its own, for the option tiles */
  function drawPart(c, cust, kind) {
    var P = basePose(cust);
    stillPose(P);
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    setLight(0);
    P.solo = true;
    if (kind === 'wand') wand(c, P);
    else { backItem(c, P); backFront(c, P); }
    c.restore();
  }
  function drawFood(c, id, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    food(c, { food: id }, 0, 0);
    c.restore();
  }

  /* Floss dance: hips swing one way, both straight arms the other. Each
     arm swings from its own shoulder like a pendulum: the one crossing
     the body is drawn in front of the chest, the other behind the hips,
     and they trade places as they pass straight down at her sides. */
  function drawFloss(c, sx, sy, cust, phase) {
    var P = basePose(cust);
    var beat = Math.tanh(Math.sin(phase) * 3.2);
    var t = Date.now() * 0.001;
    var hip = beat * 2.5;
    P.t = t;
    P.hm.x = -beat * 1.4; P.ht.x = -beat * 2.6 + Math.sin(phase - 0.8) * 0.6;
    P.ht.y = -Math.abs(beat) * 0.6;
    P.sk.x = -beat * 2;
    P.ch.x = -beat * 2.2; P.cr.x = P.ch.x;
    P.expr = 'happy';
    for (var i = 0; i < 2; i++) { P.legs[i].a1 = -beat * 0.12; P.legs[i].a2 = 0.08; P.legs[i].f = 0.1; }
    var armDir = -beat, chest = hip * 0.45;
    /* the arm crossing the body swings further than the one behind */
    var gL = armGeo(8.8 + chest, 21.6, { a1: -armDir * (1.42 + 0.13 * armDir), a2: 0.1 * armDir });
    var gR = armGeo(19.2 + chest, 21.6, { a1: -armDir * (1.42 - 0.13 * armDir), a2: 0.1 * armDir });
    var front = armDir > 0 ? gL : gR, back = armDir > 0 ? gR : gL;
    c.save();
    c.translate(sx + 14, sy + 22);
    c.rotate(beat * 0.05);
    c.translate(-14, -22);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    setLight(0);
    hairBack(c, P);
    accBack(c, P);
    c.save();
    c.translate(chest, 0);
    backItem(c, P);
    c.restore();
    c.save();
    c.translate(hip, 0);
    legs(c, P);
    c.restore();
    arm(c, P, back);
    hand(c, P, back, 'fist');
    neck(c, P);
    c.save();
    c.translate(chest, 0);
    outfit(c, P);
    backFront(c, P);
    necklace(c, P);
    c.restore();
    face(c, P);
    hairFront(c, P);
    accFront(c, P);
    arm(c, P, front);
    hand(c, P, front, 'fist');
    c.restore();
  }

  /* ---------- Sea friends ----------
     The companion at her heels, shaded like her. Each is painted about
     (0, 0) facing +x, in a box roughly 12 wide and 10 tall with the sea
     floor at y = 4.5; the swimmers hover a little above it. */
  function petEye(c, x, y, r, look) {
    ellipsePath(c, x, y, r, r * 1.08);
    c.fillStyle = '#ffffff';
    c.fill();
    stroke(c, '#2a1430', 0.28);
    ellipsePath(c, x + (look || 0) * r * 0.3, y + r * 0.1, r * 0.55, r * 0.66);
    c.fillStyle = '#24101e';
    c.fill();
    shine(c, x + (look || 0) * r * 0.3 - r * 0.2, y - r * 0.22, r * 0.24, r * 0.24, 0, 0.95);
  }
  function petBlush(c, x, y, r) {
    ellipsePath(c, x, y, r, r * 0.55);
    c.fillStyle = 'rgba(255, 110, 150, 0.5)';
    c.fill();
  }
  var CRAB_COLS = { red: '#e8484c', blue: '#4a86e0', gold: '#ffc83c', pink: '#ff7eb6', hermit: '#f08a4b' };
  function crabLegs(c, body, f, n, x0) {
    /* jointed legs, scuttling in two alternating sets */
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < n; i++) {
        (function (side, i) {
          var st = Math.sin(f * 0.3 + i * 2.1 + (side > 0 ? PI : 0)) * 0.5;
          var bx = x0 + side * (2.2 + i * 1.1), by = 2 - i * 0.3;
          var kx = bx + side * (2 + i * 0.3) + st * 0.5, ky = by + 0.4 - i * 0.5;
          var fx = kx + side * 0.7 + st, fy = 4.5;
          var path = function () { c.beginPath(); c.moveTo(bx, by); c.lineTo(kx, ky); c.lineTo(fx, fy); };
          path();
          stroke(c, tone(body, 'ink'), 1.15);
          path();
          stroke(c, tone(body, 'd1'), 0.6);
        })(side, i);
      }
    }
  }
  function crabClaw(c, body, x, y, side, open, r) {
    c.save();
    c.translate(x, y);
    c.scale(side, 1);
    /* arm, then a pincer whose thumb opens and shuts */
    c.beginPath(); c.moveTo(-r * 1.3, r * 1.1); c.lineTo(0, 0);
    stroke(c, tone(body, 'ink'), r * 0.85);
    c.beginPath(); c.moveTo(-r * 1.3, r * 1.1); c.lineTo(0, 0);
    stroke(c, tone(body, 'd1'), r * 0.5);
    c.rotate(-0.5);
    cel(c, function () {
      c.beginPath();
      c.moveTo(-r * 0.6, r * 0.3);
      c.bezierCurveTo(-r * 0.9, -r * 1.3, r * 1.2, -r * 1.6, r * 1.7, -r * 0.3);
      c.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.4, r * 0.1);
      c.quadraticCurveTo(0, r * 0.7, -r * 0.6, r * 0.3);
      c.closePath();
    }, body, { s: r * 0.3, ink: 0.4 });
    c.rotate(open);
    cel(c, function () {
      c.beginPath();
      c.moveTo(-r * 0.3, r * 0.2);
      c.quadraticCurveTo(r * 0.7, r * 0.1, r * 1.5, r * 0.5);
      c.quadraticCurveTo(r * 0.6, r * 1.1, -r * 0.3, r * 0.8);
      c.closePath();
    }, body, { s: r * 0.25, ink: 0.4 });
    shine(c, r * 0.2, -r * 0.6, r * 0.45, r * 0.18, -0.4, 0.6);
    c.restore();
  }
  function crab(c, variant, f) {
    var body = CRAB_COLS[variant], wob = Math.sin(f * 0.25), bob = Math.abs(Math.sin(f * 0.3)) * 0.35;
    crabLegs(c, body, f, 3, 0);
    crabClaw(c, body, -5.2, -1.2 + wob * 0.5 - bob, -1, 0.25 + 0.25 * wob, 1.5);
    crabClaw(c, body, 5.2, -1.2 - wob * 0.5 - bob, 1, 0.25 - 0.25 * wob, 1.5);
    c.translate(0, -bob);
    /* eye stalks */
    for (var e = -1; e <= 1; e += 2) {
      c.beginPath(); c.moveTo(e * 1.6, -2.2); c.lineTo(e * 1.9, -4);
      stroke(c, tone(body, 'ink'), 1);
      c.beginPath(); c.moveTo(e * 1.6, -2.2); c.lineTo(e * 1.9, -4);
      stroke(c, body, 0.5);
    }
    var shell = function () {
      c.beginPath();
      c.moveTo(-5.2, 0.6);
      c.bezierCurveTo(-5.4, -3.8, 5.4, -3.8, 5.2, 0.6);
      c.bezierCurveTo(5, 3.4, -5, 3.4, -5.2, 0.6);
      c.closePath();
    };
    cel(c, shell, body, { s: 1.1, ink: 0.5, rim: 0.45, x0: -5, x1: 5, y0: -3, y1: 3 });
    c.save();
    shell();
    c.clip();
    /* pale belly plate, bumps across the back */
    ellipsePath(c, 0, 3.4, 3.8, 1.6);
    c.fillStyle = tone(body, 'hi');
    c.globalAlpha = 0.7;
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = tone(body, 'd1');
    var sp = [[-3.2, -1.2, 0.5], [-1.6, -2.2, 0.4], [3.3, -1.1, 0.5], [1.7, -2.2, 0.4], [0, -2.5, 0.35]];
    for (var i = 0; i < sp.length; i++) { ellipsePath(c, sp[i][0], sp[i][1], sp[i][2], sp[i][2] * 0.8); c.fill(); }
    c.restore();
    shine(c, -2.4, -1.9, 1.5, 0.5, -0.3, 0.55);
    petEye(c, -1.9, -4.3, 1.15, 0.5);
    petEye(c, 1.9, -4.3, 1.15, 0.5);
    c.beginPath(); c.moveTo(-0.9, 0.5); c.quadraticCurveTo(0, 1.3, 0.9, 0.5);
    stroke(c, tone(body, 'ink'), 0.35);
    petBlush(c, -3, 0.6, 0.8);
    petBlush(c, 3, 0.6, 0.8);
    if (variant === 'gold') glint(c, 3.4, -2.6, 1.1, 0.5 + 0.5 * Math.sin(f * 0.12));
  }
  function hermit(c, f) {
    var body = CRAB_COLS.hermit, sh = '#f6dfb6', wob = Math.sin(f * 0.25);
    crabLegs(c, body, f, 2, 2);
    /* the borrowed whelk shell: body whorl, spire and a banded lip */
    var whorl = function () {
      c.beginPath();
      c.moveTo(2.6, 1.6);
      c.bezierCurveTo(3, -4.6, -3.4, -6.2, -5.4, -2.6);
      c.lineTo(-6.8, -4);
      c.lineTo(-6.2, -1.4);
      c.bezierCurveTo(-6.4, 2.4, -1, 4.4, 2.6, 1.6);
      c.closePath();
    };
    cel(c, whorl, sh, { s: 1.1, ink: 0.5, rim: 0.45, x0: -6, x1: 3, y0: -5, y1: 3 });
    c.save();
    whorl();
    c.clip();
    c.beginPath();
    c.moveTo(0.6, -4.6); c.quadraticCurveTo(-1.4, -1, 0.4, 3.4);
    c.moveTo(-2.2, -5); c.quadraticCurveTo(-4, -1.6, -2.4, 3.2);
    c.moveTo(-4.6, -3.8); c.quadraticCurveTo(-5.6, -1.4, -4.8, 1.6);
    stroke(c, '#d08a5c', 0.55);
    c.restore();
    shine(c, -0.6, -3.4, 1.3, 0.45, -0.5, 0.7);
    crabClaw(c, body, 5.4, 0.6 - wob * 0.4, 1, 0.25 - 0.25 * wob, 1.25);
    cel(c, function () { ellipsePath(c, 3, 0.8, 2.6, 2.2); }, body, { s: 0.8, ink: 0.45 });
    for (var e = -1; e <= 1; e += 2) {
      c.beginPath(); c.moveTo(3 + e * 0.9, -0.8); c.lineTo(3.2 + e * 1.2, -2.4);
      stroke(c, tone(body, 'ink'), 0.9);
      c.beginPath(); c.moveTo(3 + e * 0.9, -0.8); c.lineTo(3.2 + e * 1.2, -2.4);
      stroke(c, body, 0.45);
    }
    petEye(c, 2, -2.8, 0.95, 0.6);
    petEye(c, 4.5, -2.8, 0.95, 0.6);
    c.beginPath(); c.moveTo(2.6, 1.3); c.quadraticCurveTo(3.3, 1.9, 4, 1.3);
    stroke(c, tone(body, 'ink'), 0.3);
    petBlush(c, 5, 1, 0.6);
  }
  function turtle(c, f) {
    var skin = '#a8e08a', sh = '#4fae6a', pad = Math.sin(f * 0.14);
    /* far flippers, tail */
    cel(c, function () { ellipsePath(c, -3.2, 2.4, 2.2, 0.9, 0.5 - pad * 0.3); }, skin, { s: 0.4, ink: 0.4 });
    cel(c, function () { c.beginPath(); c.moveTo(-4.6, 0.6); c.lineTo(-6.6, 1.4); c.lineTo(-4.4, 1.8); c.closePath(); }, skin, { s: 0.3, ink: 0.4 });
    /* head on a short neck */
    cel(c, function () { rr(c, 2.6, -1.2, 2.6, 2.2, 1); }, skin, { s: 0.5, ink: 0.4 });
    cel(c, function () { ellipsePath(c, 5.6, -1.2, 2.3, 2.1); }, skin, { s: 0.8, ink: 0.45 });
    petEye(c, 6.3, -1.7, 0.85, 0.6);
    c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(6.9, 0.5, 7.6, -0.2);
    stroke(c, '#2c6a34', 0.3);
    petBlush(c, 5.2, -0.3, 0.6);
    var shell = function () {
      c.beginPath();
      c.moveTo(-5, 1.6);
      c.bezierCurveTo(-5.2, -4.4, 4.2, -4.4, 4, 1.6);
      c.quadraticCurveTo(-0.5, 2.8, -5, 1.6);
      c.closePath();
    };
    cel(c, shell, sh, { s: 1.2, ink: 0.5, rim: 0.45, x0: -5, x1: 4, y0: -3, y1: 2 });
    c.save();
    shell();
    c.clip();
    /* scutes */
    c.beginPath();
    c.moveTo(-2.4, -2.6); c.lineTo(-0.6, -3.4); c.lineTo(1.3, -2.6); c.lineTo(1.3, -0.6); c.lineTo(-0.6, 0.3); c.lineTo(-2.4, -0.6); c.closePath();
    c.moveTo(-2.4, -0.6); c.lineTo(-4.6, 0.2); c.moveTo(-2.4, -2.6); c.lineTo(-4, -3.6);
    c.moveTo(1.3, -0.6); c.lineTo(3.4, 0.2); c.moveTo(1.3, -2.6); c.lineTo(2.8, -3.6); c.moveTo(-0.6, 0.3); c.lineTo(-0.6, 2.4);
    stroke(c, tone(sh, 'd2'), 0.35);
    c.restore();
    c.beginPath(); c.moveTo(-5, 1.6); c.quadraticCurveTo(-0.5, 2.8, 4, 1.6);
    stroke(c, '#f1e08a', 0.7);
    shine(c, -2.6, -2.4, 1.2, 0.4, -0.5, 0.6);
    /* near flipper paddles */
    cel(c, function () {
      c.beginPath();
      c.moveTo(1.6, 1.4);
      c.quadraticCurveTo(3.8 + pad * 0.8, 2.6, 3.4 + pad * 1.2, 4.6);
      c.quadraticCurveTo(1.4 + pad * 0.6, 4, 0.6, 1.8);
      c.closePath();
    }, skin, { s: 0.5, ink: 0.4 });
  }
  function octopus(c, f) {
    var col = '#c58cf0';
    /* curling arms */
    for (var i = 0; i < 5; i++) {
      (function (i) {
        var u = i / 4 - 0.5, ph = f * 0.12 + i * 1.3;
        var x0 = u * 6, x1 = u * 10.4 + Math.sin(ph) * 0.7, y1 = 3.4 + Math.cos(ph) * 0.5;
        var path = function () {
          c.beginPath();
          c.moveTo(x0, 0.4);
          c.bezierCurveTo(x0 + u * 1.5, 2.6, x1 - u * 1.5, 3.4, x1, y1);
          c.quadraticCurveTo(x1 + u * 2.6, y1 + 0.4, x1 + u * 2.2, y1 - 1.3);
        };
        path();
        stroke(c, tone(col, 'ink'), 1.9);
        path();
        stroke(c, tone(col, 'd1'), 1.3);
        c.save();
        c.translate(LX * 0.25, LY * 0.25);
        path();
        stroke(c, col, 0.8);
        c.restore();
      })(i);
    }
    var head = function () {
      c.beginPath();
      c.moveTo(-4.2, 0.8);
      c.bezierCurveTo(-5.6, -6.6, 5.6, -6.6, 4.2, 0.8);
      c.quadraticCurveTo(0, 2.6, -4.2, 0.8);
      c.closePath();
    };
    cel(c, head, col, { s: 1.2, ink: 0.5, rim: 0.45, x0: -5, x1: 5, y0: -5, y1: 2 });
    c.fillStyle = tone(col, 'hi');
    ellipsePath(c, 2.4, -3.6, 0.5, 0.4); c.fill();
    ellipsePath(c, 3.2, -2.6, 0.35, 0.3); c.fill();
    shine(c, -2, -3.6, 1.3, 0.6, -0.5, 0.6);
    petEye(c, -1.6, -1, 1.25, 0.4);
    petEye(c, 1.9, -1, 1.25, 0.4);
    ellipsePath(c, 0.15, 0.6, 0.55, 0.45);
    c.fillStyle = '#7a3a9a';
    c.fill();
    petBlush(c, -3.2, 0.2, 0.7);
    petBlush(c, 3.4, 0.2, 0.7);
  }
  function puffer(c, f) {
    var col = '#ffd95a', flap = Math.sin(f * 0.3);
    /* tail and far fin */
    cel(c, function () { c.beginPath(); c.moveTo(-3.6, 0); c.lineTo(-6.6, -1.8); c.quadraticCurveTo(-5.8, 0, -6.6, 1.8); c.closePath(); }, '#ffb04a', { s: 0.4, ink: 0.4 });
    /* spines round the body */
    c.beginPath();
    for (var i = 0; i < 12; i++) {
      var a = i * TAU / 12 + 0.26;
      c.moveTo(Math.cos(a - 0.11) * 4, Math.sin(a - 0.11) * 3.8);
      c.lineTo(Math.cos(a) * 5.3, Math.sin(a) * 5);
      c.lineTo(Math.cos(a + 0.11) * 4, Math.sin(a + 0.11) * 3.8);
    }
    c.fillStyle = tone(col, 'd1');
    c.fill();
    stroke(c, tone(col, 'ink'), 0.35);
    var body = function () { ellipsePath(c, 0, 0, 4.4, 4.2); };
    cel(c, body, col, { s: 1.2, ink: 0.5, rim: 0.45, x0: -4, x1: 4, y0: -4, y1: 4 });
    c.save();
    body();
    c.clip();
    ellipsePath(c, 0.6, 3.6, 4.4, 3);
    c.fillStyle = '#fffbe8';
    c.fill();
    c.fillStyle = tone(col, 'd1');
    var sp = [[-2.2, -2.4], [-0.4, -3.1], [1.4, -2.6], [-3, -0.8]];
    for (var k = 0; k < sp.length; k++) { ellipsePath(c, sp[k][0], sp[k][1], 0.4, 0.32); c.fill(); }
    c.restore();
    shine(c, -1.8, -2.6, 1.3, 0.5, -0.5, 0.6);
    petEye(c, 1.1, -1, 1.15, 0.5);
    petEye(c, 3.4, -0.8, 0.8, 0.5);
    /* puckered lips */
    cel(c, function () { ellipsePath(c, 3.9, 1.1, 0.7, 0.85); }, '#ff8fa6', { s: 0.2, ink: 0.3 });
    petBlush(c, 1.6, 0.9, 0.7);
    cel(c, function () {
      c.beginPath();
      c.moveTo(-0.6, 0.6);
      c.quadraticCurveTo(-2.8, 1 + flap * 0.8, -3, 2.6 + flap * 0.8);
      c.quadraticCurveTo(-1.2, 2.6, -0.2, 1.4);
      c.closePath();
    }, '#ffb04a', { s: 0.3, ink: 0.4 });
  }
  function seahorse(c, f) {
    var col = '#ffb04a', belly = '#ffe7a0', fl = Math.sin(f * 0.5);
    /* fluttering back fin */
    cel(c, function () {
      c.beginPath();
      c.moveTo(-1.6, -1.6);
      c.quadraticCurveTo(-4.2, -2.2 + fl * 0.4, -3.8, 0.2 + fl * 0.4);
      c.quadraticCurveTo(-3, 1.2, -1.6, 0.8);
      c.closePath();
    }, '#ffd95a', { s: 0.4, ink: 0.4 });
    /* curled tail */
    var tail = function () {
      c.beginPath();
      c.moveTo(-0.6, 1);
      c.bezierCurveTo(-0.8, 3.8, 3, 4.6, 2.6, 2.4);
      c.quadraticCurveTo(2.2, 1.4, 1.4, 2.2);
    };
    tail();
    stroke(c, tone(col, 'ink'), 2);
    tail();
    stroke(c, tone(col, 'd1'), 1.4);
    c.save();
    c.translate(LX * 0.25, LY * 0.25);
    tail();
    stroke(c, col, 0.9);
    c.restore();
    var body = function () {
      c.beginPath();
      c.moveTo(-0.4, -4.4);
      c.bezierCurveTo(-3, -3.6, -2.6, 0.6, -1.8, 2);
      c.quadraticCurveTo(-0.6, 3, 0.8, 2);
      c.bezierCurveTo(2.4, 0.4, 1.6, -2.4, 1.2, -4);
      c.closePath();
    };
    cel(c, body, col, { s: 1, ink: 0.5, rim: 0.4, x0: -2.6, x1: 2, y0: -4, y1: 3 });
    c.save();
    body();
    c.clip();
    ellipsePath(c, 1.6, -0.8, 1.7, 3.2);
    c.fillStyle = belly;
    c.fill();
    c.beginPath();
    for (var i = 0; i < 4; i++) { c.moveTo(0.2, -2.4 + i * 1.2); c.quadraticCurveTo(1.2, -2 + i * 1.2, 2, -2.5 + i * 1.2); }
    stroke(c, '#e0a04a', 0.28);
    c.restore();
    /* head, snout, crest */
    cel(c, function () {
      c.beginPath();
      c.moveTo(-0.9, -8.8); c.lineTo(-0.2, -7.6); c.lineTo(0.5, -9.1); c.lineTo(1, -7.5); c.lineTo(1.9, -8.4); c.lineTo(1.8, -6.8); c.lineTo(-1.2, -6.8);
      c.closePath();
    }, '#ffd95a', { s: 0.3, ink: 0.4 });
    cel(c, function () {
      c.beginPath();
      c.moveTo(1.8, -5.6); c.lineTo(5.4, -4.9); c.quadraticCurveTo(5.9, -4.2, 5.3, -3.6); c.lineTo(1.6, -3.7);
      c.closePath();
    }, col, { s: 0.5, ink: 0.45 });
    cel(c, function () { ellipsePath(c, 0.4, -5.3, 2.5, 2.3); }, col, { s: 0.9, ink: 0.5 });
    shine(c, -0.6, -6.4, 0.9, 0.4, -0.5, 0.6);
    petEye(c, 1, -5.5, 1, 0.6);
    petBlush(c, 0.6, -3.9, 0.6);
  }
  var PETS = { hermit: hermit, turtle: turtle, octopus: octopus, puffer: puffer, seahorse: seahorse };
  var HOVER = { turtle: 2.2, octopus: 1.6, puffer: 3.4, seahorse: 1.2 };
  function drawCrab(c, px, py, variant, frame) {
    if (!variant || variant === 'none' || OPTIONS.crab.indexOf(variant) < 0) return;
    var f = frame || 0, hov = HOVER[variant];
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.translate(px, py - (hov ? hov + Math.sin(f * 0.07) * 0.8 : 0));
    if (PETS[variant]) PETS[variant](c, f);
    else crab(c, variant, f);
    c.restore();
  }

  /* ---------- Caustics ----------
     A tileable web of light, painted 'source-atop' over her on an
     isolated layer (the lighting rig's scratch canvas), locked to world
     space so the dapples slide over her as she swims under them. */
  var causTile = null;
  function buildCaustics() {
    var N = 128, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var cx = cv.getContext('2d'), img = cx.createImageData(N, N), d = img.data;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var u = TAU * x / N, v = TAU * y / N;
        var s = Math.sin(3 * u + 1.3 * Math.sin(2 * v + 1)) + Math.sin(3 * v + 1.3 * Math.sin(2 * u + 2)) +
          Math.sin(2 * u + 2 * v + 1.1 * Math.sin(3 * u - v));
        var I = Math.max(0, 1 - Math.abs(s) / 3 * 2.2);
        I = I * I * (3 - 2 * I);
        var k = (y * N + x) * 4;
        d[k] = 255; d[k + 1] = 250; d[k + 2] = 222; d[k + 3] = Math.round(I * 255);
      }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  function caustics(c, wx, wy, w, h, t, a) {
    if (!causTile) causTile = buildCaustics();
    if (!c.__causPat) c.__causPat = c.createPattern(causTile, 'repeat');
    c.save();
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = c.__causPat;
    var layers = [[0.5, 5, 3, a], [0.38, -4, 4.5, a * 0.6]];
    for (var i = 0; i < 2; i++) {
      var s = layers[i][0];
      var ox = (wx + t * layers[i][1]) / s, oy = (wy + t * layers[i][2]) / s;
      var mx = ((ox % 128) + 128) % 128, my = ((oy % 128) + 128) % 128;
      c.save();
      c.globalAlpha = layers[i][3];
      c.scale(s, s);
      c.translate(-mx, -my);
      c.fillRect(mx, my, w / s, h / s);
      c.restore();
    }
    c.restore();
  }

  Game.hero = {
    draw: drawSprite,
    floss: drawFloss,
    crab: drawCrab,
    part: drawPart,
    food: drawFood,
    caustics: caustics,
    Rig: Rig,
    OPTIONS: OPTIONS,
    DEFAULTS: DEFAULTS,
  };
})();
