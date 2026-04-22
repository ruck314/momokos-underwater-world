/* input.js – keyboard + touch controls */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var keys = { left: false, right: false, up: false, down: false, action: false, pause: false };
  var justPressed = { action: false, pause: false };
  var prevKeys = { action: false, pause: false };

  /* Touch state – each touch: { x, y, button } where button is a sticky binding
     so a finger that lands on a direction button keeps that button pressed
     even if the finger slides off it (matches keyboard hold feel). */
  var touches = {};
  var touchButtons = {
    up: { x: 0, y: 0, r: 0, active: false },
    down: { x: 0, y: 0, r: 0, active: false },
    left: { x: 0, y: 0, r: 0, active: false },
    right: { x: 0, y: 0, r: 0, active: false },
    action: { x: 0, y: 0, r: 0, active: false },
    pause: { x: 0, y: 0, r: 0, active: false },
  };
  var BUTTON_NAMES = ['up', 'down', 'left', 'right', 'action', 'pause'];
  var isTouchDevice = false;
  var canvas = null;
  var canvasRect = null;
  var GAME_W = 800;   /* logical game viewport width */
  var GAME_H = 480;   /* logical game viewport height */

  /* Helpers: the canvas's backing store is scaled by devicePixelRatio for
     crisp rendering, so canvas.width / canvas.height are *not* logical
     pixels. These helpers return the logical (pre-DPR) dimensions that
     all game/input math reasons about. */
  function dprFactor() {
    return Math.min(3, window.devicePixelRatio || 1);
  }
  function canvasLogicalW() {
    if (!canvas) return 0;
    return canvas.width / dprFactor();
  }
  function canvasLogicalH() {
    if (!canvas) return 0;
    return canvas.height / dprFactor();
  }
  /* On touch devices the canvas is wider (and sometimes taller) than the
     game viewport – control strips live on the sides, optional bezels
     above/below for tablets. Engine.js publishes Game.TOUCH_LEFT_W /
     Game.TOUCH_RIGHT_W / Game.GAME_Y; fall back to centred padding if
     it hasn't initialised yet. */
  function hasAsymmetricStrips() {
    return canvas &&
           typeof Game.TOUCH_LEFT_W === 'number' &&
           typeof Game.TOUCH_RIGHT_W === 'number' &&
           canvasLogicalW() > GAME_W;
  }
  function leftStripW() {
    if (hasAsymmetricStrips()) return Game.TOUCH_LEFT_W;
    return Math.max(0, Math.floor((canvasLogicalW() - GAME_W) / 2));
  }
  function rightStripW() {
    if (hasAsymmetricStrips()) return Game.TOUCH_RIGHT_W;
    return Math.max(0, Math.floor((canvasLogicalW() - GAME_W) / 2));
  }
  function topStripH() {
    if (canvas && typeof Game.GAME_Y === 'number') return Game.GAME_Y;
    return Math.max(0, Math.floor((canvasLogicalH() - GAME_H) / 2));
  }
  function bottomStripH() {
    if (!canvas) return 0;
    return Math.max(0, canvasLogicalH() - GAME_H - topStripH());
  }
  function gameOffsetX() {
    return leftStripW();
  }
  function gameOffsetY() {
    return topStripH();
  }
  /* Back-compat helper – any caller that asks for "the strip width" really
     wants the left one, because that's the D-pad side. */
  function sideStripW() {
    return leftStripW();
  }

  /* Keyboard */
  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': keys.left = true; break;
      case 'ArrowRight': case 'KeyD': keys.right = true; break;
      case 'ArrowUp': case 'KeyW': keys.up = true; break;
      case 'ArrowDown': case 'KeyS': keys.down = true; break;
      case 'Space': case 'KeyZ': keys.action = true; e.preventDefault(); break;
      case 'Escape': case 'KeyP': keys.pause = true; break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': keys.left = false; break;
      case 'ArrowRight': case 'KeyD': keys.right = false; break;
      case 'ArrowUp': case 'KeyW': keys.up = false; break;
      case 'ArrowDown': case 'KeyS': keys.down = false; break;
      case 'Space': case 'KeyZ': keys.action = false; break;
      case 'Escape': case 'KeyP': keys.pause = false; break;
    }
  }

  /* Touch coord mapping – scale to actual canvas dimensions
     (canvas may be 800×480 on desktop or 800×600 on touch devices). */
  function touchToCanvas(touch) {
    if (!canvasRect) canvasRect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - canvasRect.left) / (canvasRect.width / canvasLogicalW()),
      y: (touch.clientY - canvasRect.top) / (canvasRect.height / canvasLogicalH())
    };
  }

  function buttonAt(pos) {
    for (var i = 0; i < BUTTON_NAMES.length; i++) {
      if (hitTest(pos, touchButtons[BUTTON_NAMES[i]])) return BUTTON_NAMES[i];
    }
    return null;
  }

  function hitTest(pos, btn) {
    var dx = pos.x - btn.x;
    var dy = pos.y - btn.y;
    return (dx * dx + dy * dy) <= (btn.r * btn.r);
  }

  function processTouches() {
    for (var i = 0; i < BUTTON_NAMES.length; i++) touchButtons[BUTTON_NAMES[i]].active = false;

    var ids = Object.keys(touches);
    for (var i2 = 0; i2 < ids.length; i2++) {
      var tr = touches[ids[i2]];
      if (tr.button) touchButtons[tr.button].active = true;
    }

    keys.up = keys.up || touchButtons.up.active;
    keys.down = keys.down || touchButtons.down.active;
    keys.left = keys.left || touchButtons.left.active;
    keys.right = keys.right || touchButtons.right.active;
    keys.action = keys.action || touchButtons.action.active;
    keys.pause = keys.pause || touchButtons.pause.active;
  }

  function onTouchStart(e) {
    e.preventDefault();
    isTouchDevice = true;
    canvasRect = canvas.getBoundingClientRect();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pos = touchToCanvas(t);
      touches[t.identifier] = { x: pos.x, y: pos.y, button: buttonAt(pos) };
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    canvasRect = canvas.getBoundingClientRect();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pos = touchToCanvas(t);
      var tr = touches[t.identifier];
      if (!tr) continue;
      tr.x = pos.x; tr.y = pos.y;
      /* Sticky: only re-bind if finger slides ONTO a different button.
         Sliding off into empty space keeps the existing button pressed. */
      var over = buttonAt(pos);
      if (over) tr.button = over;
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      delete touches[e.changedTouches[i].identifier];
    }
  }

  /* Layout touch buttons in canvas coordinates. On touch devices the
     canvas is wider than the game viewport (side strips on each side);
     the D-pad lives in the left strip and BUBBLE in the right strip, so
     thumbs never cover gameplay. The buttons are vertically centered on
     the canvas (not the game viewport) so on tall tablets where the
     canvas extends above/below the game, thumbs land naturally on the
     side bezel rather than reaching toward the middle of the screen.
     Pause sits in the upper-right corner of the game viewport so it's
     close at hand but out of the way. */
  function layoutButtons() {
    if (!canvas) return;
    var lStrip = leftStripW();
    var rStrip = rightStripW();
    var tStrip = topStripH();
    var hasSideStrips = lStrip > 0;
    if (hasSideStrips) {
      var leftCx = lStrip / 2;
      var rightCx = canvasLogicalW() - rStrip / 2;
      var cy = canvasLogicalH() / 2;
      /* D-pad sized off the actual strip width so a wider strip gives
         larger, easier-to-hit buttons on iPhone. outer dimension
         = leftCx + spacing + pad must fit in lStrip with a small margin. */
      var pad = Math.min(54, Math.floor(lStrip / 4.5));
      var spacing = Math.min(66, Math.floor(lStrip / 3.8));
      touchButtons.up =    { x: leftCx, y: cy - spacing, r: pad, active: false };
      touchButtons.down =  { x: leftCx, y: cy + spacing, r: pad, active: false };
      touchButtons.left =  { x: leftCx - spacing, y: cy, r: pad, active: false };
      touchButtons.right = { x: leftCx + spacing, y: cy, r: pad, active: false };
      touchButtons.action = { x: rightCx, y: cy, r: 80, active: false };
      /* Pause: upper-right corner of the game viewport (canvas coords). */
      touchButtons.pause  = { x: lStrip + GAME_W - 34, y: tStrip + 34, r: 28, active: false };
    } else {
      /* Keyboard-only / desktop fallback – touch buttons aren't actually
         drawn in this branch (isTouchDevice is false), but keep a layout
         so hit-tests remain well-defined. */
      var pad2 = 38, bx2 = 100, by2 = 370, sp2 = pad2 * 2;
      touchButtons.up =    { x: bx2, y: by2 - sp2, r: pad2, active: false };
      touchButtons.down =  { x: bx2, y: by2 + sp2, r: pad2, active: false };
      touchButtons.left =  { x: bx2 - sp2, y: by2, r: pad2, active: false };
      touchButtons.right = { x: bx2 + sp2, y: by2, r: pad2, active: false };
      touchButtons.action = { x: 700, y: 380, r: 50, active: false };
      touchButtons.pause  = { x: 770, y: 30, r: 25, active: false };
    }
  }

  function init(cvs) {
    canvas = cvs;
    canvasRect = canvas.getBoundingClientRect();
    layoutButtons();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  /* Call once per frame before reading keys */
  function update() {
    /* Detect just-pressed (rising edge) */
    justPressed.action = keys.action && !prevKeys.action;
    justPressed.pause = keys.pause && !prevKeys.pause;
    prevKeys.action = keys.action;
    prevKeys.pause = keys.pause;
  }

  /* Call at end of frame to clear keyboard-only states (touch states reset via processTouches) */
  function postUpdate() {
    /* Reset keyboard-only flags for single-frame presses handled by justPressed */
  }

  /* Refresh rect on resize */
  function refreshLayout() {
    if (canvas) canvasRect = canvas.getBoundingClientRect();
  }

  /* Paint the bezel surrounding the game viewport plus (optionally) the
     touch buttons. Called every frame on touch devices so the bezel
     background is always present under the buttons. The game viewport
     itself gets fully overwritten by the state renderer afterwards, so
     it's safe to paint across it here. */
  function drawTouchStrip(c, showButtons) {
    if (!canvas) return;
    var cw = canvasLogicalW();
    var ch = canvasLogicalH();
    var gx = gameOffsetX();
    var gy = gameOffsetY();
    var rEdge = gx + GAME_W;
    var bEdge = gy + GAME_H;

    c.save();
    /* Bezel fill across the entire canvas */
    c.fillStyle = '#081224';
    c.fillRect(0, 0, cw, ch);

    /* Inner-edge glow framing the game viewport so the bezel reads as a
       deliberate frame rather than letterboxing. Skip a side if the game
       viewport is already flush against that edge. */
    if (gx > 0) paintEdgeGlow(c, gx - 10, 0, 10, ch, 'h', false);
    if (rEdge < cw) paintEdgeGlow(c, rEdge, 0, 10, ch, 'h', true);
    if (gy > 0) paintEdgeGlow(c, 0, gy - 10, cw, 10, 'v', false);
    if (bEdge < ch) paintEdgeGlow(c, 0, bEdge, cw, 10, 'v', true);

    /* Hairline border at the game viewport edges (drawn in bezel space –
       the state renderer will paint over the inside of the rect). */
    if (gx > 0 || gy > 0 || rEdge < cw || bEdge < ch) {
      c.strokeStyle = '#1a3a60';
      c.lineWidth = 2;
      if (gx > 0) {
        c.beginPath(); c.moveTo(gx + 0.5, 0); c.lineTo(gx + 0.5, ch); c.stroke();
      }
      if (rEdge < cw) {
        c.beginPath(); c.moveTo(rEdge - 0.5, 0); c.lineTo(rEdge - 0.5, ch); c.stroke();
      }
      if (gy > 0) {
        c.beginPath(); c.moveTo(0, gy + 0.5); c.lineTo(cw, gy + 0.5); c.stroke();
      }
      if (bEdge < ch) {
        c.beginPath(); c.moveTo(0, bEdge - 0.5); c.lineTo(cw, bEdge - 0.5); c.stroke();
      }
    }
    c.restore();

    if (showButtons) drawTouchButtons(c);
  }

  /* `dir` is 'h' for a vertical bezel band (gradient runs horizontally)
     or 'v' for a horizontal bezel band (gradient runs vertically). When
     `inward` is true the glow brightens toward the game-viewport side. */
  function paintEdgeGlow(c, x, y, w, h, dir, inward) {
    var grad;
    if (dir === 'h') {
      grad = c.createLinearGradient(x, 0, x + w, 0);
    } else {
      grad = c.createLinearGradient(0, y, 0, y + h);
    }
    if (inward) {
      grad.addColorStop(0, 'rgba(100,160,220,0.25)');
      grad.addColorStop(1, 'rgba(10,22,40,0)');
    } else {
      grad.addColorStop(0, 'rgba(10,22,40,0)');
      grad.addColorStop(1, 'rgba(100,160,220,0.25)');
    }
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
  }

  function drawTouchButtons(c) {
    if (!isTouchDevice) return;
    c.save();
    c.globalAlpha = 0.9;

    /* D-pad buttons */
    var btns = ['up', 'down', 'left', 'right'];
    var arrows = ['\u25B2', '\u25BC', '\u25C0', '\u25B6'];
    for (var i = 0; i < btns.length; i++) {
      var b = touchButtons[btns[i]];
      c.fillStyle = b.active ? '#88ccff' : '#2a4a6e';
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#66aadd';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#ffffff';
      c.font = 'bold 34px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(arrows[i], b.x, b.y);
    }

    /* D-pad center – computed from button positions so it matches layout */
    var centerX = (touchButtons.left.x + touchButtons.right.x) / 2;
    var centerY = (touchButtons.up.y + touchButtons.down.y) / 2;
    c.fillStyle = '#334455';
    c.beginPath();
    c.arc(centerX, centerY, 22, 0, Math.PI * 2);
    c.fill();

    /* Action button */
    var ab = touchButtons.action;
    c.fillStyle = ab.active ? '#ff88aa' : '#cc4466';
    c.beginPath();
    c.arc(ab.x, ab.y, ab.r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffaacc';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 24px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var bubbleLabel = (window.Game && Game.i18n) ? Game.i18n.t('bubbleBtn') : 'BUBBLE';
    c.fillText(bubbleLabel, ab.x, ab.y);

    /* Pause button */
    var pb = touchButtons.pause;
    c.fillStyle = pb.active ? '#88aabb' : '#556677';
    c.beginPath();
    c.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#99aabb';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 20px monospace';
    c.fillText('II', pb.x, pb.y);

    c.restore();
  }

  /* Click handling for menus. Returns game-space coordinates (0..GAME_W,
     0..GAME_H) so menu hit-tests keep working regardless of whether the
     canvas is padded with side strips. */
  function getClickPos(e) {
    var rect = canvas.getBoundingClientRect();
    var cx, cy;
    if (e.changedTouches && e.changedTouches.length > 0) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    var canvasX = (cx - rect.left) / (rect.width / canvasLogicalW());
    var canvasY = (cy - rect.top) / (rect.height / canvasLogicalH());
    return { x: canvasX - gameOffsetX(), y: canvasY - gameOffsetY() };
  }

  window.Game.input = {
    init: init,
    update: function () {
      /* Reset keyboard states that are modified by touch */
      if (isTouchDevice) {
        keys.up = false; keys.down = false;
        keys.left = false; keys.right = false;
        keys.action = false; keys.pause = false;
      }
      processTouches();
      update();
    },
    postUpdate: postUpdate,
    refreshLayout: function () { refreshLayout(); layoutButtons(); },
    keys: keys,
    justPressed: justPressed,
    drawTouchStrip: drawTouchStrip,
    drawTouchButtons: drawTouchButtons,
    /* Legacy alias – calls the new strip + buttons painter. */
    drawTouchControls: function (c) { drawTouchStrip(c, true); },
    getClickPos: getClickPos,
    isTouch: function () { return isTouchDevice; },
  };
})();
