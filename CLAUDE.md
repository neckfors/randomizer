# Randomizer

Installable PWA at https://neckfors.github.io/randomizer/ (repo `neckfors/randomizer`, branch `main`).
Three modes: Lists (slot-machine reel pick), Dice (3D canvas dice plus a purple magic d20 for ranges
no real die can roll) and Coin (3D gold and silver coin). Plain HTML/CSS/JS, no build step.

## Files
| File | What's in it |
|---|---|
| `index.html` | Page layout only |
| `styles.css` | All styles |
| `js/core.js` | Storage keys, list addresses, sound, theme, confetti |
| `js/lists.js` | Lists, mode switch, ranges, editing rows, adding ranges, sharing |
| `js/picking.js` | Settings/backup, shake, options, recent picks, spin time, the reel pick |
| `js/dice.js` | 3D dice and rolling numbers |
| `js/coin.js` | Coin flip |
| `js/app.js` | Focus mode, fullscreen swipes, update bar and version |
| `sw.js` | Service worker; `FILES` must list every file above |

Scripts are classic `<script>` tags sharing globals, loaded in the order above. Search before reading.

## Working rules
- Every change bumps `const VERSION = N` in `sw.js` and the example in README's "Making changes"
  (`N` → `N+1`).
- New files must be added to `FILES` in `sw.js` and the README file table.
- Check the live site: `curl -s https://neckfors.github.io/randomizer/sw.js | grep -o "^const VERSION = [0-9]*"`
- Run `git fetch` before pushing. Commits end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Python: `/c/Users/Zoidberg/AppData/Local/Programs/Python/Python314/python.exe`. No node.
- Preview: `.claude/launch.json`, name `who-starts`, port 8771. Before testing, unregister the
  service worker and clear caches, then `location.reload()`.
