/* fx.js – cached light, depth and post-processing layers shared by the
   gameplay renderer (engine.js) and the menu backdrops (ui.js).

   Everything here is painted once into offscreen canvases at the
   backing store's own resolution and then blitted 1:1, which is the one
   thing a 2D canvas does fast everywhere: a frame costs a handful of
   unscaled drawImage calls, no full-screen gradient fills, and allocates
   nothing. Soft focus is baked in by painting a layer small and
   upscaling it once at build time; ctx.filter is never used (Safari). */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  var TAU = Math.PI * 2;

  /* Every effect can be switched off on its own. With `auto` set the
     game drops them in tiers when frames stay slow (see frame()). */
  Game.FX = {
    rays: true,        /* god rays from the surface */
    caustics: true,    /* light net on the sand */
    haze: true,        /* out-of-focus motes drifting in front */
    foreground: true,  /* soft out-of-focus fronds along the bottom edge */
    lighting: true,    /* sun key, underside ambient and rims on characters */
    bloom: true,       /* glow around bright things */
    grade: true,       /* warm-top / cool-bottom colour grade */
    vignette: true,    /* darkened corners */
    auto: true,
  };

  /* Device pixels per logical pixel; every cached texture is built at
     this scale so it lands on the canvas without resampling. */
  var S = 1;

  function makeCanvas(w, h) {
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    return cv;
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---- Themes ----
     water: vertical gradient stops, surface to sea floor.
     layers: far / mid / near silhouettes. Each is lit from above (rim)
       and sinks into haze at its foot, which is what separates the
       planes: the further back, the closer to the colour of the water.
     grade: soft-light tints for the top and bottom of the frame. */
  var THEMES = {
    reef: {
      water: [[0, '#3fb2e2'], [0.13, '#2492d2'], [0.42, '#1462ac'], [0.78, '#0c3c7e'], [1, '#08285e']],
      sun: 'rgba(205, 248, 255, ', sunX: 0.64, sunA: 0.3,
      layers: [
        { top: '#1c70b6', bot: '#155a9e', rim: '#4aa6dc', haze: 'rgba(70, 150, 215, 0.55)', par: 0.12, soft: 0.5 },
        { top: '#11529a', bot: '#0d4080', rim: '#3a8cc8', haze: 'rgba(40, 110, 185, 0.5)', par: 0.26, soft: 1 },
        { top: '#0b3a76', bot: '#082a5e', rim: '#2c74b4', haze: 'rgba(24, 80, 150, 0.45)', par: 0.45, soft: 1 },
      ],
      fg: '#0a3a52',
      sand: { top: '#ecd6a4', mid: '#b3925f', bottom: '#6a5238', lip: 'rgba(255, 248, 220, 0.85)' },
      gradeTop: 'rgba(255, 232, 170, 0.07)', gradeBot: 'rgba(16, 8, 80, 0.26)',
      vig: '3, 10, 40',
    },
    wreck: {
      water: [[0, '#48bca6'], [0.13, '#289c94'], [0.42, '#156e78'], [0.78, '#0c4654'], [1, '#08323e']],
      sun: 'rgba(214, 255, 232, ', sunX: 0.36, sunA: 0.26,
      layers: [
        { top: '#1c7a80', bot: '#16646c', rim: '#48b0a8', haze: 'rgba(70, 160, 150, 0.5)', par: 0.12, soft: 0.5 },
        { top: '#12606a', bot: '#0f4f5a', rim: '#3a968e', haze: 'rgba(40, 120, 120, 0.45)', par: 0.26, soft: 1 },
        { top: '#0b424c', bot: '#08323e', rim: '#2c7c78', haze: 'rgba(24, 90, 96, 0.4)', par: 0.45, soft: 1 },
      ],
      fg: '#0a3c34',
      sand: { top: '#d9cf9e', mid: '#96895c', bottom: '#57523a', lip: 'rgba(248, 250, 220, 0.75)' },
      gradeTop: 'rgba(240, 255, 190, 0.06)', gradeBot: 'rgba(4, 16, 56, 0.26)',
      vig: '2, 16, 26',
    },
    trench: {
      water: [[0, '#101a52'], [0.45, '#0c1240'], [1, '#080a2a']],
      sun: null,
      layers: [
        { top: '#1c2a72', bot: '#141c56', rim: '#4a62c8', haze: 'rgba(60, 60, 170, 0.4)', par: 0.12, soft: 0.5 },
        { top: '#141e5a', bot: '#0f1544', rim: '#3c4eb0', haze: 'rgba(50, 40, 140, 0.35)', par: 0.26, soft: 1 },
        { top: '#0e1444', bot: '#0a0e32', rim: '#303e98', haze: 'rgba(40, 30, 110, 0.3)', par: 0.45, soft: 1 },
      ],
      fg: '#02030e',
      sand: null,
      gradeTop: 'rgba(120, 150, 255, 0.05)', gradeBot: 'rgba(30, 4, 70, 0.24)',
      vig: '2, 2, 16',
    },
  };

  /* ---- Silhouette shapes ----
     All drawn in whatever solid colour is current; the layer builder
     shades them afterwards. */
  function ridge(c, tw, th, baseY, comps) {
    c.beginPath();
    c.moveTo(0, th);
    for (var x = 0; x <= tw; x += 4) {
      var y = baseY;
      for (var i = 0; i < comps.length; i++) {
        y -= comps[i][0] * (0.5 + 0.5 * Math.sin(TAU * comps[i][1] * x / tw + comps[i][2]));
      }
      c.lineTo(x, y);
    }
    c.lineTo(tw, th);
    c.closePath();
    c.fill();
  }

  function spire(c, x, base, w, h, lean) {
    c.beginPath();
    c.moveTo(x - w / 2, base);
    c.bezierCurveTo(x - w * 0.36, base - h * 0.5, x - w * 0.14 + lean, base - h * 0.92, x + lean, base - h);
    c.bezierCurveTo(x + w * 0.16 + lean, base - h * 0.86, x + w * 0.4, base - h * 0.45, x + w / 2, base);
    c.closePath();
    c.fill();
  }

  function jag(c, x, base, w, h, r) {
    c.beginPath();
    c.moveTo(x - w / 2, base);
    c.lineTo(x - w * 0.32, base - h * (0.35 + r() * 0.15));
    c.lineTo(x - w * 0.2, base - h * (0.5 + r() * 0.1));
    c.lineTo(x - w * 0.08 + (r() - 0.5) * w * 0.1, base - h);
    c.lineTo(x + w * 0.08, base - h * (0.72 + r() * 0.1));
    c.lineTo(x + w * 0.2, base - h * (0.62 + r() * 0.1));
    c.lineTo(x + w * 0.34, base - h * (0.25 + r() * 0.15));
    c.lineTo(x + w / 2, base);
    c.closePath();
    c.fill();
  }

  function branch(c, x, y, ang, len, wd, depth, r) {
    var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    c.lineWidth = wd;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.stroke();
    if (depth > 0) {
      branch(c, x2, y2, ang - 0.3 - r() * 0.35, len * 0.74, wd * 0.74, depth - 1, r);
      branch(c, x2, y2, ang + 0.3 + r() * 0.35, len * 0.74, wd * 0.74, depth - 1, r);
    }
  }

  function branchCoral(c, x, base, h, r) {
    c.lineCap = 'round';
    branch(c, x, base, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.4, Math.max(3, h * 0.11), 3, r);
  }

  function fanCoral(c, x, base, rad) {
    c.lineCap = 'round';
    c.lineWidth = Math.max(2.5, rad * 0.12);
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - rad * 0.5);
    c.stroke();
    c.beginPath();
    c.moveTo(x, base - rad * 0.35);
    c.arc(x, base - rad * 0.35, rad, Math.PI * 1.12, Math.PI * 1.88);
    c.closePath();
    c.fill();
  }

  function tableCoral(c, x, base, w, h) {
    c.lineCap = 'round';
    c.lineWidth = Math.max(3, w * 0.12);
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - h);
    c.stroke();
    c.beginPath();
    c.ellipse(x, base - h, w / 2, Math.max(3, w * 0.11), 0, 0, TAU);
    c.fill();
  }

  function tubes(c, x, base, h, r) {
    c.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var tx = x + (i - 1.5) * h * 0.2, th = h * (0.5 + r() * 0.5);
      c.lineWidth = h * 0.15;
      c.beginPath();
      c.moveTo(tx, base);
      c.lineTo(tx + (i - 1.5) * h * 0.06, base - th);
      c.stroke();
    }
  }

  function kelp(c, x, base, h, lw, r) {
    var ph = r() * TAU, amp = 5 + r() * 6, n = Math.max(4, Math.round(h / 16));
    c.lineCap = 'round';
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(x, base);
    var i, px, py;
    for (i = 1; i <= n; i++) {
      c.lineTo(x + Math.sin(ph + i * 0.7) * amp * (i / n), base - h * i / n);
    }
    c.stroke();
    for (i = 1; i < n; i++) {
      px = x + Math.sin(ph + i * 0.7) * amp * (i / n);
      py = base - h * i / n;
      var side = i % 2 ? 1 : -1;
      c.beginPath();
      c.ellipse(px + side * lw * 2.2, py - lw, lw * 2.6, lw * 0.9, side * -0.5, 0, TAU);
      c.fill();
    }
  }

  function mound(c, x, base, w, h) {
    c.beginPath();
    c.moveTo(x - w / 2, base);
    c.bezierCurveTo(x - w * 0.45, base - h * 1.2, x + w * 0.3, base - h * 1.35, x + w / 2, base);
    c.closePath();
    c.fill();
  }

  /* An irregular boulder: a dome whose outline is pushed in and out at
     random and then smoothed, so no two read alike and none is a cone. */
  function boulder(c, x, base, w, h, r) {
    var n = 9, px = [], py = [], i;
    for (i = 0; i <= n; i++) {
      var a = Math.PI * (1 - i / n);
      var j = i === 0 || i === n ? 1 : 0.78 + r() * 0.34;
      px.push(x + Math.cos(a) * w / 2 * (i === 0 || i === n ? 1 : 0.86 + r() * 0.2));
      py.push(base - Math.sin(a) * h * j);
    }
    c.beginPath();
    c.moveTo(px[0], base + 4);
    c.lineTo(px[0], py[0]);
    for (i = 1; i < n; i++) c.quadraticCurveTo(px[i], py[i], (px[i] + px[i + 1]) / 2, (py[i] + py[i + 1]) / 2);
    c.lineTo(px[n], py[n]);
    c.lineTo(px[n], base + 4);
    c.closePath();
    c.fill();
  }

  /* A coral bommie: stacked boulders on a waist, the cap overhanging it
     the way a reef head grows out toward the light. */
  function bommie(c, x, base, w, h, r) {
    boulder(c, x, base, w, h * 0.42, r);
    boulder(c, x + (r() - 0.5) * w * 0.2, base - h * 0.3, w * 0.5, h * 0.4, r);
    var cx = x + (r() - 0.5) * w * 0.3;
    boulder(c, cx, base - h * 0.62, w * (0.7 + r() * 0.3), h * 0.3, r);
    boulder(c, cx + (r() - 0.5) * w * 0.3, base - h * 0.8, w * 0.42, h * 0.2, r);
  }

  /* A rock arch on two uneven feet. */
  function arch(c, x, base, w, h, r) {
    c.lineCap = 'round';
    c.lineWidth = w * 0.22;
    c.beginPath();
    c.moveTo(x - w * 0.36, base);
    c.bezierCurveTo(x - w * 0.42, base - h * 1.25, x + w * 0.36, base - h * 1.3, x + w * 0.38, base);
    c.stroke();
    boulder(c, x - w * 0.4, base, w * 0.5, h * 0.4, r);
    boulder(c, x + w * 0.42, base, w * 0.44, h * 0.3, r);
    boulder(c, x + w * 0.02, base - h * 0.92, w * 0.6, h * 0.22, r);
  }

  /* A stepped shelf of plate coral: flat ledges jutting from a core. */
  function shelf(c, x, base, w, h, r) {
    boulder(c, x, base, w * 0.5, h, r);
    for (var i = 0; i < 3; i++) {
      var y = base - h * (0.35 + i * 0.25), lw = w * (0.95 - i * 0.2), ox = (r() - 0.5) * w * 0.3;
      c.beginPath();
      c.ellipse(x + ox, y, lw / 2, Math.max(3, h * 0.07), 0, 0, TAU);
      c.fill();
    }
  }

  /* A fan of tapering blades springing from a root below the frame. */
  function bladeFan(c, x, base, h, n, r) {
    for (var i = 0; i < n; i++) {
      var a = (i - (n - 1) / 2) * 0.24 + (r() - 0.5) * 0.12;
      var len = h * (0.62 + r() * 0.38), wd = 6 + r() * 5;
      var tx = x + Math.sin(a) * len, ty = base - Math.cos(a) * len;
      var bend = (r() - 0.5) * 16;
      c.beginPath();
      c.moveTo(x - wd, base);
      c.quadraticCurveTo(x - wd * 0.6 + Math.sin(a) * len * 0.5 + bend, base - Math.cos(a) * len * 0.55, tx, ty);
      c.quadraticCurveTo(x + wd * 0.6 + Math.sin(a) * len * 0.5 + bend, base - Math.cos(a) * len * 0.5, x + wd, base);
      c.closePath();
      c.fill();
    }
  }

  /* A broken galleon lying on the bottom, bow up. */
  function ship(c, x, base, s) {
    c.save();
    c.translate(x, base);
    c.rotate(-0.09);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-150, 6);
    c.lineTo(-182, -62);
    c.quadraticCurveTo(-20, -28, 128, -52);
    c.lineTo(134, -84);
    c.lineTo(178, -84);
    c.lineTo(170, 6);
    c.closePath();
    c.fill();
    c.lineCap = 'round';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-70, -44); c.lineTo(-82, -196);
    c.moveTo(-112, -150); c.lineTo(-50, -158);
    c.moveTo(40, -44); c.lineTo(52, -128); c.lineTo(84, -150);
    c.moveTo(-182, -62); c.lineTo(-214, -84);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-82, -196); c.lineTo(-176, -62);
    c.moveTo(-82, -196); c.lineTo(30, -46);
    c.moveTo(52, -128); c.lineTo(150, -84);
    c.stroke();
    c.restore();
  }

  /* Curved ship ribs poking out of the sand. */
  function ribs(c, x, base, h) {
    c.lineCap = 'round';
    c.lineWidth = Math.max(3, h * 0.09);
    for (var i = 0; i < 5; i++) {
      var rx = x + i * h * 0.34;
      c.beginPath();
      c.moveTo(rx, base);
      c.quadraticCurveTo(rx - h * 0.3, base - h * 0.6, rx + h * 0.1, base - h * (0.7 + (i % 3) * 0.15));
      c.stroke();
    }
  }

  /* shapes[theme][layer](c, tw, th, r) – th is the tile height; the game
     floor sits about 40px above the tile's bottom edge. */
  var SHAPES = {
    reef: [
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 56, [[78, 2, 0.4], [42, 3, 2.1], [18, 7, 1.0], [8, 13, 0.3]]);
        /* Reef heads rather than peaks: bommies with overhanging caps,
           plate-coral shelves and one arch, on a broken rocky ridge */
        ridge(c, tw, th, th - 54, [[10, 19, 0.7], [6, 31, 2.2]]);
        bommie(c, 120, th - 66, 150, 190, r);
        shelf(c, 330, th - 70, 150, 120, r);
        arch(c, 520, th - 74, 190, 120, r);
        bommie(c, 730, th - 66, 120, 150, r);
        shelf(c, 900, th - 72, 130, 170, r);
        for (var i = 0; i < 7; i++) boulder(c, 40 + i * 146 + r() * 70, th - 62, 90 + r() * 80, 40 + r() * 40, r);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 44, [[34, 3, 1.2], [14, 8, 0.2], [6, 17, 2.0]]);
        var i;
        for (i = 0; i < 4; i++) spire(c, 60 + i * 256 + r() * 120, th - 46, 50 + r() * 40, 90 + r() * 60, (r() - 0.5) * 16);
        for (i = 0; i < 7; i++) branchCoral(c, 30 + i * 146 + r() * 60, th - 50, 70 + r() * 60, r);
        for (i = 0; i < 4; i++) tableCoral(c, 110 + i * 256 + r() * 80, th - 52, 56 + r() * 40, 34 + r() * 30);
        for (i = 0; i < 4; i++) fanCoral(c, 200 + i * 256 + r() * 60, th - 52, 30 + r() * 22);
        for (i = 0; i < 3; i++) tubes(c, 20 + i * 340 + r() * 100, th - 50, 44 + r() * 30, r);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 42, [[18, 4, 0.9], [8, 9, 2.4]]);
        var i;
        for (i = 0; i < 4; i++) mound(c, 100 + i * 256 + r() * 100, th - 42, 110 + r() * 80, 30 + r() * 26);
        for (i = 0; i < 4; i++) branchCoral(c, 60 + i * 256 + r() * 120, th - 46, 56 + r() * 40, r);
        for (i = 0; i < 6; i++) kelp(c, 20 + i * 170 + r() * 90, th - 44, 70 + r() * 70, 3.5, r);
        for (i = 0; i < 3; i++) fanCoral(c, 150 + i * 340 + r() * 100, th - 46, 28 + r() * 16);
      },
    ],
    wreck: [
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 56, [[60, 2, 2.4], [34, 3, 0.6], [14, 7, 1.6]]);
        ship(c, 330, th - 70, 1.15);
        ship(c, 840, th - 96, 0.62);
        for (var i = 0; i < 2; i++) spire(c, 600 + i * 330 + r() * 60, th - 60, 80 + r() * 60, 150 + r() * 70, (r() - 0.5) * 30);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 44, [[30, 3, 0.2], [12, 8, 1.2]]);
        var i;
        for (i = 0; i < 3; i++) spire(c, 120 + i * 340 + r() * 120, th - 46, 60 + r() * 40, 70 + r() * 50, (r() - 0.5) * 16);
        for (i = 0; i < 15; i++) kelp(c, 10 + i * 68 + r() * 40, th - 46, 100 + r() * 140, 4, r);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 42, [[16, 4, 1.9], [8, 9, 0.4]]);
        var i;
        for (i = 0; i < 4; i++) mound(c, 80 + i * 256 + r() * 100, th - 42, 100 + r() * 80, 28 + r() * 24);
        for (i = 0; i < 2; i++) ribs(c, 180 + i * 520 + r() * 80, th - 40, 70 + r() * 30);
        for (i = 0; i < 6; i++) kelp(c, 30 + i * 170 + r() * 90, th - 44, 60 + r() * 80, 3.5, r);
      },
    ],
    trench: [
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 60, [[50, 2, 1.0], [26, 5, 2.2]]);
        for (var i = 0; i < 9; i++) jag(c, 40 + i * 114 + r() * 50, th - 70, 90 + r() * 80, 130 + r() * 130, r);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 44, [[26, 3, 0.5], [12, 9, 1.4]]);
        var i;
        for (i = 0; i < 9; i++) jag(c, 30 + i * 114 + r() * 60, th - 50, 60 + r() * 50, 70 + r() * 90, r);
        for (i = 0; i < 5; i++) tubes(c, 70 + i * 205 + r() * 80, th - 50, 40 + r() * 30, r);
      },
      function (c, tw, th, r) {
        ridge(c, tw, th, th - 42, [[14, 4, 2.9], [8, 11, 0.4]]);
        var i;
        for (i = 0; i < 8; i++) jag(c, 50 + i * 128 + r() * 70, th - 44, 50 + r() * 50, 36 + r() * 60, r);
        for (i = 0; i < 4; i++) mound(c, 100 + i * 256 + r() * 100, th - 42, 100 + r() * 60, 24 + r() * 20);
      },
    ],
  };

  var LAYER_TW = 1024;
  var LAYER_TH = [300, 260, 200];

  /* One seamless silhouette strip: the shapes are stamped three times
     (tile width apart) so anything crossing an edge wraps round. `soft`
     below 1 paints it small and scales it up once, which blurs it. */
  function buildMask(shapeFn, tw, th, soft, seed) {
    var res = S * soft;
    var cv = makeCanvas(tw * res, th * res);
    var c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    for (var o = -1; o <= 1; o++) {
      c.setTransform(res, 0, 0, res, o * tw * res, 0);
      shapeFn(c, tw, th, rng(seed));
    }
    if (soft === 1) return cv;
    var up = makeCanvas(tw * S, th * S);
    up.getContext('2d').drawImage(cv, 0, 0, up.width, up.height);
    return up;
  }

  function buildLayer(spec, shapeFn, th, seed) {
    var tw = LAYER_TW;
    var mask = buildMask(shapeFn, tw, th, spec.soft, seed);
    var pw = mask.width, ph = mask.height;
    /* Body: the mask filled with the top-to-bottom body gradient */
    var body = makeCanvas(pw, ph), b = body.getContext('2d');
    b.drawImage(mask, 0, 0);
    b.globalCompositeOperation = 'source-in';
    var g = b.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, spec.top);
    g.addColorStop(1, spec.bot);
    b.fillStyle = g;
    b.fillRect(0, 0, pw, ph);
    /* Tile: rim-coloured silhouette with the body laid over it a couple
       of pixels lower, which leaves a lit edge on everything facing up */
    var tile = makeCanvas(pw, ph), t = tile.getContext('2d');
    t.drawImage(mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = spec.rim;
    t.fillRect(0, 0, pw, ph);
    t.globalCompositeOperation = 'source-atop';
    t.drawImage(body, 0, Math.max(1, Math.round(2.2 * S)));
    /* Haze pooling at the foot */
    var hz = t.createLinearGradient(0, ph * 0.3, 0, ph * 0.9);
    hz.addColorStop(0, spec.haze.replace(/[\d.]+\)$/, '0)'));
    hz.addColorStop(1, spec.haze);
    t.fillStyle = hz;
    t.fillRect(0, 0, pw, ph);
    return { cv: tile, tw: tw, th: th, par: spec.par };
  }

  /* The water for a w x h (logical) rect, sun glow baked in. */
  function buildWater(theme, w, h) {
    var cv = makeCanvas(w * S, h * S), c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, cv.height);
    for (var i = 0; i < theme.water.length; i++) g.addColorStop(theme.water[i][0], theme.water[i][1]);
    c.fillStyle = g;
    c.fillRect(0, 0, cv.width, cv.height);
    if (theme.sun) {
      var sx = cv.width * theme.sunX;
      c.globalCompositeOperation = 'lighter';
      var s = c.createRadialGradient(sx, -20 * S, 8 * S, sx, -20 * S, cv.width * 0.62);
      s.addColorStop(0, theme.sun + theme.sunA + ')');
      s.addColorStop(0.35, theme.sun + (theme.sunA * 0.35) + ')');
      s.addColorStop(1, theme.sun + '0)');
      c.fillStyle = s;
      c.fillRect(0, 0, cv.width, cv.height);
    }
    return cv;
  }

  /* Out-of-focus fronds close to the lens. The strip is only as tall as
     the sand below the play floor, so nothing in it can cover a rock, a
     pickup or a character; the fans root under the bottom edge. */
  function buildForeground(theme, name) {
    var tw = 1600, th = 46;
    var mask = buildMask(function (c, w, h, r) {
      for (var i = 0; i < 4; i++) {
        var x = 150 + i * 400 + r() * 150;
        if (name === 'trench') {
          jag(c, x, h + 6, 90, 34 + r() * 12, r);
          jag(c, x + 60, h + 6, 60, 22 + r() * 10, r);
        } else {
          bladeFan(c, x, h + 10, 50, 6, r);
          bladeFan(c, x + 46, h + 12, 36, 4, r);
        }
      }
    }, tw, th, 0.4, 911);
    var c2 = mask.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = theme.fg;
    c2.fillRect(0, 0, mask.width, mask.height);
    return { cv: mask, tw: tw, th: th };
  }

  /* Colour grade for a w x h rect: a breath of warm light at the top and
     the cool of the deep gathering toward the bottom. */
  function buildGrade(theme, w, h) {
    var cv = makeCanvas(w * S, h * S), c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, cv.height);
    g.addColorStop(0, theme.gradeTop);
    g.addColorStop(0.4, theme.gradeTop.replace(/[\d.]+\)$/, '0)'));
    g.addColorStop(0.5, theme.gradeBot.replace(/[\d.]+\)$/, '0)'));
    g.addColorStop(1, theme.gradeBot);
    c.fillStyle = g;
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  function buildVignette(theme, w, h) {
    var cv = makeCanvas(w * S, h * S), c = cv.getContext('2d');
    c.setTransform(cv.width / 200, 0, 0, cv.height / 200, 0, 0);
    var g = c.createRadialGradient(100, 100, 62, 100, 100, 146);
    g.addColorStop(0, 'rgba(' + theme.vig + ', 0)');
    g.addColorStop(0.6, 'rgba(' + theme.vig + ', 0.16)');
    g.addColorStop(1, 'rgba(' + theme.vig + ', 0.62)');
    c.fillStyle = g;
    c.fillRect(0, 0, 200, 200);
    return cv;
  }

  var built = {};
  function getTheme(name) {
    var b = built[name];
    if (b) return b;
    var th = THEMES[name] || THEMES.reef;
    var shapes = SHAPES[name] || SHAPES.reef;
    b = { def: th, layers: [], fg: buildForeground(th, name), sized: {}, nSized: 0 };
    for (var i = 0; i < 3; i++) b.layers.push(buildLayer(th.layers[i], shapes[i], LAYER_TH[i], 101 + i * 37));
    built[name] = b;
    return b;
  }

  /* Full-rect textures are kept per rect size: the 800x480 game view,
     and whatever the menus fill on a tablet. A rotation or two can add
     sizes, so the set is dropped if it ever grows. */
  function sized(th, w, h) {
    var key = w + 'x' + h;
    var e = th.sized[key];
    if (e) return e;
    if (th.nSized >= 4) { th.sized = {}; th.nSized = 0; }
    e = th.sized[key] = { water: buildWater(th.def, w, h), grade: buildGrade(th.def, w, h), vig: buildVignette(th.def, w, h) };
    th.nSized++;
    return e;
  }

  /* ---- God rays ----
     A strip of slanted soft-edged beams that fade with depth, drawn
     twice at different drift speeds so the shafts cross and breathe. */
  var RAY_W = 1024;
  var rayTex = {}, nRay = 0;
  /* The strip for a fall of h logical pixels; tw is its logical width. */
  function getRays(h) {
    var e = rayTex[h];
    if (e) return e;
    if (nRay >= 3) { rayTex = {}; nRay = 0; }
    var k = h / H, tw = Math.round(RAY_W * k);
    var cv = makeCanvas(tw * S, h * S);
    var c = cv.getContext('2d'), r = rng(77), sc = S * k;
    for (var i = 0; i < 9; i++) {
      var x = i * RAY_W / 9 + r() * 70, w = 26 + r() * 84, a = 0.22 + r() * 0.4;
      for (var o = -1; o <= 1; o++) {
        c.setTransform(sc, 0, -0.16 * sc, sc, (x + o * RAY_W + 40) * sc, 0);
        var g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, 'rgba(214, 246, 255, 0)');
        g.addColorStop(0.5, 'rgba(214, 246, 255, ' + a + ')');
        g.addColorStop(1, 'rgba(214, 246, 255, 0)');
        c.fillStyle = g;
        c.fillRect(-w / 2, 0, w, H);
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    var f = c.createLinearGradient(0, 0, 0, cv.height);
    f.addColorStop(0, 'rgba(0, 0, 0, 1)');
    f.addColorStop(0.45, 'rgba(0, 0, 0, 0.5)');
    f.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
    c.fillStyle = f;
    c.fillRect(0, 0, cv.width, cv.height);
    nRay++;
    return (rayTex[h] = { cv: cv, tw: tw });
  }

  /* Tiles `cv` horizontally over [x0, x1] starting from scroll `off`,
     snapped to device pixels so each copy is an unscaled blit. */
  function tileX(c, cv, off, x0, x1, y, tw, th) {
    var x = x0 - ((((x0 + off) % tw) + tw) % tw);
    x = Math.round(x * S) / S;
    for (; x < x1; x += tw) c.drawImage(cv, x, y, tw, th);
  }

  /* t in seconds; (x, y, w, h) is the rect the light falls through. */
  function drawRays(c, camX, t, x, y, w, h, strength) {
    if (!Game.FX.rays) return;
    h = Math.round(h);
    var tex = getRays(h);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 2; k++) {
      var off = camX * (k ? 0.11 : 0.05) + Math.sin(t * (k ? 0.23 : 0.31) + k * 2) * (k ? 26 : 16) + k * 389;
      c.globalAlpha = strength * (0.6 + 0.3 * Math.sin(t * (k ? 0.53 : 0.37) + k * 1.7));
      tileX(c, tex.cv, off, x, x + w, y, tex.tw, h);
    }
    c.restore();
  }

  /* ---- Caustics ----
     A seamless net of light: bright where any of three warped wave
     fronts crosses zero. Two copies slide against each other. */
  var CAUSTIC_N = 256, CAUSTIC_W = 380, CAUSTIC_H = 150; /* squashed: the floor is seen at a slant */
  var causticTex = null;
  function getCaustics() {
    if (causticTex) return causticTex;
    var N = CAUSTIC_N;
    var base = makeCanvas(N, N);
    var c = base.getContext('2d');
    var img = c.createImageData(N, N), d = img.data;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var u = x / N * TAU, v = y / N * TAU;
        var wx = u + 0.55 * Math.sin(2 * v + 1.3) + 0.25 * Math.sin(3 * u + v);
        var wy = v + 0.55 * Math.sin(2 * u + 0.7) + 0.25 * Math.sin(u - 3 * v + 2);
        var f1 = Math.abs(Math.sin(3 * wx + wy));
        var f2 = Math.abs(Math.sin(-2 * wx + 3 * wy + 1));
        var f3 = Math.abs(Math.sin(wx - 4 * wy + 2.1));
        var m = 1 - Math.min(f1, f2, f3);
        var a = Math.pow(m, 9) * 0.85 + Math.pow(m, 3) * 0.14;
        var k = (y * N + x) * 4;
        d[k] = 255; d[k + 1] = 246; d[k + 2] = 214;
        d[k + 3] = Math.min(255, a * 255);
      }
    }
    c.putImageData(img, 0, 0);
    causticTex = makeCanvas(CAUSTIC_W * S, CAUSTIC_H * S);
    causticTex.getContext('2d').drawImage(base, 0, 0, causticTex.width, causticTex.height);
    return causticTex;
  }

  /* Fills the band [y0, y1] with the light net. The caller clips to the
     shape that should catch the light. */
  function drawCaustics(c, camX, t, x0, x1, y0, y1, strength) {
    if (!Game.FX.caustics) return;
    var tex = getCaustics();
    var tw = CAUSTIC_W, th = CAUSTIC_H;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 2; k++) {
      var off = camX + (k ? -t * 9 + 97 : t * 6);
      c.globalAlpha = strength * (k ? 0.5 : 0.6);
      for (var y = Math.round(y0 - (k ? 31 : 0) - ((t * (k ? 2 : 3)) % th)); y < y1; y += th) {
        tileX(c, tex, off, x0, x1, y, tw, th);
      }
    }
    c.restore();
  }

  /* ---- Soft sprites ---- */
  var shadowTex = null, glowTex = null, bokehTex = null;
  function radialSprite(n, stops) {
    var cv = makeCanvas(n, n), c = cv.getContext('2d');
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
    return cv;
  }

  /* Soft contact shadow, an ellipse of cool dark rather than black. */
  function softShadow(c, x, y, rx, ry, a) {
    if (!shadowTex) {
      shadowTex = radialSprite(64, [[0, 'rgba(8, 14, 52, 0.9)'], [0.5, 'rgba(8, 14, 52, 0.5)'], [1, 'rgba(8, 14, 52, 0)']]);
    }
    var ga = c.globalAlpha;
    c.globalAlpha = ga * a;
    c.drawImage(shadowTex, x - rx, y - ry, rx * 2, ry * 2);
    c.globalAlpha = ga;
  }

  /* Additive soft light, for lifting a character off the background. */
  function softGlow(c, x, y, r, a) {
    if (!glowTex) {
      glowTex = radialSprite(64, [[0, 'rgba(200, 244, 255, 1)'], [0.4, 'rgba(160, 226, 255, 0.45)'], [1, 'rgba(120, 200, 255, 0)']]);
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = a;
    c.drawImage(glowTex, x - r, y - r, r * 2, r * 2);
    c.restore();
  }

  /* ---- Haze: big out-of-focus motes close to the lens ---- */
  var MOTES = [];
  (function () {
    var r = rng(4242);
    for (var i = 0; i < 11; i++) {
      MOTES.push({ x: r() * 900, y: r() * 520, r: 5 + r() * 13, vx: 4 + r() * 9, vy: 2 + r() * 5, a: 0.05 + r() * 0.07, ph: r() * TAU });
    }
  })();
  function drawHaze(c, camX, t, strength) {
    if (!Game.FX.haze) return;
    if (!bokehTex) {
      bokehTex = radialSprite(64, [[0, 'rgba(200, 240, 255, 0.55)'], [0.62, 'rgba(200, 240, 255, 0.6)'], [0.8, 'rgba(225, 250, 255, 0.95)'], [1, 'rgba(200, 240, 255, 0)']]);
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < MOTES.length; i++) {
      var m = MOTES[i];
      var x = (((m.x - camX * 1.35 - t * m.vx) % 900) + 900) % 900 - 50;
      var y = (((m.y - t * m.vy) % 580) + 580) % 580 - 50 + Math.sin(t * 0.6 + m.ph) * 6;
      c.globalAlpha = m.a * strength * (0.7 + 0.3 * Math.sin(t * 0.9 + m.ph));
      c.drawImage(bokehTex, x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
    c.restore();
  }

  /* ---- Backdrop pieces ---- */
  function drawWater(c, themeName, x, y, w, h) {
    c.drawImage(sized(getTheme(themeName), w, h).water, x, y, w, h);
  }

  /* Silhouette planes first..last (0 = far), feet at baseY + 40. */
  function drawLayers(c, themeName, camX, baseY, x0, x1, first, last) {
    var th = getTheme(themeName);
    for (var i = first; i <= last; i++) {
      var L = th.layers[i];
      tileX(c, L.cv, camX * L.par + i * 211, x0, x1, baseY + 40 - L.th, L.tw, L.th);
    }
  }

  function drawForeground(c, themeName, camX, bottom, x0, x1) {
    if (!Game.FX.foreground) return;
    var f = getTheme(themeName).fg;
    var ga = c.globalAlpha;
    c.globalAlpha = ga * 0.6;
    tileX(c, f.cv, camX * 1.6 + 300, x0, x1, bottom - f.th, f.tw, f.th);
    c.globalAlpha = ga;
  }

  /* ---- Character lighting ----
     One rig lights any character at draw time without touching how it
     paints itself. The character draws into a scratch canvas; from that
     come a darkened copy tinted toward the water's shadow colour (laid
     a pixel out to the sides and below, it is the outline, so each
     outline keeps the hue of what it surrounds), a lightened copy (laid
     a pixel toward the light, it is the lit edge), and the body itself
     with the key washed over it: sun on top, cool ambient underneath.
     Two rigs: one sized for swimmers, one for the bosses and their
     auras. */
  var LIGHT = {
    reef: { shade: 'rgba(18, 28, 110, 0.62)', keyTop: 'rgba(255, 246, 205, 0.28)', keyBot: 'rgba(26, 64, 190, 0.4)',
      rims: ['rgba(255, 252, 225, 0.8)'] },
    wreck: { shade: 'rgba(8, 48, 70, 0.62)', keyTop: 'rgba(238, 255, 215, 0.26)', keyBot: 'rgba(8, 78, 110, 0.42)',
      rims: ['rgba(240, 255, 225, 0.75)'] },
    /* No sun down here: rim 0 is Moni's magenta, 1-3 the glow plants,
       4 the vents, 5 the crystals */
    trench: { shade: 'rgba(10, 6, 50, 0.7)', keyTop: 'rgba(0, 0, 0, 0)', keyBot: 'rgba(16, 8, 76, 0.42)',
      rims: ['rgba(255, 120, 235, 0.9)', 'rgba(63, 240, 216, 0.85)', 'rgba(255, 111, 208, 0.85)',
        'rgba(155, 123, 255, 0.85)', 'rgba(255, 150, 60, 0.85)', 'rgba(120, 200, 255, 0.85)'] },
  };
  /* w, h: scratch size; pad: margin around the hitbox; body: the height
     the key gradient is spread over */
  var RIG_SPECS = [{ w: 128, h: 100, pad: 30, body: 36 }, { w: 240, h: 240, pad: 70, body: 100 }];
  var rigs = null, probe = null;
  function getRig(i) {
    if (!rigs) rigs = [null, null];
    if (rigs[i]) return rigs[i];
    var sp = RIG_SPECS[i], g = { w: sp.w, h: sp.h, pad: sp.pad, keys: {} };
    var names = ['a', 'b', 'l'];
    for (var k = 0; k < 3; k++) {
      var cv = makeCanvas(sp.w * S, sp.h * S), cx = cv.getContext('2d');
      cx.setTransform(S, 0, 0, S, 0, 0);
      g[names[k]] = cv;
      g[names[k] + 'x'] = cx;
    }
    for (var name in LIGHT) {
      var key = makeCanvas(sp.w * S, sp.h * S), kc = key.getContext('2d');
      var y0 = (sp.pad - 4) * S, y1 = (sp.pad + sp.body) * S;
      var kg = kc.createLinearGradient(0, y0, 0, y1);
      kg.addColorStop(0, LIGHT[name].keyTop);
      kg.addColorStop(0.45, LIGHT[name].keyTop.replace(/[\d.]+\)$/, '0)'));
      kg.addColorStop(0.55, LIGHT[name].keyBot.replace(/[\d.]+\)$/, '0)'));
      kg.addColorStop(1, LIGHT[name].keyBot);
      kc.fillStyle = kg;
      kc.fillRect(0, 0, key.width, key.height);
      g.keys[name] = key;
    }
    rigs[i] = g;
    return g;
  }

  /* e.draw(c, camX, camY) through the rig. (lx, ly) is the one-pixel
     step toward the light, rim an index into the theme's rim colours
     (-1 for none) and rimA its strength. */
  function lit(c, e, camX, camY, themeName, big, lx, ly, rim, rimA) {
    var g = getRig(big ? 1 : 0), L = LIGHT[themeName] || LIGHT.reef;
    var w = g.w, h = g.h;
    var bx = Math.round(e.x - camX) - g.pad, by = Math.round(e.y - camY) - g.pad;
    if (bx > W || by > H || bx + w < 0 || by + h < 0) return;
    var a = g.ax;
    a.clearRect(0, 0, w, h);
    e.draw(a, camX + bx, camY + by);
    if (probe) probe(e, g);
    /* Silhouette for the edges: alpha cubed, so soft auras and glows
       drop out and only the solid body grows an outline and a rim */
    var b = g.bx;
    b.globalCompositeOperation = 'copy';
    b.drawImage(g.a, 0, 0, w, h);
    b.globalCompositeOperation = 'destination-in';
    b.drawImage(g.a, 0, 0, w, h);
    b.drawImage(g.a, 0, 0, w, h);
    if (rim >= 0) {
      var l = g.lx;
      l.globalCompositeOperation = 'copy';
      l.drawImage(g.b, 0, 0, w, h);
      l.globalCompositeOperation = 'source-atop';
      l.fillStyle = L.rims[rim];
      l.fillRect(0, 0, w, h);
    }
    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = L.shade;
    b.fillRect(0, 0, w, h);
    a.globalCompositeOperation = 'source-atop';
    a.drawImage(g.keys[themeName] || g.keys.reef, 0, 0, w, h);
    a.globalCompositeOperation = 'source-over';
    c.drawImage(g.b, bx - 1, by, w, h);
    c.drawImage(g.b, bx + 1, by, w, h);
    c.drawImage(g.b, bx - lx, by - ly, w, h);
    if (rim >= 0) {
      var ga = c.globalAlpha;
      c.globalAlpha = ga * rimA;
      c.drawImage(g.l, bx + lx, by + ly, w, h);
      c.globalAlpha = ga;
    }
    c.drawImage(g.a, bx, by, w, h);
  }

  /* A still of a theme's backdrop for a w x h thumbnail: water, the
     three planes and the rays, seen from further back. Painted once by
     the caller into its own cached canvas. */
  function paintScene(c, themeName, w, h) {
    var k = h / 300, vw = Math.ceil(w / k);
    c.save();
    c.scale(k, k);
    drawWater(c, themeName, 0, 0, vw, 300);
    drawLayers(c, themeName, 260, 258, 0, vw, 0, 1);
    if (THEMES[themeName] && THEMES[themeName].sun) drawRays(c, 0, 2, 0, 0, vw, 300, 0.5);
    drawLayers(c, themeName, 260, 258, 0, vw, 2, 2);
    c.restore();
  }

  /* ---- Post: bloom, grade, vignette over one rect ----
     The rect is in the context's current user space. Bloom reads the
     canvas back through a chain of shrinking buffers (each halving is a
     box blur), raises it to the fourth power so only bright areas survive, and adds
     it on top. */
  var bufA = null, bufB = null, bufC = null, bufD = null;
  var ctxA, ctxB, ctxC, ctxD;
  function sizeBloom(aw, ah) {
    if (bufA && bufA.width === aw && bufA.height === ah) return;
    bufA = makeCanvas(aw, ah);
    bufB = makeCanvas(aw / 2, ah / 2);
    bufC = makeCanvas(aw / 4, ah / 4);
    bufD = makeCanvas(aw / 8, ah / 8);
    ctxA = bufA.getContext('2d');
    ctxB = bufB.getContext('2d');
    ctxC = bufC.getContext('2d');
    ctxD = bufD.getContext('2d');
  }

  /* (x, y) is where the rect sits on the canvas in logical pixels from
     the canvas origin, i.e. including any translate in force. */
  function post(c, themeName, x, y, w, h, ox, oy, bloom, grade, vignette) {
    var FX = Game.FX;
    var sz = sized(getTheme(themeName), w, h);
    if (FX.bloom && bloom > 0) {
      sizeBloom(Math.round(w / 2), Math.round(h / 2));
      ctxA.globalCompositeOperation = 'copy';
      ctxA.drawImage(c.canvas, (ox + x) * S, (oy + y) * S, w * S, h * S, 0, 0, bufA.width, bufA.height);
      ctxB.globalCompositeOperation = 'copy';
      ctxB.drawImage(bufA, 0, 0, bufB.width, bufB.height);
      ctxB.globalCompositeOperation = 'multiply';
      ctxB.drawImage(bufA, 0, 0, bufB.width, bufB.height);
      ctxB.drawImage(bufA, 0, 0, bufB.width, bufB.height);
      ctxB.drawImage(bufA, 0, 0, bufB.width, bufB.height);
      ctxC.globalCompositeOperation = 'copy';
      ctxC.drawImage(bufB, 0, 0, bufC.width, bufC.height);
      ctxD.globalCompositeOperation = 'copy';
      ctxD.drawImage(bufC, 0, 0, bufD.width, bufD.height);
      /* Fold the wider glows back together while the buffers are small,
         smooth the result up to half size, and let the canvas take that
         with a plain pixel-doubling blit: the glow is already too soft
         for the doubling to show, and an unfiltered blit is the only
         full-size one that stays cheap without a GPU. */
      ctxB.globalCompositeOperation = 'lighter';
      ctxB.drawImage(bufC, 0, 0, bufB.width, bufB.height);
      ctxB.drawImage(bufD, 0, 0, bufB.width, bufB.height);
      ctxA.drawImage(bufB, 0, 0, bufA.width, bufA.height);
      c.save();
      c.imageSmoothingEnabled = false;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = bloom * 0.34;
      c.drawImage(bufA, x, y, w, h);
      c.restore();
    }
    if (FX.grade && grade > 0) c.drawImage(sz.grade, x, y, w, h);
    if (FX.vignette && vignette > 0) {
      var ga = c.globalAlpha;
      c.globalAlpha = ga * vignette;
      c.drawImage(sz.vig, x, y, w, h);
      c.globalAlpha = ga;
    }
  }

  /* ---- Adaptive fallback ----
     A smoothed frame time above ~28 ms (under 36 fps) for a second and a
     half sheds the next tier of effects, most expensive first. */
  var TIERS = [['bloom'], ['lighting', 'grade', 'haze', 'foreground'], ['rays', 'caustics', 'vignette']];
  var ema = 16.7, slow = 0, tier = 0;
  function frame(delta) {
    ema += (delta - ema) * 0.05;
    if (!Game.FX.auto || tier >= TIERS.length) return;
    if (ema > 28) slow++; else if (slow > 0) slow--;
    if (slow > 90) {
      for (var i = 0; i < TIERS[tier].length; i++) Game.FX[TIERS[tier][i]] = false;
      tier++;
      slow = 0;
    }
  }

  Game.fx = {
    theme: function (name) { return (THEMES[name] || THEMES.reef); },
    /* Called by the engine whenever the backing store is resized. */
    setScale: function (s) {
      s = Math.min(2, s || 1);
      if (s === S) return;
      S = s;
      built = {};
      rayTex = {};
      nRay = 0;
      causticTex = null;
      rigs = null;
    },
    drawWater: drawWater,
    drawLayers: drawLayers,
    drawForeground: drawForeground,
    drawRays: drawRays,
    drawCaustics: drawCaustics,
    drawHaze: drawHaze,
    softShadow: softShadow,
    softGlow: softGlow,
    lit: lit,
    paintScene: paintScene,
    post: post,
    frame: frame,
    _ema: function () { return ema; },
    _tier: function () { return tier; },
    _setProbe: function (fn) { probe = fn; },
  };
})();
