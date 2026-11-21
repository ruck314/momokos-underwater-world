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
    hairStyle: ['twinTails', 'longBraids', 'buns', 'ponytail', 'longWavy', 'bob'],
    outfit: ['frillyDress', 'sailorDress', 'starDress', 'tutuDress', 'shellDress',
      'sailorSwimsuit', 'onePiece', 'frillyBikini', 'wetsuit', 'rashGuard', 'tshirt'],
    shoes: ['maryJane', 'sneaker', 'flipper', 'monofin', 'sandals'],
    acc: ['tiara', 'flowerCrown', 'bigBow', 'starClips', 'goggles', 'shellNecklace', 'pearlNecklace', 'kittyEars', 'none'],
    food: ['none', 'iceCream', 'onigiri', 'donut', 'crepe', 'taiyaki', 'parfait', 'macaron', 'strawberry'],
    crab: ['none', 'red', 'blue', 'gold', 'pink', 'hermit'],
  };
  var DEFAULTS = {
    hair: '#e06088', suit: '#e06088', skin: '#ffddbb', flipper: '#ff99cc',
    hairStyle: 'twinTails', outfit: 'frillyDress', shoes: 'maryJane', acc: 'tiara', food: 'none', crab: 'none',
  };
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
      hairStyle: opt(cust, 'hairStyle'),
      outfit: opt(cust, 'outfit'),
      shoes: opt(cust, 'shoes'),
      acc: opt(cust, 'acc'),
      food: opt(cust, 'food'),
    };
    var o = P.outfit;
    P.dress = o === 'frillyDress' || o === 'sailorDress' || o === 'starDress' || o === 'tutuDress' || o === 'shellDress';
    P.legCol = P.dress ? '#ffe8ee' : o === 'wetsuit' ? P.suit : o === 'tshirt' ? '#3a2a18' : P.skin;
    P.sleeve = o === 'wetsuit' || o === 'rashGuard' ? 2 : o === 'tshirt' ? 1 : 0;
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
    if (dt > 0) menuRig.step(dt, IDLE);
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
    var path, y1 = 24 + y;
    if (st === 'longWavy') { path = function () { wavyPath(c, P); }; y1 = 34 + y; }
    else if (st === 'bob') { path = function () { bobPath(c, P); }; y1 = 20 + y; }
    else path = function () { backHairPath(c, y); };
    cel(c, path, P.hair, { s: 1.6, ink: 0.55, rim: 0.45, x0: 4, x1: 24, y0: y, y1: y1 });
    /* underside of the back hair sits in the head's shadow */
    c.save();
    path();
    c.clip();
    c.fillStyle = tone(P.hair, 'd2');
    c.globalAlpha = 0.6;
    ellipsePath(c, 14, (st === 'bob' ? 18 : 21) + y, 9, 4.5);
    c.fill();
    if (st === 'longWavy') {
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
    bangsPath(c, y);
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
    cel(c, function () { bangsPath(c, y); }, hair, { s: 1.4, ink: 0.55 });
    c.restore();
    /* strand lines up from each notch */
    c.beginPath();
    var notches = [[6.8, 8.6], [10.4, 8.3], [14.2, 7.9], [17.8, 8.2], [21.2, 8.4]];
    for (var n = 0; n < notches.length; n++) {
      var nx = notches[n][0], ny = notches[n][1] + y;
      c.moveTo(nx, ny);
      c.quadraticCurveTo(nx + (14 - nx) * 0.15, ny - 2.4, nx + (14 - nx) * 0.35, ny - 4.6);
    }
    stroke(c, tone(hair, 'ink'), 0.32);
    var len = P.hairStyle === 'bob' ? -1.4 : P.hairStyle === 'longWavy' ? 2.4 : 0;
    sideLock(c, P, -1, len);
    sideLock(c, P, 1, len);
    /* angel-ring gloss: broken strokes around the crown */
    c.save();
    bangsPath(c, y);
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
    }
  }

  function tiara(c, y) {
    c.lineCap = 'round';
    c.beginPath();
    c.arc(14, 8.2 + y, 6.5, Math.PI + 0.55, -0.55);
    stroke(c, '#8a5a12', 1.9);
    c.beginPath();
    c.arc(14, 8.2 + y, 6.5, Math.PI + 0.55, -0.55);
    stroke(c, '#ffc93a', 1.25);
    c.beginPath();
    c.arc(14, 8.0 + y, 6.65, Math.PI + 0.75, -1.9);
    stroke(c, '#fff3b0', 0.45);
    gem(c, 9.3, 4.9 + y, 0.75, '#ff9ad0');
    gem(c, 18.7, 4.9 + y, 0.75, '#9adcff');
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
    ellipsePath(c, px - 1, py - 0.6, 0.5, 0.4);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
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
  var BOW = '#ff4f8b';
  /* Behind the hair: streamers and bow tails */
  function accBack(c, P) {
    var y = P.headY;
    if (P.acc === 'flowerCrown') {
      streamer(c, P, 4.6, 8 + y, 11, '#ffffff', 0);
      streamer(c, P, 5.8, 8.6 + y, 9, '#ffb3d1', 1.7);
    } else if (P.acc === 'bigBow') {
      streamer(c, P, 7.6, 2.6 + y, 8, BOW, 0.5);
      streamer(c, P, 9.6, 2.8 + y, 6.5, BOW, 2.2);
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
  function accFront(c, P) {
    var y = P.headY, a = P.acc;
    if (a === 'tiara') tiara(c, y);
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
      var bx = 8.4, by = 1.6 + y;
      c.save();
      c.translate(bx, by);
      c.rotate(-0.35);
      var loop = function (dir) {
        return function () {
          c.beginPath();
          c.moveTo(0, 0);
          c.bezierCurveTo(dir * 1.6, -4, dir * 5, -3.4, dir * 4.6, 0);
          c.bezierCurveTo(dir * 5, 3.2, dir * 1.6, 3.4, 0, 0);
          c.closePath();
        };
      };
      cel(c, loop(-1), BOW, { s: 1, ink: 0.5 });
      cel(c, loop(1), BOW, { s: 1, ink: 0.5 });
      c.fillStyle = 'rgba(255,255,255,0.9)';
      var dots = [[-3, -1.2], [-2.2, 1], [3, -1.2], [2.2, 1], [-3.8, 0.2], [3.8, 0.2]];
      for (var d = 0; d < dots.length; d++) { ellipsePath(c, dots[d][0], dots[d][1], 0.38, 0.38); c.fill(); }
      cel(c, function () { ellipsePath(c, 0, 0, 1.2, 1.4); }, tone(BOW, 'd1'), { s: 0.4, ink: 0.4 });
      c.restore();
    } else if (a === 'starClips') {
      var st = [[19.6, 5.2, 1.7, 0.2], [22, 8, 1.25, -0.3], [7.2, 6, 1.35, 0.1]];
      for (var s = 0; s < st.length; s++) {
        (function (x, yy, r, rot) {
          c.save();
          c.translate(x, yy + y);
          c.rotate(rot);
          cel(c, function () { starPath(c, 0, 0, r, 0.48); }, '#ffcf3a', { s: 0.5, ink: 0.35 });
          ellipsePath(c, -r * 0.25, -r * 0.3, r * 0.22, r * 0.15, -0.5);
          c.fillStyle = 'rgba(255,255,255,0.9)';
          c.fill();
          c.restore();
        })(st[s][0], st[s][1], st[s][2], st[s][3]);
      }
    } else if (a === 'goggles') {
      c.beginPath();
      c.ellipse(14, 8.6 + y, 10.5, 5.8, 0, PI + 0.12, TAU - 0.12);
      stroke(c, '#174a63', 1.7);
      c.beginPath();
      c.ellipse(14, 8.4 + y, 10.5, 5.8, 0, PI + 0.3, TAU - 0.3);
      stroke(c, '#3f8fb4', 0.6);
      c.beginPath(); c.moveTo(12, 4.4 + y); c.quadraticCurveTo(14, 3.6 + y, 16, 4.4 + y);
      stroke(c, '#1f6f95', 0.9);
      for (var e = -1; e <= 1; e += 2) {
        (function (gx, gy) {
          cel(c, function () { ellipsePath(c, gx, gy, 2.7, 2.4); }, '#33a6dc', { s: 0.6, ink: 0.45 });
          ellipsePath(c, gx, gy, 1.85, 1.6);
          var lg = c.createLinearGradient(0, gy - 1.6, 0, gy + 1.6);
          lg.addColorStop(0, '#d6fbff');
          lg.addColorStop(0.5, '#56cfe8');
          lg.addColorStop(1, '#13708f');
          c.fillStyle = lg;
          c.fill();
          stroke(c, '#0d4a66', 0.3);
          c.beginPath(); c.moveTo(gx - 1, gy - 0.2); c.lineTo(gx - 0.1, gy - 1.1);
          stroke(c, 'rgba(255,255,255,0.95)', 0.45);
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
        c.fillStyle = '#ffb3cb';
        c.fill();
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
    }
  }
  /* Necklaces sit on the outfit; the pendant swings on the charm spring */
  function necklace(c, P) {
    var a = P.acc;
    if (a !== 'shellNecklace' && a !== 'pearlNecklace') return;
    var px = 14 + clamp(P.cr.x * 0.35, -1.2, 1.2), py = 24.1 + clamp(P.cr.y * 0.2, -0.6, 0.4);
    var rot = Math.atan2(px - 14, 1.6);
    if (a === 'shellNecklace') {
      c.beginPath();
      c.moveTo(10.8, 20.3);
      c.quadraticCurveTo(14, 24, 17.2, 20.3);
      stroke(c, '#6a3c24', 0.4);
      gem(c, 11.9, 21.7, 0.45, '#5fd3c4');
      gem(c, 16.1, 21.7, 0.45, '#5fd3c4');
      c.beginPath(); c.moveTo(14, 22.3); c.lineTo(px, py - 0.9);
      stroke(c, '#6a3c24', 0.35);
      c.save();
      c.translate(px, py);
      c.rotate(-rot);
      cel(c, function () {
        c.beginPath();
        c.moveTo(0, -1);
        c.arc(0, -1, 2.3, PI * 0.2, PI * 0.8);
        c.closePath();
      }, '#ffc6d6', { s: 0.6, ink: 0.35 });
      c.beginPath();
      for (var r = 0; r < 5; r++) {
        var ra = PI * (0.28 + r * 0.11);
        c.moveTo(0, -0.8); c.lineTo(Math.cos(ra) * 2, -1 + Math.sin(ra) * 2);
      }
      stroke(c, tone('#ffc6d6', 'd2'), 0.22);
      c.fillStyle = '#f7a8be';
      c.fillRect(-0.6, -1.3, 1.2, 0.6);
      c.restore();
    } else {
      for (var i = 0; i <= 8; i++) {
        var u = i / 8, x = lerp(lerp(10.6, 14, u), lerp(14, 17.4, u), u), yy = lerp(lerp(20.3, 23.4, u), lerp(23.4, 20.3, u), u);
        gem(c, x, yy, 0.52, '#f4eef6');
      }
      c.beginPath(); c.moveTo(14, 21.9); c.lineTo(px, py - 0.6);
      stroke(c, '#c8b9c8', 0.3);
      gem(c, px, py, 0.85, '#ffe6f0');
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
      if (!P.mono) {
        c.save();
        c.translate(g.ax, g.ay);
        c.rotate(g.b + g.f);
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
    if (P.shoes === 'sandals') {
      /* bare foot in a clear jelly sandal */
      cel(c, path, P.skin, { warm: true, s: 0.75, ink: 0.4 });
      c.beginPath(); c.moveTo(x + 1.6, y - 0.4); c.lineTo(x + 1.7, y + 0.6);
      c.moveTo(x + 2.3, y - 0.2); c.lineTo(x + 2.4, y + 0.7);
      stroke(c, tone(P.skin, 'd2', true), 0.2);
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
      /* mary-jane strap and button */
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

  function scallop(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    cel(c, function () {
      c.beginPath();
      c.moveTo(0, r * 0.9);
      c.arc(0, r * 0.9, r * 1.6, -PI * 0.8, -PI * 0.2);
      c.closePath();
    }, '#ffe2ea', { s: 0.4, ink: 0.3 });
    c.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = -PI * (0.72 - i * 0.13);
      c.moveTo(0, r * 0.7); c.lineTo(Math.cos(a) * r * 1.4, r * 0.9 + Math.sin(a) * r * 1.4);
    }
    stroke(c, '#e79ab0', 0.2);
    c.restore();
  }

  function outfit(c, P) {
    var col = P.suit, o = P.outfit, skin = P.skin;
    var ink = tone(col, 'ink');
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
     Drawn along +x from the fist at the origin. */
  function wand(c, P) {
    var t = P.t;
    /* gold shaft with a sheen */
    c.beginPath(); c.moveTo(3.2, -0.1); c.lineTo(9, -0.1);
    stroke(c, '#8a5a12', 1.7);
    c.beginPath(); c.moveTo(3.2, -0.1); c.lineTo(9, -0.1);
    stroke(c, '#ffc93a', 1.1);
    c.beginPath(); c.moveTo(3.6, -0.4); c.lineTo(8.6, -0.4);
    stroke(c, '#fff3b0', 0.35);
    /* handle */
    cel(c, function () { capsule(c, -0.8, -0.1, 1.6, 3.4, -0.1, 1.4); }, '#ff99cc', { s: 0.8, ink: 0.45 });
    c.fillStyle = '#ffd24a';
    c.fillRect(3, -1.4, 1.1, 2.6);
    heartPath(c, 1.8, -0.1, 0.6);
    c.fillStyle = '#ff3366';
    c.fill();
    /* star gem, twinkling */
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
    /* sparkles orbiting the tip */
    c.fillStyle = '#ffffff';
    for (var s = 0; s < 3; s++) {
      var a = Math.sin(t * 4 + s * 2.1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      var px = sx + Math.cos(s * 2.3 + 0.6) * 3.4, py = sy + Math.sin(s * 2.3 + 0.6) * 2.6;
      starPath(c, px, py, 0.7 * a, 0.3);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ---------- Held food (back hand) ---------- */
  function food(c, P, fx, fy) {
    var f = P.food;
    if (f === 'iceCream') {
      c.fillStyle = '#e0b070';
      c.beginPath(); c.moveTo(fx - 1.5, fy + 2); c.lineTo(fx + 1.5, fy + 2); c.lineTo(fx, fy + 6); c.closePath(); c.fill();
      stroke(c, '#8a5a30', 0.35);
      c.beginPath(); c.moveTo(fx - 1, fy + 2.5); c.lineTo(fx + 0.8, fy + 5); stroke(c, '#9a7048', 0.4);
      cel(c, function () { ellipsePath(c, fx, fy + 1, 2.2, 2.1); }, '#ffc8d4', { s: 0.7, ink: 0.35 });
      gem(c, fx, fy - 1.3, 0.7, '#ff3355');
    } else if (f === 'onigiri') {
      cel(c, function () { c.beginPath(); c.moveTo(fx, fy - 1.6); c.quadraticCurveTo(fx - 3, fy + 2.8, fx, fy + 2.6); c.quadraticCurveTo(fx + 3, fy + 2.8, fx, fy - 1.6); c.closePath(); }, '#ffffff', { s: 0.7, ink: 0.35 });
      c.fillStyle = '#2a3a2a';
      c.fillRect(fx - 1.6, fy + 1, 3.2, 1.6);
    } else if (f === 'donut') {
      cel(c, function () { ellipsePath(c, fx, fy + 1, 2.3, 2.3); }, '#c88858', { s: 0.6, ink: 0.35 });
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.arc(fx, fy + 1, 2.1, Math.PI + 0.3, -0.3, false); c.fill();
      c.fillStyle = '#ffe4b0';
      c.beginPath(); c.arc(fx, fy + 1, 0.75, 0, TAU); c.fill();
      c.fillStyle = '#ffff66'; c.fillRect(fx - 1, fy - 0.2, 0.4, 0.4);
      c.fillStyle = '#66ddff'; c.fillRect(fx + 0.8, fy, 0.4, 0.4);
      c.fillStyle = '#ff66aa'; c.fillRect(fx - 0.2, fy + 0.5, 0.4, 0.4);
    } else if (f === 'crepe') {
      c.fillStyle = '#f2d8a4';
      c.beginPath(); c.moveTo(fx - 2, fy - 2); c.lineTo(fx + 2, fy - 2); c.lineTo(fx, fy + 4); c.closePath(); c.fill();
      stroke(c, '#9a7040', 0.35);
      c.fillStyle = '#ffdceb';
      c.beginPath(); c.arc(fx, fy - 1.8, 1.4, Math.PI, 0); c.fill();
      gem(c, fx - 0.6, fy - 2.2, 0.55, '#dd3355');
    } else if (f === 'taiyaki') {
      cel(c, function () {
        c.beginPath(); c.ellipse(fx, fy + 1, 3, 1.8, 0, 0, TAU);
        c.moveTo(fx + 2.5, fy + 1); c.lineTo(fx + 4, fy - 0.5); c.lineTo(fx + 4, fy + 2.5); c.closePath();
      }, '#cc8844', { s: 0.6, ink: 0.35 });
      c.fillStyle = '#1a0c14';
      c.beginPath(); c.arc(fx - 1.8, fy + 0.5, 0.3, 0, TAU); c.fill();
    } else if (f === 'parfait') {
      c.fillStyle = '#6b3a1a'; c.fillRect(fx - 1.4, fy + 2, 2.8, 1.3);
      c.fillStyle = '#fff4dc'; c.fillRect(fx - 1.4, fy + 0.7, 2.8, 1.3);
      c.fillStyle = '#ff6688'; c.fillRect(fx - 1.4, fy - 0.6, 2.8, 1.3);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.4; c.strokeRect(fx - 1.6, fy - 1.5, 3.2, 5);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(fx, fy - 1.8, 1.3, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(fx - 0.5, fy - 2.3, 0.7, Math.PI, 0); c.fill();
      gem(c, fx + 0.6, fy - 2.9, 0.5, '#dd2244');
    } else if (f === 'macaron') {
      cel(c, function () { ellipsePath(c, fx, fy - 0.8, 2.4, 1.1); }, '#ffbadb', { s: 0.4, ink: 0.3 });
      c.fillStyle = '#ffffff'; c.fillRect(fx - 2.3, fy - 0.1, 4.6, 0.9);
      cel(c, function () { ellipsePath(c, fx, fy + 1.3, 2.4, 1.1); }, '#ff9ac2', { s: 0.4, ink: 0.3 });
    } else if (f === 'strawberry') {
      cel(c, function () { c.beginPath(); c.moveTo(fx - 2, fy - 1); c.quadraticCurveTo(fx, fy + 4, fx + 2, fy - 1); c.closePath(); }, '#e8344a', { s: 0.6, ink: 0.35 });
      c.fillStyle = '#fff4a8';
      var seeds = [[-0.8, 0.5], [0.6, 0.3], [0, 1.6], [-1.1, 1.9]];
      for (var i = 0; i < seeds.length; i++) { c.beginPath(); c.arc(fx + seeds[i][0], fy + seeds[i][1], 0.25, 0, TAU); c.fill(); }
      c.fillStyle = '#3caf3c';
      c.beginPath(); c.moveTo(fx - 2.2, fy - 1); c.lineTo(fx - 0.6, fy - 1.8); c.lineTo(fx + 0.6, fy - 1.8); c.lineTo(fx + 2.2, fy - 1); c.lineTo(fx, fy - 0.2); c.closePath(); c.fill();
    }
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
    if (P.noWand) P.armF = { a1: -P.armB.a1, a2: -P.armB.a2 };
    var gB = armGeo(8.8, 21.6, P.armB), gF = armGeo(19.2, 21.6, P.armF);
    backArm(c, P, gB);
    legs(c, P);
    neck(c, P);
    outfit(c, P);
    necklace(c, P);
    headSpace(c, P, function () { face(c, P); hairFront(c, P); accFront(c, P); });
    frontArm(c, P, gF);
    setLight(0);
  }

  /* motion: { rig } from gameplay, { still: true } for the option tiles,
     the legacy { t, fwd, vy } for the beach walk, or nothing for the
     menu idle loop. */
  function drawSprite(c, sx, sy, cust, frame, motion) {
    var P = basePose(cust);
    if (motion && motion.rig) rigPose(P, motion.rig);
    else if (motion && motion.still) { stillPose(P); P.noWand = !!motion.noWand; }
    else if (motion) walkPose(P, motion, frame);
    else menuPose(P);
    c.save();
    c.translate(sx, sy);
    drawPose(c, P);
    c.restore();
  }

  /* A crop of the still pose, fitted into a destination box (tiles) */
  function portrait(c, cust, rx, ry, rw, rh, dx, dy, dw, dh, noWand) {
    var s = Math.min(dw / rw, dh / rh);
    c.save();
    c.translate(dx + dw / 2, dy + dh / 2);
    c.scale(s, s);
    c.translate(-(rx + rw / 2), -(ry + rh / 2));
    drawSprite(c, 0, 0, cust, 0, { still: true, noWand: noWand });
    c.restore();
  }
  function drawFood(c, id, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    food(c, { food: id }, 0, -1.4);
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
    c.translate(hip, 0);
    legs(c, P);
    c.restore();
    arm(c, P, back);
    hand(c, P, back, 'fist');
    neck(c, P);
    c.save();
    c.translate(chest, 0);
    outfit(c, P);
    necklace(c, P);
    c.restore();
    face(c, P);
    hairFront(c, P);
    accFront(c, P);
    arm(c, P, front);
    hand(c, P, front, 'fist');
    c.restore();
  }

  /* Crab companion, shaded like her */
  function drawCrab(c, px, py, variant, frame) {
    if (!variant || variant === 'none' || OPTIONS.crab.indexOf(variant) < 0) return;
    var body = variant === 'blue' ? '#4a80d8' : variant === 'gold' ? '#ffcc44' : variant === 'pink' ? '#ff7eb6' :
      variant === 'hermit' ? '#f08a4b' : '#e04848';
    var wob = Math.sin((frame || 0) * 0.25) * 0.8;
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (variant === 'hermit') {
      /* spiral shell on her back */
      cel(c, function () { ellipsePath(c, px - 1.2, py - 2.6, 4.4, 3.8, -0.3); }, '#f3dcb4',
        { s: 0.8, ink: 0.45, rim: 0.4, x0: px - 5, x1: px + 3, y0: py - 6, y1: py + 1 });
      c.beginPath();
      c.arc(px - 1.2, py - 2.6, 2.6, 0.2, PI * 1.6);
      c.arc(px - 1.6, py - 2.8, 1.3, PI * 1.6, PI * 3.1);
      stroke(c, '#b07a50', 0.45);
      c.beginPath(); c.arc(px - 2, py - 4, 1.4, PI * 1.1, PI * 1.7);
      stroke(c, 'rgba(255,255,255,0.8)', 0.5);
    }
    c.beginPath();
    c.moveTo(px - 3, py + 2); c.lineTo(px - 4.3, py + 3.9);
    c.moveTo(px + 3, py + 2); c.lineTo(px + 4.3, py + 3.9);
    c.moveTo(px - 1.5, py + 2.8); c.lineTo(px - 2.1, py + 4.5);
    c.moveTo(px + 1.5, py + 2.8); c.lineTo(px + 2.1, py + 4.5);
    stroke(c, tone(body, 'd2'), 0.75);
    cel(c, function () { ellipsePath(c, px - 5, py - 1 + wob, 1.9, 1.7); }, body, { s: 0.6, ink: 0.4 });
    cel(c, function () { ellipsePath(c, px + 5, py - 1 - wob, 1.9, 1.7); }, body, { s: 0.6, ink: 0.4 });
    if (variant === 'hermit') {
      cel(c, function () { ellipsePath(c, px + 1.4, py + 0.4, 3.4, 2.6); }, body, { s: 0.8, ink: 0.45 });
    } else {
      cel(c, function () { ellipsePath(c, px, py, 5, 3.4); }, body, { s: 1, ink: 0.5, rim: 0.4, x0: px - 5, x1: px + 5, y0: py - 3, y1: py + 3 });
      ellipsePath(c, px - 1.4, py - 1.2, 1.7, 0.7);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fill();
    }
    var ex0 = variant === 'hermit' ? px + 1.4 : px;
    for (var e = -1; e <= 1; e += 2) {
      ellipsePath(c, ex0 + e * 1.5, py - 2.8, 0.95, 0.95);
      c.fillStyle = '#ffffff';
      c.fill();
      stroke(c, tone(body, 'ink'), 0.3);
      ellipsePath(c, ex0 + e * 1.5 + 0.2, py - 2.7, 0.42, 0.48);
      c.fillStyle = '#1a0c14';
      c.fill();
    }
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
    portrait: portrait,
    food: drawFood,
    caustics: caustics,
    Rig: Rig,
    OPTIONS: OPTIONS,
    DEFAULTS: DEFAULTS,
  };
})();
