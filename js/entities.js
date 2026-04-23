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
    /* Soft-clamped sigmoid (tanh of a boosted sine) gives smooth in-
       between frames while still "holding" near ±1 at each beat, so
       the pose reads as floss instead of a lazy hula. `beat` is used
       in the drawing math where it treats the value as a scalar
       displacement – any value in [-1, 1] is fine. */
    var beat = Math.tanh(Math.sin(phase) * 3.2);
    /* Secondary bob that never zeroes out, for subtle motion during
       the "hold" portion of each beat. */
    var ease = Math.sin(phase * 2) * 0.3;
    var hipShift = beat * 2;
    var bodyTilt = beat * 0.08;

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

    /* Floss arms: both swing to the same side (the hallmark of the move).
       When beat=+1, both arms cross to the right side of the body; when
       beat=-1, to the left. Arms drawn as stubby stick-figure segments
       with skin-tone hands. */
    c.strokeStyle = skinC;
    c.lineWidth = 3;
    c.lineCap = 'round';
    var armDir = -beat; /* opposite to hips */
    /* Top arm – goes across the front of the body */
    c.beginPath();
    c.moveTo(14 - armDir * 4, 22);
    c.lineTo(14 + armDir * 9, 21 + ease);
    c.stroke();
    /* Bottom arm – goes across behind the body (lower) */
    c.beginPath();
    c.moveTo(14 + armDir * 4, 23);
    c.lineTo(14 - armDir * 9, 26 - ease);
    c.stroke();
    /* Hands */
    c.fillStyle = skinC;
    c.beginPath(); c.arc(14 + armDir * 10, 21 + ease, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14 - armDir * 10, 26 - ease, 1.8, 0, Math.PI * 2); c.fill();

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
    c.save();
    c.globalAlpha = 0.8;
    c.fillStyle = 'hsl(' + this.hue + ',90%,65%)';
    c.beginPath();
    c.arc(sx, sy, this.r, 0, Math.PI * 2);
    c.fill();
    /* Highlight */
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.arc(sx - 2, sy - 2, 2, 0, Math.PI * 2);
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
      this.color = '#3a5a78';
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

  function drawTropicalFish(c, sx, sy, color) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(sx + 12, sy + 8, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(sx + 22, sy + 8);
    c.lineTo(sx + 28, sy + 2);
    c.lineTo(sx + 28, sy + 14);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 6, sy + 6, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 5, sy + 6, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = color;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.moveTo(sx + 10, sy + 3);
    c.lineTo(sx + 14, sy - 3);
    c.lineTo(sx + 18, sy + 3);
    c.closePath();
    c.fill();
  }

  function drawSwordfish(c, sx, sy, color, timer) {
    /* Long slender body */
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(sx + 18, sy + 7, 16, 5, 0, 0, Math.PI * 2);
    c.fill();
    /* Silver belly stripe */
    c.fillStyle = '#b9cddf';
    c.beginPath();
    c.ellipse(sx + 18, sy + 9, 14, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Bill (long pointed snout) */
    c.strokeStyle = '#2a3f55';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(sx + 2, sy + 7);
    c.lineTo(sx - 10, sy + 7);
    c.stroke();
    /* Dorsal fin */
    c.fillStyle = '#2f4a63';
    c.beginPath();
    c.moveTo(sx + 12, sy + 3);
    c.lineTo(sx + 18, sy - 4);
    c.lineTo(sx + 22, sy + 3);
    c.closePath();
    c.fill();
    /* Tail – crescent */
    c.beginPath();
    c.moveTo(sx + 32, sy + 7);
    c.lineTo(sx + 38, sy - 1);
    c.lineTo(sx + 35, sy + 7);
    c.lineTo(sx + 38, sy + 15);
    c.closePath();
    c.fill();
    /* Eye */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 5, sy + 6, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 4.5, sy + 6, 1, 0, Math.PI * 2); c.fill();
  }

  function drawBlowfish(c, sx, sy, color, timer) {
    /* Puff up and down so it feels alive */
    var puff = 1 + Math.sin(timer * 0.06) * 0.08;
    var cx = sx + 13, cy = sy + 12;
    var r = 11 * puff;
    /* Spikes first (behind body) */
    c.strokeStyle = '#8a6a20';
    c.lineWidth = 1.5;
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      c.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
      c.stroke();
    }
    /* Body */
    c.fillStyle = color;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    /* Spots */
    c.fillStyle = '#8a6a20';
    c.beginPath(); c.arc(cx - 3, cy - 3, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 4, cy + 1, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx - 1, cy + 4, 1.2, 0, Math.PI * 2); c.fill();
    /* Tiny tail */
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(cx + r - 1, cy);
    c.lineTo(cx + r + 5, cy - 3);
    c.lineTo(cx + r + 5, cy + 3);
    c.closePath();
    c.fill();
    /* Eye */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - 5, cy - 2, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(cx - 5.5, cy - 2, 1.2, 0, Math.PI * 2); c.fill();
    /* Pouty mouth */
    c.strokeStyle = '#663311';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx - 9, cy + 2, 1.5, -0.4, 0.4);
    c.stroke();
  }

  function drawClownfish(c, sx, sy, timer) {
    /* Orange body */
    c.fillStyle = '#ff7a22';
    c.beginPath();
    c.ellipse(sx + 12, sy + 8, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    /* Three white stripes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 6,  sy + 8, 1.8, 6.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 13, sy + 8, 1.8, 6.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 19, sy + 8, 1.4, 5.8, 0, 0, Math.PI * 2); c.fill();
    /* Black stripe outlines for pop */
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 0.8;
    c.beginPath(); c.ellipse(sx + 6,  sy + 8, 1.8, 6.2, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(sx + 13, sy + 8, 1.8, 6.6, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(sx + 19, sy + 8, 1.4, 5.8, 0, 0, Math.PI * 2); c.stroke();
    /* Tail */
    c.fillStyle = '#ff7a22';
    c.beginPath();
    c.moveTo(sx + 22, sy + 8);
    c.lineTo(sx + 28, sy + 2);
    c.lineTo(sx + 28, sy + 14);
    c.closePath();
    c.fill();
    /* Fin */
    c.globalAlpha = 0.85;
    c.beginPath();
    c.moveTo(sx + 10, sy + 3);
    c.lineTo(sx + 14, sy - 3);
    c.lineTo(sx + 18, sy + 3);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    /* Eye */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 4, sy + 6, 2.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 3.5, sy + 6, 1.1, 0, Math.PI * 2); c.fill();
  }

  function drawAngelfish(c, sx, sy, color, timer) {
    /* Tall disc-shaped body */
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(sx + 11, sy + 11, 9, 10, 0, 0, Math.PI * 2);
    c.fill();
    /* Vertical dark stripes */
    c.fillStyle = 'rgba(80, 50, 20, 0.7)';
    c.fillRect(sx + 7, sy + 2, 1.5, 18);
    c.fillRect(sx + 12, sy + 2, 1.5, 18);
    /* Top trailing fin */
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(sx + 10, sy + 2);
    c.quadraticCurveTo(sx + 6, sy - 8, sx + 14, sy - 6);
    c.closePath();
    c.fill();
    /* Bottom trailing fin */
    c.beginPath();
    c.moveTo(sx + 10, sy + 20);
    c.quadraticCurveTo(sx + 6, sy + 30, sx + 14, sy + 28);
    c.closePath();
    c.fill();
    /* Tail */
    c.beginPath();
    c.moveTo(sx + 19, sy + 11);
    c.lineTo(sx + 26, sy + 5);
    c.lineTo(sx + 26, sy + 17);
    c.closePath();
    c.fill();
    /* Eye */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 5, sy + 9, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 4.5, sy + 9, 1, 0, Math.PI * 2); c.fill();
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

    /* Tentacles – wavy bezier curves */
    c.strokeStyle = '#9944cc';
    c.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var tx = sx + 3 + i * 3.5;
      var wave1 = Math.sin(tp + i * 0.8) * 6;
      var wave2 = Math.cos(tp + i * 0.5) * 4;
      c.lineWidth = 3.5 - i * 0.2;
      c.beginPath();
      c.moveTo(tx, sy + 20);
      c.bezierCurveTo(tx + wave1, sy + 26, tx - wave2, sy + 30, tx + wave1 * 0.5, sy + 34);
      c.stroke();
    }

    /* Head */
    c.fillStyle = '#aa55dd';
    c.beginPath();
    c.ellipse(sx + 15, sy + 12, 15, 12, 0, 0, Math.PI * 2);
    c.fill();

    /* Spots */
    c.fillStyle = '#cc77ee';
    c.beginPath(); c.arc(sx + 8, sy + 8, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 10, 2, 0, Math.PI * 2); c.fill();

    /* Eyes – round with pupils */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 10, sy + 13, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 13, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#220033';
    c.beginPath(); c.arc(sx + 10, sy + 14, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 14, 2, 0, Math.PI * 2); c.fill();

    /* Angry eyebrows – arcs */
    c.strokeStyle = '#220033';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx + 10, sy + 11, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.stroke();
    c.beginPath();
    c.arc(sx + 20, sy + 11, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.stroke();
  };

  /* ========== MONI (Boss) ========== */
  function Moni(x, y) {
    this.x = x;
    this.y = y;
    this.w = 44;
    this.h = 60;
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

    /* Tail – flowing bezier mermaid tail */
    c.fillStyle = '#7733aa';
    var tailWave = Math.sin(this.tailPhase) * 6;
    c.beginPath();
    c.moveTo(sx + 10, sy + 36);
    c.lineTo(sx + 34, sy + 36);
    c.bezierCurveTo(sx + 34, sy + 44, sx + 30 + tailWave, sy + 50, sx + 36, sy + 58);
    c.quadraticCurveTo(sx + 38, sy + 62, sx + 34, sy + 64);
    c.lineTo(sx + 10, sy + 64);
    c.quadraticCurveTo(sx + 6, sy + 62, sx + 8, sy + 58);
    c.bezierCurveTo(sx + 14 + tailWave, sy + 50, sx + 10, sy + 44, sx + 10, sy + 36);
    c.closePath();
    c.fill();

    /* Tail fin */
    c.fillStyle = '#6622aa';
    c.beginPath();
    c.moveTo(sx + 16, sy + 60);
    c.quadraticCurveTo(sx + 6, sy + 66 + tailWave, sx + 2, sy + 64);
    c.quadraticCurveTo(sx + 8, sy + 60, sx + 16, sy + 60);
    c.fill();
    c.beginPath();
    c.moveTo(sx + 28, sy + 60);
    c.quadraticCurveTo(sx + 38, sy + 66 + tailWave, sx + 42, sy + 64);
    c.quadraticCurveTo(sx + 36, sy + 60, sx + 28, sy + 60);
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
    c.bezierCurveTo(sx + 2, sy + 12, sx + 3, sy + 20, sx + 6, sy + 26);
    c.lineTo(sx + 10, sy + 24);
    c.bezierCurveTo(sx + 8, sy + 16, sx + 8, sy + 10, sx + 10, sy + 6);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 38, sy + 6);
    c.bezierCurveTo(sx + 42, sy + 12, sx + 41, sy + 20, sx + 38, sy + 26);
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

  Moni.prototype.drawHealthBar = function (c) {
    if (!this.active || this.defeated) return;
    var barW = 200;
    var barH = 12;
    var bx = (W - barW) / 2;
    var by = 14;
    /* Background */
    c.fillStyle = '#330033';
    c.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    /* Bar */
    c.fillStyle = '#882288';
    c.fillRect(bx, by, barW, barH);
    c.fillStyle = '#cc44cc';
    c.fillRect(bx, by, barW * (this.hp / this.maxHp), barH);
    /* Label */
    c.fillStyle = '#ffffff';
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('bossHP'), W / 2, by + 10);
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

    c.save();
    /* Body */
    c.fillStyle = '#996633';
    c.beginPath();
    c.ellipse(sx + 14, sy + 12, 14, 10, 0, 0, Math.PI * 2);
    c.fill();

    /* Belly */
    c.fillStyle = '#ccaa77';
    c.beginPath();
    c.ellipse(sx + 14, sy + 14, 8, 6, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#996633';
    c.beginPath();
    c.arc(sx + 6, sy + 5, 8, 0, Math.PI * 2);
    c.fill();

    /* Ears */
    c.fillStyle = '#885522';
    c.beginPath(); c.arc(sx + 1, sy + 0, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 11, sy + 0, 3, 0, Math.PI * 2); c.fill();

    /* Eyes */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 4, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9, sy + 5, 2, 0, Math.PI * 2); c.fill();
    /* Highlights */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 4, sy + 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9, sy + 4, 0.8, 0, Math.PI * 2); c.fill();

    /* Nose */
    c.fillStyle = '#333333';
    c.beginPath(); c.arc(sx + 6, sy + 7, 1.5, 0, Math.PI * 2); c.fill();

    /* Whiskers */
    c.strokeStyle = '#664422';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 0, sy + 6); c.lineTo(sx - 5, sy + 5);
    c.moveTo(sx + 0, sy + 8); c.lineTo(sx - 5, sy + 9);
    c.moveTo(sx + 12, sy + 6); c.lineTo(sx + 17, sy + 5);
    c.moveTo(sx + 12, sy + 8); c.lineTo(sx + 17, sy + 9);
    c.stroke();

    /* Tail – tapered bezier */
    c.fillStyle = '#885522';
    var tailWag = Math.sin(this.timer * 0.1) * 3;
    c.beginPath();
    c.moveTo(sx + 24, sy + 10);
    c.quadraticCurveTo(sx + 30, sy + 8 + tailWag, sx + 33, sy + 6 + tailWag);
    c.quadraticCurveTo(sx + 31, sy + 12 + tailWag, sx + 28, sy + 13);
    c.closePath();
    c.fill();

    /* Paws – rounded */
    c.fillStyle = '#885522';
    c.beginPath();
    c.ellipse(sx + 6, sy + 20, 3, 2.5, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 20, sy + 20, 3, 2.5, 0, 0, Math.PI * 2);
    c.fill();

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

    c.save();
    if (this.dir === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    /* Body */
    c.fillStyle = '#cc9933';
    c.beginPath();
    c.ellipse(sx + 15, sy + 10, 14, 8, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#cc9933';
    c.beginPath();
    c.arc(sx + 4, sy + 5, 7, 0, Math.PI * 2);
    c.fill();

    /* Ear */
    c.fillStyle = '#aa7722';
    c.beginPath();
    c.moveTo(sx + 0, sy + 0);
    c.quadraticCurveTo(sx - 2, sy - 4, sx - 3, sy - 5);
    c.quadraticCurveTo(sx + 1, sy - 2, sx + 4, sy + 0);
    c.closePath();
    c.fill();

    /* Eye */
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx + 3, sy + 4, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(sx + 3, sy + 3.5, 0.5, 0, Math.PI * 2); c.fill();

    /* Nose */
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx - 1, sy + 6, 1.5, 0, Math.PI * 2); c.fill();

    /* Tongue (panting) – rounded end */
    if (Math.sin(this.timer * 0.1) > 0) {
      c.fillStyle = '#ff8899';
      c.beginPath();
      c.moveTo(sx - 1, sy + 7);
      c.lineTo(sx + 2, sy + 7);
      c.quadraticCurveTo(sx + 2, sy + 11, sx + 0.5, sy + 11);
      c.quadraticCurveTo(sx - 1, sy + 11, sx - 1, sy + 7);
      c.closePath();
      c.fill();
    }

    /* Legs – tapered with rounded paws */
    c.fillStyle = '#cc9933';
    var legs = [
      { x: sx + 6, off: legOff },
      { x: sx + 12, off: -legOff },
      { x: sx + 20, off: -legOff },
      { x: sx + 26, off: legOff }
    ];
    for (var li = 0; li < legs.length; li++) {
      var lg = legs[li];
      c.beginPath();
      c.moveTo(lg.x, sy + 16);
      c.lineTo(lg.x + 4, sy + 16);
      c.lineTo(lg.x + 3.5, sy + 21 + lg.off);
      c.quadraticCurveTo(lg.x + 2, sy + 23 + lg.off, lg.x + 0.5, sy + 21 + lg.off);
      c.closePath();
      c.fill();
    }

    /* Tail */
    c.fillStyle = '#cc9933';
    var tailWag = Math.sin(this.timer * 0.15) * 5;
    c.beginPath();
    c.moveTo(sx + 28, sy + 6);
    c.quadraticCurveTo(sx + 34, sy + 2 + tailWag, sx + 32, sy - 2 + tailWag);
    c.lineTo(sx + 30, sy + 0 + tailWag);
    c.quadraticCurveTo(sx + 31, sy + 4, sx + 28, sy + 8);
    c.closePath();
    c.fill();

    /* Collar – curved */
    c.strokeStyle = '#cc3333';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(sx + 4, sy + 9, 6, 0.2, Math.PI - 0.2);
    c.stroke();

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
    c.translate(sx, sy);
    c.scale(pulse, pulse);
    c.fillStyle = '#ff4466';
    c.beginPath();
    c.moveTo(0, 3);
    c.bezierCurveTo(-8, -4, -8, -8, 0, -4);
    c.bezierCurveTo(8, -8, 8, -4, 0, 3);
    c.fill();
    /* Shine */
    c.fillStyle = '#ff88aa';
    c.beginPath();
    c.arc(-3, -3, 2, 0, Math.PI * 2);
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
    Particle: Particle,
    AmbientBubble: AmbientBubble,
    spawnBurst: spawnBurst,
    drawMomokoSprite: drawMomokoSprite,
    drawMomokoFloss: drawMomokoFloss,
    drawCrabPet: drawCrabPet,
  };
})();
