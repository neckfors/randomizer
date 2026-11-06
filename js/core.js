const KEY = 'whostarts.v1';
const MUTE_KEY = 'whostarts.muted';
const SHAKE_KEY = 'whostarts.shake';
const SPIN_KEY = 'whostarts.spin';
try { localStorage.removeItem('whostarts.rerolls'); } catch (e) {} // a reroll count kept by version 90
const MODE_KEY = 'whostarts.mode';
const NUM_KEY = 'whostarts.numbers';

const STARTER_LISTS = [['Game night', '🎲'], ['Who makes dinner', '🍳'], ['Where to eat', '🍕']];
const EMOJIS = ['📋', '🎲', '🎮', '🃏', '🍕', '🍔', '🍳', '🍽️', '🍻', '☕', '🎬', '📺', '📚', '🎵', '🧹', '🚗', '✈️', '🏃', '🐶', '🎁', '💡', '❤️'];
const MAX_HISTORY = 100;
const HISTORY_SHOWN = 10;   // shown before "Show all"

function randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

function newId() {
  return Date.now().toString(36) + randomInt(1e6).toString(36);
}

// The first character as a person sees it, so multi-part emojis like 👨‍👩‍👧 or 🇸🇪 stay whole.
function firstGrapheme(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const first = new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value;
    return first ? first.segment : '';
  }
  return Array.from(s)[0];
}

function defaultEmoji(name) {
  const starter = STARTER_LISTS.find(([n]) => n === name);
  return starter ? starter[1] : '📋';
}

// Fills in anything older saves, backups or shared links are missing.
function normalizeSet(s) {
  const name = String(s.name || 'List').trim().slice(0, 30) || 'List';
  return {
    id: s.id || newId(),
    name,
    emoji: firstGrapheme(s.emoji) || defaultEmoji(name),
    once: !!s.once,
    items: (Array.isArray(s.items) ? s.items : [])
      .filter(i => i && i.name)
      .map(i => ({ id: i.id || newId(), name: String(i.name).slice(0, 40), playing: i.playing !== false,
        // sat out because "pick each only once" picked it (not left out by hand)
        ...(i.picked && i.playing === false ? { picked: true } : {}) })),
    history: (Array.isArray(s.history) ? s.history : [])
      .filter(h => h && h.name)
      .slice(0, MAX_HISTORY),
    // the list's own address (#slug); ensureSlugs() fills it in when missing
    slug: typeof s.slug === 'string' ? s.slug : '',
    // earlier addresses, so links keep working after a rename
    aliases: (Array.isArray(s.aliases) ? s.aliases : []).filter(a => typeof a === 'string').slice(0, 10),
  };
}

function starterState(firstItems = []) {
  const sets = STARTER_LISTS.map(([name, emoji], i) => normalizeSet({ id: newId() + i, name, emoji, items: i === 0 ? firstItems : [] }));
  return { sets, current: sets[0].id };
}

// Each list ("set") keeps its own options. Data saved before lists existed was
// a single { players } list; it becomes the first starter list.
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.sets) && s.sets.length) return { sets: s.sets.map(normalizeSet), current: s.current };
    if (s && Array.isArray(s.players)) return starterState(s.players);
  } catch (e) {}
  return starterState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function pref(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function setPref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

// ---------- List addresses ----------
// Every list has its own address, like …/randomizer/#game-night, that opens the
// app straight on that list.
function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'list';
}

// "#dice" (and the older "#number") and "#coin" are the addresses of Dice and Coin mode, so no list may use them
const RESERVED_SLUGS = ['dice', 'number', 'coin'];

function slugTaken(slug, except) {
  return RESERVED_SLUGS.includes(slug) || state.sets.some(s => s !== except && (s.slug === slug || s.aliases.includes(slug)));
}

function uniqueSlug(name, except) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; slugTaken(slug, except); i++) slug = `${base}-${i}`;
  return slug;
}

function ensureSlugs() {
  const seen = new Set();
  for (const s of state.sets) {
    if (!s.slug || seen.has(s.slug) || RESERVED_SLUGS.includes(s.slug)) s.slug = uniqueSlug(s.name, s);
    seen.add(s.slug);
  }
}

function addressOf(set) {
  return `${location.origin}${location.pathname}#${set.slug}`;
}

let state = load();
ensureSlugs();
let rolling = false;
// "lists" picks an option from the current list; "number" rolls a number From–To
// (with up to 5 dice added up); "coin" flips a coin
let mode = ['number', 'coin'].includes(pref(MODE_KEY, 'lists')) ? pref(MODE_KEY, 'lists') : 'lists';
// the last MAX_HISTORY dice rolls, newest first, for all ranges together:
// { value: "9", from: "2d6", parts: "4 + 5", at }, shown as Recent rolls in Dice mode
const ROLLS_KEY = 'whostarts.rolls';
let rolls = (() => {
  try {
    const r = JSON.parse(pref(ROLLS_KEY, '[]'));
    if (Array.isArray(r)) return r.filter(e => e && typeof e.value === 'string' && Number.isFinite(e.at)).slice(0, MAX_HISTORY);
  } catch (e) {}
  return [];
})();
function saveRolls() {
  setPref(ROLLS_KEY, JSON.stringify(rolls));
}
// how many heads and tails have come up, until Reset
const COIN_KEY = 'whostarts.coin';
let coinTally = (() => {
  try {
    const t = JSON.parse(pref(COIN_KEY, 'null'));
    if (t && Number.isInteger(t.heads) && Number.isInteger(t.tails)) return t;
  } catch (e) {}
  return { heads: 0, tails: 0 };
})();
let numbers = (() => {
  try {
    const n = JSON.parse(pref(NUM_KEY, 'null'));
    if (n && Number.isInteger(n.from) && Number.isInteger(n.to)) return n;
  } catch (e) {}
  return { from: 1, to: 6 };
})();
let winnerId = null;     // crowned row, until the next pick
let freshIds = new Set();// rows that just got added
let bounceId = null;     // row that was just toggled

const $ = (id) => document.getElementById(id);
const result = $('result');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function cur() {
  return state.sets.find(s => s.id === state.current) || state.sets[0];
}

function byName(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ✕ asks first: one tap turns it into a red Delete button in the same spot,
// with Cancel next to it where ✎ was. Delete removes the row; Cancel, tapping
// anywhere else or waiting a few seconds puts ✕ back.
let armedDel = null;
function disarmDelete() {
  if (!armedDel) return;
  const { btn, label, cancel, timer } = armedDel;
  armedDel = null;
  clearTimeout(timer);
  btn.classList.remove('armed');
  btn.textContent = '✕';
  btn.setAttribute('aria-label', label);
  cancel.remove();
  btn.parentElement?.classList.remove('confirming');
}
function confirmDelete(del, remove) {
  del.onclick = (e) => {
    e.stopPropagation();
    if (rolling) return;
    if (armedDel && armedDel.btn === del) { disarmDelete(); remove(); return; }
    disarmDelete();
    const label = del.getAttribute('aria-label');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'del-cancel';
    cancel.textContent = 'Cancel';
    cancel.onclick = (ev) => { ev.stopPropagation(); disarmDelete(); };
    del.before(cancel);
    del.parentElement.classList.add('confirming');
    armedDel = { btn: del, label, cancel, timer: setTimeout(disarmDelete, 6000) };
    del.classList.add('armed');
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Confirm: ${label}`);
    sfx.click();
  };
}
// Cancel, or a tap anywhere else, only puts ✕ back: the click that follows is
// swallowed, so it doesn't also tap the row (or whatever slid under the finger).
// The click comes right after the finger lifts (or not at all, when the tapped
// Cancel is already gone), so only that moment counts.
let swallowTap = false;
let swallowClickUntil = 0;
document.addEventListener('pointerdown', (e) => {
  if (!armedDel || e.target === armedDel.btn) return;
  disarmDelete();
  swallowTap = true;
}, true);
document.addEventListener('pointerup', () => {
  if (!swallowTap) return;
  swallowTap = false;
  swallowClickUntil = performance.now() + 100;
}, true);
document.addEventListener('pointercancel', () => { swallowTap = false; }, true);
document.addEventListener('click', (e) => {
  if (performance.now() > swallowClickUntil) return;
  swallowClickUntil = 0;
  e.stopPropagation();
  e.preventDefault();
}, true);

// Closes a dialog when its dimmed backdrop is tapped.
function closeOnBackdrop(d) {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}

// ---------- Sound (synthesized with Web Audio, no files needed) ----------
let muted = pref(MUTE_KEY, '0') === '1';
let actx = null;

function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC({ latencyHint: 'interactive' });
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
// Phones take a moment to start (or wake) their audio, and sounds timed
// before then all come late. So it starts on the first touch, before the tap
// that picks has even ended, and wakes up again when you come back to the app.
addEventListener('pointerdown', () => { if (!muted) audio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && actx && !muted) audio(); });
// Phones also take a while (their output latency) to turn a sound into
// something you hear. Sounds timed to an animation (a knock as a die turns, a
// clink as the coin lands, a click as a name passes) are asked for that much
// earlier, so you hear them when you see them: inSync(at) instead of at.
function inSync(at) {
  const lag = muted || !actx ? 0 : (actx.outputLatency || actx.baseLatency || 0);
  return Math.max(0, at - lag);
}

function tone(freq, { at = 0, dur = 0.1, type = 'triangle', vol = 0.15, slide = null } = {}) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// A burst of noise through a band filter: knocks, clinks and whooshes.
// The filter can sweep (from freq to to) for a whoosh.
let noiseBuffer = null;
function noise({ at = 0, dur = 0.04, vol = 0.2, freq = 2000, to = null, q = 1.5, attack = 0.004 } = {}) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const sfx = {
  add()    { tone(520, { dur: 0.09, slide: 880 }); tone(1046, { at: 0.08, dur: 0.1, vol: 0.1 }); },
  addMany(n) { for (let i = 0; i < Math.min(n, 6); i++) tone(520 + i * 90, { at: i * 0.05, dur: 0.08, vol: 0.1 }); },
  in()     { tone(440, { dur: 0.1, slide: 700 }); },
  out()    { tone(440, { dur: 0.13, slide: 240 }); },
  del()    { tone(380, { dur: 0.3, slide: 70, type: 'sawtooth', vol: 0.07 }); },
  // a coin landing on the table: two bright metal rings (softer for a bounce)
  clink(at = 0, strength = 1) {
    tone(2500, { at, dur: 0.12, type: 'sine', vol: 0.08 * strength });
    tone(3400, { at: at + 0.015, dur: 0.18, type: 'sine', vol: 0.05 * strength });
    tone(1250, { at, dur: 0.05, type: 'triangle', vol: 0.05 * strength });
    noise({ at, dur: 0.03, vol: 0.12 * strength, freq: 5000, q: 2 });
  },
  // the coin tossed up into the air
  whoosh(at = 0) { noise({ at, dur: 0.4, vol: 0.06, freq: 500, to: 2600, q: 0.8, attack: 0.15 }); },
  // a faint metal shimmer as the spinning coin's face catches the light
  ting(at, strength = 1) { tone(3000 + randomInt(600), { at, dur: 0.07, type: 'sine', vol: 0.012 * strength }); },
  // a die knocking on the table as it tumbles: a hard click and a low knock
  clack(at, strength = 1) {
    noise({ at, dur: 0.035, vol: 0.2 * strength, freq: 1900 + randomInt(900), q: 2.5 });
    tone(150 + randomInt(60), { at, dur: 0.035, type: 'square', vol: 0.025 * strength });
  },
  // a die coming to rest: a softer, deeper knock
  diceStop(at) {
    noise({ at, dur: 0.07, vol: 0.18, freq: 900, q: 1.5 });
    tone(110, { at, dur: 0.1, type: 'sine', vol: 0.09 });
  },
  // the reel clicking past each name as it turns
  reelClick(at, strength = 1) {
    tone(1300 + randomInt(200), { at, dur: 0.018, type: 'square', vol: 0.03 * strength });
    noise({ at, dur: 0.012, vol: 0.05 * strength, freq: 4500, q: 2 });
  },
  // a magic die: a soft twinkle
  sparkle(at = 0) { tone(1800 + randomInt(2200), { at, dur: 0.09, type: 'sine', vol: 0.02 }); },
  win() {
    [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.14, vol: 0.14 }));
    [1046, 1318, 1568].forEach(f => tone(f, { at: 0.32, dur: 0.8, vol: 0.07 }));
    for (let i = 0; i < 8; i++) tone(2000 + randomInt(2000), { at: 0.35 + i * 0.07, dur: 0.05, type: 'sine', vol: 0.03 });
  },
  toggleSound() { tone(660, { dur: 0.08 }); tone(990, { at: 0.07, dur: 0.1 }); },
  swap()   { tone(500, { dur: 0.12, slide: 1000, type: 'sine', vol: 0.08 }); tone(1000, { at: 0.06, dur: 0.06, vol: 0.06 }); },
  click()  { tone(1400, { dur: 0.02, type: 'square', vol: 0.03 }); },
};

function renderMute() {
  $('mute').textContent = muted ? '🔇' : '🔊';
  $('mute').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
}
function setMuted(value) {
  muted = value;
  setPref(MUTE_KEY, muted ? '1' : '0');
  renderMute();
  sfx.toggleSound();
}
$('mute').onclick = () => setMuted(!muted);

// ---------- Theme ----------
const THEME_KEY = 'whostarts.theme';
const THEMES = ['auto', 'light', 'dark', 'black'];
let theme = THEMES.includes(pref(THEME_KEY, 'auto')) ? pref(THEME_KEY, 'auto') : 'auto';
function renderTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  for (const b of $('themePick').children) {
    b.classList.toggle('on', b.dataset.theme === theme);
    b.setAttribute('aria-pressed', b.dataset.theme === theme);
  }
}
$('themePick').onclick = (e) => {
  const t = e.target.closest('button')?.dataset.theme;
  if (!t || t === theme) return;
  theme = t;
  setPref(THEME_KEY, theme);
  renderTheme();
  sfx.click();
};
renderTheme();

// ---------- Confetti ----------
const canvas = $('confetti');
const cctx = canvas.getContext('2d');
let pieces = [];
let confettiRunning = false;
const COLORS = ['#e0a400', '#3fa57f', '#e2735f', '#5b8def', '#c86bd6', '#f2c230'];

// The confetti layer matches the screen; rotating the phone resizes it (and
// clears it), so no stretched leftovers stay behind.
function sizeConfetti() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', sizeConfetti);

function clearConfetti() {
  cctx.save();
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  cctx.restore();
}

function burst(x, y) {
  if (reducedMotion) return;
  sizeConfetti();
  for (let i = 0; i < 140; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    pieces.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[i % COLORS.length],
      life: 0,
    });
  }
  if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(drawConfetti); }
}

function drawConfetti() {
  clearConfetti();
  pieces = pieces.filter(p => p.life < 180 && p.y < innerHeight + 20);
  for (const p of pieces) {
    p.life++;
    p.vy += 0.3;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.globalAlpha = Math.min(1, (180 - p.life) / 40);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.15)));
    cctx.restore();
  }
  if (pieces.length) requestAnimationFrame(drawConfetti);
  else { confettiRunning = false; clearConfetti(); }
}
