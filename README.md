# 🎲 Pick One

A tiny web app that picks one thing at random from a list, with a slot-machine spin, confetti and sound effects.

**Try it:** https://neckfors.github.io/pick-one/

It installs on your phone like a normal app, works offline, and remembers your list.

## What can it be used for?

Anything where you need a fair, random pick:

- 🎮 **Who starts the game:** board games, card games, video games
- 🍕 **Where to eat:** put your usual restaurants on the list and stop arguing
- 🎬 **What to watch:** movies, series or that ever-growing "watch later" list
- 🧹 **Who does the chore:** dishes, taking out the trash, walking the dog
- 🚗 **Who drives** or who picks the music in the car
- 🏫 **Who answers next:** pick a student, or who presents first in a meeting
- 🎁 **Giveaways and raffles:** pick from the participants
- 🍳 **What's for dinner:** add the meals you know how to cook
- 📚 **What to read or play next** from your backlog
- 🏃 **Which workout today:** run, gym, yoga, rest day…
- 🤔 **Any tough decision:** when you just can't choose, let it choose

## How it works

1. **Add options** using the field at the top.
2. **Tap an option** to leave it out for now (someone isn't here, the restaurant is closed…). Tap it again to bring it back.
3. **Tap Pick!** and watch it spin. The pick gets confetti and a 👑.
4. Remove an option for good with **✕**.

Every pick is completely random. Each option in the draw has the same chance every time, even if it was picked last time.

Use 🔊 in the top corner to turn the sounds on or off.

## Install on your phone

- **iPhone:** open the link in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the link in Chrome and tap **Install app** (also in the ⋮ menu).

> On iPhone, the silent switch also mutes the sound effects.

## Tech

Plain HTML, CSS and JavaScript, with no build step or dependencies.

| File | Purpose |
|---|---|
| `index.html` | The whole app: layout, styles and logic |
| `manifest.json` | App name, icons and colors, so it can be installed |
| `sw.js` | Service worker that caches the files for offline use |
| `icon-192.png`, `icon-512.png` | App icons |

- The list is stored in the browser's `localStorage` on your device. Nothing is sent anywhere.
- The sounds are generated with the Web Audio API, so there are no audio files.
- The random pick uses `crypto.getRandomValues`.

### Making changes

Edit the files and push to `main`. GitHub Pages publishes automatically.
**Change `CACHE` in `sw.js` every time** (for example `whostarts-v6` → `whostarts-v7`), otherwise installed copies keep showing the old version.
