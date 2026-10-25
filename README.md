# 👑 Pick One

A tiny web app that picks one thing at random from a list, with a slot-machine spin, confetti and sound effects.

**Try it:** https://neckfors.github.io/pick-one/

It installs on your phone like a normal app, works offline, and remembers your lists.

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
- 🔢 **A random number:** roll a die, pick a raffle ticket, or any number between two values

## How it works

1. **Choose a list:** tap the list button under the Pick! area to see all your lists (*🎲 Game night*, *🍳 Who makes dinner*, *🍕 Where to eat*, …) and tap one to switch. Each list keeps its own options, so the names in one list never show up in another.
2. **Add options** using the field under the list. Add several at once by separating them with commas (`Anna, Erik, Sara`), or paste a list with one option per line.
3. **Tap an option** to leave it out for now (someone isn't here, the restaurant is closed…). Tap it again to bring it back.
4. **Tap Pick!** and watch it spin. The picked option lights up in gold, with a 👑 and confetti.
5. Remove an option for good with **✕**.

Every pick is completely random. Each option in the draw has the same chance every time, even if it was picked last time.

**Pick each only once:** switch this on for a list when you want to go round instead, like taking turns on chores. Whatever gets picked sits out automatically, and when everything has been picked, the button turns into **↺ Start over** to put everything back. The setting is saved per list, so *Game night* can allow repeats while *Who makes dinner* takes turns.

**Recent picks:** under the options, *🕘 Recent picks* keeps the last 100 picks for each list, handy for "who did the dishes last time?". It shows the newest 10; tap *Show all* to see the rest.

## Rolling a number 🎲

Switch to **🎲 Number** at the top to roll a random number instead of picking from a list. It works just like a list, except each row is a range of numbers:

1. **Add a range** with the From – To fields and **Add**. Any whole numbers work, even 1 to 1,000,000. You start with 1–6, 1–10 and 1–100.
2. **Tap the circle** at the start of a row to choose the range to roll. It gets a ✓.
3. **Tap Roll!** (or shake your phone). A die tumbles while numbers race past, and it lands on a number from the range, both ends included.
4. **Change a range right in its row:** tap the numbers to change From or To, and press Enter or tap elsewhere to save. They are put in order if you swap them, and a range you already have is not added twice. **Name a range** the same way: tap the name field next to the numbers (it says *✎ Add a name* until you give it one), type a name like *d6*, *d20* or *Raffle*, and press Enter or tap elsewhere. Tap it again any time to rename it, or clear it to remove the name. **✕** removes a range.

Your ranges are remembered and included in backups. `https://neckfors.github.io/pick-one/#number` opens straight in Number mode.

## Managing lists

In the list panel:

- **+ New list** makes a new list.
- **✎** renames a list, gives it an icon (pick one, or type any emoji from your keyboard), shares it or deletes it.
- **Drag ⠿** to put your lists in the order you like.
- **Select** lets you tick one or more lists and delete them all at once (it asks first, and always keeps at least one list).

### Each list's own address

Every list has its own address, for example `https://neckfors.github.io/pick-one/#game-night`. Opening it starts Pick One straight on that list, and the address bar follows whichever list you're on. Copy it with ✎ → **🔗 Copy this list's address**, and bookmark it if you like. The address only opens *your* copy of the list on that device. To give a list to someone else, use **Share** below. If you rename a list, it gets a new address, and the old one keeps working.

### Sharing a list

Tap ✎ on a list, then **⤴ Share this list**. You get a link to send to anyone. When they open it, Pick One asks whether to add the list, with all its options, to their own lists. The list travels inside the link itself, so nothing is uploaded anywhere.

## Settings ⚙️

- **Shake to pick** (on by default on phones): give your phone two quick shakes instead of tapping Pick! The hint in the Pick! card then reads *Tap Pick! or shake your phone*. On iPhone, a *📳 Tap to turn on shake to pick* button shows first, because Safari asks for motion access once. Tap *No thanks* next to it if you don't want shaking. You can switch it on or off here any time.
- **Sound effects:** on or off (the 🔊 button at the top does the same).
- **Backup:** *Save backup* downloads a file with all your lists. *Restore* loads such a file and replaces your lists with it. Use it to keep your lists safe, or to move them to a new phone.

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

- Your lists are stored in the browser's `localStorage` on your device. Nothing is sent anywhere.
- Shared lists are encoded in the link after `#list=`, which never reaches the server.
- The sounds are generated with the Web Audio API, so there are no audio files.
- The random pick uses `crypto.getRandomValues`.

### Making changes

Edit the files and push to `main`. GitHub Pages publishes automatically.
**Change `CACHE` in `sw.js` every time** (for example `whostarts-v37` → `whostarts-v38`), otherwise installed copies keep showing the old version.

## Support

If you like the app, you can support it on [PayPal](https://paypal.me/neckfors). Thank you!
