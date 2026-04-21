/* engine.js – game loop, state machine, camera, collision, rendering */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  /* On touch devices we pad the canvas with a control strip on each side of
     the 800×480 game viewport (D-pad on the left, BUBBLE on the right) so
     the landscape-phone aspect ratio stays wide and the thumbs never cover
     the playfield. GAME_X is the x-offset where the game viewport begins
     inside the canvas; the render loop translates by it so game code keeps
     using logical 0..W coordinates. */
  var TOUCH_SIDE_W = 200;
  var CANVAS_W = W;
  var CANVAS_H = H;
  var GAME_X = 0;
  /* Version stamp shown on the title screen. Bump manually at release time. */
  Game.VERSION = 'v1.0.0';
  Game.BUILD = '';
  var canvas, ctx;

  /* ---- Game state ---- */
  var State = {
    TITLE: 'title',
    CUSTOMIZE: 'customize',
    INTRO: 'intro',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    VICTORY: 'victory',
    BEACH: 'beach',
  };
  var state = State.TITLE;
  var prevState = null;

  /* ---- Customization defaults ---- */
  Game.customization = {
    hair: '#e06088',
    suit: '#3366aa',
    skin: '#ffddbb',
    flipper: '#33bb77',
  };

  /* ---- Camera ---- */
  var camera = { x: 0, y: 0 };

  /* ---- Level & entities ---- */
  var level = null;
  var player = null;
  var bubbles = [];
  var enemies = [];
  var npcs = []; /* { entity, type } */
  var pickups = [];
  var particles = [];
  var ambientBubbles = [];
  var boss = null;
  var wolfe = null;
  var bossActivated = false;
  var respawnPos = { x: 0, y: 0 };
  var npcCooldowns = {};
  var beachSeen = false;

  /* ---- Background parallax layers ---- */
  var bgLayers = [];
  var bgFishSchools = [];
  var currentMotes = [];

  function initBgLayers() {
    bgLayers = [];
    /* Layer 0 – distant mountains / reefs */
    var layer0 = [];
    var bgColors0 = ['#0a2040', '#0b2545', '#091e3a'];
    for (var i = 0; i < 30; i++) {
      layer0.push({
        x: i * 200 + Math.random() * 100,
        y: 320 + Math.random() * 80,
        w: 80 + Math.random() * 120,
        h: 40 + Math.random() * 60,
        color: bgColors0[Math.floor(Math.random() * bgColors0.length)],
        blobSeed: Math.random() * 100,
      });
    }
    bgLayers.push({ items: layer0, parallax: 0.15 });

    /* Layer 1 – mid-distance coral silhouettes */
    var layer1 = [];
    var bgColors1 = ['#122a48', '#14304e', '#102540'];
    for (var j = 0; j < 40; j++) {
      layer1.push({
        x: j * 140 + Math.random() * 60,
        y: 350 + Math.random() * 60,
        w: 30 + Math.random() * 50,
        h: 30 + Math.random() * 50,
        color: bgColors1[Math.floor(Math.random() * bgColors1.length)],
        blobSeed: Math.random() * 100,
      });
    }
    bgLayers.push({ items: layer1, parallax: 0.3 });

    /* Layer 2 – closer coral/rock formations */
    var layer2 = [];
    var bgColors2 = ['#1a3858', '#1c3d5e', '#183350'];
    for (var k = 0; k < 20; k++) {
      layer2.push({
        x: k * 280 + Math.random() * 120,
        y: 370 + Math.random() * 40,
        w: 40 + Math.random() * 60,
        h: 25 + Math.random() * 35,
        color: bgColors2[Math.floor(Math.random() * bgColors2.length)],
        blobSeed: Math.random() * 100,
      });
    }
    bgLayers.push({ items: layer2, parallax: 0.5 });

    /* Background fish schools */
    bgFishSchools = [];
    for (var fs = 0; fs < 4; fs++) {
      var school = { x: Math.random() * (level ? level.width : 5600), y: 120 + Math.random() * 200, speed: 0.15 + Math.random() * 0.3, dir: Math.random() > 0.5 ? 1 : -1, fish: [] };
      var count = 8 + Math.floor(Math.random() * 5);
      for (var fi = 0; fi < count; fi++) {
        school.fish.push({ ox: Math.random() * 60 - 30, oy: Math.random() * 30 - 15, phase: Math.random() * Math.PI * 2 });
      }
      bgFishSchools.push(school);
    }

    /* Current motes */
    currentMotes = [];
    for (var cm = 0; cm < 25; cm++) {
      currentMotes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 0.3 + Math.random() * 0.7,
        alpha: 0.08 + Math.random() * 0.12,
        size: 1 + Math.random(),
      });
    }
  }

  /* ---- Ambient bubbles ---- */
  function initAmbientBubbles() {
    ambientBubbles = [];
    for (var i = 0; i < 70; i++) {
      ambientBubbles.push(new Game.entities.AmbientBubble(
        Math.random() * (level ? level.width : W),
        Math.random() * H
      ));
    }
  }

  /* ---- Level loading ---- */
  function loadLevel(index) {
    level = Game.levels.get(index);
    if (!level) return;

    /* Player */
    var sp = level.spawns.player;
    player = new Game.entities.Momoko(sp.x, sp.y);
    respawnPos = { x: sp.x, y: sp.y };

    /* Enemies */
    enemies = [];
    for (var i = 0; i < level.spawns.enemies.length; i++) {
      var e = level.spawns.enemies[i];
      if (e.type === 'fish') {
        enemies.push(new Game.entities.Fish(e.x, e.y, e.pattern, e.dir));
      } else if (e.type === 'octopus') {
        enemies.push(new Game.entities.Octopus(e.x, e.y));
      }
    }

    /* NPCs */
    npcs = [];
    npcCooldowns = {};
    for (var n = 0; n < level.spawns.npcs.length; n++) {
      var nd = level.spawns.npcs[n];
      var npcEntity;
      if (nd.type === 'oliver') npcEntity = new Game.entities.Oliver(nd.x, nd.y);
      else if (nd.type === 'kittycorn') npcEntity = new Game.entities.KittyCorn(nd.x, nd.y);
      else if (nd.type === 'bob') npcEntity = new Game.entities.Bob(nd.x, nd.y);
      if (npcEntity) npcs.push({ entity: npcEntity, type: nd.type });
    }

    /* Pickups */
    pickups = [];
    for (var p = 0; p < level.spawns.pickups.length; p++) {
      var pd = level.spawns.pickups[p];
      pickups.push(new Game.entities.HeartPickup(pd.x, pd.y));
    }

    /* Boss */
    var bd = level.spawns.boss;
    boss = new Game.entities.Moni(bd.x, bd.y);
    bossActivated = false;

    /* Wolfe */
    if (level.wolfe) {
      wolfe = new Game.entities.Wolfe(level.wolfe.x, level.wolfe.y, level.wolfe.patrolWidth);
    }

    /* Bubbles & particles */
    bubbles = [];
    particles = [];

    initBgLayers();
    initAmbientBubbles();
  }

  /* ---- Collision helpers ---- */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    var nearX = Math.max(rx, Math.min(cx, rx + rw));
    var nearY = Math.max(ry, Math.min(cy, ry + rh));
    var dx = cx - nearX;
    var dy = cy - nearY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  /* ---- Update ---- */
  function update() {
    Game.input.update();
    var keys = Game.input.keys;
    var jp = Game.input.justPressed;

    switch (state) {
      case State.TITLE:
        /* Title animation handled by ui.js */
        break;

      case State.CUSTOMIZE:
        /* Customization screen handled by ui.js */
        break;

      case State.INTRO:
        /* Intro backstory handled by ui.js */
        break;

      case State.PLAYING:
        if (jp.pause) { prevState = State.PLAYING; state = State.PAUSED; return; }

        /* Player */
        player.update(keys, level);

        /* Shoot */
        if (keys.action && player.shootCooldown <= 0) {
          var b = player.shoot();
          if (b) bubbles.push(b);
        }

        /* Bubbles */
        for (var bi = bubbles.length - 1; bi >= 0; bi--) {
          bubbles[bi].update();
          if (!bubbles[bi].active) bubbles.splice(bi, 1);
        }

        /* Enemies */
        for (var ei = 0; ei < enemies.length; ei++) {
          enemies[ei].update();
        }

        /* NPCs */
        for (var ni = 0; ni < npcs.length; ni++) {
          npcs[ni].entity.update();
        }

        /* Pickups */
        for (var pi = 0; pi < pickups.length; pi++) {
          pickups[pi].update();
        }

        /* Wolfe */
        if (wolfe) wolfe.update();

        /* Ambient bubbles */
        for (var ab = 0; ab < ambientBubbles.length; ab++) {
          ambientBubbles[ab].update(level.height);
        }

        /* Particles */
        for (var pa = particles.length - 1; pa >= 0; pa--) {
          particles[pa].update();
          if (!particles[pa].active) particles.splice(pa, 1);
        }

        /* Boss */
        if (boss && boss.active) {
          boss.update(player.x + player.w / 2, player.y + player.h / 2);

          /* Music transition */
          if (Game.audio.currentMusic() !== 'boss') {
            Game.audio.startMusic('boss');
          }

          /* Pre-fight: hero challenges first, then Moni snarls back */
          if (!boss.hasChallenged && boss.timer > 20) {
            boss.hasChallenged = true;
            boss.hasTaunted = true;
            boss.dialogueQueue.push({ speaker: 'Momoko', text: Game.i18n.t('heroChallenge'), duration: 110 });
            boss.dialogueQueue.push({ speaker: 'Moni',   text: Game.i18n.t('moniTaunt1'),    duration: 110 });
          }
          /* Mid-fight taunt at ~75% HP */
          if (!boss.hasTaunted3 && !boss.defeated && boss.hp <= boss.maxHp * 0.75) {
            boss.hasTaunted3 = true;
            boss.dialogueQueue.push({ speaker: 'Moni', text: Game.i18n.t('moniTaunt3'), duration: 100 });
          }
          /* Phase 2 taunt */
          if (boss.phase === 2 && !boss.hasTaunted2) {
            boss.hasTaunted2 = true;
            boss.dialogueQueue.push({ speaker: 'Moni', text: Game.i18n.t('moniTaunt2'), duration: 110 });
          }
          /* Advance dialogue timer / dequeue next line */
          if (boss.talkTimer > 0) boss.talkTimer--;
          if (boss.talkTimer <= 0 && boss.dialogueQueue.length > 0) {
            var next = boss.dialogueQueue.shift();
            boss.talkText = next.text;
            boss.talkSpeaker = next.speaker;
            boss.talkTimer = next.duration;
          } else if (boss.talkTimer <= 0) {
            boss.talkText = '';
          }
        }

        /* Check boss activation */
        if (boss && !bossActivated && player.x > level.bossAreaX) {
          boss.activate();
          bossActivated = true;
        }

        /* ---- Collisions ---- */

        /* Bubble vs enemies */
        for (var bei = bubbles.length - 1; bei >= 0; bei--) {
          var bub = bubbles[bei];
          if (!bub.active) continue;
          /* vs enemies */
          for (var ej = 0; ej < enemies.length; ej++) {
            var en = enemies[ej];
            if (!en.active) continue;
            if (circleRect(bub.x, bub.y, bub.r, en.x, en.y, en.w, en.h)) {
              bub.active = false;
              var defeated = en.hit();
              if (defeated) {
                var colors = ['#ff4466', '#44ff66', '#4488ff', '#ffcc33'];
                var burst = Game.entities.spawnBurst(en.x + en.w / 2, en.y + en.h / 2, 10, colors);
                particles = particles.concat(burst);
              }
              break;
            }
          }
          /* vs boss */
          if (bub.active && boss && boss.active && !boss.defeated) {
            if (circleRect(bub.x, bub.y, bub.r, boss.x, boss.y, boss.w, boss.h)) {
              bub.active = false;
              var bossDefeated = boss.hit();
              var bColors = ['#cc44ff', '#ff44cc', '#ffcc33', '#44ccff'];
              particles = particles.concat(
                Game.entities.spawnBurst(bub.x, bub.y, 5, bColors)
              );
              if (bossDefeated) {
                var vColors = ['#ff4466', '#44ff66', '#4488ff', '#ffcc33', '#ff66cc'];
                particles = particles.concat(
                  Game.entities.spawnBurst(boss.x + boss.w / 2, boss.y + boss.h / 2, 25, vColors)
                );
                /* Post-defeat exchange: Moni's cry → apology → hero's reply */
                boss.dialogueQueue = [
                  { speaker: 'Moni',   text: Game.i18n.t('moniDefeat'),  duration: 120 },
                  { speaker: 'Moni',   text: Game.i18n.t('moniApology'), duration: 140 },
                  { speaker: 'Momoko', text: Game.i18n.t('heroVictory'), duration: 140 },
                ];
                boss.talkTimer = 0;
                boss.talkText = '';
                /* Delay victory screen until all defeat dialogue has played
                   (120+140+140 frames ≈ 6.7s at 60fps). */
                setTimeout(function () {
                  if (state === State.PLAYING) {
                    state = State.VICTORY;
                    Game.audio.stopMusic();
                    Game.audio.play('victory');
                  }
                }, 7000);
              }
            }
          }
        }

        /* Player vs enemies */
        if (player.alive && player.invincible <= 0) {
          for (var pe = 0; pe < enemies.length; pe++) {
            var ene = enemies[pe];
            if (!ene.active) continue;
            if (aabb(player, ene)) {
              var died = player.takeDamage();
              if (died && !player.alive) {
                if (player.health <= 0) {
                  state = State.GAME_OVER;
                  Game.audio.stopMusic();
                  Game.audio.play('gameOver');
                }
              } else if (died) {
                /* Respawn at beginning */
                player.respawn(respawnPos.x, respawnPos.y);
                camera.x = 0;
              }
              break;
            }
          }
        }

        /* Player vs boss projectiles */
        if (player.alive && player.invincible <= 0 && boss && boss.active) {
          for (var bp = boss.projectiles.length - 1; bp >= 0; bp--) {
            var proj = boss.projectiles[bp];
            if (circleRect(proj.x, proj.y, proj.r, player.x, player.y, player.w, player.h)) {
              boss.projectiles.splice(bp, 1);
              var died2 = player.takeDamage();
              if (died2 && !player.alive) {
                if (player.health <= 0) {
                  state = State.GAME_OVER;
                  Game.audio.stopMusic();
                  Game.audio.play('gameOver');
                }
              } else if (died2) {
                player.respawn(respawnPos.x, respawnPos.y);
                camera.x = 0;
                /* Re-enter boss area if needed */
              }
              break;
            }
          }
        }

        /* Player vs pickups */
        for (var pk = 0; pk < pickups.length; pk++) {
          var pick = pickups[pk];
          if (!pick.active) continue;
          if (aabb(player, pick)) {
            if (player.heal()) {
              pick.active = false;
              var hColors = ['#ff4466', '#ff88aa', '#ffccdd'];
              particles = particles.concat(
                Game.entities.spawnBurst(pick.x + 8, pick.y + 8, 8, hColors)
              );
            }
          }
        }

        /* Player vs NPCs – trigger dialogue */
        for (var nc = 0; nc < npcs.length; nc++) {
          var npc = npcs[nc].entity;
          var npcType = npcs[nc].type;
          var dist = Math.sqrt(
            Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
          );
          if (dist < 60 && !npc.talking && (!npcCooldowns[npcType] || npcCooldowns[npcType] <= 0)) {
            npc.interact();
            npcCooldowns[npcType] = 300; /* cooldown frames before re-trigger */
          }
          if (npcCooldowns[npcType] > 0) npcCooldowns[npcType]--;
        }

        /* Beach cutscene trigger – only once per game */
        if (!beachSeen && player.y < level.waterSurface - 10) {
          state = State.BEACH;
          beachSeen = true;
        }

        /* Camera follow */
        var targetCamX = player.x - W / 2 + player.w / 2;
        var targetCamY = player.y - H / 2 + player.h / 2;
        camera.x += (targetCamX - camera.x) * 0.08;
        camera.y += (targetCamY - camera.y) * 0.08;
        /* Clamp camera */
        if (camera.x < 0) camera.x = 0;
        if (camera.x > level.width - W) camera.x = level.width - W;
        camera.y = Math.max(0, Math.min(camera.y, level.height - H));
        /* For this game, clamp y to keep the view mostly stable */
        camera.y = 0; /* Single-screen height */

        break;

      case State.PAUSED:
        if (jp.pause) { state = State.PLAYING; }
        break;

      case State.GAME_OVER:
        break;

      case State.VICTORY:
        /* Particles still update for fireworks */
        break;

      case State.BEACH:
        if (wolfe) wolfe.update();
        break;
    }
  }

  /* ---- Render ---- */
  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    /* Paint side-strip backgrounds first so they sit underneath the pause
       button (which is drawn last, in canvas space). The game viewport in
       the middle is fully overwritten by the state renderer below, so it
       doesn't matter that we paint across it here. */
    if (Game.input.isTouch()) {
      Game.input.drawTouchStrip(ctx, false);
    }

    /* Translate so all game / menu rendering keeps using logical 0..W,
       0..H coordinates regardless of the side-strip padding. */
    ctx.save();
    if (GAME_X) ctx.translate(GAME_X, 0);

    switch (state) {
      case State.TITLE:
        Game.ui.drawTitleScreen(ctx);
        break;

      case State.CUSTOMIZE:
        Game.ui.drawCustomizeScreen(ctx);
        break;

      case State.INTRO:
        Game.ui.drawIntroScreen(ctx);
        break;

      case State.PLAYING:
        renderGame();
        Game.ui.drawHUD(ctx, player);
        if (boss && boss.active) boss.drawHealthBar(ctx);
        /* NPC dialogue */
        for (var nd = 0; nd < npcs.length; nd++) {
          var npc = npcs[nd].entity;
          if (npc.talking) {
            var name = npcs[nd].type;
            var speakerName = name === 'oliver' ? 'Oliver' : name === 'kittycorn' ? 'Kitty Corn' : 'Bob';
            var text = npc.currentJoke || npc.currentText || '';
            Game.ui.drawDialogue(ctx, speakerName, text);
          }
        }
        /* Boss dialogue */
        if (boss && boss.talkTimer > 0 && boss.talkText) {
          Game.ui.drawDialogue(ctx, boss.talkSpeaker || 'Moni', boss.talkText);
        }
        break;

      case State.PAUSED:
        renderGame();
        Game.ui.drawHUD(ctx, player);
        Game.ui.drawPauseMenu(ctx);
        break;

      case State.GAME_OVER:
        renderGame();
        Game.ui.drawGameOver(ctx);
        break;

      case State.VICTORY:
        Game.ui.drawVictory(ctx);
        break;

      case State.BEACH:
        Game.ui.drawBeachCutscene(ctx, wolfe);
        break;
    }

    ctx.restore();

    /* Touch buttons live in canvas coordinates so they overlay both the
       side strips and (for pause) the game viewport. Only shown during
       active gameplay. */
    if (Game.input.isTouch() && state === State.PLAYING) {
      Game.input.drawTouchButtons(ctx);
    }
  }

  function renderGame() {
    if (!level) return;

    /* Background gradient */
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, level.bgTop);
    grad.addColorStop(0.5, level.bgMid);
    grad.addColorStop(1, level.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* Light rays */
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (var r = 0; r < 6; r++) {
      var rx = 150 * r - camera.x * 0.05 + Math.sin(Date.now() * 0.0003 + r) * 20;
      ctx.fillStyle = '#88ccff';
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 30, 0);
      ctx.lineTo(rx + 90, H);
      ctx.lineTo(rx - 30, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* Parallax background layers – organic blob shapes */
    for (var li = 0; li < bgLayers.length; li++) {
      var layer = bgLayers[li];
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (var it = 0; it < layer.items.length; it++) {
        var item = layer.items[it];
        var bx = item.x - camera.x * layer.parallax;
        if (bx + item.w > 0 && bx < W) {
          ctx.fillStyle = item.color;
          ctx.beginPath();
          var cx = bx + item.w / 2;
          var hw = item.w / 2;
          var hh = item.h / 2;
          var seed = item.blobSeed || 0;
          ctx.moveTo(cx - hw, item.y);
          ctx.bezierCurveTo(
            cx - hw, item.y - hh - Math.sin(seed) * 8,
            cx - hw * 0.3, item.y - hh - Math.cos(seed * 2) * 12,
            cx, item.y - hh
          );
          ctx.bezierCurveTo(
            cx + hw * 0.3, item.y - hh - Math.sin(seed * 3) * 10,
            cx + hw, item.y - hh - Math.cos(seed) * 6,
            cx + hw, item.y
          );
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    /* Background fish schools */
    ctx.save();
    ctx.globalAlpha = 0.2;
    var now = Date.now();
    for (var fsi = 0; fsi < bgFishSchools.length; fsi++) {
      var school = bgFishSchools[fsi];
      school.x += school.speed * school.dir;
      if (school.x > (level ? level.width : 5600) + 100) school.x = -100;
      if (school.x < -100) school.x = (level ? level.width : 5600) + 100;
      var schX = school.x - camera.x * 0.4;
      for (var sfi = 0; sfi < school.fish.length; sfi++) {
        var sf = school.fish[sfi];
        var fx = schX + sf.ox + Math.sin(now * 0.001 + sf.phase) * 3;
        var fy = school.y + sf.oy + Math.cos(now * 0.0012 + sf.phase) * 2;
        if (fx > -10 && fx < W + 10) {
          ctx.fillStyle = '#6688aa';
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx - 5 * school.dir, fy - 2);
          ctx.lineTo(fx - 5 * school.dir, fy + 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();

    /* Ambient bubbles (behind everything) */
    for (var ab = 0; ab < ambientBubbles.length; ab++) {
      ambientBubbles[ab].draw(ctx, camera.x * 0.6, 0);
    }

    /* Decorations */
    renderDecorations();

    /* Ocean floor – undulating contour */
    var floorBase = level.floorY - camera.y;
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.moveTo(0, H + 10);
    for (var fx = 0; fx <= W; fx += 4) {
      var worldX = fx + camera.x;
      var undulation = Math.sin(worldX * 0.008) * 6 + Math.sin(worldX * 0.02) * 3;
      ctx.lineTo(fx, floorBase + undulation);
    }
    ctx.lineTo(W, H + 10);
    ctx.closePath();
    ctx.fill();
    /* Sand ripple layer */
    ctx.fillStyle = '#3d2b12';
    ctx.beginPath();
    ctx.moveTo(0, H + 10);
    for (var sx = 0; sx <= W; sx += 4) {
      var swx = sx + camera.x;
      var ripple = Math.sin(swx * 0.008) * 6 + Math.sin(swx * 0.02) * 3 + Math.sin(swx * 0.05) * 1.5;
      ctx.lineTo(sx, floorBase + ripple + 2);
    }
    ctx.lineTo(W, H + 10);
    ctx.closePath();
    ctx.fill();
    /* Pebbles and starfish */
    ctx.save();
    var pebbleSeed = 42;
    for (var pb = 0; pb < 20; pb++) {
      pebbleSeed = (pebbleSeed * 1103515245 + 12345) & 0x7fffffff;
      var pbx = (pebbleSeed % 800);
      var worldPbx = pbx + Math.floor(camera.x / 800) * 800;
      var screenPbx = worldPbx - camera.x;
      if (screenPbx < -10 || screenPbx > W + 10) { screenPbx += 800; worldPbx += 800; }
      if (screenPbx < -10 || screenPbx > W + 10) continue;
      var pby = floorBase + Math.sin(worldPbx * 0.008) * 6 + 4;
      if (pb < 3) {
        /* Starfish */
        ctx.fillStyle = '#cc6644';
        for (var arm = 0; arm < 5; arm++) {
          var angle = (arm * Math.PI * 2) / 5 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(screenPbx, pby);
          ctx.lineTo(screenPbx + Math.cos(angle) * 5, pby + Math.sin(angle) * 5);
          ctx.lineTo(screenPbx + Math.cos(angle + 0.3) * 2, pby + Math.sin(angle + 0.3) * 2);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = pb % 2 === 0 ? '#44382a' : '#55483a';
        ctx.beginPath();
        ctx.ellipse(screenPbx, pby, 2 + (pb % 3), 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    /* Caustic light patterns on floor */
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffcc';
    var causticTime = Date.now() * 0.0008;
    for (var ci = 0; ci < 12; ci++) {
      var cix = (ci * 70 + Math.sin(causticTime + ci * 1.3) * 40) % (W + 40) - 20;
      var ciy = floorBase - 4 + Math.cos(causticTime * 0.7 + ci) * 3;
      var ciw = 20 + Math.sin(causticTime + ci * 0.9) * 8;
      ctx.beginPath();
      ctx.ellipse(cix, ciy, ciw, 4 + Math.sin(causticTime + ci) * 2, Math.sin(causticTime * 0.5 + ci) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Platforms (organic rounded coral shapes) */
    for (var pl = 0; pl < level.platforms.length; pl++) {
      var pf = level.platforms[pl];
      var px = pf.x - camera.x;
      var py = pf.y - camera.y;
      if (px + pf.w < 0 || px > W) continue;

      var pcx = px + pf.w / 2;
      var pcy = py + pf.h / 2;
      var phw = pf.w / 2;
      var phh = pf.h / 2;

      /* Main coral body – organic blob */
      ctx.fillStyle = '#cc5544';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + phh);
      ctx.bezierCurveTo(px + 2, py + 4, pcx - phw * 0.2, py + 2, pcx, py + 3);
      ctx.bezierCurveTo(pcx + phw * 0.2, py + 2, px + pf.w - 2, py + 4, px + pf.w - 4, py + phh);
      ctx.bezierCurveTo(px + pf.w - 2, py + pf.h - 4, pcx + phw * 0.3, py + pf.h - 1, pcx, py + pf.h - 2);
      ctx.bezierCurveTo(pcx - phw * 0.3, py + pf.h - 1, px + 2, py + pf.h - 4, px + 4, py + phh);
      ctx.closePath();
      ctx.fill();

      /* Highlight ridge */
      ctx.fillStyle = '#dd7766';
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 6);
      ctx.quadraticCurveTo(pcx, py + 3, px + pf.w - 6, py + 6);
      ctx.quadraticCurveTo(pcx, py + 10, px + 6, py + 6);
      ctx.closePath();
      ctx.fill();

      /* Polyps (small circles on surface) */
      ctx.fillStyle = '#ee9988';
      for (var sp = 0; sp < 4; sp++) {
        var spx = px + 8 + sp * (pf.w / 4);
        var spy = pcy + Math.sin(sp * 2.5) * (phh * 0.4);
        ctx.beginPath();
        ctx.arc(spx, spy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Water surface effect */
    var surfaceY = level.waterSurface - camera.y;
    ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
    for (var ws = -10; ws < W + 10; ws += 20) {
      var wy = surfaceY + Math.sin(Date.now() * 0.002 + ws * 0.05) * 4;
      ctx.beginPath();
      ctx.arc(ws + camera.x % 20, wy, 12, 0, Math.PI);
      ctx.fill();
    }

    /* Pickups */
    for (var pk = 0; pk < pickups.length; pk++) {
      pickups[pk].draw(ctx, camera.x, camera.y);
    }

    /* NPCs */
    for (var nc = 0; nc < npcs.length; nc++) {
      npcs[nc].entity.draw(ctx, camera.x, camera.y);
      /* Interaction indicator */
      var npc = npcs[nc].entity;
      if (!npc.talking) {
        var ndist = Math.sqrt(
          Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
        );
        if (ndist < 80) {
          /* Draw "!" indicator */
          var ix = npc.x - camera.x + npc.w / 2;
          var iy = npc.y - camera.y - 14;
          ctx.fillStyle = '#ffcc33';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', ix, iy + Math.sin(Date.now() * 0.005) * 3);
        }
      }
    }

    /* Bob submarine (drawn by npc loop above) */

    /* Enemies */
    for (var ei = 0; ei < enemies.length; ei++) {
      enemies[ei].draw(ctx, camera.x, camera.y);
    }

    /* Boss */
    if (boss) boss.draw(ctx, camera.x, camera.y);

    /* Player bubbles */
    for (var bi = 0; bi < bubbles.length; bi++) {
      bubbles[bi].draw(ctx, camera.x, camera.y);
    }

    /* Player */
    if (player) player.draw(ctx, camera.x, camera.y);

    /* Wolfe (visible near surface) */
    if (wolfe && camera.y <= 20) {
      wolfe.draw(ctx, camera.x, camera.y);
    }

    /* Particles */
    for (var pa = 0; pa < particles.length; pa++) {
      particles[pa].draw(ctx, camera.x, camera.y);
    }

    /* Current drift motes */
    ctx.save();
    for (var mi = 0; mi < currentMotes.length; mi++) {
      var mote = currentMotes[mi];
      mote.x -= mote.speed;
      if (mote.x < -5) { mote.x = W + 5; mote.y = Math.random() * H; }
      ctx.globalAlpha = mote.alpha;
      ctx.fillStyle = '#88ccdd';
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Depth fog – blue overlay intensifying toward bottom */
    var fogGrad = ctx.createLinearGradient(0, 0, 0, H);
    fogGrad.addColorStop(0, 'rgba(10, 22, 40, 0)');
    fogGrad.addColorStop(0.6, 'rgba(10, 22, 40, 0)');
    fogGrad.addColorStop(1, 'rgba(10, 22, 40, 0.1)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function renderDecorations() {
    if (!level) return;
    for (var i = 0; i < level.decorations.length; i++) {
      var d = level.decorations[i];
      var dx = d.x - camera.x;
      if (dx < -100 || dx > W + 100) continue;
      var dy = d.y - camera.y;

      if (d.type === 'seaweed') {
        var sway = Math.sin(Date.now() * 0.001 + d.x * 0.01) * 8;
        ctx.fillStyle = '#1a6633';
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.quadraticCurveTo(dx + sway, dy - d.h * 0.5, dx + 3, dy - d.h);
        ctx.quadraticCurveTo(dx + sway + 6, dy - d.h * 0.5, dx + 8, dy);
        ctx.closePath();
        ctx.fill();
        /* Second frond */
        ctx.fillStyle = '#228844';
        ctx.beginPath();
        ctx.moveTo(dx + 4, dy);
        ctx.quadraticCurveTo(dx + 4 - sway * 0.7, dy - d.h * 0.4, dx + 6, dy - d.h * 0.8);
        ctx.quadraticCurveTo(dx + 10 - sway * 0.7, dy - d.h * 0.3, dx + 10, dy);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === 'coral') {
        var colors = ['#ff6655', '#ff9944', '#ffcc33'];
        var baseColor = colors[d.variant || 0];
        ctx.fillStyle = baseColor;
        /* Branching coral – organic blobs */
        ctx.beginPath();
        ctx.arc(dx, dy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx + 10, dy - 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx - 8, dy - 6, 9, 0, Math.PI * 2);
        ctx.fill();
        /* Stems as bezier curves */
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx, dy + 6);
        ctx.quadraticCurveTo(dx - 1, dy, dx, dy - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + 6, dy + 2);
        ctx.quadraticCurveTo(dx + 8, dy - 2, dx + 10, dy - 6);
        ctx.stroke();
      } else if (d.type === 'shell') {
        ctx.fillStyle = '#ffddaa';
        ctx.beginPath();
        ctx.arc(dx, dy, 6, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#ccaa77';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(dx - 4, dy); ctx.lineTo(dx, dy - 5);
        ctx.moveTo(dx, dy); ctx.lineTo(dx, dy - 6);
        ctx.moveTo(dx + 4, dy); ctx.lineTo(dx, dy - 5);
        ctx.stroke();
      } else if (d.type === 'kelp') {
        var kTime = Date.now() * 0.001;
        var kh = d.h || 120;
        /* Main stalk */
        var kSway = Math.sin(kTime + d.x * 0.005) * 12;
        ctx.strokeStyle = '#1a6633';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.bezierCurveTo(dx + kSway * 0.3, dy - kh * 0.33, dx + kSway * 0.7, dy - kh * 0.66, dx + kSway, dy - kh);
        ctx.stroke();
        /* Leaf blades */
        var leafColors = ['#228844', '#1a7738', '#20994a'];
        for (var lf = 0; lf < 5; lf++) {
          var lt = (lf + 1) / 6;
          var lx = dx + kSway * lt;
          var ly = dy - kh * lt;
          var leafSway = Math.sin(kTime * 1.2 + lf * 1.5 + d.x * 0.01) * 8;
          var leafDir = lf % 2 === 0 ? 1 : -1;
          ctx.fillStyle = leafColors[lf % leafColors.length];
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + leafDir * (12 + leafSway), ly - 6, lx + leafDir * (18 + leafSway), ly - 2);
          ctx.quadraticCurveTo(lx + leafDir * (12 + leafSway), ly + 2, lx, ly);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  /* ---- Click handling ---- */
  function onClick(e) {
    var pos = Game.input.getClickPos(e);
    var mx = pos.x, my = pos.y;

    switch (state) {
      case State.TITLE:
        var action = Game.ui.handleTitleClick(mx, my);
        if (action === 'play') state = State.CUSTOMIZE;
        break;

      case State.CUSTOMIZE:
        var cAction = Game.ui.handleCustomizeClick(mx, my);
        if (cAction === 'start') state = State.INTRO;
        break;

      case State.INTRO:
        var iAction = Game.ui.handleIntroClick(mx, my);
        if (iAction === 'start') startGame();
        break;

      case State.PAUSED:
        var pAction = Game.ui.handlePauseClick(mx, my);
        if (pAction === 'resume') state = State.PLAYING;
        else if (pAction === 'quit') { Game.audio.stopMusic(); state = State.TITLE; }
        break;

      case State.GAME_OVER:
        var gAction = Game.ui.handleGameOverClick(mx, my);
        if (gAction === 'retry') startGame();
        break;

      case State.VICTORY:
        var vAction = Game.ui.handleVictoryClick(mx, my);
        if (vAction === 'restart') { state = State.TITLE; }
        break;

      case State.BEACH:
        var bAction = Game.ui.handleBeachClick(mx, my);
        if (bAction === 'dive') {
          state = State.PLAYING;
          player.y = level.waterSurface + 20;
          player.vy = 1;
        }
        break;
    }
  }

  /* ---- Start game ---- */
  function startGame() {
    loadLevel(0);
    state = State.PLAYING;
    camera = { x: 0, y: 0 };
    beachSeen = false;
    Game.audio.init();
    Game.audio.resume();
    Game.audio.startMusic('bgm');
  }

  /* ---- Game loop ---- */
  var lastTime = 0;
  var accumulator = 0;
  var FIXED_DT = 1000 / 60;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var delta = timestamp - lastTime;
    lastTime = timestamp;

    /* Cap delta to avoid spiral of death */
    if (delta > 100) delta = 100;

    accumulator += delta;
    while (accumulator >= FIXED_DT) {
      update();
      accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  /* ---- Init ---- */
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    /* On touch devices, widen the canvas with control strips on each side
       of the 800×480 game viewport so the D-pad / BUBBLE buttons live
       beside gameplay rather than over it, and so the canvas aspect ratio
       matches landscape phones. */
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch) {
      CANVAS_W = W + TOUCH_SIDE_W * 2;
      GAME_X = TOUCH_SIDE_W;
    } else {
      CANVAS_W = W;
      GAME_X = 0;
    }
    CANVAS_H = H;
    /* DPI-aware backing store: render at physical pixel density so text
       and curves stay crisp on retina / high-DPR devices. Cap at 3× to
       keep the backing store reasonable on pathological displays. The
       context's base transform is scaled by dpr so all game code keeps
       drawing in logical CANVAS_W × CANVAS_H coordinates. */
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Enable image smoothing for smooth curves */
    ctx.imageSmoothingEnabled = true;

    /* Input */
    Game.input.init(canvas);

    /* Audio init on first interaction */
    Game.audio.init();

    /* Click handler for menus */
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', function (e) {
      /* Prevent double-fire on touch devices */
      if (state !== State.PLAYING) {
        onClick(e);
      }
    });

    /* Handle resize */
    function resize() {
      var container = canvas.parentElement;
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      var scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
      canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
      canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
      Game.input.refreshLayout();
    }
    window.addEventListener('resize', resize);
    resize();

    /* Prevent default touch behavior on canvas */
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });

    /* Start */
    requestAnimationFrame(gameLoop);
  }

  /* ---- Export ---- */
  window.Game.engine = {
    init: init,
    State: State,
  };

  /* Auto-init when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
