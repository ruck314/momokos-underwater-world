/* engine.js – game loop, state machine, camera, collision, rendering */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  /* On touch devices we pad the canvas around the 800×480 game viewport
     so thumbs never cover the playfield and the canvas can match the
     screen's aspect ratio (so it scales up to fill the display).

     Horizontal strips: D-pad on the left, BUBBLE on the right. The left
     strip is wider so the D-pad has breathing room on narrow iPhones.

     Vertical bezels: when the screen is taller-aspect than the base
     canvas (iPads, ChromeOS tablets), extra space is split equally above
     and below the game viewport so the canvas can be scaled up to use
     the full screen height instead of being letterboxed.

     GAME_X / GAME_Y are the offsets where the game viewport begins
     inside the canvas; the render loop translates by them so game code
     keeps using logical 0..W, 0..H coordinates. */
  var TOUCH_LEFT_W = 260;
  var TOUCH_RIGHT_W = 200;
  var CANVAS_W = W;
  var CANVAS_H = H;
  var GAME_X = 0;
  var GAME_Y = 0;
  /* Version stamp shown on the title screen and pause menu. Bump manually
     at release time and tag the matching git release (`git tag vX.Y.Z`)
     so the in-game stamp lines up with the git tag for debugging. */
  Game.VERSION = 'v2.0.0';
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
    LEVEL_CLEAR: 'levelClear',
    LEVEL_SELECT: 'levelSelect',
  };
  var state = State.TITLE;
  var prevState = null;

  /* ---- Progression ----
     Which reef is being played, how many pearls have been picked up in
     it, and the saved record of unlocked levels / best results. Saved to
     localStorage so a returning player keeps their stars. */
  var currentLevel = 0;
  var pearlsCollected = 0;
  var pearlTotal = 0;
  var PROGRESS_KEY = 'momoko-uw-progress';
  var progress = { unlocked: 1, best: {} };
  Game.progress = progress;
  /* Frames left before the level-clear screen appears after a mini-boss
     goes down (gives the defeat dialogue time to play). */
  var levelClearCountdown = 0;
  /* Summary shown on the LEVEL_CLEAR screen */
  var lastClear = null;

  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p.unlocked === 'number') {
          progress.unlocked = Math.max(1, Math.min(p.unlocked, Game.levels.count()));
          progress.best = p.best || {};
        }
      }
    } catch (e) { /* private mode / storage blocked: play without saving */ }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) { /* ignore */ }
  }

  /* Clearing a reef always earns one star; half the pearls earns two and
     every pearl earns three. */
  function starsFor(got, total) {
    if (total <= 0 || got >= total) return 3;
    if (got >= total * 0.5) return 2;
    return 1;
  }

  function recordLevelClear(index, got, total) {
    var stars = starsFor(got, total);
    var prev = progress.best[index];
    var isNew = !prev || stars > prev.stars || got > prev.pearls;
    progress.best[index] = {
      stars: Math.max(stars, prev ? prev.stars : 0),
      pearls: Math.max(got, prev ? prev.pearls : 0),
      total: total,
    };
    progress.unlocked = Math.max(progress.unlocked, Math.min(index + 2, Game.levels.count()));
    saveProgress();
    return { level: index, pearls: got, total: total, stars: stars, isNew: isNew, hasNext: index + 1 < Game.levels.count() };
  }

  /* ---- Customization defaults ----
     Split across two concerns: tintable colors (hair/suit/skin/flipper) and
     swappable variants (hairStyle/outfit/shoes/crab/food). Variants are
     strings that the sprite painter branches on; 'none' means skip. */
  Game.customization = {
    hair: '#e06088',
    suit: '#e06088',
    skin: '#ffddbb',
    flipper: '#ff99cc',
    hairStyle: 'twinTails',
    outfit: 'frillyDress',
    shoes: 'maryJane',
    crab: 'none',
    food: 'none',
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
  var chests = [];
  var particles = [];
  var ambientBubbles = [];
  var boss = null;
  var wolfe = null;
  var bossActivated = false;
  var respawnPos = { x: 0, y: 0 };
  var npcCooldowns = {};
  /* Beach trigger arming. The cutscene fires every time the player breaks
     the surface, but we don't want it ping-ponging while they bob near the
     waterline – so the trigger disarms after firing and only re-arms once
     the player has dived back below the surface by a reasonable amount. */
  var beachReady = true;
  /* True when the most recent GAME_OVER happened during the boss fight, so
     the retry button can drop the player just outside the boss arena
     instead of sending them all the way back to the level start. */
  var lastDeathInBoss = false;
  /* Each game-over that happens during the boss fight grants +1 max heart on
     subsequent attempts so a struggling player gradually gets more margin. */
  var bossDeathBonus = 0;

  /* Dialogue message queued during the playing-state render; drawn in
     canvas-space after the game viewport is painted so it can live in
     the bottom bezel instead of covering gameplay. */
  var pendingDialogue = null;

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
    if (bossDeathBonus > 0) {
      player.maxHealth += bossDeathBonus;
      player.health = player.maxHealth;
    }
    respawnPos = { x: sp.x, y: sp.y };

    /* Enemies */
    enemies = [];
    for (var i = 0; i < level.spawns.enemies.length; i++) {
      var e = level.spawns.enemies[i];
      if (e.type === 'fish') {
        enemies.push(new Game.entities.Fish(e.x, e.y, e.pattern, e.dir, e.species));
      } else if (e.type === 'octopus') {
        enemies.push(new Game.entities.Octopus(e.x, e.y));
      } else if (e.type === 'jellyfish') {
        enemies.push(new Game.entities.Jellyfish(e.x, e.y, !!level.dark));
      } else if (e.type === 'eel') {
        enemies.push(new Game.entities.Eel(e.x, e.y, e.dir));
      } else if (e.type === 'shark') {
        enemies.push(new Game.entities.Shark(e.x, e.y, e.dir, e.range));
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
      else if (nd.type === 'crab') npcEntity = new Game.entities.Crab(nd.x, nd.y);
      if (npcEntity) npcs.push({ entity: npcEntity, type: nd.type });
    }

    /* Pickups – hearts and pearls; chests hold more pearls */
    pickups = [];
    pearlsCollected = 0;
    pearlTotal = 0;
    for (var p = 0; p < level.spawns.pickups.length; p++) {
      var pd = level.spawns.pickups[p];
      if (pd.type === 'pearl') {
        pickups.push(new Game.entities.Pearl(pd.x, pd.y, { shell: pd.shell }));
        pearlTotal++;
      } else {
        pickups.push(new Game.entities.HeartPickup(pd.x, pd.y));
      }
    }
    chests = [];
    var cl = level.spawns.chests || [];
    for (var ch = 0; ch < cl.length; ch++) {
      chests.push(new Game.entities.Chest(cl[ch].x, cl[ch].y, cl[ch].pearls));
      pearlTotal += cl[ch].pearls || 4;
    }

    /* Boss – Moni in her lair, a mini-boss guarding the other reefs */
    var bd = level.spawns.boss;
    if (!bd.type || bd.type === 'moni') {
      boss = new Game.entities.Moni(bd.x, bd.y);
    } else {
      boss = new Game.entities.MiniBoss(bd.x, bd.y, bd.type);
      boss.floorY = level.floorY;
    }
    bossActivated = false;
    levelClearCountdown = 0;

    /* Wolfe */
    wolfe = null;
    if (level.wolfe) {
      wolfe = new Game.entities.Wolfe(level.wolfe.x, level.wolfe.y, level.wolfe.patrolWidth);
    }

    /* Bubbles & particles */
    bubbles = [];
    particles = [];

    /* Rock layouts are per level (palette differs), so drop the cache */
    reefCache = {};
    activeRockPalettes = ROCK_PALETTE_SETS[level.rockPalette] || ROCK_PALETTE_SETS.reef;

    initBgLayers();
    initAmbientBubbles();
  }

  /* Respawn position after losing a heart. During the boss fight we
     don't want the player kicked all the way back to the level start –
     drop them just outside the boss arena so they can rejoin quickly. */
  function respawnPlayerAfterHit() {
    if (bossActivated && boss && !boss.defeated) {
      var rx = Math.max(0, level.bossAreaX - 100);
      var ry = 220;
      player.respawn(rx, ry);
      camera.x = Math.max(0, Math.min(rx - W / 2 + player.w / 2, level.width - W));
    } else {
      player.respawn(respawnPos.x, respawnPos.y);
      camera.x = 0;
    }
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
        /* Trench levels have a rock ceiling instead of a surface */
        if (level.ceilingY !== undefined && player.y < level.ceilingY) {
          player.y = level.ceilingY;
          if (player.vy < 0) player.vy = 0;
        }
        var pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;

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

        /* Enemies (eels and sharks react to where Momoko is) */
        for (var ei = 0; ei < enemies.length; ei++) {
          enemies[ei].update(pcx, pcy);
        }
        for (var ci = 0; ci < chests.length; ci++) {
          chests[ci].update();
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

          /* Pre-fight: hero challenges first, then the boss snarls back */
          if (!boss.hasChallenged && boss.timer > 20) {
            boss.hasChallenged = true;
            boss.hasTaunted = true;
            if (boss.isMini) {
              boss.dialogueQueue.push({ speaker: 'Momoko', text: Game.i18n.t('heroChallengeMini'), duration: 220 });
              boss.dialogueQueue.push({ speaker: Game.i18n.t(boss.nameKey), text: Game.i18n.t(boss.tauntKey), duration: 240 });
            } else {
              boss.dialogueQueue.push({ speaker: 'Momoko', text: Game.i18n.t('heroChallenge'), duration: 260 });
              boss.dialogueQueue.push({ speaker: 'Moni',   text: Game.i18n.t('moniTaunt1'),    duration: 260 });
            }
          }
          /* Mid-fight taunt at ~75% HP */
          if (!boss.isMini && !boss.hasTaunted3 && !boss.defeated && boss.hp <= boss.maxHp * 0.75) {
            boss.hasTaunted3 = true;
            boss.dialogueQueue.push({ speaker: 'Moni', text: Game.i18n.t('moniTaunt3'), duration: 240 });
          }
          /* Phase 2 taunt */
          if (!boss.isMini && boss.phase === 2 && !boss.hasTaunted2) {
            boss.hasTaunted2 = true;
            boss.dialogueQueue.push({ speaker: 'Moni', text: Game.i18n.t('moniTaunt2'), duration: 260 });
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

        /* Mini-boss down: once the exchange has played, clear the reef */
        if (levelClearCountdown > 0) {
          levelClearCountdown--;
          if (levelClearCountdown === 0) finishLevel();
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
          /* vs treasure chests – pop the lid and scatter pearls */
          if (bub.active) {
            for (var cj = 0; cj < chests.length; cj++) {
              var chest = chests[cj];
              if (chest.open) continue;
              if (circleRect(bub.x, bub.y, bub.r, chest.x, chest.y, chest.w, chest.h)) {
                bub.active = false;
                var popped = chest.hit();
                if (popped) pickups = pickups.concat(popped);
                particles = particles.concat(
                  Game.entities.spawnBurst(chest.x + chest.w / 2, chest.y + 6, 12, ['#ffd24a', '#fff1b3', '#ffb0d0', '#ffffff'])
                );
                break;
              }
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
                if (boss.isMini) {
                  /* Guardian beaten: its last words, Momoko's rally, then
                     the level-clear card. */
                  boss.dialogueQueue = [
                    { speaker: Game.i18n.t(boss.nameKey), text: Game.i18n.t(boss.defeatKey), duration: 220 },
                    { speaker: 'Momoko', text: Game.i18n.t('heroMiniWin'), duration: 220 },
                  ];
                  boss.talkTimer = 0;
                  boss.talkText = '';
                  levelClearCountdown = 300;
                } else {
                  /* Post-defeat exchange: Moni's cry → apology → hero's reply */
                  boss.dialogueQueue = [
                    { speaker: 'Moni',   text: Game.i18n.t('moniDefeat'),  duration: 280 },
                    { speaker: 'Moni',   text: Game.i18n.t('moniApology'), duration: 320 },
                    { speaker: 'Momoko', text: Game.i18n.t('heroVictory'), duration: 320 },
                  ];
                  boss.talkTimer = 0;
                  boss.talkText = '';
                  /* Delay victory screen until all defeat dialogue has played
                     (120+140+140 frames ≈ 6.7s at 60fps). */
                  var clearedLevel = currentLevel;
                  setTimeout(function () {
                    if (state === State.PLAYING && currentLevel === clearedLevel) {
                      lastClear = recordLevelClear(currentLevel, pearlsCollected, pearlTotal);
                      state = State.VICTORY;
                      Game.audio.stopMusic();
                      Game.audio.play('victory');
                    }
                  }, 7000);
                }
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
                  lastDeathInBoss = bossActivated && boss && !boss.defeated;
                  if (lastDeathInBoss) bossDeathBonus++;
                  state = State.GAME_OVER;
                  Game.audio.stopMusic();
                  Game.audio.play('gameOver');
                }
              } else if (died) {
                respawnPlayerAfterHit();
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
                  lastDeathInBoss = true;
                  bossDeathBonus++;
                  state = State.GAME_OVER;
                  Game.audio.stopMusic();
                  Game.audio.play('gameOver');
                }
              } else if (died2) {
                respawnPlayerAfterHit();
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
            if (pick.isPearl) {
              pick.active = false;
              pearlsCollected++;
              Game.audio.play('pearl');
              particles = particles.concat(
                Game.entities.spawnBurst(pick.x + 7, pick.y + 7, 6, ['#ffffff', '#ffe0f0', '#bff4ff'])
              );
            } else if (player.heal()) {
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
          if (dist < 80 && !npc.talking && (!npcCooldowns[npcType] || npcCooldowns[npcType] <= 0)) {
            npc.interact();
            npcCooldowns[npcType] = 300; /* cooldown frames before re-trigger */
          }
          if (npcCooldowns[npcType] > 0) npcCooldowns[npcType]--;
        }

        /* Beach cutscene trigger – fires every time the player breaches
           the surface. Re-arms once they dive back below the waterline by
           a comfortable margin so the cutscene doesn't loop on bobs. */
        if (beachReady && player.y < level.waterSurface - 10) {
          beachReady = false;
          if (Game.ui.startBeachCutscene) Game.ui.startBeachCutscene();
          state = State.BEACH;
        } else if (!beachReady && player.y > level.waterSurface + 60) {
          beachReady = true;
        }

        /* Camera follow. During the boss fight, frame the midpoint
           between Momoko and Moni so Moni is on screen while she taunts,
           but keep Momoko at least 80px from the left edge and 120px
           from the right. */
        var targetCamX = player.x - W / 2 + player.w / 2;
        if (bossActivated && boss && boss.active && !boss.defeated) {
          var mid = (player.x + player.w / 2 + boss.x + boss.w / 2) / 2 - W / 2;
          targetCamX = Math.max(player.x + player.w + 120 - W, Math.min(player.x - 80, mid));
        }
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

      case State.LEVEL_CLEAR:
      case State.LEVEL_SELECT:
        /* Animated by ui.js */
        break;

      case State.BEACH:
        if (wolfe) wolfe.update();
        if (Game.ui.updateBeach) Game.ui.updateBeach(keys, jp);
        break;
    }
  }

  /* Mini-boss defeated: save the result and show the level-clear card */
  function finishLevel() {
    lastClear = recordLevelClear(currentLevel, pearlsCollected, pearlTotal);
    Game.audio.stopMusic();
    Game.audio.play('levelClear');
    if (Game.ui.resetLevelClear) Game.ui.resetLevelClear();
    state = State.LEVEL_CLEAR;
  }

  /* ---- Render ---- */
  /* Runs fn with drawing clipped to the game viewport. The overlay
     states (pause, game over) widen the view to the whole canvas on
     tablets so their scrim covers the bezel too; the frozen scene under
     the menu still has to stay inside the 800x480 window. */
  function drawClipped(fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    /* Paint side-strip backgrounds first so they sit underneath the pause
       button (which is drawn last, in canvas space). The game viewport in
       the middle is fully overwritten by the state renderer below, so it
       doesn't matter that we paint across it here. */
    /* Menu screens have no touch controls, so on a tablet they paint
       their own sea across the whole canvas instead of sitting in a dark
       frame. Gameplay keeps the bezel so the D-pad has a quiet backdrop. */
    var fullBleed = Game.input.isTouch() && (
      state === State.TITLE || state === State.CUSTOMIZE ||
      state === State.INTRO || state === State.VICTORY ||
      state === State.LEVEL_CLEAR || state === State.LEVEL_SELECT);
    /* Pause and game-over dim the whole screen, bezel included, so the
       menu floats over the frozen game instead of a bright island. */
    var dimAll = Game.input.isTouch() && (
      state === State.PAUSED || state === State.GAME_OVER);
    if (Game.input.isTouch() && !fullBleed) {
      Game.input.drawTouchStrip(ctx, false);
    }

    /* Translate so all game / menu rendering keeps using logical 0..W,
       0..H coordinates regardless of the side / top / bottom padding. */
    ctx.save();
    if (GAME_X || GAME_Y) ctx.translate(GAME_X, GAME_Y);
    if (fullBleed || dimAll) {
      Game.ui.setView(-GAME_X, -GAME_Y, CANVAS_W, CANVAS_H);
    } else {
      Game.ui.setView(0, 0, W, H);
      /* Keep the world inside the viewport so it can't bleed into the
         touch bezels. */
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
    }
    if (Game.ui.beginFrame) Game.ui.beginFrame();

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
        Game.ui.drawHUD(ctx, player, pearlsCollected, pearlTotal);
        if (boss && boss.active) boss.drawHealthBar(ctx);
        /* Dialogue is deferred to canvas-space after the restore so it
           can live in the bottom bezel instead of covering gameplay. */
        pendingDialogue = null;
        for (var nd = 0; nd < npcs.length; nd++) {
          var npc = npcs[nd].entity;
          if (npc.talking) {
            var name = npcs[nd].type;
            var speakerName;
            if (name === 'oliver') speakerName = 'Oliver';
            else if (name === 'kittycorn') speakerName = 'Kitty Corn';
            else if (name === 'bob') speakerName = 'Bob';
            else if (name === 'crab') speakerName = Game.i18n.t('crabName');
            else speakerName = name;
            var text = npc.currentJoke || npc.currentText || '';
            pendingDialogue = { speaker: speakerName, text: text };
          }
        }
        if (boss && boss.talkTimer > 0 && boss.talkText) {
          pendingDialogue = { speaker: boss.talkSpeaker || 'Moni', text: boss.talkText };
        }
        break;

      case State.PAUSED:
        /* No HUD under the scrim: the hearts are lost in the dim anyway,
           and on desktop the Game Center link (shown while paused) sat
           right on top of them. */
        drawClipped(renderGame);
        Game.ui.drawPauseMenu(ctx);
        break;

      case State.GAME_OVER:
        drawClipped(renderGame);
        Game.ui.drawGameOver(ctx);
        break;

      case State.VICTORY:
        Game.ui.drawVictory(ctx);
        break;

      case State.LEVEL_CLEAR:
        Game.ui.drawLevelClear(ctx, lastClear);
        break;

      case State.LEVEL_SELECT:
        Game.ui.drawLevelSelect(ctx);
        break;

      case State.BEACH:
        Game.ui.drawBeachCutscene(ctx, wolfe);
        break;
    }

    ctx.restore();

    updateChrome();

    /* Canvas-space overlays sit outside the game viewport so they can
       use the bezel area. */
    if (Game.input.isTouch() && (state === State.PLAYING || state === State.PAUSED)) {
      /* QR code in the upper-right bezel inviting another player to scan.
         Sized to fit between the pause button (top) and the BUBBLE
         action button (middle) even on a short iPhone canvas. */
      var rightCx = CANVAS_W - Game.TOUCH_RIGHT_W / 2;
      var qrSize = Math.min(Game.TOUCH_RIGHT_W - 16, 110);
      var qrCy = 62 + qrSize / 2;
      if (qrSize >= 60 && Game.ui.drawQRCode) {
        Game.ui.drawQRCode(ctx, rightCx, qrCy, qrSize);
      }
    }
    if (Game.input.isTouch() && (state === State.PLAYING || state === State.BEACH)) {
      Game.input.drawTouchButtons(ctx);
    }

    /* Dialogue – drawn in canvas-space so it lives in the bottom bezel. */
    if (state === State.PLAYING && pendingDialogue && Game.ui.drawDialogue) {
      Game.ui.drawDialogue(
        ctx,
        pendingDialogue.speaker,
        pendingDialogue.text,
        CANVAS_W, CANVAS_H, GAME_X, GAME_Y,
        player ? GAME_Y + player.y + player.h - camera.y : null
      );
    }
  }

  /* DOM bits that track the game state: the Game Center link only shows
     where it can't cover play, and the cursor turns into a pointer over
     anything clickable. */
  var linkEl = null, lastLinkShown = null, lastCursor = null;
  function updateChrome() {
    if (!linkEl) linkEl = document.getElementById('game-center-link');
    var show = state === State.TITLE || state === State.PAUSED;
    if (linkEl && show !== lastLinkShown) {
      linkEl.classList.toggle('hidden', !show);
      lastLinkShown = show;
    }
    var cursor = Game.ui.isHot && Game.ui.isHot() ? 'pointer' : 'default';
    if (cursor !== lastCursor) { canvas.style.cursor = cursor; lastCursor = cursor; }
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

    /* Light rays – brightest just under the surface, fading with depth.
       No sunlight reaches the trench. */
    if (!level.dark) {
    ctx.save();
    var rayGrad = ctx.createLinearGradient(0, 0, 0, H);
    rayGrad.addColorStop(0, 'rgba(150, 215, 255, 0.09)');
    rayGrad.addColorStop(0.7, 'rgba(150, 215, 255, 0.025)');
    rayGrad.addColorStop(1, 'rgba(150, 215, 255, 0)');
    ctx.fillStyle = rayGrad;
    for (var r = 0; r < 6; r++) {
      var rx = 150 * r - camera.x * 0.05 + Math.sin(Date.now() * 0.0003 + r) * 20;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 30, 0);
      ctx.lineTo(rx + 90, H);
      ctx.lineTo(rx - 30, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    }

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

    /* Platforms – coral-encrusted reef rocks. Drawn before the seafloor
       so the sand laps over the base of grounded rocks. */
    var nowT = Date.now();
    for (var pl = 0; pl < level.platforms.length; pl++) {
      var pf = level.platforms[pl];
      var px = pf.x - camera.x;
      var py = pf.y - camera.y;
      if (px + pf.w < 0 || px > W) continue;
      if (pf.kind === 'wood') drawWoodPlatform(ctx, px, py, pf.w, pf.h, pf.x);
      else drawRockPlatform(ctx, px, py, pf.w, pf.h, pf.x, pf.y + pf.h >= level.floorY - 2, nowT);
    }

    /* Ocean floor – undulating sand, lit from above and darkening with depth */
    var sandPal = level.sand || { top: '#8a7656', mid: '#5e4e39', bottom: '#2e261d', lip: 'rgba(214, 196, 150, 0.55)' };
    var floorBase = level.floorY - camera.y;
    var sandGrad = ctx.createLinearGradient(0, floorBase - 8, 0, H);
    sandGrad.addColorStop(0, sandPal.top);
    sandGrad.addColorStop(0.35, sandPal.mid);
    sandGrad.addColorStop(1, sandPal.bottom);
    ctx.fillStyle = sandGrad;
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
    /* Sunlit lip along the crest and a couple of fainter sand ripples */
    ctx.save();
    ctx.lineCap = 'round';
    for (var rl = 0; rl < 3; rl++) {
      ctx.strokeStyle = rl === 0 ? sandPal.lip : 'rgba(180, 160, 120, 0.18)';
      ctx.lineWidth = rl === 0 ? 1.5 : 1;
      ctx.beginPath();
      for (var sx = 0; sx <= W; sx += 4) {
        var swx = sx + camera.x;
        var ripple = Math.sin(swx * 0.008) * 6 + Math.sin(swx * 0.02) * 3 + (rl ? Math.sin(swx * 0.05 + rl) * 1.5 : 0);
        if (sx === 0) ctx.moveTo(sx, floorBase + ripple + 1 + rl * 9);
        else ctx.lineTo(sx, floorBase + ripple + 1 + rl * 9);
      }
      ctx.stroke();
    }
    ctx.restore();
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

    /* Caustics – soft rings of focused sunlight drifting over the sand.
       Cells are world-locked on a repeating strip; only their wobble
       is animated. */
    if (!level.dark) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgb(255, 244, 200)';
    var causticTime = nowT * 0.001;
    var CAUSTIC_SPAN = 1056;
    for (var ci = 0; ci < 32; ci++) {
      var cwx = ci * 33 + Math.sin(ci * 2.1) * 20 - camera.x + Math.sin(causticTime * 0.4 + ci) * 8;
      var cix = ((cwx % CAUSTIC_SPAN) + CAUSTIC_SPAN) % CAUSTIC_SPAN - 60;
      if (cix > W + 60) continue;
      var ciy = floorBase + 9 + (ci % 3) * 8 + Math.sin(ci * 1.3) * 3;
      var cir = 22 + (ci * 7) % 13;
      ctx.beginPath();
      var cpts = [];
      for (var cj = 0; cj < 6; cj++) {
        var cang = cj / 6 * Math.PI * 2;
        var crr = cir * (0.65 + 0.35 * Math.sin(causticTime * 1.3 + ci * 2 + cj * 1.9));
        cpts.push([cix + Math.cos(cang) * crr, ciy + Math.sin(cang) * crr * 0.3]);
      }
      ctx.moveTo((cpts[5][0] + cpts[0][0]) / 2, (cpts[5][1] + cpts[0][1]) / 2);
      for (cj = 0; cj < 6; cj++) {
        var cq = cpts[(cj + 1) % 6];
        ctx.quadraticCurveTo(cpts[cj][0], cpts[cj][1], (cpts[cj][0] + cq[0]) / 2, (cpts[cj][1] + cq[1]) / 2);
      }
      /* Wide faint pass then a thin core, so the light reads soft */
      ctx.globalAlpha = 0.04;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 0.07;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
    }

    /* Rock ceiling over the trench – a jagged dark band world-locked
       along the top of the view */
    if (level.ceilingY !== undefined) {
      var cg = ctx.createLinearGradient(0, 0, 0, 40);
      cg.addColorStop(0, '#1e2230');
      cg.addColorStop(1, '#05070c');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      for (var cxp = 0; cxp <= W; cxp += 6) {
        var cwx = cxp + camera.x;
        ctx.lineTo(cxp, level.ceilingY + Math.sin(cwx * 0.05) * 4 + Math.sin(cwx * 0.013) * 7 + Math.abs(Math.sin(cwx * 0.11)) * 9);
      }
      ctx.lineTo(W, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(140, 160, 200, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* Light falloff toward the seabed */
    var depthGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
    depthGrad.addColorStop(0, 'rgba(6, 18, 38, 0)');
    depthGrad.addColorStop(1, 'rgba(6, 18, 38, 0.28)');
    ctx.fillStyle = depthGrad;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);

    /* Water surface – two translucent wave bands with a bright crest
       line and twinkling glints, seen from just below */
    if (level.waterSurface > -50) {
    var surfaceY = level.waterSurface - camera.y;
    var wt = nowT * 0.001;
    var waveA = function (x) { var wx = x + camera.x; return surfaceY + Math.sin(wx * 0.022 + wt * 1.6) * 3 + Math.sin(wx * 0.051 - wt * 2.1) * 1.5; };
    var waveB = function (x) { var wx = x + camera.x; return surfaceY + 4 + Math.sin(wx * 0.03 - wt * 1.9 + 1) * 2.5 + Math.sin(wx * 0.07 + wt * 2.6) * 1.2; };
    ctx.save();
    var airGrad = ctx.createLinearGradient(0, surfaceY - 40, 0, surfaceY);
    airGrad.addColorStop(0, 'rgba(120, 200, 255, 0)');
    airGrad.addColorStop(1, 'rgba(120, 200, 255, 0.1)');
    ctx.fillStyle = airGrad;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY - 40);
    for (var wa = 0; wa <= W + 8; wa += 8) ctx.lineTo(wa, waveA(wa));
    ctx.lineTo(W + 8, surfaceY - 40);
    ctx.closePath();
    ctx.fill();
    var bands = [[waveA, 18, 'rgba(110, 205, 255, 0.34)'], [waveB, 10, 'rgba(185, 238, 255, 0.3)']];
    for (var bnd = 0; bnd < bands.length; bnd++) {
      var wf = bands[bnd][0], depth = bands[bnd][1];
      var bandGrad = ctx.createLinearGradient(0, surfaceY - 4, 0, surfaceY + depth + 4);
      bandGrad.addColorStop(0, bands[bnd][2]);
      bandGrad.addColorStop(1, 'rgba(110, 205, 255, 0)');
      ctx.fillStyle = bandGrad;
      ctx.beginPath();
      for (var wb = 0; wb <= W + 8; wb += 8) ctx.lineTo(wb, wf(wb));
      for (wb = W + 8; wb >= 0; wb -= 8) ctx.lineTo(wb, wf(wb) + depth);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(225, 250, 255, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (var wc = 0; wc <= W + 8; wc += 8) {
      if (wc === 0) ctx.moveTo(wc, waveA(wc)); else ctx.lineTo(wc, waveA(wc));
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#e8fbff';
    for (var gl = 0; gl < 16; gl++) {
      var gx = ((gl * 61 - camera.x) % 860 + 860) % 860 - 30;
      var ga = Math.sin(wt * 2 + gl * 1.7);
      if (ga <= 0 || gx > W + 10) continue;
      ctx.globalAlpha = ga * 0.6;
      ctx.beginPath();
      ctx.ellipse(gx, waveA(gx) + 1.5, 5, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    }

    /* Treasure chests sit on the rocks, behind the pickups they release */
    for (var ck = 0; ck < chests.length; ck++) {
      if (chests[ck].x - camera.x > -60 && chests[ck].x - camera.x < W + 60) {
        chests[ck].draw(ctx, camera.x, camera.y);
      }
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
          ctx.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
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

    /* Trench darkness: everything outside Momoko's lamp falls into
       shadow, then the things that make their own light are re-lit so
       they lead the way. */
    if (level.dark && player) {
      var lx = player.x + player.w / 2 - camera.x;
      var ly = player.y + player.h / 2 - camera.y;
      drawDarkness(lx, ly);
      /* Warm lamp tint around her */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var wg = ctx.createRadialGradient(lx, ly, 4, lx, ly, 110);
      wg.addColorStop(0, 'rgba(255, 225, 170, 0.16)');
      wg.addColorStop(1, 'rgba(255, 225, 170, 0)');
      ctx.fillStyle = wg;
      ctx.fillRect(lx - 110, ly - 110, 220, 220);
      ctx.restore();
      renderGlowPass();
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

  /* The trench shadow is built on an offscreen layer so more than one
     hole can be carved out of it: Momoko's lamp, and a dimmer pool of
     light around the boss so Moni is visible across her lair. */
  var darkCanvas = null, darkCtx = null;
  function carveLight(d, x, y, r0, r1, strength) {
    var g = d.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, 'rgba(0, 0, 0, ' + strength + ')');
    g.addColorStop(0.4, 'rgba(0, 0, 0, ' + strength * 0.75 + ')');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    d.fillStyle = g;
    d.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  }
  function drawDarkness(lx, ly) {
    if (!darkCanvas) {
      darkCanvas = document.createElement('canvas');
      darkCanvas.width = W;
      darkCanvas.height = H;
      darkCtx = darkCanvas.getContext('2d');
    }
    var d = darkCtx;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(2, 6, 16, 0.86)';
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    carveLight(d, lx, ly, 30, 300, 1);
    if (boss && boss.active) {
      carveLight(d, boss.x - camera.x + boss.w / 2, boss.y - camera.y + boss.h / 2, 40, 230, 0.75);
    }
    ctx.drawImage(darkCanvas, 0, 0);
  }

  /* Additive halos for everything bioluminescent, painted over the
     darkness so it glows instead of being swallowed. */
  function glowHalo(c, x, y, r, rgb, a) {
    var g = c.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  var GLOW_RGB = ['63,240,216', '255,111,208', '155,123,255'];
  function renderGlowPass() {
    var t = Date.now() * 0.001;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var i, d, dx, dy;
    for (i = 0; i < level.decorations.length; i++) {
      d = level.decorations[i];
      dx = d.x - camera.x;
      if (dx < -80 || dx > W + 80) continue;
      dy = d.y - camera.y;
      if (d.type === 'glowplant') {
        var gh = d.variant === 1 ? 62 : d.variant === 2 ? 40 : 46;
        glowHalo(ctx, dx, dy - gh, 46, GLOW_RGB[(d.variant || 0) % 3], 0.3 + 0.08 * Math.sin(t * 2 + d.x));
      } else if (d.type === 'vent') {
        glowHalo(ctx, dx, dy - 56, 34, '255,140,40', 0.3 + 0.12 * Math.sin(t * 7 + d.x));
      } else if (d.type === 'crystal') {
        glowHalo(ctx, dx, dy - 20, 40, '120,200,255', 0.3 + 0.06 * Math.sin(t * 1.5 + d.x));
      }
    }
    for (i = 0; i < enemies.length; i++) {
      var en = enemies[i];
      if (!en.active || !en.glow) continue;
      var jg = ctx.createRadialGradient(en.x - camera.x + en.w / 2, en.y - camera.y + 10, 3, en.x - camera.x + en.w / 2, en.y - camera.y + 10, 44);
      jg.addColorStop(0, 'hsla(' + en.hue + ', 90%, 70%, 0.35)');
      jg.addColorStop(1, 'hsla(' + en.hue + ', 90%, 70%, 0)');
      ctx.fillStyle = jg;
      ctx.fillRect(en.x - camera.x + en.w / 2 - 44, en.y - camera.y - 34, 88, 88);
    }
    for (i = 0; i < pickups.length; i++) {
      var pk = pickups[i];
      if (!pk.active) continue;
      var px = pk.x - camera.x + 7, py = pk.y - camera.y + 7;
      if (px < -20 || px > W + 20) continue;
      glowHalo(ctx, px, py, pk.isPearl ? 18 : 16, pk.isPearl ? '255,225,245' : '255,120,160', 0.4);
    }
    for (i = 0; i < chests.length; i++) {
      if (chests[i].open) continue;
      glowHalo(ctx, chests[i].x - camera.x + 18, chests[i].y - camera.y + 14, 30, '255,210,110', 0.28);
    }
    if (boss && boss.active && !boss.defeated) {
      glowHalo(ctx, boss.x - camera.x + boss.w / 2, boss.y - camera.y + boss.h * 0.45, 130, '200,60,180', 0.3);
    }
    ctx.restore();
  }

  /* Ship timber used for the wreck's deck and hull platforms: planks with
     seams, nails, a sunlit top edge and patches of green weed. */
  function drawWoodPlatform(c, px, py, pw, ph, seed) {
    var horiz = pw >= ph;
    c.save();
    var g = c.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, '#9a6a3c');
    g.addColorStop(1, '#4a2e16');
    c.fillStyle = g;
    c.fillRect(px, py, pw, ph);
    /* Plank seams */
    c.strokeStyle = 'rgba(40, 20, 8, 0.55)';
    c.lineWidth = 1;
    var k;
    if (horiz) {
      for (k = 12; k < ph; k += 12) { c.beginPath(); c.moveTo(px, py + k + 0.5); c.lineTo(px + pw, py + k + 0.5); c.stroke(); }
      for (k = 40 + (seed % 30); k < pw; k += 70) { c.beginPath(); c.moveTo(px + k + 0.5, py); c.lineTo(px + k + 0.5, py + Math.min(ph, 12)); c.stroke(); }
    } else {
      for (k = 11; k < pw; k += 11) { c.beginPath(); c.moveTo(px + k + 0.5, py); c.lineTo(px + k + 0.5, py + ph); c.stroke(); }
    }
    /* Nail heads */
    c.fillStyle = '#2a1a0c';
    for (k = 8; k < (horiz ? pw : ph); k += 34) {
      if (horiz) { c.fillRect(px + k, py + 3, 2, 2); c.fillRect(px + k + 1, py + ph - 5, 2, 2); }
      else { c.fillRect(px + 3, py + k, 2, 2); c.fillRect(px + pw - 5, py + k, 2, 2); }
    }
    /* Weed and slime patches (deterministic) */
    for (k = 0; k < 4; k++) {
      var h = ((seed + k * 977) * 7919) & 1023;
      c.fillStyle = k % 2 ? 'rgba(60, 140, 90, 0.35)' : 'rgba(90, 160, 60, 0.3)';
      c.beginPath();
      c.ellipse(px + (h % Math.max(1, pw)), py + ((h >> 4) % Math.max(1, ph)), 6 + (h % 9), 3 + ((h >> 6) % 3), 0.3, 0, Math.PI * 2);
      c.fill();
    }
    /* Lit top edge, dark outline */
    c.fillStyle = 'rgba(255, 210, 150, 0.45)';
    c.fillRect(px, py, pw, 2);
    c.strokeStyle = 'rgba(30, 14, 4, 0.7)';
    c.lineWidth = 1;
    c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    c.restore();
  }

  /* Reef rock palettes – warm / pastel coral-encrusted stone. `patch` are
     the crust colours dabbed over the body, `grow` the colours used for
     the fans, tubes and anemones on top. */
  var REEF_PALETTES = [
    { light: '#ffb7a8', mid: '#de7a7c', dark: '#6e3150', rim: '#ffe4da', patch: ['#ffd27a', '#c9a0ff', '#8fe3cf'], grow: ['#ff6f91', '#ffd24a', '#b77dff'] },
    { light: '#ffd49e', mid: '#de9860', dark: '#6f4034', rim: '#fff1cf', patch: ['#ff9bb8', '#a6e2ff', '#c7f08a'], grow: ['#ff7a5c', '#ff8fd0', '#6fd7ff'] },
    { light: '#dbbaff', mid: '#9f7ad8', dark: '#43306e', rim: '#f3e6ff', patch: ['#ffb0d0', '#ffe08a', '#8fe3cf'], grow: ['#ff9ec8', '#ffd24a', '#7ee2c0'] },
    { light: '#a9eedb', mid: '#5db6a6', dark: '#24525f', rim: '#e2fff5', patch: ['#ffb3c8', '#ffd27a', '#d0b0ff'], grow: ['#ff6f91', '#ffa94d', '#c77dff'] },
  ];
  /* Cold basalt for the trench, crusted with bioluminescent lichen */
  var TRENCH_PALETTES = [
    { light: '#5a6578', mid: '#3a4254', dark: '#141822', rim: '#8fa0b8', patch: ['#3ff0d8', '#c070ff', '#60a0ff'], grow: ['#3ff0d8', '#ff6fd0', '#9b7bff'] },
    { light: '#4e5a6a', mid: '#2f3746', dark: '#10131c', rim: '#7f90a8', patch: ['#56e0c0', '#ff80d0', '#7090ff'], grow: ['#56e0c0', '#ffa0e0', '#80a0ff'] },
  ];
  var ROCK_PALETTE_SETS = { reef: REEF_PALETTES, trench: TRENCH_PALETTES };
  var activeRockPalettes = REEF_PALETTES;

  /* Seeded layouts for each platform, built once on first draw so the
     reef never flickers and no Math.random() runs per frame. Keyed by the
     platform's rect; collision still uses the plain rect. */
  var reefCache = {};

  function buildReefLayout(pw, ph, seed, grounded) {
    var n = 0;
    function rand() {
      n++;
      var v = Math.sin((seed + n * 12.9898) * 78.233) * 43758.5453;
      return v - Math.floor(v);
    }
    var L = { pal: activeRockPalettes[Math.floor(rand() * activeRockPalettes.length)], pts: [], topN: 0, patches: [], dots: [], barnacles: [], grow: [] };
    var r = Math.min(16, pw * 0.35, ph * 0.45);
    var amp = Math.min(6, Math.min(pw, ph) * 0.12);

    /* Outline: rounded rect traced clockwise with a little lumpy noise.
       Top edge first (its point count is kept for the rim highlight). */
    var steps = Math.max(3, Math.round((pw - 2 * r) / 12));
    var a, k;
    for (k = 0; k <= 4; k++) {
      a = Math.PI + (k / 4) * Math.PI / 2;
      L.pts.push([r + Math.cos(a) * r, r + Math.sin(a) * r]);
    }
    for (k = 1; k < steps; k++) {
      L.pts.push([r + (pw - 2 * r) * k / steps, (rand() - 0.6) * amp]);
    }
    for (k = 0; k <= 4; k++) {
      a = -Math.PI / 2 + (k / 4) * Math.PI / 2;
      L.pts.push([pw - r + Math.cos(a) * r, r + Math.sin(a) * r]);
    }
    L.topN = L.pts.length;
    var side = Math.max(1, Math.round((ph - 2 * r) / 14));
    for (k = 1; k < side; k++) L.pts.push([pw + (rand() - 0.5) * amp, r + (ph - 2 * r) * k / side]);
    if (grounded) {
      /* Sink the base into the sand so it reads as rooted */
      L.pts.push([pw + 1, ph + 4], [-1, ph + 4]);
    } else {
      for (k = 0; k <= 4; k++) {
        a = (k / 4) * Math.PI / 2;
        L.pts.push([pw - r + Math.cos(a) * r, ph - r + Math.sin(a) * r]);
      }
      for (k = 1; k < steps; k++) L.pts.push([pw - r - (pw - 2 * r) * k / steps, ph + (rand() - 0.3) * amp]);
      for (k = 0; k <= 4; k++) {
        a = Math.PI / 2 + (k / 4) * Math.PI / 2;
        L.pts.push([r + Math.cos(a) * r, ph - r + Math.sin(a) * r]);
      }
    }
    for (k = side - 1; k >= 1; k--) L.pts.push([(rand() - 0.5) * amp, r + (ph - 2 * r) * k / side]);
    /* Grounded rocks taper a little toward the top like a reef mound */
    if (grounded) {
      for (k = 0; k < L.pts.length; k++) {
        L.pts[k][0] += (pw / 2 - L.pts[k][0]) * 0.12 * Math.max(0, 1 - L.pts[k][1] / ph);
      }
    }

    /* Crust patches and polyp dots, clipped to the body when drawn */
    var area = pw * ph;
    var np = Math.max(2, Math.min(9, Math.round(area / 900)));
    for (k = 0; k < np; k++) {
      L.patches.push({ x: rand() * pw, y: ph * (0.1 + rand() * 0.8), rx: 4 + rand() * Math.min(10, pw * 0.2), ry: 2.5 + rand() * 4, col: L.pal.patch[k % 3], rot: rand() * 3 });
    }
    var nd = Math.max(4, Math.min(30, Math.round(area / 220)));
    for (k = 0; k < nd; k++) {
      L.dots.push({ x: 3 + rand() * (pw - 6), y: 5 + rand() * (ph - 8), r: 0.8 + rand() * 1.4 });
    }
    var nb = Math.max(2, Math.min(12, Math.round((pw + ph) / 30)));
    for (k = 0; k < nb; k++) {
      var onSide = rand() < 0.5;
      L.barnacles.push({
        x: onSide ? (rand() < 0.5 ? 2 + rand() * 5 : pw - 2 - rand() * 5) : 4 + rand() * (pw - 8),
        y: onSide ? ph * (0.3 + rand() * 0.6) : 6 + rand() * Math.max(2, ph - 14),
        r: 1.3 + rand() * 1.3,
      });
    }

    /* Growths across the top face: fans, tubes, anemones, brain mounds */
    var ng = Math.max(2, Math.floor(pw / 26));
    for (k = 0; k < ng; k++) {
      var gx = 5 + (k + 0.5) * ((pw - 10) / ng) + (rand() - 0.5) * 6;
      var kind = rand();
      L.grow.push({
        x: gx,
        type: kind < 0.3 ? 'fan' : kind < 0.55 ? 'tube' : kind < 0.85 ? 'anemone' : 'brain',
        s: 0.7 + rand() * 0.5,
        col: L.pal.grow[Math.floor(rand() * 3)],
        ph: rand() * 6.28,
      });
    }
    return L;
  }

  /* Smooth closed path through the layout points (midpoint quadratics) */
  function traceReef(c, px, py, pts) {
    var n = pts.length;
    var last = pts[n - 1], first = pts[0];
    c.beginPath();
    c.moveTo(px + (last[0] + first[0]) / 2, py + (last[1] + first[1]) / 2);
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      c.quadraticCurveTo(px + p[0], py + p[1], px + (p[0] + q[0]) / 2, py + (p[1] + q[1]) / 2);
    }
    c.closePath();
  }

  /* Coral-encrusted reef rock used as a collision platform. Gradient
     body with a sunlit upper-left, crust patches, polyp dots, barnacles,
     a rim highlight along the top and swaying growths on the crown; the
     lower part falls off into the blue so tall pillars feel deep. */
  function drawRockPlatform(c, px, py, pw, ph, seed, grounded, t) {
    var key = seed + ',' + py + ',' + pw + ',' + ph;
    var L = reefCache[key] || (reefCache[key] = buildReefLayout(pw, ph, seed * 0.37 + ph, grounded));
    var pal = L.pal;
    var k;
    c.save();

    if (grounded) {
      c.fillStyle = 'rgba(4, 14, 26, 0.4)';
      c.beginPath();
      c.ellipse(px + pw / 2, py + ph + 2, pw * 0.6, 5, 0, 0, Math.PI * 2);
      c.fill();
    }

    /* Body */
    var g = c.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(1, pal.dark);
    c.fillStyle = g;
    traceReef(c, px, py, L.pts);
    c.fill();

    c.save();
    c.clip();
    for (k = 0; k < L.patches.length; k++) {
      var pa = L.patches[k];
      c.globalAlpha = 0.3;
      c.fillStyle = pa.col;
      c.beginPath();
      c.ellipse(px + pa.x, py + pa.y, pa.rx, pa.ry, pa.rot, 0, Math.PI * 2);
      c.fill();
    }
    /* Polyp bumps (light) alternating with pits (dark) for texture */
    for (k = 0; k < L.dots.length; k++) {
      var d = L.dots[k];
      c.globalAlpha = k % 2 ? 0.3 : 0.5;
      c.fillStyle = k % 2 ? '#2a0f30' : pal.rim;
      c.beginPath();
      c.arc(px + d.x, py + d.y, d.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    /* Sphere-lit sheen from the upper-left */
    var hr = Math.max(pw, ph) * 0.8;
    var hg = c.createRadialGradient(px + pw * 0.3, py + Math.min(ph * 0.25, 14), 2, px + pw * 0.3, py + Math.min(ph * 0.25, 14), hr);
    hg.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    hg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = hg;
    c.fillRect(px - 2, py - 6, pw + 4, ph + 12);
    /* Light falloff toward the base */
    var fg = c.createLinearGradient(0, py + Math.min(ph * 0.35, 24), 0, py + ph + 4);
    fg.addColorStop(0, 'rgba(8, 26, 52, 0)');
    fg.addColorStop(1, 'rgba(8, 26, 52, 0.6)');
    c.fillStyle = fg;
    c.fillRect(px - 2, py - 6, pw + 4, ph + 12);
    c.restore();

    /* Rim highlight along the top edge, soft outline all round */
    c.strokeStyle = 'rgba(20, 8, 30, 0.35)';
    c.lineWidth = 1;
    traceReef(c, px, py, L.pts);
    c.stroke();
    c.strokeStyle = pal.rim;
    c.globalAlpha = 0.75;
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    for (k = 1; k < L.topN - 1; k++) {
      var p0 = L.pts[k], p1 = L.pts[k + 1];
      var mx = px + (p0[0] + p1[0]) / 2, my = py + (p0[1] + p1[1]) / 2 + 1;
      if (k === 1) c.moveTo(mx, my); else c.lineTo(mx, my);
    }
    c.stroke();
    c.globalAlpha = 1;

    /* Barnacles – cream cones with a dark opening */
    for (k = 0; k < L.barnacles.length; k++) {
      var b = L.barnacles[k];
      c.fillStyle = '#f2e8d4';
      c.beginPath();
      c.arc(px + b.x, py + b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#5d5048';
      c.beginPath();
      c.arc(px + b.x, py + b.y - b.r * 0.15, b.r * 0.4, 0, Math.PI * 2);
      c.fill();
    }

    /* Crown growths */
    for (k = 0; k < L.grow.length; k++) {
      var gr = L.grow[k];
      drawReefGrowth(c, px + gr.x, py + 2, gr, Math.sin(t * 0.0013 + gr.ph));
    }
    c.restore();
  }

  /* One growth on a reef crown. `sway` is -1..1. */
  function drawReefGrowth(c, x, y, gr, sway) {
    var s = gr.s, col = gr.col, i;
    c.lineCap = 'round';
    if (gr.type === 'fan') {
      /* Gorgonian sea fan: faint webbing behind branching twigs */
      var sw = sway * 2 * s;
      c.fillStyle = col;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x - 13 * s + sw, y - 8 * s, x - 9 * s + sw, y - 18 * s, x + sw, y - 18 * s);
      c.bezierCurveTo(x + 9 * s + sw, y - 18 * s, x + 13 * s + sw, y - 8 * s, x, y);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      c.beginPath();
      for (i = 0; i < 5; i++) {
        var ang = -Math.PI / 2 + (i - 2) * 0.38;
        var len = (14 + (i % 2) * 3) * s;
        var ex0 = x + sw * 0.5 + Math.cos(ang) * len * 0.55, ey0 = y + Math.sin(ang) * len * 0.55;
        var ex1 = x + sw + Math.cos(ang) * len, ey1 = y + Math.sin(ang) * len;
        c.moveTo(x, y);
        c.quadraticCurveTo(ex0, ey0, ex1, ey1);
        c.moveTo(ex0, ey0);
        c.lineTo(ex0 + Math.cos(ang - 0.6) * 5 * s + sw * 0.3, ey0 + Math.sin(ang - 0.6) * 5 * s);
        c.moveTo(ex0, ey0);
        c.lineTo(ex0 + Math.cos(ang + 0.6) * 5 * s + sw * 0.3, ey0 + Math.sin(ang + 0.6) * 5 * s);
      }
      c.stroke();
    } else if (gr.type === 'tube') {
      for (i = -1; i <= 1; i++) {
        var th = (7 + (i === 0 ? 5 : 2 - i)) * s;
        var tx = x + i * 3.6 * s + sway * (1 + i * 0.3) * 0.8;
        c.strokeStyle = col;
        c.lineWidth = 3.2 * s;
        c.beginPath();
        c.moveTo(x + i * 3 * s, y + 1);
        c.lineTo(tx, y - th);
        c.stroke();
        c.fillStyle = 'rgba(40, 10, 30, 0.75)';
        c.beginPath();
        c.ellipse(tx, y - th, 1.5 * s, 0.9 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(tx, y - th, 1.8 * s, 1.1 * s, 0, Math.PI, Math.PI * 2);
        c.stroke();
      }
    } else if (gr.type === 'anemone') {
      c.strokeStyle = col;
      c.lineWidth = 1.4 * s;
      for (i = 0; i < 7; i++) {
        var aa = -Math.PI / 2 + (i - 3) * 0.32;
        var len = (7 + (i % 2) * 2) * s;
        var wv = sway * 2.5 + Math.sin(i * 1.7 + sway) * 0.8;
        var ex = x + Math.cos(aa) * len + wv, ey = y - 1 + Math.sin(aa) * len;
        c.beginPath();
        c.moveTo(x, y - 1);
        c.quadraticCurveTo(x + Math.cos(aa) * len * 0.5 + wv * 0.3, y - 1 + Math.sin(aa) * len * 0.6, ex, ey);
        c.stroke();
        c.fillStyle = '#fff4fa';
        c.beginPath();
        c.arc(ex, ey, 1.1 * s, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(x, y, 3.2 * s, 2.4 * s, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      var bg = c.createRadialGradient(x - 2 * s, y - 4 * s, 0.5, x, y - 2 * s, 7 * s);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.25, col);
      bg.addColorStop(1, 'rgba(60, 20, 50, 0.9)');
      c.fillStyle = bg;
      c.beginPath();
      c.ellipse(x, y - 1.5 * s, 7 * s, 5 * s, 0, Math.PI, Math.PI * 2);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(60, 20, 50, 0.4)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(x - 5 * s, y - 2 * s);
      c.bezierCurveTo(x - 2 * s, y - 5 * s, x + 1 * s, y - 1 * s, x + 5 * s, y - 3 * s);
      c.stroke();
    }
  }

  /* Reef coral – three styles selected by variant 0/1/2 so the level
     reads as a varied reef rather than a row of identical orange blobs.
     `seed` (the world-x of the decoration) is used to deterministically
     vary heights / branch counts so each instance still looks distinct.
     0 – branching staghorn (vertical fingers tipped with pale knobs)
     1 – brain coral (rounded mound with meandering grooves)
     2 – sea fan (broad ribbed fan)
   */
  function drawCoral(c, dx, dy, variant, seed) {
    var palette = [
      { base: '#c95a4a', mid: '#e88366', tip: '#ffd0b0', accent: '#7a2a1d' },
      { base: '#b8487a', mid: '#d76a9c', tip: '#ffd6e6', accent: '#5b1a3a' },
      { base: '#d99a3a', mid: '#f0bf5c', tip: '#fff1b3', accent: '#7a5418' },
    ];
    var pal = palette[variant % palette.length];
    var sway = Math.sin(Date.now() * 0.0009 + seed * 0.013) * 1.4;

    if (variant === 1) {
      drawBrainCoral(c, dx, dy, pal);
    } else if (variant === 2) {
      drawFanCoral(c, dx, dy, pal, sway);
    } else {
      drawStaghornCoral(c, dx, dy, pal, sway, seed);
    }
  }

  function drawStaghornCoral(c, dx, dy, pal, sway, seed) {
    /* Stable base lump so it looks rooted to the seafloor */
    c.fillStyle = pal.accent;
    c.beginPath();
    c.ellipse(dx, dy + 6, 16, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = pal.base;
    c.beginPath();
    c.ellipse(dx, dy + 4, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
    /* 3 branching fingers leaning outward */
    var branches = [
      { rootX: dx - 7, leanX: -6, h: 18 },
      { rootX: dx,     leanX: 0,  h: 24 },
      { rootX: dx + 7, leanX: 6,  h: 20 },
    ];
    for (var i = 0; i < branches.length; i++) {
      var b = branches[i];
      var hVar = ((seed * (i + 1)) % 7) - 3; /* deterministic ±3 jitter */
      var h = b.h + hVar;
      var sw = sway * (0.4 + i * 0.3);
      var topX = b.rootX + b.leanX + sw;
      var topY = dy + 2 - h;
      /* Trunk */
      c.strokeStyle = pal.base;
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(b.rootX, dy + 2);
      c.bezierCurveTo(
        b.rootX + b.leanX * 0.3, dy - h * 0.4,
        topX - b.leanX * 0.2, dy + 2 - h * 0.7,
        topX, topY
      );
      c.stroke();
      /* Mid-tone highlight stripe */
      c.strokeStyle = pal.mid;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(b.rootX - 1, dy + 1);
      c.bezierCurveTo(
        b.rootX + b.leanX * 0.25 - 1, dy - h * 0.4,
        topX - b.leanX * 0.2 - 1, dy + 2 - h * 0.7,
        topX - 1, topY + 1
      );
      c.stroke();
      /* Polyp tip */
      c.fillStyle = pal.tip;
      c.beginPath();
      c.arc(topX, topY, 3, 0, Math.PI * 2);
      c.fill();
      /* Smaller side knob halfway up the trunk */
      var midX = b.rootX + b.leanX * 0.5 + sw * 0.5;
      var midY = dy + 2 - h * 0.55;
      c.fillStyle = pal.mid;
      c.beginPath();
      c.arc(midX + (i % 2 === 0 ? -3 : 3), midY, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBrainCoral(c, dx, dy, pal) {
    /* Mound */
    c.fillStyle = pal.accent;
    c.beginPath();
    c.ellipse(dx, dy + 4, 18, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = pal.base;
    c.beginPath();
    c.ellipse(dx, dy - 2, 16, 11, 0, 0, Math.PI * 2);
    c.fill();
    /* Highlight cap */
    c.fillStyle = pal.mid;
    c.beginPath();
    c.ellipse(dx - 2, dy - 5, 12, 5, 0, 0, Math.PI * 2);
    c.fill();
    /* Meandering grooves – the "brain" texture */
    c.strokeStyle = pal.accent;
    c.lineWidth = 1;
    c.lineCap = 'round';
    for (var g = 0; g < 4; g++) {
      var gy = dy - 6 + g * 3;
      c.beginPath();
      c.moveTo(dx - 13, gy);
      c.bezierCurveTo(dx - 6, gy + 2, dx - 2, gy - 2, dx + 4, gy + 1);
      c.bezierCurveTo(dx + 8, gy + 2, dx + 11, gy - 1, dx + 13, gy);
      c.stroke();
    }
  }

  function drawFanCoral(c, dx, dy, pal, sway) {
    /* Short trunk */
    c.fillStyle = pal.accent;
    c.fillRect(dx - 2, dy - 2, 4, 8);
    /* Fan body – broad triangle with rounded top */
    c.fillStyle = pal.base;
    c.beginPath();
    c.moveTo(dx - 1, dy - 2);
    c.bezierCurveTo(dx - 18 + sway, dy - 14, dx - 14 + sway, dy - 22, dx + sway, dy - 24);
    c.bezierCurveTo(dx + 14 + sway, dy - 22, dx + 18 + sway, dy - 14, dx + 1, dy - 2);
    c.closePath();
    c.fill();
    /* Mid-tone inner fan */
    c.fillStyle = pal.mid;
    c.beginPath();
    c.moveTo(dx, dy - 4);
    c.bezierCurveTo(dx - 12 + sway * 0.7, dy - 13, dx - 9 + sway * 0.7, dy - 19, dx + sway * 0.7, dy - 21);
    c.bezierCurveTo(dx + 9 + sway * 0.7, dy - 19, dx + 12 + sway * 0.7, dy - 13, dx, dy - 4);
    c.closePath();
    c.fill();
    /* Radial veins – fine ribs from base to tips */
    c.strokeStyle = pal.accent;
    c.lineWidth = 0.8;
    var spread = Math.PI * 0.55;
    for (var v = 0; v < 9; v++) {
      var t = v / 8;
      var ang = -Math.PI / 2 - spread / 2 + spread * t;
      var len = 18 + Math.sin(t * Math.PI) * 4;
      var endX = dx + sway + Math.cos(ang) * len;
      var endY = dy - 2 + Math.sin(ang) * len;
      c.beginPath();
      c.moveTo(dx, dy - 2);
      c.lineTo(endX, endY);
      c.stroke();
    }
    /* Bright tip beads along the rim */
    c.fillStyle = pal.tip;
    for (var b = 0; b < 5; b++) {
      var bt = b / 4;
      var bAng = -Math.PI / 2 - spread / 2 + spread * bt;
      var bx = dx + sway + Math.cos(bAng) * 22;
      var by = dy - 2 + Math.sin(bAng) * 22;
      c.beginPath();
      c.arc(bx, by, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  function renderDecorations() {
    if (!level) return;
    var t = Date.now() * 0.001;
    for (var i = 0; i < level.decorations.length; i++) {
      var d = level.decorations[i];
      var dx = d.x - camera.x;
      var reach = d.type === 'wreck' ? (d.w || 300) + 100 : 160;
      if (dx < -reach || dx > W + reach) continue;
      drawDecorationAt(ctx, d, dx, d.y - camera.y, t);
    }
  }

  /* Paints one decoration with its anchor at screen (dx, dy). `t` is time
     in seconds for the sway animations. Also used by the level-select
     thumbnails, hence the explicit context. */
  function drawDecorationAt(c, d, dx, dy, t) {
    if (d.type === 'seaweed') {
      var sway = Math.sin(t + d.x * 0.01) * 8;
      c.fillStyle = '#1a6633';
      c.beginPath();
      c.moveTo(dx, dy);
      c.quadraticCurveTo(dx + sway, dy - d.h * 0.5, dx + 3, dy - d.h);
      c.quadraticCurveTo(dx + sway + 6, dy - d.h * 0.5, dx + 8, dy);
      c.closePath();
      c.fill();
      /* Second frond */
      c.fillStyle = '#228844';
      c.beginPath();
      c.moveTo(dx + 4, dy);
      c.quadraticCurveTo(dx + 4 - sway * 0.7, dy - d.h * 0.4, dx + 6, dy - d.h * 0.8);
      c.quadraticCurveTo(dx + 10 - sway * 0.7, dy - d.h * 0.3, dx + 10, dy);
      c.closePath();
      c.fill();
    } else if (d.type === 'coral') {
      drawCoral(c, dx, dy, d.variant || 0, d.x);
    } else if (d.type === 'shell') {
      c.fillStyle = '#ffddaa';
      c.beginPath();
      c.arc(dx, dy, 6, Math.PI, 0);
      c.fill();
      c.strokeStyle = '#ccaa77';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(dx - 4, dy); c.lineTo(dx, dy - 5);
      c.moveTo(dx, dy); c.lineTo(dx, dy - 6);
      c.moveTo(dx + 4, dy); c.lineTo(dx, dy - 5);
      c.stroke();
    } else if (d.type === 'kelp' || d.type === 'tallkelp') {
      drawKelp(c, dx, dy, d, t, d.type === 'tallkelp');
    } else if (d.type === 'wreck') {
      drawWreck(c, dx, dy, d.w || 600, d.h || 220, !!d.stern, d.x);
    } else if (d.type === 'mast') {
      drawMast(c, dx, dy, d.h || 230, t);
    } else if (d.type === 'anchor') {
      drawAnchor(c, dx, dy);
    } else if (d.type === 'barrel') {
      drawBarrel(c, dx, dy, !!d.lying);
    } else if (d.type === 'glowplant') {
      drawGlowPlant(c, dx, dy, d.variant || 0, t, d.x);
    } else if (d.type === 'vent') {
      drawVent(c, dx, dy, t, d.x);
    } else if (d.type === 'crystal') {
      drawCrystal(c, dx, dy, d.x);
    }
  }

  /* Kelp stalk with alternating blades; the tall forest variant is
     thicker, bluer and carries little gas bladders at each blade. */
  function drawKelp(c, dx, dy, d, t, tall) {
    var kh = d.h || 120;
    var kSway = Math.sin(t + d.x * 0.005) * (tall ? 18 : 12);
    c.strokeStyle = tall ? '#1d5c45' : '#1a6633';
    c.lineWidth = tall ? 5 : 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(dx, dy);
    c.bezierCurveTo(dx + kSway * 0.3, dy - kh * 0.33, dx + kSway * 0.7, dy - kh * 0.66, dx + kSway, dy - kh);
    c.stroke();
    if (tall) {
      c.strokeStyle = 'rgba(120, 220, 160, 0.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(dx - 1, dy);
      c.bezierCurveTo(dx + kSway * 0.3 - 1, dy - kh * 0.33, dx + kSway * 0.7 - 1, dy - kh * 0.66, dx + kSway - 1, dy - kh);
      c.stroke();
    }
    var leafColors = tall ? ['#2a8a5a', '#1f7a50', '#36a06a'] : ['#228844', '#1a7738', '#20994a'];
    var n = tall ? 7 : 5;
    for (var lf = 0; lf < n; lf++) {
      var lt = (lf + 1) / (n + 1);
      var lx = dx + kSway * lt;
      var ly = dy - kh * lt;
      var leafSway = Math.sin(t * 1.2 + lf * 1.5 + d.x * 0.01) * 8;
      var leafDir = lf % 2 === 0 ? 1 : -1;
      var L = tall ? 26 : 18;
      var lg = c.createLinearGradient(lx, ly, lx + leafDir * L, ly);
      lg.addColorStop(0, leafColors[lf % leafColors.length]);
      lg.addColorStop(1, tall ? '#7fe0a8' : '#5fcf8a');
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(lx, ly);
      c.quadraticCurveTo(lx + leafDir * (L * 0.65 + leafSway), ly - (tall ? 9 : 6), lx + leafDir * (L + leafSway), ly - 2);
      c.quadraticCurveTo(lx + leafDir * (L * 0.65 + leafSway), ly + 3, lx, ly);
      c.closePath();
      c.fill();
      if (tall) {
        /* Gas bladder at the blade base */
        c.fillStyle = '#b8e08a';
        c.beginPath(); c.ellipse(lx + leafDir * 4, ly - 1, 3.2, 2.4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath(); c.arc(lx + leafDir * 3, ly - 2, 0.9, 0, Math.PI * 2); c.fill();
      }
    }
  }

  /* Broken hull section seen side-on: planked timber rising from the
     sand to a splintered top edge, with brass portholes and weed drips.
     `stern` mirrors the curve so the two pieces read as one ship. */
  function drawWreck(c, dx, dy, w, h, stern, seed) {
    c.save();
    if (stern) { c.translate(dx + w, 0); c.scale(-1, 1); dx = 0; }
    var top = dy - h;
    /* Silhouette: curved bow on the left, broken edge across the top */
    c.beginPath();
    c.moveTo(dx + w, dy + 6);
    c.lineTo(dx + 40, dy + 6);
    c.bezierCurveTo(dx + 10, dy - h * 0.2, dx - 4, dy - h * 0.6, dx + 14, top);
    var segs = 9;
    for (var s = 1; s <= segs; s++) {
      var sx = dx + 14 + (w - 14) * s / segs;
      var jag = ((seed * 31 + s * 977) % 23) - 11;
      var rise = s > segs * 0.6 ? (s - segs * 0.6) / (segs * 0.4) * h * 0.45 : 0;
      c.lineTo(sx, top + jag + rise + (s % 2 ? 8 : 0));
    }
    c.closePath();
    var g = c.createLinearGradient(0, top, 0, dy);
    g.addColorStop(0, '#5a3c26');
    g.addColorStop(1, '#2a1a10');
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    /* Plank lines following the hull's curve */
    c.strokeStyle = 'rgba(20, 10, 4, 0.55)';
    c.lineWidth = 1.2;
    for (var py = top + 10; py < dy; py += 14) {
      c.beginPath();
      c.moveTo(dx - 10, py);
      c.quadraticCurveTo(dx + w * 0.5, py + 6, dx + w + 10, py);
      c.stroke();
    }
    c.strokeStyle = 'rgba(255, 200, 140, 0.08)';
    for (py = top + 4; py < dy; py += 14) {
      c.beginPath();
      c.moveTo(dx - 10, py);
      c.quadraticCurveTo(dx + w * 0.5, py + 6, dx + w + 10, py);
      c.stroke();
    }
    /* Vertical ribs */
    c.strokeStyle = 'rgba(20, 10, 4, 0.4)';
    for (var rx = dx + 60; rx < dx + w; rx += 90) {
      c.beginPath(); c.moveTo(rx, top - 10); c.lineTo(rx + 6, dy + 10); c.stroke();
    }
    /* A hole in the hull */
    var hg = c.createRadialGradient(dx + w * 0.55, dy - h * 0.28, 2, dx + w * 0.55, dy - h * 0.28, 26);
    hg.addColorStop(0, 'rgba(4, 10, 20, 0.95)');
    hg.addColorStop(0.7, 'rgba(4, 10, 20, 0.8)');
    hg.addColorStop(1, 'rgba(4, 10, 20, 0)');
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(dx + w * 0.55, dy - h * 0.28, 24, 16, 0.3, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Portholes – brass rings around dark glass */
    for (var p = 0; p < 3; p++) {
      var pxp = dx + w * (0.22 + p * 0.17), pyp = dy - h * 0.5 - p * 4;
      c.fillStyle = '#2a1a10';
      c.beginPath(); c.arc(pxp, pyp, 11, 0, Math.PI * 2); c.fill();
      var bg = c.createLinearGradient(pxp - 10, pyp - 10, pxp + 10, pyp + 10);
      bg.addColorStop(0, '#e8c26a');
      bg.addColorStop(0.5, '#9a7030');
      bg.addColorStop(1, '#d9b050');
      c.strokeStyle = bg;
      c.lineWidth = 3.5;
      c.beginPath(); c.arc(pxp, pyp, 9, 0, Math.PI * 2); c.stroke();
      var gg = c.createRadialGradient(pxp - 3, pyp - 3, 1, pxp, pyp, 8);
      gg.addColorStop(0, '#3a5a70');
      gg.addColorStop(1, '#0a1620');
      c.fillStyle = gg;
      c.beginPath(); c.arc(pxp, pyp, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath(); c.ellipse(pxp - 2.5, pyp - 3, 2.2, 1.2, -0.7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a3418';
      for (var b = 0; b < 4; b++) {
        var ba = b * Math.PI / 2 + 0.4;
        c.beginPath(); c.arc(pxp + Math.cos(ba) * 9, pyp + Math.sin(ba) * 9, 1, 0, Math.PI * 2); c.fill();
      }
    }
    /* Weed drips over the broken edge */
    c.strokeStyle = 'rgba(60, 150, 90, 0.7)';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (var wd = 0; wd < 6; wd++) {
      var wx = dx + 30 + (w - 60) * wd / 5;
      var wy = top + 6 + ((seed + wd * 131) % 20);
      c.beginPath();
      c.moveTo(wx, wy - 4);
      c.quadraticCurveTo(wx + 3, wy + 10, wx - 1, wy + 18 + (wd % 3) * 6);
      c.stroke();
    }
    /* Edge outline */
    c.strokeStyle = 'rgba(15, 8, 2, 0.7)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(dx + 40, dy + 6);
    c.bezierCurveTo(dx + 10, dy - h * 0.2, dx - 4, dy - h * 0.6, dx + 14, top);
    c.stroke();
    c.restore();
  }

  /* Mast with a yard and a torn, slowly billowing sail */
  function drawMast(c, dx, dy, h, t) {
    var top = dy - h;
    var yardY = top + h * 0.22;
    var bil = Math.sin(t * 0.8 + dx * 0.001) * 6;
    c.save();
    c.lineCap = 'round';
    /* Rigging */
    c.strokeStyle = 'rgba(200, 180, 140, 0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(dx, top + 4); c.lineTo(dx - 70, yardY + 2);
    c.moveTo(dx, top + 4); c.lineTo(dx + 70, yardY + 2);
    c.moveTo(dx - 70, yardY + 2); c.lineTo(dx - 30, dy);
    c.moveTo(dx + 70, yardY + 2); c.lineTo(dx + 36, dy);
    c.stroke();
    /* Sail – tattered cloth hanging from the yard */
    var sg = c.createLinearGradient(dx - 60, yardY, dx + 60, yardY + 90);
    sg.addColorStop(0, '#d8cfb8');
    sg.addColorStop(1, '#8a826e');
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(dx - 62, yardY + 3);
    c.lineTo(dx + 62, yardY + 3);
    c.quadraticCurveTo(dx + 64 + bil, yardY + 50, dx + 52 + bil, yardY + 96);
    var rag = [[dx + 40, yardY + 80], [dx + 26, yardY + 104], [dx + 10, yardY + 72], [dx - 6, yardY + 98], [dx - 22, yardY + 84], [dx - 40, yardY + 108], [dx - 54, yardY + 88]];
    for (var r = 0; r < rag.length; r++) c.lineTo(rag[r][0] + bil * (0.4 + r * 0.08), rag[r][1]);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(70, 60, 40, 0.5)';
    c.lineWidth = 1;
    c.stroke();
    /* Holes and seams in the cloth */
    c.fillStyle = 'rgba(14, 50, 70, 0.7)';
    c.beginPath(); c.ellipse(dx + 18 + bil * 0.5, yardY + 40, 7, 5, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(dx - 30 + bil * 0.3, yardY + 58, 5, 8, -0.3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(70, 60, 40, 0.35)';
    for (var sm = 1; sm < 4; sm++) {
      c.beginPath(); c.moveTo(dx - 60, yardY + 3 + sm * 22); c.quadraticCurveTo(dx + bil * 0.5, yardY + 8 + sm * 22, dx + 58, yardY + 3 + sm * 22); c.stroke();
    }
    /* Yard and mast */
    c.strokeStyle = '#3a2412';
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(dx - 68, yardY + 2); c.lineTo(dx + 68, yardY - 2); c.stroke();
    var mg = c.createLinearGradient(dx - 4, 0, dx + 4, 0);
    mg.addColorStop(0, '#2a1a0c');
    mg.addColorStop(0.5, '#7a5230');
    mg.addColorStop(1, '#3a2412');
    c.strokeStyle = mg;
    c.lineWidth = 8;
    c.beginPath(); c.moveTo(dx, dy + 4); c.lineTo(dx, top); c.stroke();
    /* Crow's nest */
    c.fillStyle = '#4a3018';
    c.fillRect(dx - 12, top + 10, 24, 10);
    c.fillStyle = '#6a4828';
    c.fillRect(dx - 12, top + 10, 24, 3);
    c.restore();
  }

  function drawAnchor(c, dx, dy) {
    c.save();
    c.translate(dx, dy - 4);
    c.rotate(-0.22);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    var iron = c.createLinearGradient(-20, 0, 20, 0);
    iron.addColorStop(0, '#2c313a');
    iron.addColorStop(0.5, '#6a7482');
    iron.addColorStop(1, '#2c313a');
    /* Arms – a wide crescent with flukes at the tips */
    c.strokeStyle = iron;
    c.lineWidth = 6;
    c.beginPath(); c.arc(0, -22, 24, 0.25, Math.PI - 0.25); c.stroke();
    c.fillStyle = '#4a525e';
    c.beginPath(); c.moveTo(-26, -8); c.lineTo(-18, -22); c.lineTo(-30, -20); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(26, -8); c.lineTo(18, -22); c.lineTo(30, -20); c.closePath(); c.fill();
    /* Shank */
    c.strokeStyle = iron;
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -64); c.stroke();
    /* Stock (crossbar) and ring */
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(-18, -58); c.lineTo(18, -58); c.stroke();
    c.lineWidth = 3.5;
    c.beginPath(); c.arc(0, -70, 6, 0, Math.PI * 2); c.stroke();
    /* Rust and highlights */
    c.fillStyle = 'rgba(150, 70, 30, 0.55)';
    c.beginPath(); c.ellipse(-2, -40, 3, 5, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(14, -16, 3, 2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-10, -58, 2.5, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-1.5, -8); c.lineTo(-1.5, -52); c.stroke();
    c.restore();
    /* Sand it has sunk into */
    c.fillStyle = 'rgba(138, 118, 86, 0.9)';
    c.beginPath(); c.ellipse(dx, dy, 22, 5, 0, 0, Math.PI * 2); c.fill();
  }

  function drawBarrel(c, dx, dy, lying) {
    c.save();
    c.fillStyle = 'rgba(4, 14, 26, 0.35)';
    c.beginPath(); c.ellipse(dx, dy + 1, lying ? 20 : 14, 3.5, 0, 0, Math.PI * 2); c.fill();
    if (lying) {
      c.translate(dx, dy - 12);
      /* Side-on cylinder: staves run horizontally, hoops are vertical */
      var bg = c.createLinearGradient(0, -12, 0, 12);
      bg.addColorStop(0, '#b07a44');
      bg.addColorStop(0.5, '#7a4e26');
      bg.addColorStop(1, '#3e2612');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(-16, -11);
      c.quadraticCurveTo(0, -14, 16, -11);
      c.lineTo(16, 11);
      c.quadraticCurveTo(0, 14, -16, 11);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(40, 20, 8, 0.5)';
      c.lineWidth = 1;
      for (var s = -8; s <= 8; s += 4) { c.beginPath(); c.moveTo(-16, s); c.lineTo(16, s); c.stroke(); }
      c.fillStyle = '#3a3f48';
      c.fillRect(-10, -12.5, 3, 25);
      c.fillRect(7, -12.5, 3, 25);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(-9.5, -12, 1, 24);
      c.fillRect(7.5, -12, 1, 24);
      /* Visible end */
      c.fillStyle = '#5a381a';
      c.beginPath(); c.ellipse(16, 0, 4, 12, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a1a0c';
      c.stroke();
    } else {
      c.translate(dx, dy - 16);
      var vg = c.createLinearGradient(-13, 0, 13, 0);
      vg.addColorStop(0, '#3e2612');
      vg.addColorStop(0.35, '#b07a44');
      vg.addColorStop(0.7, '#7a4e26');
      vg.addColorStop(1, '#3e2612');
      c.fillStyle = vg;
      c.beginPath();
      c.moveTo(-11, -16);
      c.quadraticCurveTo(-15, 0, -11, 16);
      c.lineTo(11, 16);
      c.quadraticCurveTo(15, 0, 11, -16);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(40, 20, 8, 0.5)';
      c.lineWidth = 1;
      for (var v = -7; v <= 7; v += 4.5) {
        c.beginPath(); c.moveTo(v, -16); c.quadraticCurveTo(v * 1.25, 0, v, 16); c.stroke();
      }
      c.fillStyle = '#3a3f48';
      c.fillRect(-13, -9, 26, 3);
      c.fillRect(-13, 6, 26, 3);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(-13, -8.5, 26, 1);
      c.fillRect(-13, 6.5, 26, 1);
      c.fillStyle = '#5a381a';
      c.beginPath(); c.ellipse(0, -16, 11, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a1a0c';
      c.stroke();
      c.strokeStyle = 'rgba(40, 20, 8, 0.6)';
      c.beginPath();
      c.moveTo(-11, -16); c.quadraticCurveTo(-15, 0, -11, 16);
      c.moveTo(11, -16); c.quadraticCurveTo(15, 0, 11, 16);
      c.stroke();
    }
    c.restore();
  }

  /* Bioluminescent plants for the trench. The additive halos are added
     in renderGlowPass; this paints the plant bodies and their lit tips.
       0 – tube anemone: a fan of teal tubes with bright bulb tips
       1 – lantern stalk: tall curving stem with a glowing pink bulb
       2 – violet fern: three fronds beaded with glowing dots */
  function drawGlowPlant(c, dx, dy, variant, t, seed) {
    var sway = Math.sin(t * 1.1 + seed * 0.01) * 3;
    c.save();
    c.lineCap = 'round';
    if (variant === 1) {
      var h = 60;
      c.strokeStyle = '#3b2a5e';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(dx, dy);
      c.bezierCurveTo(dx - 6, dy - h * 0.4, dx + 10 + sway, dy - h * 0.7, dx + 2 + sway, dy - h);
      c.stroke();
      c.strokeStyle = '#7a5aa8';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(dx - 1, dy);
      c.bezierCurveTo(dx - 7, dy - h * 0.4, dx + 9 + sway, dy - h * 0.7, dx + 1 + sway, dy - h);
      c.stroke();
      /* Leaves */
      c.fillStyle = '#4a3a78';
      c.beginPath(); c.moveTo(dx - 2, dy - 18); c.quadraticCurveTo(dx - 18, dy - 26, dx - 20, dy - 14); c.quadraticCurveTo(dx - 10, dy - 12, dx - 2, dy - 18); c.fill();
      c.beginPath(); c.moveTo(dx + 3, dy - 32); c.quadraticCurveTo(dx + 18, dy - 40, dx + 22, dy - 28); c.quadraticCurveTo(dx + 12, dy - 26, dx + 3, dy - 32); c.fill();
      /* Bulb */
      var bx = dx + 2 + sway, by = dy - h - 4;
      var bg = c.createRadialGradient(bx - 2, by - 2, 1, bx, by, 9);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.4, '#ff9ee0');
      bg.addColorStop(1, '#c03a9a');
      c.fillStyle = bg;
      c.beginPath(); c.arc(bx, by, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.ellipse(bx - 3, by - 3.5, 2.4, 1.4, -0.6, 0, Math.PI * 2); c.fill();
    } else if (variant === 2) {
      for (var f = -1; f <= 1; f++) {
        var fh = 42 - Math.abs(f) * 8;
        var tipX = dx + f * 16 + sway * (1 + f * 0.3), tipY = dy - fh;
        c.strokeStyle = '#5a3a9a';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(dx, dy);
        c.quadraticCurveTo(dx + f * 6, dy - fh * 0.6, tipX, tipY);
        c.stroke();
        c.strokeStyle = '#9b7bff';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(dx, dy);
        c.quadraticCurveTo(dx + f * 6, dy - fh * 0.6, tipX, tipY);
        c.stroke();
        for (var k = 1; k <= 4; k++) {
          var kt = k / 4.5, mt = 1 - kt;
          var kx = mt * mt * dx + 2 * mt * kt * (dx + f * 6) + kt * kt * tipX;
          var ky = mt * mt * dy + 2 * mt * kt * (dy - fh * 0.6) + kt * kt * tipY;
          var side = (k % 2 ? 1 : -1) * 5;
          c.strokeStyle = '#6a4ab0';
          c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + side, ky - 3); c.stroke();
          c.fillStyle = '#d8ccff';
          c.beginPath(); c.arc(kx + side, ky - 3, 1.6 + 0.5 * Math.sin(t * 3 + k + f), 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(tipX, tipY, 2.2, 0, Math.PI * 2); c.fill();
      }
    } else {
      for (var i = 0; i < 5; i++) {
        var a = -Math.PI / 2 + (i - 2) * 0.32;
        var len = 34 + (i % 2) * 8;
        var ex = dx + Math.cos(a) * len + sway * (0.6 + i * 0.1), ey = dy + Math.sin(a) * len;
        c.strokeStyle = '#124a48';
        c.lineWidth = 4.5;
        c.beginPath(); c.moveTo(dx + (i - 2) * 2, dy); c.quadraticCurveTo(dx + (i - 2) * 6, dy - len * 0.5, ex, ey); c.stroke();
        c.strokeStyle = '#2a9a90';
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(dx + (i - 2) * 2, dy); c.quadraticCurveTo(dx + (i - 2) * 6, dy - len * 0.5, ex, ey); c.stroke();
        var tg = c.createRadialGradient(ex, ey, 0.5, ex, ey, 5);
        tg.addColorStop(0, '#ffffff');
        tg.addColorStop(0.5, '#8ffff0');
        tg.addColorStop(1, 'rgba(63, 240, 216, 0)');
        c.fillStyle = tg;
        c.beginPath(); c.arc(ex, ey, 5, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#0d3836';
      c.beginPath(); c.ellipse(dx, dy, 9, 4, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /* Hydrothermal vent: a dark layered chimney breathing warm light and
     slow puffs of smoke. */
  function drawVent(c, dx, dy, t, seed) {
    c.save();
    /* Smoke puffs rising on a loop */
    for (var s = 0; s < 4; s++) {
      var ph = ((t * 0.35 + s * 0.25 + seed * 0.001) % 1);
      var sy = dy - 68 - ph * 90;
      var sx = dx + Math.sin(ph * 6 + s) * 8;
      c.fillStyle = 'rgba(40, 36, 50, ' + (0.4 * (1 - ph)) + ')';
      c.beginPath(); c.arc(sx, sy, 7 + ph * 14, 0, Math.PI * 2); c.fill();
    }
    /* Chimney body */
    var g = c.createLinearGradient(dx - 20, 0, dx + 20, 0);
    g.addColorStop(0, '#15161c');
    g.addColorStop(0.5, '#3a3c48');
    g.addColorStop(1, '#101117');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(dx - 22, dy + 2);
    c.lineTo(dx - 14, dy - 30);
    c.lineTo(dx - 9, dy - 64);
    c.lineTo(dx + 8, dy - 64);
    c.lineTo(dx + 15, dy - 32);
    c.lineTo(dx + 24, dy + 2);
    c.closePath();
    c.fill();
    /* Layer ridges */
    c.strokeStyle = 'rgba(120, 130, 150, 0.25)';
    c.lineWidth = 1.2;
    for (var r = 0; r < 4; r++) {
      var ry = dy - 10 - r * 14;
      var rw = 18 - r * 2.5;
      c.beginPath(); c.moveTo(dx - rw, ry); c.quadraticCurveTo(dx, ry + 4, dx + rw, ry); c.stroke();
    }
    /* Glowing mouth and heat cracks */
    var flick = 0.7 + 0.3 * Math.sin(t * 9 + seed);
    var mg = c.createRadialGradient(dx, dy - 64, 1, dx, dy - 64, 12);
    mg.addColorStop(0, 'rgba(255, 240, 180, ' + flick + ')');
    mg.addColorStop(0.5, 'rgba(255, 140, 40, ' + flick * 0.8 + ')');
    mg.addColorStop(1, 'rgba(255, 80, 20, 0)');
    c.fillStyle = mg;
    c.beginPath(); c.ellipse(dx, dy - 64, 12, 6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255, 120, 40, ' + (0.5 * flick) + ')';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(dx - 4, dy - 58); c.lineTo(dx - 7, dy - 44); c.lineTo(dx - 3, dy - 36);
    c.moveTo(dx + 5, dy - 56); c.lineTo(dx + 8, dy - 40);
    c.stroke();
    c.restore();
  }

  /* Cluster of glowing crystal shards growing out of the rock */
  function drawCrystal(c, dx, dy, seed) {
    var shards = [[-12, 26, -0.35], [-2, 42, -0.08], [9, 34, 0.18], [18, 22, 0.42]];
    c.save();
    c.fillStyle = '#1a2030';
    c.beginPath(); c.ellipse(dx + 3, dy, 24, 6, 0, 0, Math.PI * 2); c.fill();
    for (var i = 0; i < shards.length; i++) {
      var sx = dx + shards[i][0], h = shards[i][1], tilt = shards[i][2];
      var w = 6 + (i % 2) * 2;
      c.save();
      c.translate(sx, dy);
      c.rotate(tilt);
      var g = c.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, '#2a6ad0');
      g.addColorStop(0.5, '#9fe8ff');
      g.addColorStop(1, '#3a7ae0');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-w, 2);
      c.lineTo(-w * 0.8, -h * 0.75);
      c.lineTo(0, -h);
      c.lineTo(w * 0.8, -h * 0.75);
      c.lineTo(w, 2);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(10, 30, 80, 0.6)';
      c.lineWidth = 1;
      c.stroke();
      /* Facet highlight */
      c.fillStyle = 'rgba(255, 255, 255, 0.55)';
      c.beginPath();
      c.moveTo(-w * 0.5, 0);
      c.lineTo(-w * 0.4, -h * 0.7);
      c.lineTo(0, -h + 2);
      c.lineTo(-w * 0.1, -h * 0.6);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  }

  /* ---- Click handling ---- */
  function onClick(e) {
    var pos = Game.input.getClickPos(e);
    var mx = pos.x, my = pos.y;

    switch (state) {
      case State.TITLE:
        /* First click on the title bootstraps Web Audio (browsers block
           autoplay) so the menu music can start. */
        Game.audio.init();
        Game.audio.resume();
        if (Game.audio.currentMusic() !== 'title') Game.audio.startMusic('title');
        var action = Game.ui.handleTitleClick(mx, my);
        if (action === 'play') state = State.CUSTOMIZE;
        break;

      case State.CUSTOMIZE:
        var cAction = Game.ui.handleCustomizeClick(mx, my);
        if (cAction === 'start') state = State.INTRO;
        break;

      case State.INTRO:
        var iAction = Game.ui.handleIntroClick(mx, my);
        if (iAction === 'start') { Game.audio.startMusic('title'); state = State.LEVEL_SELECT; }
        break;

      case State.LEVEL_SELECT:
        var sAction = Game.ui.handleLevelSelectClick(mx, my);
        if (sAction && sAction.action === 'level') startLevel(sAction.index, false);
        else if (sAction && sAction.action === 'title') state = State.TITLE;
        break;

      case State.LEVEL_CLEAR:
        var lcAction = Game.ui.handleLevelClearClick(mx, my, lastClear);
        if (lcAction === 'next') startLevel(currentLevel + 1, false);
        else if (lcAction === 'select') { Game.audio.startMusic('title'); state = State.LEVEL_SELECT; }
        break;

      case State.PAUSED:
        var pAction = Game.ui.handlePauseClick(mx, my);
        if (pAction === 'resume') state = State.PLAYING;
        else if (pAction === 'quit') { Game.audio.startMusic('title'); state = State.LEVEL_SELECT; }
        break;

      case State.GAME_OVER:
        var gAction = Game.ui.handleGameOverClick(mx, my);
        if (gAction === 'retry') startLevel(currentLevel, lastDeathInBoss);
        break;

      case State.VICTORY:
        var vAction = Game.ui.handleVictoryClick(mx, my);
        if (vAction === 'restart') { Game.audio.startMusic('title'); state = State.TITLE; }
        else if (vAction === 'select') { Game.audio.startMusic('title'); state = State.LEVEL_SELECT; }
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

  /* ---- Start a level ----
     When fromBoss is true (retry after dying to the boss), drop the player
     just outside the boss arena and re-arm the boss so they don't have to
     swim through the whole level again. The pearls they had already
     collected are kept, so a boss death doesn't cost them their stars. */
  function startLevel(index, fromBoss) {
    if (!Game.levels.get(index)) index = 0;
    var keep = (fromBoss && index === currentLevel && level)
      ? { pickups: pickups, chests: chests, got: pearlsCollected, total: pearlTotal }
      : null;
    if (!fromBoss) bossDeathBonus = 0;
    currentLevel = index;
    loadLevel(index);
    if (keep) {
      pickups = keep.pickups;
      chests = keep.chests;
      pearlsCollected = keep.got;
      pearlTotal = keep.total;
    }
    camera = { x: 0, y: 0 };
    Game.audio.init();
    Game.audio.resume();
    if (fromBoss) {
      var rx = Math.max(0, level.bossAreaX - 100);
      var ry = 220;
      player.x = rx;
      player.y = ry;
      respawnPos = { x: rx, y: ry };
      boss.activate();
      bossActivated = true;
      /* Disarm the surface trigger – the player is mid-arena, no need to
         pop the cutscene if a stray jump carries them up. */
      beachReady = false;
      camera.x = Math.max(0, Math.min(rx - W / 2 + player.w / 2, level.width - W));
      Game.audio.startMusic('boss');
    } else {
      beachReady = true;
      Game.audio.startMusic('bgm');
    }
    lastDeathInBoss = false;
    state = State.PLAYING;
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

  /* Compute canvas dimensions to match the current viewport's aspect ratio.
     Always centers the 800×480 game viewport. Adds horizontal strips for
     touch controls (asymmetric — wider D-pad side) and additional top /
     bottom bezel padding when the screen is taller-aspect than the base
     canvas (iPads etc.) so the canvas can scale up to fill the display
     instead of being letterboxed in dead space. */
  function computeCanvasLayout() {
    var sW = window.innerWidth || W;
    var sH = window.innerHeight || H;
    var screenAspect = sW / sH;
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (isTouch) {
      var lStrip = TOUCH_LEFT_W;
      var rStrip = TOUCH_RIGHT_W;
      var baseW = W + lStrip + rStrip;     /* 1260 */
      var baseH = H;                        /* 480 */
      var baseAspect = baseW / baseH;       /* 2.625 */

      if (screenAspect < baseAspect * 0.98) {
        /* Tall-aspect screen (iPad, tablet) — extend canvas vertically so
           it matches screen aspect. Bezel splits above/below the game. */
        CANVAS_W = baseW;
        CANVAS_H = Math.round(baseW / screenAspect);
        /* Cap so we don't go wildly tall on edge-case displays. */
        CANVAS_H = Math.min(CANVAS_H, baseH * 4);
        GAME_X = lStrip;
        GAME_Y = Math.floor((CANVAS_H - H) / 2);
      } else if (screenAspect > baseAspect * 1.05) {
        /* Ultra-wide screen — extend horizontal strips equally. */
        CANVAS_W = Math.round(baseH * screenAspect);
        CANVAS_H = baseH;
        var extraW = CANVAS_W - baseW;
        GAME_X = lStrip + Math.floor(extraW / 2);
        GAME_Y = 0;
      } else {
        CANVAS_W = baseW;
        CANVAS_H = baseH;
        GAME_X = lStrip;
        GAME_Y = 0;
      }
      /* Publish to input.js so touch-strip layout / click mapping match. */
      Game.TOUCH_LEFT_W = GAME_X;
      Game.TOUCH_RIGHT_W = CANVAS_W - GAME_X - W;
      Game.GAME_Y = GAME_Y;
    } else {
      CANVAS_W = W;
      CANVAS_H = H;
      GAME_X = 0;
      GAME_Y = 0;
      Game.TOUCH_LEFT_W = 0;
      Game.TOUCH_RIGHT_W = 0;
      Game.GAME_Y = 0;
    }
  }

  /* Resize the backing store to match logical canvas dimensions × DPR so
     rendering stays crisp on retina displays. Cap DPR at 3× to keep the
     backing-store memory sane on pathological screens. The 2D context's
     base transform is scaled by dpr so all game code keeps drawing in
     logical CANVAS_W × CANVAS_H coordinates. */
  function resizeBackingStore() {
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  /* ---- Init ---- */
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    loadProgress();
    computeCanvasLayout();
    resizeBackingStore();

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

    /* Handle resize – recompute layout (in case orientation / DPR / size
       changed), re-allocate the backing store, then scale-to-fit via CSS. */
    function resize() {
      computeCanvasLayout();
      resizeBackingStore();
      var container = canvas.parentElement;
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      var scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
      canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
      canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
      Game.input.refreshLayout();
    }
    window.addEventListener('resize', resize);
    /* iOS Safari fires orientationchange separately from resize on some
       devices – listen for both so the layout actually re-fits. */
    window.addEventListener('orientationchange', resize);
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
    drawCoral: drawCoral,
    drawDecorationAt: drawDecorationAt,
    /* Debug / test hooks: jump straight to a level or its boss, run the
       simulation by hand when requestAnimationFrame is throttled. */
    _startLevel: function (i) { startLevel(i, false); },
    _warpToBoss: function () {
      if (!level) return;
      player.x = Math.max(0, level.bossAreaX - 60);
      player.y = 220;
      camera.x = Math.max(0, Math.min(player.x - W / 2, level.width - W));
    },
    _forceRender: function () { render(); },
    _getState: function () { return state; },
    _step: function (n) { for (var i = 0; i < (n || 1); i++) update(); render(); },
    _clearLevel: function () { if (state === State.PLAYING) finishLevel(); },
    _teleport: function (x, y) {
      if (!player) return;
      player.x = x; player.y = y; player.vx = 0; player.vy = 0;
      camera.x = Math.max(0, Math.min(x - W / 2, level.width - W));
    },
    _setState: function (s) { state = s; },
    _bossHp: function () { return boss ? boss.hp : -1; },
  };

  /* Auto-init when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
