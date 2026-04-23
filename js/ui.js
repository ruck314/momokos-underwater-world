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
  function drawButton(c, text, x, y, w, h, hover) {
    c.fillStyle = hover ? '#3388cc' : '#225588';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#66bbee';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.fillStyle = '#ffffff';
    c.font = 'bold 18px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, x + w / 2, y + h / 2);
  }

  function hitButton(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var lines = text.split('\n');
    var dy = 0;
    for (var li = 0; li < lines.length; li++) {
      var words = lines[li].split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line + words[i] + ' ';
        if (c.measureText(test).width > maxWidth && line.length > 0) {
          c.fillText(line.trim(), x, y + dy);
          line = words[i] + ' ';
          dy += lineHeight;
        } else {
          line = test;
        }
      }
      c.fillText(line.trim(), x, y + dy);
      dy += lineHeight;
    }
    return dy;
  }

  /* ---- Title Screen ---- */
  function drawTitleScreen(c) {
    titleAnimTimer++;

    /* Background gradient */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(0.5, '#0d2847');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Animated bubbles */
    for (var i = 0; i < titleBubbles.length; i++) {
      var b = titleBubbles[i];
      b.wobble += 0.02;
      b.y -= b.speed;
      if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
      c.save();
      c.globalAlpha = 0.3;
      c.fillStyle = '#66bbee';
      c.beginPath();
      c.arc(b.x + Math.sin(b.wobble) * 15, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* Light rays */
    c.save();
    c.globalAlpha = 0.04;
    for (var r = 0; r < 5; r++) {
      var rx = 100 + r * 160 + Math.sin(titleAnimTimer * 0.005 + r) * 30;
      c.fillStyle = '#88ccff';
      c.beginPath();
      c.moveTo(rx, 0);
      c.lineTo(rx + 40, 0);
      c.lineTo(rx + 80, H);
      c.lineTo(rx - 40, H);
      c.closePath();
      c.fill();
    }
    c.restore();

    /* Seaweed at bottom */
    for (var sw = 0; sw < 12; sw++) {
      var swx = sw * 70 + 20;
      var sway = Math.sin(titleAnimTimer * 0.02 + sw) * 8;
      c.fillStyle = '#1a5533';
      c.beginPath();
      c.moveTo(swx, H);
      c.quadraticCurveTo(swx + sway, H - 40, swx + 5, H - 60 - Math.random() * 10);
      c.quadraticCurveTo(swx - sway + 10, H - 40, swx + 10, H);
      c.closePath();
      c.fill();
    }

    /* Title text with wave effect */
    var title = Game.i18n.t('title');
    c.save();
    c.font = 'bold 36px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    /* Shadow */
    c.fillStyle = '#003366';
    c.fillText(title, W / 2 + 2, 102);
    /* Main */
    c.fillStyle = '#66ccff';
    c.fillText(title, W / 2, 100);
    /* Glow */
    c.shadowColor = '#44aaff';
    c.shadowBlur = 15;
    c.fillText(title, W / 2, 100);
    c.restore();

    /* Subtitle */
    c.fillStyle = '#88aacc';
    c.font = '14px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('titleSubtitle'), W / 2, 140);

    /* Buttons */
    drawButton(c, Game.i18n.t('play'), W / 2 - 90, 200, 180, 44);
    drawButton(c, Game.i18n.t('howToPlay'), W / 2 - 90, 260, 180, 44);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 90, 320, 180, 44);

    /* Sound toggle */
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 90, 380, 180, 36);

    /* Version stamp (bottom-right) – helps us know which build is running */
    if (Game.VERSION) {
      c.save();
      c.fillStyle = '#4a6a8a';
      c.font = '11px monospace';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
      c.fillText(stamp, W - 8, H - 8);
      c.restore();
    }

    /* Instructions overlay flag */
    return false;
  }

  var showInstructions = false;

  function drawInstructionsOverlay(c) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.85)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#66ccff';
    c.font = 'bold 24px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('howToPlay'), W / 2, 80);
    c.fillStyle = '#ccddee';
    c.font = '16px monospace';
    c.textAlign = 'center';
    wrapText(c, Game.i18n.t('instructions'), W / 2, 130, 600, 28);
    drawButton(c, 'OK', W / 2 - 60, 350, 120, 40);
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
  function drawHUD(c, player) {
    /* Hearts */
    for (var i = 0; i < player.maxHealth; i++) {
      var hx = 16 + i * 28;
      var hy = 20;
      if (i < player.health) {
        /* Full heart */
        c.fillStyle = '#ff3355';
        drawHeart(c, hx, hy, 10);
      } else {
        /* Empty heart */
        c.fillStyle = '#443344';
        drawHeart(c, hx, hy, 10);
      }
    }
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
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#66ccff';
    c.font = 'bold 32px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('paused'), W / 2, 90);

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
    drawButton(c, Game.i18n.t('quit'), W / 2 - 10, 350, 220, 44);

    /* Version stamp – matches the title-screen stamp so we can tell at a
       glance which build is paused (handy for bug reports). */
    if (Game.VERSION) {
      c.fillStyle = '#6688aa';
      c.font = '11px monospace';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      var pStamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
      c.fillText(pStamp, W - 8, H - 8);
    }
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
    c.font = 'bold 10px monospace';
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
  function drawDialogue(c, speaker, text, cw, ch, gx, gy) {
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

    c.save();
    c.fillStyle = 'rgba(0, 15, 40, 0.92)';
    c.fillRect(boxX, boxY, boxW, boxH);
    c.strokeStyle = '#44aadd';
    c.lineWidth = 2;
    c.strokeRect(boxX, boxY, boxW, boxH);

    /* Speaker name */
    c.fillStyle = '#ffcc44';
    c.font = 'bold 14px monospace';
    c.textAlign = 'left';
    c.fillText(speaker, boxX + 12, boxY + 18);

    /* Text */
    c.fillStyle = '#ddeeff';
    c.font = '13px monospace';
    wrapText(c, text, boxX + 12, boxY + 36, boxW - 24, 17);

    c.restore();
  }

  /* ---- Game Over Screen ---- */
  function drawGameOver(c) {
    c.save();
    c.fillStyle = 'rgba(20, 0, 0, 0.85)';
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#ff3344';
    c.font = 'bold 40px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('gameOver'), W / 2, 160);

    drawButton(c, Game.i18n.t('tryAgain'), W / 2 - 90, 240, 180, 48);
    c.restore();
  }

  function handleGameOverClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 240, 180, 48)) { Game.audio.play('select'); return 'retry'; }
    return null;
  }

  /* ---- Victory Screen ---- */
  var victoryParticles = [];
  var victoryTimer = 0;

  function drawVictory(c) {
    victoryTimer++;

    c.save();
    c.fillStyle = 'rgba(0, 10, 30, 0.85)';
    c.fillRect(0, 0, W, H);

    /* Fireworks particles */
    if (victoryTimer % 10 === 0) {
      var fx = 100 + Math.random() * 600;
      var fy = 100 + Math.random() * 200;
      var colors = ['#ff4466', '#44ff66', '#4488ff', '#ffcc33', '#ff66cc', '#66ffcc'];
      for (var i = 0; i < 12; i++) {
        var angle = (Math.PI * 2 * i) / 12;
        var sp = 1 + Math.random() * 2;
        victoryParticles.push({
          x: fx, y: fy,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          life: 40 + Math.random() * 20,
          maxLife: 60,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3
        });
      }
    }

    for (var p = victoryParticles.length - 1; p >= 0; p--) {
      var part = victoryParticles[p];
      part.x += part.vx;
      part.y += part.vy;
      part.vy += 0.03;
      part.life--;
      if (part.life <= 0) { victoryParticles.splice(p, 1); continue; }
      c.globalAlpha = part.life / part.maxLife;
      c.fillStyle = part.color;
      c.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    c.globalAlpha = 1;

    c.fillStyle = '#ffcc33';
    c.font = 'bold 44px monospace';
    c.textAlign = 'center';
    c.shadowColor = '#ffaa00';
    c.shadowBlur = 20;
    c.fillText(Game.i18n.t('victory'), W / 2, 130);
    c.shadowBlur = 0;

    c.fillStyle = '#88ddff';
    c.font = '20px monospace';
    c.fillText(Game.i18n.t('savedOcean'), W / 2, 180);

    c.fillStyle = '#ccddee';
    c.font = '16px monospace';
    c.fillText(Game.i18n.t('thanks'), W / 2, 220);

    drawButton(c, Game.i18n.t('playAgain'), W / 2 - 90, 280, 180, 48);
    c.restore();
  }

  function handleVictoryClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 280, 180, 48)) {
      Game.audio.play('select');
      victoryParticles = [];
      victoryTimer = 0;
      return 'restart';
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
  var TAB_X = 320, TAB_Y = 60, TAB_W = 76, TAB_H = 34, TAB_GAP = 4;
  var GRID_X = 320, GRID_Y = 100, GRID_COLS = 3, GRID_TILE_W = 146, GRID_TILE_H = 58, GRID_GAP = 6;
  var COLOR_X = 320, COLOR_STEP = 42;
  var START_BTN_W = 200, START_BTN_H = 46;
  var START_BTN_X = W / 2 - START_BTN_W / 2 + 150;
  var START_BTN_Y = 420;

  function getTab(id) {
    for (var i = 0; i < customTabs.length; i++) if (customTabs[i].id === id) return customTabs[i];
    return customTabs[0];
  }

  /* Where the color-swatch row anchors for this tab. Sits just below the
     active grid so tabs with fewer variants (e.g. hair) don't leave a
     gap. Used by both the draw pass and the hit-test. */
  function colorYFor(tab) {
    var rows = Math.max(1, Math.ceil(tab.variants.length / GRID_COLS));
    return GRID_Y + rows * (GRID_TILE_H + GRID_GAP) + 12;
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
    /* Background */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Title */
    c.fillStyle = '#66ccff';
    c.font = 'bold 26px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('customize'), W / 2, 36);

    /* Preview stage – soft radial glow so Momoko pops against the bg */
    var stageCX = 160, stageCY = 240;
    var stageGrad = c.createRadialGradient(stageCX, stageCY, 20, stageCX, stageCY, 150);
    stageGrad.addColorStop(0, 'rgba(110,180,255,0.22)');
    stageGrad.addColorStop(1, 'rgba(110,180,255,0)');
    c.fillStyle = stageGrad;
    c.fillRect(10, 70, 300, 340);

    /* Momoko preview */
    c.save();
    c.translate(stageCX - 70, stageCY - 85);
    c.scale(5, 5);
    drawMomokoPreview(c, Game.customization);
    c.restore();

    /* Tab bar */
    for (var ti = 0; ti < customTabs.length; ti++) {
      var tx = TAB_X + ti * (TAB_W + TAB_GAP);
      var tab = customTabs[ti];
      var active = customSelection.tab === tab.id;
      c.fillStyle = active ? '#3388cc' : '#1a3a5a';
      roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
      c.fill();
      if (active) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2;
        roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
        c.stroke();
      }
      c.fillStyle = active ? '#ffffff' : '#aaccee';
      c.font = 'bold 11px monospace';
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
      c.fillStyle = selected ? '#2b5580' : '#12253d';
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
      c.font = 'bold 12px monospace';
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
                   : 'skinTone';
      c.fillStyle = '#88aacc';
      c.font = '13px monospace';
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
    c.font = '13px monospace';
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
    drawButton(c, Game.i18n.t('startGame'), START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H);
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

    /* Background – same deep-sea gradient as title for continuity */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(0.5, '#0d2847');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Drifting ambient bubbles */
    for (var i = 0; i < titleBubbles.length; i++) {
      var b = titleBubbles[i];
      b.wobble += 0.02;
      b.y -= b.speed * 0.4;
      if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
      c.save();
      c.globalAlpha = 0.2;
      c.fillStyle = '#66bbee';
      c.beginPath();
      c.arc(b.x + Math.sin(b.wobble) * 15, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* Momoko portrait (left) */
    c.save();
    c.translate(120, 200);
    c.scale(3.2, 3.2);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(introAnimTimer / 8) % 4);
    }
    c.restore();

    /* Title */
    c.fillStyle = '#ffcc66';
    c.font = 'bold 28px monospace';
    c.textAlign = 'center';
    c.shadowColor = '#884400';
    c.shadowBlur = 6;
    c.fillText(Game.i18n.t('introTitle'), W / 2, 46);
    c.shadowBlur = 0;

    /* Story panel */
    var panelX = 240, panelY = 72, panelW = 540, panelH = 320;
    c.fillStyle = 'rgba(8, 24, 48, 0.75)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.strokeStyle = '#2a5580';
    c.lineWidth = 2;
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.stroke();

    /* Story text */
    c.fillStyle = '#dfeeff';
    c.font = '14px monospace';
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

  /* Time-of-day palettes – each set drives sky gradient, distant hills,
     sand, water, and sun colour so the whole frame stays cohesive. */
  var BEACH_PALETTES = {
    morning: {
      sky: ['#aedcf2', '#dbeefb', '#fff1d4'],
      hills: '#7aa6c5',
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
      hills: '#7fa8c9',
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
      hills: '#9a5e7e',
      sand: ['#f4c282', '#e69e63', '#c47a4a'],
      water: '#3a4a8a',
      waterMid: '#5a6cae',
      waterLight: '#8a9acf',
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

    /* Distant hills */
    c.fillStyle = pal.hills;
    c.beginPath();
    c.moveTo(0, H * 0.58);
    c.bezierCurveTo(120, H * 0.5, 200, H * 0.55, 320, H * 0.53);
    c.bezierCurveTo(460, H * 0.5, 560, H * 0.57, 700, H * 0.54);
    c.bezierCurveTo(760, H * 0.53, 800, H * 0.56, 800, H * 0.58);
    c.lineTo(800, H * 0.6);
    c.lineTo(0, H * 0.6);
    c.closePath();
    c.fill();

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

    /* Umbrella + accompanying towel */
    drawBeachUmbrella(c, 660, H * 0.84);

    /* Sandcastle */
    drawSandcastle(c, 320, H * 0.82);

    /* Beach ball – bouncing on the sand */
    if (sc.hasBeachBall) {
      var ballY = H * 0.86 - Math.abs(Math.sin(t * 0.06)) * 30;
      drawBeachBall(c, sc.ballX, ballY, t * 0.04);
    }
    /* Frisbee – arcing through the sky */
    if (sc.hasFrisbee) {
      var frX = (sc.frisbeeX + (t * 1.2) % 600) - 100;
      var frY = 200 + Math.sin(t * 0.025) * 60;
      drawFrisbee(c, frX, frY, t * 0.2);
    }

    /* Starfish scattered on sand */
    drawStarfish(c, 140, H * 0.84, 6, 0.4, '#e66442');
    drawStarfish(c, 500, H * 0.78, 5, 1.1, '#e6a84a');
    drawStarfish(c, 720, H * 0.77, 5, 0.7, '#d94a5a');

    /* Kids – count and colours vary per visit */
    for (var ki = 0; ki < sc.kids.length; ki++) {
      var kid = sc.kids[ki];
      drawKid(c, kid.x, H * kid.y, kid.color, t * 0.08 + kid.bobOffset);
    }

    /* Crabs walking on sand */
    for (var cb = 0; cb < sc.crabs.length; cb++) {
      var crab = sc.crabs[cb];
      var crabX = crab.baseX + Math.sin(t * 0.01 + crab.phase) * 30 * crab.dir;
      var crabY = H * 0.88 + Math.sin(t * 0.04 + crab.phase) * 1;
      drawCrab(c, crabX, crabY, t * 0.2 + crab.phase);
    }

    /* Wolfe on beach */
    if (wolfe) {
      wolfe.y = H * 0.6 - 22;
      wolfe.draw(c, 0, 0);
    }

    /* Water at bottom – tinted by time of day */
    c.fillStyle = pal.water;
    c.fillRect(0, H * 0.93, W, H * 0.07);

    /* Overlapping waves */
    c.fillStyle = pal.waterMid;
    c.beginPath();
    c.moveTo(0, H * 0.93);
    for (var w1 = 0; w1 <= W; w1 += 6) {
      c.lineTo(w1, H * 0.93 + Math.sin(t * 0.04 + w1 * 0.04) * 3);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    c.fillStyle = pal.waterLight;
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

    /* Player-controlled Momoko walking on the sand. Drawn after sand /
       decor and before Kitty so she sits in the natural z-order. Scaled
       2x so she matches the size of kids / beach props. The sprite's
       animFrame parameter drives her flipper/foot kick timing. */
    if (beachMomoko) {
      var mm = beachMomoko;
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
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fillText(Game.i18n.t(sc.titleKey), W / 2, 40);
    c.restore();

    /* Text panel */
    var panelW = 520, panelH = 60, panelX = (W - panelW) / 2, panelY = 58;
    c.fillStyle = 'rgba(0, 40, 70, 0.55)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.fillStyle = '#e8f4ff';
    c.font = '14px monospace';
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

  /* ---- Exports ---- */
  window.Game.ui = {
    drawTitleScreen: function (c) {
      drawTitleScreen(c);
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
    isShowingInstructions: function () { return showInstructions; },
  };
})();
