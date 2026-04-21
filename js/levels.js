/* levels.js – level data (separate from engine code) */
(function () {
  'use strict';
  window.Game = window.Game || {};

  /*
   * Level data format:
   *   width / height   – world dimensions in pixels
   *   waterSurface      – y coord of water surface
   *   floorY            – y coord of ocean floor top
   *   platforms[]       – solid coral/rock blocks  { x, y, w, h, color? }
   *   decorations[]     – visual-only elements     { type, x, y, ... }
   *   spawns.player     – { x, y }
   *   spawns.enemies[]  – { type, x, y, pattern?, dir? }
   *   spawns.npcs[]     – { type, x, y }
   *   spawns.pickups[]  – { type, x, y }
   *   spawns.boss       – { x, y }
   *   bossAreaX         – x coord where boss fight triggers
   */

  var LEVEL_1 = {
    name: 'Coral Reef',
    width: 5600,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    /* Background color gradient stops */
    bgTop: '#0a1628',
    bgMid: '#0d2847',
    bgBottom: '#162e50',

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
        /* Section 1 – easy fish */
        { type: 'fish', x: 500, y: 200, pattern: 'sine', dir: -1 },
        { type: 'fish', x: 600, y: 300, pattern: 'sine', dir: -1 },

        /* Section 2 – more fish */
        { type: 'fish', x: 820, y: 180, pattern: 'sine', dir: 1 },
        { type: 'fish', x: 1000, y: 250, pattern: 'linear', dir: -1 },
        { type: 'fish', x: 1200, y: 150, pattern: 'sine', dir: -1 },

        /* Section 3 – octopus appears */
        { type: 'fish', x: 1550, y: 280, pattern: 'sine', dir: 1 },
        { type: 'octopus', x: 1680, y: 200, pattern: 'hover' },
        { type: 'fish', x: 1900, y: 160, pattern: 'linear', dir: -1 },
        { type: 'octopus', x: 2000, y: 320, pattern: 'hover' },

        /* Section 4 – gauntlet */
        { type: 'fish', x: 2350, y: 220, pattern: 'sine', dir: -1 },
        { type: 'fish', x: 2550, y: 200, pattern: 'linear', dir: 1 },
        { type: 'octopus', x: 2750, y: 240, pattern: 'hover' },
        { type: 'fish', x: 2950, y: 180, pattern: 'sine', dir: -1 },
        { type: 'fish', x: 3100, y: 300, pattern: 'sine', dir: 1 },
        { type: 'octopus', x: 3200, y: 200, pattern: 'hover' },

        /* Section 5 – before boss */
        { type: 'fish', x: 3500, y: 220, pattern: 'linear', dir: -1 },
        { type: 'fish', x: 3650, y: 280, pattern: 'sine', dir: 1 },
        { type: 'octopus', x: 3850, y: 200, pattern: 'hover' },
      ],

      npcs: [
        { type: 'oliver', x: 1050, y: 160 },
        { type: 'kittycorn', x: 2150, y: 180 },
        { type: 'bob', x: 3200, y: 300 },
      ],

      pickups: [
        { type: 'heart', x: 700, y: 180 },
        { type: 'heart', x: 1450, y: 280 },
        { type: 'heart', x: 2250, y: 200 },
        { type: 'heart', x: 3100, y: 260 },
        { type: 'heart', x: 3950, y: 200 },
      ],

      boss: { x: 4600, y: 180 },
    },

    /* Camera enters boss mode when player passes this x */
    bossAreaX: 4100,

    /* Wolfe patrol zone (beach, above water) */
    wolfe: { x: 200, y: 25, patrolWidth: 400 },
  };

  window.Game.levels = {
    data: [LEVEL_1],
    get: function (index) {
      return this.data[index] || null;
    },
    count: function () {
      return this.data.length;
    }
  };
})();
