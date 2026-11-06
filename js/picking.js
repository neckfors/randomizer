// ---------- Settings, backup and restore ----------
const settings = $('settingsDialog');
closeOnBackdrop(settings);

function renderSettings() {
  $('shakeToggle').checked = shakeOn;
  $('spinTime').value = spinSeconds;
  renderSpinValue();
  renderMute();
}

function renderSpinValue() {
  $('spinValue').textContent = spinSeconds === 0 ? 'Instant' : `${spinSeconds.toLocaleString()} s`;
}
$('spinTime').addEventListener('input', (e) => {
  spinSeconds = Number(e.target.value);
  setPref(SPIN_KEY, String(spinSeconds));
  renderSpinValue();
  sfx.click();
});

$('settingsBtn').onclick = () => {
  if (rolling) return;
  renderSettings();
  settings.showModal();
};
$('settingsClose').onclick = () => settings.close();

$('exportBtn').onclick = () => {
  const data = { app: 'randomizer', version: 1, exported: new Date().toISOString(), current: state.current, sets: state.sets, ranges };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `randomizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  sfx.add();
  toast('Backup saved');
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.sets) || !data.sets.length) throw new Error('not a backup');
    const sets = data.sets.map(normalizeSet);
    const lists = `${sets.length} list${sets.length === 1 ? '' : 's'}`;
    if (!confirm(`Replace all your lists with the ${lists} from this backup?`)) return;
    state = { sets, current: sets.some(s => s.id === data.current) ? data.current : sets[0].id };
    ensureSlugs();
    // backups from before saved ranges existed have none; keep the current ones then
    const savedRanges = normalizeRanges(data.ranges);
    if (savedRanges) { ranges = savedRanges; saveRanges(); }
    resetCard();
    save(); render();
    sfx.addMany(4);
    settings.close();
    toast(`Restored ${lists}`);
  } catch (err) {
    sfx.out();
    toast('That file is not a Randomizer backup');
  }
};

// ---------- Shake to pick ----------
// On by default on phones (touch screen with motion sensors); computers never see it.
const isPhone = typeof DeviceMotionEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const MOTION_OK_KEY = 'whostarts.motionOk';
let shakeOn = isPhone && pref(SHAKE_KEY, '1') === '1';
let listening = false;
let lastMotion = null;
let shakeHits = [];
let lastShakePick = 0;
const needsMotionPermission = typeof DeviceMotionEvent !== 'undefined'
  && typeof DeviceMotionEvent.requestPermission === 'function';

if (!isPhone) {
  $('shakeToggle').disabled = true;
  $('shakeHint').textContent = 'Only on phones';
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x === null) return;
  if (lastMotion) {
    const jolt = Math.abs(a.x - lastMotion.x) + Math.abs(a.y - lastMotion.y) + Math.abs(a.z - lastMotion.z);
    const now = Date.now();
    if (jolt > 24) {
      shakeHits = shakeHits.filter(t => now - t < 700);
      shakeHits.push(now);
      // two hard jolts close together count as a shake
      if (shakeHits.length >= 2 && now - lastShakePick > 1500) {
        shakeHits = [];
        lastShakePick = now;
        shakePick();
      }
    }
  }
  lastMotion = { x: a.x, y: a.y, z: a.z };
}

function shakePick() {
  if (!shakeOn || rolling || document.querySelector('dialog[open]')) return;
  const pick = $('pick');
  if (pick.disabled || pick.dataset.mode === 'reset') return;
  pick.click();
}

function listenForShakes() {
  if (listening) return;
  listening = true;
  addEventListener('devicemotion', onMotion);
}

// iPhone only lets a page read motion after the person taps something, so the
// permission request has to come from a tap.
async function enableShake() {
  if (!needsMotionPermission) { listenForShakes(); return true; }
  try {
    const answer = await DeviceMotionEvent.requestPermission();
    if (answer === 'granted') {
      setPref(MOTION_OK_KEY, '1');
      listenForShakes();
      return true;
    }
  } catch (e) {}
  return false;
}

// Motion was allowed in an earlier visit. The phone may still want one tap
// after a reload before it delivers motion, but there is nothing to ask again.
function motionAllowedBefore() {
  return pref(MOTION_OK_KEY, '0') === '1';
}

// The text in the card before a pick; it mentions shaking once that works.
function hintText() {
  const shaking = shakeOn && (listening || motionAllowedBefore());
  if (mode === 'coin') return shaking ? 'Tap Flip! or shake your phone' : 'Tap Flip! to toss the coin';
  if (mode === 'number') {
    const r = currentRange();
    if (!r) return 'Add a range, then tap Roll!';
    const lo = r.from.toLocaleString();
    const hi = r.to.toLocaleString();
    // same pattern as the other tabs: "Tap Roll! (or shake) to roll …"
    // a named range by its name only, in quotes so it reads as a name
    const what = r.name ? `“${r.name}”`
      : r.dice > 1 ? `${r.dice} dice, each ${lo} to ${hi}`
      : `a number from ${lo} to ${hi}`;
    return shaking ? `Tap Roll! or shake to roll ${what}` : `Tap Roll! to roll ${what}`;
  }
  if (!cur().items.length) return 'Add some options, then tap Pick!';
  return shaking ? 'Tap Pick! or shake your phone' : 'Tap Pick! to choose one';
}

// On iPhone, before motion has ever been allowed, a button under Pick! asks for
// it, with "No thanks" to switch shaking off and hide the question for good.
function renderShakeTip() {
  $('shakeAsk').hidden = !shakeOn || listening || motionAllowedBefore();
  if (result.classList.contains('hint')) result.textContent = hintText();
}

$('shakeNo').onclick = () => {
  shakeOn = false;
  setPref(SHAKE_KEY, '0');
  sfx.out();
  toast('Okay! You can turn it on later in ⚙️ Settings.');
  renderShakeTip();
};

$('shakeTip').onclick = async () => {
  if (await enableShake()) {
    sfx.in();
  } else {
    shakeOn = false;
    setPref(SHAKE_KEY, '0');
    toast('Motion access was not allowed. You can try again in ⚙️ Settings.');
  }
  renderShakeTip();
};

$('shakeToggle').onchange = async (e) => {
  if (e.target.checked) {
    const ok = await enableShake();
    if (!ok) {
      e.target.checked = false;
      toast('Motion access was not allowed');
      return;
    }
    shakeOn = true;
    sfx.in();
  } else {
    shakeOn = false;
    sfx.out();
  }
  setPref(SHAKE_KEY, shakeOn ? '1' : '0');
  renderShakeTip();
};

if (shakeOn) {
  if (!needsMotionPermission) {
    listenForShakes();
  } else if (motionAllowedBefore()) {
    // Allowed before: some phones turn it back on straight away, others need a
    // tap first, so try now and again on the first tap anywhere.
    DeviceMotionEvent.requestPermission()
      .then(answer => { if (answer === 'granted') { listenForShakes(); renderShakeTip(); } })
      .catch(() => {});
    document.addEventListener('click', async () => {
      if (shakeOn && !listening) { await enableShake(); renderShakeTip(); }
    }, { once: true, capture: true });
  }
}
renderShakeTip();

// ---------- Options in the current list ----------
function render() {
  document.body.classList.toggle('number-mode', mode === 'number');
  document.body.classList.toggle('coin-mode', mode === 'coin');
  for (const [id, m] of [['modeLists', 'lists'], ['modeNumber', 'number'], ['modeCoin', 'coin']]) {
    $(id).classList.toggle('on', mode === m);
    $(id).setAttribute('aria-selected', mode === m);
  }
  if (mode === 'coin') {
    $('headsCount').textContent = coinTally.heads.toLocaleString();
    $('tailsCount').textContent = coinTally.tails.toLocaleString();
    $('coinReset').hidden = !coinTally.heads && !coinTally.tails;
    $('pick').disabled = rolling;
    if (!coinAnim) drawCoin();
    if (result.classList.contains('hint')) result.textContent = hintText();
    syncAddress();
    return;
  }
  if (mode === 'number') {
    const r = currentRange();
    $('rangeOnceCard').hidden = !r;
    const pick = $('pick');
    if (r) {
      const label = `“${r.name || rangeText(r)}”`;
      const used = (r.used || []).length;
      [...$('dicePick').children].forEach(b => {
        b.classList.toggle('on', Number(b.dataset.n) === r.dice);
        b.setAttribute('aria-pressed', Number(b.dataset.n) === r.dice);
      });
      $('diceHint').textContent = r.dice > 1 ? `Rolls ${r.dice} dice and adds them up` : 'Rolls 1 die';
      $('rangeOnceToggle').checked = !!r.once;
      $('rangeOnceToggle').disabled = r.dice > 1;
      $('rangeOnceHint').textContent = r.dice > 1
        ? 'Works with one die'
        : r.once
          ? `Only for ${label}: ${used.toLocaleString()} of ${rangeSize(r).toLocaleString()} rolled. They sit out until you start over`
          : `Only affects ${label}, not your other ranges`;
    }
    // with "roll each number only once", the button turns into Start over
    // once every number has been rolled
    const exhausted = r && r.once && numbersLeft(r) === 0;
    if (exhausted && !rolling) {
      pick.dataset.mode = 'reset';
      pick.textContent = '↺ Start over';
    } else if (pick.dataset.mode === 'reset') {
      delete pick.dataset.mode;
      pick.textContent = 'Roll!';
    }
    pick.disabled = rolling || !ranges.length;
    if (result.classList.contains('hint')) result.textContent = hintText();
    renderRanges();
    renderHistory();
    if (r) showIdleDice(r);
    else for (const d of dice) d.canvas.hidden = true;
    fitNamePlaceholder();
    syncAddress();
    return;
  }
  const items = cur().items;
  const playing = items.filter(p => p.playing).length;
  $('onceToggle').checked = !!cur().once;
  $('onceHint').textContent = cur().once
    ? `Only in “${cur().name}”: picked options sit out until you start over`
    : `Only affects “${cur().name}”, not your other lists`;

  // With "pick each only once", the button turns into Start over once
  // everything has been picked (or left out).
  const pick = $('pick');
  const exhausted = cur().once && items.length > 0 && playing === 0;
  if (exhausted && !rolling) {
    pick.dataset.mode = 'reset';
    pick.textContent = '↺ Start over';
  } else if (pick.dataset.mode === 'reset') {
    delete pick.dataset.mode;
    pick.textContent = 'Pick!';
  }
  pick.disabled = rolling || (playing === 0 && !exhausted);
  if (result.classList.contains('hint')) {
    result.textContent = hintText();
  }
  renderSets();
  renderHistory();
  fitNamePlaceholder();
  syncAddress();

  const lists = $('lists');
  lists.innerHTML = '';

  if (!items.length) {
    lists.innerHTML = '<div class="empty">Nothing here yet. Add people, places, food, movies, anything.</div>';
    return;
  }
  lists.append(list([...items].sort(byName)));
  freshIds = new Set();
  bounceId = null;
}

function changed() {
  save(); render();
}

function list(players) {
  const ul = document.createElement('ul');
  for (const p of players) {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.className = (p.playing ? 'in' : 'out')
      + (p.id === winnerId ? ' crowned' : '')
      + (freshIds.has(p.id) ? ' fresh' : '')
      + (p.id === bounceId ? ' bounce' : '');

    // The option being renamed: a field and Save instead of the usual row.
    if (p.id === editingOption) {
      const field = document.createElement('input');
      field.className = 'row-field';
      field.value = p.name;
      field.maxLength = 40;
      field.enterKeyHint = 'done';
      field.autocomplete = 'off';
      field.setAttribute('aria-label', `New name for ${p.name}`);
      const close = () => { stopEditing(); render(); };
      const saveName = (stay) => {
        if (editingOption !== p.id) return;
        const next = field.value.trim().replace(/\s+/g, ' ').slice(0, 40);
        const taken = next.toLowerCase() !== p.name.toLowerCase()
          && cur().items.some(x => x !== p && x.name.toLowerCase() === next.toLowerCase());
        const problem = !next ? 'An option needs a name. Use ✕ to remove it.'
          : taken ? `“${next}” is already in the list` : '';
        if (problem) {
          sfx.out();
          toast(problem);
          if (stay) { field.focus(); return; }
          close();
          return;
        }
        if (next !== p.name) { p.name = next; save(); sfx.in(); }
        close();
      };
      activeEditSave = () => saveName(false);
      makeEditRow(li, [field], [field], saveName, close);
      ul.append(li);
      continue;
    }

    // The whole row leaves the option in or out of the draw.
    const toggle = document.createElement('button');
    toggle.className = 'toggle';
    toggle.setAttribute('aria-pressed', p.playing);
    toggle.setAttribute('aria-label', p.playing ? `Leave ${p.name} out` : `Put ${p.name} back in`);
    toggle.innerHTML = '<span class="dot"></span><span class="label"></span>';
    toggle.querySelector('.label').textContent = p.name;
    toggle.onclick = () => {
      if (rolling) return;
      p.playing = !p.playing;
      delete p.picked;
      p.playing ? sfx.in() : sfx.out();
      bounceId = p.id;
      changed();
    };

    const edit = editButton(`Rename ${p.name}`, () => { editingOption = p.id; });

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Delete ${p.name}`);
    confirmDelete(del, () => {
      if (rolling || li.classList.contains('leaving')) return;
      sfx.del();
      li.classList.add('leaving');
      setTimeout(() => {
        const set = cur();
        const index = set.items.indexOf(p);
        if (index < 0) return;
        set.items.splice(index, 1);
        if (winnerId === p.id) winnerId = null;
        changed();
      }, reducedMotion ? 0 : 250);
    });

    li.append(toggle);
    if (p.id === winnerId) {
      const crown = document.createElement('span');
      crown.className = 'crown-mark';
      crown.textContent = '👑';
      crown.setAttribute('aria-hidden', 'true');
      li.append(crown);
    }
    li.append(edit, del);
    ul.append(li);
  }
  return ul;
}

// Several options can be added at once, separated by commas, semicolons or new lines.
$('add').onsubmit = (e) => {
  e.preventDefault();
  const input = $('name');
  const names = input.value.split(/[,;\n]+/)
    .map(n => n.trim().replace(/\s+/g, ' ').slice(0, 40))
    .filter(Boolean);
  if (!names.length) return;
  const items = cur().items;
  let added = 0;
  for (const name of names) {
    const existing = items.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.playing = true;
      bounceId = existing.id;
    } else {
      const id = newId();
      items.push({ id, name, playing: true });
      freshIds.add(id);
      added++;
    }
  }
  if (added > 1) sfx.addMany(added);
  else if (added === 1) sfx.add();
  else sfx.in();
  if (added > 1) toast(`Added ${added} options`);
  input.value = '';
  updateAddBtn();
  changed();
};

// Add stays greyed out until something has been typed.
function updateAddBtn() {
  $('addBtn').disabled = !$('name').value.trim();
}
$('name').addEventListener('input', updateAddBtn);

// A pasted list with one option per line becomes "a, b, c" in the one-line field.
$('name').addEventListener('paste', (e) => {
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!/\n/.test(text)) return;
  e.preventDefault();
  const input = e.target;
  const joined = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(', ');
  input.setRangeText(joined, input.selectionStart, input.selectionEnd, 'end');
  updateAddBtn();
});

// ---------- Recent picks ----------
const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 45 || !rtf) return 'just now';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

let historyExpanded = false;

// Lists show the recent picks of the current list; Dice shows the recent rolls.
function renderHistory() {
  const h = mode === 'number' ? rolls : cur().history;
  $('history').querySelector('summary').textContent = mode === 'number' ? '🕘 Recent rolls' : '🕘 Recent picks';
  $('history').hidden = !h.length;
  const more = $('moreHistory');
  more.hidden = h.length <= HISTORY_SHOWN;
  more.textContent = historyExpanded ? 'Show less' : `Show all ${h.length}`;
  const ul = $('historyList');
  ul.innerHTML = '';
  for (const entry of h.slice(0, historyExpanded ? MAX_HISTORY : HISTORY_SHOWN)) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="h-name"></span><span class="h-time"></span>';
    const name = li.querySelector('.h-name');
    if (entry.value !== undefined) {
      // a roll: the result in a small gold badge, then what was rolled in grey
      const badge = document.createElement('b');
      badge.className = 'h-result';
      badge.textContent = entry.value;
      const from = document.createElement('span');
      from.className = 'h-from';
      from.textContent = entry.parts ? `${entry.from}: ${entry.parts}` : entry.from;
      name.append(badge, from);
    } else {
      name.textContent = entry.name;
    }
    li.querySelector('.h-time').textContent = ago(entry.at);
    ul.append(li);
  }
}

$('moreHistory').onclick = () => {
  historyExpanded = !historyExpanded;
  sfx.click();
  renderHistory();
};

$('clearHistory').onclick = () => {
  if (mode === 'number') {
    if (!confirm('Clear the recent rolls?')) return;
    rolls = [];
    saveRolls();
  } else {
    if (!confirm(`Clear the recent picks for “${cur().name}”?`)) return;
    cur().history = [];
    save();
  }
  sfx.del();
  render();
};
$('history').addEventListener('toggle', () => { if ($('history').open) renderHistory(); });

// ---------- Spin time ----------
// A spin is 26 ticks that slow down; the pauses add up to about 3 seconds.
// The setting (0–3 s, see Settings) scales those pauses; 0 lands straight away.
const SPIN_TICKS = 26;
const spinPause = (progress) => 45 + 330 * progress ** 3;
const BASE_SPIN_MS = Array.from({ length: SPIN_TICKS - 1 }, (_, i) => spinPause((i + 1) / SPIN_TICKS)).reduce((a, b) => a + b, 0);
const MAX_SPIN_SECONDS = 3;
let spinSeconds = Math.min(MAX_SPIN_SECONDS, Math.max(0, Number(pref(SPIN_KEY, String(MAX_SPIN_SECONDS))) || 0));

function spinTicks(canSpin) {
  return canSpin && !reducedMotion && spinSeconds > 0 ? SPIN_TICKS : 1;
}
function spinDelay(progress) {
  return spinPause(progress) * (spinSeconds * 1000) / BASE_SPIN_MS;
}

// ---------- Picking ----------
// Says the result to screen readers, once it has landed.
function announce(text) {
  $('announce').textContent = '';
  setTimeout(() => { $('announce').textContent = text; }, 50); // a change, even when it's the same as last time
}

function showName(name) {
  result.className = '';
  void result.offsetWidth; // restart the flip animation
  result.className = 'flip' + (name.length > 14 ? ' long' : '');
  result.textContent = name;
}

$('onceToggle').onchange = (e) => {
  if (rolling) { e.target.checked = !!cur().once; return; }
  cur().once = e.target.checked;
  // switched off: the options it took out come back (the ones left out by
  // hand stay out), and if that leaves none to pick, they all come back
  if (!cur().once) {
    const items = cur().items;
    for (const p of items) if (p.picked) { p.playing = true; delete p.picked; }
    if (items.length && !items.some(p => p.playing)) items.forEach(p => p.playing = true);
  }
  cur().once ? sfx.in() : sfx.out();
  save(); render();
};

function startOver() {
  cur().items.forEach(p => { p.playing = true; delete p.picked; });
  resetCard();
  sfx.swap();
  changed();
}

// Tapping the picked name (Lists) or the coin or its result (Coin) goes again,
// like tapping Pick again or Flip again; not when the button says Start over.
const tapToGoAgain = () => {
  if (rolling || $('pick').disabled || $('pick').dataset.mode === 'reset') return;
  $('pick').click();
};
result.addEventListener('click', () => {
  if (mode !== 'number' && result.classList.contains('won')) tapToGoAgain();
});
document.querySelector('.coin-box').addEventListener('click', () => { if (mode === 'coin') tapToGoAgain(); });
// A quick swipe in any direction (over 25 px in under 0.7 s) on el calls go.
// Returns when the last swipe was, so a click that follows it can be ignored.
function onSwipe(el, go) {
  let start = null, last = -1e9;
  el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, at: e.timeStamp }; });
  el.addEventListener('pointercancel', () => { start = null; });
  el.addEventListener('pointerup', (e) => {
    const s = start;
    start = null;
    if (!s || e.timeStamp - s.at > 700 || Math.hypot(e.clientX - s.x, e.clientY - s.y) <= 25) return;
    last = e.timeStamp;
    go();
  });
  return () => last;
}
// swiping across the coin tosses it, across the dice rolls them all, and
// across the name (where the reel spins) in Lists picks
onSwipe(document.querySelector('.coin-box'), () => { if (mode === 'coin') tapToGoAgain(); });
onSwipe(document.querySelector('.stage'), () => { if (mode === 'lists') tapToGoAgain(); });
const lastDiceSwipe = onSwipe($('die'), () => { if (mode === 'number') tapToGoAgain(); });

// Picks one option uniformly at random from those in the draw, then plays the
// slot-machine spin that lands on it.
$('pick').onclick = () => {
  if (mode === 'coin') { flipCoin(); return; }
  if (mode === 'number') {
    if ($('pick').dataset.mode === 'reset') { startOverRange(); return; }
    rollNumber();
    return;
  }
  if ($('pick').dataset.mode === 'reset') { startOver(); return; }
  const playing = cur().items.filter(p => p.playing);
  if (!playing.length || rolling) return;
  const winner = playing[randomInt(playing.length)];

  rolling = true;
  winnerId = null;
  render();
  $('card').className = 'starter rolling';
  $('crown').className = '';
  $('pick').textContent = 'Picking…';
  spinReel(playing, winner);
};

// The reel: a strip of names in random order with the pick at the end, turning
// behind a window. Like the dice, it's planned before it starts: fast at first,
// slowing down (slowDown) so it stops with the pick exactly in the middle, a
// click for each name that passes (the list below stays still).
// The reel is a wheel: each spin shuffles the names into a new random order
// that repeats round and round, so every name shows once before any comes
// back. The pick (decided already, at random) only sets how far it turns.
try { localStorage.removeItem('whostarts.wheels'); } catch (e) {} // the saved orders of version 87

const REEL_ROW = 50;     // height of one name on the reel (see .reel-item)
const REEL_SPEED = 16;   // names per second at the start of a 3-second spin
function spinReel(playing, winner) {
  const total = spinTicks(playing.length > 1);
  const ms = rollLength(total);
  if (ms <= 0) { land(winner); return; }
  // how many names pass: slowDown starts 3 times faster than its average,
  // then nudged (by up to half a turn) so the wheel stops on the pick
  const order = playing.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const n = order.length;
  const base = Math.max(6, Math.round(REEL_SPEED * ms / 1000 / 3));
  let steps = base + ((order.indexOf(winner) - base) % n + n) % n;
  if (steps - base > n / 2 && steps - n >= 6) steps -= n;
  // the wheel from one name above the start to one name below the pick, so the window is never empty
  const names = Array.from({ length: steps + 3 }, (_, k) => order[(k - 1 + n) % n]);

  const strip = $('reelStrip');
  strip.innerHTML = '';
  for (const p of names) {
    const item = document.createElement('div');
    item.className = 'reel-item' + (p.name.length > 12 ? ' long' : '');
    item.append(document.createElement('span'));
    item.firstChild.textContent = p.name; // in a span, so the middle one can wear the badge
    strip.append(item);
  }
  // items[k + 1] is the k-th name to reach the middle (items[0] shows above the start)
  const items = [...strip.children].slice(1);
  result.className = ''; // the reel shows the names; the result appears when it stops
  result.textContent = '';
  $('reel').className = 'open';

  // the start name sits in the middle of the window, with the one before it above
  const at = (moved) => { strip.style.transform = `translateY(${-moved * REEL_ROW}px)`; };
  at(0);
  for (let k = 1; k <= steps; k++) {
    const x = 1 - (1 - k / steps) ** (1 / 3); // when name k reaches the middle
    sfx.reelClick(inSync(x * ms / 1000), 1 - 0.5 * x);
  }
  const start = performance.now();
  let lastRow = -1, lastMoved = 0, lastTime = start;
  let landed = false;
  const finish = () => {
    if (landed) return;
    landed = true;
    at(steps);
    strip.style.filter = '';
    // the pick's badge gives a little pop as it lands, then the reel folds away around it
    items[steps].firstChild.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' });
    setTimeout(() => {
      $('reel').className = 'done';
      land(winner);
    }, 220);
  };
  // the pick always lands when the time is up, even if a frame went wrong
  setTimeout(finish, ms + 400);
  (function frame(now) {
    if (landed) return;
    // a frame can be stamped a little before the spin started (phones do this
    // right after a tap), so never go below the start
    const x = Math.min(1, Math.max(0, (now - start) / ms));
    const moved = steps * slowDown(x);
    at(moved);
    // like a drum: names grow toward the middle and shrink and fade away from it
    for (let k = Math.floor(moved) - 2; k <= Math.ceil(moved) + 2; k++) {
      const item = items[k];
      if (!item) continue;
      const d = Math.min(1.5, Math.abs(k - moved));
      item.style.transform = `scale(${(1.12 - 0.2 * d).toFixed(3)})`;
      item.style.opacity = (1 - 0.35 * d).toFixed(2);
    }
    // blur while it's fast
    const speed = (moved - lastMoved) / Math.max(1, now - lastTime) * 1000;
    strip.style.filter = speed > 6 ? `blur(${Math.min(3, (speed - 6) / 4).toFixed(1)}px)` : '';
    lastMoved = moved;
    lastTime = now;
    const row = Math.min(items.length - 1, Math.max(0, Math.round(moved)));
    if (row !== lastRow) {
      if (items[lastRow]) items[lastRow].classList.remove('hot');
      items[row].classList.add('hot');
      lastRow = row;
      if (navigator.vibrate) navigator.vibrate(4);
    }
    if (x < 1) requestAnimationFrame(frame);
    else finish();
  })(start);
}

function land(winner) {
  rolling = false;
  winnerId = winner.id;
  cur().history.unshift({ name: winner.name, at: Date.now() });
  cur().history.length = Math.min(cur().history.length, MAX_HISTORY);
  if (cur().once) { winner.playing = false; winner.picked = true; }
  save();
  result.className = '';
  void result.offsetWidth;
  result.className = 'won' + (winner.name.length > 14 ? ' long' : '');
  result.textContent = winner.name;
  announce(`Picked ${winner.name}`);
  $('crown').className = 'show';
  $('card').className = 'starter winner';
  $('pick').textContent = 'Pick again';
  render();
  sfx.win();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
  const r = result.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2);
}

// Switching "roll each number only once" on or off starts the range fresh.
$('rangeOnceToggle').onchange = (e) => {
  const r = currentRange();
  if (!r || rolling) { e.target.checked = !!(r && r.once); return; }
  r.once = e.target.checked;
  r.used = [];
  saveRanges();
  r.once ? sfx.in() : sfx.out();
  resetCard();
  render();
};

function startOverRange() {
  const r = currentRange();
  if (!r) return;
  r.used = [];
  saveRanges();
  resetCard();
  sfx.swap();
  render();
}
