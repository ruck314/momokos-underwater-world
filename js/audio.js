/* audio.js – Web Audio API sound effects; music plays through music.js */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var ctx = null;
  var masterGain = null;
  var musicGain = null;
  var sfxGain = null;
  var currentMusic = null;
  var player = null;
  var muted = false;
  var initialized = false;

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(masterGain);
      player = Game.music.createPlayer(ctx, musicGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.6;
      sfxGain.connect(masterGain);

      initialized = true;
    } catch (e) { /* Web Audio not available */ }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ---- helpers ---- */
  function playNote(freq, type, duration, gain, dest, startTime) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.3, startTime || ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, (startTime || ctx.currentTime) + duration);
    osc.connect(g);
    g.connect(dest || sfxGain);
    osc.start(startTime || ctx.currentTime);
    osc.stop((startTime || ctx.currentTime) + duration);
  }

  function noise(duration, dest, startTime) {
    if (!ctx) return;
    var bufferSize = ctx.sampleRate * duration;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.15, startTime || ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, (startTime || ctx.currentTime) + duration);
    src.connect(g);
    g.connect(dest || sfxGain);
    src.start(startTime || ctx.currentTime);
  }

  /* ---- SFX ---- */
  function bubble() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  function enemyHit() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(500, 'square', 0.06, 0.3, sfxGain, t);
    playNote(700, 'square', 0.06, 0.3, sfxGain, t + 0.06);
    playNote(900, 'square', 0.08, 0.2, sfxGain, t + 0.12);
  }

  function enemyDefeat() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(400, 'square', 0.05, 0.3, sfxGain, t);
    playNote(600, 'square', 0.05, 0.3, sfxGain, t + 0.05);
    playNote(800, 'square', 0.05, 0.3, sfxGain, t + 0.1);
    playNote(1000, 'triangle', 0.1, 0.25, sfxGain, t + 0.15);
  }

  function damage() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(300, 'sawtooth', 0.08, 0.3, sfxGain, t);
    playNote(200, 'sawtooth', 0.1, 0.3, sfxGain, t + 0.08);
    noise(0.1, sfxGain, t + 0.05);
  }

  function pickup() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(880, 'triangle', 0.08, 0.25, sfxGain, t);
    playNote(1100, 'triangle', 0.08, 0.25, sfxGain, t + 0.08);
    playNote(1320, 'triangle', 0.12, 0.2, sfxGain, t + 0.16);
  }

  function menuSelect() {
    if (!ctx) return;
    playNote(660, 'square', 0.06, 0.15, sfxGain);
  }

  /* Pearl pickup: a quick glassy two-note "ting" that stays out of the
     way when a trail of them is collected in a row. */
  function pearl() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(1568, 'sine', 0.07, 0.22, sfxGain, t);
    playNote(2093, 'sine', 0.14, 0.18, sfxGain, t + 0.06);
    playNote(1047, 'triangle', 0.12, 0.08, sfxGain, t + 0.02);
  }

  /* Treasure chest creaking open with a shower of pearls */
  function chestOpen() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(180, 'sawtooth', 0.12, 0.12, sfxGain, t);
    noise(0.08, sfxGain, t);
    var arp = [784, 988, 1175, 1568, 1976];
    for (var i = 0; i < arp.length; i++) {
      playNote(arp[i], 'triangle', 0.1, 0.18, sfxGain, t + 0.12 + i * 0.05);
    }
  }

  /* Short fanfare for clearing a reef (lighter than the final victory):
     a kalimba run doubled by marimba, landing on a bell chord. */
  function levelClearJingle() {
    if (!ctx) return;
    var M = Game.music, t = ctx.currentTime + 0.02;
    var notes = ['E5', 'G5', 'C6', 'E6'];
    var dur = [0.12, 0.12, 0.12, 0.45];
    var time = t;
    for (var i = 0; i < notes.length; i++) {
      M.voice(ctx, sfxGain, 'kalimba', notes[i], time, dur[i], 1);
      M.voice(ctx, sfxGain, 'marimba', M.freq(notes[i]) / 2, time, dur[i], 0.8);
      time += dur[i];
    }
    var end = time - dur[3];
    M.voice(ctx, sfxGain, 'bell', 'G5', end, 0.6, 0.7);
    M.voice(ctx, sfxGain, 'bell', 'C6', end, 0.6, 0.7);
    M.voice(ctx, sfxGain, 'pluck', 'C4', end, 0.5, 0.8);
    M.drum(ctx, sfxGain, 'tri', end, 0.8);
  }

  /* Final victory: marimba and flute tune over a plucked bass, a bell
     chord and a shimmer of triangle and shaker at the end. */
  function victoryJingle() {
    if (!ctx) return;
    var M = Game.music, t = ctx.currentTime + 0.02;
    var notes = ['C5', 'D5', 'E5', 'G5', 'E5', 'G5', 'C6'];
    var dur = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.4];
    var bass = { 0: 'C3', 2: 'G3', 4: 'C4', 6: 'C3' };
    var time = t;
    for (var i = 0; i < notes.length; i++) {
      M.voice(ctx, sfxGain, 'marimba', notes[i], time, dur[i], 1);
      M.voice(ctx, sfxGain, 'flute', notes[i], time, dur[i] * 0.9, 0.9);
      if (bass[i]) M.voice(ctx, sfxGain, 'bass', bass[i], time, dur[i] * 1.6, 0.9);
      if (i < 6) M.drum(ctx, sfxGain, 'shaker', time, 0.6);
      time += dur[i];
    }
    var end = time - dur[6];
    M.voice(ctx, sfxGain, 'bell', 'E6', end, 0.8, 0.6);
    M.voice(ctx, sfxGain, 'bell', 'G6', end, 0.8, 0.5);
    M.voice(ctx, sfxGain, 'pluck', 'E4', end, 0.6, 0.7);
    M.voice(ctx, sfxGain, 'pluck', 'G4', end, 0.6, 0.7);
    M.drum(ctx, sfxGain, 'tri', end, 0.9);
  }

  /* Game over: a soft, sighing clarinet slide down, not a buzz */
  function gameOverSfx() {
    if (!ctx) return;
    var M = Game.music, t = ctx.currentTime + 0.02;
    var notes = ['G4', 'F4', 'D4', 'G3'];
    for (var i = 0; i < notes.length; i++) {
      M.voice(ctx, sfxGain, 'reed', notes[i], t + i * 0.2, i < 3 ? 0.18 : 0.5, 1, { vib: i < 3 ? 6 : 22 });
      M.voice(ctx, sfxGain, 'marimba', notes[i], t + i * 0.2, 0.2, 0.6);
    }
  }

  /* ---- Music (Game.music sequencer, songs in songs.js) ---- */
  /* Song per music type; bgm and boss pick by level index */
  var SONG_FOR = { bgm: ['reef', 'ship', 'trench'], boss: ['boss', 'boss', 'bossFinal'] };

  function songName(type, variant) {
    var list = SONG_FOR[type];
    return list ? list[variant] || list[0] : type;
  }

  function startMusic(type, variant) {
    if (!ctx || muted || !player) { stopMusic(); return; }
    var name = songName(type, variant);
    if (currentMusic === type && player.current() === name) return;
    var song = Game.songs && Game.songs[name];
    if (!song) { stopMusic(); return; }
    player.play(song, { name: name });
    currentMusic = type;
  }

  function stopMusic() {
    if (player) player.stop(0.4);
    currentMusic = null;
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    if (muted) stopMusic();
  }

  window.Game.audio = {
    init: init,
    resume: resume,
    play: function (name) {
      if (muted || !ctx) return;
      resume();
      switch (name) {
        case 'bubble': bubble(); break;
        case 'enemyHit': enemyHit(); break;
        case 'enemyDefeat': enemyDefeat(); break;
        case 'damage': damage(); break;
        case 'pickup': pickup(); break;
        case 'select': menuSelect(); break;
        case 'victory': victoryJingle(); break;
        case 'gameOver': gameOverSfx(); break;
        case 'pearl': pearl(); break;
        case 'chest': chestOpen(); break;
        case 'levelClear': levelClearJingle(); break;
      }
    },
    startMusic: function (type, variant) {
      resume();
      startMusic(type, variant);
    },
    stopMusic: stopMusic,
    toggleMute: toggleMute,
    isMuted: function () { return muted; },
    currentMusic: function () { return currentMusic; },
  };
})();
