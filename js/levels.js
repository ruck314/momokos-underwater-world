/* levels.js – level data (separate from engine code) */
(function () {
  'use strict';
  window.Game = window.Game || {};

  /*
   * Level data format:
   *   nameKey           – i18n key for the level's display name
   *   theme             – 'reef' | 'wreck' | 'trench' (level-select thumbnail)
   *   width / height    – world dimensions in pixels
   *   waterSurface      – y coord of water surface (negative = no surface)
   *   ceilingY          – optional: player can't swim above this y
   *   floorY            – y coord of ocean floor top
   *   dark              – optional: trench darkness + light cone around Momoko
   *   rockPalette       – 'reef' (default) | 'trench' – platform rock colours
   *   sand              – optional { top, mid, bottom, lip } floor colours
   *   platforms[]       – solid blocks { x, y, w, h, kind? } kind 'wood' = ship deck
   *   decorations[]     – visual-only elements { type, x, y, ... }
   *                       seaweed, coral, shell, kelp, tallkelp, wreck, mast,
   *                       anchor, barrel, glowplant, vent, crystal
   *   spawns.player     – { x, y }
   *   spawns.enemies[]  – { type, x, y, pattern?, dir?, species?, range? }
   *                       fish | octopus | jellyfish | eel | shark
   *   spawns.npcs[]     – { type, x, y }
   *   spawns.pickups[]  – { type: 'heart' | 'pearl', x, y, shell? }
   *   spawns.chests[]   – { x, y, pearls } – shoot to open
   *   spawns.boss       – { type: 'giantOctopus' | 'kingCrab' | 'moni', x, y }
   *   bossAreaX         – x coord where boss fight triggers
   */

  var LEVEL_1 = {
    nameKey: 'level1Name',
    theme: 'reef',
    width: 5600,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    /* Background color gradient stops */
    /* Same family as the title's sea so play doesn't feel like a
       darker, different ocean. */
    bgTop: '#12426e',
    bgMid: '#0f3058',
    bgBottom: '#163655',

    platforms: [
      /* Starting area – a few rocks to learn swimming */
      { x: 180, y: 360, w: 80, h: 80 },
      { x: 320, y: 300, w: 48, h: 140 },
      { x: 440, y: 340, w: 64, h: 100 },

      /* Section 2 – coral formations */
      { x: 750, y: 200, w: 48, h: 80 },
      { x: 750, y: 360, w: 100, h: 80 },
      { x: 900, y: 280, w: 48, h: 160 },
      { x: 1050, y: 320, w: 80, h: 120 },
      { x: 1150, y: 180, w: 48, h: 100 },

      /* Section 3 – denser area */
      { x: 1500, y: 160, w: 64, h: 48 },
      { x: 1600, y: 260, w: 48, h: 180 },
      { x: 1700, y: 350, w: 100, h: 90 },
      { x: 1850, y: 200, w: 48, h: 80 },
      { x: 1950, y: 300, w: 64, h: 48 },
      { x: 2050, y: 160, w: 80, h: 48 },

      /* Section 4 – passage area */
      { x: 2500, y: 140, w: 200, h: 32 },
      { x: 2500, y: 340, w: 200, h: 32 },
      { x: 2800, y: 200, w: 48, h: 64 },
      { x: 2900, y: 320, w: 80, h: 120 },
      { x: 3050, y: 240, w: 48, h: 48 },
      { x: 3150, y: 360, w: 64, h: 80 },

      /* Section 5 – near boss, open up */
      { x: 3500, y: 350, w: 120, h: 90 },
      { x: 3700, y: 180, w: 48, h: 48 },

      /* Boss arena walls (floor only, keep it open for the fight) */
      { x: 4200, y: 390, w: 400, h: 50 },
      { x: 4700, y: 390, w: 400, h: 50 },
    ],

    decorations: [
      /* Seaweed patches */
      { type: 'seaweed', x: 60, y: 440, h: 70 },
      { type: 'seaweed', x: 160, y: 440, h: 55 },
      { type: 'seaweed', x: 400, y: 440, h: 80 },
      { type: 'seaweed', x: 550, y: 440, h: 60 },
      { type: 'seaweed', x: 680, y: 440, h: 90 },
      { type: 'seaweed', x: 860, y: 440, h: 65 },
      { type: 'seaweed', x: 1100, y: 440, h: 75 },
      { type: 'seaweed', x: 1300, y: 440, h: 55 },
      { type: 'seaweed', x: 1550, y: 440, h: 85 },
      { type: 'seaweed', x: 1800, y: 440, h: 70 },
      { type: 'seaweed', x: 2100, y: 440, h: 60 },
      { type: 'seaweed', x: 2400, y: 440, h: 75 },
      { type: 'seaweed', x: 2700, y: 440, h: 65 },
      { type: 'seaweed', x: 3000, y: 440, h: 80 },
      { type: 'seaweed', x: 3300, y: 440, h: 55 },
      { type: 'seaweed', x: 3600, y: 440, h: 70 },

      /* Coral decorations */
      { type: 'coral', x: 250, y: 425, variant: 0 },
      { type: 'coral', x: 620, y: 420, variant: 1 },
      { type: 'coral', x: 980, y: 430, variant: 2 },
      { type: 'coral', x: 1400, y: 425, variant: 0 },
      { type: 'coral', x: 1750, y: 420, variant: 1 },
      { type: 'coral', x: 2200, y: 430, variant: 2 },
      { type: 'coral', x: 2600, y: 425, variant: 0 },
      { type: 'coral', x: 3100, y: 420, variant: 1 },
      { type: 'coral', x: 3800, y: 430, variant: 2 },

      /* Shells */
      { type: 'shell', x: 350, y: 432 },
      { type: 'shell', x: 1200, y: 432 },
      { type: 'shell', x: 2300, y: 432 },
      { type: 'shell', x: 3400, y: 432 },

      /* Kelp forests */
      { type: 'kelp', x: 120, y: 440, h: 130 },
      { type: 'kelp', x: 500, y: 440, h: 110 },
      { type: 'kelp', x: 530, y: 440, h: 140 },
      { type: 'kelp', x: 950, y: 440, h: 120 },
      { type: 'kelp', x: 1350, y: 440, h: 150 },
      { type: 'kelp', x: 1380, y: 440, h: 110 },
      { type: 'kelp', x: 2050, y: 440, h: 130 },
      { type: 'kelp', x: 2650, y: 440, h: 140 },
    ],

    spawns: {
      player: { x: 60, y: 240 },

      enemies: [
        /* Section 1 – easy tropical fish */
        { type: 'fish', x: 500, y: 200, pattern: 'sine', dir: -1, species: 'tropical' },
        { type: 'fish', x: 600, y: 300, pattern: 'sine', dir: -1, species: 'clownfish' },

        /* Section 2 – more fish, introduce angelfish */
        { type: 'fish', x: 820, y: 180, pattern: 'sine', dir: 1, species: 'clownfish' },
        { type: 'fish', x: 1000, y: 250, pattern: 'linear', dir: -1, species: 'angelfish' },
        { type: 'fish', x: 1200, y: 150, pattern: 'sine', dir: -1, species: 'tropical' },

        /* Section 3 – octopus + first swordfish */
        { type: 'fish', x: 1550, y: 280, pattern: 'sine', dir: 1, species: 'angelfish' },
        { type: 'octopus', x: 1680, y: 200, pattern: 'hover' },
        { type: 'fish', x: 1900, y: 160, pattern: 'linear', dir: -1, species: 'swordfish' },
        { type: 'octopus', x: 2000, y: 320, pattern: 'hover' },

        /* Section 4 – gauntlet, introduce blowfish and a jellyfish */
        { type: 'fish', x: 2350, y: 220, pattern: 'sine', dir: -1, species: 'blowfish' },
        { type: 'fish', x: 2550, y: 200, pattern: 'linear', dir: 1, species: 'swordfish' },
        { type: 'octopus', x: 2750, y: 240, pattern: 'hover' },
        { type: 'fish', x: 2950, y: 180, pattern: 'sine', dir: -1, species: 'clownfish' },
        { type: 'fish', x: 3100, y: 300, pattern: 'sine', dir: 1, species: 'blowfish' },
        { type: 'octopus', x: 3200, y: 200, pattern: 'hover' },
        { type: 'jellyfish', x: 3350, y: 220 },

        /* Section 5 – before boss */
        { type: 'fish', x: 3500, y: 220, pattern: 'linear', dir: -1, species: 'swordfish' },
        { type: 'fish', x: 3650, y: 280, pattern: 'sine', dir: 1, species: 'angelfish' },
        { type: 'fish', x: 3800, y: 200, pattern: 'sine', dir: -1, species: 'blowfish' },
        { type: 'octopus', x: 3850, y: 260, pattern: 'hover' },
      ],

      npcs: [
        { type: 'oliver', x: 700, y: 240 },
        { type: 'kittycorn', x: 2150, y: 220 },
        { type: 'bob', x: 3200, y: 300 },
        /* Friendly crabs scuttling along the seafloor – they tell jokes
           when the player swims close. Spaced out across sections so the
           player meets a new one every few screens. */
        { type: 'crab', x: 380, y: 426 },
        { type: 'crab', x: 1280, y: 426 },
        { type: 'crab', x: 2380, y: 426 },
        { type: 'crab', x: 3380, y: 426 },
      ],

      pickups: [
        { type: 'heart', x: 700, y: 180 },
        { type: 'heart', x: 1450, y: 280 },
        { type: 'heart', x: 2250, y: 200 },
        { type: 'heart', x: 3100, y: 260 },
        { type: 'heart', x: 3950, y: 200 },

        /* Pearls – an arc over the first rocks teaches the swim-up */
        { type: 'pearl', x: 130, y: 220 },
        { type: 'pearl', x: 170, y: 190 },
        { type: 'pearl', x: 215, y: 175 },
        { type: 'pearl', x: 260, y: 190 },
        { type: 'pearl', x: 300, y: 220 },
        /* Tucked behind the tall rock and on the pillar tops */
        { type: 'pearl', x: 295, y: 424, shell: true },
        { type: 'pearl', x: 465, y: 326, shell: true },
        { type: 'pearl', x: 912, y: 266, shell: true },
        { type: 'pearl', x: 1082, y: 306, shell: true },
        /* Section 2 open water */
        { type: 'pearl', x: 640, y: 150 },
        { type: 'pearl', x: 980, y: 140 },
        { type: 'pearl', x: 1280, y: 300 },
        /* Section 3 weave */
        { type: 'pearl', x: 1560, y: 110 },
        { type: 'pearl', x: 1740, y: 300 },
        { type: 'pearl', x: 1900, y: 120 },
        { type: 'pearl', x: 2080, y: 260 },
        /* Trail through the section-4 passage */
        { type: 'pearl', x: 2480, y: 250 },
        { type: 'pearl', x: 2540, y: 240 },
        { type: 'pearl', x: 2600, y: 236 },
        { type: 'pearl', x: 2660, y: 240 },
        { type: 'pearl', x: 2720, y: 250 },
        /* Hidden on the floor between the gauntlet rocks */
        { type: 'pearl', x: 2990, y: 424, shell: true },
        { type: 'pearl', x: 3060, y: 180 },
        { type: 'pearl', x: 3250, y: 140 },
        /* Lead-in to the boss */
        { type: 'pearl', x: 3900, y: 320 },
        { type: 'pearl', x: 4050, y: 260 },
      ],

      /* One chest on the big rock before the arena – a taste of level 2 */
      chests: [
        { x: 3540, y: 322, pearls: 4 },
      ],

      boss: { type: 'giantOctopus', x: 4560, y: 200 },
    },

    /* Camera enters boss mode when player passes this x */
    bossAreaX: 4100,

    /* Wolfe patrol zone (beach, above water) */
    wolfe: { x: 200, y: 25, patrolWidth: 400 },
  };

  var LEVEL_2 = {
    nameKey: 'level2Name',
    theme: 'wreck',
    width: 6000,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    /* Greener, murkier water for the kelp forest */
    bgTop: '#0f4d62',
    bgMid: '#0b3a4e',
    bgBottom: '#0e3442',

    platforms: [
      /* Section 1 – kelp forest rocks */
      { x: 200, y: 380, w: 70, h: 60 },
      { x: 420, y: 330, w: 50, h: 110 },
      { x: 640, y: 390, w: 90, h: 50 },

      /* Section 2 – barrels and the anchor */
      { x: 1000, y: 300, w: 60, h: 140 },
      { x: 1200, y: 200, w: 80, h: 40 },
      { x: 1400, y: 360, w: 120, h: 80 },
      { x: 1650, y: 150, w: 60, h: 60 },

      /* Section 3 – the wreck: bow section */
      { x: 2200, y: 240, w: 44, h: 200, kind: 'wood' },
      { x: 2244, y: 300, w: 460, h: 24, kind: 'wood' },
      { x: 2244, y: 400, w: 520, h: 40, kind: 'wood' },
      /* Stern section */
      { x: 3050, y: 340, w: 300, h: 30, kind: 'wood' },
      { x: 3300, y: 200, w: 40, h: 140, kind: 'wood' },

      /* Section 4 – rock gauntlet */
      { x: 3700, y: 160, w: 200, h: 30 },
      { x: 3700, y: 330, w: 200, h: 30 },
      { x: 4000, y: 380, w: 80, h: 60 },
      { x: 4200, y: 220, w: 50, h: 90 },
      { x: 4400, y: 350, w: 100, h: 90 },
    ],

    decorations: [
      /* Kelp forest – tall swaying stalks everywhere in section 1 */
      { type: 'tallkelp', x: 80, y: 440, h: 230 },
      { type: 'tallkelp', x: 150, y: 440, h: 270 },
      { type: 'tallkelp', x: 310, y: 440, h: 250 },
      { type: 'tallkelp', x: 360, y: 440, h: 200 },
      { type: 'tallkelp', x: 520, y: 440, h: 280 },
      { type: 'tallkelp', x: 580, y: 440, h: 220 },
      { type: 'tallkelp', x: 780, y: 440, h: 260 },
      { type: 'tallkelp', x: 850, y: 440, h: 200 },
      { type: 'kelp', x: 250, y: 440, h: 120 },
      { type: 'kelp', x: 700, y: 440, h: 130 },
      { type: 'seaweed', x: 120, y: 440, h: 70 },
      { type: 'seaweed', x: 480, y: 440, h: 80 },
      { type: 'seaweed', x: 900, y: 440, h: 60 },

      /* Section 2 – scattered cargo */
      { type: 'barrel', x: 1100, y: 440 },
      { type: 'barrel', x: 1130, y: 440, lying: true },
      { type: 'barrel', x: 1480, y: 440 },
      { type: 'anchor', x: 1800, y: 440 },
      { type: 'tallkelp', x: 1250, y: 440, h: 220 },
      { type: 'tallkelp', x: 1560, y: 440, h: 240 },
      { type: 'tallkelp', x: 1900, y: 440, h: 260 },
      { type: 'seaweed', x: 1060, y: 440, h: 70 },
      { type: 'seaweed', x: 1700, y: 440, h: 65 },
      { type: 'shell', x: 1350, y: 432 },

      /* Section 3 – the shipwreck */
      { type: 'wreck', x: 2180, y: 440, w: 620, h: 220 },
      { type: 'mast', x: 2480, y: 300, h: 230 },
      { type: 'barrel', x: 2330, y: 300 },
      { type: 'barrel', x: 2600, y: 300, lying: true },
      { type: 'barrel', x: 2660, y: 300 },
      { type: 'wreck', x: 3020, y: 440, w: 360, h: 170, stern: true },
      { type: 'anchor', x: 3450, y: 440 },
      { type: 'tallkelp', x: 2900, y: 440, h: 240 },
      { type: 'tallkelp', x: 2950, y: 440, h: 190 },
      { type: 'seaweed', x: 2100, y: 440, h: 80 },
      { type: 'seaweed', x: 2850, y: 440, h: 70 },
      { type: 'seaweed', x: 3500, y: 440, h: 75 },
      { type: 'shell', x: 2860, y: 432 },

      /* Section 4 – rocks and more kelp */
      { type: 'tallkelp', x: 3620, y: 440, h: 250 },
      { type: 'tallkelp', x: 3950, y: 440, h: 230 },
      { type: 'tallkelp', x: 4150, y: 440, h: 260 },
      { type: 'tallkelp', x: 4600, y: 440, h: 240 },
      { type: 'kelp', x: 4300, y: 440, h: 140 },
      { type: 'coral', x: 3600, y: 425, variant: 2 },
      { type: 'coral', x: 4120, y: 420, variant: 1 },
      { type: 'barrel', x: 4550, y: 440, lying: true },
      { type: 'seaweed', x: 4050, y: 440, h: 60 },
      { type: 'seaweed', x: 4650, y: 440, h: 80 },

      /* Boss arena – treasure hoard scattered on the sand */
      { type: 'barrel', x: 4900, y: 440 },
      { type: 'barrel', x: 5700, y: 440, lying: true },
      { type: 'anchor', x: 5850, y: 440 },
      { type: 'tallkelp', x: 4800, y: 440, h: 230 },
      { type: 'tallkelp', x: 5900, y: 440, h: 250 },
      { type: 'seaweed', x: 5100, y: 440, h: 70 },
      { type: 'seaweed', x: 5500, y: 440, h: 65 },
    ],

    spawns: {
      player: { x: 60, y: 240 },

      enemies: [
        /* Section 1 – kelp forest: fish and a first eel */
        { type: 'fish', x: 350, y: 220, pattern: 'sine', dir: -1, species: 'clownfish' },
        { type: 'jellyfish', x: 540, y: 200 },
        { type: 'eel', x: 462, y: 350, dir: 1 },
        { type: 'fish', x: 800, y: 280, pattern: 'linear', dir: -1, species: 'tropical' },

        /* Section 2 – cargo field */
        { type: 'fish', x: 1100, y: 180, pattern: 'sine', dir: 1, species: 'angelfish' },
        { type: 'octopus', x: 1300, y: 260, pattern: 'hover' },
        { type: 'jellyfish', x: 1520, y: 220 },
        { type: 'eel', x: 1408, y: 400, dir: -1 },
        { type: 'fish', x: 1750, y: 300, pattern: 'sine', dir: -1, species: 'blowfish' },

        /* Section 3 – inside and above the wreck */
        { type: 'eel', x: 2214, y: 370, dir: 1 },
        { type: 'jellyfish', x: 2360, y: 170 },
        { type: 'octopus', x: 2520, y: 140, pattern: 'hover' },
        { type: 'jellyfish', x: 2650, y: 200 },
        { type: 'fish', x: 2880, y: 250, pattern: 'linear', dir: -1, species: 'swordfish' },
        { type: 'fish', x: 3150, y: 260, pattern: 'sine', dir: 1, species: 'clownfish' },
        { type: 'eel', x: 3312, y: 300, dir: -1 },

        /* Section 4 – gauntlet with the first shark */
        { type: 'fish', x: 3800, y: 250, pattern: 'sine', dir: -1, species: 'blowfish' },
        { type: 'shark', x: 3980, y: 250, dir: -1, range: 230 },
        { type: 'jellyfish', x: 4120, y: 170 },
        { type: 'eel', x: 4408, y: 400, dir: -1 },
        { type: 'fish', x: 4520, y: 160, pattern: 'sine', dir: 1, species: 'clownfish' },
        { type: 'octopus', x: 4620, y: 280, pattern: 'hover' },
      ],

      npcs: [
        { type: 'oliver', x: 950, y: 240 },
        { type: 'kittycorn', x: 1900, y: 220 },
        { type: 'bob', x: 2950, y: 160 },
        { type: 'crab', x: 1150, y: 426 },
        { type: 'crab', x: 2500, y: 386 },
        { type: 'crab', x: 3400, y: 426 },
      ],

      pickups: [
        { type: 'heart', x: 600, y: 200 },
        { type: 'heart', x: 1700, y: 120 },
        { type: 'heart', x: 2450, y: 260 },
        { type: 'heart', x: 3520, y: 230 },
        { type: 'heart', x: 4660, y: 200 },

        /* Pearls – weave between the kelp stalks */
        { type: 'pearl', x: 120, y: 200 },
        { type: 'pearl', x: 230, y: 160 },
        { type: 'pearl', x: 340, y: 200 },
        { type: 'pearl', x: 440, y: 316, shell: true },
        { type: 'pearl', x: 610, y: 140 },
        { type: 'pearl', x: 820, y: 360 },
        /* Section 2 */
        { type: 'pearl', x: 1020, y: 286, shell: true },
        { type: 'pearl', x: 1230, y: 160 },
        { type: 'pearl', x: 1600, y: 300 },
        { type: 'pearl', x: 1840, y: 410 },
        /* Inside the hull – a line of pearls under the deck */
        { type: 'pearl', x: 2300, y: 350 },
        { type: 'pearl', x: 2380, y: 350 },
        { type: 'pearl', x: 2460, y: 350 },
        { type: 'pearl', x: 2540, y: 350 },
        /* Up the mast */
        { type: 'pearl', x: 2500, y: 180 },
        { type: 'pearl', x: 2500, y: 120 },
        /* Stern and gauntlet */
        { type: 'pearl', x: 3100, y: 300 },
        { type: 'pearl', x: 3600, y: 250 },
        { type: 'pearl', x: 3760, y: 245 },
        { type: 'pearl', x: 3840, y: 245 },
        { type: 'pearl', x: 4100, y: 300 },
        { type: 'pearl', x: 4300, y: 140 },
      ],

      chests: [
        { x: 1440, y: 332, pearls: 3 },
        { x: 2420, y: 372, pearls: 3 },
        { x: 2640, y: 372, pearls: 2 },
        { x: 3180, y: 312, pearls: 3 },
        { x: 4420, y: 322, pearls: 3 },
      ],

      boss: { type: 'kingCrab', x: 5350, y: 380 },
    },

    bossAreaX: 4750,

    wolfe: { x: 200, y: 25, patrolWidth: 400 },
  };

  var LEVEL_3 = {
    nameKey: 'level3Name',
    theme: 'trench',
    width: 6000,
    height: 480,
    waterSurface: -300,
    ceilingY: 12,
    floorY: 440,
    dark: true,
    rockPalette: 'trench',
    sand: { top: '#3b4150', mid: '#232733', bottom: '#0c0e14', lip: 'rgba(150, 170, 200, 0.4)' },

    bgTop: '#040a18',
    bgMid: '#030713',
    bgBottom: '#02050d',

    platforms: [
      /* Section 1 – learning the dark */
      { x: 150, y: 360, w: 90, h: 80 },
      { x: 380, y: 120, w: 60, h: 160 },
      { x: 600, y: 340, w: 80, h: 100 },
      { x: 820, y: 200, w: 60, h: 60 },

      /* Section 2 */
      { x: 1100, y: 390, w: 120, h: 50 },
      { x: 1500, y: 300, w: 60, h: 140 },
      { x: 1700, y: 160, w: 120, h: 30 },
      { x: 2000, y: 360, w: 80, h: 80 },

      /* Section 3 – canyon with stalactites */
      { x: 2400, y: 12, w: 80, h: 150 },
      { x: 2550, y: 300, w: 80, h: 140 },
      { x: 2700, y: 12, w: 60, h: 200 },
      { x: 2850, y: 340, w: 100, h: 100 },
      { x: 3000, y: 12, w: 100, h: 120 },
      { x: 3150, y: 280, w: 60, h: 160 },

      /* Section 4 – shark run */
      { x: 3750, y: 380, w: 100, h: 60 },
      { x: 4000, y: 150, w: 80, h: 40 },
      { x: 4250, y: 360, w: 120, h: 80 },

      /* Boss arena */
      { x: 4900, y: 390, w: 400, h: 50 },
      { x: 5400, y: 390, w: 400, h: 50 },
    ],

    decorations: [
      /* Section 1 */
      { type: 'glowplant', x: 80, y: 440, variant: 0 },
      { type: 'glowplant', x: 300, y: 440, variant: 1 },
      { type: 'vent', x: 460, y: 440 },
      { type: 'glowplant', x: 540, y: 440, variant: 2 },
      { type: 'crystal', x: 720, y: 440 },
      { type: 'glowplant', x: 920, y: 440, variant: 0 },

      /* Section 2 */
      { type: 'glowplant', x: 1050, y: 440, variant: 1 },
      { type: 'crystal', x: 1300, y: 440 },
      { type: 'vent', x: 1380, y: 440 },
      { type: 'glowplant', x: 1620, y: 440, variant: 2 },
      { type: 'glowplant', x: 1880, y: 440, variant: 0 },
      { type: 'crystal', x: 2120, y: 440 },

      /* Section 3 – canyon */
      { type: 'glowplant', x: 2300, y: 440, variant: 1 },
      { type: 'vent', x: 2480, y: 440 },
      { type: 'glowplant', x: 2680, y: 440, variant: 2 },
      { type: 'crystal', x: 2780, y: 440 },
      { type: 'vent', x: 3050, y: 440 },
      { type: 'glowplant', x: 3240, y: 440, variant: 0 },
      { type: 'glowplant', x: 3420, y: 440, variant: 1 },

      /* Section 4 */
      { type: 'crystal', x: 3650, y: 440 },
      { type: 'glowplant', x: 3900, y: 440, variant: 2 },
      { type: 'vent', x: 4120, y: 440 },
      { type: 'glowplant', x: 4420, y: 440, variant: 0 },
      { type: 'crystal', x: 4600, y: 440 },

      /* Moni's lair – ringed with glowing growth */
      { type: 'glowplant', x: 4850, y: 440, variant: 1 },
      { type: 'crystal', x: 5000, y: 440 },
      { type: 'glowplant', x: 5150, y: 440, variant: 2 },
      { type: 'vent', x: 5350, y: 440 },
      { type: 'glowplant', x: 5550, y: 440, variant: 0 },
      { type: 'crystal', x: 5700, y: 440 },
      { type: 'glowplant', x: 5880, y: 440, variant: 1 },
    ],

    spawns: {
      player: { x: 60, y: 240 },

      enemies: [
        /* Section 1 – glowing jellyfish drift in the dark */
        { type: 'jellyfish', x: 300, y: 220 },
        { type: 'fish', x: 500, y: 300, pattern: 'sine', dir: -1, species: 'angelfish' },
        { type: 'jellyfish', x: 700, y: 180 },

        /* Section 2 – first trench shark */
        { type: 'jellyfish', x: 1150, y: 160 },
        { type: 'shark', x: 1320, y: 240, dir: -1, range: 260 },
        { type: 'eel', x: 1508, y: 330, dir: -1 },
        { type: 'jellyfish', x: 1800, y: 260 },
        { type: 'octopus', x: 1950, y: 200, pattern: 'hover' },

        /* Section 3 – canyon */
        { type: 'jellyfish', x: 2450, y: 300 },
        { type: 'shark', x: 2620, y: 230, dir: 1, range: 200 },
        { type: 'eel', x: 2942, y: 370, dir: 1 },
        { type: 'jellyfish', x: 3050, y: 220 },
        { type: 'fish', x: 3300, y: 200, pattern: 'sine', dir: -1, species: 'blowfish' },

        /* Section 4 – shark run */
        { type: 'shark', x: 3900, y: 210, dir: -1, range: 300 },
        { type: 'jellyfish', x: 3800, y: 300 },
        { type: 'fish', x: 4100, y: 260, pattern: 'linear', dir: -1, species: 'swordfish' },
        { type: 'eel', x: 4258, y: 390, dir: -1 },
        { type: 'shark', x: 4350, y: 320, dir: 1, range: 200 },
        { type: 'jellyfish', x: 4500, y: 180 },
        { type: 'jellyfish', x: 4650, y: 280 },
      ],

      npcs: [
        { type: 'kittycorn', x: 1050, y: 220 },
        { type: 'oliver', x: 2300, y: 180 },
        { type: 'bob', x: 3450, y: 150 },
        { type: 'crab', x: 1650, y: 426 },
        { type: 'crab', x: 4150, y: 426 },
      ],

      pickups: [
        { type: 'heart', x: 700, y: 160 },
        { type: 'heart', x: 1600, y: 250 },
        { type: 'heart', x: 2750, y: 250 },
        { type: 'heart', x: 3850, y: 200 },
        { type: 'heart', x: 4700, y: 220 },

        /* Pearls glow a little, so a trail of them is a guide through
           the dark */
        { type: 'pearl', x: 140, y: 240 },
        { type: 'pearl', x: 220, y: 230 },
        { type: 'pearl', x: 300, y: 300 },
        { type: 'pearl', x: 460, y: 320 },
        { type: 'pearl', x: 620, y: 326, shell: true },
        { type: 'pearl', x: 760, y: 150 },
        { type: 'pearl', x: 900, y: 320 },
        /* Section 2 */
        { type: 'pearl', x: 1250, y: 120 },
        { type: 'pearl', x: 1420, y: 426, shell: true },
        { type: 'pearl', x: 1750, y: 110 },
        { type: 'pearl', x: 2050, y: 300 },
        /* Canyon weave: under the stalactites, over the pillars */
        { type: 'pearl', x: 2440, y: 220 },
        { type: 'pearl', x: 2590, y: 270 },
        { type: 'pearl', x: 2730, y: 260 },
        { type: 'pearl', x: 2890, y: 310 },
        { type: 'pearl', x: 3050, y: 180 },
        { type: 'pearl', x: 3180, y: 250 },
        /* Shark run */
        { type: 'pearl', x: 3700, y: 300 },
        { type: 'pearl', x: 4040, y: 120 },
        { type: 'pearl', x: 4290, y: 346, shell: true },
        { type: 'pearl', x: 4560, y: 220 },
      ],

      chests: [
        { x: 1140, y: 362, pearls: 3 },
        { x: 2570, y: 272, pearls: 3 },
        { x: 4280, y: 332, pearls: 3 },
      ],

      boss: { type: 'moni', x: 5350, y: 180 },
    },

    bossAreaX: 4800,
  };

  window.Game.levels = {
    data: [LEVEL_1, LEVEL_2, LEVEL_3],
    get: function (index) {
      return this.data[index] || null;
    },
    count: function () {
      return this.data.length;
    }
  };
})();
