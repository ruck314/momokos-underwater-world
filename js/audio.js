/* audio.js – Web Audio API chiptune sound effects & music */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var ctx = null;
  var masterGain = null;
  var musicGain = null;
  var sfxGain = null;
  var currentMusic = null;
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

  function victoryJingle() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var notes = [523, 587, 659, 784, 659, 784, 1047];
    var dur = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.4];
    var time = t;
    for (var i = 0; i < notes.length; i++) {
      playNote(notes[i], 'square', dur[i], 0.3, sfxGain, time);
      playNote(notes[i] * 0.5, 'triangle', dur[i], 0.15, sfxGain, time);
      time += dur[i];
    }
  }

  function gameOverSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(400, 'sawtooth', 0.2, 0.3, sfxGain, t);
    playNote(350, 'sawtooth', 0.2, 0.3, sfxGain, t + 0.2);
    playNote(300, 'sawtooth', 0.2, 0.3, sfxGain, t + 0.4);
    playNote(200, 'sawtooth', 0.5, 0.3, sfxGain, t + 0.6);
  }

  /* ---- Music (looping chiptune patterns) ---- */
  var musicInterval = null;

  /* Underwater BGM – calm pentatonic melody */
  var bgmPattern = [
    [262, 'triangle'], [330, 'triangle'], [392, 'triangle'], [330, 'triangle'],
    [294, 'triangle'], [392, 'triangle'], [440, 'triangle'], [392, 'triangle'],
    [330, 'triangle'], [440, 'triangle'], [523, 'triangle'], [440, 'triangle'],
    [392, 'triangle'], [330, 'triangle'], [294, 'triangle'], [262, 'triangle'],
    [196, 'triangle'], [262, 'triangle'], [330, 'triangle'], [262, 'triangle'],
    [220, 'triangle'], [294, 'triangle'], [330, 'triangle'], [294, 'triangle'],
    [262, 'triangle'], [330, 'triangle'], [392, 'triangle'], [330, 'triangle'],
    [294, 'triangle'], [262, 'triangle'], [220, 'triangle'], [196, 'triangle'],
  ];

  /* Bass line for BGM */
  var bgmBass = [
    131, 131, 196, 196, 147, 147, 196, 196,
    165, 165, 220, 220, 196, 196, 147, 147,
    98, 98, 131, 131, 110, 110, 147, 147,
    131, 131, 196, 196, 147, 147, 110, 110,
  ];

  /* Boss music – ominous, faster */
  var bossPattern = [
    [196, 'square'], [233, 'square'], [262, 'square'], [233, 'square'],
    [196, 'square'], [175, 'square'], [196, 'square'], [147, 'square'],
    [175, 'square'], [208, 'square'], [233, 'square'], [208, 'square'],
    [175, 'square'], [165, 'square'], [175, 'square'], [131, 'square'],
    [196, 'square'], [262, 'square'], [330, 'square'], [262, 'square'],
    [196, 'square'], [175, 'square'], [147, 'square'], [131, 'square'],
    [147, 'square'], [175, 'square'], [196, 'square'], [175, 'square'],
    [147, 'square'], [131, 'square'], [147, 'square'], [196, 'square'],
  ];

  var bossBass = [
    98, 98, 131, 131, 98, 98, 87, 87,
    87, 87, 117, 117, 87, 87, 82, 82,
    98, 98, 131, 131, 98, 98, 87, 87,
    73, 73, 87, 87, 73, 73, 98, 98,
  ];

  function startMusic(type) {
    stopMusic();
    if (!ctx || muted) return;
    var pattern = type === 'boss' ? bossPattern : bgmPattern;
    var bass = type === 'boss' ? bossBass : bgmBass;
    var tempo = type === 'boss' ? 180 : 110;
    var beatDur = 60 / tempo;
    var noteIdx = 0;

    function scheduleNotes() {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) {
        var idx = (noteIdx + i) % pattern.length;
        var note = pattern[idx];
        var bNote = bass[idx];
        var when = t + i * beatDur;

        /* Melody */
        playNote(note[0], note[1], beatDur * 0.8, 0.15, musicGain, when);
        /* Bass */
        playNote(bNote, 'triangle', beatDur * 0.9, 0.12, musicGain, when);

        if (type === 'boss') {
          /* Extra percussive feel on beat */
          if (idx % 4 === 0) noise(0.04, musicGain, when);
        }
      }
      noteIdx = (noteIdx + 4) % pattern.length;
    }

    scheduleNotes();
    musicInterval = setInterval(scheduleNotes, beatDur * 4 * 1000);
    currentMusic = type;
  }

  function stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
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
      }
    },
    startMusic: function (type) {
      resume();
      startMusic(type);
    },
    stopMusic: stopMusic,
    toggleMute: toggleMute,
    isMuted: function () { return muted; },
    currentMusic: function () { return currentMusic; },
  };
})();
