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
  var GAME_H = 480;   /* logical game viewport height (unchanged) */
  var STRIP_H = 200;  /* touch-control strip drawn below the game area */

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
      x: (touch.clientX - canvasRect.left) / (canvasRect.width / canvas.width),
      y: (touch.clientY - canvasRect.top) / (canvasRect.height / canvas.height)
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

  /* Layout touch buttons. When the canvas has a dedicated control strip
     (touch devices: canvas height = GAME_H + STRIP_H) the buttons live
     in that strip so they never overlap the gameplay area. Otherwise
     fall back to the original in-view layout (keyboard-only builds). */
  function layoutButtons() {
    if (!canvas) return;
    var hasStrip = canvas.height >= GAME_H + 80;
    if (hasStrip) {
      var stripTop = GAME_H;
      var cy = stripTop + STRIP_H / 2;
      /* D-pad: sized to fit in the 200-tall strip with ~2px margin on
         each side (pad=46, spacing=52 → outer edges at cy±98). */
      var pad = 46;
      var spacing = 52;
      var bx = 130;
      touchButtons.up =    { x: bx, y: cy - spacing, r: pad, active: false };
      touchButtons.down =  { x: bx, y: cy + spacing, r: pad, active: false };
      touchButtons.left =  { x: bx - spacing, y: cy, r: pad, active: false };
      touchButtons.right = { x: bx + spacing, y: cy, r: pad, active: false };
      touchButtons.action = { x: 680, y: cy, r: 68, active: false };
      /* Pause lives in the upper-right of the game viewport, not the
         control strip, so it stays out of the thumb-drag zone. */
      touchButtons.pause  = { x: 768, y: 34, r: 26, active: false };
    } else {
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

  /* Paint strip below the game viewport plus (optionally) the touch
     buttons. Called every frame on touch devices so no state leaves
     the strip un-painted. */
  function drawTouchStrip(c, showButtons) {
    if (!canvas) return;
    var stripTop = GAME_H;
    var stripH = canvas.height - stripTop;
    if (stripH >= 20) {
      c.save();
      c.fillStyle = '#081224';
      c.fillRect(0, stripTop, 800, stripH);
      var grad = c.createLinearGradient(0, stripTop, 0, stripTop + 10);
      grad.addColorStop(0, 'rgba(100,160,220,0.25)');
      grad.addColorStop(1, 'rgba(10,22,40,0)');
      c.fillStyle = grad;
      c.fillRect(0, stripTop, 800, 10);
      c.strokeStyle = '#1a3a60';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, stripTop + 1);
      c.lineTo(800, stripTop + 1);
      c.stroke();
      c.restore();
    }
    if (showButtons) drawTouchButtons(c);
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
    c.font = 'bold 22px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BUBBLE', ab.x, ab.y);

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

  /* Click handling for menus (returns canvas coords from mouse or touch) */
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
    return {
      x: (cx - rect.left) / (rect.width / canvas.width),
      y: (cy - rect.top) / (rect.height / canvas.height)
    };
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
    /* Legacy alias – calls the new strip + buttons painter. */
    drawTouchControls: function (c) { drawTouchStrip(c, true); },
    getClickPos: getClickPos,
    isTouch: function () { return isTouchDevice; },
  };
})();
