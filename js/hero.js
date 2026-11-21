/* hero.js – Momoko, painted as a lit, cel-shaded character.

   One painter serves every place she appears (gameplay, the customize
   preview, title, intro, beach and the floss dance), always in the same
   28 x 34 sprite box so the callers keep their own placement and scale.

   The look is built the way a 2D game character is inked and coloured:
   every shape is filled in its deep shadow tone, then its own outline,
   nudged toward the light, lays the mid band and the lit body over it,
   so each part gets a hard two-step terminator on its shadow side. The
   key comes from the surface (above, a little in front of her), shadows
   on cloth and hair cool toward the deep water, skin shadows stay warm,
   and a sliver of cool light bounces up along the lower back edges.
   Outlines take the hue of what they surround instead of black.

   Everything is vector, drawn live: hair, ribbons and skirt sway, she
   breathes and blinks, and her legs flutter faster the harder she swims.
   motion = { t: seconds, fwd: forward speed, vy: vertical speed } comes
   from gameplay; menus leave it out and get an idle loop. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var TAU = Math.PI * 2;

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
  var LX = 0.38, LY = -1; /* step toward the key light, sprite space */

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

  /* ---------- Pose ---------- */
  /* Everything the parts need from the clock and the motion, worked out
     once per draw. */
  function pose(cust, frame, motion) {
    var m = motion || {};
    var t = m.t !== undefined ? m.t : Date.now() * 0.001;
    var fwd = m.fwd || 0, vy = m.vy || 0;
    var speed = Math.min(3.2, Math.sqrt(fwd * fwd + vy * vy));
    var p = {
      t: t,
      fwd: fwd,
      vy: vy,
      breathe: Math.sin(t * 2.2),
      /* Flutter kick: faster and wider while swimming hard */
      kick: Math.sin(t * (4.2 + speed * 2.2) + (frame || 0) * 0.3) * (0.7 + speed * 0.42),
      /* Hair trails behind her and floats up as she sinks */
      swX: Math.sin(t * 2.3) * 0.7 - Math.max(-1.6, Math.min(1.6, fwd * 0.6)),
      swY: Math.max(-1.6, Math.min(1.6, -vy * 0.7)) + Math.sin(t * 1.7 + 1) * 0.35,
      blink: (t % 3.7) < 0.13,
      hair: (cust && cust.hair) || '#e06088',
      suit: (cust && cust.suit) || '#e06088',
      skin: (cust && cust.skin) || '#ffddbb',
      shoe: (cust && cust.flipper) || '#ff99cc',
      hairStyle: (cust && cust.hairStyle) || 'twinTails',
      outfit: (cust && cust.outfit) || 'frillyDress',
      shoes: (cust && cust.shoes) || 'maryJane',
      food: (cust && cust.food) || 'none',
    };
    p.headY = p.breathe * 0.22;
    p.dress = p.outfit === 'frillyDress' || p.outfit === 'sailorDress' || p.outfit === 'starDress';
    return p;
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

  /* One twin tail. side -1 left, +1 right; the sway is in sprite space
     (both tails stream the same way). Two locks: the main one and a
     slimmer one curling off it. */
  function twinTail(c, P, side) {
    var y = P.headY;
    var X = function (v) { return 14 + side * v; };
    var sx = P.swX, sy = P.swY;
    var main = function () {
      c.beginPath();
      c.moveTo(X(10.2), 8.6 + y);
      c.bezierCurveTo(X(16.6), 12 + y, X(17.6) + sx * 0.5, 21 + y + sy * 0.4, X(14.4) + sx, 30.2 + y + sy);
      c.quadraticCurveTo(X(13.2) + sx, 31 + y + sy, X(12.6) + sx * 0.9, 29.2 + y + sy * 0.9);
      c.bezierCurveTo(X(14.2) + sx * 0.7, 23.4 + y + sy * 0.6, X(12.6), 16 + y, X(8.4), 11.6 + y);
      c.closePath();
    };
    var lock = function () {
      c.beginPath();
      c.moveTo(X(10.6), 11 + y);
      c.bezierCurveTo(X(13.2), 15 + y, X(12.6) + sx * 0.5, 21 + y + sy * 0.5, X(11.2) + sx * 0.8, 25.6 + y + sy * 0.8);
      c.quadraticCurveTo(X(10.8) + sx * 0.8, 23 + y + sy * 0.6, X(11.4), 17.5 + y);
      c.closePath();
    };
    var o = { s: 1.5, ink: 0.55, rim: 0.55, x0: X(17) , x1: X(9), y0: 9 + y, y1: 31 + y };
    if (side > 0) { o.x0 = X(9); o.x1 = X(17); }
    cel(c, main, P.hair, o);
    cel(c, lock, P.hair, { s: 1, ink: 0.45 });
    /* strand line and a sheen down the outer curve */
    c.beginPath();
    c.moveTo(X(11.6), 12 + y);
    c.bezierCurveTo(X(15), 16 + y, X(15.4) + sx * 0.5, 23 + y + sy * 0.5, X(13.8) + sx * 0.9, 28.4 + y + sy * 0.9);
    stroke(c, tone(P.hair, 'ink'), 0.35);
    c.beginPath();
    c.moveTo(X(13.4), 12.6 + y);
    c.quadraticCurveTo(X(16.4), 16 + y, X(16.2) + sx * 0.3, 20 + y + sy * 0.3);
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
      var k = b / 5;
      var bx = 14 + side * 11.6 + (b % 2 ? 0.7 : -0.7) * side + P.swX * k * k * 1.1;
      var by = 10.4 + b * 3.7 + y + P.swY * k * k;
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
    var tx = 14 + side * 11.6 + P.swX * 1.15, ty = 31.6 + y + P.swY;
    /* tuft below the tie */
    cel(c, function () {
      c.beginPath();
      c.moveTo(tx - 1.3, ty);
      c.quadraticCurveTo(tx - 1.8, ty + 2.6, tx - 0.4 + P.swX * 0.2, ty + 3.4);
      c.quadraticCurveTo(tx + 0.3, ty + 2, tx + 1.4, ty + 3);
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
    var y = P.headY, sx = P.swX, sy = P.swY;
    var X = function (v) { return 14 + side * v; };
    cel(c, function () {
      c.beginPath();
      c.moveTo(X(10.4), 5.6 + y);
      c.quadraticCurveTo(X(14.6) + sx * 0.4, 14 + y + sy * 0.3, X(12.6) + sx, 24.4 + y + sy);
      c.lineTo(X(11.4) + sx, 22.6 + y + sy);
      c.lineTo(X(10.2) + sx * 0.95, 24.2 + y + sy);
      c.quadraticCurveTo(X(11.4) + sx * 0.3, 14 + y + sy * 0.3, X(7.6), 6.4 + y);
      c.closePath();
    }, P.suit, { s: 1, ink: 0.45, rim: 0.35, x0: X(13), x1: X(8), y0: 6, y1: 24 });
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
  function sideLock(c, P, side) {
    var y = P.headY, X = function (v) { return 14 + side * v; };
    var sw = P.swX * 0.25;
    cel(c, function () {
      c.beginPath();
      c.moveTo(X(9.8), 6.4 + y);
      c.bezierCurveTo(X(10.4), 11 + y, X(9.8) + sw, 15.6 + y, X(8.6) + sw, 19.6 + y);
      c.quadraticCurveTo(X(8.2) + sw, 17 + y, X(7.4), 14.4 + y);
      c.quadraticCurveTo(X(7.4), 10.2 + y, X(8), 7.6 + y);
      c.closePath();
    }, P.hair, { s: 0.9, ink: 0.45 });
  }

  function hairBack(c, P) {
    var y = P.headY;
    if (P.hairStyle === 'twinTails') { twinTail(c, P, -1); twinTail(c, P, 1); }
    else if (P.hairStyle === 'longBraids') { braid(c, P, -1); braid(c, P, 1); }
    else if (P.hairStyle === 'buns') { bunRibbon(c, P, -1); bunRibbon(c, P, 1); }
    cel(c, function () { backHairPath(c, y); }, P.hair,
      { s: 1.6, ink: 0.55, rim: 0.45, x0: 4, x1: 24, y0: y, y1: 24 + y });
    /* underside of the back hair sits in the head's shadow */
    c.save();
    backHairPath(c, y);
    c.clip();
    c.fillStyle = tone(P.hair, 'd2');
    c.globalAlpha = 0.6;
    ellipsePath(c, 14, 21 + y, 9, 4.5);
    c.fill();
    c.restore();
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

  function eye(c, P, x, y, side) {
    if (P.blink) {
      c.beginPath();
      c.moveTo(x - 2.5, y + 0.4);
      c.quadraticCurveTo(x, y + 1.9, x + 2.5, y + 0.4);
      stroke(c, '#2a1222', 0.75);
      return;
    }
    /* sclera, shadowed under the lid */
    ellipsePath(c, x, y, 2.75, 3.2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.save();
    ellipsePath(c, x, y, 2.75, 3.2);
    c.clip();
    c.fillStyle = 'rgba(120, 128, 200, 0.4)';
    ellipsePath(c, x, y - 3, 3.6, 2.2);
    c.fill();
    /* iris: dark wine at the top glowing to rose at the bottom */
    var g = c.createLinearGradient(0, y - 2.9, 0, y + 3);
    g.addColorStop(0, '#2c0f22');
    g.addColorStop(0.45, '#7a3550');
    g.addColorStop(1, '#f08aa6');
    ellipsePath(c, x + 0.2, y + 0.35, 2.25, 2.85);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#2a0c1e';
    c.lineWidth = 0.35;
    c.stroke();
    /* pupil */
    ellipsePath(c, x + 0.2, y + 0.5, 0.95, 1.35);
    c.fillStyle = '#1a0812';
    c.fill();
    /* lower-iris glow ring */
    c.beginPath();
    c.ellipse(x + 0.2, y + 0.6, 1.6, 1.9, 0, 0.3, Math.PI - 0.3);
    c.strokeStyle = 'rgba(255, 196, 214, 0.75)';
    c.lineWidth = 0.4;
    c.stroke();
    c.restore();
    /* catchlights: her star, a round one, a fleck */
    c.fillStyle = '#ffffff';
    starPath(c, x + 0.8, y - 1, 1.25);
    c.fill();
    ellipsePath(c, x - 0.9, y + 1.5, 0.55, 0.5);
    c.fill();
    ellipsePath(c, x + 1.3, y + 1.3, 0.25, 0.25);
    c.fill();
    /* upper lash line: heavy, thinning to the inside, with an outer flick */
    var o = side; /* outer corner direction: the left eye's is -x */
    c.beginPath();
    c.moveTo(x - o * 2.4, y - 2.1);
    c.quadraticCurveTo(x, y - 4.2, x + o * 2.8, y - 2);
    c.lineTo(x + o * 3.8, y - 3.1);
    c.lineTo(x + o * 3.1, y - 1.3);
    c.quadraticCurveTo(x, y - 3.4, x - o * 2.4, y - 2.1);
    c.closePath();
    c.fillStyle = '#2a1222';
    c.fill();
    /* lower lash hint at the outer corner */
    c.beginPath();
    c.moveTo(x + o * 1.2, y + 3.05);
    c.quadraticCurveTo(x + o * 2.3, y + 2.6, x + o * 2.75, y + 1.3);
    stroke(c, 'rgba(60, 20, 40, 0.65)', 0.35);
  }

  function happyEye(c, x, y) {
    c.beginPath();
    c.moveTo(x - 2.2, y + 0.9);
    c.quadraticCurveTo(x, y - 1.8, x + 2.2, y + 0.9);
    stroke(c, '#2a1222', 0.8);
  }

  function face(c, P, expr) {
    var y = P.headY, skin = P.skin;
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
    c.fillStyle = 'rgba(255, 120, 150, 0.4)';
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
    eye(c, P, 10.2, 13.8 + y, -1);
    eye(c, P, 17.8, 13.8 + y, 1);
    /* nose: a warm fleck */
    c.beginPath();
    c.moveTo(14.3, 16 + y);
    c.lineTo(14.6, 16.6 + y);
    stroke(c, tone(skin, 'd2', true), 0.4);
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

  /* Hair in front of the face: fringe, side locks, gloss, tiara, buns */
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
    sideLock(c, P, -1);
    sideLock(c, P, 1);
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
    tiara(c, y);
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

  /* ---------- Body ---------- */
  function legs(c, P) {
    var tights = P.dress ? '#ffe8ee' : '#3a2a18';
    var top = P.dress ? 28.6 : 26.2;
    var k = P.kick;
    var L = [[11, -k], [17, k]];
    for (var i = 0; i < 2; i++) {
      var lx = L[i][0], dk = L[i][1];
      var ax = lx + dk * 0.25, ay = 32.1 + dk * 0.32;
      (function (lx, ax, ay) {
        cel(c, function () { capsule(c, lx, top, 1.85, ax, ay, 1.3); }, tights, { s: 0.9, ink: 0.45 });
      })(lx, ax, ay);
      shoe(c, P, ax, ay + 0.9, dk);
    }
  }

  function shoe(c, P, x, y, dk) {
    var col = P.shoe;
    if (P.shoes === 'flipper') {
      /* a fin blade trailing back behind the foot, flexing with the kick */
      var bend = dk * 0.45;
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

  function hand(c, skin, x, y) {
    cel(c, function () { ellipsePath(c, x, y, 1.35, 1.25); }, skin, { warm: true, s: 0.6, ink: 0.4 });
    c.beginPath();
    c.moveTo(x - 0.5, y + 0.2); c.lineTo(x + 0.6, y + 0.4);
    stroke(c, tone(skin, 'd2', true), 0.25);
  }

  function arm(c, P, sx, sy, hx, hy) {
    var skin = P.skin;
    cel(c, function () { capsule(c, sx, sy, 1.45, hx, hy, 1.05); }, skin, { warm: true, s: 0.8, ink: 0.45 });
    hand(c, skin, hx, hy);
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

  function skirt(c, P) {
    var col = P.suit, t = P.t;
    var lift = Math.max(-0.8, Math.min(0.8, -P.vy * 0.4));
    var fl = Math.sin(t * 3.1) * 0.35, fr = Math.sin(t * 3.1 + 1.6) * 0.35;
    var hem = function () {
      c.beginPath();
      c.moveTo(8.6, 25.2);
      c.lineTo(19.4, 25.2);
      c.quadraticCurveTo(21.6, 27.4, 23.4 + fr, 29.8 - lift + fr);
      c.quadraticCurveTo(14, 31.6, 4.6 + fl, 29.8 - lift + fl);
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
    c.moveTo(12.4, 25.4); c.lineTo(10.4, 31.5); c.lineTo(12.2, 31.5); c.closePath();
    c.moveTo(16.2, 25.4); c.lineTo(17.4, 31.5); c.lineTo(19.2, 31.5); c.closePath();
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
        starPath(c, st[i][0], st[i][1], st[i][2]);
        c.fill();
      }
      c.beginPath();
      c.moveTo(4.8 + fl, 29.6 - lift + fl);
      c.quadraticCurveTo(14, 31.4, 23.2 + fr, 29.6 - lift + fr);
      stroke(c, '#ffffff', 0.6);
    } else {
      /* scalloped white frill along the hem */
      for (var sI = 0; sI < 6; sI++) {
        var u = sI / 5;
        var hx = 5.6 + u * 16.8 + (fl * (1 - u) + fr * u);
        var hy = 29.8 + Math.sin(u * Math.PI) * 1.2 - lift + (fl * (1 - u) + fr * u);
        (function (hx, hy) {
          cel(c, function () { c.beginPath(); c.arc(hx, hy, 1.55, Math.PI * 0.05, Math.PI * 0.95, true); c.closePath(); },
            '#ffffff', { s: 0.6, ink: 0.35 });
        })(hx, hy);
      }
    }
  }

  function outfit(c, P) {
    var col = P.suit, o = P.outfit, skin = P.skin;
    var ink = tone(col, 'ink');
    if (P.dress) {
      skirt(c, P);
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

  /* ---------- Bubble wand ---------- */
  function wand(c, P) {
    var t = P.t;
    /* gold shaft with a sheen */
    c.beginPath(); c.moveTo(27.6, 23); c.lineTo(33.4, 23);
    stroke(c, '#8a5a12', 1.7);
    c.beginPath(); c.moveTo(27.6, 23); c.lineTo(33.4, 23);
    stroke(c, '#ffc93a', 1.1);
    c.beginPath(); c.moveTo(28, 22.7); c.lineTo(33, 22.7);
    stroke(c, '#fff3b0', 0.35);
    /* handle */
    cel(c, function () { capsule(c, 23.6, 23, 1.6, 27.8, 23, 1.4); }, '#ff99cc', { s: 0.8, ink: 0.45 });
    c.fillStyle = '#ffd24a';
    c.fillRect(27.4, 21.7, 1.1, 2.6);
    heartPath(c, 26.2, 23, 0.6);
    c.fillStyle = '#ff3366';
    c.fill();
    /* star gem, twinkling */
    var tw = 1 + Math.sin(t * 5) * 0.08;
    starPath(c, 35, 23, 2.5 * tw);
    c.fillStyle = '#ffffff';
    c.fill();
    stroke(c, '#c08a1a', 0.4);
    starPath(c, 35, 23.2, 1.75 * tw);
    var g = c.createLinearGradient(0, 21.4, 0, 25);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(1, '#ffb820');
    c.fillStyle = g;
    c.fill();
    ellipsePath(c, 34.4, 22.2, 0.55, 0.4);
    c.fillStyle = '#ffffff';
    c.fill();
    /* sparkles orbiting the tip */
    c.fillStyle = '#ffffff';
    for (var s = 0; s < 3; s++) {
      var a = Math.sin(t * 4 + s * 2.1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      var sx = 35 + Math.cos(s * 2.3 + 0.6) * 3.4, sy = 23 + Math.sin(s * 2.3 + 0.6) * 2.6;
      starPath(c, sx, sy, 0.7 * a, 0.3);
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
  function drawSprite(c, sx, sy, cust, frame, motion) {
    var P = pose(cust, frame, motion);
    c.save();
    c.translate(sx, sy);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    hairBack(c, P);
    legs(c, P);
    var bob = P.breathe * 0.25;
    arm(c, P, 8.4, 21.8, 5.4, 25 + bob);
    neck(c, P);
    outfit(c, P);
    face(c, P, 'normal');
    hairFront(c, P);
    arm(c, P, 19.6, 21.8, 23.8, 23.2);
    wand(c, P);
    hand(c, P.skin, 24.4, 23.1);
    if (P.food !== 'none') food(c, P, 4.4, 22.4 + bob);
    c.restore();
  }

  /* Floss dance: hips swing one way, both straight arms the other; one
     crosses in front of the chest, the other passes behind the hips. */
  function drawFloss(c, sx, sy, cust, phase) {
    var P = pose(cust, 0, null);
    var beat = Math.tanh(Math.sin(phase) * 3.2);
    var hip = beat * 2.5;
    P.swX = -beat * 1.4;
    P.swY = 0;
    P.kick = 0;
    P.blink = false;
    var armDir = -beat;
    var crossSh = 14 - armDir * 5, extSh = 14 + armDir * 5;
    var crossHx = 14 + armDir * 10, extHx = 14 + armDir * 12;
    c.save();
    c.translate(sx + 14, sy + 22);
    c.rotate(beat * 0.05);
    c.translate(-14, -22);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    hairBack(c, P);
    c.save();
    c.translate(hip, 0);
    legs(c, P);
    c.restore();
    /* the far arm swings behind the hips */
    arm(c, P, extSh, 23.4, extHx, 27);
    neck(c, P);
    c.save();
    c.translate(hip * 0.45, 0);
    outfit(c, P);
    c.restore();
    face(c, P, 'happy');
    hairFront(c, P);
    /* the near arm sweeps across the chest */
    arm(c, P, crossSh, 21.6, crossHx, 21.2);
    c.restore();
  }

  /* Crab companion, shaded like her */
  function drawCrab(c, px, py, variant, frame) {
    if (!variant || variant === 'none') return;
    var body = variant === 'blue' ? '#4a80d8' : variant === 'gold' ? '#ffcc44' : '#e04848';
    var wob = Math.sin((frame || 0) * 0.25) * 0.8;
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px - 3, py + 2); c.lineTo(px - 4.3, py + 3.9);
    c.moveTo(px + 3, py + 2); c.lineTo(px + 4.3, py + 3.9);
    c.moveTo(px - 1.5, py + 2.8); c.lineTo(px - 2.1, py + 4.5);
    c.moveTo(px + 1.5, py + 2.8); c.lineTo(px + 2.1, py + 4.5);
    stroke(c, tone(body, 'd2'), 0.75);
    cel(c, function () { ellipsePath(c, px - 5, py - 1 + wob, 1.9, 1.7); }, body, { s: 0.6, ink: 0.4 });
    cel(c, function () { ellipsePath(c, px + 5, py - 1 - wob, 1.9, 1.7); }, body, { s: 0.6, ink: 0.4 });
    cel(c, function () { ellipsePath(c, px, py, 5, 3.4); }, body, { s: 1, ink: 0.5, rim: 0.4, x0: px - 5, x1: px + 5, y0: py - 3, y1: py + 3 });
    ellipsePath(c, px - 1.4, py - 1.2, 1.7, 0.7);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fill();
    for (var e = -1; e <= 1; e += 2) {
      ellipsePath(c, px + e * 1.5, py - 2.8, 0.95, 0.95);
      c.fillStyle = '#ffffff';
      c.fill();
      stroke(c, tone(body, 'ink'), 0.3);
      ellipsePath(c, px + e * 1.5 + 0.2, py - 2.7, 0.42, 0.48);
      c.fillStyle = '#1a0c14';
      c.fill();
    }
    c.restore();
  }

  Game.hero = {
    draw: drawSprite,
    floss: drawFloss,
    crab: drawCrab,
  };
})();
