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
  /* On touch devices the canvas is wider than the game viewport (control
     strips live on each side). gameOffsetX() is the logical x-coordinate
     where the game viewport begins. */
  function gameOffsetX() {
    if (!canvas) return 0;
    return Math.max(0, Math.floor((canvasLogicalW() - GAME_W) / 2));
  }
  function sideStripW() {
    return gameOffsetX();
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
     thumbs never cover gameplay. Pause sits in the upper-right corner
     of the game viewport so it's close at hand but out of the way. */
  function layoutButtons() {
    if (!canvas) return;
    var stripW = sideStripW();
    var hasSideStrips = stripW > 0;
    if (hasSideStrips) {
      var leftCx = stripW / 2;
      var rightCx = canvasLogicalW() - stripW / 2;
      var cy = GAME_H / 2;
      /* D-pad: pad=44, spacing=52 → outer dimension 192 px fits in a
         200-wide strip with 4 px margin on each side. */
      var pad = 44;
      var spacing = 52;
      touchButtons.up =    { x: leftCx, y: cy - spacing, r: pad, active: false };
      touchButtons.down =  { x: leftCx, y: cy + spacing, r: pad, active: false };
      touchButtons.left =  { x: leftCx - spacing, y: cy, r: pad, active: false };
      touchButtons.right = { x: leftCx + spacing, y: cy, r: pad, active: false };
      touchButtons.action = { x: rightCx, y: cy, r: 80, active: false };
      /* Pause: upper-right of the game viewport (canvas coords). */
      touchButtons.pause  = { x: stripW + GAME_W - 34, y: 34, r: 28, active: false };
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

  /* Paint the control strips on each side of the game viewport plus
     (optionally) the touch buttons. Called every frame on touch devices
     so the strip background is always present under the buttons. */
  function drawTouchStrip(c, showButtons) {
    if (!canvas) return;
    var stripW = sideStripW();
    if (stripW > 0) {
      var lw = canvasLogicalW();
      paintSidePanel(c, 0, stripW, /*innerEdgeX*/ stripW);
      paintSidePanel(c, lw - stripW, stripW, /*innerEdgeX*/ lw - stripW - 1);
    }
    if (showButtons) drawTouchButtons(c);
  }

  function paintSidePanel(c, x, w, innerEdgeX) {
    var h = canvasLogicalH();
    c.save();
    c.fillStyle = '#081224';
    c.fillRect(x, 0, w, h);
    /* Subtle glow along the inner edge so the strip reads as a bezel,
       not as a letterbox. */
    var fromX = innerEdgeX < x + w / 2 ? innerEdgeX : innerEdgeX - 10;
    var toX = innerEdgeX < x + w / 2 ? innerEdgeX + 10 : innerEdgeX;
    var grad = c.createLinearGradient(fromX, 0, toX, 0);
    if (innerEdgeX < x + w / 2) {
      grad.addColorStop(0, 'rgba(100,160,220,0.25)');
      grad.addColorStop(1, 'rgba(10,22,40,0)');
    } else {
      grad.addColorStop(0, 'rgba(10,22,40,0)');
      grad.addColorStop(1, 'rgba(100,160,220,0.25)');
    }
    c.fillStyle = grad;
    c.fillRect(Math.min(fromX, toX), 0, 10, h);
    c.strokeStyle = '#1a3a60';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(innerEdgeX + 0.5, 0);
    c.lineTo(innerEdgeX + 0.5, h);
    c.stroke();
    c.restore();
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
    return { x: canvasX - gameOffsetX(), y: canvasY };
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
