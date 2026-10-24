# Momoko's Under Water World

A colorful pixel-art underwater adventure game inspired by classic NES-era
side-scrolling games. Help **Momoko** swim through three reefs, collect pearls,
meet friendly characters, defeat enemies with her **Rainbow Bubble Gun**, and
save the sea from the evil mermaid **Moni**!

## Play

**[Play Online](https://ruck314.github.io/momokos-underwater-world/)**

Or open `index.html` in any modern browser. Works offline after first visit (PWA).

## Controls

| Action           | Keyboard         | Touch            |
|------------------|------------------|------------------|
| Swim             | Arrow Keys / WASD| D-Pad (left)     |
| Shoot Bubbles    | Space / Z        | Bubble Button    |
| Pause            | Escape / P       | Pause Button     |

## Features

- **Pure HTML5 Canvas + JavaScript** — no frameworks, no build tools
- **PWA** — install to home screen, works offline
- **Touch controls** — fully playable on iPad and Android tablets
- **Dual language** — English and Japanese
- **All art generated in code** — no external image or audio files
- **Chiptune audio** — Web Audio API generated sound effects and music
- **Three reefs** — Coral Reef, Sunken Ship and the dark Deep Trench, each
  with its own palette, decorations, enemies and guardian
- **Pearls and stars** — 30-ish pearls hidden in every level (some in treasure
  chests you shoot open); clear a reef for 1–3 stars, saved in the browser
- **Level select** — "Choose a Reef" with painted thumbnails, best scores and
  padlocks on reefs you haven't reached yet

## Levels

1. **Coral Reef** — learn to swim, meet Oliver, Kitty Corn and Bob, and beat
   the **Giant Octopus** (hovers, lunges, spits ink).
2. **Sunken Ship** — a kelp forest and a broken wreck full of barrels and
   treasure chests, guarded by the **King Crab** (scuttles, flings shells).
3. **Deep Trench** — Moni's lair. Only Momoko's lamp and the glowing plants,
   vents and jellyfish light the way to the final fight with **Moni**.

## Enemies

- **Reef fish** — tropical, clownfish, angelfish, swordfish, blowfish
- **Octopus** — hovers in place
- **Jellyfish** — slow vertical bob; glows in the trench
- **Eel** — hides in a rock hole and lunges out when you swim past
- **Shark** — fast patroller that speeds up when it sees you (2 hits)

## Characters

- **Momoko** — our hero in a diving suit with a rainbow bubble gun
- **Oliver the Otter** — a friendly otter who tells jokes
- **Kitty Corn** — a cat-mermaid (with a unicorn horn!) who gives hints
- **Bob** — an ocean expert in a submarine who shares fun facts
- **Wolfe** — a dog playing on the beach (swim to the surface to find him!)
- **Giant Octopus** and **King Crab** — the mini-bosses guarding reefs 1 and 2
- **Moni** — the evil mermaid boss waiting in the Deep Trench

## Tech Stack

- HTML5 Canvas for rendering
- Web Audio API for procedural sound
- Service Worker for offline caching
- Vanilla JavaScript (ES5 compatible)

## Project Structure

```
index.html          — entry point
css/style.css       — layout & responsive styles
js/i18n.js          — English & Japanese translations
js/audio.js         — Web Audio API sound engine
js/input.js         — keyboard & touch input handler
js/levels.js        — level data (separate from engine)
js/entities.js      — all game characters & objects
js/ui.js            — menus, HUD, dialogue, screens
js/engine.js        — game loop, state machine, rendering
js/pwa.js           — service worker registration
sw.js               — service worker
manifest.json       — PWA manifest
```

## Adding New Levels

Level data lives in `js/levels.js`. Each level is a plain object with:
- `nameKey` / `theme` — i18n name and level-select thumbnail style
- `platforms[]` — solid coral/rock blocks (`kind: 'wood'` for ship timber)
- `decorations[]` — seaweed, coral, shells, kelp, wreck, mast, anchor,
  barrel, glowplant, vent, crystal
- `spawns` — player start, enemies, NPCs, pickups (hearts and pearls),
  chests, and the boss (`type: 'giantOctopus' | 'kingCrab' | 'moni'`)
- `bossAreaX` — x-coordinate that triggers the boss fight
- `dark: true` — trench darkness with a light cone around Momoko

Add a new object to the `Game.levels.data` array and the engine picks it up.

## License

MIT License — Copyright (c) 2025 ruck314

Made with love for Momoko.
