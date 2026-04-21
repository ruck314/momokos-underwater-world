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
  function drawPauseMenu(c) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#66ccff';
    c.font = 'bold 32px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('paused'), W / 2, 150);

    drawButton(c, Game.i18n.t('resume'), W / 2 - 90, 200, 180, 44);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 90, 260, 180, 44);
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 90, 320, 180, 44);
    drawButton(c, Game.i18n.t('quit'), W / 2 - 90, 380, 180, 44);
    c.restore();
  }

  function handlePauseClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 200, 180, 44)) { Game.audio.play('select'); return 'resume'; }
    if (hitButton(mx, my, W / 2 - 90, 260, 180, 44)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 90, 320, 180, 44)) { Game.audio.toggleMute(); return null; }
    if (hitButton(mx, my, W / 2 - 90, 380, 180, 44)) { Game.audio.play('select'); return 'quit'; }
    return null;
  }

  /* ---- Dialogue Box ---- */
  function drawDialogue(c, speaker, text) {
    var boxW = 500;
    var boxH = 100;
    var bx = (W - boxW) / 2;
    var by = H - boxH - 60;

    c.save();
    /* Box */
    c.fillStyle = 'rgba(0, 15, 40, 0.9)';
    c.fillRect(bx, by, boxW, boxH);
    c.strokeStyle = '#44aadd';
    c.lineWidth = 2;
    c.strokeRect(bx, by, boxW, boxH);

    /* Speaker name */
    c.fillStyle = '#ffcc44';
    c.font = 'bold 14px monospace';
    c.textAlign = 'left';
    c.fillText(speaker, bx + 12, by + 18);

    /* Text */
    c.fillStyle = '#ddeeff';
    c.font = '13px monospace';
    wrapText(c, text, bx + 12, by + 38, boxW - 24, 18);

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

  /* ---- Customization Screen ---- */
  var customPresets = [
    { name: 'presetOcean', hair: '#e06088', suit: '#3366aa', skin: '#ffddbb', flipper: '#33bb77' },
    { name: 'presetExplorer', hair: '#4a3728', suit: '#444444', skin: '#ddb896', flipper: '#ff8833' },
    { name: 'presetRainbow', hair: '#ff44cc', suit: '#9933ff', skin: '#ffe0c0', flipper: '#44ddff' },
    { name: 'presetCoral', hair: '#ff6644', suit: '#cc3366', skin: '#c68c5a', flipper: '#ffaa33' },
    { name: 'presetNight', hair: '#2244aa', suit: '#1a1a3a', skin: '#8d6e4c', flipper: '#6666cc' },
  ];
  var hairColors = ['#e06088', '#4a3728', '#f5d060', '#4488ff', '#222222', '#cc3333'];
  var suitColors = ['#3366aa', '#cc3333', '#7733aa', '#228844', '#dd7722', '#cc4488'];
  var skinTones = ['#ffe0c0', '#ddb896', '#c68c5a', '#8d6e4c', '#5c3d2e'];

  var customSelection = { presetIdx: 0 };

  function drawCustomizeScreen(c) {
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#66ccff';
    c.font = 'bold 26px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('customize'), W / 2, 36);

    /* --- Momoko preview (left side) --- */
    var previewX = 160, previewY = 200;
    c.save();
    c.translate(previewX, previewY);
    c.scale(4, 4);
    drawMomokoPreview(c, Game.customization);
    c.restore();

    /* --- Right side controls --- */
    var rx = 360, ry = 58;

    /* Presets */
    c.fillStyle = '#88aacc';
    c.font = '14px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('presets'), rx, ry);
    ry += 8;
    for (var pi = 0; pi < customPresets.length; pi++) {
      var px = rx + pi * 82;
      var selected = customSelection.presetIdx === pi;
      c.fillStyle = selected ? '#225588' : '#112244';
      roundRect(c, px, ry, 76, 40, 6);
      c.fill();
      if (selected) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        roundRect(c, px, ry, 76, 40, 6);
        c.stroke();
      }
      c.fillStyle = customPresets[pi].hair;
      c.beginPath(); c.arc(px + 14, ry + 16, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = customPresets[pi].suit;
      c.beginPath(); c.arc(px + 30, ry + 16, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = customPresets[pi].skin;
      c.beginPath(); c.arc(px + 46, ry + 16, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ccddee';
      c.font = '9px monospace';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t(customPresets[pi].name), px + 38, ry + 35);
      c.textAlign = 'left';
    }
    ry += 56;

    /* Hair colors */
    c.fillStyle = '#88aacc';
    c.font = '14px monospace';
    c.fillText(Game.i18n.t('hairColor'), rx, ry);
    ry += 8;
    drawColorRow(c, rx, ry, hairColors, Game.customization.hair);
    ry += 42;

    /* Suit colors */
    c.fillStyle = '#88aacc';
    c.font = '14px monospace';
    c.fillText(Game.i18n.t('suitColor'), rx, ry);
    ry += 8;
    drawColorRow(c, rx, ry, suitColors, Game.customization.suit);
    ry += 42;

    /* Skin tones */
    c.fillStyle = '#88aacc';
    c.font = '14px monospace';
    c.fillText(Game.i18n.t('skinTone'), rx, ry);
    ry += 8;
    drawColorRow(c, rx, ry, skinTones, Game.customization.skin);
    ry += 52;

    /* Start button */
    drawButton(c, Game.i18n.t('startGame'), W / 2 + 80, ry, 180, 48);
  }

  function drawColorRow(c, x, y, colors, selected) {
    for (var i = 0; i < colors.length; i++) {
      var cx = x + i * 44 + 16;
      var cy = y + 16;
      c.fillStyle = colors[i];
      c.beginPath();
      c.arc(cx, cy, 14, 0, Math.PI * 2);
      c.fill();
      if (colors[i] === selected) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(cx, cy, 17, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  function drawMomokoPreview(c, cust) {
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, 0, 0, cust, 0);
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
    var rx = 360, ry = 66;

    /* Presets */
    for (var pi = 0; pi < customPresets.length; pi++) {
      var px = rx + pi * 82;
      if (hitButton(mx, my, px, ry, 76, 40)) {
        customSelection.presetIdx = pi;
        var p = customPresets[pi];
        Game.customization.hair = p.hair;
        Game.customization.suit = p.suit;
        Game.customization.skin = p.skin;
        Game.customization.flipper = p.flipper;
        Game.audio.play('select');
        return null;
      }
    }
    ry += 56;

    /* Hair */
    ry += 22;
    for (var hi = 0; hi < hairColors.length; hi++) {
      var hcx = rx + hi * 44 + 16;
      var hcy = ry - 6;
      if (Math.sqrt((mx - hcx) * (mx - hcx) + (my - hcy) * (my - hcy)) < 17) {
        Game.customization.hair = hairColors[hi];
        customSelection.presetIdx = -1;
        Game.audio.play('select');
        return null;
      }
    }
    ry += 20;

    /* Suit */
    ry += 22;
    for (var si = 0; si < suitColors.length; si++) {
      var scx = rx + si * 44 + 16;
      var scy = ry - 6;
      if (Math.sqrt((mx - scx) * (mx - scx) + (my - scy) * (my - scy)) < 17) {
        Game.customization.suit = suitColors[si];
        customSelection.presetIdx = -1;
        Game.audio.play('select');
        return null;
      }
    }
    ry += 20;

    /* Skin */
    ry += 22;
    for (var ki = 0; ki < skinTones.length; ki++) {
      var kcx = rx + ki * 44 + 16;
      var kcy = ry - 6;
      if (Math.sqrt((mx - kcx) * (mx - kcx) + (my - kcy) * (my - kcy)) < 17) {
        Game.customization.skin = skinTones[ki];
        customSelection.presetIdx = -1;
        Game.audio.play('select');
        return null;
      }
    }
    ry += 52;

    /* Start button */
    if (hitButton(mx, my, W / 2 + 80, ry, 180, 48)) {
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
  var beachTimer = 0;
  var beachKitty = null;
  var beachSeagulls = [
    { x: 120, y: 70, spd: 0.4, phase: 0 },
    { x: 340, y: 50, spd: 0.3, phase: 1.2 },
    { x: 520, y: 90, spd: 0.5, phase: 2.3 },
    { x: 700, y: 60, spd: 0.35, phase: 0.8 },
    { x: 220, y: 110, spd: 0.45, phase: 3.1 },
  ];
  var beachCrabs = [
    { baseX: 260, y: 0, dir: 1, phase: 0 },
    { baseX: 580, y: 0, dir: -1, phase: 1.7 },
  ];

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

    /* Sky gradient */
    var skyGrad = c.createLinearGradient(0, 0, 0, H * 0.6);
    skyGrad.addColorStop(0, '#4a9ee6');
    skyGrad.addColorStop(0.6, '#89c6f2');
    skyGrad.addColorStop(1, '#ffd89b');
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, H * 0.6);

    /* Sun rays */
    var sunX = 650, sunY = 78;
    c.save();
    c.globalAlpha = 0.12;
    c.strokeStyle = '#fff4b0';
    c.lineWidth = 3;
    for (var ry = 0; ry < 14; ry++) {
      var ra = (ry / 14) * Math.PI * 2 + t * 0.002;
      c.beginPath();
      c.moveTo(sunX, sunY);
      c.lineTo(sunX + Math.cos(ra) * 180, sunY + Math.sin(ra) * 180);
      c.stroke();
    }
    c.restore();

    /* Sun glow */
    var sunGrad = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    sunGrad.addColorStop(0, 'rgba(255, 255, 180, 0.9)');
    sunGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
    c.fillStyle = sunGrad;
    c.fillRect(sunX - 90, sunY - 90, 180, 180);
    /* Sun core */
    c.fillStyle = '#fff6a8';
    c.beginPath();
    c.arc(sunX, sunY, 32, 0, Math.PI * 2);
    c.fill();

    /* Distant hills */
    c.fillStyle = '#7fa8c9';
    c.beginPath();
    c.moveTo(0, H * 0.58);
    c.bezierCurveTo(120, H * 0.5, 200, H * 0.55, 320, H * 0.53);
    c.bezierCurveTo(460, H * 0.5, 560, H * 0.57, 700, H * 0.54);
    c.bezierCurveTo(760, H * 0.53, 800, H * 0.56, 800, H * 0.58);
    c.lineTo(800, H * 0.6);
    c.lineTo(0, H * 0.6);
    c.closePath();
    c.fill();

    /* Clouds */
    c.fillStyle = '#ffffff';
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

    /* Seagulls */
    for (var sg = 0; sg < beachSeagulls.length; sg++) {
      var bird = beachSeagulls[sg];
      bird.x += bird.spd;
      if (bird.x > W + 20) bird.x = -20;
      drawSeagull(c, bird.x, bird.y + Math.sin(t * 0.02 + bird.phase) * 4, t * 0.18 + bird.phase);
    }

    /* Sand – main beach */
    var sandGrad = c.createLinearGradient(0, H * 0.55, 0, H);
    sandGrad.addColorStop(0, '#f0d590');
    sandGrad.addColorStop(0.5, '#e8c478');
    sandGrad.addColorStop(1, '#d4a968');
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

    /* Starfish scattered on sand */
    drawStarfish(c, 140, H * 0.84, 6, 0.4, '#e66442');
    drawStarfish(c, 500, H * 0.78, 5, 1.1, '#e6a84a');
    drawStarfish(c, 720, H * 0.77, 5, 0.7, '#d94a5a');

    /* Stick figure kids playing */
    drawKid(c, 240, H * 0.86, '#33bb77', t * 0.08);
    drawKid(c, 600, H * 0.82, '#cc44aa', t * 0.08 + 1.3);

    /* Crabs walking on sand */
    for (var cb = 0; cb < beachCrabs.length; cb++) {
      var crab = beachCrabs[cb];
      var crabX = crab.baseX + Math.sin(t * 0.01 + crab.phase) * 30 * crab.dir;
      var crabY = H * 0.88 + Math.sin(t * 0.04 + crab.phase) * 1;
      drawCrab(c, crabX, crabY, t * 0.2 + crab.phase);
    }

    /* Wolfe on beach */
    if (wolfe) {
      wolfe.y = H * 0.6 - 22;
      wolfe.draw(c, 0, 0);
    }

    /* Water at bottom */
    c.fillStyle = '#1e7bb8';
    c.fillRect(0, H * 0.93, W, H * 0.07);

    /* Overlapping waves */
    c.fillStyle = '#2e95cc';
    c.beginPath();
    c.moveTo(0, H * 0.93);
    for (var w1 = 0; w1 <= W; w1 += 6) {
      c.lineTo(w1, H * 0.93 + Math.sin(t * 0.04 + w1 * 0.04) * 3);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    c.fillStyle = '#5ab4dd';
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

    /* Title text with shadow */
    c.save();
    c.fillStyle = '#ffffff';
    c.font = 'bold 30px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fillText(Game.i18n.t('beachTitle'), W / 2, 40);
    c.restore();

    /* Text panel */
    var panelW = 520, panelH = 60, panelX = (W - panelW) / 2, panelY = 58;
    c.fillStyle = 'rgba(0, 40, 70, 0.55)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.fillStyle = '#e8f4ff';
    c.font = '14px monospace';
    c.textAlign = 'center';
    wrapText(c, Game.i18n.t('beachText'), W / 2, panelY + 22, panelW - 20, 20);

    drawButton(c, Game.i18n.t('back'), W / 2 - 90, 140, 180, 40);
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
    drawGameOver: drawGameOver,
    drawVictory: drawVictory,
    drawCustomizeScreen: drawCustomizeScreen,
    drawIntroScreen: drawIntroScreen,
    drawBeachCutscene: drawBeachCutscene,
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
