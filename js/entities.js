/* entities.js – all game characters, enemies, projectiles, particles */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;

  /* ========== SPRITE CACHE ========== */
  var spriteCache = {};
  function getCachedSprite(key, w, h, drawFn) {
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');
    drawFn(cx);
    spriteCache[key] = c;
    return c;
  }

  /* Flip a sprite horizontally */
  function flipSprite(key, src) {
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var cx = c.getContext('2d');
    cx.translate(c.width, 0);
    cx.scale(-1, 1);
    cx.drawImage(src, 0, 0);
    spriteCache[key] = c;
    return c;
  }

  /* ========== MOMOKO (Player) ========== */
  function Momoko(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 34;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; /* 1=right, -1=left */
    this.health = 5;
    this.maxHealth = 5;
    this.invincible = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.shootCooldown = 0;
    this.alive = true;
  }

  Momoko.SWIM_FORCE = 0.45;
  Momoko.MAX_VEL = 3.2;
  Momoko.GRAVITY = 0.12;
  Momoko.FRICTION = 0.94;
  Momoko.INVINCIBLE_TIME = 90; /* frames (~1.5s) */
  Momoko.SHOOT_CD = 12;

  Momoko.prototype.update = function (keys, level) {
    if (!this.alive) return;

    /* Swimming */
    if (keys.left) { this.vx -= Momoko.SWIM_FORCE; this.facing = -1; }
    if (keys.right) { this.vx += Momoko.SWIM_FORCE; this.facing = 1; }
    if (keys.up) this.vy -= Momoko.SWIM_FORCE;
    if (keys.down) this.vy += Momoko.SWIM_FORCE;

    /* Gravity (gentle sinking) */
    this.vy += Momoko.GRAVITY;

    /* Friction */
    this.vx *= Momoko.FRICTION;
    this.vy *= Momoko.FRICTION;

    /* Clamp velocity */
    var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > Momoko.MAX_VEL) {
      this.vx = (this.vx / speed) * Momoko.MAX_VEL;
      this.vy = (this.vy / speed) * Momoko.MAX_VEL;
    }

    /* Apply velocity */
    this.x += this.vx;
    this.y += this.vy;

    /* World bounds */
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.width) { this.x = level.width - this.w; this.vx = 0; }
    if (this.y + this.h > level.floorY) { this.y = level.floorY - this.h; this.vy = 0; }

    /* Platform collision */
    for (var i = 0; i < level.platforms.length; i++) {
      var p = level.platforms[i];
      if (this.x + this.w > p.x && this.x < p.x + p.w &&
          this.y + this.h > p.y && this.y < p.y + p.h) {
        /* Push out from smallest overlap side */
        var overlapL = (this.x + this.w) - p.x;
        var overlapR = (p.x + p.w) - this.x;
        var overlapT = (this.y + this.h) - p.y;
        var overlapB = (p.y + p.h) - this.y;
        var min = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (min === overlapL) { this.x = p.x - this.w; this.vx = 0; }
        else if (min === overlapR) { this.x = p.x + p.w; this.vx = 0; }
        else if (min === overlapT) { this.y = p.y - this.h; this.vy = 0; }
        else { this.y = p.y + p.h; this.vy = 0; }
      }
    }

    /* Invincibility countdown */
    if (this.invincible > 0) this.invincible--;

    /* Shoot cooldown */
    if (this.shootCooldown > 0) this.shootCooldown--;

    /* Animation */
    this.animTimer++;
    if (this.animTimer > 6) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
  };

  Momoko.prototype.shoot = function () {
    if (this.shootCooldown > 0 || !this.alive) return null;
    this.shootCooldown = Momoko.SHOOT_CD;
    Game.audio.play('bubble');
    return new Bubble(
      this.x + (this.facing === 1 ? this.w : -8),
      this.y + this.h / 2 - 4,
      this.facing
    );
  };

  Momoko.prototype.takeDamage = function () {
    if (this.invincible > 0 || !this.alive) return false;
    this.health--;
    this.invincible = Momoko.INVINCIBLE_TIME;
    Game.audio.play('damage');
    if (this.health <= 0) {
      this.alive = false;
    }
    return true;
  };

  Momoko.prototype.heal = function () {
    if (this.health < this.maxHealth) {
      this.health++;
      Game.audio.play('pickup');
      return true;
    }
    return false;
  };

  Momoko.prototype.respawn = function (x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.invincible = Momoko.INVINCIBLE_TIME;
    this.alive = true;
  };

  /* ---- Shared color helpers (hoisted so sub-painters can share) ---- */
  function hexShade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, ((n >> 16) & 255) - amt);
    var g = Math.max(0, ((n >> 8) & 255) - amt);
    var b = Math.max(0, (n & 255) - amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function hexTint(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) + amt);
    var g = Math.min(255, ((n >> 8) & 255) + amt);
    var b = Math.min(255, (n & 255) + amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Five-point star fill centered at (cx, cy) with outer radius r. */
  function fillStar(c, cx, cy, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.4;
      var px = cx + Math.cos(ang) * rr;
      var py = cy + Math.sin(ang) * rr;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  /* Shared Momoko sprite painter – called by gameplay draw and the
     customize-screen preview so both stay visually in sync.

     Precure-inspired design:
       – oversized round head with huge sparkle eyes (star-shaped catch-
         light in each pupil) and rosy blush patches
       – a peach tiara (gold band + peach gem + green leaf) crowning her
         hair, a nod to her "Peach Princess" title from the intro
       – hair with bow accents at the pigtail roots, plus alternate
         styles (long braids, twin buns with ribbon tails)
       – swappable outfits (frilly dress, sailor swimsuit, one-piece,
         classic t-shirt) and shoes (mary-jane, sneaker, flipper)
       – optional held food in the left hand (ice-cream, onigiri, donut)

     Crab companion lives outside this painter so it can follow the
     player in world space – see drawCrabPet. */
  function drawMomokoSprite(c, sx, sy, cust, frame) {
    var hairC = (cust && cust.hair) || '#e06088';
    var suitC = (cust && cust.suit) || '#e06088';
    var skinC = (cust && cust.skin) || '#ffddbb';
    var shoeC = (cust && cust.flipper) || '#ff99cc';
    var hairStyle = (cust && cust.hairStyle) || 'twinTails';
    var outfit = (cust && cust.outfit) || 'frillyDress';
    var shoeStyle = (cust && cust.shoes) || 'maryJane';
    var food = (cust && cust.food) || 'none';
    var f = frame || 0;
    var kick = Math.sin(f * 1.5) * 2;

    var hairShade = hexShade(hairC, 40);
    var suitShade = hexShade(suitC, 35);
    var suitLight = hexTint(suitC, 40);

    /* ---------- Legs / tights ---------- */
    /* Under the frilly dress she wears light tights; other outfits show
       dark leggings/pants so her silhouette still reads against any
       background. */
    c.fillStyle = outfit === 'frillyDress' || outfit === 'sailorDress'
      ? '#ffe8ee' : '#3a2a18';
    c.fillRect(sx + 9, sy + 25, 4, 7);
    c.fillRect(sx + 15, sy + 25, 4, 7);

    /* ---------- Shoes ---------- */
    function drawShoe(cx, cy) {
      if (shoeStyle === 'flipper') {
        c.fillStyle = shoeC;
        c.beginPath();
        c.ellipse(cx, cy, 3.2, 1.7, 0, 0, Math.PI * 2);
        c.fill();
      } else if (shoeStyle === 'sneaker') {
        c.fillStyle = shoeC;
        c.fillRect(cx - 3, cy - 1.6, 6, 2.4);
        c.fillStyle = '#ffffff';
        c.fillRect(cx - 3, cy + 0.4, 6, 0.9);
        c.fillStyle = hexShade(shoeC, 50);
        c.fillRect(cx - 3, cy + 1.1, 6, 0.5);
      } else {
        /* maryJane (default) */
        c.fillStyle = shoeC;
        c.beginPath();
        c.ellipse(cx, cy + 0.2, 3.2, 1.9, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = hexShade(shoeC, 30);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(cx - 2.2, cy - 0.6);
        c.lineTo(cx + 2.2, cy - 0.6);
        c.stroke();
        c.fillStyle = '#fff4aa';
        c.beginPath();
        c.arc(cx, cy - 0.6, 0.55, 0, Math.PI * 2);
        c.fill();
      }
    }
    drawShoe(sx + 11, sy + 33 + kick * 0.3);
    drawShoe(sx + 17, sy + 33 - kick * 0.3);

    /* ---------- Back hair mass ---------- */
    c.fillStyle = hairShade;
    c.beginPath();
    c.moveTo(sx + 3, sy + 9);
    c.bezierCurveTo(sx - 1, sy + 20, sx + 1, sy + 27, sx + 5, sy + 30);
    c.lineTo(sx + 23, sy + 30);
    c.bezierCurveTo(sx + 27, sy + 27, sx + 29, sy + 20, sx + 25, sy + 9);
    c.closePath();
    c.fill();

    /* ---------- Hairstyle variant ---------- */
    if (hairStyle === 'longBraids') {
      /* Braided pigtails – stacked lozenges form a zigzag down each side */
      for (var side = 0; side < 2; side++) {
        var bx = side === 0 ? sx + 2 : sx + 26;
        c.fillStyle = hairC;
        for (var b = 0; b < 5; b++) {
          var by = sy + 10 + b * 5;
          var off = b % 2 === 0 ? -0.8 : 0.8;
          c.beginPath();
          c.ellipse(bx + off, by, 2.6, 2.9, 0, 0, Math.PI * 2);
          c.fill();
        }
        /* Ribbon tie at the end */
        c.fillStyle = suitC;
        c.beginPath();
        c.ellipse(bx, sy + 35, 1.8, 1, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else if (hairStyle === 'buns') {
      /* Twin buns on top, no long pigtails */
      c.fillStyle = hairC;
      c.beginPath(); c.arc(sx + 5, sy + 3, 4.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 23, sy + 3, 4.2, 0, Math.PI * 2); c.fill();
      /* Bun highlight swirls */
      c.strokeStyle = hairShade;
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(sx + 5, sy + 3, 2.2, 0, Math.PI * 1.5); c.stroke();
      c.beginPath(); c.arc(sx + 23, sy + 3, 2.2, 0, Math.PI * 1.5); c.stroke();
      /* Ribbon tails hanging beside the head */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 4, sy + 6);
      c.quadraticCurveTo(sx + 0, sy + 14, sx + 2, sy + 24);
      c.lineTo(sx + 5, sy + 24);
      c.quadraticCurveTo(sx + 5, sy + 14, sx + 7, sy + 6);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(sx + 24, sy + 6);
      c.quadraticCurveTo(sx + 28, sy + 14, sx + 26, sy + 24);
      c.lineTo(sx + 23, sy + 24);
      c.quadraticCurveTo(sx + 23, sy + 14, sx + 21, sy + 6);
      c.closePath();
      c.fill();
    } else {
      /* twinTails (default) with bow accents at the roots */
      c.fillStyle = hairC;
      c.beginPath();
      c.moveTo(sx + 3, sy + 10);
      c.bezierCurveTo(sx - 3, sy + 18, sx - 2, sy + 26, sx + 1, sy + 30);
      c.bezierCurveTo(sx - 2, sy + 28, sx - 4, sy + 24, sx - 1, sy + 20);
      c.bezierCurveTo(sx + 1, sy + 16, sx + 2, sy + 12, sx + 5, sy + 11);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(sx + 25, sy + 10);
      c.bezierCurveTo(sx + 31, sy + 18, sx + 30, sy + 26, sx + 27, sy + 30);
      c.bezierCurveTo(sx + 30, sy + 28, sx + 32, sy + 24, sx + 29, sy + 20);
      c.bezierCurveTo(sx + 27, sy + 16, sx + 26, sy + 12, sx + 23, sy + 11);
      c.closePath();
      c.fill();
      /* Ribbon bows */
      function drawBow(bx, by) {
        c.fillStyle = suitC;
        c.beginPath(); c.ellipse(bx - 1.6, by, 1.6, 1.9, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(bx + 1.6, by, 1.6, 1.9, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = suitShade;
        c.beginPath(); c.arc(bx, by, 0.75, 0, Math.PI * 2); c.fill();
      }
      drawBow(sx + 4, sy + 11);
      drawBow(sx + 24, sy + 11);
    }

    /* ---------- Hair dome + face + bangs ---------- */
    c.fillStyle = hairC;
    c.beginPath();
    c.ellipse(sx + 14, sy + 6, 12, 7, 0, Math.PI, 0);
    c.fill();

    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(sx + 14, sy + 12, 8, 7.5, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(sx + 6, sy + 7);
    c.quadraticCurveTo(sx + 10, sy + 12, sx + 14, sy + 10);
    c.quadraticCurveTo(sx + 18, sy + 12, sx + 22, sy + 7);
    c.quadraticCurveTo(sx + 21, sy + 4, sx + 14, sy + 3);
    c.quadraticCurveTo(sx + 7, sy + 4, sx + 6, sy + 7);
    c.closePath();
    c.fill();
    c.beginPath(); c.ellipse(sx + 6, sy + 14, 2.2, 5, 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 22, sy + 14, 2.2, 5, -0.15, 0, Math.PI * 2); c.fill();

    /* ---------- Peach tiara ---------- */
    /* Gold band */
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(sx + 14, sy + 8, 6.5, Math.PI + 0.55, -0.55);
    c.stroke();
    /* Sparkle dots on band */
    c.fillStyle = '#fff4a8';
    c.beginPath(); c.arc(sx + 9.2, sy + 4.6, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18.8, sy + 4.6, 0.7, 0, Math.PI * 2); c.fill();
    /* Peach gem (two lobes + cleft) */
    var pcx = sx + 14, pcy = sy + 2.9;
    c.fillStyle = '#ffb8a0';
    c.beginPath(); c.arc(pcx - 0.6, pcy, 1.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(pcx + 0.6, pcy, 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff9a82';
    c.beginPath(); c.arc(pcx + 0.5, pcy + 0.6, 1.2, 0, Math.PI * 2); c.fill();
    /* Tiny green leaf + stem */
    c.fillStyle = '#5cbd5c';
    c.beginPath();
    c.ellipse(pcx - 1.5, pcy - 2.1, 1.1, 0.55, -0.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3a7a3a';
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(pcx - 0.4, pcy - 1.7);
    c.lineTo(pcx - 1.1, pcy - 2.0);
    c.stroke();
    /* Peach highlight */
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.arc(pcx - 0.9, pcy - 0.6, 0.55, 0, Math.PI * 2); c.fill();

    /* ---------- Eyes ---------- */
    /* White sclera */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 10.3, sy + 13, 2.9, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 17.7, sy + 13, 2.9, 3.6, 0, 0, Math.PI * 2); c.fill();
    /* Iris */
    c.fillStyle = '#6e3a4a';
    c.beginPath(); c.ellipse(sx + 10.3, sy + 13.3, 2.3, 3.0, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 17.7, sy + 13.3, 2.3, 3.0, 0, 0, Math.PI * 2); c.fill();
    /* Inner iris glow */
    c.fillStyle = '#b0606e';
    c.beginPath(); c.arc(sx + 10.3, sy + 13.6, 1.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17.7, sy + 13.6, 1.3, 0, Math.PI * 2); c.fill();
    /* Pupil */
    c.fillStyle = '#1a0c14';
    c.beginPath(); c.arc(sx + 10.3, sy + 13.9, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17.7, sy + 13.9, 0.7, 0, Math.PI * 2); c.fill();
    /* Star sparkle highlight */
    c.fillStyle = '#ffffff';
    fillStar(c, sx + 11, sy + 12, 1.2);
    fillStar(c, sx + 18.4, sy + 12, 1.2);
    /* Secondary round highlight */
    c.beginPath(); c.arc(sx + 9.5, sy + 14.3, 0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16.9, sy + 14.3, 0.5, 0, Math.PI * 2); c.fill();

    /* Eyelashes – upper arc + outer flicks */
    c.strokeStyle = '#1a0c14';
    c.lineWidth = 0.9;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 7.8, sy + 10.8); c.quadraticCurveTo(sx + 10.3, sy + 9.3, sx + 12.9, sy + 10.8); c.stroke();
    c.beginPath(); c.moveTo(sx + 15.1, sy + 10.8); c.quadraticCurveTo(sx + 17.7, sy + 9.3, sx + 20.2, sy + 10.8); c.stroke();
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(sx + 7.8, sy + 10.8); c.lineTo(sx + 6.9, sy + 10.0); c.stroke();
    c.beginPath(); c.moveTo(sx + 20.2, sy + 10.8); c.lineTo(sx + 21.1, sy + 10.0); c.stroke();

    /* ---------- Blush + mouth ---------- */
    c.fillStyle = 'rgba(255,160,190,0.78)';
    c.beginPath(); c.ellipse(sx + 7.5, sy + 15.9, 2.2, 1.3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 20.5, sy + 15.9, 2.2, 1.3, 0, 0, Math.PI * 2); c.fill();

    c.strokeStyle = '#b24a5a';
    c.lineWidth = 0.95;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(sx + 14, sy + 17, 1.3, 0.2, Math.PI - 0.2);
    c.stroke();

    /* ---------- Neck ---------- */
    c.fillStyle = skinC;
    c.fillRect(sx + 12, sy + 18.5, 4, 1.5);

    /* ---------- Outfit ---------- */
    if (outfit === 'frillyDress' || outfit === 'sailorDress' || outfit === 'starDress') {
      /* Bodice */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 7, sy + 21);
      c.quadraticCurveTo(sx + 10, sy + 19.5, sx + 14, sy + 20.2);
      c.quadraticCurveTo(sx + 18, sy + 19.5, sx + 21, sy + 21);
      c.lineTo(sx + 20, sy + 25);
      c.lineTo(sx + 8, sy + 25);
      c.closePath();
      c.fill();
      if (outfit === 'frillyDress') {
        /* Lace collar + heart gem */
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(sx + 10, sy + 20);
        c.quadraticCurveTo(sx + 14, sy + 22, sx + 18, sy + 20);
        c.lineTo(sx + 17.5, sy + 21);
        c.quadraticCurveTo(sx + 14, sy + 23, sx + 10.5, sy + 21);
        c.closePath();
        c.fill();
        var hcx = sx + 14, hcy = sy + 22.6;
        c.fillStyle = '#ff5577';
        c.beginPath();
        c.arc(hcx - 0.6, hcy - 0.3, 0.65, 0, Math.PI * 2);
        c.arc(hcx + 0.6, hcy - 0.3, 0.65, 0, Math.PI * 2);
        c.moveTo(hcx - 1.15, hcy);
        c.lineTo(hcx, hcy + 1.3);
        c.lineTo(hcx + 1.15, hcy);
        c.closePath();
        c.fill();
      } else if (outfit === 'sailorDress') {
        /* Sailor-dress collar */
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(sx + 9, sy + 20.5);
        c.lineTo(sx + 14, sy + 23.5);
        c.lineTo(sx + 19, sy + 20.5);
        c.lineTo(sx + 17, sy + 20.5);
        c.lineTo(sx + 14, sy + 22.2);
        c.lineTo(sx + 11, sy + 20.5);
        c.closePath();
        c.fill();
        c.strokeStyle = suitShade;
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(sx + 10, sy + 21);
        c.lineTo(sx + 14, sy + 23);
        c.lineTo(sx + 18, sy + 21);
        c.stroke();
      } else {
        /* Star dress – gold bow at the chest and a wide star in place of
           a collar. Bodice stays the suit color for tintability. */
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.ellipse(sx + 12.4, sy + 21.2, 1.5, 1.2, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath();
        c.ellipse(sx + 15.6, sy + 21.2, 1.5, 1.2, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c88a1a';
        c.beginPath(); c.arc(sx + 14, sy + 21.2, 0.7, 0, Math.PI * 2); c.fill();
        /* Gold star medallion below the bow */
        c.fillStyle = '#fff4a8';
        fillStar(c, sx + 14, sy + 23.5, 1.4);
      }
      /* Flared skirt */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 8, sy + 25);
      c.lineTo(sx + 5, sy + 30);
      c.lineTo(sx + 23, sy + 30);
      c.lineTo(sx + 20, sy + 25);
      c.closePath();
      c.fill();
      /* Hem decoration: scalloped for frilly/sailor, star-sprinkled for
         starDress */
      if (outfit === 'starDress') {
        c.fillStyle = '#ffd24a';
        fillStar(c, sx +  7, sy + 28.5, 0.9);
        fillStar(c, sx + 11, sy + 29.4, 0.8);
        fillStar(c, sx + 15, sy + 28.2, 0.9);
        fillStar(c, sx + 19, sy + 29.3, 0.8);
        /* Silver trim along the hem */
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(sx + 5, sy + 30);
        c.lineTo(sx + 23, sy + 30);
        c.stroke();
      } else {
        c.fillStyle = '#ffffff';
        for (var s = 0; s < 5; s++) {
          var scx = sx + 6 + s * 4;
          c.beginPath(); c.arc(scx, sy + 30.5, 1.3, Math.PI, 0); c.fill();
        }
      }
      /* Skirt shading wedge */
      c.fillStyle = suitShade;
      c.beginPath();
      c.moveTo(sx + 14, sy + 25);
      c.lineTo(sx + 14, sy + 30);
      c.lineTo(sx + 18, sy + 30);
      c.lineTo(sx + 17, sy + 25);
      c.closePath();
      c.fill();
    } else if (outfit === 'frillyBikini') {
      /* Bandeau top with a frilly bottom edge */
      c.fillStyle = suitC;
      c.fillRect(sx + 8, sy + 20.8, 12, 3.4);
      c.fillStyle = '#ffffff';
      for (var fb = 0; fb < 5; fb++) {
        var fbx = sx + 9 + fb * 2.5;
        c.beginPath();
        c.arc(fbx, sy + 24.2, 1.1, Math.PI, 0);
        c.fill();
      }
      /* Center bow between the cups */
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.ellipse(sx + 13, sy + 22.2, 0.9, 0.7, -0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(sx + 15, sy + 22.2, 0.9, 0.7, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c88a1a';
      c.beginPath(); c.arc(sx + 14, sy + 22.2, 0.4, 0, Math.PI * 2); c.fill();
      /* Midriff skin shows through */
      c.fillStyle = skinC;
      c.fillRect(sx + 9, sy + 24.5, 10, 2.5);
      /* Bikini bottom with a side bow */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 8, sy + 27);
      c.quadraticCurveTo(sx + 14, sy + 28.5, sx + 20, sy + 27);
      c.lineTo(sx + 19, sy + 30);
      c.lineTo(sx + 9, sy + 30);
      c.closePath();
      c.fill();
      /* Side-tie bow on the right hip */
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.ellipse(sx + 19.5, sy + 28, 1.2, 0.9, -0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(sx + 20.5, sy + 28.5, 1.2, 0.9, 0.4, 0, Math.PI * 2); c.fill();
    } else if (outfit === 'sailorSwimsuit') {
      c.fillStyle = suitC;
      c.fillRect(sx + 8, sy + 20.5, 12, 7);
      /* Sailor collar */
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(sx + 9, sy + 20.5);
      c.lineTo(sx + 14, sy + 24);
      c.lineTo(sx + 19, sy + 20.5);
      c.lineTo(sx + 17, sy + 20.5);
      c.lineTo(sx + 14, sy + 22.5);
      c.lineTo(sx + 11, sy + 20.5);
      c.closePath();
      c.fill();
      c.strokeStyle = suitShade;
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(sx + 9.5, sy + 21);
      c.lineTo(sx + 14, sy + 23.5);
      c.lineTo(sx + 18.5, sy + 21);
      c.stroke();
      /* Neck bow */
      c.fillStyle = '#ff4466';
      c.beginPath(); c.ellipse(sx + 13, sy + 23.5, 1.3, 1, -0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(sx + 15, sy + 23.5, 1.3, 1, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cc3344';
      c.beginPath(); c.arc(sx + 14, sy + 23.5, 0.5, 0, Math.PI * 2); c.fill();
      /* Swim-bottom (high-leg) */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 8, sy + 27);
      c.lineTo(sx + 10, sy + 30);
      c.lineTo(sx + 18, sy + 30);
      c.lineTo(sx + 20, sy + 27);
      c.closePath();
      c.fill();
    } else if (outfit === 'onePiece') {
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 9, sy + 20.5);
      c.quadraticCurveTo(sx + 14, sy + 19, sx + 19, sy + 20.5);
      c.lineTo(sx + 19, sy + 29);
      c.quadraticCurveTo(sx + 14, sy + 30.5, sx + 9, sy + 29);
      c.closePath();
      c.fill();
      /* Ruffle trim across the top */
      c.fillStyle = suitLight;
      c.beginPath();
      c.moveTo(sx + 9, sy + 20.5);
      c.quadraticCurveTo(sx + 14, sy + 19.2, sx + 19, sy + 20.5);
      c.lineTo(sx + 19, sy + 21.3);
      c.quadraticCurveTo(sx + 14, sy + 20, sx + 9, sy + 21.3);
      c.closePath();
      c.fill();
      /* Star motif on belly */
      c.fillStyle = '#fff4a8';
      fillStar(c, sx + 14, sy + 24.5, 1.4);
    } else {
      /* Classic t-shirt */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 7, sy + 21);
      c.quadraticCurveTo(sx + 10, sy + 19.5, sx + 14, sy + 20.2);
      c.quadraticCurveTo(sx + 18, sy + 19.5, sx + 21, sy + 21);
      c.lineTo(sx + 21, sy + 26);
      c.lineTo(sx + 7, sy + 26);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.beginPath();
      c.moveTo(sx + 12, sy + 20);
      c.quadraticCurveTo(sx + 14, sy + 21.5, sx + 16, sy + 20);
      c.lineTo(sx + 16, sy + 20.5);
      c.quadraticCurveTo(sx + 14, sy + 22, sx + 12, sy + 20.5);
      c.closePath();
      c.fill();
    }

    /* ---------- Arms ---------- */
    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(sx + 5.5, sy + 24, 1.7, 2.8, 0.1, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 23, sy + 23, 2.3, 1.9, -0.2, 0, Math.PI * 2);
    c.fill();

    /* ---------- Magical-girl bubble wand ----------
       Pink handle with a gold band + heart detail, then a gold shaft
       tipped with a yellow star gem so it reads as a precure wand at
       a glance rather than a weapon. Extends past the sprite's 28px
       footprint which is fine – her hit-box is unchanged. */
    /* Handle */
    c.fillStyle = '#ff99cc';
    c.beginPath();
    c.ellipse(sx + 26.4, sy + 23, 2.2, 2.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hexShade('#ff99cc', 30);
    c.beginPath();
    c.ellipse(sx + 26.4, sy + 24.5, 1.6, 0.9, 0, 0, Math.PI * 2);
    c.fill();
    /* Gold band around the grip */
    c.fillStyle = '#ffd24a';
    c.fillRect(sx + 27.7, sy + 21.8, 1.3, 2.4);
    /* Tiny heart on handle */
    c.fillStyle = '#ff3366';
    var hhx = sx + 26.3, hhy = sy + 23.2;
    c.beginPath();
    c.arc(hhx - 0.45, hhy - 0.3, 0.45, 0, Math.PI * 2);
    c.arc(hhx + 0.45, hhy - 0.3, 0.45, 0, Math.PI * 2);
    c.moveTo(hhx - 0.85, hhy);
    c.lineTo(hhx, hhy + 0.9);
    c.lineTo(hhx + 0.85, hhy);
    c.closePath();
    c.fill();
    /* Gold shaft */
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 29, sy + 23);
    c.lineTo(sx + 33.5, sy + 23);
    c.stroke();
    /* Star gem at the tip */
    c.fillStyle = '#ffffff';
    fillStar(c, sx + 35, sy + 23, 2.2);
    c.fillStyle = '#ffe066';
    fillStar(c, sx + 35, sy + 23, 1.6);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 35.4, sy + 22.3, 0.5, 0, Math.PI * 2); c.fill();
    /* Sparkle dots around the tip */
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.arc(sx + 37.2, sy + 21.5, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 37.5, sy + 24.4, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 33.5, sy + 21.2, 0.3, 0, Math.PI * 2); c.fill();

    /* ---------- Held food (left hand) ---------- */
    if (food !== 'none') {
      var fx = sx + 4, fy = sy + 22;
      if (food === 'iceCream') {
        c.fillStyle = '#e0b070';
        c.beginPath();
        c.moveTo(fx - 1.5, fy + 2);
        c.lineTo(fx + 1.5, fy + 2);
        c.lineTo(fx, fy + 6);
        c.closePath();
        c.fill();
        c.strokeStyle = '#9a7048';
        c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(fx - 1, fy + 2.5); c.lineTo(fx + 0.8, fy + 5); c.stroke();
        c.fillStyle = '#ffc8d4';
        c.beginPath(); c.arc(fx, fy + 1, 2.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff3355';
        c.beginPath(); c.arc(fx, fy - 1.3, 0.7, 0, Math.PI * 2); c.fill();
      } else if (food === 'onigiri') {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(fx, fy - 1.5);
        c.lineTo(fx - 2.4, fy + 2.5);
        c.lineTo(fx + 2.4, fy + 2.5);
        c.closePath();
        c.fill();
        c.fillStyle = '#2a3a2a';
        c.fillRect(fx - 2, fy + 1, 4, 1.4);
        c.fillStyle = 'rgba(255,160,180,0.6)';
        c.beginPath(); c.arc(fx - 0.9, fy + 0.5, 0.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx + 0.9, fy + 0.5, 0.4, 0, Math.PI * 2); c.fill();
      } else if (food === 'donut') {
        c.fillStyle = '#c88858';
        c.beginPath(); c.arc(fx, fy + 1, 2.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff99cc';
        c.beginPath(); c.arc(fx, fy + 1, 2.1, Math.PI + 0.3, -0.3, false); c.fill();
        c.fillStyle = '#ffe4b0';
        c.beginPath(); c.arc(fx, fy + 1, 0.75, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffff66'; c.fillRect(fx - 1, fy - 0.2, 0.4, 0.4);
        c.fillStyle = '#66ddff'; c.fillRect(fx + 0.8, fy, 0.4, 0.4);
        c.fillStyle = '#ff66aa'; c.fillRect(fx - 0.2, fy + 0.5, 0.4, 0.4);
      } else if (food === 'crepe') {
        /* Rolled cream crepe – beige cone wrap with pink cream peeking */
        c.fillStyle = '#f2d8a4';
        c.beginPath();
        c.moveTo(fx - 2, fy - 2);
        c.lineTo(fx + 2, fy - 2);
        c.lineTo(fx, fy + 4);
        c.closePath();
        c.fill();
        /* Cream */
        c.fillStyle = '#ffdceb';
        c.beginPath(); c.arc(fx, fy - 1.8, 1.4, Math.PI, 0); c.fill();
        /* Berry */
        c.fillStyle = '#dd3355';
        c.beginPath(); c.arc(fx - 0.6, fy - 2.2, 0.55, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a5d2a';
        c.fillRect(fx - 0.8, fy - 2.7, 0.4, 0.4);
      } else if (food === 'taiyaki') {
        /* Fish-shaped pastry */
        c.fillStyle = '#cc8844';
        c.beginPath();
        c.ellipse(fx, fy + 1, 3, 1.8, 0, 0, Math.PI * 2);
        c.fill();
        /* Tail fin */
        c.beginPath();
        c.moveTo(fx + 2.5, fy + 1);
        c.lineTo(fx + 4, fy - 0.5);
        c.lineTo(fx + 4, fy + 2.5);
        c.closePath();
        c.fill();
        /* Side highlight */
        c.fillStyle = '#e0a868';
        c.beginPath(); c.ellipse(fx - 0.5, fy + 0.3, 1.6, 0.5, 0, 0, Math.PI * 2); c.fill();
        /* Eye */
        c.fillStyle = '#1a0c14';
        c.beginPath(); c.arc(fx - 1.8, fy + 0.5, 0.3, 0, Math.PI * 2); c.fill();
        /* Scale line */
        c.strokeStyle = '#8a5520';
        c.lineWidth = 0.3;
        c.beginPath();
        c.moveTo(fx - 1, fy + 0.2); c.lineTo(fx + 1.5, fy + 0.2);
        c.stroke();
      } else if (food === 'parfait') {
        /* Glass with stacked layers, cream swirl on top */
        /* Glass cup */
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 0.4;
        c.strokeRect(fx - 1.6, fy - 1.5, 3.2, 5);
        /* Chocolate layer (bottom) */
        c.fillStyle = '#6b3a1a';
        c.fillRect(fx - 1.4, fy + 2, 2.8, 1.3);
        /* Cream layer */
        c.fillStyle = '#fff4dc';
        c.fillRect(fx - 1.4, fy + 0.7, 2.8, 1.3);
        /* Strawberry layer */
        c.fillStyle = '#ff6688';
        c.fillRect(fx - 1.4, fy - 0.6, 2.8, 1.3);
        /* Whipped cream swirl */
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(fx, fy - 1.8, 1.3, Math.PI, 0); c.fill();
        c.beginPath(); c.arc(fx - 0.5, fy - 2.3, 0.7, Math.PI, 0); c.fill();
        c.beginPath(); c.arc(fx + 0.3, fy - 2.6, 0.5, Math.PI, 0); c.fill();
        /* Cherry */
        c.fillStyle = '#dd2244';
        c.beginPath(); c.arc(fx + 0.6, fy - 2.9, 0.5, 0, Math.PI * 2); c.fill();
      } else if (food === 'macaron') {
        /* Two pastel shells with a cream filling */
        c.fillStyle = '#ffbadb';
        c.beginPath();
        c.ellipse(fx, fy - 0.8, 2.4, 1.1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(fx - 2.4, fy - 0.1, 4.8, 0.9);
        c.fillStyle = '#ff9ac2';
        c.beginPath();
        c.ellipse(fx, fy + 1.3, 2.4, 1.1, 0, 0, Math.PI * 2);
        c.fill();
        /* Top sheen */
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath();
        c.ellipse(fx - 0.8, fy - 1, 1, 0.3, 0, 0, Math.PI * 2);
        c.fill();
      } else if (food === 'strawberry') {
        /* Red cone with leafy cap and seed dots */
        c.fillStyle = '#e8344a';
        c.beginPath();
        c.moveTo(fx - 2, fy - 1);
        c.quadraticCurveTo(fx, fy + 4, fx + 2, fy - 1);
        c.closePath();
        c.fill();
        /* Seeds */
        c.fillStyle = '#fff4a8';
        c.beginPath(); c.arc(fx - 0.8, fy + 0.5, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx + 0.6, fy + 0.3, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx, fy + 1.6, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx - 1.1, fy + 1.9, 0.25, 0, Math.PI * 2); c.fill();
        /* Green cap */
        c.fillStyle = '#3caf3c';
        c.beginPath();
        c.moveTo(fx - 2.2, fy - 1);
        c.lineTo(fx - 0.6, fy - 1.8);
        c.lineTo(fx + 0.6, fy - 1.8);
        c.lineTo(fx + 2.2, fy - 1);
        c.lineTo(fx, fy - 0.2);
        c.closePath();
        c.fill();
      }
    }
  }

  /* Crab companion – drawn separately so it can follow the player at an
     offset from the main sprite bounding box. `variant` picks the shell
     palette (red/blue/gold) or 'none' to skip entirely. */
  function drawCrabPet(c, px, py, variant, frame) {
    if (!variant || variant === 'none') return;
    var body, claw;
    if (variant === 'blue') { body = '#4477cc'; claw = '#335599'; }
    else if (variant === 'gold') { body = '#ffcc44'; claw = '#cc9922'; }
    else { body = '#dd4444'; claw = '#aa2222'; }
    var wobble = Math.sin((frame || 0) * 0.25) * 0.8;
    /* Shell */
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(px, py, 5, 3.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(px - 1.2, py - 1, 1.6, 0.8, 0, 0, Math.PI * 2);
    c.fill();
    /* Claws */
    c.fillStyle = claw;
    c.beginPath(); c.arc(px - 5, py - 1 + wobble, 1.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px + 5, py - 1 - wobble, 1.9, 0, Math.PI * 2); c.fill();
    /* Eye stalks */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(px - 1.5, py - 2.6, 0.85, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px + 1.5, py - 2.6, 0.85, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(px - 1.5, py - 2.6, 0.35, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px + 1.5, py - 2.6, 0.35, 0, Math.PI * 2); c.fill();
    /* Legs */
    c.strokeStyle = claw;
    c.lineWidth = 0.7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px - 3, py + 2); c.lineTo(px - 4, py + 3.8);
    c.moveTo(px + 3, py + 2); c.lineTo(px + 4, py + 3.8);
    c.moveTo(px - 1.5, py + 2.8); c.lineTo(px - 2, py + 4.4);
    c.moveTo(px + 1.5, py + 2.8); c.lineTo(px + 2, py + 4.4);
    c.stroke();
  }

  Momoko.prototype.draw = function (c, camX, camY) {
    if (!this.alive) return;
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;

    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var cust = window.Game.customization || {};

    c.save();
    if (this.facing === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }
    drawMomokoSprite(c, sx, sy, cust, this.animFrame);
    /* Crab pet trails at foot level; drawn inside the flip transform so
       it stays on the side opposite the facing direction (i.e. behind
       her as she swims). */
    if (cust.crab && cust.crab !== 'none') {
      drawCrabPet(c, sx - 8, sy + 32, cust.crab, this.animTimer);
    }
    c.restore();
  };

  /* Floss-dance Momoko – arms swing rigid across the body while the hips
     tilt the opposite direction on each beat. Phase is in radians so the
     caller can drive it off a timer. Drawn at the same 28×34 footprint
     so it drops into the existing sprite slot. */
  function drawMomokoFloss(c, sx, sy, cust, phase) {
    var hairC = (cust && cust.hair) || '#e06088';
    var shirtC = (cust && cust.suit) || '#3366aa';
    var skinC = (cust && cust.skin) || '#ffddbb';
    var shoeC = (cust && cust.flipper) || '#33bb77';
    /* Soft-clamped sigmoid (tanh of a boosted sine) gives sharp pose
       changes at each beat with smooth in-betweens so the move reads
       as floss instead of a lazy hula. beat ∈ [-1, 1]. */
    var beat = Math.tanh(Math.sin(phase) * 3.2);
    var hipShift = beat * 2.5;
    var bodyTilt = beat * 0.05;

    /* Floss arms: both hands swing to the side opposite the hips. The
       arm whose shoulder is on the FAR side of the swing crosses in
       FRONT of the chest at chest height; the arm on the NEAR side
       extends out at hip height BEHIND the body. Shoulder x's slide
       smoothly with the beat so the arms pass through the center at
       each transition. */
    var armDir = -beat;
    var crossShX = 14 - armDir * 5;
    var extShX   = 14 + armDir * 5;
    var crossHandX = 14 + armDir * 10;
    var crossHandY = 21;
    var extHandX   = 14 + armDir * 12;
    var extHandY   = 27;

    c.save();
    c.translate(sx + 14, sy + 22);
    c.rotate(bodyTilt);
    c.translate(-14, -22);

    /* Pants – shifted by hip motion */
    c.fillStyle = '#3a2a18';
    c.fillRect(9 + hipShift, 25, 4, 7);
    c.fillRect(15 + hipShift, 25, 4, 7);

    /* Shoes */
    c.fillStyle = shoeC;
    c.beginPath();
    c.ellipse(11 + hipShift, 33, 3, 1.6, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(17 + hipShift, 33, 3, 1.6, 0, 0, Math.PI * 2);
    c.fill();

    /* Back hair – swings opposite to hips for floss feel */
    function darken(hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.max(0, ((n >> 16) & 255) - amt);
      var g = Math.max(0, ((n >> 8) & 255) - amt);
      var b = Math.max(0, (n & 255) - amt);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    c.fillStyle = darken(hairC, 40);
    c.beginPath();
    c.moveTo(3 - beat, 9);
    c.bezierCurveTo(-1 - beat, 20, 1 - beat, 27, 5 - beat, 30);
    c.lineTo(23 - beat, 30);
    c.bezierCurveTo(27 - beat, 27, 29 - beat, 20, 25 - beat, 9);
    c.closePath();
    c.fill();

    /* Pigtails swinging */
    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(3 - beat, 10);
    c.bezierCurveTo(-3 - beat * 2, 18, -2 - beat * 2, 26, 1 - beat * 2, 30);
    c.bezierCurveTo(-2 - beat * 2, 28, -4 - beat * 2, 24, -1 - beat * 2, 20);
    c.bezierCurveTo(1 - beat, 16, 2 - beat, 12, 5 - beat, 11);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(25 - beat, 10);
    c.bezierCurveTo(31 - beat * 2, 18, 30 - beat * 2, 26, 27 - beat * 2, 30);
    c.bezierCurveTo(30 - beat * 2, 28, 32 - beat * 2, 24, 29 - beat * 2, 20);
    c.bezierCurveTo(27 - beat, 16, 26 - beat, 12, 23 - beat, 11);
    c.closePath();
    c.fill();

    /* Crown / bangs */
    c.fillStyle = hairC;
    c.beginPath();
    c.ellipse(14, 6, 12, 7, 0, Math.PI, 0);
    c.fill();

    /* Face */
    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(14, 12, 8, 7.5, 0, 0, Math.PI * 2);
    c.fill();

    /* Front bangs */
    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(6, 7);
    c.quadraticCurveTo(10, 12, 14, 10);
    c.quadraticCurveTo(18, 12, 22, 7);
    c.quadraticCurveTo(21, 4, 14, 3);
    c.quadraticCurveTo(7, 4, 6, 7);
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(6, 14, 2.2, 5, 0.15, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(22, 14, 2.2, 5, -0.15, 0, Math.PI * 2);
    c.fill();

    /* Peach tiara – matches drawMomokoSprite so the pause pose reads as
       the same character. */
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(14, 8, 6.5, Math.PI + 0.55, -0.55);
    c.stroke();
    c.fillStyle = '#fff4a8';
    c.beginPath(); c.arc(9.2, 4.6, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(18.8, 4.6, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb8a0';
    c.beginPath(); c.arc(13.4, 2.9, 1.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14.6, 2.9, 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff9a82';
    c.beginPath(); c.arc(14.5, 3.5, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5cbd5c';
    c.beginPath();
    c.ellipse(12.5, 0.8, 1.1, 0.55, -0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.arc(13.1, 2.3, 0.55, 0, Math.PI * 2); c.fill();

    /* Eyes – closed & happy (floss joy!) */
    c.strokeStyle = '#2a1a12';
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(10.5, 13, 1.8, Math.PI + 0.2, -0.2, false);
    c.stroke();
    c.beginPath();
    c.arc(17.5, 13, 1.8, Math.PI + 0.2, -0.2, false);
    c.stroke();

    /* Blush */
    c.fillStyle = 'rgba(255,170,195,0.65)';
    c.beginPath(); c.arc(8, 15.5, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(20, 15.5, 1.6, 0, Math.PI * 2); c.fill();

    /* Big grinning mouth */
    c.fillStyle = '#b24a5a';
    c.beginPath();
    c.arc(14, 16.5, 2, 0, Math.PI);
    c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(12.5, 16.4, 3, 0.9);

    /* Neck */
    c.fillStyle = skinC;
    c.fillRect(12, 18.5, 4, 1.5);

    /* Back (extending) arm — drawn before the shirt so it reads as
       passing behind the body. */
    c.strokeStyle = skinC;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(extShX, 24);
    c.lineTo(extHandX, extHandY);
    c.stroke();
    c.fillStyle = skinC;
    c.beginPath(); c.arc(extHandX, extHandY, 1.8, 0, Math.PI * 2); c.fill();

    /* Shirt */
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(7, 21);
    c.quadraticCurveTo(10, 19.5, 14, 20.2);
    c.quadraticCurveTo(18, 19.5, 21, 21);
    c.lineTo(21, 26);
    c.lineTo(7, 26);
    c.closePath();
    c.fill();

    /* Front (crossing) arm — drawn after the shirt so it visually
       sweeps across the chest from the far shoulder to the near hand. */
    c.strokeStyle = skinC;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(crossShX, 22);
    c.lineTo(crossHandX, crossHandY);
    c.stroke();
    c.fillStyle = skinC;
    c.beginPath(); c.arc(crossHandX, crossHandY, 1.8, 0, Math.PI * 2); c.fill();

    c.restore();
  }

  /* ========== BUBBLE (Projectile) ========== */
  function Bubble(x, y, dir) {
    this.x = x;
    this.y = y;
    this.r = 6;
    this.dir = dir;
    this.speed = 5;
    this.life = 90; /* frames */
    this.active = true;
    this.hue = Math.random() * 360;
    this.wobble = Math.random() * Math.PI * 2;
  }

  Bubble.prototype.update = function () {
    this.x += this.speed * this.dir;
    this.wobble += 0.15;
    this.y += Math.sin(this.wobble) * 0.8;
    this.hue = (this.hue + 5) % 360;
    this.life--;
    if (this.life <= 0) this.active = false;
  };

  Bubble.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = this.x - camX;
    var sy = this.y - camY;
    var r = this.r;
    c.save();
    /* Soap-bubble shading: nearly clear centre, tinted rim, a glossy
       highlight and a tiny reflection – reads as a bubble rather than a
       flat coloured dot. */
    var g = c.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
    g.addColorStop(0, 'hsla(' + this.hue + ',90%,85%,0.25)');
    g.addColorStop(0.7, 'hsla(' + this.hue + ',90%,70%,0.5)');
    g.addColorStop(1, 'hsla(' + this.hue + ',95%,65%,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(sx, sy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'hsla(' + ((this.hue + 40) % 360) + ',90%,80%,0.8)';
    c.lineWidth = 1;
    c.stroke();
    /* Highlight */
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(sx - r * 0.35, sy - r * 0.4, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath();
    c.arc(sx + r * 0.35, sy + r * 0.4, r * 0.14, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* ========== FISH (Enemy) ========== */
  /* species: 'tropical' (default, fast-swimming reef fish), 'swordfish'
     (long/fast with a bill), 'blowfish' (round/slow, spiky, 2 HP),
     'clownfish' (orange with white stripes), 'angelfish' (tall/thin with
     trailing fins). Appearance, size, hp, and speed vary per species so
     levels can mix them for visual and gameplay variety. */
  function Fish(x, y, pattern, dir, species) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.species = species || 'tropical';
    this.pattern = pattern || 'sine';
    this.dir = dir || -1;
    this.timer = Math.random() * 100;
    this.active = true;
    this.flash = 0;

    if (this.species === 'swordfish') {
      this.w = 36; this.h = 14;
      this.hp = 2;
      this.speed = 1.8;
      this.color = '#4f7fa8';
    } else if (this.species === 'blowfish') {
      this.w = 26; this.h = 24;
      this.hp = 2;
      this.speed = 0.7;
      this.color = '#d9b24a';
    } else if (this.species === 'clownfish') {
      this.w = 24; this.h = 16;
      this.hp = 1;
      this.speed = 1.4;
      this.color = '#ff7a22';
    } else if (this.species === 'angelfish') {
      this.w = 22; this.h = 22;
      this.hp = 1;
      this.speed = 1.0;
      this.color = '#f2d36b';
    } else {
      /* tropical */
      this.w = 24; this.h = 16;
      this.hp = 1;
      this.speed = 1.2;
      this.color = ['#ee4444', '#44bb44', '#4488ee', '#eeaa22'][Math.floor(Math.random() * 4)];
    }
  }

  Fish.prototype.update = function () {
    if (!this.active) return;
    this.timer++;
    if (this.flash > 0) this.flash--;

    if (this.pattern === 'sine') {
      this.x += this.speed * this.dir;
      this.y = this.spawnY + Math.sin(this.timer * 0.04) * 40;
    } else {
      this.x += this.speed * this.dir;
    }

    /* Reverse if too far from spawn */
    if (Math.abs(this.x - this.spawnX) > 150) {
      this.dir *= -1;
    }
  };

  Fish.prototype.hit = function () {
    this.hp--;
    this.flash = 6;
    if (this.hp <= 0) {
      this.active = false;
      Game.audio.play('enemyDefeat');
      return true;
    }
    Game.audio.play('enemyHit');
    return false;
  };

  Fish.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();
    if (this.dir === 1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    if (this.flash > 0 && this.flash % 2 === 0) { c.restore(); return; }

    if (this.species === 'swordfish') drawSwordfish(c, sx, sy, this.color, this.timer);
    else if (this.species === 'blowfish') drawBlowfish(c, sx, sy, this.color, this.timer);
    else if (this.species === 'clownfish') drawClownfish(c, sx, sy, this.timer);
    else if (this.species === 'angelfish') drawAngelfish(c, sx, sy, this.color, this.timer);
    else drawTropicalFish(c, sx, sy, this.color);

    c.restore();
  };

  /* Shared fish eye: white, dark iris set slightly forward, highlight. */
  function fishEye(c, x, y, r) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#101820';
    c.beginPath(); c.arc(x - r * 0.2, y, r * 0.55, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x - r * 0.45, y - r * 0.4, r * 0.25, 0, Math.PI * 2); c.fill();
  }

  function drawTropicalFish(c, sx, sy, color) {
    var dark = hexShade(color, 50), light = hexTint(color, 60);
    /* Forked tail first so the body overlaps its root */
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(sx + 21, sy + 8);
    c.quadraticCurveTo(sx + 25, sy + 3, sx + 29, sy + 1);
    c.quadraticCurveTo(sx + 26, sy + 8, sx + 29, sy + 15);
    c.quadraticCurveTo(sx + 25, sy + 13, sx + 21, sy + 8);
    c.closePath();
    c.fill();
    /* Dorsal sail and ventral fin */
    c.beginPath();
    c.moveTo(sx + 8, sy + 3);
    c.quadraticCurveTo(sx + 12, sy - 5, sx + 19, sy + 3);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 11, sy + 13);
    c.quadraticCurveTo(sx + 13, sy + 18, sx + 18, sy + 13);
    c.closePath();
    c.fill();
    /* Body – lit from above */
    var g = c.createLinearGradient(0, sy + 1, 0, sy + 15);
    g.addColorStop(0, light);
    g.addColorStop(0.5, color);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 12, sy + 8, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    /* Pale belly */
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(sx + 11, sy + 11, 8, 3, 0, 0, Math.PI * 2);
    c.fill();
    /* Gill curve and pectoral fin */
    c.strokeStyle = dark;
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(sx + 5, sy + 8, 4.5, -0.9, 0.9);
    c.stroke();
    c.fillStyle = hexShade(color, 20);
    c.beginPath();
    c.moveTo(sx + 10, sy + 9);
    c.quadraticCurveTo(sx + 15, sy + 9, sx + 16, sy + 13);
    c.quadraticCurveTo(sx + 12, sy + 13, sx + 10, sy + 9);
    c.closePath();
    c.fill();
    /* Mouth and eye */
    c.strokeStyle = dark;
    c.beginPath();
    c.moveTo(sx + 0.5, sy + 9);
    c.lineTo(sx + 3, sy + 9.5);
    c.stroke();
    fishEye(c, sx + 6, sy + 6, 2.6);
  }

  function drawSwordfish(c, sx, sy, color, timer) {
    var dark = hexShade(color, 40), light = hexTint(color, 70);
    /* Crescent tail */
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(sx + 31, sy + 7);
    c.quadraticCurveTo(sx + 36, sy + 1, sx + 40, sy - 3);
    c.quadraticCurveTo(sx + 36, sy + 7, sx + 40, sy + 17);
    c.quadraticCurveTo(sx + 36, sy + 13, sx + 31, sy + 7);
    c.closePath();
    c.fill();
    /* Tall sail-like dorsal fin, swept back */
    c.beginPath();
    c.moveTo(sx + 9, sy + 3);
    c.quadraticCurveTo(sx + 14, sy - 7, sx + 24, sy - 4);
    c.quadraticCurveTo(sx + 26, sy + 1, sx + 27, sy + 4);
    c.closePath();
    c.fill();
    /* Streamlined spindle body */
    var g = c.createLinearGradient(0, sy + 2, 0, sy + 12);
    g.addColorStop(0, light);
    g.addColorStop(0.45, color);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx + 2, sy + 7);
    c.quadraticCurveTo(sx + 12, sy - 1, sx + 24, sy + 2);
    c.quadraticCurveTo(sx + 30, sy + 4, sx + 33, sy + 7);
    c.quadraticCurveTo(sx + 30, sy + 10, sx + 24, sy + 12);
    c.quadraticCurveTo(sx + 12, sy + 15, sx + 2, sy + 7);
    c.closePath();
    c.fill();
    /* Silver belly */
    c.fillStyle = 'rgba(230, 240, 250, 0.55)';
    c.beginPath();
    c.moveTo(sx + 4, sy + 8);
    c.quadraticCurveTo(sx + 14, sy + 14, sx + 28, sy + 10);
    c.quadraticCurveTo(sx + 16, sy + 11, sx + 4, sy + 8);
    c.closePath();
    c.fill();
    /* Pectoral fin */
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(sx + 11, sy + 8);
    c.quadraticCurveTo(sx + 16, sy + 9, sx + 20, sy + 14);
    c.quadraticCurveTo(sx + 14, sy + 12, sx + 11, sy + 8);
    c.closePath();
    c.fill();
    /* Bill – long tapered sword */
    var bg = c.createLinearGradient(sx - 12, 0, sx + 3, 0);
    bg.addColorStop(0, '#20344a');
    bg.addColorStop(1, dark);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(sx + 3, sy + 5.2);
    c.lineTo(sx - 13, sy + 6.6);
    c.lineTo(sx + 3, sy + 8.4);
    c.closePath();
    c.fill();
    fishEye(c, sx + 7, sy + 6, 2.2);
  }

  function drawBlowfish(c, sx, sy, color, timer) {
    /* Puff up and down so it feels alive */
    var puff = 1 + Math.sin(timer * 0.06) * 0.08;
    var cx = sx + 13, cy = sy + 12;
    var r = 11 * puff;
    var dark = hexShade(color, 60), light = hexTint(color, 50);
    /* Spines – short cones, drawn behind the body */
    c.fillStyle = dark;
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 + 0.26;
      var ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath();
      c.moveTo(cx + ca * (r - 1) - sa * 1.6, cy + sa * (r - 1) + ca * 1.6);
      c.lineTo(cx + ca * (r + 4.5), cy + sa * (r + 4.5));
      c.lineTo(cx + ca * (r - 1) + sa * 1.6, cy + sa * (r - 1) - ca * 1.6);
      c.closePath();
      c.fill();
    }
    /* Little fluttering tail and side fin */
    var flut = Math.sin(timer * 0.3) * 1.5;
    c.fillStyle = hexShade(color, 25);
    c.beginPath();
    c.moveTo(cx + r - 1, cy);
    c.lineTo(cx + r + 6, cy - 4 + flut);
    c.lineTo(cx + r + 6, cy + 4 + flut);
    c.closePath();
    c.fill();
    /* Round body, lit from the upper left */
    var g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, light);
    g.addColorStop(0.6, color);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    /* Cream belly */
    c.fillStyle = 'rgba(255, 246, 214, 0.75)';
    c.beginPath();
    c.ellipse(cx - 1, cy + r * 0.45, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Spots */
    c.fillStyle = dark;
    c.beginPath(); c.arc(cx + 1, cy - 5, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 6, cy - 1, 1.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 4, cy + 4, 1.1, 0, Math.PI * 2); c.fill();
    /* Side fin */
    c.fillStyle = hexShade(color, 25);
    c.beginPath();
    c.moveTo(cx + 1, cy + 2);
    c.quadraticCurveTo(cx + 6, cy + 1 + flut, cx + 8, cy + 6 + flut);
    c.quadraticCurveTo(cx + 4, cy + 6, cx + 1, cy + 2);
    c.closePath();
    c.fill();
    /* Big worried eye and pouty 'o' mouth */
    fishEye(c, cx - 5, cy - 2.5, 3);
    c.fillStyle = '#663311';
    c.beginPath();
    c.ellipse(cx - 9.5, cy + 3, 1.6, 2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c05a50';
    c.beginPath();
    c.ellipse(cx - 9.5, cy + 3.3, 0.9, 1.2, 0, 0, Math.PI * 2);
    c.fill();
  }

  function drawClownfish(c, sx, sy, timer) {
    var body = '#ff7a22', dark = '#b84a10', light = '#ffb070';
    var flut = Math.sin(timer * 0.25) * 1.2;
    /* Rounded tail with a black edge */
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(sx + 21, sy + 8);
    c.quadraticCurveTo(sx + 26, sy, sx + 29, sy + 2);
    c.quadraticCurveTo(sx + 27, sy + 8, sx + 29, sy + 14);
    c.quadraticCurveTo(sx + 26, sy + 16, sx + 21, sy + 8);
    c.closePath();
    c.fill();
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 29, sy + 2);
    c.quadraticCurveTo(sx + 27, sy + 8, sx + 29, sy + 14);
    c.stroke();
    /* Dorsal and belly fins, black-tipped */
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(sx + 7, sy + 3);
    c.quadraticCurveTo(sx + 12, sy - 4 - flut, sx + 19, sy + 3);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 12, sy + 13);
    c.quadraticCurveTo(sx + 14, sy + 18 + flut, sx + 19, sy + 13);
    c.closePath();
    c.fill();
    c.strokeStyle = '#1a1a1a';
    c.beginPath();
    c.moveTo(sx + 7, sy + 3);
    c.quadraticCurveTo(sx + 12, sy - 4 - flut, sx + 19, sy + 3);
    c.stroke();
    /* Body */
    var g = c.createLinearGradient(0, sy + 1, 0, sy + 15);
    g.addColorStop(0, light);
    g.addColorStop(0.5, body);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 12, sy + 8, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    /* Three white bands with thin black edges */
    c.save();
    c.beginPath();
    c.ellipse(sx + 12, sy + 8, 12, 7, 0, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 6.5, sy + 8, 2.2, 9, 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 14, sy + 8, 2.4, 9, -0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 21, sy + 8, 1.6, 9, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 0.8;
    c.beginPath(); c.ellipse(sx + 6.5, sy + 8, 2.2, 9, 0.15, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(sx + 14, sy + 8, 2.4, 9, -0.1, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(sx + 21, sy + 8, 1.6, 9, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    /* Pectoral fin */
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(sx + 9, sy + 9);
    c.quadraticCurveTo(sx + 13, sy + 9, sx + 14, sy + 13);
    c.quadraticCurveTo(sx + 11, sy + 13, sx + 9, sy + 9);
    c.closePath();
    c.fill();
    /* Mouth and eye */
    c.strokeStyle = dark;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 0.5, sy + 9);
    c.lineTo(sx + 3, sy + 9.5);
    c.stroke();
    fishEye(c, sx + 4.5, sy + 6, 2.3);
  }

  function drawAngelfish(c, sx, sy, color, timer) {
    var dark = hexShade(color, 60), light = hexTint(color, 50);
    var flut = Math.sin(timer * 0.12) * 2;
    /* Long trailing dorsal and anal fins, translucent at the tips */
    c.fillStyle = hexShade(color, 20);
    c.beginPath();
    c.moveTo(sx + 6, sy + 4);
    c.quadraticCurveTo(sx + 8, sy - 6, sx + 16 + flut, sy - 9);
    c.quadraticCurveTo(sx + 14, sy - 2, sx + 17, sy + 4);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 6, sy + 18);
    c.quadraticCurveTo(sx + 8, sy + 28, sx + 16 - flut, sy + 31);
    c.quadraticCurveTo(sx + 14, sy + 24, sx + 17, sy + 18);
    c.closePath();
    c.fill();
    /* Tail */
    c.beginPath();
    c.moveTo(sx + 18, sy + 11);
    c.quadraticCurveTo(sx + 23, sy + 4, sx + 27, sy + 3);
    c.quadraticCurveTo(sx + 25, sy + 11, sx + 27, sy + 19);
    c.quadraticCurveTo(sx + 23, sy + 18, sx + 18, sy + 11);
    c.closePath();
    c.fill();
    /* Tall disc body */
    var g = c.createLinearGradient(0, sy + 1, 0, sy + 21);
    g.addColorStop(0, light);
    g.addColorStop(0.5, color);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 11, sy + 11, 9.5, 10.5, 0, 0, Math.PI * 2);
    c.fill();
    /* Curved dark bands */
    c.save();
    c.beginPath();
    c.ellipse(sx + 11, sy + 11, 9.5, 10.5, 0, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(70, 40, 15, 0.7)';
    c.beginPath(); c.ellipse(sx + 8, sy + 11, 1.6, 12, 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 14, sy + 11, 1.8, 12, -0.08, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Long ventral streamer */
    c.strokeStyle = hexShade(color, 20);
    c.lineWidth = 1.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 8, sy + 19);
    c.quadraticCurveTo(sx + 6, sy + 26, sx + 3 - flut, sy + 29);
    c.stroke();
    /* Mouth and eye */
    c.strokeStyle = dark;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 1.5, sy + 11);
    c.lineTo(sx + 4, sy + 11.5);
    c.stroke();
    fishEye(c, sx + 5.5, sy + 8.5, 2.2);
  }

  /* ========== OCTOPUS (Enemy) ========== */
  function Octopus(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 30;
    this.hp = 2;
    this.maxHp = 2;
    this.speed = 0.5;
    this.timer = Math.random() * 200;
    this.active = true;
    this.flash = 0;
    this.tentaclePhase = 0;
  }

  Octopus.prototype.update = function () {
    if (!this.active) return;
    this.timer++;
    this.tentaclePhase += 0.08;
    if (this.flash > 0) this.flash--;

    /* Hover movement */
    this.x = this.spawnX + Math.sin(this.timer * 0.02) * 30;
    this.y = this.spawnY + Math.cos(this.timer * 0.025) * 20;
  };

  Octopus.prototype.hit = function () {
    this.hp--;
    this.flash = 8;
    if (this.hp <= 0) {
      this.active = false;
      Game.audio.play('enemyDefeat');
      return true;
    }
    Game.audio.play('enemyHit');
    return false;
  };

  Octopus.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    if (this.flash > 0 && this.flash % 2 === 0) return;
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var tp = this.tentaclePhase;

    c.save();
    c.lineCap = 'round';
    /* Tentacles – wavy bezier curves, tapering; the far four are drawn
       darker so the bunch has depth. Sucker dots sit along each one. */
    for (var i = 0; i < 8; i++) {
      var tx = sx + 3 + i * 3.5;
      var wave1 = Math.sin(tp + i * 0.8) * 6;
      var wave2 = Math.cos(tp + i * 0.5) * 4;
      var far = (i % 2 === 1);
      var x0 = tx, y0 = sy + 20;
      var x1 = tx + wave1, y1 = sy + 26;
      var x2 = tx - wave2, y2 = sy + 30;
      var x3 = tx + wave1 * 0.5, y3 = sy + 34;
      c.strokeStyle = far ? '#7a2fa8' : '#a452dc';
      c.lineWidth = 3.6 - i * 0.2;
      c.beginPath();
      c.moveTo(x0, y0);
      c.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      c.stroke();
      if (!far) {
        c.fillStyle = '#e4b3ff';
        for (var s = 1; s <= 2; s++) {
          var t = s * 0.33, mt = 1 - t;
          var bx = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
          var by = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
          c.beginPath();
          c.arc(bx, by, 0.9, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    /* Mantle – rounded head lit from the upper left */
    var g = c.createRadialGradient(sx + 10, sy + 6, 2, sx + 15, sy + 12, 17);
    g.addColorStop(0, '#d79cf5');
    g.addColorStop(0.55, '#aa55dd');
    g.addColorStop(1, '#6f2a9e');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 15, sy + 12, 15, 12, 0, 0, Math.PI * 2);
    c.fill();
    /* Lighter underside where the arms join */
    c.fillStyle = 'rgba(240, 200, 255, 0.35)';
    c.beginPath();
    c.ellipse(sx + 15, sy + 19, 11, 4, 0, 0, Math.PI * 2);
    c.fill();

    /* Spots */
    c.fillStyle = 'rgba(80, 20, 120, 0.45)';
    c.beginPath(); c.arc(sx + 6, sy + 7, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 23, sy + 6, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 3, 1.6, 0, Math.PI * 2); c.fill();

    /* Eyes – round with pupils */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 10, sy + 13, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 13, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#220033';
    c.beginPath(); c.arc(sx + 10, sy + 14, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 14, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 9.2, sy + 13.2, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19.2, sy + 13.2, 0.7, 0, Math.PI * 2); c.fill();

    /* Angry eyebrows – arcs */
    c.strokeStyle = '#220033';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx + 10, sy + 11, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.stroke();
    c.beginPath();
    c.arc(sx + 20, sy + 11, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.stroke();
    /* Small grumpy mouth */
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(sx + 15, sy + 20, 2.2, Math.PI + 0.4, Math.PI * 2 - 0.4);
    c.stroke();
    c.restore();
  };

  /* ========== MONI (Boss) ========== */
  var MONI_SCALE = 1.6;
  function Moni(x, y) {
    this.x = x;
    this.y = y;
    /* Drawn at MONI_SCALE × her original 44×60 art so she towers over
       the reef; the hitbox scales with her. */
    this.w = Math.round(44 * MONI_SCALE);
    this.h = Math.round(60 * MONI_SCALE);
    this.hp = 15;
    this.maxHp = 15;
    this.active = false; /* activated when player enters boss area */
    this.phase = 1;
    this.timer = 0;
    this.attackTimer = 0;
    this.moveTimer = 0;
    this.flash = 0;
    this.projectiles = [];
    this.tailPhase = 0;
    this.defeated = false;
    this.defeatTimer = 0;
    this.hasTaunted = false;
    this.hasTaunted2 = false;
    this.hasTaunted3 = false;
    this.hasChallenged = false;
    /* Dialogue queue – items advance when the current line's talkTimer
       expires. Each item: { speaker, text, duration }. Engine seeds this
       with pre-fight / mid-fight / post-defeat exchanges. */
    this.dialogueQueue = [];
    this.talkText = '';
    this.talkSpeaker = '';
    this.talkTimer = 0;
  }

  Moni.prototype.activate = function () {
    this.active = true;
    this.timer = 0;
  };

  Moni.prototype.update = function (playerX, playerY) {
    if (!this.active || this.defeated) {
      if (this.defeated) {
        this.defeatTimer++;
        this.y += 0.5;
      }
      return;
    }
    this.timer++;
    this.tailPhase += 0.06;
    if (this.flash > 0) this.flash--;

    /* Movement – float around */
    this.moveTimer++;
    this.x += Math.sin(this.moveTimer * 0.015) * 1.2;
    this.y += Math.cos(this.moveTimer * 0.02) * 0.8;

    /* Clamp boss position */
    if (this.y < 80) this.y = 80;
    if (this.y + this.h > 400) this.y = 400 - this.h;

    /* Phase check */
    if (this.hp <= this.maxHp * 0.5) this.phase = 2;

    /* Attack patterns. Phase-2 fire rate is intentionally a touch slower
       than the raw 40-frame cadence (44 ≈ 10% longer interval) – playtest
       feedback was that the spread shot felt too punishing at point-blank. */
    this.attackTimer++;
    var attackRate = this.phase === 1 ? 60 : 44;
    if (this.attackTimer >= attackRate) {
      this.attackTimer = 0;
      this.fireProjectiles(playerX, playerY);
    }

    /* Update projectiles */
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.projectiles.splice(i, 1);
    }
  };

  Moni.prototype.fireProjectiles = function (px, py) {
    var cx = this.x + this.w / 2;
    var cy = this.y + this.h / 2;
    if (this.phase === 1) {
      /* Aimed shot */
      var dx = px - cx;
      var dy = py - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.projectiles.push({
        x: cx, y: cy, vx: (dx / dist) * 2.5, vy: (dy / dist) * 2.5, life: 120, r: 6
      });
    } else {
      /* Spread shot */
      for (var i = -2; i <= 2; i++) {
        var angle = Math.atan2(py - cy, px - cx) + i * 0.3;
        this.projectiles.push({
          x: cx, y: cy, vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 2.5, life: 100, r: 5
        });
      }
    }
  };

  Moni.prototype.hit = function () {
    if (this.defeated) return false;
    this.hp--;
    this.flash = 8;
    Game.audio.play('enemyHit');
    if (this.hp <= 0) {
      this.defeated = true;
      this.defeatTimer = 0;
      this.projectiles = [];
      Game.audio.play('enemyDefeat');
      return true;
    }
    return false;
  };

  Moni.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    if (this.flash > 0 && this.flash % 2 === 0) {
      this.drawProjectiles(c, camX, camY);
      return;
    }

    c.save();

    /* Defeated fade */
    if (this.defeated) {
      c.globalAlpha = Math.max(0, 1 - this.defeatTimer / 120);
    }

    /* Dark-magenta aura pulsing behind her, with a few motes circling */
    var acx = sx + this.w / 2, acy = sy + this.h * 0.45;
    var pulse = 1 + Math.sin(this.timer * 0.07) * 0.08;
    var ar = this.h * 0.85 * pulse;
    var ag = c.createRadialGradient(acx, acy, ar * 0.15, acx, acy, ar);
    ag.addColorStop(0, 'rgba(170, 30, 150, 0.45)');
    ag.addColorStop(0.55, 'rgba(110, 20, 110, 0.22)');
    ag.addColorStop(1, 'rgba(70, 10, 80, 0)');
    c.fillStyle = ag;
    c.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#d24ad8';
    for (var mo = 0; mo < 6; mo++) {
      var ma = this.timer * 0.025 + mo * Math.PI / 3;
      c.globalAlpha = (0.35 + 0.25 * Math.sin(this.timer * 0.1 + mo)) * (this.defeated ? Math.max(0, 1 - this.defeatTimer / 120) : 1);
      c.beginPath();
      c.arc(acx + Math.cos(ma) * this.w * 0.62, acy + Math.sin(ma) * this.h * 0.42, 2.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    /* The body art below is authored in the original 44×60 space */
    c.translate(sx, sy);
    c.scale(MONI_SCALE, MONI_SCALE);
    sx = 0;
    sy = 0;
    var hairSway = Math.sin(this.tailPhase * 0.8 + 1) * 3;

    /* Long back hair flowing behind her shoulders */
    c.fillStyle = '#3f1a6a';
    c.beginPath();
    c.moveTo(sx + 8, sy + 4);
    c.bezierCurveTo(sx + 0 + hairSway, sy + 18, sx + 2 + hairSway * 1.6, sy + 32, sx + 4 + hairSway * 2, sy + 40);
    c.quadraticCurveTo(sx + 10 + hairSway, sy + 34, sx + 12, sy + 22);
    c.lineTo(sx + 32, sy + 22);
    c.quadraticCurveTo(sx + 34 + hairSway, sy + 34, sx + 40 + hairSway * 2, sy + 40);
    c.bezierCurveTo(sx + 42 + hairSway * 1.6, sy + 32, sx + 44 + hairSway, sy + 18, sx + 36, sy + 4);
    c.closePath();
    c.fill();

    /* Tail – flowing bezier mermaid tail */
    c.fillStyle = '#7733aa';
    var tailWave = Math.sin(this.tailPhase) * 10;
    /* The tail tip trails the mid-tail wave, so the whole fin swishes */
    var tipX = Math.sin(this.tailPhase - 0.8) * 4;
    c.beginPath();
    c.moveTo(sx + 10, sy + 36);
    c.lineTo(sx + 34, sy + 36);
    c.bezierCurveTo(sx + 34, sy + 44, sx + 30 + tailWave, sy + 50, sx + 36 + tipX, sy + 58);
    c.quadraticCurveTo(sx + 38 + tipX, sy + 62, sx + 34 + tipX, sy + 64);
    c.lineTo(sx + 10 + tipX, sy + 64);
    c.quadraticCurveTo(sx + 6 + tipX, sy + 62, sx + 8 + tipX, sy + 58);
    c.bezierCurveTo(sx + 14 + tailWave, sy + 50, sx + 10, sy + 44, sx + 10, sy + 36);
    c.closePath();
    c.fill();

    /* Tail fin */
    c.fillStyle = '#6622aa';
    var finY = tailWave * 0.6;
    c.beginPath();
    c.moveTo(sx + 16 + tipX, sy + 60);
    c.quadraticCurveTo(sx + 6 + tipX, sy + 66 + finY, sx + 1 + tipX * 1.4, sy + 65 + finY * 0.4);
    c.quadraticCurveTo(sx + 8 + tipX, sy + 60, sx + 16 + tipX, sy + 60);
    c.fill();
    c.beginPath();
    c.moveTo(sx + 28 + tipX, sy + 60);
    c.quadraticCurveTo(sx + 38 + tipX, sy + 66 - finY, sx + 43 + tipX * 1.4, sy + 65 - finY * 0.4);
    c.quadraticCurveTo(sx + 36 + tipX, sy + 60, sx + 28 + tipX, sy + 60);
    c.fill();

    /* Tail scales */
    c.fillStyle = '#6622aa';
    for (var s = 0; s < 3; s++) {
      c.beginPath();
      c.arc(sx + 16 + s * 6, sy + 42 + s * 4, 3, 0, Math.PI * 2);
      c.fill();
    }

    /* Body / torso – ellipse */
    c.fillStyle = '#bb88dd';
    c.beginPath();
    c.ellipse(sx + 22, sy + 28, 12, 8, 0, 0, Math.PI * 2);
    c.fill();

    /* Shell bra */
    c.fillStyle = '#9944cc';
    c.beginPath(); c.arc(sx + 16, sy + 24, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 24, 5, 0, Math.PI * 2); c.fill();

    /* Arms – tapered bezier */
    c.fillStyle = '#bb88dd';
    c.beginPath();
    c.moveTo(sx + 10, sy + 24);
    c.quadraticCurveTo(sx + 2, sy + 26, sx + 4, sy + 30);
    c.quadraticCurveTo(sx + 6, sy + 28, sx + 10, sy + 28);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 34, sy + 24);
    c.quadraticCurveTo(sx + 42, sy + 26, sx + 40, sy + 30);
    c.quadraticCurveTo(sx + 38, sy + 28, sx + 34, sy + 28);
    c.closePath();
    c.fill();

    /* Head – ellipse */
    c.fillStyle = '#ddbbee';
    c.beginPath();
    c.ellipse(sx + 22, sy + 12, 14, 13, 0, 0, Math.PI * 2);
    c.fill();

    /* Hair – flowing bezier strands */
    c.fillStyle = '#552288';
    c.beginPath();
    c.ellipse(sx + 22, sy + 4, 16, 8, 0, Math.PI, 0);
    c.fill();
    /* Side hair strands */
    c.beginPath();
    c.moveTo(sx + 6, sy + 6);
    c.bezierCurveTo(sx + 2 + hairSway * 0.5, sy + 12, sx + 3 + hairSway, sy + 20, sx + 6 + hairSway * 1.3, sy + 27);
    c.lineTo(sx + 10, sy + 24);
    c.bezierCurveTo(sx + 8, sy + 16, sx + 8, sy + 10, sx + 10, sy + 6);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 38, sy + 6);
    c.bezierCurveTo(sx + 42 + hairSway * 0.5, sy + 12, sx + 41 + hairSway, sy + 20, sx + 38 + hairSway * 1.3, sy + 27);
    c.lineTo(sx + 34, sy + 24);
    c.bezierCurveTo(sx + 36, sy + 16, sx + 36, sy + 10, sx + 34, sy + 6);
    c.closePath();
    c.fill();

    /* Crown – pointed arcs */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.moveTo(sx + 10, sy + 1);
    c.lineTo(sx + 14, sy - 6);
    c.quadraticCurveTo(sx + 17, sy - 2, sx + 20, sy - 8);
    c.quadraticCurveTo(sx + 22, sy - 3, sx + 24, sy - 8);
    c.quadraticCurveTo(sx + 27, sy - 2, sx + 30, sy - 6);
    c.lineTo(sx + 34, sy + 1);
    c.closePath();
    c.fill();
    /* Crown gems */
    c.fillStyle = '#cc3355';
    c.beginPath(); c.arc(sx + 15, sy - 3, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 22, sy - 5, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 29, sy - 3, 1.5, 0, Math.PI * 2); c.fill();

    /* Eyes – round */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 16, sy + 11, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 11, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#cc2244';
    c.beginPath(); c.arc(sx + 16, sy + 12, 2.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 12, 2.5, 0, Math.PI * 2); c.fill();
    /* Evil eyebrows – arcs */
    c.strokeStyle = '#552288';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx + 16, sy + 8, 5, Math.PI + 0.4, Math.PI * 2 - 0.2);
    c.stroke();
    c.beginPath();
    c.arc(sx + 28, sy + 8, 5, Math.PI + 0.2, Math.PI * 2 - 0.4);
    c.stroke();

    /* Mouth (smirk) – arc */
    c.fillStyle = '#993355';
    c.beginPath();
    c.arc(sx + 22, sy + 17, 4, 0.2, Math.PI - 0.2);
    c.fill();

    c.restore();

    this.drawProjectiles(c, camX, camY);
  };

  Moni.prototype.drawProjectiles = function (c, camX, camY) {
    c.save();
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      var px = p.x - camX;
      var py = p.y - camY;
      /* Dark magic orb */
      c.fillStyle = '#9933cc';
      c.beginPath();
      c.arc(px, py, p.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#dd66ff';
      c.beginPath();
      c.arc(px - 1, py - 1, p.r * 0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };

  /* Boss health bar shared by Moni and the mini-bosses: a framed pill
     with a gradient fill, gloss and an outlined name label. */
  var BOSS_BAR_PALETTES = {
    moni:         { frame: '#2a0830', edge: '#f0b0ff', track: '#5a1a60', top: '#f27af2', bot: '#a832b8' },
    giantOctopus: { frame: '#1d0a30', edge: '#d9a6ff', track: '#3a1a5a', top: '#c988ff', bot: '#7a3cc0' },
    kingCrab:     { frame: '#3a0e08', edge: '#ffc9a6', track: '#5a2010', top: '#ff9c5a', bot: '#d4451e' },
  };
  function drawBossBar(c, hp, maxHp, label, pal) {
    var barW = 220;
    var barH = 18;
    var bx = (W - barW) / 2;
    var by = 12;
    var r = barH / 2;
    function pill(x, y, w, h, rr) {
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }
    c.save();
    /* Frame */
    c.fillStyle = pal.frame;
    pill(bx - 3, by - 3, barW + 6, barH + 6, r + 3);
    c.fill();
    c.strokeStyle = pal.edge;
    c.lineWidth = 2;
    c.stroke();
    /* Track + fill, clipped to the rounded inside */
    pill(bx, by, barW, barH, r);
    c.clip();
    c.fillStyle = pal.track;
    c.fillRect(bx, by, barW, barH);
    var g = c.createLinearGradient(0, by, 0, by + barH);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.bot);
    c.fillStyle = g;
    c.fillRect(bx, by, barW * Math.max(0, hp / maxHp), barH);
    c.fillStyle = 'rgba(255, 255, 255, 0.18)';
    c.fillRect(bx, by, barW, barH * 0.4);
    c.restore();
    /* Label, outlined so it reads over both the fill and the track */
    c.save();
    c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = pal.frame;
    c.strokeText(label, W / 2, by + barH / 2 + 1);
    c.fillStyle = '#ffffff';
    c.fillText(label, W / 2, by + barH / 2 + 1);
    c.restore();
  }

  Moni.prototype.drawHealthBar = function (c) {
    if (!this.active || this.defeated) return;
    drawBossBar(c, this.hp, this.maxHp, Game.i18n.t('bossHP'), BOSS_BAR_PALETTES.moni);
  };

  /* ========== OLIVER (NPC - Otter) ========== */
  function Oliver(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 20;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentJoke = '';
    this.interacted = false;
  }

  Oliver.prototype.update = function () {
    this.timer++;
    this.x = this.spawnX + Math.sin(this.timer * 0.02) * 40;
    this.y = this.spawnY + Math.cos(this.timer * 0.03) * 20;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Oliver.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentJoke = Game.i18n.getJoke();
  };

  Oliver.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var fur = '#8a5a30', dark = '#5e3a18', light = '#b07c48', cream = '#e8cfa6';
    var kick = Math.sin(this.timer * 0.12) * 2;

    c.save();
    c.lineCap = 'round';
    /* Thick tapering rudder tail, swept behind */
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(sx + 24, sy + 8);
    c.quadraticCurveTo(sx + 32, sy + 7 + kick, sx + 37, sy + 12 + kick * 1.5);
    c.quadraticCurveTo(sx + 32, sy + 13 + kick, sx + 25, sy + 16);
    c.closePath();
    c.fill();

    /* Far hind flipper */
    c.fillStyle = dark;
    c.beginPath();
    c.ellipse(sx + 23, sy + 18 - kick * 0.5, 4.5, 2, 0.5, 0, Math.PI * 2);
    c.fill();

    /* Long sleek body */
    var g = c.createLinearGradient(0, sy + 4, 0, sy + 18);
    g.addColorStop(0, light);
    g.addColorStop(0.5, fur);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 15, sy + 11, 13, 6.5, 0.05, 0, Math.PI * 2);
    c.fill();
    /* Pale chest and belly */
    c.fillStyle = cream;
    c.beginPath();
    c.ellipse(sx + 12, sy + 14, 8, 3.2, 0.1, 0, Math.PI * 2);
    c.fill();

    /* Near hind flipper and little front paws (webbed) */
    c.fillStyle = fur;
    c.beginPath();
    c.ellipse(sx + 21, sy + 19 + kick * 0.5, 4.5, 2.2, -0.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 7, sy + 17, 2.6, 1.8, 0.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 12, sy + 18, 2.6, 1.8, 0.2, 0, Math.PI * 2);
    c.fill();

    /* Head – small and round, set low and forward */
    var hg = c.createRadialGradient(sx + 5, sy + 4, 1, sx + 6, sy + 7, 8);
    hg.addColorStop(0, light);
    hg.addColorStop(1, fur);
    c.fillStyle = hg;
    c.beginPath();
    c.arc(sx + 6, sy + 7, 7, 0, Math.PI * 2);
    c.fill();
    /* Tiny round ears */
    c.fillStyle = dark;
    c.beginPath(); c.arc(sx + 1.5, sy + 2, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 11, sy + 2, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9a68a';
    c.beginPath(); c.arc(sx + 1.5, sy + 2, 0.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 11, sy + 2, 0.9, 0, Math.PI * 2); c.fill();
    /* Cream muzzle */
    c.fillStyle = cream;
    c.beginPath();
    c.ellipse(sx + 4, sy + 10, 5, 3.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Big black nose */
    c.fillStyle = '#1a1a1a';
    c.beginPath();
    c.ellipse(sx + 1.2, sy + 8.6, 1.9, 1.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 0.6, sy + 8.1, 0.5, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = dark;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 1.5, sy + 10.2);
    c.quadraticCurveTo(sx + 3.5, sy + 12.4, sx + 6, sy + 11);
    c.stroke();
    /* Eyes – bright and round */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 4, sy + 6, 1.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9, sy + 6, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 3.5, sy + 5.4, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 8.5, sy + 5.4, 0.7, 0, Math.PI * 2); c.fill();
    /* Whiskers */
    c.strokeStyle = '#f4e6cf';
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 2, sy + 9.5); c.lineTo(sx - 4, sy + 8);
    c.moveTo(sx + 2, sy + 10.5); c.lineTo(sx - 4, sy + 11.5);
    c.moveTo(sx + 7, sy + 9.5); c.lineTo(sx + 13, sy + 8.5);
    c.stroke();
    c.restore();
  };

  /* ========== KITTY CORN (NPC - Cat Mermaid) ========== */
  function KittyCorn(x, y) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 28;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.interacted = false;
  }

  KittyCorn.prototype.update = function () {
    this.timer++;
    this.x = this.spawnX + Math.sin(this.timer * 0.025) * 30;
    this.y = this.spawnY + Math.cos(this.timer * 0.035) * 15;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  KittyCorn.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    if (!this.interacted) {
      this.currentText = Game.i18n.t('kittyGreet');
      this.interacted = true;
    } else {
      this.currentText = Game.i18n.t('kittyHint');
    }
  };

  KittyCorn.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();

    /* Mermaid tail – smooth bezier */
    c.fillStyle = '#33ccaa';
    var tailWave = Math.sin(this.timer * 0.08) * 4;
    c.beginPath();
    c.moveTo(sx + 6, sy + 16);
    c.lineTo(sx + 18, sy + 16);
    c.bezierCurveTo(sx + 18, sy + 20, sx + 16 + tailWave, sy + 24, sx + 20, sy + 28);
    c.lineTo(sx + 4, sy + 28);
    c.bezierCurveTo(sx + 8 - tailWave, sy + 24, sx + 6, sy + 20, sx + 6, sy + 16);
    c.closePath();
    c.fill();
    /* Tail fin */
    c.fillStyle = '#22aa88';
    c.beginPath();
    c.moveTo(sx + 12, sy + 27);
    c.quadraticCurveTo(sx + 2, sy + 30, sx + 0, sy + 32);
    c.quadraticCurveTo(sx + 6, sy + 29, sx + 12, sy + 27);
    c.fill();
    c.beginPath();
    c.moveTo(sx + 12, sy + 27);
    c.quadraticCurveTo(sx + 22, sy + 30, sx + 24, sy + 32);
    c.quadraticCurveTo(sx + 18, sy + 29, sx + 12, sy + 27);
    c.fill();

    /* Body – ellipse */
    c.fillStyle = '#ff9944';
    c.beginPath();
    c.ellipse(sx + 12, sy + 14, 7, 5, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#ff9944';
    c.beginPath();
    c.arc(sx + 12, sy + 6, 8, 0, Math.PI * 2);
    c.fill();

    /* Ears */
    c.fillStyle = '#ff8833';
    c.beginPath();
    c.moveTo(sx + 5, sy + 0); c.lineTo(sx + 3, sy - 6); c.lineTo(sx + 9, sy + 0);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 15, sy + 0); c.lineTo(sx + 21, sy - 6); c.lineTo(sx + 19, sy + 0);
    c.closePath(); c.fill();
    /* Inner ears */
    c.fillStyle = '#ffaacc';
    c.beginPath();
    c.moveTo(sx + 6, sy + 0); c.lineTo(sx + 5, sy - 3); c.lineTo(sx + 8, sy + 0);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 16, sy + 0); c.lineTo(sx + 19, sy - 3); c.lineTo(sx + 18, sy + 0);
    c.closePath(); c.fill();

    /* Horn – bezier cone with spiral stripe */
    c.fillStyle = '#ff6699';
    c.beginPath();
    c.moveTo(sx + 12, sy - 8);
    c.bezierCurveTo(sx + 10, sy - 4, sx + 9, sy - 2, sx + 10, sy - 1);
    c.lineTo(sx + 14, sy - 1);
    c.bezierCurveTo(sx + 15, sy - 2, sx + 14, sy - 4, sx + 12, sy - 8);
    c.closePath();
    c.fill();
    c.strokeStyle = '#ffcc55';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 11.5, sy - 5); c.lineTo(sx + 12.5, sy - 4);
    c.moveTo(sx + 11, sy - 3); c.lineTo(sx + 13, sy - 2);
    c.stroke();

    /* Eyes */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 9, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 9, sy + 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 4, 0.8, 0, Math.PI * 2); c.fill();

    /* Mouth – smile arc */
    c.strokeStyle = '#cc5566';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sx + 12, sy + 7, 3, 0.2, Math.PI - 0.2);
    c.stroke();

    /* Whiskers */
    c.strokeStyle = '#cc7722';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 5, sy + 6); c.lineTo(sx - 1, sy + 5);
    c.moveTo(sx + 5, sy + 8); c.lineTo(sx - 1, sy + 9);
    c.moveTo(sx + 19, sy + 6); c.lineTo(sx + 25, sy + 5);
    c.moveTo(sx + 19, sy + 8); c.lineTo(sx + 25, sy + 9);
    c.stroke();

    c.restore();
  };

  /* ========== BOB (NPC - Submarine) ========== */
  function Bob(x, y) {
    this.x = x;
    this.y = y;
    this.w = 60;
    this.h = 32;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.propPhase = 0;
  }

  Bob.prototype.update = function () {
    this.timer++;
    this.propPhase += 0.2;
    this.x = this.spawnX + Math.sin(this.timer * 0.01) * 20;
    this.y = this.spawnY + Math.cos(this.timer * 0.015) * 10;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Bob.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentText = Game.i18n.t('bobGreet') + '\n' + Game.i18n.getFact();
  };

  Bob.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();

    /* Hull */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.ellipse(sx + 28, sy + 18, 28, 14, 0, 0, Math.PI * 2);
    c.fill();

    /* Red stripe */
    c.fillStyle = '#cc3333';
    c.beginPath();
    c.ellipse(sx + 28, sy + 18, 26, 3, 0, 0, Math.PI * 2);
    c.fill();

    /* Cabin / tower – rounded */
    c.fillStyle = '#ddaa22';
    c.beginPath();
    c.moveTo(sx + 20, sy + 12);
    c.quadraticCurveTo(sx + 20, sy + 2, sx + 28, sy + 2);
    c.quadraticCurveTo(sx + 36, sy + 2, sx + 36, sy + 12);
    c.closePath();
    c.fill();

    /* Periscope – rounded ends */
    c.fillStyle = '#999999';
    c.beginPath();
    c.moveTo(sx + 27, sy - 8);
    c.quadraticCurveTo(sx + 28, sy - 10, sx + 30, sy - 10);
    c.lineTo(sx + 32, sy - 10);
    c.quadraticCurveTo(sx + 34, sy - 10, sx + 32, sy - 8);
    c.lineTo(sx + 30, sy - 8);
    c.lineTo(sx + 30, sy + 0);
    c.lineTo(sx + 27, sy + 0);
    c.closePath();
    c.fill();

    /* Windows */
    c.fillStyle = '#88ddff';
    c.beginPath(); c.arc(sx + 14, sy + 14, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 14, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 42, sy + 14, 5, 0, Math.PI * 2); c.fill();
    /* Window rims */
    c.strokeStyle = '#aa8822';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(sx + 14, sy + 14, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx + 28, sy + 14, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx + 42, sy + 14, 5, 0, Math.PI * 2); c.stroke();

    /* Face in middle window */
    c.fillStyle = '#ffddbb';
    c.beginPath(); c.arc(sx + 28, sy + 14, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx + 27, sy + 13, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 13, 0.8, 0, Math.PI * 2); c.fill();

    /* Propeller */
    c.fillStyle = '#888888';
    c.save();
    c.translate(sx + 56, sy + 18);
    c.rotate(this.propPhase);
    c.beginPath();
    c.ellipse(0, -5, 2, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(0, 5, 2, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#666666';
    c.beginPath(); c.arc(sx + 56, sy + 18, 3, 0, Math.PI * 2); c.fill();

    c.restore();
  };

  /* ========== WOLFE (NPC - Dog on Beach) ========== */
  function Wolfe(x, y, patrolWidth) {
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 22;
    this.patrolX = x;
    this.patrolWidth = patrolWidth || 400;
    this.dir = 1;
    this.speed = 2;
    this.timer = 0;
    this.legPhase = 0;
  }

  Wolfe.prototype.update = function () {
    this.timer++;
    this.legPhase += 0.15;
    this.x += this.speed * this.dir;
    if (this.x > this.patrolX + this.patrolWidth) this.dir = -1;
    if (this.x < this.patrolX) this.dir = 1;
  };

  Wolfe.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var legOff = Math.sin(this.legPhase) * 4;
    var fur = '#d9a84a', dark = '#a8752a', light = '#f0cd7e', cream = '#f7e6bf';

    c.save();
    /* The sprite is drawn head-left; mirror it while trotting right so
       Wolfe always runs nose-first. */
    if (this.dir === 1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }
    c.lineCap = 'round';

    /* Tail – curls up over the back and wags */
    var tailWag = Math.sin(this.timer * 0.15) * 4;
    c.strokeStyle = fur;
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(sx + 26, sy + 8);
    c.quadraticCurveTo(sx + 31, sy + 6 + tailWag, sx + 30, sy - 1 + tailWag);
    c.stroke();
    c.strokeStyle = light;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(sx + 28.5, sy + 4 + tailWag * 0.7);
    c.lineTo(sx + 30, sy - 1 + tailWag);
    c.stroke();

    /* Far legs */
    c.fillStyle = dark;
    c.beginPath(); c.ellipse(sx + 10, sy + 18 - legOff * 0.4, 2.2, 4.5, 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 23, sy + 18 + legOff * 0.4, 2.2, 4.5, -0.15, 0, Math.PI * 2); c.fill();

    /* Body – deep chest, lit from above */
    var g = c.createLinearGradient(0, sy + 3, 0, sy + 18);
    g.addColorStop(0, light);
    g.addColorStop(0.5, fur);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx + 16, sy + 11, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    /* Cream belly */
    c.fillStyle = cream;
    c.beginPath();
    c.ellipse(sx + 15, sy + 15, 8, 2.8, 0, 0, Math.PI * 2);
    c.fill();

    /* Near legs with rounded paws */
    c.fillStyle = fur;
    c.beginPath(); c.ellipse(sx + 7, sy + 18 + legOff * 0.4, 2.4, 4.8, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 25, sy + 18 - legOff * 0.4, 2.4, 4.8, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = cream;
    c.beginPath(); c.ellipse(sx + 6.4, sy + 22 + legOff * 0.4, 2.2, 1.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 25.6, sy + 22 - legOff * 0.4, 2.2, 1.2, 0, 0, Math.PI * 2); c.fill();

    /* Head – round with a proper muzzle */
    var hg = c.createRadialGradient(sx + 5, sy + 2, 1, sx + 7, sy + 5, 8);
    hg.addColorStop(0, light);
    hg.addColorStop(1, fur);
    c.fillStyle = hg;
    c.beginPath();
    c.arc(sx + 7, sy + 5, 6.8, 0, Math.PI * 2);
    c.fill();
    /* Muzzle */
    c.fillStyle = cream;
    c.beginPath();
    c.ellipse(sx + 2.5, sy + 7.5, 4.6, 3.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Floppy ear hanging beside the head */
    c.fillStyle = dark;
    c.beginPath();
    c.ellipse(sx + 11.5, sy + 4, 2.6, 5.2, 0.25, 0, Math.PI * 2);
    c.fill();
    /* Nose */
    c.fillStyle = '#2a1a12';
    c.beginPath();
    c.ellipse(sx - 1.4, sy + 6.4, 1.8, 1.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx - 2, sy + 5.9, 0.5, 0, Math.PI * 2); c.fill();
    /* Happy mouth + tongue (panting) */
    c.strokeStyle = '#6a4420';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx - 0.6, sy + 8.2);
    c.quadraticCurveTo(sx + 1.5, sy + 10.4, sx + 4.2, sy + 9);
    c.stroke();
    if (Math.sin(this.timer * 0.1) > 0) {
      c.fillStyle = '#ff7f96';
      c.beginPath();
      c.ellipse(sx + 1.6, sy + 11, 1.4, 2.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    /* Eye */
    c.fillStyle = '#2a1a12';
    c.beginPath(); c.arc(sx + 4.6, sy + 4, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(sx + 4.1, sy + 3.4, 0.6, 0, Math.PI * 2); c.fill();
    /* Brow spot */
    c.fillStyle = cream;
    c.beginPath(); c.arc(sx + 4.6, sy + 1.2, 1, 0, Math.PI * 2); c.fill();

    /* Collar with a little tag */
    c.strokeStyle = '#d23a3a';
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(sx + 8, sy + 8.5, 5.4, 0.35, Math.PI - 0.5);
    c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(sx + 8, sy + 14.2, 1.3, 0, Math.PI * 2); c.fill();

    c.restore();
  };

  /* ========== CRAB (NPC – friendly joke-teller) ========== */
  function Crab(x, y) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 14;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = Math.random() * 100;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.legPhase = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentJoke = '';
  }

  Crab.prototype.update = function () {
    this.timer++;
    this.legPhase += 0.18;
    /* Sidestep along a short patrol; flip when you reach the ends so the
       claws lead the walk – feels more crab-like than smooth oscillation. */
    var range = 36;
    var off = this.x - this.spawnX;
    if (off > range) this.dir = -1;
    else if (off < -range) this.dir = 1;
    if (!this.talking) this.x += 0.3 * this.dir;
    /* Tiny sand-bob */
    this.y = this.spawnY + Math.sin(this.timer * 0.06) * 0.6;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Crab.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentJoke = Game.i18n.getCrabJoke();
  };

  Crab.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var leg = Math.sin(this.legPhase) * 2;

    c.save();
    if (this.dir === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    /* Legs (behind body) – three pairs, alternating sway */
    c.strokeStyle = '#9a2418';
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    for (var lg = 0; lg < 3; lg++) {
      var lx = sx + 6 + lg * 4;
      var lOff = (lg % 2 === 0 ? leg : -leg);
      /* Left side leg */
      c.beginPath();
      c.moveTo(lx - 1, sy + 8);
      c.lineTo(lx - 4, sy + 13 + lOff);
      c.stroke();
      /* Right side leg */
      c.beginPath();
      c.moveTo(lx + 1, sy + 8);
      c.lineTo(lx + 4, sy + 13 - lOff);
      c.stroke();
    }

    /* Body shell */
    c.fillStyle = '#d8442f';
    c.beginPath();
    c.ellipse(sx + 11, sy + 7, 10, 6, 0, 0, Math.PI * 2);
    c.fill();
    /* Shell highlight */
    c.fillStyle = '#f1735c';
    c.beginPath();
    c.ellipse(sx + 9, sy + 5, 6, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Shell speckles */
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.arc(sx + 7,  sy + 8, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 13, sy + 9, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 6, 0.7, 0, Math.PI * 2); c.fill();

    /* Claws – pinched ovals on each side */
    var clawWiggle = this.talking ? Math.sin(this.timer * 0.4) * 0.6 : 0;
    c.fillStyle = '#d8442f';
    c.save();
    c.translate(sx + 1, sy + 6);
    c.rotate(-0.4 + clawWiggle);
    c.beginPath(); c.ellipse(0, 0, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
    /* Pincer notch */
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(-1.5, -0.6); c.lineTo(-1.5, 0.6); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#d8442f';
    c.save();
    c.translate(sx + 21, sy + 6);
    c.rotate(0.4 - clawWiggle);
    c.beginPath(); c.ellipse(0, 0, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.moveTo(3.2, 0); c.lineTo(1.5, -0.6); c.lineTo(1.5, 0.6); c.closePath(); c.fill();
    c.restore();

    /* Eye stalks */
    c.strokeStyle = '#7a1a10';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 8, sy + 3); c.lineTo(sx + 7, sy);
    c.stroke();
    c.beginPath();
    c.moveTo(sx + 14, sy + 3); c.lineTo(sx + 15, sy);
    c.stroke();
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 7, sy, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 7, sy, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy, 0.8, 0, Math.PI * 2); c.fill();

    /* Friendly smile */
    c.strokeStyle = '#7a1a10';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(sx + 11, sy + 7, 2, 0.2, Math.PI - 0.2);
    c.stroke();

    c.restore();
  };

  /* ========== HEART PICKUP ========== */
  function HeartPickup(x, y) {
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 16;
    this.spawnY = y;
    this.timer = 0;
    this.active = true;
  }

  HeartPickup.prototype.update = function () {
    this.timer++;
    this.y = this.spawnY + Math.sin(this.timer * 0.05) * 6;
  };

  HeartPickup.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = this.x - camX + 8;
    var sy = this.y - camY + 6;
    var pulse = 1 + Math.sin(this.timer * 0.08) * 0.1;

    c.save();
    /* Soft pink glow so the pickup pops against dark water */
    var glow = c.createRadialGradient(sx, sy, 2, sx, sy, 15 * pulse);
    glow.addColorStop(0, 'rgba(255, 110, 150, 0.45)');
    glow.addColorStop(1, 'rgba(255, 110, 150, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sx, sy, 15 * pulse, 0, Math.PI * 2);
    c.fill();

    c.translate(sx, sy);
    c.scale(pulse, pulse);
    /* Darker rim then the glossy heart on top */
    c.fillStyle = '#b8224a';
    c.beginPath();
    c.moveTo(0, 4);
    c.bezierCurveTo(-9, -4, -9, -9, 0, -4.5);
    c.bezierCurveTo(9, -9, 9, -4, 0, 4);
    c.fill();
    var g = c.createLinearGradient(0, -8, 0, 3);
    g.addColorStop(0, '#ff7a98');
    g.addColorStop(1, '#ff3358');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 3);
    c.bezierCurveTo(-8, -4, -8, -8, 0, -4);
    c.bezierCurveTo(8, -8, 8, -4, 0, 3);
    c.fill();
    /* Shine */
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    c.beginPath();
    c.ellipse(-3.2, -4, 2, 1.3, -0.6, 0, Math.PI * 2);
    c.fill();
    /* Sparkle that orbits slowly */
    var a = this.timer * 0.05;
    c.fillStyle = 'rgba(255, 240, 250, 0.9)';
    c.beginPath();
    c.arc(Math.cos(a) * 9, Math.sin(a) * 7 - 1, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* ========== PARTICLE ========== */
  function Particle(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life || 30;
    this.maxLife = this.life;
    this.size = size || 3;
    this.active = true;
  }

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.02;
    this.vx *= 0.98;
    this.life--;
    if (this.life <= 0) this.active = false;
  };

  Particle.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var alpha = this.life / this.maxLife;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = this.color;
    var s = this.size * alpha;
    c.beginPath();
    c.arc(this.x - camX, this.y - camY, s / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* Spawn a burst of particles */
  function spawnBurst(x, y, count, colors) {
    var particles = [];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      var speed = 1 + Math.random() * 2;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color, 30 + Math.random() * 20, 2 + Math.random() * 3
      ));
    }
    return particles;
  }

  /* ========== AMBIENT BUBBLE ========== */
  function AmbientBubble(x, y) {
    this.x = x;
    this.y = y;
    this.r = 1 + Math.random() * 3;
    this.speed = 0.3 + Math.random() * 0.5;
    this.wobbleSpeed = 0.01 + Math.random() * 0.03;
    this.wobbleAmp = 10 + Math.random() * 20;
    this.phase = Math.random() * Math.PI * 2;
    this.alpha = 0.2 + Math.random() * 0.3;
  }

  AmbientBubble.prototype.update = function (levelHeight) {
    this.phase += this.wobbleSpeed;
    this.y -= this.speed;
    if (this.y < -10) this.y = levelHeight + 10;
  };

  AmbientBubble.prototype.draw = function (c, camX, camY) {
    var sx = this.x - camX + Math.sin(this.phase) * this.wobbleAmp;
    var sy = this.y - camY;
    c.save();
    c.globalAlpha = this.alpha;
    c.fillStyle = '#88ccff';
    c.beginPath();
    c.arc(sx, sy, this.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#bbddff';
    c.beginPath();
    c.arc(sx - this.r * 0.3, sy - this.r * 0.3, this.r * 0.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* ========== PEARL (Collectible) ========== */
  /* `opts.shell` draws a half scallop shell under a floor pearl; `opts.vx /
     vy` give a pearl popped out of a chest an initial toss, after which it
     settles and bobs where it ended up. */
  function Pearl(x, y, opts) {
    opts = opts || {};
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.spawnY = y;
    this.shell = !!opts.shell;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.settle = (this.vx || this.vy) ? 45 : 0;
    this.timer = Math.random() * 100;
    this.active = true;
    this.isPearl = true;
  }

  Pearl.prototype.update = function () {
    this.timer++;
    if (this.settle > 0) {
      this.settle--;
      this.vy += 0.06;
      this.vx *= 0.96;
      this.vy *= 0.96;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < 20) { this.y = 20; this.vy = 0; }
      this.spawnY = this.y;
      return;
    }
    if (!this.shell) this.y = this.spawnY + Math.sin(this.timer * 0.05) * 5;
  };

  function drawPearlSprite(c) {
    var g = c.createRadialGradient(7.5, 7, 1, 10, 10, 8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#fff1f6');
    g.addColorStop(0.75, '#f3c9dc');
    g.addColorStop(1, '#b893b4');
    c.fillStyle = g;
    c.beginPath(); c.arc(10, 10, 7.5, 0, Math.PI * 2); c.fill();
    /* Iridescent sheen along the lower-right rim */
    c.strokeStyle = 'rgba(160, 230, 255, 0.6)';
    c.lineWidth = 1.3;
    c.beginPath(); c.arc(10, 10, 6.4, 0.3, 1.7); c.stroke();
    c.strokeStyle = 'rgba(255, 190, 220, 0.5)';
    c.beginPath(); c.arc(10, 10, 6.4, 1.9, 2.6); c.stroke();
    c.strokeStyle = 'rgba(90, 60, 100, 0.55)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(10, 10, 7.5, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.ellipse(7.2, 6.8, 2.3, 1.4, -0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath(); c.arc(12.6, 12.6, 0.9, 0, Math.PI * 2); c.fill();
  }

  function drawHalfShell(c) {
    var g = c.createLinearGradient(0, 2, 0, 16);
    g.addColorStop(0, '#ffe8cf');
    g.addColorStop(1, '#d4915c');
    c.fillStyle = g;
    c.beginPath(); c.arc(14, 3, 13, 0.12, Math.PI - 0.12); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120, 70, 40, 0.45)';
    c.lineWidth = 1;
    for (var i = -3; i <= 3; i++) {
      var a = Math.PI / 2 + i * 0.3;
      c.beginPath(); c.moveTo(14, 3); c.lineTo(14 + Math.cos(a) * 12.5, 3 + Math.sin(a) * 12.5); c.stroke();
    }
    c.strokeStyle = '#8a5a3a';
    c.beginPath(); c.arc(14, 3, 13, 0.12, Math.PI - 0.12); c.stroke();
    c.fillStyle = '#6e4428';
    c.beginPath(); c.ellipse(14, 15, 3, 1.6, 0, 0, Math.PI * 2); c.fill();
  }

  function getPearlSprite() {
    return getCachedSprite('pearl', 20, 20, drawPearlSprite);
  }

  Pearl.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = this.x - camX + 7, sy = this.y - camY + 7;
    var t = this.timer;
    c.save();
    var glow = c.createRadialGradient(sx, sy, 2, sx, sy, 16);
    glow.addColorStop(0, 'rgba(255, 220, 240, 0.4)');
    glow.addColorStop(1, 'rgba(255, 220, 240, 0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(sx, sy, 16, 0, Math.PI * 2); c.fill();
    if (this.shell) {
      c.drawImage(getCachedSprite('pearlShell', 28, 17, drawHalfShell), sx - 14, sy - 1);
    }
    c.drawImage(getPearlSprite(), sx - 10, sy - 10);
    /* Four-point twinkle that fades in and out */
    var tw = Math.sin(t * 0.12);
    if (tw > 0) {
      c.globalAlpha = tw;
      c.fillStyle = '#ffffff';
      var R = 2 + tw * 3;
      var px = sx + 4.5, py = sy - 4.5;
      c.beginPath();
      c.moveTo(px, py - R);
      c.quadraticCurveTo(px, py, px + R, py);
      c.quadraticCurveTo(px, py, px, py + R);
      c.quadraticCurveTo(px, py, px - R, py);
      c.quadraticCurveTo(px, py, px, py - R);
      c.fill();
    }
    c.restore();
  };

  /* ========== TREASURE CHEST (shoot to open) ========== */
  function Chest(x, y, count) {
    this.x = x;
    this.y = y;
    this.w = 36;
    this.h = 28;
    this.pearls = count || 4;
    this.open = false;
    this.openTimer = 0;
    this.timer = Math.random() * 100;
  }

  Chest.prototype.update = function () {
    this.timer++;
    if (this.open) this.openTimer++;
  };

  /* Pops the lid and returns the pearls that fly out (or null if it was
     already open). */
  Chest.prototype.hit = function () {
    if (this.open) return null;
    this.open = true;
    this.openTimer = 0;
    Game.audio.play('chest');
    var out = [];
    for (var i = 0; i < this.pearls; i++) {
      var a = -Math.PI / 2 + (i - (this.pearls - 1) / 2) * 0.38;
      var sp = 2.2 + Math.random() * 1.1;
      out.push(new Pearl(this.x + this.w / 2 - 7, this.y - 6, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2 }));
    }
    return out;
  };

  Chest.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX), sy = Math.round(this.y - camY);
    var w = this.w, h = this.h;
    var bodyY = sy + 10, bodyH = h - 10;
    c.save();
    c.fillStyle = 'rgba(4, 14, 26, 0.4)';
    c.beginPath(); c.ellipse(sx + w / 2, sy + h + 2, w * 0.6, 4, 0, 0, Math.PI * 2); c.fill();

    /* Closed chests get a soft gold shimmer so they read as "shoot me" */
    if (!this.open) {
      var sh = 0.5 + 0.5 * Math.sin(this.timer * 0.06);
      var sg = c.createRadialGradient(sx + w / 2, sy + h / 2, 4, sx + w / 2, sy + h / 2, 34);
      sg.addColorStop(0, 'rgba(255, 215, 110, ' + (0.12 + sh * 0.14) + ')');
      sg.addColorStop(1, 'rgba(255, 215, 110, 0)');
      c.fillStyle = sg;
      c.fillRect(sx - 20, sy - 20, w + 40, h + 40);
    }

    /* Open: glow from inside plus a few pearls still nestled there */
    if (this.open) {
      var og = c.createRadialGradient(sx + w / 2, bodyY + 4, 2, sx + w / 2, bodyY + 4, w * 0.7);
      og.addColorStop(0, 'rgba(255, 230, 250, 0.9)');
      og.addColorStop(1, 'rgba(255, 200, 240, 0)');
      c.fillStyle = og;
      c.fillRect(sx - 8, sy - 14, w + 16, h + 14);
    }

    /* Body – planked box */
    var wg = c.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    wg.addColorStop(0, '#b0703c');
    wg.addColorStop(1, '#5a3418');
    c.fillStyle = wg;
    c.fillRect(sx, bodyY, w, bodyH);
    c.strokeStyle = 'rgba(60, 30, 10, 0.5)';
    c.lineWidth = 1;
    for (var p = 1; p < 3; p++) {
      c.beginPath(); c.moveTo(sx, bodyY + p * bodyH / 3); c.lineTo(sx + w, bodyY + p * bodyH / 3); c.stroke();
    }
    if (this.open) {
      c.fillStyle = '#fff0f6';
      for (var k = 0; k < 3; k++) {
        c.beginPath(); c.arc(sx + 10 + k * 8, bodyY + 3, 3.2, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (k = 0; k < 3; k++) {
        c.beginPath(); c.arc(sx + 9 + k * 8, bodyY + 2, 1, 0, Math.PI * 2); c.fill();
      }
    }

    /* Lid – domed, swings back on its hinge when opened */
    c.save();
    if (this.open) {
      var ang = -Math.min(1, this.openTimer / 12) * 2.1;
      c.translate(sx, bodyY);
      c.rotate(ang);
      c.translate(-sx, -bodyY);
    }
    var lg = c.createLinearGradient(0, sy, 0, bodyY);
    lg.addColorStop(0, '#d0905a');
    lg.addColorStop(1, '#7a4a22');
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(sx, bodyY);
    c.lineTo(sx, sy + 6);
    c.quadraticCurveTo(sx, sy, sx + 6, sy);
    c.lineTo(sx + w - 6, sy);
    c.quadraticCurveTo(sx + w, sy, sx + w, sy + 6);
    c.lineTo(sx + w, bodyY);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255, 220, 170, 0.3)';
    c.fillRect(sx + 3, sy + 2, w - 6, 2);
    c.fillStyle = '#4a4a55';
    c.fillRect(sx + 7, sy, 4, 10);
    c.fillRect(sx + w - 11, sy, 4, 10);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(sx + 8, sy + 1, 1.2, 9);
    c.fillRect(sx + w - 10, sy + 1, 1.2, 9);
    c.strokeStyle = 'rgba(40, 20, 8, 0.6)';
    c.beginPath();
    c.moveTo(sx, bodyY);
    c.lineTo(sx, sy + 6);
    c.quadraticCurveTo(sx, sy, sx + 6, sy);
    c.lineTo(sx + w - 6, sy);
    c.quadraticCurveTo(sx + w, sy, sx + w, sy + 6);
    c.lineTo(sx + w, bodyY);
    c.stroke();
    c.restore();

    /* Iron bands and lock plate */
    c.fillStyle = '#4a4a55';
    c.fillRect(sx + 7, bodyY, 4, bodyH);
    c.fillRect(sx + w - 11, bodyY, 4, bodyH);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(sx + 8, bodyY, 1.2, bodyH);
    c.fillRect(sx + w - 10, bodyY, 1.2, bodyH);
    if (!this.open) {
      c.fillStyle = '#ffd24a';
      c.fillRect(sx + w / 2 - 4, bodyY - 3, 8, 8);
      c.fillStyle = '#ffeb9a';
      c.fillRect(sx + w / 2 - 3, bodyY - 2, 6, 1.5);
      c.fillStyle = '#7a5418';
      c.beginPath(); c.arc(sx + w / 2, bodyY + 1.5, 1.4, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(40, 20, 8, 0.6)';
    c.strokeRect(sx + 0.5, bodyY + 0.5, w - 1, bodyH - 1);
    c.restore();
  };

  /* ========== JELLYFISH (Enemy) ========== */
  /* Slow vertical bob with a pulsing translucent bell and trailing
     tentacles. In the dark trench (`glow`) it is lit from inside in neon
     teal / magenta / lime so the player can see it coming. */
  function Jellyfish(x, y, glow) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.w = 26;
    this.h = 30;
    this.hp = 1;
    this.timer = Math.random() * 200;
    this.active = true;
    this.flash = 0;
    this.glow = !!glow;
    this.hue = glow ? [178, 300, 110][Math.floor(Math.random() * 3)] : 335;
  }

  Jellyfish.prototype.update = function () {
    if (!this.active) return;
    this.timer++;
    if (this.flash > 0) this.flash--;
    this.y = this.spawnY + Math.sin(this.timer * 0.02) * 55;
    this.x = this.spawnX + Math.sin(this.timer * 0.011) * 18;
  };

  Jellyfish.prototype.hit = function () {
    this.hp--;
    this.flash = 6;
    if (this.hp <= 0) {
      this.active = false;
      Game.audio.play('enemyDefeat');
      return true;
    }
    Game.audio.play('enemyHit');
    return false;
  };

  Jellyfish.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    if (this.flash > 0 && this.flash % 2 === 0) return;
    var sx = this.x - camX + this.w / 2;
    var sy = this.y - camY + 8;
    var hue = this.hue;
    var pulse = Math.sin(this.timer * 0.08);
    var rx = 13 + pulse * 1.5, ry = 10 - pulse * 1.2;
    c.save();
    c.lineCap = 'round';
    if (this.glow) {
      var hg = c.createRadialGradient(sx, sy + 4, 2, sx, sy + 4, 34);
      hg.addColorStop(0, 'hsla(' + hue + ', 90%, 70%, 0.45)');
      hg.addColorStop(1, 'hsla(' + hue + ', 90%, 70%, 0)');
      c.fillStyle = hg;
      c.fillRect(sx - 36, sy - 32, 72, 72);
    }
    /* Tentacles – four thin trailing ones and two frilly oral arms */
    for (var i = 0; i < 4; i++) {
      var tx = sx - 8 + i * 5.3;
      var w1 = Math.sin(this.timer * 0.06 + i * 1.3) * 4;
      var w2 = Math.cos(this.timer * 0.05 + i) * 5;
      c.strokeStyle = 'hsla(' + hue + ', 85%, ' + (this.glow ? 72 : 78) + '%, 0.75)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(tx, sy + 6);
      c.bezierCurveTo(tx + w1, sy + 14, tx - w2, sy + 22, tx + w1 * 0.6, sy + 30);
      c.stroke();
    }
    for (var o = -1; o <= 1; o += 2) {
      var ox = sx + o * 3.5;
      var ow = Math.sin(this.timer * 0.07 + o) * 3;
      c.strokeStyle = 'hsla(' + hue + ', 80%, ' + (this.glow ? 65 : 70) + '%, 0.9)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(ox, sy + 6);
      c.quadraticCurveTo(ox + ow + o * 4, sy + 14, ox + ow, sy + 20);
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.moveTo(ox - 1, sy + 7);
      c.quadraticCurveTo(ox + ow + o * 4 - 1, sy + 14, ox + ow - 1, sy + 18);
      c.stroke();
    }
    /* Bell – translucent dome with an inner lit core */
    var bg = c.createRadialGradient(sx - 4, sy - 5, 1, sx, sy - 1, rx + 2);
    bg.addColorStop(0, 'hsla(' + hue + ', 100%, 92%, 0.95)');
    bg.addColorStop(0.55, 'hsla(' + hue + ', 90%, 72%, 0.75)');
    bg.addColorStop(1, 'hsla(' + hue + ', 80%, 55%, 0.55)');
    c.fillStyle = bg;
    c.beginPath();
    c.ellipse(sx, sy, rx, ry, 0, Math.PI, 0);
    c.quadraticCurveTo(sx + rx * 0.5, sy + 5, sx, sy + 4);
    c.quadraticCurveTo(sx - rx * 0.5, sy + 5, sx - rx, sy);
    c.closePath();
    c.fill();
    c.strokeStyle = 'hsla(' + hue + ', 80%, 85%, 0.8)';
    c.lineWidth = 1.2;
    c.stroke();
    /* Scalloped skirt */
    c.strokeStyle = 'hsla(' + hue + ', 80%, 88%, 0.6)';
    c.lineWidth = 1;
    c.beginPath();
    for (var s = -3; s <= 3; s++) {
      var skx = sx + s * (rx / 3.2);
      c.moveTo(skx - 1.5, sy + 2);
      c.quadraticCurveTo(skx, sy + 5.5, skx + 1.5, sy + 2);
    }
    c.stroke();
    /* Inner organ glow */
    var ig = c.createRadialGradient(sx, sy - 2, 0.5, sx, sy - 2, 6);
    ig.addColorStop(0, 'rgba(255,255,255,0.8)');
    ig.addColorStop(1, 'hsla(' + hue + ', 90%, 70%, 0)');
    c.fillStyle = ig;
    c.beginPath(); c.arc(sx, sy - 2, 6, 0, Math.PI * 2); c.fill();
    /* Dome highlight */
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(sx - 5, sy - 6, 3.5, 1.8, -0.5, 0, Math.PI * 2); c.fill();
    /* Sleepy eyes */
    c.strokeStyle = 'rgba(60, 20, 70, 0.75)';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(sx - 4, sy - 1, 2, 0.2, Math.PI - 0.2);
    c.moveTo(sx + 6, sy - 1);
    c.arc(sx + 4, sy - 1, 2, 0.2, Math.PI - 0.2);
    c.stroke();
    c.restore();
  };

  /* ========== EEL (Enemy) ========== */
  /* Lives in a hole at (x, y) and lunges out horizontally in `dir` when
     Momoko swims in front of it, holds, then slides back. Hitbox is the
     stretched body; it is harmless while hidden. */
  function Eel(x, y, dir) {
    this.homeX = x;
    this.homeY = y;
    this.dir = dir || 1;
    this.ext = 0;
    this.maxExt = 96;
    this.mode = 'hide';
    this.modeTimer = 0;
    this.cooldown = 0;
    this.hp = 2;
    this.active = true;
    this.flash = 0;
    this.timer = Math.random() * 100;
    this.headW = 24;
    this.h = 18;
    this.x = x;
    this.y = y - 9;
    this.w = 0;
  }

  Eel.prototype.update = function (px, py) {
    if (!this.active) return;
    this.timer++;
    if (this.flash > 0) this.flash--;
    if (this.cooldown > 0) this.cooldown--;
    this.modeTimer++;
    var dx = (px || 0) - this.homeX;
    var dy = (py || 0) - this.homeY;
    var inFront = this.dir === 1 ? (dx > 0 && dx < 170) : (dx < 0 && dx > -170);
    if (this.mode === 'hide') {
      this.ext = Math.max(0, this.ext - 4);
      if (this.cooldown <= 0 && inFront && Math.abs(dy) < 60) {
        this.mode = 'lunge';
        this.modeTimer = 0;
      }
    } else if (this.mode === 'lunge') {
      this.ext = Math.min(this.maxExt, this.ext + 7);
      if (this.ext >= this.maxExt) { this.mode = 'hold'; this.modeTimer = 0; }
    } else if (this.mode === 'hold') {
      if (this.modeTimer > 28) { this.mode = 'retreat'; this.modeTimer = 0; }
    } else {
      this.ext = Math.max(0, this.ext - 3.5);
      if (this.ext <= 0) { this.mode = 'hide'; this.modeTimer = 0; this.cooldown = 70; }
    }
    /* Hitbox follows the stretched body */
    if (this.ext > 10) {
      this.w = this.headW + this.ext - 10;
      this.x = this.dir === 1 ? this.homeX : this.homeX - this.w;
    } else {
      this.w = 0;
      this.x = this.homeX;
    }
  };

  Eel.prototype.hit = function () {
    if (this.ext <= 10) return false;
    this.hp--;
    this.flash = 8;
    if (this.hp <= 0) {
      this.active = false;
      Game.audio.play('enemyDefeat');
      return true;
    }
    Game.audio.play('enemyHit');
    return false;
  };

  Eel.prototype.draw = function (c, camX, camY) {
    var hx = this.homeX - camX, hy = this.homeY - camY;
    c.save();
    /* The hole: dark mouth with a rocky rim, always drawn so the lair is
       readable even when the eel is gone. */
    c.fillStyle = '#2a1e2e';
    c.beginPath(); c.ellipse(hx, hy, 17, 13, 0, 0, Math.PI * 2); c.fill();
    var hg = c.createRadialGradient(hx, hy, 2, hx, hy, 15);
    hg.addColorStop(0, '#05030a');
    hg.addColorStop(1, 'rgba(5, 3, 10, 0)');
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(hx, hy, 15, 11, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(190, 150, 160, 0.4)';
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(hx, hy, 17, 13, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    if (!this.active) { c.restore(); return; }
    if (this.flash > 0 && this.flash % 2 === 0) { c.restore(); return; }

    /* Body is authored extending to the right; flip for dir -1 */
    c.translate(hx, hy);
    if (this.dir === -1) c.scale(-1, 1);
    var ext = this.ext;
    var peek = ext <= 10;
    var headX = peek ? 4 : ext + 2;
    var wave = Math.sin(this.timer * 0.2) * 3;
    if (!peek) {
      /* Tapered body in two passes (dark edge, lighter core) plus a
         dorsal ribbon fin */
      c.lineCap = 'round';
      var pts = [[0, 0], [ext * 0.33, wave], [ext * 0.66, -wave], [headX, 0]];
      c.strokeStyle = '#2f4a2a';
      c.lineWidth = 14;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
      c.stroke();
      c.strokeStyle = '#6a9a4c';
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(pts[0][0], -1);
      c.bezierCurveTo(pts[1][0], pts[1][1] - 1, pts[2][0], pts[2][1] - 1, pts[3][0], -1);
      c.stroke();
      c.strokeStyle = '#d9e4a0';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 3);
      c.bezierCurveTo(pts[1][0], pts[1][1] + 3, pts[2][0], pts[2][1] + 3, headX - 4, 3);
      c.stroke();
      /* Dorsal fin ribbon */
      c.fillStyle = 'rgba(160, 200, 90, 0.75)';
      c.beginPath();
      c.moveTo(4, -6);
      for (var f = 0; f <= 6; f++) {
        var fx = 4 + (headX - 10) * f / 6;
        c.lineTo(fx, -8 - Math.sin(this.timer * 0.25 + f) * 2.5 - (f % 2) * 2);
      }
      c.lineTo(headX - 6, -6);
      c.closePath();
      c.fill();
      /* Spots */
      c.fillStyle = 'rgba(40, 70, 30, 0.6)';
      for (var sp = 1; sp < 5; sp++) {
        c.beginPath(); c.arc(ext * sp / 5, (sp % 2 ? -2 : 2), 1.6, 0, Math.PI * 2); c.fill();
      }
    }
    /* Head – wedge with a hinged jaw that gapes while lunging */
    var jaw = this.mode === 'lunge' || this.mode === 'hold' ? 0.55 : 0.12;
    var g = c.createLinearGradient(0, -9, 0, 9);
    g.addColorStop(0, '#78a858');
    g.addColorStop(1, '#3a5a30');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(headX - 8, -8);
    c.quadraticCurveTo(headX + 8, -9, headX + 16, -2);
    c.lineTo(headX + 6, 1);
    c.lineTo(headX - 8, 6);
    c.closePath();
    c.fill();
    /* Lower jaw */
    c.save();
    c.translate(headX - 2, 2);
    c.rotate(jaw);
    c.fillStyle = '#5a7a44';
    c.beginPath();
    c.moveTo(-6, -1);
    c.quadraticCurveTo(8, 2, 17, 0);
    c.lineTo(10, 6);
    c.lineTo(-6, 5);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    for (var tth = 0; tth < 3; tth++) {
      c.beginPath(); c.moveTo(3 + tth * 4.5, 0); c.lineTo(5 + tth * 4.5, -3); c.lineTo(7 + tth * 4.5, 0); c.closePath(); c.fill();
    }
    c.restore();
    /* Upper teeth and mouth interior */
    c.fillStyle = '#ffffff';
    for (var ut = 0; ut < 3; ut++) {
      c.beginPath(); c.moveTo(headX + 2 + ut * 4.5, 0); c.lineTo(headX + 4 + ut * 4.5, 3); c.lineTo(headX + 6 + ut * 4.5, 0); c.closePath(); c.fill();
    }
    /* Eye – yellow with a slit pupil */
    c.fillStyle = '#ffe066';
    c.beginPath(); c.arc(headX + 2, -4, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a10';
    c.beginPath(); c.ellipse(headX + 2.5, -4, 1.1, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.arc(headX + 1, -5.2, 0.8, 0, Math.PI * 2); c.fill();
    /* Angry brow */
    c.strokeStyle = '#243a20';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(headX - 2, -8.5); c.lineTo(headX + 6, -6.5); c.stroke();
    c.restore();
  };

  /* ========== SHARK (Enemy) ========== */
  function Shark(x, y, dir, range) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.w = 64;
    this.h = 26;
    this.hp = 2;
    this.dir = dir || -1;
    this.range = range || 220;
    this.speed = 2.0;
    this.timer = Math.random() * 100;
    this.active = true;
    this.flash = 0;
  }

  Shark.prototype.update = function (px) {
    if (!this.active) return;
    this.timer++;
    if (this.flash > 0) this.flash--;
    /* Speeds up when Momoko is ahead of its nose */
    var ahead = px !== undefined && ((this.dir === -1 && px < this.x && this.x - px < 200) ||
                                     (this.dir === 1 && px > this.x + this.w && px - this.x - this.w < 200));
    var target = ahead ? 3.0 : 2.0;
    this.speed += (target - this.speed) * 0.05;
    this.x += this.speed * this.dir;
    this.y = this.spawnY + Math.sin(this.timer * 0.03) * 14;
    if (this.x - this.spawnX > this.range) this.dir = -1;
    if (this.spawnX - this.x > this.range) this.dir = 1;
  };

  Shark.prototype.hit = function () {
    this.hp--;
    this.flash = 8;
    if (this.hp <= 0) {
      this.active = false;
      Game.audio.play('enemyDefeat');
      return true;
    }
    Game.audio.play('enemyHit');
    return false;
  };

  Shark.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    if (this.flash > 0 && this.flash % 2 === 0) return;
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    c.save();
    if (this.dir === 1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }
    var tail = Math.sin(this.timer * 0.18) * 4;
    var cy = sy + 13;
    /* Tail fin – tall crescent */
    c.fillStyle = '#5f7489';
    c.beginPath();
    c.moveTo(sx + 54, cy - 2);
    c.quadraticCurveTo(sx + 60 + tail, cy - 16, sx + 66 + tail, cy - 15);
    c.quadraticCurveTo(sx + 60 + tail * 0.5, cy - 4, sx + 64 + tail, cy + 11);
    c.quadraticCurveTo(sx + 58 + tail * 0.5, cy + 6, sx + 54, cy + 3);
    c.closePath();
    c.fill();
    /* Dorsal fin */
    c.beginPath();
    c.moveTo(sx + 24, cy - 8);
    c.quadraticCurveTo(sx + 30, cy - 24, sx + 40, cy - 20);
    c.quadraticCurveTo(sx + 36, cy - 12, sx + 38, cy - 8);
    c.closePath();
    c.fill();
    /* Pectoral fin (far side, darker) */
    c.fillStyle = '#4c6075';
    c.beginPath();
    c.moveTo(sx + 22, cy + 6);
    c.quadraticCurveTo(sx + 28, cy + 20, sx + 40, cy + 18);
    c.quadraticCurveTo(sx + 32, cy + 10, sx + 32, cy + 6);
    c.closePath();
    c.fill();
    /* Body – spindle with a grey back and white belly */
    var g = c.createLinearGradient(0, cy - 12, 0, cy + 12);
    g.addColorStop(0, '#8ea2b6');
    g.addColorStop(0.5, '#6a7f94');
    g.addColorStop(0.62, '#e8eef4');
    g.addColorStop(1, '#c9d4de');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx, cy + 1);
    c.quadraticCurveTo(sx + 10, cy - 13, sx + 34, cy - 11);
    c.quadraticCurveTo(sx + 50, cy - 9, sx + 58, cy);
    c.quadraticCurveTo(sx + 50, cy + 10, sx + 34, cy + 12);
    c.quadraticCurveTo(sx + 10, cy + 13, sx, cy + 1);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(30, 45, 60, 0.6)';
    c.lineWidth = 1;
    c.stroke();
    /* Gill slits */
    c.strokeStyle = 'rgba(40, 55, 70, 0.7)';
    c.lineWidth = 1.2;
    for (var gl = 0; gl < 3; gl++) {
      c.beginPath();
      c.moveTo(sx + 17 + gl * 3, cy - 4);
      c.quadraticCurveTo(sx + 15 + gl * 3, cy, sx + 17 + gl * 3, cy + 5);
      c.stroke();
    }
    /* Mouth with a zigzag of teeth */
    c.strokeStyle = '#2a3a4a';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(sx + 2, cy + 4);
    c.quadraticCurveTo(sx + 8, cy + 8, sx + 16, cy + 6);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (var t = 0; t < 5; t++) {
      var tx = sx + 4 + t * 2.6;
      c.moveTo(tx, cy + 5 + t * 0.4);
      c.lineTo(tx + 1.3, cy + 8 + t * 0.3);
      c.lineTo(tx + 2.6, cy + 5 + t * 0.4);
    }
    c.fill();
    /* Eye – small, with a hard stare */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 10, cy - 3, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#10161c';
    c.beginPath(); c.arc(sx + 9.4, cy - 2.6, 1.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 8.8, cy - 3.4, 0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a3a4a';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(sx + 6, cy - 8); c.lineTo(sx + 13, cy - 5.5); c.stroke();
    /* Near-side pectoral fin */
    c.fillStyle = '#7d91a5';
    c.beginPath();
    c.moveTo(sx + 26, cy + 5);
    c.quadraticCurveTo(sx + 24, cy + 18, sx + 36, cy + 16);
    c.quadraticCurveTo(sx + 34, cy + 9, sx + 36, cy + 5);
    c.closePath();
    c.fill();
    c.restore();
  };

  /* ========== MINI-BOSS ========== */
  /* Smaller guardians for the first two reefs. Shares Moni's interface
     (activate / update / hit / draw / drawProjectiles / drawHealthBar,
     plus the dialogue fields) so the engine's boss code is polymorphic.
       'giantOctopus' – hovers, lunges at Momoko, spits ink blobs
       'kingCrab'     – scuttles along the sand, flings shell pellets */
  function MiniBoss(x, y, species) {
    this.species = species || 'giantOctopus';
    this.isMini = true;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    if (this.species === 'kingCrab') { this.w = 96; this.h = 60; }
    else { this.w = 84; this.h = 84; }
    this.hp = 8;
    this.maxHp = 8;
    this.phase = 1;
    this.active = false;
    this.defeated = false;
    this.defeatTimer = 0;
    this.timer = 0;
    this.attackTimer = 0;
    this.flash = 0;
    this.projectiles = [];
    this.vx = 0;
    this.vy = 0;
    this.mode = 'hover';
    this.modeTimer = 0;
    this.tentaclePhase = 0;
    this.legPhase = 0;
    this.facing = -1;
    this.floorY = 440;
    this.hasChallenged = false;
    this.hasTaunted = false;
    this.dialogueQueue = [];
    this.talkText = '';
    this.talkSpeaker = '';
    this.talkTimer = 0;
    var crab = this.species === 'kingCrab';
    this.nameKey = crab ? 'kingCrabName' : 'octoName';
    this.hpKey = crab ? 'kingCrabHP' : 'octoHP';
    this.tauntKey = crab ? 'kingCrabTaunt' : 'octoTaunt';
    this.defeatKey = crab ? 'kingCrabDefeat' : 'octoDefeat';
  }

  MiniBoss.prototype.activate = function () {
    this.active = true;
    this.timer = 0;
    if (this.species === 'kingCrab') this.y = this.floorY - this.h;
  };

  MiniBoss.prototype.update = function (px, py) {
    if (!this.active) return;
    if (this.defeated) {
      this.defeatTimer++;
      if (this.species !== 'kingCrab') this.y += 0.6;
      return;
    }
    this.timer++;
    if (this.flash > 0) this.flash--;
    this.tentaclePhase += 0.07;
    this.phase = this.hp <= this.maxHp / 2 ? 2 : 1;
    var cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.facing = px < cx ? -1 : 1;
    this.modeTimer++;
    this.attackTimer++;
    var i, p;

    if (this.species === 'giantOctopus') {
      if (this.mode === 'hover') {
        this.x += (this.homeX + Math.sin(this.timer * 0.015) * 40 - this.x) * 0.05;
        this.y += (this.homeY + Math.cos(this.timer * 0.02) * 28 - this.y) * 0.05;
        if (this.modeTimer > (this.phase === 1 ? 170 : 115)) {
          this.mode = 'lunge';
          this.modeTimer = 0;
          var dx = px - cx, dy = py - cy;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          var sp = this.phase === 1 ? 4.6 : 5.4;
          this.vx = dx / d * sp;
          this.vy = dy / d * sp;
        }
      } else if (this.mode === 'lunge') {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.985;
        this.vy *= 0.985;
        if (this.modeTimer > 50) { this.mode = 'return'; this.modeTimer = 0; }
      } else {
        this.x += (this.homeX - this.x) * 0.04;
        this.y += (this.homeY - this.y) * 0.04;
        if (this.modeTimer > 80) { this.mode = 'hover'; this.modeTimer = 0; }
      }
      if (this.y < 70) this.y = 70;
      if (this.y + this.h > this.floorY - 6) this.y = this.floorY - 6 - this.h;
      if (this.x < this.homeX - 460) this.x = this.homeX - 460;
      if (this.x + this.w > this.homeX + this.w + 120) this.x = this.homeX + 120;
      /* Ink spit */
      if (this.attackTimer >= (this.phase === 1 ? 95 : 65) && this.mode !== 'lunge') {
        this.attackTimer = 0;
        var n = this.phase === 1 ? 1 : 2;
        for (i = 0; i < n; i++) {
          var ang = Math.atan2(py - cy, px - cx) + (n === 1 ? 0 : (i - 0.5) * 0.4);
          this.projectiles.push({ x: cx, y: cy + 10, vx: Math.cos(ang) * 2.4, vy: Math.sin(ang) * 2.4, life: 130, r: 7, kind: 'ink', spin: Math.random() * 6 });
        }
      }
    } else {
      /* King crab: scuttles on the sand toward Momoko's x */
      var target = px - this.w / 2;
      var step = (target - this.x) * 0.02;
      var maxStep = this.phase === 1 ? 1.5 : 2.2;
      if (step > maxStep) step = maxStep;
      if (step < -maxStep) step = -maxStep;
      this.x += step;
      this.legPhase += Math.abs(step) * 0.35 + 0.02;
      if (this.x < this.homeX - 420) this.x = this.homeX - 420;
      if (this.x > this.homeX + 80) this.x = this.homeX + 80;
      this.y = this.floorY - this.h + Math.abs(Math.sin(this.legPhase * 2)) * 1.5;
      /* Fling a fan of shell pellets that arc down under gravity */
      if (this.attackTimer >= (this.phase === 1 ? 115 : 80)) {
        this.attackTimer = 0;
        var dir = this.facing;
        var count = this.phase === 1 ? 3 : 4;
        for (i = 0; i < count; i++) {
          var a = -Math.PI / 2 + dir * (0.35 + i * 0.28);
          var spd = 4.2 + i * 0.3;
          this.projectiles.push({ x: cx + dir * 30, y: this.y + 14, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, g: 0.09, life: 160, r: 6, kind: 'shell', spin: Math.random() * 6 });
        }
      }
    }

    for (i = this.projectiles.length - 1; i >= 0; i--) {
      p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.g) p.vy += p.g;
      p.spin += 0.15;
      p.life--;
      if (p.life <= 0 || p.y > this.floorY + 10) this.projectiles.splice(i, 1);
    }
  };

  MiniBoss.prototype.hit = function () {
    if (this.defeated) return false;
    this.hp--;
    this.flash = 8;
    Game.audio.play('enemyHit');
    if (this.hp <= 0) {
      this.defeated = true;
      this.defeatTimer = 0;
      this.projectiles = [];
      Game.audio.play('enemyDefeat');
      return true;
    }
    return false;
  };

  MiniBoss.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    if (this.flash > 0 && this.flash % 2 === 0) {
      this.drawProjectiles(c, camX, camY);
      return;
    }
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    c.save();
    if (this.defeated) c.globalAlpha = Math.max(0, 1 - this.defeatTimer / 120);
    if (this.species === 'kingCrab') drawKingCrab(c, sx, sy, this);
    else drawGiantOctopus(c, sx, sy, this);
    c.restore();
    this.drawProjectiles(c, camX, camY);
  };

  function drawGiantOctopus(c, sx, sy, b) {
    var tp = b.tentaclePhase;
    var lunging = b.mode === 'lunge';
    c.save();
    /* Inky aura */
    var acx = sx + 42, acy = sy + 40;
    var ar = 70 + Math.sin(b.timer * 0.07) * 5;
    var ag = c.createRadialGradient(acx, acy, 10, acx, acy, ar);
    ag.addColorStop(0, 'rgba(90, 30, 140, 0.35)');
    ag.addColorStop(1, 'rgba(60, 10, 90, 0)');
    c.fillStyle = ag;
    c.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);

    c.translate(sx, sy);
    if (b.facing === 1) { c.translate(84, 0); c.scale(-1, 1); }
    c.lineCap = 'round';
    /* Eight tentacles fanning out and down, far ones darker; they trail
       behind when lunging */
    for (var i = 0; i < 8; i++) {
      var far = i % 2 === 1;
      var baseX = 14 + i * 8;
      var spread = (i - 3.5) * 7;
      var w1 = Math.sin(tp + i * 0.8) * 10;
      var w2 = Math.cos(tp * 1.3 + i * 0.5) * 8;
      var drag = lunging ? -b.vx * 2 : 0;
      var x0 = baseX, y0 = 56;
      var x1 = baseX + spread * 0.6 + w1 + drag, y1 = 68;
      var x2 = baseX + spread + w2 * 0.6 + drag * 1.5, y2 = 80 - (lunging ? b.vy * 2 : 0);
      var x3 = baseX + spread * 1.4 + w1 * 0.5 + drag * 2, y3 = 90 + Math.sin(tp + i) * 3;
      c.strokeStyle = far ? '#5a2384' : '#8f44c8';
      c.lineWidth = far ? 7 : 9;
      c.beginPath();
      c.moveTo(x0, y0);
      c.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      c.stroke();
      c.strokeStyle = far ? '#6e3099' : '#b06ae0';
      c.lineWidth = far ? 3 : 4;
      c.beginPath();
      c.moveTo(x0, y0 - 1);
      c.bezierCurveTo(x1, y1 - 1, x2, y2 - 1, x3, y3 - 1);
      c.stroke();
      if (!far) {
        c.fillStyle = '#efc8ff';
        for (var s = 1; s <= 3; s++) {
          var t = s * 0.27, mt = 1 - t;
          var bx = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
          var by = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
          c.beginPath(); c.arc(bx + 2, by + 1, 1.6, 0, Math.PI * 2); c.fill();
        }
      }
    }
    /* Mantle */
    var g = c.createRadialGradient(28, 18, 4, 42, 34, 46);
    g.addColorStop(0, '#dfb0ff');
    g.addColorStop(0.5, '#a85be0');
    g.addColorStop(1, '#5a2184');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(4, 44);
    c.bezierCurveTo(0, 10, 24, -2, 42, 0);
    c.bezierCurveTo(60, -2, 86, 10, 80, 44);
    c.quadraticCurveTo(76, 60, 42, 62);
    c.quadraticCurveTo(8, 60, 4, 44);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(40, 10, 60, 0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    /* Lighter face plate */
    c.fillStyle = 'rgba(245, 215, 255, 0.35)';
    c.beginPath(); c.ellipse(42, 50, 28, 9, 0, 0, Math.PI * 2); c.fill();
    /* Speckles */
    c.fillStyle = 'rgba(70, 15, 110, 0.4)';
    var spots = [[16, 20, 4], [30, 8, 3], [56, 6, 3.4], [68, 22, 4.2], [48, 16, 2.4], [22, 34, 2.6], [64, 36, 2.8]];
    for (var sp = 0; sp < spots.length; sp++) {
      c.beginPath(); c.arc(spots[sp][0], spots[sp][1], spots[sp][2], 0, Math.PI * 2); c.fill();
    }
    /* Highlight */
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.beginPath(); c.ellipse(26, 14, 10, 5, -0.6, 0, Math.PI * 2); c.fill();
    /* Eyes – big, with angry brows and red-rimmed irises */
    var eyes = [[28, 38], [58, 38]];
    for (var e = 0; e < 2; e++) {
      var ex = eyes[e][0], ey = eyes[e][1];
      c.fillStyle = '#fff6ff';
      c.beginPath(); c.arc(ex, ey, 9.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(60, 10, 80, 0.5)';
      c.lineWidth = 1.2;
      c.stroke();
      c.fillStyle = '#d8b030';
      c.beginPath(); c.arc(ex + (b.facing === 1 ? -1.5 : 1.5), ey + 1, 5.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0a22';
      c.beginPath(); c.ellipse(ex + 1.5, ey + 1, 2.6, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(ex - 2, ey - 3, 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a0a3a';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(ex - 9, ey - 12 + (e === 0 ? 0 : 5));
      c.lineTo(ex + 9, ey - 12 + (e === 0 ? 5 : 0));
      c.stroke();
    }
    /* Beak */
    c.fillStyle = '#2a0a3a';
    c.beginPath(); c.moveTo(36, 54); c.lineTo(48, 54); c.lineTo(42, 61); c.closePath(); c.fill();
    c.fillStyle = '#4a1a5a';
    c.beginPath(); c.moveTo(38, 54); c.lineTo(46, 54); c.lineTo(42, 58); c.closePath(); c.fill();
    c.restore();
  }

  function drawKingCrab(c, sx, sy, b) {
    c.save();
    c.translate(sx, sy);
    if (b.facing === 1) { c.translate(96, 0); c.scale(-1, 1); }
    c.lineCap = 'round';
    c.lineJoin = 'round';
    var cx = 48, cy = 36;
    /* Shadow on the sand */
    c.fillStyle = 'rgba(4, 14, 26, 0.4)';
    c.beginPath(); c.ellipse(cx, 62, 48, 6, 0, 0, Math.PI * 2); c.fill();
    /* Legs – three per side, two segments, animated with legPhase */
    for (var side = -1; side <= 1; side += 2) {
      for (var l = 0; l < 3; l++) {
        var ph = b.legPhase + l * 1.1 + (side > 0 ? Math.PI / 2 : 0);
        var lift = Math.max(0, Math.sin(ph)) * 5;
        var hipX = cx + side * (16 + l * 9), hipY = cy + 10;
        var kneeX = hipX + side * (14 + l * 3), kneeY = hipY - 2 - lift;
        var footX = kneeX + side * (6 + l * 2) + Math.cos(ph) * 3, footY = 58 - lift;
        c.strokeStyle = '#8a2a14';
        c.lineWidth = 5;
        c.beginPath(); c.moveTo(hipX, hipY); c.lineTo(kneeX, kneeY); c.lineTo(footX, footY); c.stroke();
        c.strokeStyle = '#e8603a';
        c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(hipX, hipY - 1); c.lineTo(kneeX, kneeY - 1); c.lineTo(footX, footY - 1); c.stroke();
        c.fillStyle = '#3a0e08';
        c.beginPath(); c.moveTo(footX - 2, footY); c.lineTo(footX + 2, footY); c.lineTo(footX + side, footY + 4); c.closePath(); c.fill();
      }
    }
    /* Carapace – wide dome with spikes along the back */
    var g = c.createRadialGradient(cx - 14, cy - 12, 4, cx, cy, 46);
    g.addColorStop(0, '#ffb07a');
    g.addColorStop(0.45, '#ec6a3a');
    g.addColorStop(1, '#8a2410');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx - 42, cy + 8);
    c.quadraticCurveTo(cx - 44, cy - 20, cx, cy - 24);
    c.quadraticCurveTo(cx + 44, cy - 20, cx + 42, cy + 8);
    c.quadraticCurveTo(cx, cy + 26, cx - 42, cy + 8);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(70, 15, 5, 0.6)';
    c.lineWidth = 1.5;
    c.stroke();
    /* Spikes */
    c.fillStyle = '#ffd0a8';
    var spikes = [[-34, -4], [-24, -14], [-12, -20], [12, -20], [24, -14], [34, -4]];
    for (var s = 0; s < spikes.length; s++) {
      var spx = cx + spikes[s][0], spy = cy + spikes[s][1];
      c.beginPath(); c.moveTo(spx - 4, spy + 3); c.lineTo(spx, spy - 6); c.lineTo(spx + 4, spy + 3); c.closePath(); c.fill();
    }
    /* Shell texture bumps and a bright rim */
    c.fillStyle = 'rgba(255, 220, 190, 0.25)';
    var bumps = [[-20, -2], [-6, -8], [10, -6], [22, 0], [0, 6], [-14, 8], [16, 10]];
    for (var bb = 0; bb < bumps.length; bb++) {
      c.beginPath(); c.arc(cx + bumps[bb][0], cy + bumps[bb][1], 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.3)';
    c.beginPath(); c.ellipse(cx - 18, cy - 12, 12, 4.5, -0.3, 0, Math.PI * 2); c.fill();
    /* Underside plate */
    c.fillStyle = '#c84a24';
    c.beginPath(); c.ellipse(cx, cy + 14, 30, 7, 0, 0, Math.PI); c.fill();
    /* Claws – the near claw snaps; arm then two pincer halves */
    var snap = Math.max(0, Math.sin(b.timer * 0.12)) * 0.5;
    for (var k = -1; k <= 1; k += 2) {
      var armX = cx + k * 40, armY = cy + 2;
      var clawX = cx + k * 58, clawY = cy - 4;
      c.strokeStyle = '#a4321a';
      c.lineWidth = 8;
      c.beginPath(); c.moveTo(armX, armY); c.quadraticCurveTo(cx + k * 52, cy + 12, clawX, clawY + 6); c.stroke();
      c.strokeStyle = '#f07a4a';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(armX, armY - 1); c.quadraticCurveTo(cx + k * 52, cy + 10, clawX, clawY + 4); c.stroke();
      c.save();
      c.translate(clawX, clawY + 4);
      if (k === 1) c.scale(-1, 1);
      var open = k === -1 ? snap : snap * 0.4;
      var cg = c.createLinearGradient(0, -14, 0, 10);
      cg.addColorStop(0, '#ff9a6a');
      cg.addColorStop(1, '#a4321a');
      c.fillStyle = cg;
      /* Fixed lower finger */
      c.beginPath();
      c.moveTo(6, 2);
      c.quadraticCurveTo(-4, 8, -16, 4);
      c.quadraticCurveTo(-18, 10, -10, 12);
      c.quadraticCurveTo(0, 12, 8, 8);
      c.closePath();
      c.fill();
      /* Moving upper finger */
      c.save();
      c.rotate(-open);
      c.beginPath();
      c.moveTo(6, 2);
      c.quadraticCurveTo(-4, -6, -16, -2);
      c.quadraticCurveTo(-18, -10, -8, -12);
      c.quadraticCurveTo(4, -12, 8, -4);
      c.closePath();
      c.fill();
      c.restore();
      /* Palm */
      c.beginPath(); c.ellipse(6, 0, 9, 10, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(70, 15, 5, 0.55)';
      c.lineWidth = 1.2;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.beginPath(); c.ellipse(4, -4, 4, 2, -0.5, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    /* Eye stalks with grumpy eyes */
    for (var e = -1; e <= 1; e += 2) {
      var stX = cx + e * 9, topY = cy - 32 + Math.sin(b.timer * 0.05 + e) * 1.5;
      c.strokeStyle = '#a4321a';
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx + e * 7, cy - 20); c.lineTo(stX, topY); c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(stX, topY - 2, 5.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0a08';
      c.beginPath(); c.arc(stX - 1.5, topY - 1, 2.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(stX - 2.5, topY - 3, 1, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#3a0e08';
      c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(stX - 6, topY - 9 + (e === -1 ? 0 : 3)); c.lineTo(stX + 6, topY - 9 + (e === -1 ? 3 : 0)); c.stroke();
    }
    /* Mouth – zigzag */
    c.strokeStyle = '#3a0e08';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(cx - 8, cy + 4);
    for (var m = 0; m < 4; m++) c.lineTo(cx - 8 + (m + 1) * 4, cy + 4 + (m % 2 ? 0 : 3));
    c.stroke();
    /* Crown – he is the king, after all */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.moveTo(cx - 12, cy - 22);
    c.lineTo(cx - 10, cy - 34);
    c.lineTo(cx - 5, cy - 27);
    c.lineTo(cx, cy - 37);
    c.lineTo(cx + 5, cy - 27);
    c.lineTo(cx + 10, cy - 34);
    c.lineTo(cx + 12, cy - 22);
    c.closePath();
    c.fill();
    c.strokeStyle = '#8a5a10';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#ff3366';
    c.beginPath(); c.arc(cx, cy - 25, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#44ccff';
    c.beginPath(); c.arc(cx - 7, cy - 25, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 7, cy - 25, 1.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  MiniBoss.prototype.drawProjectiles = function (c, camX, camY) {
    c.save();
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      var px = p.x - camX, py = p.y - camY;
      if (p.kind === 'shell') {
        c.save();
        c.translate(px, py);
        c.rotate(p.spin);
        var sg = c.createLinearGradient(0, -6, 0, 6);
        sg.addColorStop(0, '#fff0d8');
        sg.addColorStop(1, '#d4915c');
        c.fillStyle = sg;
        c.beginPath(); c.arc(0, 1, 6, Math.PI, 0); c.lineTo(2, 5); c.lineTo(-2, 5); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(120, 70, 40, 0.6)';
        c.lineWidth = 1;
        c.stroke();
        c.beginPath();
        for (var r = -2; r <= 2; r++) { c.moveTo(0, 4); c.lineTo(r * 2.4, -3.5 + Math.abs(r)); }
        c.stroke();
        c.restore();
      } else {
        /* Ink blob with a trailing drip and a purple sheen */
        c.fillStyle = 'rgba(20, 10, 40, 0.55)';
        c.beginPath(); c.arc(px - p.vx * 2.5, py - p.vy * 2.5, p.r * 0.6, 0, Math.PI * 2); c.fill();
        var ig = c.createRadialGradient(px - 2, py - 2, 1, px, py, p.r);
        ig.addColorStop(0, '#6a4aa0');
        ig.addColorStop(1, '#120826');
        c.fillStyle = ig;
        c.beginPath();
        c.arc(px, py, p.r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath(); c.arc(px - p.r * 0.35, py - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  };

  MiniBoss.prototype.drawHealthBar = function (c) {
    if (!this.active || this.defeated) return;
    drawBossBar(c, this.hp, this.maxHp, Game.i18n.t(this.hpKey), BOSS_BAR_PALETTES[this.species] || BOSS_BAR_PALETTES.moni);
  };

  /* ========== EXPORTS ========== */
  window.Game.entities = {
    Momoko: Momoko,
    Bubble: Bubble,
    Fish: Fish,
    Octopus: Octopus,
    Moni: Moni,
    Oliver: Oliver,
    KittyCorn: KittyCorn,
    Bob: Bob,
    Crab: Crab,
    Wolfe: Wolfe,
    HeartPickup: HeartPickup,
    Pearl: Pearl,
    Chest: Chest,
    Jellyfish: Jellyfish,
    Eel: Eel,
    Shark: Shark,
    MiniBoss: MiniBoss,
    getPearlSprite: getPearlSprite,
    Particle: Particle,
    AmbientBubble: AmbientBubble,
    spawnBurst: spawnBurst,
    drawMomokoSprite: drawMomokoSprite,
    drawMomokoFloss: drawMomokoFloss,
    drawCrabPet: drawCrabPet,
  };
})();
