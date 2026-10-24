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
      c.fillStyle = 'rgba(0, 0, 0, 0.35)';
      roundRect(c, x, y + 3, w, h, r);
      c.fill();
    }
    var g = c.createLinearGradient(0, y + oy, 0, y + oy + h);
    g.addColorStop(0, hover ? pal.hTop : pal.top);
    g.addColorStop(1, hover ? pal.hBot : pal.bot);
    c.fillStyle = g;
    roundRect(c, x, y + oy, w, h, r);
    c.fill();
    /* Soft top gloss */
    c.fillStyle = 'rgba(255, 255, 255, 0.12)';
    roundRect(c, x + 3, y + oy + 2, w - 6, h * 0.42, Math.max(2, r - 3));
    c.fill();
    c.strokeStyle = hover ? '#ffffff' : pal.edge;
    c.lineWidth = 2;
    roundRect(c, x, y + oy, w, h, r);
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
  function drawSeaBackdrop(c, t, bright) {
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bright ? '#1b5f8f' : '#11406b');
    grad.addColorStop(0.45, bright ? '#114574' : '#0d2c52');
    grad.addColorStop(1, '#0a1a36');
    c.fillStyle = grad;
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    /* The sun sits above the top of whatever is on screen, so a tall
       tablet view gets its glow at the real surface, not mid-water. */
    var sunY = VIEW.y - 40;
    var sun = c.createRadialGradient(W * 0.5, sunY, 10, W * 0.5, sunY, 420);
    sun.addColorStop(0, 'rgba(170, 235, 255, 0.35)');
    sun.addColorStop(1, 'rgba(170, 235, 255, 0)');
    c.fillStyle = sun;
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    c.save();
    var rg = c.createLinearGradient(0, 0, 0, H);
    rg.addColorStop(0, 'rgba(190, 240, 255, 0.13)');
    rg.addColorStop(1, 'rgba(190, 240, 255, 0)');
    c.fillStyle = rg;
    /* Rays continue past the viewport when the view is widened; each one
       is the same slanted band, just extended along its own slope. */
    var y0 = VIEW.y, y1 = VIEW.y + VIEW.h;
    for (var r = -2; r < 8; r++) {
      var rx = 80 + r * 170 + Math.sin(t * 0.005 + r * 1.7) * 30;
      if (rx + 110 < VIEW.x || rx - 30 > VIEW.x + VIEW.w) continue;
      var tl = rx, tr = rx + 34 + (r % 2) * 20, bl = rx - 30, br = rx + 110;
      c.beginPath();
      c.moveTo(tl + (bl - tl) * (y0 / H), y0);
      c.lineTo(tr + (br - tr) * (y0 / H), y0);
      c.lineTo(tr + (br - tr) * (y1 / H), y1);
      c.lineTo(tl + (bl - tl) * (y1 / H), y1);
      c.closePath();
      c.fill();
    }
    c.restore();

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
    sg.addColorStop(0, '#b39a6e');
    sg.addColorStop(Math.min(1, 40 / (deep - top + 8)), '#5b4a35');
    sg.addColorStop(1, '#2e2419');
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(x0, bottom);
    for (var x = x0; x <= x1 + 10; x += 10) {
      c.lineTo(x, sandRidgeY(x, top));
    }
    c.lineTo(x1, bottom);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255, 240, 200, 0.35)';
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

    drawSeaBackdrop(c, t);
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
    c.fillStyle = 'rgba(8, 36, 64, 0.97)';
    roundRect(c, 110, 40, W - 220, 380, 16);
    c.fill();
    c.strokeStyle = '#7ce8ff';
    c.lineWidth = 2;
    c.stroke();
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
  function drawHUD(c, player, pearls, pearlTotal) {
    /* Hearts on a soft plate so sprites drifting past never swallow them */
    c.fillStyle = 'rgba(4, 18, 40, 0.55)';
    roundRect(c, 3, 5, player.maxHealth * 28 + 2, 28, 14);
    c.fill();
    c.strokeStyle = 'rgba(124, 232, 255, 0.35)';
    c.lineWidth = 1;
    c.stroke();
    for (var i = 0; i < player.maxHealth; i++) {
      var hx = 17 + i * 28;
      var hy = 21;
      /* Dark rim */
      c.fillStyle = 'rgba(30, 6, 18, 0.85)';
      drawHeart(c, hx, hy + 0.5, 12.5);
      if (i < player.health) {
        /* Full heart with a glossy highlight */
        c.fillStyle = '#ff3355';
        drawHeart(c, hx, hy, 10);
        c.fillStyle = 'rgba(255, 255, 255, 0.55)';
        c.beginPath();
        c.ellipse(hx - 4, hy - 5.5, 2.4, 1.6, -0.5, 0, Math.PI * 2);
        c.fill();
      } else {
        /* Empty heart */
        c.fillStyle = '#4a3550';
        drawHeart(c, hx, hy, 10);
      }
    }

    /* Pearl counter beside the hearts: icon plus "12/30" */
    if (pearlTotal) {
      var text = pearls + '/' + pearlTotal;
      c.save();
      c.font = 'bold 15px ' + FONT;
      var tw = c.measureText(text).width;
      var px = 3 + player.maxHealth * 28 + 2 + 8;
      var pw = tw + 36;
      c.fillStyle = 'rgba(4, 18, 40, 0.55)';
      roundRect(c, px, 5, pw, 28, 14);
      c.fill();
      c.strokeStyle = 'rgba(124, 232, 255, 0.35)';
      c.lineWidth = 1;
      c.stroke();
      drawPearlIcon(c, px + 15, 19, 8);
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(30, 6, 18, 0.85)';
      c.strokeText(text, px + 29, 20);
      c.fillStyle = '#ffffff';
      c.fillText(text, px + 29, 20);
      c.restore();
    }

    /* Version stamp (bottom-right) – matches the title screen so the
       running build is visible during gameplay too. */
    if (Game.VERSION) {
      c.save();
      c.fillStyle = '#4a6a8a';
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

    c.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(c, boxX, boxY + 3, boxW, boxH, 12);
    c.fill();
    var g = c.createLinearGradient(0, boxY, 0, boxY + boxH);
    g.addColorStop(0, 'rgba(12, 58, 92, 0.96)');
    g.addColorStop(1, 'rgba(4, 26, 50, 0.96)');
    c.fillStyle = g;
    roundRect(c, boxX, boxY, boxW, boxH, 12);
    c.fill();
    c.strokeStyle = '#7ce8ff';
    c.lineWidth = 2;
    roundRect(c, boxX, boxY, boxW, boxH, 12);
    c.stroke();

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
    drawSeaBackdrop(c, t, true);
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
     Layout matches the sketch the user's daughter drew:
       - Title at top
       - Momoko preview on the left side (live, updates on every change)
       - Tab bar along the top-right (hair / dress / swim / shoes / crab / food)
       - 3x2 variant icon grid below the tabs
       - Color swatches below the grid when the current tab has a color
       - Start button at the bottom */
  var hairColors = ['#e06088', '#4a3728', '#f5d060', '#4488ff', '#222222', '#cc3333'];
  var suitColors = ['#e06088', '#3366aa', '#cc3333', '#7733aa', '#228844', '#dd7722'];
  var shoeColors = ['#ff99cc', '#33bb77', '#ffcc44', '#66aaff', '#ffffff', '#552211'];
  var skinTones  = ['#ffe0c0', '#ddb896', '#c68c5a', '#8d6e4c', '#5c3d2e'];

  /* Tab definitions – order matches the sketch. `field` is the key inside
     Game.customization this tab writes to. `colorField` (optional) enables
     a color-swatch row below the grid. Icons are drawn by name-dispatch in
     drawVariantIcon. */
  var customTabs = [
    { id: 'hair',  label: 'tabHair',  field: 'hairStyle', colorField: 'hair',    colors: hairColors,
      variants: [
        { id: 'twinTails',  label: 'varTwinTails' },
        { id: 'longBraids', label: 'varLongBraids' },
        { id: 'buns',       label: 'varBuns' },
      ] },
    { id: 'dress', label: 'tabDress', field: 'outfit',    colorField: 'suit',    colors: suitColors,
      variants: [
        { id: 'frillyDress', label: 'varFrillyDress' },
        { id: 'sailorDress', label: 'varSailorDress' },
        { id: 'starDress',   label: 'varStarDress' },
      ] },
    { id: 'swim',  label: 'tabSwim',  field: 'outfit',    colorField: 'suit',    colors: suitColors,
      variants: [
        { id: 'sailorSwimsuit', label: 'varSailorSwimsuit' },
        { id: 'onePiece',       label: 'varOnePiece' },
        { id: 'frillyBikini',   label: 'varFrillyBikini' },
      ] },
    { id: 'shoes', label: 'tabShoes', field: 'shoes',     colorField: 'flipper', colors: shoeColors,
      variants: [
        { id: 'maryJane', label: 'varMaryJane' },
        { id: 'sneaker',  label: 'varSneaker' },
        { id: 'flipper',  label: 'varFlipper' },
      ] },
    { id: 'crab',  label: 'tabCrab',  field: 'crab',      colorField: null, colors: null,
      variants: [
        { id: 'none', label: 'varNone' },
        { id: 'red',  label: 'varCrabRed' },
        { id: 'blue', label: 'varCrabBlue' },
        { id: 'gold', label: 'varCrabGold' },
      ] },
    { id: 'food',  label: 'tabFood',  field: 'food',      colorField: null, colors: null,
      variants: [
        { id: 'none',       label: 'varNone' },
        { id: 'iceCream',   label: 'varIceCream' },
        { id: 'onigiri',    label: 'varOnigiri' },
        { id: 'donut',      label: 'varDonut' },
        { id: 'crepe',      label: 'varCrepe' },
        { id: 'taiyaki',    label: 'varTaiyaki' },
        { id: 'parfait',    label: 'varParfait' },
        { id: 'macaron',    label: 'varMacaron' },
        { id: 'strawberry', label: 'varStrawberry' },
      ] },
  ];

  var customSelection = { tab: 'hair' };

  /* ---- Layout constants (shared by draw + hit-test) ----
     Grid is sized for up to 3 rows × 3 cols so the 9-variant food tab
     fits without scrolling. Colors + skin sit below at fixed Y so the
     layout stays stable when switching tabs. */
  var TAB_X = 304, TAB_Y = 62, TAB_W = 76, TAB_H = 34, TAB_GAP = 4;
  var GRID_X = 304, GRID_Y = 106, GRID_COLS = 3, GRID_TILE_W = 154, GRID_TILE_H = 58, GRID_GAP = 7;
  var COLOR_X = 304, COLOR_STEP = 42;
  /* Panel card framing the tabs, grid and swatches; Start sits centred
     under it. */
  var PANEL_X = 292, PANEL_Y = 52, PANEL_W = 500, PANEL_H = 358;
  var START_BTN_W = 200, START_BTN_H = 46;
  var START_BTN_X = PANEL_X + PANEL_W / 2 - START_BTN_W / 2;
  var START_BTN_Y = 420;
  var customizeTimer = 0;

  function getTab(id) {
    for (var i = 0; i < customTabs.length; i++) if (customTabs[i].id === id) return customTabs[i];
    return customTabs[0];
  }

  /* Where the color-swatch row anchors for this tab. Sits just below the
     active grid so tabs with fewer variants (e.g. hair) don't leave a
     gap. Used by both the draw pass and the hit-test. */
  function colorYFor(tab) {
    var rows = Math.max(1, Math.ceil(tab.variants.length / GRID_COLS));
    return GRID_Y + rows * (GRID_TILE_H + GRID_GAP) + 26;
  }

  /* Tile icon for a variant. Keeps per-tile drawing small and iconic so
     the 6 tiles visually contrast even when they share the same tab. */
  function drawVariantIcon(c, tabId, variantId, cx, cy, cust) {
    c.save();
    c.translate(cx, cy);
    if (tabId === 'hair') drawHairIcon(c, variantId, cust.hair);
    else if (tabId === 'dress' || tabId === 'swim') drawOutfitIcon(c, variantId, cust.suit);
    else if (tabId === 'shoes') drawShoeIcon(c, variantId, cust.flipper);
    else if (tabId === 'crab') drawCrabIcon(c, variantId);
    else if (tabId === 'food') drawFoodIcon(c, variantId);
    c.restore();
  }

  function drawHairIcon(c, id, hairC) {
    var color = hairC || '#e06088';
    /* Tiny head */
    c.fillStyle = '#ffddbb';
    c.beginPath(); c.arc(0, 4, 10, 0, Math.PI * 2); c.fill();
    if (id === 'longBraids') {
      c.fillStyle = color;
      for (var side = -1; side <= 1; side += 2) {
        for (var b = 0; b < 3; b++) {
          c.beginPath();
          c.ellipse(side * 10, -4 + b * 7, 3.4, 3.8, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      /* Top */
      c.beginPath();
      c.ellipse(0, -6, 12, 6, 0, Math.PI, 0);
      c.fill();
    } else if (id === 'buns') {
      c.fillStyle = color;
      c.beginPath(); c.arc(-8, -8, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(8, -8, 5, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.ellipse(0, -2, 11, 5, 0, Math.PI, 0);
      c.fill();
    } else {
      /* twinTails */
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(-11, 4, 4, 10, 0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(11, 4, 4, 10, -0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(0, -4, 12, 7, 0, Math.PI, 0);
      c.fill();
    }
  }

  function drawOutfitIcon(c, id, suitC) {
    var color = suitC || '#e06088';
    if (id === 'frillyDress' || id === 'sailorDress' || id === 'starDress') {
      /* Bodice */
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-10, -12);
      c.quadraticCurveTo(0, -14, 10, -12);
      c.lineTo(8, -2);
      c.lineTo(-8, -2);
      c.closePath();
      c.fill();
      /* Skirt */
      c.beginPath();
      c.moveTo(-8, -2);
      c.lineTo(-14, 14);
      c.lineTo(14, 14);
      c.lineTo(8, -2);
      c.closePath();
      c.fill();
      if (id === 'starDress') {
        /* Gold bow on chest */
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.ellipse(-2.4, -8, 2, 1.6, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse( 2.4, -8, 2, 1.6,  0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c88a1a';
        c.beginPath(); c.arc(0, -8, 0.9, 0, Math.PI * 2); c.fill();
        /* Stars on skirt */
        c.fillStyle = '#ffd24a';
        var iconStar = function (sx, sy, r) {
          c.beginPath();
          for (var k = 0; k < 10; k++) {
            var ang = -Math.PI / 2 + k * Math.PI / 5;
            var rr = k % 2 === 0 ? r : r * 0.4;
            var px = sx + Math.cos(ang) * rr;
            var py = sy + Math.sin(ang) * rr;
            if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
          }
          c.closePath(); c.fill();
        };
        iconStar(-6,  6, 1.3);
        iconStar( 0, 10, 1.4);
        iconStar( 6,  6, 1.3);
        /* Silver hem */
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-14, 14); c.lineTo(14, 14);
        c.stroke();
      } else {
        /* Scalloped hem */
        c.fillStyle = '#ffffff';
        for (var s = -2; s <= 2; s++) {
          c.beginPath(); c.arc(s * 5, 15, 2.2, Math.PI, 0); c.fill();
        }
        if (id === 'frillyDress') {
          /* Heart gem */
          c.fillStyle = '#ff5577';
          c.beginPath();
          c.arc(-1.4, -8, 1.3, 0, Math.PI * 2);
          c.arc(1.4, -8, 1.3, 0, Math.PI * 2);
          c.moveTo(-2.6, -7);
          c.lineTo(0, -4);
          c.lineTo(2.6, -7);
          c.closePath();
          c.fill();
        } else {
          /* Sailor collar */
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.moveTo(-8, -13);
          c.lineTo(0, -6);
          c.lineTo(8, -13);
          c.closePath();
          c.fill();
        }
      }
    } else if (id === 'frillyBikini') {
      /* Bandeau top */
      c.fillStyle = color;
      c.fillRect(-10, -12, 20, 5);
      c.fillStyle = '#ffffff';
      for (var fbk = 0; fbk < 5; fbk++) {
        c.beginPath();
        c.arc(-8 + fbk * 4, -7, 1.8, Math.PI, 0);
        c.fill();
      }
      /* Center bow */
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.ellipse(-1.8, -10, 1.5, 1.2, -0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse( 1.8, -10, 1.5, 1.2,  0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c88a1a';
      c.beginPath(); c.arc(0, -10, 0.6, 0, Math.PI * 2); c.fill();
      /* Bikini bottom */
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-10, 2);
      c.quadraticCurveTo(0, 5, 10, 2);
      c.lineTo(8, 10);
      c.lineTo(-8, 10);
      c.closePath();
      c.fill();
      /* Side bow */
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.ellipse(8, 5, 1.6, 1.1, -0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(10, 6, 1.6, 1.1,  0.4, 0, Math.PI * 2); c.fill();
    } else if (id === 'sailorSwimsuit') {
      /* Torso */
      c.fillStyle = color;
      c.fillRect(-10, -12, 20, 20);
      /* Sailor collar */
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(-9, -12);
      c.lineTo(0, -2);
      c.lineTo(9, -12);
      c.closePath();
      c.fill();
      /* Bow */
      c.fillStyle = '#ff4466';
      c.beginPath(); c.arc(0, -2, 1.8, 0, Math.PI * 2); c.fill();
    } else if (id === 'onePiece') {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-9, -12);
      c.quadraticCurveTo(0, -14, 9, -12);
      c.lineTo(9, 10);
      c.quadraticCurveTo(0, 12, -9, 10);
      c.closePath();
      c.fill();
      /* Star */
      c.fillStyle = '#fff4a8';
      var ss = 3;
      c.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rr = i % 2 === 0 ? ss : ss * 0.4;
        var px = Math.cos(ang) * rr;
        var py = Math.sin(ang) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    }
  }

  function drawShoeIcon(c, id, shoeC) {
    var color = shoeC || '#ff99cc';
    if (id === 'flipper') {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.beginPath();
      c.ellipse(-5, -1, 4, 2, 0, 0, Math.PI * 2);
      c.fill();
    } else if (id === 'sneaker') {
      c.fillStyle = color;
      c.fillRect(-12, -5, 24, 8);
      c.fillStyle = '#ffffff';
      c.fillRect(-12, 3, 24, 2.5);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(-10, -4, 6, 1);
      c.fillRect(-2, -4, 6, 1);
    } else {
      /* maryJane */
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, 1, 14, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-8, -3);
      c.lineTo(8, -3);
      c.stroke();
      c.fillStyle = '#fff4aa';
      c.beginPath(); c.arc(0, -3, 1.6, 0, Math.PI * 2); c.fill();
    }
  }

  function drawCrabIcon(c, id) {
    if (id === 'none') {
      c.strokeStyle = '#88aacc';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(7, 7);
      c.stroke();
      return;
    }
    if (Game.entities && Game.entities.drawCrabPet) {
      c.save();
      c.scale(2.2, 2.2);
      Game.entities.drawCrabPet(c, 0, 0, id, 0);
      c.restore();
    }
  }

  function drawFoodIcon(c, id) {
    if (id === 'none') {
      c.strokeStyle = '#88aacc';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(7, 7);
      c.stroke();
      return;
    }
    c.save();
    c.scale(2.8, 2.8);
    if (id === 'iceCream') {
      c.fillStyle = '#e0b070';
      c.beginPath();
      c.moveTo(-1.5, 2);
      c.lineTo(1.5, 2);
      c.lineTo(0, 6);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffc8d4';
      c.beginPath(); c.arc(0, 1, 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3355';
      c.beginPath(); c.arc(0, -1.5, 0.75, 0, Math.PI * 2); c.fill();
    } else if (id === 'onigiri') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, -3);
      c.lineTo(-3.5, 3);
      c.lineTo(3.5, 3);
      c.closePath();
      c.fill();
      c.fillStyle = '#2a3a2a';
      c.fillRect(-3, 1, 6, 2);
      c.fillStyle = 'rgba(255,160,180,0.7)';
      c.beginPath(); c.arc(-1.1, 0, 0.55, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(1.1, 0, 0.55, 0, Math.PI * 2); c.fill();
    } else if (id === 'donut') {
      c.fillStyle = '#c88858';
      c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.arc(0, 0, 2.7, Math.PI + 0.3, -0.3, false); c.fill();
      c.fillStyle = '#ffe4b0';
      c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffff66'; c.fillRect(-1.4, -0.3, 0.5, 0.5);
      c.fillStyle = '#66ddff'; c.fillRect(1, 0, 0.5, 0.5);
    } else if (id === 'crepe') {
      c.fillStyle = '#f2d8a4';
      c.beginPath();
      c.moveTo(-2.6, -2.6);
      c.lineTo(2.6, -2.6);
      c.lineTo(0, 4);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffdceb';
      c.beginPath(); c.arc(0, -2.6, 2, Math.PI, 0); c.fill();
      c.fillStyle = '#dd3355';
      c.beginPath(); c.arc(-0.4, -3, 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a5d2a';
      c.fillRect(-0.7, -3.8, 0.6, 0.6);
    } else if (id === 'taiyaki') {
      c.fillStyle = '#cc8844';
      c.beginPath();
      c.ellipse(-0.4, 0, 3.4, 1.8, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(2.6, 0);
      c.lineTo(4.4, -1.6);
      c.lineTo(4.4, 1.6);
      c.closePath();
      c.fill();
      c.fillStyle = '#e0a868';
      c.beginPath(); c.ellipse(-1, -0.6, 1.6, 0.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0c14';
      c.beginPath(); c.arc(-2.2, -0.4, 0.4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8a5520';
      c.lineWidth = 0.3;
      c.beginPath();
      c.moveTo(-1.4, 0.3); c.lineTo(1.6, 0.3);
      c.stroke();
    } else if (id === 'parfait') {
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 0.4;
      c.strokeRect(-1.8, -2, 3.6, 5.6);
      c.fillStyle = '#6b3a1a';
      c.fillRect(-1.6, 2, 3.2, 1.4);
      c.fillStyle = '#fff4dc';
      c.fillRect(-1.6, 0.5, 3.2, 1.4);
      c.fillStyle = '#ff6688';
      c.fillRect(-1.6, -1, 3.2, 1.4);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(0, -2.3, 1.5, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(-0.5, -2.9, 0.8, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(0.4, -3.2, 0.6, Math.PI, 0); c.fill();
      c.fillStyle = '#dd2244';
      c.beginPath(); c.arc(0.7, -3.5, 0.55, 0, Math.PI * 2); c.fill();
    } else if (id === 'macaron') {
      c.fillStyle = '#ffbadb';
      c.beginPath(); c.ellipse(0, -1.2, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(-3, -0.3, 6, 1.1);
      c.fillStyle = '#ff9ac2';
      c.beginPath(); c.ellipse(0, 1.6, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(-1, -1.5, 1.3, 0.4, 0, 0, Math.PI * 2); c.fill();
    } else if (id === 'strawberry') {
      c.fillStyle = '#e8344a';
      c.beginPath();
      c.moveTo(-2.6, -1.2);
      c.quadraticCurveTo(0, 4.8, 2.6, -1.2);
      c.closePath();
      c.fill();
      c.fillStyle = '#fff4a8';
      c.beginPath(); c.arc(-1, 0.7, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0.8, 0.4, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, 2, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-1.4, 2.3, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3caf3c';
      c.beginPath();
      c.moveTo(-2.8, -1.2);
      c.lineTo(-0.8, -2.2);
      c.lineTo(0.8, -2.2);
      c.lineTo(2.8, -1.2);
      c.lineTo(0, -0.3);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawCustomizeScreen(c) {
    customizeTimer++;
    var t = customizeTimer;

    /* Background – the title's sea, dimmed so the controls stay legible */
    drawSeaBackdrop(c, t);
    c.fillStyle = 'rgba(4, 16, 36, 0.45)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    drawFloorBelow(c, t);
    clipGame(c);

    /* Title */
    c.save();
    c.font = 'bold 26px ' + FONT;
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(4, 20, 44, 0.9)';
    c.strokeText(Game.i18n.t('customize'), W / 2, 38);
    c.fillStyle = '#7fd8ff';
    c.fillText(Game.i18n.t('customize'), W / 2, 38);
    c.restore();

    /* Panel card behind the controls */
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    roundRect(c, PANEL_X, PANEL_Y + 4, PANEL_W, PANEL_H, 16);
    c.fill();
    c.fillStyle = 'rgba(8, 34, 62, 0.88)';
    roundRect(c, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
    c.fill();
    c.strokeStyle = 'rgba(124, 232, 255, 0.45)';
    c.lineWidth = 1.5;
    c.stroke();

    /* Preview stage – soft radial glow so Momoko pops against the bg */
    var stageCX = 150, stageCY = 236;
    var stageGrad = c.createRadialGradient(stageCX, stageCY, 20, stageCX, stageCY, 150);
    stageGrad.addColorStop(0, 'rgba(120,200,255,0.28)');
    stageGrad.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = stageGrad;
    c.fillRect(0, 70, 300, 340);

    /* Sandy rock pedestal she stands on */
    var pedY = 336;
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

    /* Momoko preview, bobbing gently above the pedestal */
    c.save();
    c.translate(stageCX - 70, stageCY - 88 + Math.sin(t * 0.04) * 3);
    c.scale(5, 5);
    drawMomokoPreview(c, Game.customization);
    c.restore();

    /* Tab bar */
    for (var ti = 0; ti < customTabs.length; ti++) {
      var tx = TAB_X + ti * (TAB_W + TAB_GAP);
      var tab = customTabs[ti];
      var active = customSelection.tab === tab.id;
      var tabHot = pointerOver(c, tx, TAB_Y, TAB_W, TAB_H);
      c.fillStyle = active ? '#3388cc' : tabHot ? '#265580' : '#1a3a5a';
      roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
      c.fill();
      if (active) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2;
        roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
        c.stroke();
      }
      c.fillStyle = active ? '#ffffff' : '#aaccee';
      fitFont(c, Game.i18n.t(tab.label), TAB_W - 8, 12, 'bold');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t(tab.label), tx + TAB_W / 2, TAB_Y + TAB_H / 2);
    }
    c.textBaseline = 'alphabetic';

    /* Variant grid for the active tab */
    var activeTab = getTab(customSelection.tab);
    var currentVariantId = Game.customization[activeTab.field];
    for (var vi = 0; vi < activeTab.variants.length; vi++) {
      var row = Math.floor(vi / GRID_COLS);
      var col = vi % GRID_COLS;
      var gx = GRID_X + col * (GRID_TILE_W + GRID_GAP);
      var gy = GRID_Y + row * (GRID_TILE_H + GRID_GAP);
      var v = activeTab.variants[vi];
      var selected = v.id === currentVariantId;
      /* Tile bg */
      var tileHot = pointerOver(c, gx, gy, GRID_TILE_W, GRID_TILE_H);
      c.fillStyle = selected ? '#2b5580' : tileHot ? '#1c3a5c' : '#12253d';
      roundRect(c, gx, gy, GRID_TILE_W, GRID_TILE_H, 8);
      c.fill();
      if (selected) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2.5;
        roundRect(c, gx, gy, GRID_TILE_W, GRID_TILE_H, 8);
        c.stroke();
      }
      /* Icon (left side of tile) */
      drawVariantIcon(c, activeTab.id, v.id, gx + 32, gy + GRID_TILE_H / 2 - 2, Game.customization);
      /* Label (right side) */
      c.fillStyle = '#eef6ff';
      fitFont(c, Game.i18n.t(v.label), GRID_TILE_W - 72, 12, 'bold');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t(v.label), gx + 64, gy + GRID_TILE_H / 2);
    }
    c.textBaseline = 'alphabetic';

    /* Color swatches (when the active tab has a color dimension) */
    /* Color row anchor follows the grid so tabs with fewer variants pull
       the colors up instead of leaving a big empty band. */
    var colorY = colorYFor(activeTab);
    if (activeTab.colorField && activeTab.colors) {
      var labelKey = activeTab.colorField === 'hair' ? 'hairColor'
                   : activeTab.colorField === 'suit' ? 'suitColor'
                   : 'shoeColor';
      c.fillStyle = '#88aacc';
      c.font = '13px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.fillText(Game.i18n.t(labelKey), COLOR_X, colorY - 8);
      var selColor = Game.customization[activeTab.colorField];
      for (var ci = 0; ci < activeTab.colors.length; ci++) {
        var ccx = COLOR_X + ci * COLOR_STEP + 16;
        var ccy = colorY + 16;
        c.fillStyle = activeTab.colors[ci];
        c.beginPath();
        c.arc(ccx, ccy, 14, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.lineWidth = 1;
        c.stroke();
        if (activeTab.colors[ci] === selColor) {
          c.strokeStyle = '#ffdd88';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(ccx, ccy, 17, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }

    /* Skin tones – always visible regardless of tab (it's the only axis
       that doesn't belong to a category but still matters) */
    c.fillStyle = '#88aacc';
    c.font = '13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('skinTone'), COLOR_X, colorY + 48);
    for (var ki = 0; ki < skinTones.length; ki++) {
      var kcx = COLOR_X + ki * COLOR_STEP + 16;
      var kcy = colorY + 68;
      c.fillStyle = skinTones[ki];
      c.beginPath();
      c.arc(kcx, kcy, 14, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1;
      c.stroke();
      if (skinTones[ki] === Game.customization.skin) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(kcx, kcy, 17, 0, Math.PI * 2);
        c.stroke();
      }
    }

    /* Start button */
    drawButton(c, Game.i18n.t('startGame'), START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H, false, 'primary');
  }

  function drawMomokoPreview(c, cust) {
    if (!Game.entities) return;
    if (Game.entities.drawMomokoSprite) Game.entities.drawMomokoSprite(c, 0, 0, cust, 0);
    /* Crab pet appears next to her feet in the preview so the player can
       see the companion they just picked. */
    if (Game.entities.drawCrabPet && cust.crab && cust.crab !== 'none') {
      Game.entities.drawCrabPet(c, -8, 32, cust.crab, 0);
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
      var tx = TAB_X + ti * (TAB_W + TAB_GAP);
      if (hitButton(mx, my, tx, TAB_Y, TAB_W, TAB_H)) {
        customSelection.tab = customTabs[ti].id;
        Game.audio.play('select');
        return null;
      }
    }

    var activeTab = getTab(customSelection.tab);

    /* Variant tiles */
    for (var vi = 0; vi < activeTab.variants.length; vi++) {
      var row = Math.floor(vi / GRID_COLS);
      var col = vi % GRID_COLS;
      var gx = GRID_X + col * (GRID_TILE_W + GRID_GAP);
      var gy = GRID_Y + row * (GRID_TILE_H + GRID_GAP);
      if (hitButton(mx, my, gx, gy, GRID_TILE_W, GRID_TILE_H)) {
        Game.customization[activeTab.field] = activeTab.variants[vi].id;
        Game.audio.play('select');
        return null;
      }
    }

    /* Tab color swatches */
    var colorY = colorYFor(activeTab);
    if (activeTab.colorField && activeTab.colors) {
      for (var ci = 0; ci < activeTab.colors.length; ci++) {
        var ccx = COLOR_X + ci * COLOR_STEP + 16;
        var ccy = colorY + 16;
        var dx = mx - ccx, dy = my - ccy;
        if (dx * dx + dy * dy < 17 * 17) {
          Game.customization[activeTab.colorField] = activeTab.colors[ci];
          Game.audio.play('select');
          return null;
        }
      }
    }

    /* Skin tone swatches (always shown) */
    for (var ki = 0; ki < skinTones.length; ki++) {
      var kcx = COLOR_X + ki * COLOR_STEP + 16;
      var kcy = colorY + 68;
      var kdx = mx - kcx, kdy = my - kcy;
      if (kdx * kdx + kdy * kdy < 17 * 17) {
        Game.customization.skin = skinTones[ki];
        Game.audio.play('select');
        return null;
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
    drawSeaBackdrop(c, introAnimTimer);
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
    c.save();
    c.shadowColor = 'rgba(0, 0, 0, 0.4)';
    c.shadowBlur = 16;
    c.shadowOffsetY = 4;
    var pnl = c.createLinearGradient(0, panelY, 0, panelY + panelH);
    pnl.addColorStop(0, 'rgba(18, 62, 108, 0.9)');
    pnl.addColorStop(1, 'rgba(6, 22, 50, 0.92)');
    c.fillStyle = pnl;
    roundRect(c, panelX, panelY, panelW, panelH, 14);
    c.fill();
    c.restore();
    var gloss = c.createLinearGradient(0, panelY, 0, panelY + 40);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = gloss;
    roundRect(c, panelX + 3, panelY + 3, panelW - 6, 40, 11);
    c.fill();
    c.strokeStyle = 'rgba(124, 232, 255, 0.75)';
    c.lineWidth = 2;
    roundRect(c, panelX, panelY, panelW, panelH, 14);
    c.stroke();
    c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    c.lineWidth = 1;
    roundRect(c, panelX + 5, panelY + 5, panelW - 10, panelH - 10, 10);
    c.stroke();

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
      grounded: true,
      moving: false,
    };
  }

  /* Called from engine.js every frame while State.BEACH is active. `keys`
     and `jp` are the shared Game.input state. */
  function updateBeach(keys, jp) {
    if (!beachMomoko) return;
    var m = beachMomoko;
    m.moving = false;
    if (keys.left)  { m.x -= BEACH_WALK_SPEED; m.facing = -1; m.moving = true; }
    if (keys.right) { m.x += BEACH_WALK_SPEED; m.facing =  1; m.moving = true; }
    if (m.x < BEACH_MIN_X) m.x = BEACH_MIN_X;
    if (m.x > BEACH_MAX_X) m.x = BEACH_MAX_X;

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
      m.vy = 0;
      m.grounded = true;
    }

    if (m.moving && m.grounded) m.walkPhase += 0.35;
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
    c.scale(2, 2);
    if (mm.facing === -1) c.scale(-1, 1);
    /* The sprite's natural origin is its top-left, so shift up by full
       sprite height (34) to plant feet on the ground line. */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      var frame = mm.moving ? Math.floor(mm.walkPhase) : 0;
      Game.entities.drawMomokoSprite(c, -14, -34, Game.customization, frame);
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
    drawSeaBackdrop(c, t, true);
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
    var g = c.createLinearGradient(0, 0, 0, th);
    var i, d;
    var dec = Game.engine && Game.engine.drawDecorationAt;
    if (theme === 'trench') {
      g.addColorStop(0, '#0a1430');
      g.addColorStop(1, '#02050d');
      c.fillStyle = g;
      c.fillRect(0, 0, tw, th);
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
      g.addColorStop(0, '#1a7a90');
      g.addColorStop(1, '#0b3a4e');
      c.fillStyle = g;
      c.fillRect(0, 0, tw, th);
      c.fillStyle = '#6e5c40';
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
      g.addColorStop(0, '#2a8ad0');
      g.addColorStop(1, '#0f3d6e');
      c.fillStyle = g;
      c.fillRect(0, 0, tw, th);
      /* Sun rays */
      c.fillStyle = 'rgba(190, 240, 255, 0.14)';
      for (i = 0; i < 4; i++) {
        c.beginPath(); c.moveTo(20 + i * 48, 0); c.lineTo(36 + i * 48, 0); c.lineTo(60 + i * 48, th); c.lineTo(30 + i * 48, th); c.closePath(); c.fill();
      }
      c.fillStyle = '#b39a6e';
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
    drawSeaBackdrop(c, t);
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
      c.save();
      c.shadowColor = 'rgba(0, 0, 0, 0.4)';
      c.shadowBlur = 14;
      c.shadowOffsetY = 4;
      var pg = c.createLinearGradient(0, y, 0, y + CARD_H);
      pg.addColorStop(0, hover ? 'rgba(30, 90, 150, 0.95)' : 'rgba(18, 62, 108, 0.92)');
      pg.addColorStop(1, 'rgba(6, 22, 50, 0.95)');
      c.fillStyle = pg;
      roundRect(c, x, y, CARD_W, CARD_H, 14);
      c.fill();
      c.restore();
      c.strokeStyle = hover ? '#ffffff' : 'rgba(124, 232, 255, 0.75)';
      c.lineWidth = 2;
      roundRect(c, x, y, CARD_W, CARD_H, 14);
      c.stroke();

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
    beginFrame: function () { anyHot = false; },
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
