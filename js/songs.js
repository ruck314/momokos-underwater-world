/* songs.js – Momoko's Underwater World soundtrack for music.js.

   One original piece per music state: the title theme, a gameplay track
   for each reef (Coral Reef, Sunken Ship, Deep Trench), the mini-boss
   fight (Giant Octopus, King Crab) and the final fight with Moni.
   audio.js picks the song from the music type plus the level index. */
(function () {
  'use strict';
  window.Game = window.Game || {};
  var M = Game.music;

  /* A soft rising "blup": a sine that glides up through the note, the
     sound of a bubble popping out of the reef. */
  M.INSTRUMENTS.bubble = function (ctx, out, f, t, dur, vel) {
    var u = M.util;
    var g = u.gain(ctx, out, 0);
    var stop = u.ring(g, t, 0.2 * vel, 0.05);
    var o = u.osc(ctx, 'sine', f * 0.6, t, stop, g);
    o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.07);
  };

  /* n steps of rest, for long drum patterns */
  function rest(n) { return new Array(n + 1).join('.'); }

  Game.songs = {
    /* Title: dreamy F major, a flute over harp ripples and a soft choir.
       A A' B, 12 bars. */
    title: {
      bpm: 84, level: 1.0,
      reverb: { size: 3 }, delay: { beats: 0.75, feedback: 0.3 },
      tracks: {
        lead: { inst: 'flute', vol: 0.55, pan: 0.1, rev: 0.35, dly: 0.22 },
        harp: { inst: 'pluck', vol: 0.32, auto: 'arp', pattern: 'updown', rate: 0.5, octave: 4, range: 2, gate: 1, decay: 0.5, pan: -0.25, rev: 0.4 },
        pad:  { inst: 'choir', vol: 0.5, auto: 'pad', octave: 4, rev: 0.5 },
        bass: { inst: 'bass', vol: 0.5, auto: 'bass', style: 'root5', rhythm: 'x.......x.......', octave: 2, tone: 3 },
        cel:  { inst: 'bell', vol: 0.32, pan: 0.3, rev: 0.5, dly: 0.3 },
        bub:  { inst: 'bubble', vol: 0.35, pan: -0.3, rev: 0.4, dly: 0.25 },
        drums:{ vol: 0.4, rev: 0.25 }
      },
      grooves: { dream: { shaker: 'o...o.x.o...o.x.', tri: 'x' + rest(63) } },
      sections: {
        A: {
          chords: 'Fmaj7:4 Dm7:4 Bbmaj7:4 C7sus4:2 C7:2', drums: 'dream',
          lead: 'A4:1 C5:1 F5:1.5 E5:0.5 | D5:2 C5:1 A4:1 | Bb4:1 D5:1 F5:1.5 E5:0.5 | F5:2 E5:2',
          bub: { notes: 'r:3 A5:0.25 C6:0.25 r:0.5 | r:4', loop: true }
        },
        A2: {
          chords: 'Fmaj7:4 Am7:4 Bbmaj7:4 Gm7:2 C7:2', drums: 'dream',
          lead: 'A4:1 C5:1 F5:1.5 G5:0.5 | A5:2 G5:1 E5:1 | F5:1 D5:1 Bb4:1 C5:1 | D5:1 Bb4:1 C5:2',
          bub: { notes: 'r:3 A5:0.25 C6:0.25 r:0.5 | r:4', loop: true }
        },
        B: {
          chords: 'Bbmaj7:4 Bbm6:4 Am7:2 D7:2 Gm7:2 C7sus4:2', drums: 'dream',
          lead: 'D5:1 F5:1 A5:2 | G5:2 F5:1 Db5:1 | C5:1 E5:1 F#5:1.5 A5:0.5 | Bb5:1.5 A5:0.5 G5:1 C5:1',
          cel: 'r:2 F6:0.5 D6:0.5 F6:1 | r:2 Db6:0.5 Bb5:0.5 G5:1 | r:8'
        }
      },
      form: 'A A2 B'
    },

    /* Coral Reef: bright, bubbly G major. Flute tune over a rolling
       marimba, kalimba answers in the bridge, light hand percussion.
       A B A C, 32 bars. */
    reef: {
      bpm: 112, swing: 0.1, level: 1.0,
      reverb: { size: 2.2 }, delay: { beats: 0.75, feedback: 0.28 },
      tracks: {
        lead: { inst: 'flute', vol: 0.55, pan: 0.12, rev: 0.25, dly: 0.15 },
        kal:  { inst: 'kalimba', vol: 0.55, pan: -0.2, rev: 0.3, dly: 0.2 },
        mar:  { inst: 'marimba', vol: 0.42, auto: 'arp', pattern: 'updown', rate: 0.5, octave: 4, range: 2, pan: -0.25, rev: 0.2 },
        harp: { inst: 'pluck', vol: 0.22, auto: 'arp', pattern: 'up', rate: 0.25, octave: 5, range: 1, gate: 1, decay: 0.3, pan: 0.3, rev: 0.35 },
        pad:  { inst: 'choir', vol: 0.34, auto: 'pad', octave: 4, rev: 0.4 },
        bass: { inst: 'bass', vol: 0.55, auto: 'bass', style: 'root5', rhythm: 'x.......x...x...', octave: 2 },
        bub:  { inst: 'bubble', vol: 0.3, pan: 0.35, rev: 0.35, dly: 0.2 },
        drums:{ vol: 0.45, rev: 0.12 }
      },
      grooves: {
        reef:  { kick: 'o.......o.......', rim: '....x.......x...', shaker: 'o.x.o.x.o.x.o.xo', block: '..............x.' },
        light: { kick: 'o...............', shaker: 'o.x.o.x.o.x.o.x.', tri: 'x' + rest(63) }
      },
      sections: {
        A: {
          chords: 'Gmaj7:4 Em7:4 Cmaj7:4 D7sus4:2 D7:2 Gmaj7:4 Bm7:2 E7:2 Am7:4 D7:4', drums: 'reef',
          lead: 'D5:0.5 E5 D5 B4 G4:1 B4:1 | E5:1 G5:1.5 F#5:0.5 E5:1 | E5:0.5 F#5 G5 E5 C5:1 E5:1 | D5:1.5 G5:0.5 F#5:2 | ' +
                'D5:0.5 E5 D5 B4 G4:1 D5:1 | F#5:1 D5:1 E5:1 G#5:1 | A5:1.5 G5:0.5 E5:1 C5:1 | D5:1 F#5:0.5 A5:0.5 C6:1 r:1',
          bub: { notes: 'r:7 G5:0.25 D6:0.25 r:0.5', loop: true },
          harp: false
        },
        B: {
          chords: 'Cmaj7:4 Bm7:4 Am7:4 Gmaj7:4 Cmaj7:4 Cm6:4 G/B:2 A7:2 D7sus4:2 D7:2', drums: 'reef',
          fill: { tom: '........x.x.x.x.', block: '..x...x.........' },
          lead: 'G5:2 E5:1 G5:1 | F#5:2 D5:1 B4:1 | E5:1.5 D5:0.5 C5:1 E5:1 | D5:3 r:1 | ' +
                'G5:1 A5:1 B5:1.5 G5:0.5 | A5:2 G5:1 Eb5:1 | D5:1 B4:1 C#5:1 E5:1 | G5:1 A5:1 F#5:1 r:1',
          mar: false
        },
        C: {
          chords: 'Em7:4 Cadd9:4 Am7:4 D9:4 Em7:4 Cmaj7:4 Am7:2 Bm7:2 C:2 D7:2', drums: 'light',
          fill: { tom: '..........x.x.x.', block: 'x...x...........' },
          lead: 'B4:1 E5:1 G5:2 | D5:1 E5:1 G5:2 | r:8 | B5:1 G5:1 E5:2 | E5:1 G5:1 B5:2 | r:8',
          kal: 'r:8 | A5:0.5 G5 E5 C5 E5:1 A5:1 | F#5:0.5 E5 D5 C5 D5:1 A4:1 | r:8 | ' +
               'E5:0.5 C5 A4 C5 D5 F#5 A5 F#5 | G5:0.5 E5 C5 E5 F#5:1 A5:1',
          bub: { notes: 'r:3 E5:0.25 B5:0.25 r:0.5 | r:2 G5:0.25 r:1.75', loop: true },
          mar: false, harp: false
        }
      },
      form: 'A B A C'
    },

    /* Sunken Ship: a playful, slightly spooky D minor shanty in 6/8
       (one beat = one eighth note). A clarinet tune with a bell that
       answers, oom-pah guitar and upright bass, a creaky wood block.
       A B A C, 32 bars. */
    ship: {
      bpm: 192, beatsPerBar: 6, stepsPerBeat: 2, level: 1.25,
      reverb: { size: 2.4 }, delay: { beats: 3, feedback: 0.25 },
      tracks: {
        lead: { inst: 'reed', vol: 0.5, pan: 0.1, rev: 0.25, dly: 0.12, vib: 12 },
        bell: { inst: 'bell', vol: 0.4, pan: -0.25, rev: 0.45, dly: 0.25 },
        gtr:  { inst: 'pluck', vol: 0.36, auto: 'stab', rhythm: '..x.x.', gate: 0.7, octave: 4, decay: 0.25, pan: -0.15, rev: 0.15 },
        harp: { inst: 'pluck', vol: 0.3, auto: 'arp', pattern: 'broken', rate: 1, octave: 4, range: 2, decay: 0.45, pan: 0.25, rev: 0.4 },
        box:  { inst: 'organ', vol: 0.22, auto: 'pad', octave: 4, rev: 0.2, vib: 5 },
        bass: { inst: 'upright', vol: 0.55, auto: 'bass', style: 'root5', rhythm: 'x.....', octave: 2 },
        drums:{ vol: 0.45, rev: 0.12 }
      },
      grooves: {
        deck:  { kick: 'o.....o.....', rim: '....x.....x.', shaker: 'x.o.o.x.o.o.', block: '..........' + 'x.' + rest(12) },
        hush:  { tom: 'x...........' + rest(12), shaker: 'o.o.o.o.o.o.', block: rest(22) + 'x.' }
      },
      sections: {
        A: {
          chords: 'Dm:6 C:6 Dm:6 A7sus4:3 A7:3 Dm:6 Bbmaj7:6 Gm7:3 A7:3 Dm:6', drums: 'deck',
          lead: 'A4:2 D5:1 D5:2 E5:1 | E5:2 D5:1 C5:2 E5:1 | F5:2 E5:1 D5:2 A4:1 | D5:3 C#5:2 E5:1 | ' +
                'A4:2 D5:1 D5:2 F5:1 | F5:2 G5:1 A5:2 F5:1 | G5:2 F5:1 E5:2 C#5:1 | D5:4 r:2',
          harp: false
        },
        B: {
          chords: 'Dm7:6 G:6 Dm7:6 Bbmaj7:3 C:3 F:6 C/E:6 Bbmaj7:3 Gm7:3 A7sus4:3 A7:3', drums: 'deck',
          fill: { tom: '......x.x.x.', block: 'x.x.........' },
          lead: 'D5:1 F5:1 A5:1 C6:2 A5:1 | B5:3 G5:2 D5:1 | r:12 | ' +
                'C5:1 F5:1 A5:1 C6:2 A5:1 | G5:3 E5:2 C5:1 | D5:2 F5:1 Bb4:2 D5:1 | D5:3 C#5:3',
          bell: 'r:12 | A5:1 G5:1 F5:1 D5:2 C5:1 | D5:2 F5:1 E5:2 G5:1 | r:24',
          harp: false
        },
        C: {
          chords: 'Gm7:6 Dm:6 Bbmaj7:6 A7:6 Gm7:6 Dm/F:6 Em7b5:6 A7sus4:3 A7:3', drums: 'hush',
          fill: { tom: 'x.....x.x.x.', shaker: 'x.x.x.x.x.x.' },
          lead: 'D5:3 Bb4:2 G4:1 | A4:3 D5:2 F5:1 | F5:2 G5:1 A5:3 | G5:2 E5:1 C#5:3 | ' +
                'D5:3 Bb4:2 G4:1 | A4:3 D5:2 F5:1 | G5:2 F5:1 E5:2 D5:1 | D5:3 C#5:2 E5:1',
          gtr: false, box: false
        }
      },
      form: 'A B A C'
    },

    /* Deep Trench: slow E major wonder. Glassy bell tune, music-box
       shimmer, a wide choir, almost no drums. A B A' C, 16 bars. */
    trench: {
      bpm: 72, level: 1.0,
      reverb: { size: 3.6 }, delay: { beats: 1.5, feedback: 0.35, tone: 2400 },
      tracks: {
        lead: { inst: 'bell', vol: 0.75, pan: 0.1, rev: 0.5, dly: 0.3, decay: 1.3 },
        fl:   { inst: 'flute', vol: 0.3, pan: -0.2, rev: 0.55, dly: 0.2, vib: 10 },
        mbox: { inst: 'musicbox', vol: 0.3, auto: 'arp', pattern: 'updown', rate: 0.5, octave: 5, range: 1, decay: 0.8, pan: -0.3, rev: 0.6 },
        pad:  { inst: 'choir', vol: 0.6, auto: 'pad', octave: 4, rev: 0.6, attack: 0.9, release: 1.8 },
        str:  { inst: 'strings', vol: 0.3, auto: 'pad', octave: 3, rev: 0.5, attack: 0.6 },
        bass: { inst: 'bass', vol: 0.5, auto: 'bass', rhythm: 'x...............', octave: 2, tone: 2.6 },
        bub:  { inst: 'bubble', vol: 0.25, pan: 0.3, rev: 0.6, dly: 0.3 },
        drums:{ vol: 0.35, rev: 0.4 }
      },
      grooves: {
        drift: { kick: 'o' + rest(31), tri: rest(16) + 'x' + rest(15) },
        swell: { kick: 'o' + rest(15), shaker: '..o...o...o...o.', tri: rest(16) + 'x' + rest(15) }
      },
      sections: {
        A: {
          chords: 'Emaj9:4 C#m7:4 Amaj7:4 B7sus4:2 B:2', drums: 'drift',
          lead: 'B5:2 G#5:1 F#5:1 | E5:3 G#5:1 | C#6:1.5 B5:0.5 A5:1 E5:1 | E5:2 D#5:2',
          bub: 'r:6 E5:0.25 B5:0.25 r:1.5 | r:7 G#5:0.25 r:0.75',
          str: false
        },
        B: {
          chords: 'Amaj7:4 Am6:4 G#m7:2 C#7:2 F#m9:2 B7sus4:2', drums: 'swell',
          lead: 'E5:1 A5:1 C#6:2 | C6:2 A5:1 E5:1 | B5:1 F#5:1 E#5:1 G#5:1 | A5:1 G#5:1 F#5:2',
          fl: 'C#5:4 | E5:4 | D#5:2 E#5:2 | C#5:2 E5:2'
        },
        A2: {
          chords: 'Emaj9:4 C#m7:4 Amaj7:4 B7sus4:2 B:2', drums: 'drift',
          lead: 'G#5:1 B5:1 D#6:2 | C#6:2 B5:1 G#5:1 | A5:1.5 G#5:0.5 E5:1 C#5:1 | F#5:2 D#5:1 B4:1',
          bub: 'r:3 B4:0.25 r:0.75 | r:12',
          str: false
        },
        C: {
          chords: 'C#m9:4 Amaj9:4 E/G#:4 F#m7:2 B7:2', drums: 'swell',
          lead: 'G#5:2 E5:1 D#5:1 | C#6:2 B5:1 G#5:1 | B5:1.5 G#5:0.5 E5:2 | A5:1 F#5:1 D#5:1 F#5:1',
          fl: 'G#4:4 | E5:4 | G#4:4 | C#5:2 D#5:2'
        }
      },
      form: 'A B A2 C'
    },

    /* Mini-boss (Giant Octopus, King Crab): a bouncy, urgent E minor
       chase. Pulse lead, rattling marimba, octave synth bass, a full
       but friendly kit. A B A C, 32 bars. */
    boss: {
      bpm: 150, level: 1.0,
      reverb: { size: 1.6 }, delay: { beats: 0.75, feedback: 0.22 },
      tracks: {
        lead: { inst: 'lead', vol: 0.42, pan: 0.08, rev: 0.15, dly: 0.12, cutoff: 2600, vib: 9 },
        mar:  { inst: 'marimba', vol: 0.34, auto: 'arp', pattern: 'updown', rate: 0.25, octave: 4, range: 1, pan: -0.3, rev: 0.12 },
        brs:  { inst: 'brass', vol: 0.22, auto: 'stab', rhythm: 'X.....x.........', gate: 0.6, octave: 4, bright: 4, pan: 0.25, rev: 0.2 },
        pad:  { inst: 'strings', vol: 0.3, auto: 'pad', octave: 4, rev: 0.25 },
        bass: { inst: 'synthbass', vol: 0.5, auto: 'bass', style: 'oct', rhythm: 'x.x.x.x.x.x.x.x.', gate: 0.7, octave: 2, q: 4 },
        drums:{ vol: 0.5, rev: 0.08 }
      },
      grooves: {
        chase: { kick: 'x...o...x...o...', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.ox', crash: 'x' + rest(127) },
        drive: { kick: 'x...o...x...o.o.', snare: '....x.......x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
        toms:  { kick: 'x.......x.......', tom: '......x.......x.', hat: '..x...x...x...x.' }
      },
      sections: {
        A: {
          chords: 'Em:4 Cmaj7:4 Am7:4 B7:4 Em:4 Cmaj7:4 Am7:2 D:2 B7sus4:2 B7:2', drums: 'chase',
          lead: 'E5:0.5 E5 G5 E5 B5:1 G5:0.5 E5 | G5:0.5 G5 E5 G5 C6:1 B5:1 | A5:0.5 G5 E5 G5 A5:1 C6:1 | B5:1.5 A5:0.5 F#5:1 D#5:1 | ' +
                'E5:0.5 E5 G5 E5 B5:1 G5:0.5 E5 | G5:0.5 G5 E5 G5 C6:1 E6:1 | C6:1 A5:1 F#5:1 A5:1 | F#5:1 E5:1 D#5:2',
          brs: false
        },
        B: {
          chords: 'C:4 D:4 Bm7:4 Em:4 C:4 D:4 Am7:4 B7:4', drums: 'drive',
          fill: { snare: '........x.x.xxxx', tom: '..x.x...........' },
          lead: 'G5:1.5 E5:0.5 G5:1 C6:1 | A5:2 F#5:1 D5:1 | F#5:1.5 D5:0.5 F#5:1 B5:1 | G5:3 r:1 | ' +
                'G5:1.5 E5:0.5 G5:1 C6:1 | D6:2 A5:1 F#5:1 | E5:1 A5:1 C6:1 E6:1 | D#6:2 B5:1 r:1'
        },
        C: {
          chords: 'Am7:4 Em:4 Am7:4 B7:4 Am7:4 Em/G:4 Cmaj7:4 B7sus4:2 B7:2', drums: 'toms',
          fill: { snare: '....x...x.x.xxxx', tom: 'x.x.............' },
          lead: 'E5:1 r:0.5 E5:0.5 G5:1 A5:1 | B5:2 G5:2 | C6:1 r:0.5 C6:0.5 A5:1 E5:1 | F#5:2 D#5:2 | ' +
                'E5:1 r:0.5 E5:0.5 G5:1 A5:1 | B5:2 E6:2 | E6:1 D6:0.5 C6:0.5 B5:1 G5:1 | E5:1 F#5:1 D#5:2',
          brs: false
        }
      },
      form: 'A B A C'
    },

    /* Moni, the final boss: D minor with a magic-spell sparkle. A plucked
       ostinato under a pulse lead, choir and strings, toms; the bridge
       hands the tune to a bell. A B A C, 32 bars. */
    bossFinal: {
      bpm: 140, level: 0.9,
      reverb: { size: 2.2 }, delay: { beats: 0.75, feedback: 0.25 },
      tracks: {
        lead: { inst: 'lead', vol: 0.4, pan: 0.08, rev: 0.2, dly: 0.12, cutoff: 2400, vib: 10 },
        bell: { inst: 'bell', vol: 0.5, pan: -0.15, rev: 0.45, dly: 0.25 },
        ost:  { inst: 'pluck', vol: 0.3, auto: 'arp', pattern: 'up', rate: 0.25, octave: 4, range: 1, decay: 0.2, pan: -0.3, rev: 0.15 },
        pad:  { inst: 'choir', vol: 0.45, auto: 'pad', octave: 4, rev: 0.4 },
        str:  { inst: 'strings', vol: 0.3, auto: 'pad', octave: 3, rev: 0.3 },
        bass: { inst: 'bass', vol: 0.55, auto: 'bass', style: 'oct', rhythm: 'x.x.x.x.x.x.x.x.', gate: 0.75, octave: 2 },
        drums:{ vol: 0.5, rev: 0.12 }
      },
      grooves: {
        spell: { kick: 'x.....x.x.......', snare: '....x.......x...', tom: '..............x.', hat: 'x.x.x.x.x.x.x.x.', crash: 'x' + rest(127) },
        rally: { kick: 'x...x...x...x...', snare: '....x.......x...', clap: '............x...', hat: 'x.oxx.oxx.oxx.ox' },
        magic: { tom: 'x.....x.........', tri: 'x' + rest(31), shaker: 'o.x.o.x.o.x.o.x.' }
      },
      sections: {
        A: {
          chords: 'Dm:4 Bbmaj7:4 Gm7:4 A7:4 Dm:4 F/C:4 Bbmaj7:2 Gm7:2 A7sus4:2 A7:2', drums: 'spell',
          lead: 'D5:1 A5:1 F5:1.5 E5:0.5 | D5:1 F5:1 Bb5:2 | G5:1.5 F5:0.5 D5:1 Bb4:1 | C#5:2 E5:1 A5:1 | ' +
                'D5:1 A5:1 F5:1.5 E5:0.5 | F5:1 A5:1 C6:2 | D6:1 A5:1 Bb5:1 G5:1 | D5:1 E5:1 C#5:2',
          str: false
        },
        B: {
          chords: 'Bbmaj7:4 C:4 Am7:4 Dm7:4 Gm7:4 C7:4 Fmaj7:4 E7:2 A7:2', drums: 'rally',
          fill: { snare: '........x.x.xxxx', tom: 'x...x...........' },
          lead: 'F5:1.5 D5:0.5 F5:1 A5:1 | G5:2 E5:1 C5:1 | E5:1.5 C5:0.5 E5:1 A5:1 | F5:3 r:1 | ' +
                'D5:1 G5:1 Bb5:1.5 A5:0.5 | G5:1 E5:1 Bb5:2 | A5:1.5 G5:0.5 F5:1 E5:1 | G#5:1 D5:1 C#5:1 E5:1'
        },
        C: {
          chords: 'Gm7:4 Dm:4 Gm7:4 A7:4 Bbmaj7:4 Gm7:4 Em7b5:4 A7:4', drums: 'magic',
          fill: { snare: '....x...x.x.xxxx', kick: 'x...x...x...x...' },
          bell: 'Bb5:1 A5:1 G5:2 | F5:1 E5:1 D5:2 | Bb5:1 C6:1 D6:2 | C#6:2 A5:2 | ' +
                'D6:1 C6:1 Bb5:2 | G5:1 A5:1 Bb5:2 | G5:1 F5:1 E5:2 | C#5:2 E5:2',
          ost: false
        }
      },
      form: 'A B A C'
    }
  };
})();
