/* ui.js – title screen, HUD, menus, dialogue, game over, victory, beach cutscene */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  var titleAnimTimer = 0;
  var titleBubbles = [];

  /* Initialise floating title bubbles */
  for (var i = 0; i < 30; i++) {
    titleBubbles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 2 + Math.random() * 6,
      speed: 0.3 + Math.random() * 0.8,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  /* ---- Helpers ---- */
  var FONT = '"M PLUS Rounded 1c", sans-serif';

  /* The rectangle the ambient backdrops fill, in game coordinates. It is
     the 800x480 viewport everywhere except on touch devices, where the
     engine widens it to the whole canvas for the title, customize, intro
     and victory screens so the sea fills the bezel instead of a dark
     frame. Everything else on those screens stays clipped to the
     viewport via clipGame(). */
  var VIEW = { x: 0, y: 0, w: W, h: H };
  /* Frames drawn, for backdrop animation that has no timer of its own */
  var uiClock = 0;
  function setView(x, y, w, h) { VIEW.x = x; VIEW.y = y; VIEW.w = w; VIEW.h = h; }
  function clipGame(c) { c.beginPath(); c.rect(0, 0, W, H); c.clip(); }

  /* True when the mouse is over the rect, in whatever coordinate space
     the caller is currently drawing in (the pointer is stored in
     backing-store pixels and mapped back through the live transform). */
  var anyHot = false;
  function pointerOver(c, x, y, w, h) {
    var p = Game.input && Game.input.pointer;
    if (!p || p.px < 0 || !c.getTransform) return false;
    var pt = c.getTransform().inverse().transformPoint(new DOMPoint(p.px, p.py));
    var over = pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
    if (over) anyHot = true;
    return over;
  }

  /* Shrink the current font until text fits maxW. Keeps the weight/family
     of the font string already set on the context. */
  function fitFont(c, text, maxW, size, weight) {
    while (size > 8) {
      c.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT;
      if (c.measureText(text).width <= maxW) break;
      size--;
    }
  }

  /* Rounded, glossy button with hover and press feedback. `style` picks a
     palette: undefined = standard sea-blue, 'primary' = coral call-to-
     action. */
  var BUTTON_PALETTES = {
    standard: { top: '#1f86a8', bot: '#0c4a6e', hTop: '#33a8cc', hBot: '#14648e', edge: '#7ce8ff' },
    primary:  { top: '#ff8e9c', bot: '#e04f6c', hTop: '#ffacb6', hBot: '#f06884', edge: '#ffe2e8' },
  };
  function drawButton(c, text, x, y, w, h, hover, style) {
    hover = hover || pointerOver(c, x, y, w, h);
    var pressed = hover && Game.input.pointer.down;
    var r = Math.min(12, h / 2);
    var pal = BUTTON_PALETTES[style] || BUTTON_PALETTES.standard;
    var oy = pressed ? 2 : 0;
    c.save();
    if (!pressed) {
      /* Two stacked shadows: a wide soft one and a tight dark one */
      c.fillStyle = 'rgba(2, 10, 34, 0.18)';
      roundRect(c, x - 2, y + 3, w + 4, h + 4, r + 2);
      c.fill();
      c.fillStyle = 'rgba(2, 10, 34, 0.4)';
      roundRect(c, x, y + 3, w, h, r);
      c.fill();
    }
    var g = c.createLinearGradient(0, y + oy, 0, y + oy + h);
    g.addColorStop(0, hover ? pal.hTop : pal.top);
    g.addColorStop(1, hover ? pal.hBot : pal.bot);
    c.fillStyle = g;
    roundRect(c, x, y + oy, w, h, r);
    c.fill();
    /* Shade gathering along the bottom edge, inside the shape */
    var sh = c.createLinearGradient(0, y + oy + h * 0.6, 0, y + oy + h);
    sh.addColorStop(0, 'rgba(0, 10, 40, 0)');
    sh.addColorStop(1, 'rgba(0, 10, 40, 0.28)');
    c.fillStyle = sh;
    c.fill();
    /* Glossy cap: bright at the top lip, gone by mid-height */
    var gl = c.createLinearGradient(0, y + oy + 2, 0, y + oy + 2 + h * 0.46);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    gl.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    c.fillStyle = gl;
    roundRect(c, x + 3, y + oy + 2, w - 6, h * 0.46, Math.max(2, r - 3));
    c.fill();
    c.strokeStyle = hover ? '#ffffff' : pal.edge;
    c.lineWidth = 2;
    roundRect(c, x, y + oy, w, h, r);
    c.stroke();
    /* Hairline inset just inside the rim */
    c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    c.lineWidth = 1;
    roundRect(c, x + 2.5, y + oy + 2.5, w - 5, h - 5, Math.max(2, r - 2.5));
    c.stroke();
    c.fillStyle = '#ffffff';
    fitFont(c, text, w - 16, Math.min(18, Math.round(h * 0.42)), 'bold');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0, 0, 0, 0.45)';
    c.shadowOffsetY = 1;
    c.fillText(text, x + w / 2, y + oy + h / 2 + 1);
    c.restore();
  }

  /* Menu card: stacked soft shadow, a body lit from above, a glossy cap,
     a bright rim and a hairline inset. */
  function drawPanel(c, x, y, w, h, r, top, bot, edge) {
    c.save();
    c.fillStyle = 'rgba(2, 10, 34, 0.12)';
    for (var s = 3; s >= 1; s--) {
      roundRect(c, x - s * 1.5, y + 2 + s * 2, w + s * 3, h + s, r + s * 1.5);
      c.fill();
    }
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    c.fillStyle = g;
    roundRect(c, x, y, w, h, r);
    c.fill();
    var capH = Math.min(h * 0.5, 48);
    var gl = c.createLinearGradient(0, y + 3, 0, y + 3 + capH);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    gl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = gl;
    roundRect(c, x + 3, y + 3, w - 6, capH, Math.max(2, r - 3));
    c.fill();
    c.strokeStyle = edge;
    c.lineWidth = 2;
    roundRect(c, x, y, w, h, r);
    c.stroke();
    c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    c.lineWidth = 1;
    roundRect(c, x + 4.5, y + 4.5, w - 9, h - 9, Math.max(2, r - 4));
    c.stroke();
    c.restore();
  }

  function hitButton(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  /* Split text into lines that fit maxWidth. Breaks on spaces, and falls
     back to per-character breaks for runs with no spaces (Japanese). */
  function layoutLines(c, text, maxWidth) {
    var out = [];
    var paras = text.split('\n');
    for (var li = 0; li < paras.length; li++) {
      var words = paras[li].split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        var test = line ? line + ' ' + word : word;
        if (c.measureText(test).width <= maxWidth) { line = test; continue; }
        if (line) { out.push(line); line = ''; }
        /* Word alone is too wide: break it character by character. */
        while (c.measureText(word).width > maxWidth && word.length > 1) {
          var n = word.length - 1;
          while (n > 1 && c.measureText(word.slice(0, n)).width > maxWidth) n--;
          /* Don't start a line with closing punctuation. */
          while (n > 1 && '、。！？」）ー'.indexOf(word.charAt(n)) >= 0) n--;
          out.push(word.slice(0, n));
          word = word.slice(n);
        }
        line = word;
      }
      out.push(line);
    }
    return out;
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var lines = layoutLines(c, text, maxWidth);
    for (var i = 0; i < lines.length; i++) c.fillText(lines[i], x, y + i * lineHeight);
    return lines.length * lineHeight;
  }

  /* ---- Sea backdrop shared by the title, intro and victory screens ----
     Deep-water gradient, a soft sun glow at the surface, sweeping light
     rays that fade with depth, and drifting highlighted bubbles. */
  function drawSeaBackdrop(c, t, bright, floorY) {
    var fx = Game.fx;
    fx.drawWater(c, 'reef', VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    if (!bright) {
      c.fillStyle = 'rgba(6, 24, 70, 0.22)';
      c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }

    /* Distant reef planes rising from the sea floor (or from the bottom
       edge where the screen has no floor), swaying a little against each
       other as if the camera were drifting, with the sun's shafts
       falling between them. */
    if (floorY === undefined) floorY = VIEW.y + VIEW.h - 40;
    var drift = 400 + Math.sin(t * 0.006) * 90;
    var x1 = VIEW.x + VIEW.w;
    fx.drawLayers(c, 'reef', drift, floorY, VIEW.x, x1, 0, 1);
    fx.drawRays(c, 0, t / 60, VIEW.x, VIEW.y, VIEW.w, VIEW.h, bright ? 0.6 : 0.45);
    fx.drawLayers(c, 'reef', drift, floorY, VIEW.x, x1, 2, 2);

    /* A tall tablet view has open water above the viewport: show the
       surface rippling at the top and a far-off school drifting by. */
    if (VIEW.y < -60) drawUpperWater(c, t);

    for (var i = 0; i < titleBubbles.length; i++) {
      var b = titleBubbles[i];
      b.wobble += 0.02;
      b.y -= b.speed;
      if (b.y < VIEW.y - 10) { b.y = VIEW.y + VIEW.h + 10; b.x = VIEW.x + Math.random() * VIEW.w; }
      var bx = b.x + Math.sin(b.wobble) * 15;
      c.save();
      c.globalAlpha = 0.35;
      c.strokeStyle = '#a8e4ff';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(bx, b.y, b.r, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(140, 210, 255, 0.35)';
      c.fill();
      c.globalAlpha = 0.7;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(bx - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.8, b.r * 0.25), 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  /* Surface ripple along the top of the view and a faint school of
     distant fish crossing the water above the viewport. Only reached
     when the view extends well above the 800x480 window. */
  function drawUpperWater(c, t) {
    var x0 = VIEW.x, x1 = VIEW.x + VIEW.w, sy = VIEW.y + 16;
    var sg = c.createLinearGradient(0, VIEW.y, 0, sy + 30);
    sg.addColorStop(0, 'rgba(190, 240, 255, 0.28)');
    sg.addColorStop(1, 'rgba(190, 240, 255, 0)');
    c.fillStyle = sg;
    c.fillRect(x0, VIEW.y, VIEW.w, sy + 30 - VIEW.y);
    c.save();
    c.strokeStyle = 'rgba(220, 248, 255, 0.55)';
    c.lineWidth = 2;
    c.beginPath();
    for (var x = x0; x <= x1 + 10; x += 10) {
      var y = sy + Math.sin(x * 0.02 + t * 0.03) * 3 + Math.sin(x * 0.047 - t * 0.02) * 1.5;
      if (x === x0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    /* The school: small silhouettes in a loose wedge, swimming right. */
    var span = VIEW.w + 300;
    var lead = x0 - 150 + ((t * 0.5 + VIEW.w * 0.6) % span);
    var midY = VIEW.y + (-VIEW.y) * 0.55;
    c.fillStyle = 'rgba(6, 30, 58, 0.45)';
    for (var f = 0; f < 11; f++) {
      var fx = lead - (f % 4) * 22 - Math.floor(f / 4) * 30;
      var fy = midY + ((f * 37) % 50) - 25 + Math.sin(t * 0.04 + f) * 3;
      var s = 0.8 + (f % 3) * 0.15;
      c.beginPath();
      c.ellipse(fx, fy, 8 * s, 3.4 * s, 0, 0, Math.PI * 2);
      c.moveTo(fx - 7 * s, fy);
      c.lineTo(fx - 13 * s, fy - 4 * s);
      c.lineTo(fx - 13 * s, fy + 4 * s);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /* Sandy reef foreground along the bottom edge: a sand bank, corals and
     swaying seaweed clustered at both sides so the centre stays clear. */
  var FG_CORALS = [
    { x: 40, y: 452, v: 2 }, { x: 96, y: 446, v: 0 }, { x: 196, y: 458, v: 1 },
    { x: 612, y: 458, v: 1 }, { x: 700, y: 446, v: 0 }, { x: 762, y: 452, v: 2 },
  ];
  var FG_WEEDS = [
    { x: 18, h: 110 }, { x: 64, h: 80 }, { x: 140, h: 120 }, { x: 236, h: 70 },
    { x: 566, h: 76 }, { x: 650, h: 124 }, { x: 732, h: 92 }, { x: 786, h: 112 },
  ];
  /* The sand bank alone, spanning the whole view rect so it runs on under
     the bezel when the view is widened. Painted before clipGame(). */
  function drawReefSand(c, top) {
    /* `top` is the ridge height; the title and victory use 448, screens
       whose viewport content runs to the bottom put it below the window. */
    top = top || 448;
    var x0 = VIEW.x, x1 = VIEW.x + VIEW.w, bottom = VIEW.y + VIEW.h;
    /* Below the viewport the sand keeps darkening into the deep, so a
       tall bezel reads as sea floor rather than a flat brown slab. */
    var deep = Math.max(top + 32, bottom);
    var sg = c.createLinearGradient(0, top - 8, 0, deep);
    sg.addColorStop(0, '#ecd6a4');
    sg.addColorStop(Math.min(1, 46 / (deep - top + 8)), '#a3855a');
    sg.addColorStop(1, '#3a2c20');
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(x0, bottom);
    for (var x = x0; x <= x1 + 10; x += 10) {
      c.lineTo(x, sandRidgeY(x, top));
    }
    c.lineTo(x1, bottom);
    c.closePath();
    c.fill();
    /* Sunlight net on the sand nearest the surface */
    c.save();
    c.clip();
    Game.fx.drawCaustics(c, 0, uiClock / 60, x0, x1, top - 12, Math.min(bottom, top + 150), 0.5);
    c.restore();
    c.strokeStyle = 'rgba(255, 248, 220, 0.7)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (var x2 = x0; x2 <= x1 + 10; x2 += 10) {
      var y2 = sandRidgeY(x2, top) + 1;
      if (x2 === x0) c.moveTo(x2, y2); else c.lineTo(x2, y2);
    }
    c.stroke();

    /* A few half-buried pebbles on the deeper sand, placed by a fixed
       hash so they never shimmer between frames. */
    if (bottom > top + 62) {
      c.fillStyle = 'rgba(255, 240, 200, 0.10)';
      c.strokeStyle = 'rgba(255, 240, 200, 0.16)';
      c.lineWidth = 1;
      for (var px = Math.floor(x0 / 90) * 90; px < x1; px += 90) {
        for (var py = top + 52; py < bottom - 10; py += 56) {
          var h = ((px * 7919) ^ (py * 104729)) & 1023;
          if ((h & 3) !== 0) continue;
          var ox = px + (h % 70), oy = py + ((h >> 5) % 40);
          var rw = 6 + (h % 7), rh = 2.5 + ((h >> 3) % 3);
          c.beginPath(); c.ellipse(ox, oy, rw, rh, 0, 0, Math.PI * 2);
          c.fill(); c.stroke();
        }
      }
    }
  }

  function sandRidgeY(x, top) {
    return top + Math.sin(x * 0.011) * 6 + Math.sin(x * 0.031) * 3;
  }

  /* One swaying kelp blade rooted at (x, base). */
  function drawWeed(c, x, base, h, sway) {
    var wg = c.createLinearGradient(0, base - h, 0, base);
    wg.addColorStop(0, '#5fd38a');
    wg.addColorStop(1, '#16603a');
    c.fillStyle = wg;
    c.beginPath();
    c.moveTo(x - 5, base);
    c.bezierCurveTo(x - 12 + sway * 0.4, base - h * 0.4, x - 4 + sway, base - h * 0.75, x + sway * 1.2, base - h);
    c.bezierCurveTo(x + 8 + sway, base - h * 0.7, x + 6 + sway * 0.4, base - h * 0.35, x + 6, base);
    c.closePath();
    c.fill();
  }

  /* Reef growth on the sand outside the 800x480 window, so on a tablet
     the corals and kelp run on to the screen edges instead of stopping
     at the viewport. With `top` below the window (customize, intro) the
     whole width is decorated with smaller pieces that stay clear of the
     window content. Painted before clipGame(). */
  var SIDE_DECOR = [
    { dx: 0, k: 'weed', h: 108 }, { dx: 30, k: 'coral', v: 1 }, { dx: 74, k: 'weed', h: 78 },
    { dx: 118, k: 'coral', v: 0 }, { dx: 150, k: 'star' }, { dx: 182, k: 'weed', h: 124 },
    { dx: 214, k: 'coral', v: 2 }, { dx: 262, k: 'weed', h: 66 },
  ];
  function drawReefSides(c, t, top) {
    var inside = top < H;
    if (inside ? VIEW.x > -40 : VIEW.y + VIEW.h < top + 40) return;
    var x0 = VIEW.x, x1 = VIEW.x + VIEW.w, scale = inside ? 1 : 0.5;
    for (var tx = Math.floor(x0 / 300) * 300; tx < x1 + 40; tx += 300) {
      for (var d = 0; d < SIDE_DECOR.length; d++) {
        var it = SIDE_DECOR[d], x = tx + it.dx;
        if (x < x0 - 30 || x > x1 + 30) continue;
        if (inside && x > -16 && x < W + 16) continue;
        var ry = sandRidgeY(x, top);
        if (it.k === 'weed') {
          drawWeed(c, x, inside ? H : ry + 12, it.h * scale, Math.sin(t * 0.025 + x * 0.07) * 10 * scale);
        } else if (it.k === 'coral' && Game.engine && Game.engine.drawCoral) {
          c.save();
          c.translate(x, ry + 4);
          c.scale(1.5 * scale, 1.5 * scale);
          Game.engine.drawCoral(c, 0, 0, it.v, x);
          c.restore();
        } else if (it.k === 'star') {
          drawStarfish(c, x, ry + 10, 9 * scale + 2, x * 0.37, '#ff9a6a');
        }
      }
    }
  }

  /* Screens whose content fills the window (customize, intro) get their
     sea floor just below it when the tablet view leaves room there. */
  function floorBelowY() {
    return VIEW.y + VIEW.h < H + 90 ? undefined : H + 34;
  }
  function drawFloorBelow(c, t) {
    if (VIEW.y + VIEW.h < H + 90) return;
    drawReefSand(c, H + 34);
    drawReefSides(c, t, H + 34);
  }

  function drawReefForeground(c, t) {
    drawReefSand(c);

    for (var w = 0; w < FG_WEEDS.length; w++) {
      var wd = FG_WEEDS[w];
      drawWeed(c, wd.x, H, wd.h, Math.sin(t * 0.025 + w * 1.3) * 10);
    }
    if (Game.engine && Game.engine.drawCoral) {
      for (var k = 0; k < FG_CORALS.length; k++) {
        var fc = FG_CORALS[k];
        c.save();
        c.translate(fc.x, fc.y);
        c.scale(1.5, 1.5);
        Game.engine.drawCoral(c, 0, 0, fc.v, fc.x);
        c.restore();
      }
    }
  }

  /* Big outlined logo text with a gentle per-letter bob. All outlines are
     stroked first so a letter's outline never covers its neighbour. */
  function drawLogoText(c, text, cx, cy, size, t) {
    c.save();
    fitFont(c, text, W - 90, size, 'bold');
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    var chars = text.split('');
    var widths = [], total = 0;
    for (var i = 0; i < chars.length; i++) { widths.push(c.measureText(chars[i]).width); total += widths[i]; }
    var x0 = cx - total / 2;
    var g = c.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#9ff2ff');
    g.addColorStop(1, '#44b4ff');
    c.lineJoin = 'round';
    for (var pass = 0; pass < 3; pass++) {
      var x = x0;
      for (var j = 0; j < chars.length; j++) {
        var y = cy + Math.sin(t * 0.05 + j * 0.45) * 3;
        if (pass === 0) {
          c.fillStyle = 'rgba(2, 16, 40, 0.6)';
          c.fillText(chars[j], x + 2, y + 5);
        } else if (pass === 1) {
          c.shadowColor = 'rgba(80, 210, 255, 0.6)';
          c.shadowBlur = 14;
          c.strokeStyle = '#0b2f5c';
          c.lineWidth = 8;
          c.strokeText(chars[j], x, y);
          c.shadowBlur = 0;
        } else {
          c.fillStyle = g;
          c.fillText(chars[j], x, y);
        }
        x += widths[j];
      }
    }
    c.restore();
  }

  /* Title fish: real Fish entities, positioned by hand each frame. */
  var titleFish = null;
  function drawTitleFish(c, t) {
    if (!Game.entities || !Game.entities.Fish) return;
    if (!titleFish) {
      titleFish = [
        { f: new Game.entities.Fish(0, 0, 'straight', 1, 'clownfish'), y: 262, sp: 0.7, ph: 0, s: 1.6 },
        { f: new Game.entities.Fish(0, 0, 'straight', -1, 'angelfish'), y: 336, sp: 0.5, ph: 300, s: 1.5 },
        { f: new Game.entities.Fish(0, 0, 'straight', 1, 'tropical'), y: 178, sp: 0.45, ph: 520, s: 1.2 },
      ];
    }
    for (var i = 0; i < titleFish.length; i++) {
      var tf = titleFish[i], f = tf.f;
      var span = W + 160;
      var x = ((t * tf.sp + tf.ph) % span) - 80;
      if (f.dir === -1) x = W - x;
      f.timer = t;
      f.x = 0;
      f.y = 0;
      c.save();
      c.translate(x, tf.y + Math.sin(t * 0.03 + i * 2) * 6);
      c.scale(tf.s, tf.s);
      f.draw(c, f.w / 2, f.h / 2);
      c.restore();
    }
  }

  /* ---- Title Screen ---- */
  function drawTitleScreen(c) {
    titleAnimTimer++;
    var t = titleAnimTimer;

    drawSeaBackdrop(c, t, false, 448);
    drawReefSand(c);
    drawReefSides(c, t, 448);
    clipGame(c);
    drawTitleFish(c, t);

    /* Momoko swimming on the spot at the left, trailing bubbles */
    var mx = 160, my = 286 + Math.sin(t * 0.04) * 10;
    for (var bb = 0; bb < 7; bb++) {
      var age = (t + bb * 17) % 120;
      c.save();
      c.globalAlpha = (1 - age / 120) * 0.7;
      c.strokeStyle = '#d8f4ff';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(mx + 14 + Math.sin(age * 0.12 + bb) * 5, my - 10 - age * 0.9, 2 + (bb % 3), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    c.save();
    c.translate(mx, my);
    c.rotate(0.08 + Math.sin(t * 0.03) * 0.08);
    c.scale(2.8, 2.8);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, -14, -17, Game.customization, Math.floor(t / 8) % 4);
    }
    c.restore();

    drawReefForeground(c, t);

    /* Logo title */
    drawLogoText(c, Game.i18n.t('title'), W / 2, 92, 44, t);

    /* Subtitle */
    c.save();
    c.font = 'bold 15px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(6, 30, 60, 0.8)';
    c.strokeText(Game.i18n.t('titleSubtitle'), W / 2, 142);
    c.fillStyle = '#cdeeff';
    c.fillText(Game.i18n.t('titleSubtitle'), W / 2, 142);
    c.restore();

    /* Buttons */
    drawButton(c, Game.i18n.t('play'), W / 2 - 90, 200, 180, 44, false, 'primary');
    drawButton(c, Game.i18n.t('howToPlay'), W / 2 - 90, 260, 180, 44);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 90, 320, 180, 44);

    /* Sound toggle */
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 90, 380, 180, 36);

    /* Instructions overlay flag */
    return false;
  }

  var showInstructions = false;

  function drawInstructionsOverlay(c) {
    c.save();
    /* The title buttons underneath aren't clickable while this is up. */
    anyHot = false;
    c.fillStyle = 'rgba(2, 10, 24, 0.7)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    drawPanel(c, 110, 40, W - 220, 380, 16, 'rgba(16, 58, 104, 0.98)', 'rgba(6, 24, 54, 0.98)', '#7ce8ff');
    c.textAlign = 'center';
    drawHeading(c, Game.i18n.t('howToPlay'), W / 2, 80, 26, '#9ff2ff');
    /* One illustrated row per instruction line: keycaps / icon on the
       left, the text beside it. */
    var lines = Game.i18n.t('instructions').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var ry = 118 + i * 56;
      c.fillStyle = 'rgba(124, 232, 255, 0.07)';
      roundRect(c, 140, ry, W - 280, 46, 10);
      c.fill();
      drawHowToIcon(c, i, 222, ry + 23);
      c.fillStyle = '#e2f2ff';
      fitFont(c, lines[i], W - 280 - 170, 16, 'bold');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(lines[i], 300, ry + 24);
    }
    c.textBaseline = 'alphabetic';
    drawButton(c, 'OK', W / 2 - 60, 350, 120, 40);
    c.restore();
  }

  function drawKeycap(c, x, y, w, h, label) {
    c.fillStyle = '#05182e';
    roundRect(c, x, y + 2, w, h, 5);
    c.fill();
    c.fillStyle = '#d8ecff';
    roundRect(c, x, y, w, h, 5);
    c.fill();
    c.fillStyle = '#ffffff';
    roundRect(c, x + 2, y + 1.5, w - 4, h * 0.45, 4);
    c.fill();
    c.fillStyle = '#123a5e';
    c.font = 'bold ' + Math.round(h * 0.5) + 'px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + h / 2 + 1);
  }

  /* Row icons for the how-to-play overlay: 0 swim, 1 bubble, 2 pause,
     3 goal. */
  function drawHowToIcon(c, row, cx, cy) {
    c.save();
    if (row === 0) {
      drawKeycap(c, cx - 9, cy - 19, 18, 17, '\u25B2');
      drawKeycap(c, cx - 29, cy + 1, 18, 17, '\u25C0');
      drawKeycap(c, cx - 9, cy + 1, 18, 17, '\u25BC');
      drawKeycap(c, cx + 11, cy + 1, 18, 17, '\u25B6');
    } else if (row === 1) {
      drawKeycap(c, cx - 46, cy - 10, 62, 20, 'Space');
      c.strokeStyle = '#a8e4ff';
      c.fillStyle = 'rgba(140, 210, 255, 0.35)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx + 32, cy, 9, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(cx + 46, cy - 8, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(cx + 29, cy - 3, 2.2, 0, Math.PI * 2); c.fill();
    } else if (row === 2) {
      drawKeycap(c, cx - 38, cy - 10, 34, 20, 'Esc');
      drawKeycap(c, cx + 2, cy - 10, 22, 20, 'P');
      c.fillStyle = '#7ce8ff';
      c.fillRect(cx + 32, cy - 8, 4, 16);
      c.fillRect(cx + 40, cy - 8, 4, 16);
    } else {
      drawStarfish(c, cx - 14, cy, 15, 0.1, '#ffcc44');
      c.fillStyle = '#ff5577';
      drawHeart(c, cx + 22, cy + 2, 12);
    }
    c.restore();
  }

  /* Title click handler – returns action string or null */
  function handleTitleClick(mx, my) {
    if (showInstructions) {
      if (hitButton(mx, my, W / 2 - 60, 350, 120, 40)) {
        showInstructions = false;
        Game.audio.play('select');
        return null;
      }
      return null;
    }
    if (hitButton(mx, my, W / 2 - 90, 200, 180, 44)) { Game.audio.play('select'); return 'play'; }
    if (hitButton(mx, my, W / 2 - 90, 260, 180, 44)) { Game.audio.play('select'); showInstructions = true; return null; }
    if (hitButton(mx, my, W / 2 - 90, 320, 180, 44)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 90, 380, 180, 36)) { Game.audio.toggleMute(); return null; }
    return null;
  }

  /* ---- HUD ---- */
  /* HUD plate: smoked glass with a bevelled rim, lit along its top
     edge, casting a soft shadow on the scene behind it. */
  function hudPlate(c, x, y, w, h) {
    var r = h / 2;
    c.fillStyle = 'rgba(0, 6, 20, 0.28)';
    roundRect(c, x - 1, y + 1.5, w + 2, h + 2, r + 1);
    c.fill();
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(22, 64, 112, 0.86)');
    g.addColorStop(0.5, 'rgba(6, 26, 58, 0.86)');
    g.addColorStop(1, 'rgba(4, 16, 40, 0.9)');
    c.fillStyle = g;
    roundRect(c, x, y, w, h, r);
    c.fill();
    /* glass sheen over the top half */
    var sh = c.createLinearGradient(0, y + 1, 0, y + h * 0.5);
    sh.addColorStop(0, 'rgba(190, 240, 255, 0.22)');
    sh.addColorStop(1, 'rgba(190, 240, 255, 0)');
    c.fillStyle = sh;
    roundRect(c, x + 2, y + 1.5, w - 4, h * 0.5, r - 2);
    c.fill();
    var rim = c.createLinearGradient(0, y, 0, y + h);
    rim.addColorStop(0, 'rgba(160, 240, 255, 0.85)');
    rim.addColorStop(0.55, 'rgba(90, 190, 240, 0.35)');
    rim.addColorStop(1, 'rgba(60, 140, 210, 0.55)');
    c.strokeStyle = rim;
    c.lineWidth = 1.2;
    roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
    c.stroke();
  }

  var hudPearls = -1, hudPop = 0, hudHealth = -1, hudHurt = 0;
  /* Max-heart growth: hudSlots eases toward maxHealth so the plate widens
     smoothly, hudGrow pops the new slot in, hudGain runs the "+1" label. */
  var hudMax = -1, hudSlots = 5, hudGrow = 0, hudGain = 0;
  /* Up to HUD_ROW_MAX hearts sit in one row that compacts to fit
     HUD_HEARTS_W (room for the pearl counter left of the boss bar); more
     than that collapse into a heart plus "7/12". */
  var HUD_ROW_MAX = 8, HUD_HEARTS_W = 188;

  /* One HUD heart centred on (hx, hy): ink rim, then a glossy full heart
     or an empty socket. */
  function drawHudHeart(c, hx, hy, full) {
    c.fillStyle = full ? '#4a0a20' : 'rgba(14, 6, 28, 0.9)';
    drawHeart(c, hx, hy + 0.6, 12.6);
    if (full) {
      var hg = c.createLinearGradient(0, hy - 9, 0, hy + 4);
      hg.addColorStop(0, '#ff8aa4');
      hg.addColorStop(0.45, '#ff3a5c');
      hg.addColorStop(1, '#c0123a');
      c.fillStyle = hg;
      drawHeart(c, hx, hy, 10);
      /* gloss and a pinpoint glint */
      c.fillStyle = 'rgba(255, 255, 255, 0.6)';
      c.beginPath();
      c.ellipse(hx - 4, hy - 5.4, 2.6, 1.6, -0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(hx - 5.2, hy - 6, 0.8, 0, Math.PI * 2);
      c.fill();
    } else {
      /* Empty socket, shadowed inside */
      var eg = c.createLinearGradient(0, hy - 9, 0, hy + 4);
      eg.addColorStop(0, '#1e1430');
      eg.addColorStop(1, '#4a3a62');
      c.fillStyle = eg;
      drawHeart(c, hx, hy, 10);
    }
  }

  /* Ease-out with overshoot, 0 -> 1 */
  function backOut(t) {
    var u = t - 1;
    return 1 + 2.70158 * u * u * u + 1.70158 * u * u;
  }

  function drawHUD(c, player, pearls, pearlTotal) {
    /* Short pops when a pearl is picked up or a heart is lost */
    if (hudPearls >= 0 && pearls > hudPearls) hudPop = 1;
    hudPearls = pearls;
    if (hudHealth >= 0 && player.health < hudHealth) hudHurt = 1;
    hudHealth = player.health;
    /* A new level (max back to 5) snaps; a pickup grows */
    if (hudMax < 0 || player.maxHealth < hudMax) hudSlots = player.maxHealth;
    else if (player.maxHealth > hudMax) { hudGrow = 1; hudGain = 1; }
    hudMax = player.maxHealth;
    hudSlots += (hudMax - hudSlots) * 0.18;
    if (Math.abs(hudMax - hudSlots) < 0.01) hudSlots = hudMax;
    hudPop = Math.max(0, hudPop - 0.06);
    hudHurt = Math.max(0, hudHurt - 0.05);
    hudGrow = Math.max(0, hudGrow - 0.035);
    hudGain = Math.max(0, hudGain - 0.011);
    var now = Date.now() * 0.001;
    var hy = 21, i, beat, labelX;
    var heartsW;
    /* The last heart beats when she is down to one or two */
    var lowBeat = player.health <= 2 ? 1 + Math.max(0, Math.sin(now * 7)) * 0.12 : 1;

    if (hudMax <= HUD_ROW_MAX) {
      /* Hearts on a glass plate so sprites drifting past never swallow them */
      var slot = Math.min(28, (HUD_HEARTS_W - 2) / hudSlots);
      var k = slot / 28;
      heartsW = hudSlots * slot + 2;
      hudPlate(c, 3, 5, heartsW, 28);
      for (i = 0; i < hudMax; i++) {
        var hx = 3 + slot * (i + 0.5);
        var full = i < player.health;
        beat = full && i === player.health - 1 ? lowBeat : 1;
        if (i === player.health && hudHurt > 0) beat = 1 + hudHurt * 0.35;
        if (hudGrow > 0) {
          if (i === hudMax - 1) beat = backOut(1 - hudGrow);
          else if (i === player.health - 1) beat = 1 + hudGrow * 0.35;
        }
        if (i === hudMax - 1 && hudGrow > 0) {
          /* pink bloom behind the slot that just appeared */
          var bl = c.createRadialGradient(hx, hy - 1, 1, hx, hy - 1, 20);
          bl.addColorStop(0, 'rgba(255, 150, 190, ' + (0.7 * hudGrow) + ')');
          bl.addColorStop(1, 'rgba(255, 150, 190, 0)');
          c.fillStyle = bl;
          c.fillRect(hx - 20, hy - 21, 40, 40);
        }
        c.save();
        c.translate(hx, hy - 1);
        c.scale(beat * k, beat * k);
        c.translate(-hx, -(hy - 1));
        drawHudHeart(c, hx, hy, full);
        c.restore();
      }
      labelX = 3 + slot * (hudMax - 0.5);
    } else {
      /* Long rows collapse to one heart and "health/max" */
      var cur = String(player.health), tot = '/' + hudMax;
      c.save();
      c.font = 'bold 17px ' + FONT;
      var cw = c.measureText(cur).width;
      c.font = 'bold 13px ' + FONT;
      var tw2 = c.measureText(tot).width;
      heartsW = 34 + cw + tw2 + 10;
      hudPlate(c, 3, 5, heartsW, 28);
      beat = hudHurt > 0 ? 1 + hudHurt * 0.35 : (hudGrow > 0 ? 1 + Math.sin((1 - hudGrow) * Math.PI) * 0.45 : lowBeat);
      if (hudGrow > 0) {
        var bl2 = c.createRadialGradient(20, hy - 1, 1, 20, hy - 1, 20);
        bl2.addColorStop(0, 'rgba(255, 150, 190, ' + (0.7 * hudGrow) + ')');
        bl2.addColorStop(1, 'rgba(255, 150, 190, 0)');
        c.fillStyle = bl2;
        c.fillRect(0, 0, 40, 40);
      }
      c.translate(20, hy - 1);
      c.scale(beat, beat);
      c.translate(-20, -(hy - 1));
      drawHudHeart(c, 20, hy, player.health > 0);
      c.restore();
      c.save();
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(30, 6, 18, 0.85)';
      c.font = 'bold 17px ' + FONT;
      c.strokeText(cur, 37, 20);
      c.fillStyle = hudGrow > 0 ? '#ffd0de' : '#ffffff';
      c.fillText(cur, 37, 20);
      c.font = 'bold 13px ' + FONT;
      c.strokeText(tot, 37 + cw + 1, 21);
      c.fillStyle = hudGrow > 0 ? '#ffd0de' : '#ffc2d2';
      c.fillText(tot, 37 + cw + 1, 21);
      c.restore();
      labelX = 3 + heartsW / 2;
    }

    /* "+1 ♥ MAX" floats up under the hearts after a pickup */
    if (hudGain > 0) {
      var parts = Game.i18n.t('heartMaxUp').split('\u2665');
      c.save();
      c.font = 'bold 14px ' + FONT;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      var widths = [], lw = 0;
      for (i = 0; i < parts.length; i++) {
        widths.push(c.measureText(parts[i]).width);
        lw += widths[i] + (i > 0 ? 18 : 0);
      }
      var lx = Math.max(6, labelX - lw / 2);
      var ly = 46 + hudGain * 12;
      c.globalAlpha = hudGain > 0.25 ? Math.min(1, (1 - hudGain) * 8) : hudGain / 0.25;
      for (i = 0; i < parts.length; i++) {
        if (i > 0) {
          c.fillStyle = '#4a0a20';
          drawHeart(c, lx + 9, ly + 2.6, 10);
          c.fillStyle = '#ff4a6c';
          drawHeart(c, lx + 9, ly + 2.2, 8);
          lx += 18;
        }
        c.strokeStyle = 'rgba(30, 6, 18, 0.85)';
        c.strokeText(parts[i], lx, ly);
        c.fillStyle = '#ffe0ea';
        c.fillText(parts[i], lx, ly);
        lx += widths[i];
      }
      c.restore();
    }

    /* Pearl counter beside the hearts: icon plus "12/30" */
    if (pearlTotal) {
      var text = pearls + '/' + pearlTotal;
      c.save();
      c.font = 'bold 15px ' + FONT;
      var tw = c.measureText(text).width;
      var px = 3 + heartsW + 8;
      var pw = tw + 36;
      hudPlate(c, px, 5, pw, 28);
      /* soft glow behind the pearl, flaring on a pickup */
      var gl = c.createRadialGradient(px + 15, 19, 1, px + 15, 19, 13 + hudPop * 5);
      gl.addColorStop(0, 'rgba(255, 236, 250, ' + (0.35 + hudPop * 0.4) + ')');
      gl.addColorStop(1, 'rgba(255, 236, 250, 0)');
      c.fillStyle = gl;
      c.fillRect(px - 4, 0, 38, 38);
      drawPearlIcon(c, px + 15, 19, 8 * (1 + hudPop * 0.25));
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(30, 6, 18, 0.85)';
      c.strokeText(text, px + 29, 20);
      c.fillStyle = hudPop > 0 ? 'rgb(255,' + Math.round(255 - hudPop * 50) + ',' + Math.round(255 - hudPop * 120) + ')' : '#ffffff';
      c.fillText(text, px + 29, 20);
      c.restore();
    }

    /* Version stamp (bottom-right) – matches the title screen so the
       running build is visible during gameplay too. */
    if (Game.VERSION) {
      c.save();
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      c.font = '11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
      c.fillText(stamp, W - 8, H - 8);
      c.restore();
    }
  }

  /* Bottom-right corner of the view rect: the screen corner on tablet
     full-bleed / dimmed screens, the viewport corner everywhere else. */
  function drawVersionStamp(c, color) {
    if (!Game.VERSION) return;
    c.save();
    c.fillStyle = color;
    c.font = '11px ' + FONT;
    c.textAlign = 'right';
    c.textBaseline = 'alphabetic';
    /* Dark keyline so the stamp reads on bright sand as well as on water */
    c.lineJoin = 'round';
    c.lineWidth = 2.5;
    c.strokeStyle = 'rgba(4, 16, 40, 0.6)';
    c.strokeText(Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : ''), VIEW.x + VIEW.w - 8, VIEW.y + VIEW.h - 8);
    c.fillText(Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : ''), VIEW.x + VIEW.w - 8, VIEW.y + VIEW.h - 8);
    c.restore();
  }

  /* Menu heading in the outlined, glowing style the title, game-over and
     victory text use. Expects textAlign/baseline already set. */
  function drawHeading(c, text, x, y, size, fill) {
    c.save();
    fitFont(c, text, 360, size, 'bold');
    c.lineJoin = 'round';
    c.lineWidth = 7;
    c.strokeStyle = '#0b2f5c';
    c.shadowColor = 'rgba(80, 210, 255, 0.55)';
    c.shadowBlur = 12;
    c.strokeText(text, x, y);
    c.shadowBlur = 0;
    c.fillStyle = fill;
    c.fillText(text, x, y);
    c.restore();
  }

  function drawHeart(c, cx, cy, size) {
    c.save();
    c.beginPath();
    c.moveTo(cx, cy + size * 0.3);
    c.bezierCurveTo(cx - size, cy - size * 0.4, cx - size, cy - size * 0.9, cx, cy - size * 0.4);
    c.bezierCurveTo(cx + size, cy - size * 0.9, cx + size, cy - size * 0.4, cx, cy + size * 0.3);
    c.fill();
    c.restore();
  }

  /* ---- Pause Menu ---- */
  var pauseFlossTimer = 0;
  function drawPauseMenu(c) {
    pauseFlossTimer++;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    c.textAlign = 'center';
    /* Centred over the button column and below the waterline scallops. */
    drawHeading(c, Game.i18n.t('paused'), W / 2 + 100, 130, 34, '#9ff2ff');

    /* Floss-dance Momoko – phase advances at ~1.7Hz and the pose math
       smooths the beat with a tanh sigmoid so she transitions between
       sides across several frames instead of snapping between two.
       Placed to the left of the menu buttons so she's visible but not
       competing for space. */
    if (Game.entities && Game.entities.drawMomokoFloss) {
      c.save();
      c.translate(170, 220);
      c.scale(3.5, 3.5);
      Game.entities.drawMomokoFloss(c, 0, 0, Game.customization, pauseFlossTimer * 0.18);
      c.restore();
    }

    drawButton(c, Game.i18n.t('resume'), W / 2 - 10, 170, 220, 44);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 10, 230, 220, 44);
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 10, 290, 220, 44);
    drawButton(c, Game.i18n.t('levelSelect'), W / 2 - 10, 350, 220, 44);

    /* Version stamp – matches the title-screen stamp so we can tell at a
       glance which build is paused (handy for bug reports). */
    drawVersionStamp(c, '#6688aa');
    c.restore();
  }

  function handlePauseClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 10, 170, 220, 44)) { Game.audio.play('select'); return 'resume'; }
    if (hitButton(mx, my, W / 2 - 10, 230, 220, 44)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 10, 290, 220, 44)) { Game.audio.toggleMute(); return null; }
    if (hitButton(mx, my, W / 2 - 10, 350, 220, 44)) { Game.audio.play('select'); return 'quit'; }
    return null;
  }

  /* ---- QR code ----
     Pre-computed Version-4 QR matrix (33×33 modules, error-correction
     level M) encoding the game's public URL. Generated offline; see the
     commit notes. Rendered in canvas-space so it sits in the empty
     upper-right strip area, inviting someone else to scan and play. */
  var QR_URL = 'https://ruck314.github.io/momokos-underwater-world/';
  var QR_SIZE = 33;
  var QR_ROWS = [
    '111111100010000010111011101111111',
    '100000100101100110101110001000001',
    '101110101111101110001111101011101',
    '101110101111000000100010101011101',
    '101110101111011110001111101011101',
    '100000101000111001110100101000001',
    '111111101010101010101010101111111',
    '000000001000101010111111100000000',
    '101111100011011001111000001111100',
    '110010001110010011111111101101101',
    '011010101000011111000010000010100',
    '101110001011010011100111101011111',
    '110101100010001010010011010011000',
    '010101011111000101100101011001011',
    '110100100001101111001110011001110',
    '011000010010101100111100011001100',
    '001101110101101101010000110111001',
    '111100011111110010111001011101111',
    '101001101011101110100010010110110',
    '101001001110111110001111111111111',
    '010110111011100000100010110111011',
    '110000000111011111010011001001101',
    '100011101101101000100010100101110',
    '101101010011110010001100001001111',
    '100001111010111001001010111110000',
    '000000001010010011111100100010101',
    '111111100001101111001001101010110',
    '100000101111100011100101100011111',
    '101110101101011010010010111111001',
    '101110101001010101111101110011011',
    '101110101011101111000011111100000',
    '100000100101001100001111000011100',
    '111111101100110101110011110100010',
  ];

  /* Paints the QR code centered in the rect (cx, cy, size) with a white
     quiet zone so scanners don't choke on adjacent canvas colour. */
  function drawQRCode(c, cx, cy, size) {
    var quiet = 4; /* modules of white padding around the code */
    var totalModules = QR_SIZE + quiet * 2;
    var cell = Math.floor(size / totalModules);
    if (cell < 1) cell = 1;
    var rendered = cell * totalModules;
    var x0 = Math.round(cx - rendered / 2);
    var y0 = Math.round(cy - rendered / 2);
    c.save();
    /* White background (includes quiet zone) */
    c.fillStyle = '#ffffff';
    c.fillRect(x0, y0, rendered, rendered);
    c.fillStyle = '#000000';
    for (var r = 0; r < QR_SIZE; r++) {
      var row = QR_ROWS[r];
      for (var q = 0; q < QR_SIZE; q++) {
        if (row.charAt(q) === '1') {
          c.fillRect(
            x0 + (q + quiet) * cell,
            y0 + (r + quiet) * cell,
            cell, cell
          );
        }
      }
    }
    /* "SCAN" caption below */
    c.fillStyle = '#cfe6ff';
    c.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillText('SCAN TO PLAY', cx, y0 + rendered + 14);
    c.restore();
  }

  /* ---- Dialogue Box ----
     Drawn in canvas-space (NOT game-space) so it lives in the bottom
     bezel area on touch devices and doesn't obscure gameplay. Caller
     supplies the canvas dimensions and where the game viewport sits
     inside them; the box floats below the viewport if there's bezel
     room, otherwise it hugs the bottom of the gameplay area with
     reduced height. */
  function drawDialogue(c, speaker, text, cw, ch, gx, gy, avoidY) {
    /* Back-compat: if canvas dims aren't supplied, fall back to
       in-viewport rendering at the bottom of the gameplay area. */
    if (cw == null) { cw = W; ch = H; gx = 0; gy = 0; }
    var gameBottom = gy + H;
    var bezelBelow = Math.max(0, ch - gameBottom);
    var boxH, boxY;
    if (bezelBelow >= 56) {
      /* Sits fully in the bottom bezel */
      boxH = Math.min(bezelBelow - 8, 90);
      boxY = gameBottom + Math.max(4, (bezelBelow - boxH) / 2);
    } else if (bezelBelow > 0) {
      /* Overflow into the bezel plus a small fade over the game edge */
      boxH = Math.min(56 + bezelBelow, 80);
      boxY = ch - boxH - 4;
    } else {
      /* No bezel — tuck against the very bottom of gameplay with a
         shorter box so less of the screen is covered. */
      boxH = 56;
      boxY = gameBottom - boxH - 4;
    }
    var boxW = Math.min(560, cw - 40);
    var boxX = (cw - boxW) / 2;
    /* When the box has to overlap gameplay and Momoko (avoidY, canvas
       space) is down where it would sit, move it to the top instead,
       below the hearts and boss bar. */
    var atTop = bezelBelow < 56 && avoidY != null && avoidY > boxY - 40;

    c.save();
    /* Size the box to the text so a third line never spills out. The
       bottom edge stays where the layout above put it (or the top edge,
       when it sits at the top). */
    c.font = '14px ' + FONT;
    var lines = layoutLines(c, text, boxW - 32);
    var need = 34 + lines.length * 19 + 10;
    if (atTop) {
      boxH = Math.max(56, need);
      boxY = gy + 58;
    } else if (need > boxH) { boxY -= need - boxH; boxH = need; }

    drawPanel(c, boxX, boxY, boxW, boxH, 12, 'rgba(14, 62, 100, 0.97)', 'rgba(4, 26, 50, 0.97)', '#7ce8ff');

    /* Speaker name tag */
    c.font = 'bold 14px ' + FONT;
    var tagW = c.measureText(speaker).width + 20;
    c.fillStyle = '#ff7f96';
    roundRect(c, boxX + 14, boxY - 10, tagW, 22, 11);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(speaker, boxX + 24, boxY + 1);

    /* Text */
    c.fillStyle = '#e8f6ff';
    c.font = '14px ' + FONT;
    c.textBaseline = 'alphabetic';
    for (var i = 0; i < lines.length; i++) {
      c.fillText(lines[i], boxX + 16, boxY + 34 + i * 19);
    }

    c.restore();
  }

  /* ---- Game Over Screen ----
     Gentle rather than harsh: a calm deep-blue wash, Momoko bobbing with
     a few slow bubbles, and an encouraging line above the retry button. */
  var gameOverTimer = 0;
  function drawGameOver(c) {
    gameOverTimer++;
    var t = gameOverTimer;
    c.save();
    c.fillStyle = 'rgba(12, 30, 64, 0.8)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    var vg = c.createRadialGradient(W / 2, 220, 40, W / 2, 220, 420);
    vg.addColorStop(0, 'rgba(120, 180, 255, 0.16)');
    vg.addColorStop(1, 'rgba(4, 10, 30, 0.45)');
    c.fillStyle = vg;
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    /* Slow bubbles rising past her */
    for (var b = 0; b < 8; b++) {
      var age = (t * 0.6 + b * 37) % 220;
      c.globalAlpha = Math.min(1, (220 - age) / 60) * 0.5;
      c.strokeStyle = '#cfeaff';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(W / 2 - 70 + b * 20 + Math.sin(age * 0.05 + b) * 6, 300 - age, 2 + (b % 3), 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;

    /* Momoko, a little sleepy-bob */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      c.translate(W / 2, 222 + Math.sin(t * 0.035) * 5);
      c.rotate(Math.sin(t * 0.02) * 0.06);
      c.scale(2.4, 2.4);
      Game.entities.drawMomokoSprite(c, -14, -17, Game.customization, 0);
      c.restore();
    }

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    fitFont(c, Game.i18n.t('gameOver'), W - 80, 40, 'bold');
    c.lineWidth = 7;
    c.strokeStyle = '#2b2458';
    c.strokeText(Game.i18n.t('gameOver'), W / 2, 104);
    c.fillStyle = '#ffd3e0';
    c.fillText(Game.i18n.t('gameOver'), W / 2, 104);

    fitFont(c, Game.i18n.t('gameOverCheer'), W - 80, 18, 'bold');
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(10, 24, 56, 0.9)';
    c.strokeText(Game.i18n.t('gameOverCheer'), W / 2, 150);
    c.fillStyle = '#bfe4ff';
    c.fillText(Game.i18n.t('gameOverCheer'), W / 2, 150);

    drawButton(c, Game.i18n.t('tryAgain'), W / 2 - 100, 306, 200, 48, false, 'primary');
    c.restore();
  }

  function handleGameOverClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 100, 306, 200, 48)) {
      Game.audio.play('select');
      gameOverTimer = 0;
      return 'retry';
    }
    return null;
  }

  /* ---- Victory Screen ---- */
  var victoryParticles = [];
  var victoryTimer = 0;
  var victoryFriends = null;

  function drawVictory(c) {
    victoryTimer++;
    var t = victoryTimer;

    c.save();
    drawSeaBackdrop(c, t, true, 448);
    drawReefSand(c);
    drawReefSides(c, t, 448);
    clipGame(c);

    /* Rising glowing bubbles and sparkles from the reef */
    if (t % 5 === 0) {
      var spark = Math.random() < 0.35;
      victoryParticles.push({
        x: 40 + Math.random() * (W - 80),
        y: H - 20,
        vy: -(0.6 + Math.random() * 1.1),
        ph: Math.random() * 6.28,
        r: spark ? 2 + Math.random() * 1.5 : 3 + Math.random() * 6,
        spark: spark,
        color: ['#ffd24a', '#ff8fd0', '#7ff0ff', '#b6ff8a'][Math.floor(Math.random() * 4)],
        life: 260,
      });
    }
    c.globalCompositeOperation = 'lighter';
    for (var p = victoryParticles.length - 1; p >= 0; p--) {
      var part = victoryParticles[p];
      part.y += part.vy;
      part.ph += 0.05;
      part.life--;
      if (part.life <= 0 || part.y < -20) { victoryParticles.splice(p, 1); continue; }
      var px = part.x + Math.sin(part.ph) * 8;
      var a = Math.min(1, part.life / 60);
      if (part.spark) {
        var tw = 0.6 + 0.4 * Math.sin(part.ph * 4);
        var R = part.r * (1.8 + tw);
        c.globalAlpha = a * 0.25;
        c.fillStyle = part.color;
        c.beginPath();
        c.arc(px, part.y, part.r * 2.2, 0, Math.PI * 2);
        c.fill();
        /* Four-point twinkle star */
        c.globalAlpha = a * tw;
        c.beginPath();
        c.moveTo(px, part.y - R);
        c.quadraticCurveTo(px, part.y, px + R, part.y);
        c.quadraticCurveTo(px, part.y, px, part.y + R);
        c.quadraticCurveTo(px, part.y, px - R, part.y);
        c.quadraticCurveTo(px, part.y, px, part.y - R);
        c.fill();
      } else {
        c.globalAlpha = a * 0.18;
        c.fillStyle = '#9fe6ff';
        c.beginPath();
        c.arc(px, part.y, part.r * 1.8, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = a * 0.6;
        c.strokeStyle = '#d8f6ff';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(px, part.y, part.r, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(px - part.r * 0.35, part.y - part.r * 0.35, part.r * 0.25, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    drawReefForeground(c, t);

    /* Friends celebrating around her: Kitty Corn, Oliver and Bob */
    if (Game.entities && Game.entities.KittyCorn) {
      if (!victoryFriends) {
        victoryFriends = [
          { e: new Game.entities.KittyCorn(0, 0), x: 212, y: 262, s: 2 },
          { e: new Game.entities.Oliver(0, 0), x: 560, y: 282, s: 2 },
          { e: new Game.entities.Bob(0, 0), x: 640, y: 168, s: 1.4 },
        ];
      }
      for (var f = 0; f < victoryFriends.length; f++) {
        var fr = victoryFriends[f];
        fr.e.update();
        c.save();
        c.translate(fr.x, fr.y);
        c.scale(fr.s, fr.s);
        fr.e.draw(c, fr.e.w / 2, fr.e.h / 2);
        c.restore();
      }
    }

    /* Momoko dancing in celebration */
    if (Game.entities && Game.entities.drawMomokoFloss) {
      c.save();
      c.translate(W / 2, 290 - Math.abs(Math.sin(t * 0.09)) * 6);
      c.scale(2.8, 2.8);
      Game.entities.drawMomokoFloss(c, -14, -17, Game.customization, t * 0.18);
      c.restore();
    }

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    fitFont(c, Game.i18n.t('victory'), W - 80, 50, 'bold');
    c.lineWidth = 8;
    c.strokeStyle = '#4a1f00';
    c.strokeText(Game.i18n.t('victory'), W / 2, 72);
    c.fillStyle = '#ffd24a';
    c.shadowColor = '#ffaa00';
    c.shadowBlur = 18;
    c.fillText(Game.i18n.t('victory'), W / 2, 72);
    c.shadowBlur = 0;

    fitFont(c, Game.i18n.t('savedOcean'), W - 80, 22, 'bold');
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(6, 30, 60, 0.85)';
    c.strokeText(Game.i18n.t('savedOcean'), W / 2, 126);
    c.fillStyle = '#bff0ff';
    c.fillText(Game.i18n.t('savedOcean'), W / 2, 126);

    c.font = 'bold 16px ' + FONT;
    c.strokeText(Game.i18n.t('thanks'), W / 2, 158);
    c.fillStyle = '#ffffff';
    c.fillText(Game.i18n.t('thanks'), W / 2, 158);

    drawButton(c, Game.i18n.t('levelSelect'), W / 2 - 210, 394, 200, 48);
    drawButton(c, Game.i18n.t('playAgain'), W / 2 + 10, 394, 200, 48, false, 'primary');
    c.restore();
  }

  function handleVictoryClick(mx, my) {
    if (hitButton(mx, my, W / 2 + 10, 394, 200, 48)) {
      Game.audio.play('select');
      victoryParticles = [];
      victoryTimer = 0;
      return 'restart';
    }
    if (hitButton(mx, my, W / 2 - 210, 394, 200, 48)) {
      Game.audio.play('select');
      victoryParticles = [];
      victoryTimer = 0;
      return 'select';
    }
    return null;
  }

  /* ---- Customization Screen ----
     Layout follows the sketch the user's daughter drew:
       - Title and a live Momoko preview on the left
       - A row of picture tabs along the top of the panel on the right
       - The active tab's name, and a pager when it has more than ten options
       - A 5 x 2 grid of picture tiles
       - Colour chips for the tab, and skin tones
       - Start button at the bottom */
  var hairColors = ['#e06088', '#4a3728', '#f5d060', '#4488ff', '#222222', '#cc3333',
    '#3fc8b8', '#b48cf0', '#e4e6f2', '#ff9a3c', '#ffb7d6', '#2a3f9a'];
  var suitColors = ['#e06088', '#3366aa', '#cc3333', '#7733aa', '#228844', '#dd7722',
    '#2ab3b0', '#ff8fb8', '#f2c230', '#7fc8ff', '#f4f1fa', '#3a3550'];
  var shoeColors = ['#ff99cc', '#33bb77', '#ffcc44', '#66aaff', '#ffffff', '#552211',
    '#b48cf0', '#ff6a5a', '#e0407a', '#2ab3b0', '#2f3a66', '#ff9a3c'];
  var trimColors = ['#ff4f8b', '#ff6a5a', '#ff9a3c', '#ffd23f', '#5fcf6a', '#2ab3b0',
    '#4aa8ff', '#4a5fd0', '#9a6af0', '#ff9fd0', '#f4f1fa', '#3a3550'];
  var skinTones  = ['#ffe0c0', '#f0c8a0', '#ddb896', '#c68c5a', '#8d6e4c', '#5c3d2e'];

  /* Tab definitions. `field` is the key inside Game.customization the
     tab writes to. `colorField` (optional) puts a block of colour chips
     under the grid, drawn as `chip`. `icon` is the option the tab's own
     picture shows while nothing of its own is chosen. Tile pictures are
     rendered by hero.js (see optionFace). */
  function variantList(prefix, ids) {
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      out.push({ id: ids[i], label: ids[i] === 'none' ? 'varNone' : prefix + ids[i].charAt(0).toUpperCase() + ids[i].slice(1) });
    }
    return out;
  }
  var customTabs = [
    { id: 'hair',  label: 'tabHair',  field: 'hairStyle', colorField: 'hair',    colors: hairColors, colorLabel: 'hairColor', chip: 'hair',
      icon: 'twinTails',
      variants: variantList('var', ['twinTails', 'longBraids', 'buns', 'ponytail', 'longWavy', 'bob', 'sideTail', 'himeCut', 'ringlets', 'pixie']) },
    { id: 'dress', label: 'tabDress', field: 'outfit',    colorField: 'suit',    colors: suitColors, colorLabel: 'suitColor', chip: 'cloth',
      icon: 'frillyDress',
      variants: variantList('var', ['frillyDress', 'sailorDress', 'starDress', 'tutuDress', 'shellDress', 'yukata', 'ballGown', 'jellyDress', 'hulaDress']) },
    { id: 'swim',  label: 'tabSwim',  field: 'outfit',    colorField: 'suit',    colors: suitColors, colorLabel: 'suitColor', chip: 'cloth',
      icon: 'sailorSwimsuit',
      variants: variantList('var', ['sailorSwimsuit', 'onePiece', 'frillyBikini', 'wetsuit', 'rashGuard', 'stripeSuit', 'skirtSuit', 'mermaidSuit', 'sharkSuit']) },
    { id: 'shoes', label: 'tabShoes', field: 'shoes',     colorField: 'flipper', colors: shoeColors, colorLabel: 'shoeColor', chip: 'cloth',
      icon: 'maryJane',
      variants: variantList('var', ['maryJane', 'sneaker', 'flipper', 'monofin', 'sandals', 'rainBoots', 'ballet', 'geta', 'anklet']) },
    { id: 'acc',   label: 'tabAcc',   field: 'acc',       colorField: 'trim',    colors: trimColors, colorLabel: 'trimColor', chip: 'gem',
      icon: 'tiara',
      variants: variantList('var', ['none', 'tiara', 'flowerCrown', 'bigBow', 'starClips', 'kittyEars', 'goggles', 'strawHat', 'sailorCap', 'starfish',
        'coralCrown', 'snorkel', 'shellNecklace', 'pearlNecklace']) },
    { id: 'back',  label: 'tabBack',  field: 'back',      colorField: 'trim',    colors: trimColors, colorLabel: 'trimColor', chip: 'gem',
      icon: 'finWings',
      variants: variantList('var', ['none', 'finWings', 'cape', 'swimRing', 'scubaTank', 'balloon']) },
    { id: 'wand',  label: 'tabWand',  field: 'wand',      colorField: 'trim',    colors: trimColors, colorLabel: 'trimColor', chip: 'gem',
      icon: 'star',
      variants: variantList('varWand', ['star', 'heart', 'shell', 'trident', 'flower', 'moon', 'bubble']) },
    { id: 'crab',  label: 'tabCrab',  field: 'crab',      colorField: null, colors: null,
      icon: 'red',
      variants: variantList('varCrab', ['none', 'red', 'blue', 'gold', 'pink', 'hermit', 'turtle', 'octopus', 'puffer', 'seahorse']) },
    { id: 'food',  label: 'tabFood',  field: 'food',      colorField: null, colors: null,
      icon: 'iceCream',
      variants: variantList('var', ['none', 'iceCream', 'onigiri', 'donut', 'crepe', 'taiyaki', 'parfait', 'macaron', 'strawberry', 'watermelon',
        'shavedIce', 'popsicle', 'dango', 'bubbleTea']) },
  ];

  var customSelection = { tab: 'hair', page: 0 };

  /* ---- Layout constants (shared by draw + hit-test) ----
     Everything stays inside the 800 x 480 game window. The grid holds
     ten tiles a page; the colour chips sit at a fixed height under it
     so the layout doesn't jump between tabs. */
  var PANEL_X = 292, PANEL_Y = 8, PANEL_W = 500, PANEL_H = 406;
  var TAB_X = 304, TAB_Y = 16, TAB_W = 50, TAB_H = 46, TAB_STEP = 53.25;
  var HEAD_Y = 66, HEAD_H = 34;
  var PAGER_W = 54, PAGER_PREV_X = 620, PAGER_NEXT_X = 726;
  var GRID_X = 304, GRID_Y = 104, GRID_COLS = 5, GRID_ROWS = 2, GRID_TILE_W = 89.6, GRID_TILE_H = 104, GRID_GAP = 7;
  var PER_PAGE = GRID_COLS * GRID_ROWS;
  var CHIP_X = 304, CHIP_Y = 348, CHIP_STEP_X = 40, CHIP_STEP_Y = 34, CHIP_COLS = 6, CHIP_LABEL_Y = 332;
  var SKIN_X = 566;
  var START_BTN_W = 200, START_BTN_H = 46;
  var START_BTN_X = PANEL_X + PANEL_W / 2 - START_BTN_W / 2;
  var START_BTN_Y = 420;
  var customizeTimer = 0;

  function getTab(id) {
    for (var i = 0; i < customTabs.length; i++) if (customTabs[i].id === id) return customTabs[i];
    return customTabs[0];
  }
  function pageCount(tab) { return Math.ceil(tab.variants.length / PER_PAGE); }
  /* The page that holds the tab's current choice */
  function pageOfChoice(tab) {
    var cur = Game.customization[tab.field];
    for (var i = 0; i < tab.variants.length; i++) if (tab.variants[i].id === cur) return Math.floor(i / PER_PAGE);
    return 0;
  }
  function tileRect(i) {
    return {
      x: GRID_X + (i % GRID_COLS) * (GRID_TILE_W + GRID_GAP),
      y: GRID_Y + Math.floor(i / GRID_COLS) * (GRID_TILE_H + GRID_GAP),
    };
  }
  /* Chip centre: the tab's colours fill a 6 x 2 block on the left, skin
     tones a 3 x 2 block on the right (or the left block, in one row,
     when the tab has no colours of its own) */
  function chipPos(tab, i, skin) {
    if (skin && !tab.colorField) return { x: CHIP_X + 16 + i * CHIP_STEP_X, y: CHIP_Y + 2 };
    var cols = skin ? 3 : CHIP_COLS;
    return { x: (skin ? SKIN_X : CHIP_X) + 16 + (i % cols) * CHIP_STEP_X, y: CHIP_Y + 2 + Math.floor(i / cols) * CHIP_STEP_Y };
  }

  /* ---- Option tile faces ----
     Each tile shows what the option changes, rendered by hero.js with
     the player's current look: hair on the whole figure, outfits from
     the chin down, shoes on her planted feet, head accessories close
     up; back items, wands, sea friends and snacks are painted on their
     own, big. The whole face of a tile (card, lit well, picture, label
     band) is baked once per option, look and language into a small
     canvas at 2x and re-baked when a colour or another choice changes,
     so a frame only blits it. A bake costs about one hero draw, so at
     most a few are done per frame; a tile waiting for its turn keeps
     its previous face. */
  var FACE_W = 90, FACE_H = 104, ICON_W = 86, ICON_RES = 2, ICON_VIS = 79;
  var iconCache = {}, iconCount = 0, iconLast = {}, iconBudget = 0;
  /* [centre x, top y, scale] of the sprite region framed for a tab */
  var ICON_FRAME = {
    hair:  [14, -5.5, 2.45],
    dress: [14, 15, 3.9],
    swim:  [14, 15, 3.9],
    shoes: [14, 27.2, 6.6],
    acc:   [14, -9.4, 3],
  };
  /* [centre x, centre y, scale] of each back item on its own */
  var BACK_FRAME = {
    finWings: [14, 20.5, 2.1], cape: [14, 27.4, 3], swimRing: [14, 26.4, 3.3], scubaTank: [10.6, 22.6, 4.3], balloon: [-5, -4.2, 5.2],
  };
  var PET_FRAME = { seahorse: [1, 2.2, 4.7], hermit: [0.4, 0.6, 5], turtle: [-0.6, 0, 5], puffer: [0.5, -0.4, 5.4] };
  function paintIcon(ic, tab, variantId, look) {
    var H = Game.hero, cx = ICON_W / 2, cy = ICON_VIS / 2 + 2;
    if (variantId === 'none') {
      /* a slashed ring: nothing worn */
      ic.lineCap = 'round';
      for (var p = 0; p < 2; p++) {
        ic.strokeStyle = p ? 'rgba(206, 234, 255, 0.85)' : 'rgba(4, 20, 50, 0.5)';
        ic.lineWidth = p ? 4 : 7;
        ic.beginPath();
        ic.arc(cx, cy, 19, 0, Math.PI * 2);
        ic.moveTo(cx - 13.4, cy + 13.4);
        ic.lineTo(cx + 13.4, cy - 13.4);
        ic.stroke();
      }
    } else if (tab.field === 'crab') {
      var pf = PET_FRAME[variantId] || [0, 0.2, 5.2];
      ic.translate(cx, cy + 6);
      ic.scale(pf[2], pf[2]);
      H.crab(ic, -pf[0], pf[1], variantId, 0);
    } else if (tab.field === 'food') {
      H.food(ic, variantId, cx, cy + 4, 8.2);
    } else if (tab.field === 'wand') {
      ic.translate(cx, cy);
      ic.rotate(-0.62);
      ic.scale(6, 6);
      ic.translate(-7.6, 0);
      H.part(ic, look, 'wand');
    } else if (tab.field === 'back') {
      var bf = BACK_FRAME[variantId];
      ic.translate(cx, cy);
      ic.scale(bf[2], bf[2]);
      ic.translate(-bf[0], -bf[1]);
      H.part(ic, look, 'back');
    } else {
      var f = ICON_FRAME[tab.id];
      /* necklaces: frame her chin and chest; the monofin needs room */
      if (/Necklace$/.test(variantId)) f = [14, 12.6, 5];
      else if (variantId === 'monofin') f = [14, 25, 4.2];
      ic.translate(cx, 0);
      ic.scale(f[2], f[2]);
      ic.translate(-f[0], -f[1]);
      H.draw(ic, 0, 0, look, 0, { still: true, noWand: tab.id !== 'acc' || /Necklace$/.test(variantId), stand: tab.id === 'shoes' });
    }
  }
  function optionFace(tab, variant) {
    var cu = Game.customization, variantId = variant.id, own = tab.field === 'crab' || tab.field === 'food';
    var label = Game.i18n.t(variant.label), slot = tab.id + '|' + variantId;
    var look = null, key = slot + '|' + label;
    if (!own && variantId !== 'none') {
      look = {
        hair: cu.hair, suit: cu.suit, skin: cu.skin, flipper: cu.flipper, trim: cu.trim, hairStyle: cu.hairStyle,
        outfit: cu.outfit, shoes: cu.shoes, acc: cu.acc, back: 'none', wand: cu.wand, food: 'none', crab: 'none',
      };
      look[tab.field] = variantId;
      /* a floor-length gown would hide the shoes being chosen */
      if (tab.id === 'shoes' && look.outfit === 'ballGown') look.outfit = 'frillyDress';
      key += '|' + (tab.field === 'wand' || tab.field === 'back' ? cu.trim : JSON.stringify(look));
    }
    if (iconCache[key]) return iconCache[key];
    if (iconBudget <= 0 && iconLast[slot]) return iconLast[slot];
    iconBudget--;
    if (iconCount > 160) { iconCache = {}; iconCount = 0; }
    var cv = document.createElement('canvas');
    cv.width = FACE_W * ICON_RES;
    cv.height = FACE_H * ICON_RES;
    var ic = cv.getContext('2d'), w = FACE_W, h = FACE_H;
    ic.scale(ICON_RES, ICON_RES);
    var g = ic.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2c6da6');
    g.addColorStop(1, '#123562');
    roundRect(ic, 0, 0, w, h, 10);
    ic.fillStyle = g;
    ic.fill();
    ic.save();
    roundRect(ic, 2, 2, w - 4, h - 4, 8);
    ic.clip();
    /* light falling into the well, a soft shadow on the floor under
       items shown on their own */
    var wg = ic.createRadialGradient(w / 2, h * 0.3, 4, w / 2, h * 0.42, h * 0.62);
    wg.addColorStop(0, 'rgba(170, 228, 255, 0.5)');
    wg.addColorStop(1, 'rgba(20, 70, 130, 0)');
    ic.fillStyle = wg;
    ic.fillRect(0, 0, w, h);
    if (own || tab.field === 'wand' || tab.field === 'back') {
      ic.fillStyle = 'rgba(2, 16, 46, 0.3)';
      ic.beginPath();
      ic.ellipse(w / 2, h - 31, 25, 4.5, 0, 0, Math.PI * 2);
      ic.fill();
    }
    ic.save();
    ic.translate(2, 2);
    paintIcon(ic, tab, variantId, look);
    ic.restore();
    var bg = ic.createLinearGradient(0, h - 27, 0, h - 19);
    bg.addColorStop(0, 'rgba(5, 22, 54, 0)');
    bg.addColorStop(1, 'rgba(5, 22, 54, 0.86)');
    ic.fillStyle = bg;
    ic.fillRect(0, h - 27, w, 27);
    ic.restore();
    ic.fillStyle = '#e4f2ff';
    ic.font = 'bold 12px ' + FONT;
    ic.textAlign = 'center';
    ic.textBaseline = 'middle';
    ic.fillText(label, w / 2, h - 10, w - 10);
    iconCache[key] = iconLast[slot] = cv;
    iconCount++;
    return cv;
  }
  /* The option a tab's own picture shows: its current choice, or its
     signature item while nothing of its own is on */
  function tabIconVariant(tab) {
    var cur = Game.customization[tab.field], sig = null;
    for (var i = 0; i < tab.variants.length; i++) {
      if (tab.variants[i].id === cur && cur !== 'none') return tab.variants[i];
      if (tab.variants[i].id === tab.icon) sig = tab.variants[i];
    }
    return sig;
  }

  function shadeHex(hex, k) {
    var n = parseInt(hex.length === 4 ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex.slice(1), 16);
    var f = function (v) { return Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)); };
    return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function checkMark(c, x, y, s, col) {
    c.beginPath();
    c.moveTo(x - s, y);
    c.lineTo(x - s * 0.3, y + s * 0.7);
    c.lineTo(x + s, y - s * 0.8);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = col;
    c.stroke();
  }
  function checkBadge(c, bx, by) {
    c.beginPath();
    c.arc(bx, by, 8, 0, Math.PI * 2);
    c.fillStyle = '#ffd86e';
    c.fill();
    c.strokeStyle = '#a06a10';
    c.lineWidth = 1;
    c.stroke();
    c.lineWidth = 2.2;
    checkMark(c, bx, by, 3.8, '#5a3404');
  }
  function pressed() { return !!(Game.input.pointer && Game.input.pointer.down); }

  /* One option tile: its baked face over a flat contact shadow, and
     for the chosen one a brighter card, gold rim, glow and check badge.
     It lifts on hover and sinks while pressed. */
  function drawOptionTile(c, x, y, w, h, selected, hot, face) {
    c.save();
    var k = hot ? (pressed() ? 0.96 : 1.03) : 1;
    if (k !== 1) {
      c.translate(x + w / 2, y + h / 2);
      c.scale(k, k);
      c.translate(-x - w / 2, -y - h / 2);
    }
    if (selected) {
      c.shadowColor = 'rgba(255, 210, 100, 0.8)';
      c.shadowBlur = 12;
      roundRect(c, x, y, w, h, 10);
      c.fillStyle = '#ffd86e';
      c.fill();
      c.shadowBlur = 0;
      c.shadowColor = 'rgba(0, 0, 0, 0)';
    } else {
      roundRect(c, x, y + (hot ? 4 : 2.5), w, h, 10);
      c.fillStyle = 'rgba(0, 8, 30, 0.4)';
      c.fill();
    }
    c.drawImage(face, x, y, w, h);
    roundRect(c, x + 1, y + 1, w - 2, h - 2, 9);
    if (selected) {
      c.fillStyle = 'rgba(150, 215, 255, 0.2)';
      c.fill();
      c.strokeStyle = '#ffd86e';
      c.lineWidth = 2.5;
    } else {
      c.strokeStyle = hot ? 'rgba(190, 236, 255, 0.85)' : 'rgba(150, 210, 255, 0.32)';
      c.lineWidth = hot ? 1.5 : 1;
    }
    c.stroke();
    if (selected) checkBadge(c, x + w - 11, y + 11);
    c.restore();
  }

  /* A picture tab: the tab's current choice in miniature */
  function drawTab(c, x, tab, active) {
    var hot = pointerOver(c, x, TAB_Y, TAB_W, TAB_H);
    var g = c.createLinearGradient(0, TAB_Y, 0, TAB_Y + TAB_H);
    if (active) { g.addColorStop(0, '#62bcf6'); g.addColorStop(1, '#2a72b6'); }
    else if (hot) { g.addColorStop(0, '#2f6a9e'); g.addColorStop(1, '#1c4670'); }
    else { g.addColorStop(0, '#1e4670'); g.addColorStop(1, '#112b4a'); }
    c.save();
    if (active) { c.shadowColor = 'rgba(255, 210, 100, 0.6)'; c.shadowBlur = 8; }
    roundRect(c, x, TAB_Y, TAB_W, TAB_H, 9);
    c.fillStyle = g;
    c.fill();
    c.restore();
    /* the picture part of that option's tile face, inset so its square
       corners stay inside the tab's round ones */
    c.globalAlpha = active ? 1 : hot ? 0.9 : 0.72;
    var iw = TAB_W - 7, ih = TAB_H - 7, sw = ICON_W - 4, sh = sw * ih / iw;
    c.drawImage(optionFace(tab, tabIconVariant(tab)), 4 * ICON_RES, (ICON_VIS + 2 - sh) * ICON_RES, sw * ICON_RES, sh * ICON_RES,
      x + 3.5, TAB_Y + 3.5, iw, ih);
    c.globalAlpha = 1;
    roundRect(c, x + 0.5, TAB_Y + 0.5, TAB_W - 1, TAB_H - 1, 9);
    c.strokeStyle = active ? '#ffd86e' : hot ? 'rgba(190, 236, 255, 0.7)' : 'rgba(140, 200, 255, 0.28)';
    c.lineWidth = active ? 2.5 : 1;
    c.stroke();
  }

  /* Page arrow */
  function drawPager(c, x, dir) {
    var hot = pointerOver(c, x, HEAD_Y, PAGER_W, HEAD_H), oy = hot && pressed() ? 1 : 0;
    var g = c.createLinearGradient(0, HEAD_Y, 0, HEAD_Y + HEAD_H);
    g.addColorStop(0, hot ? '#46a4dc' : '#2f86c0');
    g.addColorStop(1, hot ? '#1f6aa4' : '#165288');
    roundRect(c, x, HEAD_Y + 2 + oy, PAGER_W, HEAD_H - 4, 9);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = hot ? '#ffffff' : 'rgba(124, 232, 255, 0.75)';
    c.lineWidth = 1.5;
    c.stroke();
    var mx = x + PAGER_W / 2, my = HEAD_Y + HEAD_H / 2 + oy;
    c.beginPath();
    c.moveTo(mx + dir * 7, my);
    c.lineTo(mx - dir * 5, my - 8);
    c.lineTo(mx - dir * 5, my + 8);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
  }

  /* A colour chip shaped like what it colours: a glossy lock for hair,
     a stitched swatch for cloth and shoes, a cut gem for the accent, a
     soft bead for skin. */
  function drawSwatch(c, cx, cy, col, kind) {
    c.save();
    var g = c.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, 14);
    g.addColorStop(0, shadeHex(col, kind === 'skin' ? 0.25 : 0.45));
    g.addColorStop(0.45, col);
    g.addColorStop(1, shadeHex(col, kind === 'skin' ? -0.2 : -0.35));
    c.beginPath();
    if (kind === 'cloth') {
      roundRect(c, cx - 11.5, cy - 11.5, 23, 23, 6);
    } else if (kind === 'gem') {
      for (var i = 0; i < 8; i++) {
        var a = Math.PI / 8 + i * Math.PI / 4;
        if (i) c.lineTo(cx + Math.cos(a) * 13.5, cy + Math.sin(a) * 13.5);
        else c.moveTo(cx + Math.cos(a) * 13.5, cy + Math.sin(a) * 13.5);
      }
      c.closePath();
    } else {
      c.arc(cx, cy, 12.5, 0, Math.PI * 2);
    }
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(0, 10, 30, 0.5)';
    c.lineWidth = 1;
    c.stroke();
    if (kind === 'cloth') {
      /* a fold across the corner, a line of stitches */
      c.beginPath();
      c.moveTo(cx + 11.5, cy - 2); c.lineTo(cx + 11.5, cy + 5.5); c.quadraticCurveTo(cx + 11.5, cy + 11.5, cx + 5.5, cy + 11.5); c.lineTo(cx - 2, cy + 11.5);
      c.closePath();
      c.fillStyle = 'rgba(0, 10, 40, 0.18)';
      c.fill();
      c.setLineDash([2.5, 2.5]);
      roundRect(c, cx - 8.5, cy - 8.5, 17, 17, 4);
      c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      c.lineWidth = 1;
      c.stroke();
      c.setLineDash([]);
    } else if (kind === 'gem') {
      /* table facet and the edges running to it */
      c.beginPath();
      for (var f = 0; f < 8; f++) {
        var fa = Math.PI / 8 + f * Math.PI / 4;
        c.moveTo(cx + Math.cos(fa) * 13.5, cy + Math.sin(fa) * 13.5);
        c.lineTo(cx + Math.cos(fa) * 7, cy + Math.sin(fa) * 7);
        c.lineTo(cx + Math.cos(fa + Math.PI / 4) * 7, cy + Math.sin(fa + Math.PI / 4) * 7);
      }
      c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      c.lineWidth = 0.8;
      c.stroke();
      c.beginPath();
      c.moveTo(cx - 6.5, cy - 2.7); c.lineTo(cx - 2.7, cy - 6.5); c.lineTo(cx - 9.5, cy - 9.5);
      c.closePath();
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      c.fill();
    } else if (kind === 'hair') {
      /* strands and the ring of gloss round a lock */
      c.beginPath();
      c.arc(cx - 16, cy + 2, 21, -0.5, 0.4);
      c.moveTo(cx + 9.6, cy - 6);
      c.arc(cx - 8, cy + 2, 19, -0.45, 0.45);
      c.strokeStyle = 'rgba(0, 10, 40, 0.22)';
      c.lineWidth = 0.9;
      c.stroke();
      c.beginPath();
      c.ellipse(cx, cy - 1, 9.5, 6.5, 0, Math.PI * 1.08, Math.PI * 1.92);
      c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.stroke();
    } else {
      c.beginPath();
      c.ellipse(cx - 4, cy - 5.5, 4.5, 2.6, -0.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      c.fill();
    }
    c.restore();
  }
  /* The chosen chip's gold ring and check, or the hovered one's ring */
  function drawChipMark(c, cx, cy, selected) {
    c.save();
    c.beginPath();
    c.arc(cx, cy, 16.5, 0, Math.PI * 2);
    c.strokeStyle = selected ? '#ffd86e' : 'rgba(160, 220, 255, 0.6)';
    c.lineWidth = selected ? 2.5 : 1.5;
    c.stroke();
    if (selected) {
      c.lineWidth = 3.4;
      checkMark(c, cx, cy + 1, 4.5, 'rgba(0, 20, 40, 0.55)');
      c.lineWidth = 2;
      checkMark(c, cx, cy + 1, 4.5, '#ffffff');
    }
    c.restore();
  }
  /* The chips under the grid: the tab's colours and the skin tones,
     with their captions. The chips themselves are baked once per tab
     and language into a strip; a frame blits it and marks the chosen
     and hovered ones. */
  var CHIP_STRIP_X = 300, CHIP_STRIP_Y = 318, CHIP_STRIP_W = 484, CHIP_STRIP_H = 86, chipStrips = {};
  function chipBlocks(tab) {
    var out = [];
    if (tab.colorField) out.push({ colors: tab.colors, field: tab.colorField, label: tab.colorLabel, kind: tab.chip, skin: false });
    out.push({ colors: skinTones, field: 'skin', label: 'skinTone', kind: 'skin', skin: true });
    return out;
  }
  function chipStrip(tab, blocks) {
    var key = tab.id + '|' + Game.i18n.t(blocks[0].label) + '|' + Game.i18n.t('skinTone');
    if (chipStrips[key]) return chipStrips[key];
    var cv = document.createElement('canvas');
    cv.width = CHIP_STRIP_W * ICON_RES;
    cv.height = CHIP_STRIP_H * ICON_RES;
    var ic = cv.getContext('2d');
    ic.scale(ICON_RES, ICON_RES);
    ic.translate(-CHIP_STRIP_X, -CHIP_STRIP_Y);
    for (var b = 0; b < blocks.length; b++) {
      var bl = blocks[b];
      ic.fillStyle = '#9cc4e8';
      ic.font = 'bold 12px ' + FONT;
      ic.textAlign = 'left';
      ic.fillText(Game.i18n.t(bl.label), chipPos(tab, 0, bl.skin).x - 16, CHIP_LABEL_Y);
      for (var i = 0; i < bl.colors.length; i++) {
        var p = chipPos(tab, i, bl.skin);
        drawSwatch(ic, p.x, p.y, bl.colors[i], bl.kind);
      }
    }
    chipStrips[key] = cv;
    return cv;
  }
  function drawChips(c, tab) {
    var blocks = chipBlocks(tab);
    c.drawImage(chipStrip(tab, blocks), CHIP_STRIP_X, CHIP_STRIP_Y, CHIP_STRIP_W, CHIP_STRIP_H);
    for (var b = 0; b < blocks.length; b++) {
      var bl = blocks[b], sel = Game.customization[bl.field];
      for (var i = 0; i < bl.colors.length; i++) {
        var p = chipPos(tab, i, bl.skin), chosen = bl.colors[i] === sel;
        if (chosen || pointerOver(c, p.x - CHIP_STEP_X / 2, p.y - CHIP_STEP_Y / 2, CHIP_STEP_X, CHIP_STEP_Y)) {
          drawChipMark(c, p.x, p.y, chosen);
        }
      }
    }
  }

  function drawCustomizeScreen(c) {
    customizeTimer++;
    var t = customizeTimer;
    iconBudget = 4;

    /* Background – the title's sea, dimmed so the controls stay legible */
    drawSeaBackdrop(c, t, false, floorBelowY());
    c.fillStyle = 'rgba(4, 16, 46, 0.3)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    drawFloorBelow(c, t);
    clipGame(c);

    /* Title, over the preview */
    var stageCX = 146, stageCY = 244;
    c.save();
    fitFont(c, Game.i18n.t('customize'), 268, 24, 'bold');
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(4, 20, 44, 0.9)';
    c.strokeText(Game.i18n.t('customize'), stageCX, 38);
    c.fillStyle = '#7fd8ff';
    c.fillText(Game.i18n.t('customize'), stageCX, 38);
    c.restore();

    /* Panel card behind the controls */
    drawPanel(c, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16, 'rgba(16, 58, 104, 0.93)', 'rgba(6, 24, 54, 0.95)', 'rgba(124, 232, 255, 0.75)');

    /* Preview stage – soft radial glow so Momoko pops against the bg */
    var stageGrad = c.createRadialGradient(stageCX, stageCY, 20, stageCX, stageCY, 150);
    stageGrad.addColorStop(0, 'rgba(120,200,255,0.28)');
    stageGrad.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = stageGrad;
    c.fillRect(0, 70, 292, 350);

    /* Sandy rock pedestal she stands on */
    var pedY = 346;
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.beginPath();
    c.ellipse(stageCX, pedY + 20, 96, 14, 0, 0, Math.PI * 2);
    c.fill();
    var pg = c.createLinearGradient(0, pedY - 14, 0, pedY + 20);
    pg.addColorStop(0, '#d8c08e');
    pg.addColorStop(1, '#8a7149');
    c.fillStyle = pg;
    c.beginPath();
    c.ellipse(stageCX, pedY + 12, 88, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(stageCX - 88, pedY, 176, 12);
    c.fillStyle = '#ead6a8';
    c.beginPath();
    c.ellipse(stageCX, pedY, 88, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(90, 68, 40, 0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    /* Little shells and a starfish on the rim */
    c.fillStyle = '#ff9fb8';
    c.beginPath(); c.arc(stageCX - 60, pedY + 2, 4, Math.PI, 0); c.fill();
    c.fillStyle = '#ffd27a';
    c.beginPath(); c.arc(stageCX + 66, pedY - 1, 3.5, Math.PI, 0); c.fill();
    drawStarfish(c, stageCX + 46, pedY + 6, 6, t * 0.004, '#ff8a5c');

    /* Momoko preview, bobbing gently above the pedestal while she is
       busy, nearly still once she settles (see stepPreviewRig) */
    stepPreviewRig();
    c.save();
    c.translate(stageCX - 70, stageCY - 88 + Math.sin(t * 0.04) * 3 * (1 - PREVIEW_DAMP * pace.calm));
    c.scale(5, 5);
    drawMomokoPreview(c, Game.customization, t);
    c.restore();

    /* Tab bar */
    var activeTab = getTab(customSelection.tab);
    for (var ti = 0; ti < customTabs.length; ti++) {
      drawTab(c, TAB_X + ti * TAB_STEP, customTabs[ti], customTabs[ti] === activeTab);
    }

    /* Heading: the tab's name, and the pager when it needs one */
    var pages = pageCount(activeTab), page = Math.min(customSelection.page, pages - 1);
    c.fillStyle = '#eaf6ff';
    c.font = 'bold 17px ' + FONT;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(Game.i18n.t(activeTab.label), GRID_X + 2, HEAD_Y + HEAD_H / 2 + 1);
    if (pages > 1) {
      drawPager(c, PAGER_PREV_X, -1);
      drawPager(c, PAGER_NEXT_X, 1);
      var mid = (PAGER_PREV_X + PAGER_W + PAGER_NEXT_X) / 2;
      for (var pi = 0; pi < pages; pi++) {
        c.beginPath();
        c.arc(mid + (pi - (pages - 1) / 2) * 16, HEAD_Y + HEAD_H / 2, pi === page ? 5 : 3.5, 0, Math.PI * 2);
        c.fillStyle = pi === page ? '#ffd86e' : 'rgba(170, 215, 255, 0.45)';
        c.fill();
      }
    }

    /* Variant grid for the active tab: rendered pictures */
    var currentVariantId = Game.customization[activeTab.field];
    var hotTile = -1;
    for (var vi = page * PER_PAGE; vi < Math.min(activeTab.variants.length, (page + 1) * PER_PAGE); vi++) {
      var r = tileRect(vi - page * PER_PAGE), v = activeTab.variants[vi];
      /* the hovered tile lifts, so it is drawn last, over its neighbours */
      if (pointerOver(c, r.x, r.y, GRID_TILE_W, GRID_TILE_H)) { hotTile = vi; continue; }
      drawOptionTile(c, r.x, r.y, GRID_TILE_W, GRID_TILE_H, v.id === currentVariantId, false, optionFace(activeTab, v));
    }
    if (hotTile >= 0) {
      var hr = tileRect(hotTile - page * PER_PAGE), hv = activeTab.variants[hotTile];
      drawOptionTile(c, hr.x, hr.y, GRID_TILE_W, GRID_TILE_H, hv.id === currentVariantId, true, optionFace(activeTab, hv));
    }

    /* Colour chips for the tab, and skin tones – always there, since
       skin belongs to no category but still matters */
    drawChips(c, activeTab);
    c.textBaseline = 'alphabetic';

    /* Start button */
    drawButton(c, Game.i18n.t('startGame'), START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H, false, 'primary');
  }

  function drawMomokoPreview(c, cust, t) {
    if (!Game.entities) return;
    if (Game.entities.drawMomokoSprite) Game.entities.drawMomokoSprite(c, 0, 0, cust, 0, previewRig ? { rig: previewRig } : undefined);
    /* Sea friend appears next to her feet in the preview so the player
       can see the companion they just picked. It runs on her paced
       clock, so it calms down with her. */
    if (Game.entities.drawCrabPet && cust.crab && cust.crab !== 'none') {
      Game.entities.drawCrabPet(c, -8, 32, cust.crab, previewRig ? previewPetClock : t);
    }
  }

  /* Preview pacing, shared by every Momoko game: a pick sets off a cute
     reaction for PREVIEW_REACT s, then she settles nearly still so the
     outfit is easy to see, with one short moment (PREVIEW_MOMENT s) every
     PREVIEW_GAP_MIN..PREVIEW_GAP_MAX s. `calm` eases toward 1 while
     settled and 0 during a reaction or moment (time constant PREVIEW_EASE)
     and damps her idle motion by up to PREVIEW_DAMP. Here that is done by
     slowing the clock her idle float, tread and hair run on (and the
     pet's), so blinks and glances keep their own pace. */
  var PREVIEW_REACT = 2, PREVIEW_MOMENT = 1.2, PREVIEW_GAP_MIN = 6, PREVIEW_GAP_MAX = 12;
  var PREVIEW_EASE = 0.3, PREVIEW_DAMP = 0.85;
  var pace = { act: '', age: 0, len: 0, gap: 0, calm: 1, cue: -1 };
  var previewRig = null, previewLast = 0, previewClock = 0, previewPetClock = 0;
  var PREVIEW_IDLE = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, keys: {} };
  function pickOf(list) { return list[Math.floor(Math.random() * list.length)]; }
  function previewAct(kind, len) {
    pace.act = kind; pace.age = 0; pace.len = len; pace.cue = -1;
    var r = previewRig;
    if (kind === 'cheer') { r.event('cheer'); r.reactT = r.reactDur = 1.8; }
    else if (kind === 'twirl' || kind === 'hops') { r.event('happy'); pace.cue = 0.95; }
    else if (kind === 'hop') r.event('happy');
    else if (kind === 'cast') r.event('cast');
    else if (kind === 'look') { r.lookTx = 0.6; r.lookTy = -0.45; r.glanceIn = 1.1; }
  }
  function previewPick() { if (previewRig) previewAct(pickOf(['cheer', 'twirl', 'hops']), PREVIEW_REACT); }
  function stepPreviewRig() {
    var H = Game.hero;
    if (!H || !H.Rig) return;
    var now = performance.now();
    var fresh = !previewRig || now - previewLast > 500;
    if (!previewRig) previewRig = new H.Rig(1);
    var dt = fresh ? 1 / 60 : Math.min(0.05, (now - previewLast) / 1000);
    previewLast = now;
    if (fresh) previewPick();                              /* she says hello */
    var r = previewRig, a = pace.act, u = pace.age;
    PREVIEW_IDLE.facing = (a === 'twirl' || a === 'turn') && u < (a === 'twirl' ? 0.5 : 0.6) ? -1 : 1;
    if (pace.cue >= 0 && u >= pace.cue) { pace.cue = -1; r.event('happy'); }
    var rate = 1 - PREVIEW_DAMP * pace.calm;
    /* in steps no longer than the simulation's (stiff glance springs) */
    for (var n = Math.ceil(dt * 60), i = 0; i < n; i++) {
      r.t = previewClock;
      r.step(dt / n, PREVIEW_IDLE);
      previewClock += dt / n * rate;
    }
    r.t = previewClock;
    previewPetClock += dt * 60 * rate;
    pace.calm += ((a ? 0 : 1) - pace.calm) * (1 - Math.exp(-dt / PREVIEW_EASE));
    if (a) {
      pace.age += dt;
      if (pace.age >= pace.len) { pace.act = ''; pace.gap = PREVIEW_GAP_MIN + Math.random() * (PREVIEW_GAP_MAX - PREVIEW_GAP_MIN); }
    } else if ((pace.gap -= dt) <= 0) {
      previewAct(pickOf(['hop', 'turn', 'cast', 'look']), PREVIEW_MOMENT);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function handleCustomizeClick(mx, my) {
    /* Tab bar */
    for (var ti = 0; ti < customTabs.length; ti++) {
      if (hitButton(mx, my, TAB_X + ti * TAB_STEP - 1.5, TAB_Y - 4, TAB_STEP, TAB_H + 8)) {
        customSelection.tab = customTabs[ti].id;
        customSelection.page = pageOfChoice(customTabs[ti]);
        Game.audio.play('select');
        return null;
      }
    }

    var activeTab = getTab(customSelection.tab);

    /* Pager */
    var pages = pageCount(activeTab), page = Math.min(customSelection.page, pages - 1);
    if (pages > 1) {
      var step = hitButton(mx, my, PAGER_PREV_X - 4, HEAD_Y - 3, PAGER_W + 8, HEAD_H + 6) ? -1 :
        hitButton(mx, my, PAGER_NEXT_X - 4, HEAD_Y - 3, PAGER_W + 8, HEAD_H + 6) ? 1 : 0;
      if (step) {
        customSelection.page = (page + step + pages) % pages;
        Game.audio.play('select');
        return null;
      }
    }

    /* Variant tiles */
    for (var vi = page * PER_PAGE; vi < Math.min(activeTab.variants.length, (page + 1) * PER_PAGE); vi++) {
      var r = tileRect(vi - page * PER_PAGE);
      if (hitButton(mx, my, r.x, r.y, GRID_TILE_W, GRID_TILE_H)) {
        Game.customization[activeTab.field] = activeTab.variants[vi].id;
        previewPick();
        Game.audio.play('select');
        return null;
      }
    }

    /* Colour chips, then skin tones */
    var blocks = chipBlocks(activeTab);
    for (var b = 0; b < blocks.length; b++) {
      for (var ci = 0; ci < blocks[b].colors.length; ci++) {
        var p = chipPos(activeTab, ci, blocks[b].skin);
        if (hitButton(mx, my, p.x - CHIP_STEP_X / 2, p.y - CHIP_STEP_Y / 2, CHIP_STEP_X, CHIP_STEP_Y)) {
          Game.customization[blocks[b].field] = blocks[b].colors[ci];
          previewPick();
          Game.audio.play('select');
          return null;
        }
      }
    }

    /* Start button */
    if (hitButton(mx, my, START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H)) {
      Game.audio.play('select');
      return 'start';
    }
    return null;
  }

  /* ---- Intro / Backstory ---- */
  var introAnimTimer = 0;

  function drawIntroScreen(c) {
    introAnimTimer++;

    /* Background – same sea backdrop as the title for continuity */
    drawSeaBackdrop(c, introAnimTimer, false, floorBelowY());
    drawFloorBelow(c, introAnimTimer);
    clipGame(c);

    /* Size the story card to its text and centre it between the heading
       and the Continue button instead of leaving a half-empty box. */
    var panelX = 240, panelW = 540;
    c.font = '14px "M PLUS Rounded 1c", sans-serif';
    var introLines = layoutLines(c, Game.i18n.t('introText'), panelW - 36);
    var panelH = introLines.length * 20 + 40;
    var panelY = Math.round(72 + (H - 72 - 72 - panelH) / 2);
    var portraitY = panelY + panelH / 2 - 32;

    /* Momoko portrait (left) on a soft glow */
    var pg = c.createRadialGradient(120, portraitY + 50, 10, 120, portraitY + 50, 110);
    pg.addColorStop(0, 'rgba(255, 170, 210, 0.3)');
    pg.addColorStop(1, 'rgba(255, 170, 210, 0)');
    c.fillStyle = pg;
    c.fillRect(10, portraitY - 60, 220, 220);
    c.save();
    c.translate(120, portraitY);
    c.scale(3.2, 3.2);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(introAnimTimer / 8) % 4);
    }
    c.restore();

    /* Title */
    c.save();
    c.font = 'bold 28px ' + FONT;
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.lineWidth = 6;
    c.strokeStyle = '#4a2200';
    c.strokeText(Game.i18n.t('introTitle'), W / 2, 46);
    c.fillStyle = '#ffd27a';
    c.shadowColor = 'rgba(255, 170, 60, 0.6)';
    c.shadowBlur = 10;
    c.fillText(Game.i18n.t('introTitle'), W / 2, 46);
    c.restore();

    /* Story panel – glassy gradient card with a double edge and gloss */
    drawPanel(c, panelX, panelY, panelW, panelH, 14, 'rgba(18, 62, 108, 0.93)', 'rgba(6, 22, 50, 0.95)', 'rgba(124, 232, 255, 0.8)');

    /* Story text */
    c.fillStyle = '#dfeeff';
    c.font = '14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    wrapText(c, Game.i18n.t('introText'), panelX + 18, panelY + 28, panelW - 36, 20);

    /* Continue button */
    drawButton(c, Game.i18n.t('continueBtn'), W / 2 - 90, H - 60, 180, 44);
  }

  function handleIntroClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, H - 60, 180, 44)) {
      Game.audio.play('select');
      introAnimTimer = 0;
      return 'start';
    }
    return null;
  }

  /* ---- Beach Cutscene ---- */
  /* Scene config is regenerated on every breach via startBeachCutscene()
     so each surface trip looks a little different (time of day, who's on
     the beach, what they're doing). Falls back to a default scene if the
     state ever ends up rendered without a config. */
  var beachTimer = 0;
  var beachKitty = null;
  var beachScene = null;

  /* Time-of-day palettes – each set drives sky gradient, horizon sea,
     sand, water, and sun colour so the whole frame stays cohesive. */
  var BEACH_PALETTES = {
    morning: {
      sky: ['#aedcf2', '#dbeefb', '#fff1d4'],
      sand: ['#f3dfa6', '#ecca80', '#d8b070'],
      water: '#1e8fc8',
      waterMid: '#39a3d8',
      waterLight: '#73c4e8',
      sun: '#fff9c0',
      sunCore: '#fff8a8',
      sunRays: 'rgba(255,250,200,0.10)',
    },
    noon: {
      sky: ['#4a9ee6', '#89c6f2', '#ffd89b'],
      sand: ['#f0d590', '#e8c478', '#d4a968'],
      water: '#1e7bb8',
      waterMid: '#2e95cc',
      waterLight: '#5ab4dd',
      sun: '#fff6a8',
      sunCore: '#fff6a8',
      sunRays: 'rgba(255,244,176,0.12)',
    },
    sunset: {
      sky: ['#ff7e5f', '#feb47b', '#ffd29a'],
      sand: ['#f4c282', '#e69e63', '#c47a4a'],
      water: '#24508e',
      waterMid: '#3a6eac',
      waterLight: '#7aa8d8',
      sun: '#ffd06b',
      sunCore: '#ffb766',
      sunRays: 'rgba(255,180,110,0.18)',
    },
  };

  var BEACH_TITLES = ['beachTitle', 'beachTitleAlt1', 'beachTitleAlt2', 'beachTitleAlt3'];
  var BEACH_TEXTS = ['beachText', 'beachTextAlt1', 'beachTextAlt2', 'beachTextAlt3'];
  var BEACH_KID_COLORS = ['#33bb77', '#cc44aa', '#ee7733', '#3388dd', '#dd3344', '#9966dd'];

  function makeBeachScene() {
    var times = ['morning', 'noon', 'sunset'];
    var time = times[Math.floor(Math.random() * times.length)];
    var pal = BEACH_PALETTES[time];

    /* Seagulls (3-6 birds at varied heights) */
    var gullCount = 3 + Math.floor(Math.random() * 4);
    var gulls = [];
    for (var g = 0; g < gullCount; g++) {
      gulls.push({
        x: Math.random() * W,
        y: 40 + Math.random() * 90,
        spd: 0.25 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* Crabs (2-4) with random base positions */
    var crabCount = 2 + Math.floor(Math.random() * 3);
    var crabs = [];
    for (var cb = 0; cb < crabCount; cb++) {
      crabs.push({
        baseX: 100 + Math.random() * (W - 200),
        dir: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* Kids (1-3) playing on the sand, each with a random shirt colour */
    var kidCount = 1 + Math.floor(Math.random() * 3);
    var kids = [];
    for (var k = 0; k < kidCount; k++) {
      kids.push({
        x: 180 + k * (440 / kidCount) + Math.random() * 40,
        y: 0.82 + Math.random() * 0.06,
        color: BEACH_KID_COLORS[Math.floor(Math.random() * BEACH_KID_COLORS.length)],
        bobOffset: Math.random() * Math.PI * 2,
      });
    }

    /* Optional flourishes */
    var hasBeachBall = Math.random() < 0.55;
    var ballX = 200 + Math.random() * 400;
    var hasFrisbee = Math.random() < 0.45;
    var frisbeeX = 200 + Math.random() * 400;
    var hasDolphin = Math.random() < 0.35;

    /* Title / subtitle pulled from translation pools so JP/EN both vary */
    var titleKey = BEACH_TITLES[Math.floor(Math.random() * BEACH_TITLES.length)];
    var textKey = BEACH_TEXTS[Math.floor(Math.random() * BEACH_TEXTS.length)];

    return {
      time: time,
      pal: pal,
      gulls: gulls,
      crabs: crabs,
      kids: kids,
      hasBeachBall: hasBeachBall,
      ballX: ballX,
      hasFrisbee: hasFrisbee,
      frisbeeX: frisbeeX,
      hasDolphin: hasDolphin,
      dolphinPhase: Math.random() * Math.PI * 2,
      titleKey: titleKey,
      textKey: textKey,
    };
  }

  /* Player-controlled Momoko state while the beach cutscene is up. She
     walks on the sand line between the palms; action key does a small
     hop. Position is in canvas-logical (0..W,0..H) coords. */
  var beachMomoko = null;
  var BEACH_GROUND_Y = H * 0.84;
  var BEACH_MIN_X = 60;
  var BEACH_MAX_X = W - 60;
  var BEACH_WALK_SPEED = 2.6;
  var BEACH_JUMP_V = -5.2;
  var BEACH_GRAVITY = 0.32;
  var BEACH_STRIDE = 0.2, BEACH_HALF_STRIDE = Math.PI / 1.5;
  /* Turbo: cadence stops rising at ~3.3 strides a second (x1.15 her
     walk); past that the stride lengthens. Letting go from a boost she
     slides to a stop over ~0.25 s. */
  var BEACH_CADENCE_MAX = 1.15, BEACH_GLIDE_DECEL = 2 * BEACH_WALK_SPEED / 15;

  function startBeachCutscene() {
    beachTimer = 0;
    beachKitty = null;
    beachScene = makeBeachScene();
    beachMomoko = {
      x: W / 2,
      y: BEACH_GROUND_Y,
      vy: 0,
      facing: 1,
      walkPhase: 0,
      walkAmt: 0,
      land: 0,
      sx: 1, turnFrom: 1, turnT: 1, face: 1,
      grounded: true,
      moving: false,
      turboT: 0, turboDir: 0, boost: 1, turbo: 0, glide: 0, puffs: [],
    };
  }

  /* Called from engine.js every frame while State.BEACH is active. `keys`
     and `jp` are the shared Game.input state. */
  function updateBeach(keys, jp) {
    if (!beachMomoko) return;
    var m = beachMomoko;
    m.moving = false;
    /* Turbo: holding one direction counts up; letting go or turning
       around starts over at 1x */
    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), x0 = m.x;
    if (dir && dir === m.turboDir) {
      m.turboT += 1 / 60;
      if (Math.abs(m.turboT - Game.entities.Momoko.TURBO_START) < 0.5 / 60) Game.audio.play('whoosh');
    } else {
      if (!dir && m.boost > 1) m.glide = m.turboDir * BEACH_WALK_SPEED * m.boost;
      m.turboT = 0;
    }
    if (dir) m.glide = 0;
    m.turboDir = dir;
    m.boost = Game.entities.Momoko.turboMul(m.turboT);
    var spd = BEACH_WALK_SPEED * m.boost;
    if (keys.left)  { m.x -= spd; m.facing = -1; m.moving = true; }
    if (keys.right) { m.x += spd; m.facing =  1; m.moving = true; }
    if (m.glide) {
      m.x += m.glide;
      var gs = Math.max(0, Math.abs(m.glide) - BEACH_GLIDE_DECEL);
      m.glide = m.glide > 0 ? gs : -gs;
    }
    if (m.x < BEACH_MIN_X) { m.x = BEACH_MIN_X; m.glide = 0; }
    if (m.x > BEACH_MAX_X) { m.x = BEACH_MAX_X; m.glide = 0; }
    var pace = Math.abs(m.x - x0) / BEACH_WALK_SPEED;
    var gliding = m.glide !== 0;
    m.turbo += ((m.moving ? m.boost - 1 : 0) - m.turbo) * (m.moving ? 1 : 0.2);

    /* Hop on action (space / BUBBLE). Uses justPressed so holding the
       key doesn't auto-bounce. */
    if (jp && jp.action && m.grounded) {
      m.vy = BEACH_JUMP_V;
      m.grounded = false;
    }
    /* Gravity + ground clamp */
    m.vy += BEACH_GRAVITY;
    m.y += m.vy;
    if (m.y >= BEACH_GROUND_Y) {
      m.y = BEACH_GROUND_Y;
      if (!m.grounded) m.land = 1;
      m.vy = 0;
      m.grounded = true;
    }

    /* Stride clock (x1.5 in hero.js): ~2.9 strides a second at her
       walk speed, short first step, and on a stop she finishes the step
       to feet-together instead of freezing mid-stride */
    if (m.grounded && (m.moving || gliding)) {
      var ph0 = m.walkPhase;
      m.walkPhase += BEACH_STRIDE * (0.4 + 0.6 * m.walkAmt) * (m.moving ? Math.min(BEACH_CADENCE_MAX, Math.max(1, pace)) : Math.max(0.5, Math.min(1, pace)));
      /* sand kicked up at each footfall once the boost is on */
      if (m.turbo > 0.05 && Math.floor(m.walkPhase / BEACH_HALF_STRIDE) !== Math.floor(ph0 / BEACH_HALF_STRIDE)) {
        for (var pi = 0; pi < 3 && m.puffs.length < 12; pi++) {
          m.puffs.push({ x: m.x - m.facing * (4 + pi * 5), y: BEACH_GROUND_Y + 8, vx: -m.facing * (0.4 + pi * 0.35), r: 2.5 + pi, life: 0, a: Math.min(1, m.turbo * 1.5) });
        }
      }
    } else if (m.grounded && m.walkAmt > 0.05) {
      var rest = Math.ceil(m.walkPhase / BEACH_HALF_STRIDE) * BEACH_HALF_STRIDE;
      m.walkPhase = Math.min(rest, m.walkPhase + BEACH_STRIDE * 0.8);
    }
    /* stride blends in and out instead of popping; a short settle on landing */
    m.walkAmt += (((m.moving || gliding) && m.grounded ? 1 : 0) - m.walkAmt) * (m.moving ? 0.25 : 0.14);
    m.land = Math.max(0, m.land - 0.1);
    for (var pf = m.puffs.length - 1; pf >= 0; pf--) {
      var puff = m.puffs[pf];
      puff.life += 1 / 24;
      puff.x += puff.vx; puff.y -= 0.25; puff.vx *= 0.92;
      if (puff.life >= 1) m.puffs.splice(pf, 1);
    }
    /* Turn through a 0.2 s squash with a small dip, not a mirror snap */
    if (m.facing !== m.face) { m.face = m.facing; m.turnFrom = m.sx; m.turnT = 0; }
    if (m.turnT < 1) m.turnT = Math.min(1, m.turnT + 1 / 12);
    var k = m.turnT * m.turnT * (3 - 2 * m.turnT), raw = m.turnFrom + (m.face - m.turnFrom) * k;
    m.sx = (raw > 0 || (raw === 0 && m.face > 0) ? 1 : -1) * Math.max(0.5, Math.abs(raw));
  }

  function drawPalmTree(c, x, groundY, scale, sway) {
    var s = scale || 1;
    /* Trunk – curved bezier */
    c.strokeStyle = '#6b4321';
    c.lineWidth = 10 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, groundY);
    c.bezierCurveTo(x - 10 * s, groundY - 60 * s, x + 10 * s, groundY - 100 * s, x + sway, groundY - 140 * s);
    c.stroke();
    /* Trunk rings */
    c.strokeStyle = '#4a2d15';
    c.lineWidth = 1.5;
    for (var tr = 0; tr < 6; tr++) {
      var rt = (tr + 1) / 7;
      var rx = x - 10 * s * (1 - rt) + sway * rt;
      var ry = groundY - 140 * s * rt;
      c.beginPath();
      c.arc(rx, ry, 5 * s, 0, Math.PI, false);
      c.stroke();
    }
    /* Fronds */
    var topX = x + sway;
    var topY = groundY - 140 * s;
    c.fillStyle = '#2a8833';
    for (var fr = 0; fr < 7; fr++) {
      var ang = (fr / 7) * Math.PI * 2 + 0.3;
      var len = 60 * s + (fr % 2) * 10;
      var tipX = topX + Math.cos(ang) * len;
      var tipY = topY + Math.sin(ang) * len * 0.7;
      var midX = topX + Math.cos(ang) * len * 0.5;
      var midY = topY + Math.sin(ang) * len * 0.35;
      c.beginPath();
      c.moveTo(topX, topY);
      c.quadraticCurveTo(midX, midY - 12 * s, tipX, tipY);
      c.quadraticCurveTo(midX, midY + 12 * s, topX, topY);
      c.closePath();
      c.fill();
    }
    /* Frond highlights */
    c.fillStyle = '#3caa45';
    for (var fh = 0; fh < 7; fh++) {
      var ahg = (fh / 7) * Math.PI * 2 + 0.3;
      var lng = 60 * s + (fh % 2) * 10;
      var hx = topX + Math.cos(ahg) * lng * 0.7;
      var hy = topY + Math.sin(ahg) * lng * 0.5;
      c.beginPath();
      c.ellipse(hx, hy, lng * 0.25, 3 * s, ahg, 0, Math.PI * 2);
      c.fill();
    }
    /* Coconuts */
    c.fillStyle = '#3d2512';
    c.beginPath(); c.arc(topX - 6 * s, topY + 4 * s, 4 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(topX + 5 * s, topY + 5 * s, 4 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(topX, topY - 2 * s, 3.5 * s, 0, Math.PI * 2); c.fill();
  }

  function drawSandcastle(c, x, y) {
    /* Base */
    c.fillStyle = '#d4a968';
    c.beginPath();
    c.moveTo(x - 24, y);
    c.lineTo(x + 24, y);
    c.lineTo(x + 22, y - 14);
    c.lineTo(x - 22, y - 14);
    c.closePath();
    c.fill();
    /* Center tower */
    c.fillStyle = '#e0b876';
    c.beginPath();
    c.moveTo(x - 10, y - 14);
    c.lineTo(x + 10, y - 14);
    c.lineTo(x + 9, y - 36);
    c.lineTo(x - 9, y - 36);
    c.closePath();
    c.fill();
    /* Tower top – crenellations as arcs */
    c.fillStyle = '#e0b876';
    for (var cc = 0; cc < 3; cc++) {
      c.beginPath();
      c.arc(x - 7 + cc * 7, y - 38, 2.5, Math.PI, 0);
      c.fill();
    }
    /* Side turrets */
    c.beginPath();
    c.arc(x - 22, y - 14, 5, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.arc(x + 22, y - 14, 5, Math.PI, 0);
    c.fill();
    /* Door */
    c.fillStyle = '#8a6338';
    c.beginPath();
    c.moveTo(x - 3, y - 14);
    c.lineTo(x + 3, y - 14);
    c.lineTo(x + 3, y - 22);
    c.quadraticCurveTo(x, y - 26, x - 3, y - 22);
    c.closePath();
    c.fill();
    /* Flag */
    c.strokeStyle = '#5d3a1b';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y - 36);
    c.lineTo(x, y - 48);
    c.stroke();
    c.fillStyle = '#ee4466';
    c.beginPath();
    c.moveTo(x, y - 48);
    c.lineTo(x + 8, y - 45);
    c.lineTo(x, y - 42);
    c.closePath();
    c.fill();
  }

  function drawBeachUmbrella(c, x, groundY) {
    /* Pole */
    c.strokeStyle = '#5d3a1b';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, groundY);
    c.lineTo(x, groundY - 62);
    c.stroke();
    /* Canopy dome – alternating stripes */
    var stripes = ['#ee4466', '#ffffff'];
    for (var st = 0; st < 6; st++) {
      var a0 = Math.PI + (st / 6) * Math.PI;
      var a1 = Math.PI + ((st + 1) / 6) * Math.PI;
      c.fillStyle = stripes[st % 2];
      c.beginPath();
      c.moveTo(x, groundY - 62);
      c.arc(x, groundY - 62, 38, a0, a1);
      c.closePath();
      c.fill();
    }
    /* Rim dots */
    c.fillStyle = '#cc2244';
    for (var rm = 0; rm < 7; rm++) {
      var ang = Math.PI + (rm / 6) * Math.PI;
      c.beginPath();
      c.arc(x + Math.cos(ang) * 38, groundY - 62 + Math.sin(ang) * 38, 2, 0, Math.PI * 2);
      c.fill();
    }
    /* Pole tip */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.arc(x, groundY - 64, 3, 0, Math.PI * 2);
    c.fill();
  }

  function drawBeachTowel(c, x, y, w, h, c1, c2) {
    /* Towel base */
    c.fillStyle = c1;
    roundRect(c, x, y, w, h, 3);
    c.fill();
    /* Stripes */
    c.fillStyle = c2;
    var sw = w / 6;
    for (var s = 0; s < 3; s++) {
      c.fillRect(x + s * 2 * sw + sw * 0.5, y, sw * 0.6, h);
    }
    /* Fringe */
    c.strokeStyle = c2;
    c.lineWidth = 1;
    for (var fg = 0; fg < 8; fg++) {
      var fx = x + (fg / 7) * w;
      c.beginPath();
      c.moveTo(fx, y + h);
      c.lineTo(fx, y + h + 3);
      c.stroke();
    }
  }

  function drawSeagull(c, x, y, flap) {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    var wing = Math.sin(flap) * 5;
    c.beginPath();
    c.moveTo(x - 10, y + 2 + wing);
    c.quadraticCurveTo(x - 5, y - 5 - wing, x, y);
    c.quadraticCurveTo(x + 5, y - 5 - wing, x + 10, y + 2 + wing);
    c.stroke();
    /* Body dot */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y - 1, 1.6, 0, Math.PI * 2);
    c.fill();
  }

  function drawCrab(c, x, y, phase) {
    var leg = Math.sin(phase) * 2;
    c.fillStyle = '#dd4433';
    /* Body */
    c.beginPath();
    c.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2);
    c.fill();
    /* Claws */
    c.beginPath();
    c.ellipse(x - 9, y - 2, 3.5, 2.5, -0.3, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + 9, y - 2, 3.5, 2.5, 0.3, 0, Math.PI * 2);
    c.fill();
    /* Legs */
    c.strokeStyle = '#aa2211';
    c.lineWidth = 1.4;
    for (var lg = 0; lg < 3; lg++) {
      var lx = x - 5 + lg * 5;
      var lOff = (lg % 2 === 0 ? leg : -leg);
      c.beginPath();
      c.moveTo(lx - 2, y + 3);
      c.lineTo(lx - 4, y + 6 + lOff);
      c.stroke();
      c.beginPath();
      c.moveTo(lx + 2, y + 3);
      c.lineTo(lx + 4, y + 6 - lOff);
      c.stroke();
    }
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x - 3, y - 4, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 3, y - 4, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(x - 3, y - 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 3, y - 4, 0.8, 0, Math.PI * 2); c.fill();
  }

  function drawKid(c, x, groundY, outfit, bob) {
    var bobOff = Math.sin(bob) * 1.5;
    /* Head */
    c.fillStyle = '#ffddbb';
    c.beginPath();
    c.arc(x, groundY - 30 + bobOff, 5, 0, Math.PI * 2);
    c.fill();
    /* Hair tuft */
    c.fillStyle = '#553322';
    c.beginPath();
    c.arc(x, groundY - 34 + bobOff, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.fill();
    /* Eyes */
    c.fillStyle = '#223344';
    c.beginPath(); c.arc(x - 2, groundY - 30 + bobOff, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 2, groundY - 30 + bobOff, 0.8, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#aa3344';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, groundY - 28 + bobOff, 1.6, 0.2, Math.PI - 0.2);
    c.stroke();
    /* Body / shirt */
    c.fillStyle = outfit;
    c.beginPath();
    c.moveTo(x - 5, groundY - 24 + bobOff);
    c.quadraticCurveTo(x - 6, groundY - 14, x - 4, groundY - 10);
    c.lineTo(x + 4, groundY - 10);
    c.quadraticCurveTo(x + 6, groundY - 14, x + 5, groundY - 24 + bobOff);
    c.closePath();
    c.fill();
    /* Arms – waving */
    c.strokeStyle = '#ffddbb';
    c.lineWidth = 2;
    c.lineCap = 'round';
    var arm = Math.sin(bob + 1) * 4;
    c.beginPath();
    c.moveTo(x - 5, groundY - 22 + bobOff);
    c.lineTo(x - 9, groundY - 18 - arm);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 5, groundY - 22 + bobOff);
    c.lineTo(x + 9, groundY - 18 + arm);
    c.stroke();
    /* Legs */
    c.strokeStyle = outfit;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x - 2, groundY - 10);
    c.lineTo(x - 3, groundY);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 2, groundY - 10);
    c.lineTo(x + 3, groundY);
    c.stroke();
  }

  function drawStarfish(c, x, y, size, rot, color) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = color;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = (i % 2 === 0) ? size : size * 0.4;
      var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      var px = Math.cos(a) * r;
      var py = Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  /* Twinkling sun glints on a strip of sea. Positions come from the index
     so nothing is re-randomised per frame; glints near sunX are brighter. */
  function drawSeaSparkles(c, t, sunX, y0, y1, count) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#ffffff';
    for (var i = 0; i < count; i++) {
      var gx = (i * 137 + 23) % W;
      var gy = y0 + ((i * 53) % 97) / 97 * (y1 - y0);
      var tw = Math.sin(t * 0.06 + i * 2.3);
      if (tw <= 0.2) continue;
      var near = Math.max(0, 1 - Math.abs(gx - sunX) / 260);
      c.globalAlpha = (tw - 0.2) * (0.35 + near * 0.6);
      c.beginPath();
      c.ellipse(gx + Math.sin(t * 0.01 + i) * 4, gy, 3 + near * 4, 0.9, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  /* Player-controlled Momoko walking on the sand. Painted in y order
     with the other beach actors. Scaled 2x so she matches the size of
     kids / beach props. The sprite's animFrame parameter drives her
     flipper/foot kick timing. */
  function drawBeachMomoko(c, mm) {
    /* Sand puffs from her turbo footfalls */
    if (mm.puffs.length) {
      c.save();
      c.fillStyle = '#f3dfb4';
      for (var pi = 0; pi < mm.puffs.length; pi++) {
        var pu = mm.puffs[pi];
        c.globalAlpha = 0.55 * pu.a * (1 - pu.life) * Math.min(1, pu.life * 6);
        c.beginPath();
        c.arc(pu.x, pu.y, pu.r * (1 + pu.life * 1.4), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    /* Shadow on sand */
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.22)';
    var shadowSquash = mm.grounded ? 1 : 0.6;
    c.beginPath();
    c.ellipse(mm.x, BEACH_GROUND_Y + 10, 16 * shadowSquash, 4 * shadowSquash, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    c.save();
    c.translate(mm.x, mm.y);
    c.scale(mm.sx < 0 ? -2 : 2, 2);
    /* The sprite's natural origin is its top-left, so shift up by full
       sprite height (34) to plant feet on the ground line. */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, -14, -34, Game.customization, 0,
        { t: Date.now() * 0.001, fwd: 1.8 * mm.walkAmt, vy: mm.grounded ? 0 : mm.vy * 0.4, sx: Math.abs(mm.sx),
          phase: mm.walkPhase, air: !mm.grounded, land: Math.max(mm.land, 0.35 * Math.sin(mm.turnT * Math.PI)), turbo: mm.turbo });
    }
    /* Companion crab trails behind her opposite facing direction */
    if (Game.entities && Game.entities.drawCrabPet &&
        Game.customization.crab && Game.customization.crab !== 'none') {
      Game.entities.drawCrabPet(c, -22, -2, Game.customization.crab, beachTimer);
    }
    c.restore();
  }

  function drawBeachCutscene(c, wolfe) {
    beachTimer++;
    var t = beachTimer;
    /* Lazily seed a default scene if the engine somehow rendered the
       cutscene without calling startBeachCutscene first. */
    if (!beachScene) beachScene = makeBeachScene();
    var sc = beachScene;
    var pal = sc.pal;

    /* Sky gradient – three-stop palette per time of day */
    var skyGrad = c.createLinearGradient(0, 0, 0, H * 0.6);
    skyGrad.addColorStop(0, pal.sky[0]);
    skyGrad.addColorStop(0.6, pal.sky[1]);
    skyGrad.addColorStop(1, pal.sky[2]);
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, H * 0.6);

    /* Sun position varies with time of day so sunset reads as low / warm */
    var sunX = sc.time === 'morning' ? 150 : sc.time === 'sunset' ? 690 : 650;
    var sunY = sc.time === 'sunset' ? 150 : 78;

    c.save();
    c.globalAlpha = 1;
    c.strokeStyle = pal.sun;
    c.lineWidth = 3;
    for (var ry = 0; ry < 14; ry++) {
      var ra = (ry / 14) * Math.PI * 2 + t * 0.002;
      c.globalAlpha = 0.12;
      c.beginPath();
      c.moveTo(sunX, sunY);
      c.lineTo(sunX + Math.cos(ra) * 180, sunY + Math.sin(ra) * 180);
      c.stroke();
    }
    c.restore();

    /* Sun glow */
    var sunGrad = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    sunGrad.addColorStop(0, pal.sunRays.replace(/[\d.]+\)$/, '0.9)'));
    sunGrad.addColorStop(1, pal.sunRays.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = sunGrad;
    c.fillRect(sunX - 90, sunY - 90, 180, 180);
    /* Sun core */
    c.fillStyle = pal.sunCore;
    c.beginPath();
    c.arc(sunX, sunY, 32, 0, Math.PI * 2);
    c.fill();

    /* Horizon sea – lighter at the horizon, with sun glints twinkling
       across it (strongest under the sun) */
    var seaTop = H * 0.52, seaBot = H * 0.6;
    var seaGrad = c.createLinearGradient(0, seaTop, 0, seaBot);
    seaGrad.addColorStop(0, pal.waterLight);
    seaGrad.addColorStop(1, pal.water);
    c.fillStyle = seaGrad;
    c.fillRect(0, seaTop, W, seaBot - seaTop);
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.fillRect(0, seaTop, W, 1);
    drawSeaSparkles(c, t, sunX, seaTop + 3, seaBot - 2, 34);

    /* Clouds – tinted slightly to match palette */
    c.fillStyle = sc.time === 'sunset' ? '#ffd0b0' : '#ffffff';
    for (var cl = 0; cl < 4; cl++) {
      var cx = ((200 + cl * 220 + t * 0.25) % (W + 200)) - 100;
      var cy = 50 + cl * 18;
      c.globalAlpha = 0.9;
      c.beginPath();
      c.arc(cx, cy, 18, 0, Math.PI * 2);
      c.arc(cx + 18, cy - 4, 22, 0, Math.PI * 2);
      c.arc(cx + 38, cy, 16, 0, Math.PI * 2);
      c.arc(cx + 24, cy + 8, 18, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    /* Seagulls (count / positions vary per visit) */
    for (var sg = 0; sg < sc.gulls.length; sg++) {
      var bird = sc.gulls[sg];
      bird.x += bird.spd;
      if (bird.x > W + 20) bird.x = -20;
      drawSeagull(c, bird.x, bird.y + Math.sin(t * 0.02 + bird.phase) * 4, t * 0.18 + bird.phase);
    }

    /* Optional dolphin breaching the waves in the distance */
    if (sc.hasDolphin) {
      var dPhase = t * 0.012 + sc.dolphinPhase;
      var dx = ((dPhase * 30) % (W + 200)) - 100;
      var dyOff = Math.sin(dPhase * 2) * 10 - 6;
      if (Math.sin(dPhase * 2) > 0) {
        c.fillStyle = '#3a4a55';
        c.beginPath();
        c.ellipse(dx, H * 0.92 + dyOff, 14, 5, -0.3, 0, Math.PI * 2);
        c.fill();
        /* Dorsal fin */
        c.beginPath();
        c.moveTo(dx, H * 0.92 + dyOff - 2);
        c.lineTo(dx + 4, H * 0.92 + dyOff - 9);
        c.lineTo(dx + 8, H * 0.92 + dyOff - 1);
        c.closePath();
        c.fill();
      }
    }

    /* Sand – main beach */
    var sandGrad = c.createLinearGradient(0, H * 0.55, 0, H);
    sandGrad.addColorStop(0, pal.sand[0]);
    sandGrad.addColorStop(0.5, pal.sand[1]);
    sandGrad.addColorStop(1, pal.sand[2]);
    c.fillStyle = sandGrad;
    c.beginPath();
    c.moveTo(0, H * 0.6);
    for (var sx = 0; sx <= W; sx += 8) {
      var sandY = H * 0.58 + Math.sin(sx * 0.008) * 4 + Math.sin(sx * 0.04) * 2;
      c.lineTo(sx, sandY);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    /* Sand bumps / ripples */
    c.strokeStyle = 'rgba(183, 138, 78, 0.4)';
    c.lineWidth = 1;
    for (var rp = 0; rp < 6; rp++) {
      c.beginPath();
      c.moveTo(0, H * 0.7 + rp * 22);
      for (var rx2 = 0; rx2 <= W; rx2 += 20) {
        c.lineTo(rx2, H * 0.7 + rp * 22 + Math.sin(rx2 * 0.03 + rp) * 2);
      }
      c.stroke();
    }

    /* Palm trees (behind beach items) */
    drawPalmTree(c, 70, H * 0.6, 1.0, Math.sin(t * 0.008) * 4);
    drawPalmTree(c, 760, H * 0.6, 0.9, Math.sin(t * 0.009 + 1) * 4);
    drawPalmTree(c, 540, H * 0.58, 0.7, Math.sin(t * 0.007 + 2) * 3);

    /* Beach towels */
    drawBeachTowel(c, 160, H * 0.76, 70, 28, '#ee4466', '#ffffff');
    drawBeachTowel(c, 420, H * 0.8, 64, 26, '#44aadd', '#ffff66');

    /* Starfish scattered on sand (flat, so always underneath) */
    drawStarfish(c, 140, H * 0.84, 6, 0.4, '#e66442');
    drawStarfish(c, 500, H * 0.78, 5, 1.1, '#e6a84a');
    drawStarfish(c, 720, H * 0.77, 5, 0.7, '#d94a5a');

    /* Frisbee – arcing through the sky */
    if (sc.hasFrisbee) {
      var frX = (sc.frisbeeX + (t * 1.2) % 600) - 100;
      var frY = 200 + Math.sin(t * 0.025) * 60;
      drawFrisbee(c, frX, frY, t * 0.2);
    }

    /* Standing props and characters, painted back-to-front by the y of
       their feet so whoever is nearer the shore overlaps the rest. */
    var actors = [
      { y: H * 0.84, fn: function () { drawBeachUmbrella(c, 660, H * 0.84); } },
      { y: H * 0.82, fn: function () { drawSandcastle(c, 320, H * 0.82); } },
    ];
    if (sc.hasBeachBall) {
      actors.push({ y: H * 0.86, fn: function () {
        drawBeachBall(c, sc.ballX, H * 0.86 - Math.abs(Math.sin(t * 0.06)) * 30, t * 0.04);
      } });
    }
    function kidActor(kid) {
      return { y: H * kid.y, fn: function () { drawKid(c, kid.x, H * kid.y, kid.color, t * 0.08 + kid.bobOffset); } };
    }
    for (var ki = 0; ki < sc.kids.length; ki++) actors.push(kidActor(sc.kids[ki]));
    function crabActor(crab) {
      return { y: H * 0.88, fn: function () {
        var crabX = crab.baseX + Math.sin(t * 0.01 + crab.phase) * 30 * crab.dir;
        drawCrab(c, crabX, H * 0.88 + Math.sin(t * 0.04 + crab.phase) * 1, t * 0.2 + crab.phase);
      } };
    }
    for (var cb = 0; cb < sc.crabs.length; cb++) actors.push(crabActor(sc.crabs[cb]));
    if (beachMomoko) actors.push({ y: BEACH_GROUND_Y + 10, fn: function () { drawBeachMomoko(c, beachMomoko); } });
    actors.sort(function (p, q) { return p.y - q.y; });
    for (var ac = 0; ac < actors.length; ac++) actors[ac].fn();

    /* Wolfe on beach */
    if (wolfe) {
      wolfe.y = H * 0.6 - 22;
      wolfe.draw(c, 0, 0);
    }

    /* Water at bottom – tinted by time of day */
    c.fillStyle = pal.water;
    c.fillRect(0, H * 0.93, W, H * 0.07);

    /* Overlapping waves, each shaded darker toward the bottom edge */
    var wgMid = c.createLinearGradient(0, H * 0.92, 0, H);
    wgMid.addColorStop(0, pal.waterMid);
    wgMid.addColorStop(1, pal.water);
    c.fillStyle = wgMid;
    c.beginPath();
    c.moveTo(0, H * 0.93);
    for (var w1 = 0; w1 <= W; w1 += 6) {
      c.lineTo(w1, H * 0.93 + Math.sin(t * 0.04 + w1 * 0.04) * 3);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    var wgLight = c.createLinearGradient(0, H * 0.94, 0, H);
    wgLight.addColorStop(0, pal.waterLight);
    wgLight.addColorStop(1, pal.waterMid);
    c.fillStyle = wgLight;
    c.beginPath();
    c.moveTo(0, H * 0.945);
    for (var w2 = 0; w2 <= W; w2 += 6) {
      c.lineTo(w2, H * 0.945 + Math.sin(t * 0.05 + w2 * 0.05 + 1.2) * 2.5);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    /* Wave foam fringe */
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.8;
    c.globalAlpha = 0.85;
    c.beginPath();
    for (var wf = 0; wf <= W; wf += 4) {
      var wfy = H * 0.93 + Math.sin(t * 0.04 + wf * 0.04) * 3;
      if (wf === 0) c.moveTo(wf, wfy);
      else c.lineTo(wf, wfy);
    }
    c.stroke();
    c.globalAlpha = 1;
    /* Foam dots */
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (var fd = 0; fd < 18; fd++) {
      var fdx = (fd * 46 + (t * 0.3) % 46) % W;
      var fdy = H * 0.93 + Math.sin(t * 0.04 + fdx * 0.04) * 3 + Math.sin(t * 0.07 + fd) * 1.5;
      c.beginPath();
      c.arc(fdx, fdy, 1.5, 0, Math.PI * 2);
      c.fill();
    }
    drawSeaSparkles(c, t, sunX, H * 0.955, H - 4, 22);

    /* Kitty Corn splashing at shore */
    if (!beachKitty && Game.entities && Game.entities.KittyCorn) {
      beachKitty = new Game.entities.KittyCorn(420, H * 0.9);
    }
    if (beachKitty) {
      beachKitty.update();
      beachKitty.x = 420 + Math.sin(t * 0.04) * 20;
      beachKitty.y = H * 0.9 - 8 + Math.sin(t * 0.12) * 3;
      beachKitty.draw(c, 0, 0);
      /* Splash particles */
      for (var sp2 = 0; sp2 < 3; sp2++) {
        var spa = -Math.PI / 2 + (sp2 - 1) * 0.5;
        var spr = 6 + (Math.sin(t * 0.1 + sp2) + 1) * 8;
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(beachKitty.x + 12 + Math.cos(spa) * spr, beachKitty.y + 20 + Math.sin(spa) * spr, 2, 0, Math.PI * 2);
        c.fill();
      }
    }

    /* Title text with shadow – pulled from a small pool so it varies */
    c.save();
    c.fillStyle = '#ffffff';
    c.font = 'bold 30px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fillText(Game.i18n.t(sc.titleKey), W / 2, 40);
    c.restore();

    /* Text panel */
    var panelW = 520, panelH = 60, panelX = (W - panelW) / 2, panelY = 58;
    /* Near-opaque so the text stays readable over the bright sky. */
    c.fillStyle = 'rgba(6, 40, 72, 0.88)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.strokeStyle = '#7ce8ff';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#e8f4ff';
    c.font = '14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    wrapText(c, Game.i18n.t(sc.textKey), W / 2, panelY + 22, panelW - 20, 20);

    drawButton(c, Game.i18n.t('back'), W / 2 - 90, 140, 180, 40);
  }

  function drawBeachBall(c, x, y, spin) {
    var r = 12;
    /* Base */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    /* Coloured wedges */
    var wedges = ['#ee4466', '#ffdd44', '#33aaee'];
    for (var w = 0; w < 3; w++) {
      var a0 = spin + (w / 3) * Math.PI * 2;
      var a1 = a0 + Math.PI / 6;
      c.fillStyle = wedges[w];
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, r, a0, a1);
      c.closePath();
      c.fill();
    }
    /* Outline */
    c.strokeStyle = '#333';
    c.lineWidth = 0.8;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    /* Shadow on sand */
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(x, H * 0.88, 8, 2, 0, 0, Math.PI * 2);
    c.fill();
  }

  function drawFrisbee(c, x, y, spin) {
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(spin) * 0.3);
    c.fillStyle = '#ff6644';
    c.beginPath();
    c.ellipse(0, 0, 12, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#cc3322';
    c.beginPath();
    c.ellipse(0, 1, 12, 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function handleBeachClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 140, 180, 40)) {
      Game.audio.play('select');
      beachTimer = 0;
      return 'dive';
    }
    return null;
  }

  /* ---- Shared bits for the progression screens ---- */

  /* Five-point star; lit ones are gold with a dark rim, empty ones are a
     dim outline so the missing stars still show what's possible. */
  function drawStar(c, cx, cy, r, lit, scale) {
    scale = scale || 1;
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.46;
      if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.lineJoin = 'round';
    if (lit) {
      var g = c.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#fff3a0');
      g.addColorStop(0.5, '#ffd24a');
      g.addColorStop(1, '#e08a10');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#7a4400';
      c.lineWidth = Math.max(1.2, r * 0.12);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.ellipse(-r * 0.25, -r * 0.3, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = 'rgba(10, 30, 60, 0.45)';
      c.fill();
      c.strokeStyle = 'rgba(160, 200, 230, 0.5)';
      c.lineWidth = Math.max(1, r * 0.1);
      c.stroke();
    }
    c.restore();
  }

  function drawPearlIcon(c, cx, cy, r) {
    var spr = Game.entities && Game.entities.getPearlSprite ? Game.entities.getPearlSprite() : null;
    if (spr) {
      var s = (r * 2) / 15;
      c.drawImage(spr, cx - 10 * s, cy - 10 * s, 20 * s, 20 * s);
    } else {
      c.fillStyle = '#fff0f6';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    }
  }

  /* Outlined count text like "12 / 30" next to a pearl icon */
  function drawPearlCount(c, cx, cy, got, total, size) {
    var text = got + ' / ' + total;
    c.save();
    c.font = 'bold ' + size + 'px ' + FONT;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    var tw = c.measureText(text).width;
    var r = size * 0.55;
    var startX = cx - (tw + r * 2 + 10) / 2;
    drawPearlIcon(c, startX + r, cy, r);
    c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.18);
    c.strokeStyle = 'rgba(6, 30, 60, 0.9)';
    c.strokeText(text, startX + r * 2 + 10, cy + 1);
    c.fillStyle = '#ffffff';
    c.fillText(text, startX + r * 2 + 10, cy + 1);
    c.restore();
  }

  /* Padlock for locked level cards */
  function drawPadlock(c, cx, cy, s) {
    c.save();
    c.translate(cx, cy);
    c.lineCap = 'round';
    c.strokeStyle = '#d8dde6';
    c.lineWidth = 4 * s;
    c.beginPath();
    c.arc(0, -8 * s, 9 * s, Math.PI, 0);
    c.stroke();
    var g = c.createLinearGradient(0, -6 * s, 0, 14 * s);
    g.addColorStop(0, '#ffd24a');
    g.addColorStop(1, '#c0801a');
    c.fillStyle = g;
    roundRect(c, -14 * s, -6 * s, 28 * s, 22 * s, 4 * s);
    c.fill();
    c.strokeStyle = '#6a4000';
    c.lineWidth = 1.5 * s;
    c.stroke();
    c.fillStyle = '#5a3400';
    c.beginPath(); c.arc(0, 3 * s, 3 * s, 0, Math.PI * 2); c.fill();
    c.fillRect(-1.5 * s, 3 * s, 3 * s, 7 * s);
    c.restore();
  }

  /* ---- Level Clear ----
     Shown after a mini-boss falls: the reef's name, stars that pop in one
     by one, the pearl tally, and Next Level / Level Select buttons. */
  var levelClearTimer = 0;
  var levelClearFriend = null;
  var LC_BTN_Y = 400, LC_BTN_W = 200, LC_BTN_H = 48;

  function resetLevelClear() {
    levelClearTimer = 0;
  }

  function drawLevelClear(c, info) {
    levelClearTimer++;
    var t = levelClearTimer;
    info = info || { level: 0, pearls: 0, total: 0, stars: 1, hasNext: true };
    var lvl = Game.levels.get(info.level);

    c.save();
    drawSeaBackdrop(c, t, true, 448);
    drawReefSand(c);
    drawReefSides(c, t, 448);
    clipGame(c);
    drawReefForeground(c, t);

    /* Momoko dancing, Oliver cheering beside her */
    if (Game.entities && Game.entities.drawMomokoFloss) {
      c.save();
      c.translate(150, 318 - Math.abs(Math.sin(t * 0.09)) * 6);
      c.scale(2.4, 2.4);
      Game.entities.drawMomokoFloss(c, -14, -17, Game.customization, t * 0.18);
      c.restore();
    }
    if (Game.entities && Game.entities.Oliver) {
      if (!levelClearFriend) levelClearFriend = new Game.entities.Oliver(0, 0);
      levelClearFriend.update();
      c.save();
      c.translate(640, 300 + Math.sin(t * 0.07) * 4);
      c.scale(1.8, 1.8);
      levelClearFriend.draw(c, levelClearFriend.w / 2, levelClearFriend.h / 2);
      c.restore();
    }

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    /* Heading */
    var pop = Math.min(1, t / 18);
    var headScale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    c.save();
    c.translate(W / 2, 68);
    c.scale(headScale, headScale);
    fitFont(c, Game.i18n.t('levelClear'), W - 120, 46, 'bold');
    c.lineWidth = 8;
    c.strokeStyle = '#4a1f00';
    c.strokeText(Game.i18n.t('levelClear'), 0, 0);
    c.fillStyle = '#ffd24a';
    c.shadowColor = '#ffaa00';
    c.shadowBlur = 18;
    c.fillText(Game.i18n.t('levelClear'), 0, 0);
    c.restore();

    /* Level name */
    var name = lvl ? Game.i18n.t(lvl.nameKey) : '';
    fitFont(c, name, W - 120, 22, 'bold');
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(6, 30, 60, 0.85)';
    c.strokeText(name, W / 2, 116);
    c.fillStyle = '#bff0ff';
    c.fillText(name, W / 2, 116);

    /* Stars pop in one at a time with a little overshoot */
    for (var s = 0; s < 3; s++) {
      var lit = s < info.stars;
      var born = 30 + s * 22;
      var age = t - born;
      var sc = 1;
      if (lit) {
        if (age < 0) sc = 0;
        else if (age < 14) sc = 1.5 - 0.5 * Math.pow(age / 14, 0.6);
      }
      var sy = 178 + (s === 1 ? -8 : 0);
      if (sc > 0) drawStar(c, W / 2 + (s - 1) * 74, sy, 30, lit, sc);
    }

    /* Pearl tally */
    c.font = 'bold 14px ' + FONT;
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(6, 30, 60, 0.85)';
    c.strokeText(Game.i18n.t('pearlsCollected'), W / 2, 236);
    c.fillStyle = '#dfeeff';
    c.fillText(Game.i18n.t('pearlsCollected'), W / 2, 236);
    var shown = Math.min(info.pearls, Math.floor(Math.max(0, t - 40) / 2.5));
    drawPearlCount(c, W / 2, 268, shown, info.total, 30);
    if (info.pearls >= info.total && info.total > 0 && t > 120) {
      fitFont(c, Game.i18n.t('perfectPearls'), W - 200, 16, 'bold');
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(80, 30, 0, 0.9)';
      c.strokeText(Game.i18n.t('perfectPearls'), W / 2, 306 + Math.sin(t * 0.1) * 2);
      c.fillStyle = '#ffe28a';
      c.fillText(Game.i18n.t('perfectPearls'), W / 2, 306 + Math.sin(t * 0.1) * 2);
    }

    /* Buttons */
    if (info.hasNext) {
      drawButton(c, Game.i18n.t('levelSelect'), W / 2 - LC_BTN_W - 10, LC_BTN_Y, LC_BTN_W, LC_BTN_H);
      drawButton(c, Game.i18n.t('nextLevel'), W / 2 + 10, LC_BTN_Y, LC_BTN_W, LC_BTN_H, false, 'primary');
    } else {
      drawButton(c, Game.i18n.t('levelSelect'), W / 2 - LC_BTN_W / 2, LC_BTN_Y, LC_BTN_W, LC_BTN_H, false, 'primary');
    }
    c.restore();
    drawVersionStamp(c, 'rgba(255, 255, 255, 0.55)');
  }

  function handleLevelClearClick(mx, my, info) {
    var hasNext = !info || info.hasNext;
    if (hasNext) {
      if (hitButton(mx, my, W / 2 - LC_BTN_W - 10, LC_BTN_Y, LC_BTN_W, LC_BTN_H)) { Game.audio.play('select'); return 'select'; }
      if (hitButton(mx, my, W / 2 + 10, LC_BTN_Y, LC_BTN_W, LC_BTN_H)) { Game.audio.play('select'); return 'next'; }
    } else if (hitButton(mx, my, W / 2 - LC_BTN_W / 2, LC_BTN_Y, LC_BTN_W, LC_BTN_H)) {
      Game.audio.play('select');
      return 'select';
    }
    return null;
  }

  /* ---- Level Select ("Choose a Reef") ----
     Three cards, each with a code-painted thumbnail of its reef, the best
     star rating and pearl count, and a padlock while it is still locked. */
  var levelSelectTimer = 0;
  var lockShake = [0, 0, 0];
  var CARD_W = 214, CARD_H = 258, CARD_Y = 82, CARD_GAP = 18;
  var CARD_X0 = Math.round((W - (CARD_W * 3 + CARD_GAP * 2)) / 2);
  var LS_BACK = { x: W / 2 - 80, y: 404, w: 160, h: 44 };
  var thumbCache = {};

  function cardX(i) { return CARD_X0 + i * (CARD_W + CARD_GAP); }

  /* Thumbnail painted once per theme into an offscreen canvas */
  function getThumb(theme) {
    if (thumbCache[theme]) return thumbCache[theme];
    var tw = CARD_W - 24, th = 100;
    var cv = document.createElement('canvas');
    cv.width = tw * 2; cv.height = th * 2;
    var c = cv.getContext('2d');
    c.scale(2, 2);
    paintThumb(c, theme, tw, th);
    thumbCache[theme] = cv;
    return cv;
  }

  function paintThumb(c, theme, tw, th) {
    var i, d;
    var dec = Game.engine && Game.engine.drawDecorationAt;
    /* The level's own water, reef planes and light, seen from further
       back; the props below are the foreground of the picture. */
    Game.fx.paintScene(c, theme, tw, th);
    if (theme === 'trench') {
      /* Sand, then glowing plants with halos */
      c.fillStyle = '#2a2f3c';
      c.beginPath(); c.moveTo(0, th); c.lineTo(0, th - 12);
      for (var x = 0; x <= tw; x += 8) c.lineTo(x, th - 12 + Math.sin(x * 0.08) * 2);
      c.lineTo(tw, th); c.closePath(); c.fill();
      c.save();
      c.scale(0.7, 0.7);
      var plants = [[22, 0], [70, 1], [130, 2], [200, 0], [250, 1]];
      if (dec) {
        for (i = 0; i < plants.length; i++) dec(c, { type: 'glowplant', x: plants[i][0] * 13, y: 0, variant: plants[i][1] }, plants[i][0], (th - 10) / 0.7, 1.3);
        dec(c, { type: 'crystal', x: 500, y: 0 }, 165, (th - 10) / 0.7, 1.3);
      }
      c.restore();
      c.save();
      c.globalCompositeOperation = 'lighter';
      var cols = ['63,240,216', '255,111,208', '155,123,255', '63,240,216', '255,111,208'];
      for (i = 0; i < plants.length; i++) {
        var hx = plants[i][0] * 0.7, hy = th - 10 - (plants[i][1] === 1 ? 44 : 30) * 0.7;
        var hg = c.createRadialGradient(hx, hy, 2, hx, hy, 26);
        hg.addColorStop(0, 'rgba(' + cols[i] + ',0.45)');
        hg.addColorStop(1, 'rgba(' + cols[i] + ',0)');
        c.fillStyle = hg;
        c.fillRect(hx - 26, hy - 26, 52, 52);
      }
      c.restore();
      /* A glowing jellyfish and Moni's silhouette with her crown */
      if (Game.entities && Game.entities.Jellyfish) {
        var j = new Game.entities.Jellyfish(0, 0, true);
        j.hue = 300; j.timer = 30;
        c.save(); c.translate(44, 22); c.scale(0.9, 0.9); j.draw(c, 0, 0); c.restore();
      }
      c.fillStyle = 'rgba(70, 20, 100, 0.85)';
      c.beginPath(); c.ellipse(tw - 42, 40, 9, 9, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(tw - 42, 58, 8, 11, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(tw - 48, 66); c.quadraticCurveTo(tw - 40, 80, tw - 30, 86); c.lineTo(tw - 42, 84); c.lineTo(tw - 50, 90); c.quadraticCurveTo(tw - 46, 76, tw - 48, 66); c.fill();
      c.fillStyle = '#ffcc33';
      c.beginPath(); c.moveTo(tw - 49, 32); c.lineTo(tw - 47, 25); c.lineTo(tw - 44, 29); c.lineTo(tw - 42, 23); c.lineTo(tw - 40, 29); c.lineTo(tw - 37, 25); c.lineTo(tw - 35, 32); c.closePath(); c.fill();
      c.fillStyle = '#ff4466';
      c.beginPath(); c.arc(tw - 45, 39, 1.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(tw - 39, 39, 1.3, 0, Math.PI * 2); c.fill();
    } else if (theme === 'wreck') {
      c.fillStyle = '#c4ba8c';
      c.beginPath(); c.moveTo(0, th); c.lineTo(0, th - 10);
      for (var x2 = 0; x2 <= tw; x2 += 8) c.lineTo(x2, th - 10 + Math.sin(x2 * 0.07) * 2);
      c.lineTo(tw, th); c.closePath(); c.fill();
      if (dec) {
        c.save();
        c.scale(0.42, 0.42);
        dec(c, { type: 'wreck', x: 2180, y: 0, w: 300, h: 150 }, 20, (th - 8) / 0.42, 1);
        dec(c, { type: 'mast', x: 2480, y: 0, h: 150 }, 160, (th - 8) / 0.42 - 60, 1);
        c.restore();
        c.save();
        c.scale(0.5, 0.5);
        dec(c, { type: 'tallkelp', x: 80, y: 0, h: 150 }, 16, (th - 8) / 0.5, 1.2);
        dec(c, { type: 'tallkelp', x: 150, y: 0, h: 120 }, 44, (th - 8) / 0.5, 2.1);
        dec(c, { type: 'tallkelp', x: 900, y: 0, h: 140 }, (tw - 14) / 0.5, (th - 8) / 0.5, 0.4);
        dec(c, { type: 'barrel', x: 1100, y: 0 }, (tw - 60) / 0.5, (th - 8) / 0.5, 0);
        c.restore();
      }
      if (Game.entities && Game.entities.Chest) {
        var ch = new Game.entities.Chest(0, 0, 3);
        c.save(); c.translate(tw - 46, th - 30); c.scale(0.7, 0.7); ch.draw(c, 0, 0); c.restore();
      }
    } else {
      c.fillStyle = '#e2cc9a';
      c.beginPath(); c.moveTo(0, th); c.lineTo(0, th - 10);
      for (var x3 = 0; x3 <= tw; x3 += 8) c.lineTo(x3, th - 10 + Math.sin(x3 * 0.07) * 2);
      c.lineTo(tw, th); c.closePath(); c.fill();
      if (Game.engine && Game.engine.drawCoral) {
        var corals = [[18, 0], [52, 1], [118, 2], [160, 0]];
        for (i = 0; i < corals.length; i++) {
          c.save(); c.translate(corals[i][0], th - 12); c.scale(0.9, 0.9); Game.engine.drawCoral(c, 0, 0, corals[i][1], corals[i][0] * 7); c.restore();
        }
      }
      if (dec) {
        dec(c, { type: 'seaweed', x: 80, y: 0, h: 40 }, 86, th - 10, 1);
        dec(c, { type: 'seaweed', x: 300, y: 0, h: 30 }, 140, th - 10, 2);
      }
      if (Game.entities && Game.entities.Fish) {
        var f = new Game.entities.Fish(0, 0, 'sine', -1, 'clownfish');
        f.timer = 10;
        c.save(); c.translate(tw - 60, 26); c.scale(1.1, 1.1); f.draw(c, 0, 0); c.restore();
        var f2 = new Game.entities.Fish(0, 0, 'sine', 1, 'angelfish');
        c.save(); c.translate(30, 40); f2.draw(c, 0, 0); c.restore();
      }
      if (Game.entities && Game.entities.getPearlSprite) {
        c.drawImage(Game.entities.getPearlSprite(), tw / 2 - 10, 50);
      }
    }
    /* Water sheen along the top */
    var sh = c.createLinearGradient(0, 0, 0, 30);
    sh.addColorStop(0, 'rgba(255,255,255,0.14)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh;
    c.fillRect(0, 0, tw, 30);
  }

  function drawLevelSelect(c) {
    levelSelectTimer++;
    var t = levelSelectTimer;
    var prog = Game.progress || { unlocked: 1, best: {} };
    c.save();
    drawSeaBackdrop(c, t, false, floorBelowY());
    drawFloorBelow(c, t);
    clipGame(c);

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    drawHeading(c, Game.i18n.t('chooseReef'), W / 2, 44, 34, '#ffd27a');

    var n = Game.levels.count();
    for (var i = 0; i < n; i++) {
      var lvl = Game.levels.get(i);
      var unlocked = i < prog.unlocked;
      var best = prog.best[i];
      var x = cardX(i), y = CARD_Y;
      if (lockShake[i] > 0) { lockShake[i]--; x += Math.sin(lockShake[i] * 1.2) * 4; }
      var hover = unlocked && pointerOver(c, x, y, CARD_W, CARD_H);
      if (hover) y -= 3;

      /* Card */
      drawPanel(c, x, y, CARD_W, CARD_H, 14, hover ? 'rgba(30, 90, 150, 0.96)' : 'rgba(18, 62, 108, 0.94)', 'rgba(6, 22, 50, 0.96)', hover ? '#ffffff' : 'rgba(124, 232, 255, 0.8)');

      /* Thumbnail */
      var thumb = getThumb(lvl.theme);
      c.save();
      roundRect(c, x + 12, y + 12, CARD_W - 24, 100, 8);
      c.clip();
      c.drawImage(thumb, x + 12, y + 12, CARD_W - 24, 100);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 1;
      roundRect(c, x + 12, y + 12, CARD_W - 24, 100, 8);
      c.stroke();

      /* Level number badge */
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(x + 26, y + 26, 12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#7a4400';
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#4a2200';
      c.font = 'bold 14px ' + FONT;
      c.fillText(String(i + 1), x + 26, y + 27);

      /* Name */
      var name = Game.i18n.t(lvl.nameKey);
      c.fillStyle = '#ffffff';
      fitFont(c, name, CARD_W - 24, 19, 'bold');
      c.fillText(name, x + CARD_W / 2, y + 134);

      if (unlocked) {
        /* Stars */
        var stars = best ? best.stars : 0;
        for (var s = 0; s < 3; s++) drawStar(c, x + CARD_W / 2 + (s - 1) * 30, y + 164, 11, s < stars);

        /* Best pearls */
        c.font = '13px ' + FONT;
        c.fillStyle = '#bfe4ff';
        var total = best ? best.total : countPearls(lvl);
        var bestTxt = Game.i18n.t('best') + ': ' + (best ? best.pearls : 0) + ' / ' + total;
        drawPearlIcon(c, x + CARD_W / 2 - c.measureText(bestTxt).width / 2 - 10, y + 190, 6);
        c.fillText(bestTxt, x + CARD_W / 2 + 8, y + 191);

        /* Hint */
        c.font = '12px ' + FONT;
        c.fillStyle = '#9fc8e8';
        var lines = layoutLines(c, Game.i18n.t('levelHint' + (i + 1)), CARD_W - 28);
        for (var ln = 0; ln < Math.min(lines.length, 3); ln++) {
          c.fillText(lines[ln], x + CARD_W / 2, y + 214 + ln * 15);
        }
      } else {
        /* Locked: dim the card, padlock over the thumbnail, and only the
           unlock hint below the name so nothing overlaps */
        c.fillStyle = 'rgba(4, 12, 30, 0.62)';
        roundRect(c, x, y, CARD_W, CARD_H, 14);
        c.fill();
        drawPadlock(c, x + CARD_W / 2, y + 60, 1.5);
        c.fillStyle = '#ffffff';
        fitFont(c, Game.i18n.t('locked'), CARD_W - 24, 17, 'bold');
        c.lineJoin = 'round';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        c.strokeText(Game.i18n.t('locked'), x + CARD_W / 2, y + 170);
        c.fillText(Game.i18n.t('locked'), x + CARD_W / 2, y + 170);
        c.font = '13px ' + FONT;
        c.fillStyle = '#cfe4ff';
        var ul = layoutLines(c, Game.i18n.t('clearToUnlock'), CARD_W - 28);
        for (var u = 0; u < ul.length; u++) c.fillText(ul[u], x + CARD_W / 2, y + 198 + u * 16);
      }
    }

    drawButton(c, Game.i18n.t('backToTitle'), LS_BACK.x, LS_BACK.y, LS_BACK.w, LS_BACK.h);
    c.restore();
    drawVersionStamp(c, 'rgba(255, 255, 255, 0.55)');
  }

  function countPearls(lvl) {
    var n = 0, i;
    for (i = 0; i < lvl.spawns.pickups.length; i++) if (lvl.spawns.pickups[i].type === 'pearl') n++;
    var ch = lvl.spawns.chests || [];
    for (i = 0; i < ch.length; i++) n += ch[i].pearls || 4;
    return n;
  }

  function handleLevelSelectClick(mx, my) {
    var prog = Game.progress || { unlocked: 1 };
    for (var i = 0; i < Game.levels.count(); i++) {
      if (hitButton(mx, my, cardX(i), CARD_Y, CARD_W, CARD_H)) {
        if (i < prog.unlocked) {
          Game.audio.play('select');
          return { action: 'level', index: i };
        }
        lockShake[i] = 24;
        Game.audio.play('enemyHit');
        return null;
      }
    }
    if (hitButton(mx, my, LS_BACK.x, LS_BACK.y, LS_BACK.w, LS_BACK.h)) {
      Game.audio.play('select');
      return { action: 'title' };
    }
    return null;
  }

  /* Canvas text doesn't trigger web-font downloads reliably (Safari), so
     ask for every weight we draw with, covering all game text. */
  if (document.fonts && document.fonts.load) {
    var sample = Game.i18n.allText();
    ['400', '700'].forEach(function (wgt) {
      document.fonts.load(wgt + ' 16px "M PLUS Rounded 1c"', sample).catch(function () {});
    });
  }

  /* ---- Exports ---- */
  window.Game.ui = {
    beginFrame: function () { anyHot = false; uiClock++; },
    setView: setView,
    isHot: function () { return anyHot; },
    drawTitleScreen: function (c) {
      /* The title clips itself to the viewport; pop that before the
         How-to card so its scrim can dim the whole tablet screen. */
      c.save();
      drawTitleScreen(c);
      c.restore();
      /* Version stamp – helps us know which build is running. Drawn
         unclipped so it sits in the screen corner on a tablet. */
      drawVersionStamp(c, 'rgba(255, 255, 255, 0.55)');
      if (showInstructions) drawInstructionsOverlay(c);
    },
    drawHUD: drawHUD,
    drawPauseMenu: drawPauseMenu,
    drawDialogue: drawDialogue,
    drawQRCode: drawQRCode,
    drawGameOver: drawGameOver,
    drawVictory: drawVictory,
    drawCustomizeScreen: drawCustomizeScreen,
    drawIntroScreen: drawIntroScreen,
    drawBeachCutscene: drawBeachCutscene,
    startBeachCutscene: startBeachCutscene,
    updateBeach: updateBeach,
    beachWalker: function () { return beachMomoko; },
    handleTitleClick: handleTitleClick,
    handlePauseClick: handlePauseClick,
    handleGameOverClick: handleGameOverClick,
    handleVictoryClick: handleVictoryClick,
    handleCustomizeClick: handleCustomizeClick,
    handleIntroClick: handleIntroClick,
    handleBeachClick: handleBeachClick,
    drawLevelClear: drawLevelClear,
    resetLevelClear: resetLevelClear,
    handleLevelClearClick: handleLevelClearClick,
    drawLevelSelect: drawLevelSelect,
    handleLevelSelectClick: handleLevelSelectClick,
    isShowingInstructions: function () { return showInstructions; },
  };
})();
