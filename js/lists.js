// ---------- Lists (sets) ----------
// The current list's name sits on one button; it opens a panel with every list,
// so any number of lists stays one tap away.
const sheet = $('listsDialog');
const dialog = $('setDialog');
let editId = null;       // list being edited in the list dialog, or null for a new one
let chosenEmoji = '📋';

function renderSets() {
  $('setLabel').textContent = cur().name;
  $('setEmoji').textContent = cur().emoji;
  if (sheet.open) renderSheet();
}

// In select mode, tapping rows ticks them and Delete removes them all at once.
let selecting = false;
let selected = new Set();

function renderSheet() {
  const ul = $('setList');
  ul.innerHTML = '';
  for (const s of state.sets) {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    const on = s.id === cur().id;
    li.className = (on && !selecting ? 'current' : '') + (selecting ? ' selecting' : '') + (selected.has(s.id) ? ' selected' : '');

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'set-pick';
    pick.innerHTML = '<span class="set-emoji"></span><span class="set-name"></span><span class="set-count"></span>';
    pick.querySelector('.set-emoji').textContent = s.emoji;
    pick.querySelector('.set-name').textContent = s.name;
    pick.querySelector('.set-count').textContent = s.items.length;
    if (selecting) {
      // the tick sits inside the button, so tapping anywhere on the row selects it
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.setAttribute('aria-hidden', 'true');
      pick.prepend(tick);
      pick.setAttribute('aria-pressed', selected.has(s.id));
      pick.onclick = () => {
        selected.has(s.id) ? selected.delete(s.id) : selected.add(s.id);
        sfx.click();
        renderSheet();
      };
      li.append(pick);
    } else {
      const handle = document.createElement('span');
      handle.className = 'drag';
      handle.textContent = '⠿';
      handle.setAttribute('aria-hidden', 'true');
      makeDraggable(handle, li);
      pick.onclick = () => {
        sheet.close();
        if (!on) switchTo(s.id);
      };
      li.append(handle, pick);
    }

    if (!selecting) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'set-edit';
      edit.textContent = '✎';
      edit.setAttribute('aria-label', `Edit, share or delete ${s.name}`);
      edit.onclick = () => openSetDialog(s.id);
      li.append(edit);
    }
    ul.append(li);
  }

  $('selectBtn').hidden = selecting || state.sets.length < 2;
  $('sheetNormal').hidden = selecting;
  $('sheetSelect').hidden = !selecting;
  const n = selected.size;
  const all = n > 0 && n >= state.sets.length;
  const del = $('deleteSelected');
  del.disabled = n === 0 || all;
  del.textContent = n ? `Delete ${n}` : 'Delete';
  $('sheetHint').textContent = !selecting ? 'Drag ⠿ to reorder.'
    : all ? 'Keep at least one list.'
    : 'Tap the lists you want to delete.';
}

function setSelecting(on) {
  selecting = on;
  selected = new Set();
  renderSheet();
}

$('selectBtn').onclick = () => { setSelecting(true); sfx.click(); };
$('selectCancel').onclick = () => setSelecting(false);

$('deleteSelected').onclick = () => {
  const doomed = state.sets.filter(s => selected.has(s.id));
  if (!doomed.length || doomed.length >= state.sets.length) return;
  const question = doomed.length === 1
    ? `Delete the list "${doomed[0].name}" and everything in it?`
    : `Delete these ${doomed.length} lists and everything in them?\n\n${doomed.map(s => `${s.emoji} ${s.name}`).join('\n')}`;
  if (!confirm(question)) return;
  state.sets = state.sets.filter(s => !selected.has(s.id));
  if (!state.sets.some(s => s.id === state.current)) {
    state.current = state.sets[0].id;
    resetCard();
  }
  sfx.del();
  selecting = false;
  selected = new Set();
  save(); render();
  toast(doomed.length === 1 ? `Deleted “${doomed[0].name}”` : `Deleted ${doomed.length} lists`);
};

// Drag a row by its ⠿ handle; it swaps places with a neighbour once it has
// moved past half of that neighbour's height.
function makeDraggable(handle, li) {
  let startY = 0;
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let dy = e.clientY - startY;
    const next = li.nextElementSibling;
    const prev = li.previousElementSibling;
    if (next && dy > next.offsetHeight / 2) {
      next.after(li);
      startY += next.offsetHeight;
      dy -= next.offsetHeight;
      sfx.click();
    } else if (prev && dy < -prev.offsetHeight / 2) {
      prev.before(li);
      startY -= prev.offsetHeight;
      dy += prev.offsetHeight;
      sfx.click();
    }
    li.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    li.style.transform = '';
    li.classList.remove('dragging');
    const order = [...$('setList').children].map(row => row.dataset.id);
    state.sets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    save();
    renderSets();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

$('setBtn').onclick = () => {
  if (rolling) return;
  selecting = false;
  selected = new Set();
  renderSheet();
  sheet.showModal();
  sfx.swap();
  sheet.querySelector('li.current')?.scrollIntoView({ block: 'nearest' });
};
$('sheetClose').onclick = () => sheet.close();
$('newList').onclick = () => openSetDialog(null);
closeOnBackdrop(sheet);
closeOnBackdrop(dialog);

function resetCard() {
  winnerId = null;
  lastRoll = null;
  $('reel').className = '';
  $('reelStrip').innerHTML = '';
  result.className = 'hint';
  $('crown').className = '';
  $('card').className = 'starter';
  $('pick').textContent = idleLabel();
  $('resultParts').hidden = true;
  $('rerollHint').hidden = true;
  delete $('pick').dataset.mode;
}

// ---------- Lists / Dice / Coin mode ----------
function idleLabel() {
  return mode === 'number' ? 'Roll!' : mode === 'coin' ? 'Flip!' : 'Pick!';
}
function setMode(next) {
  if (rolling || next === mode) return;
  stopEditing();
  mode = next;
  setPref(MODE_KEY, mode);
  resetCard();
  sfx.swap();
  render();
}
$('modeLists').onclick = () => setMode('lists');
$('modeNumber').onclick = () => setMode('number');
$('modeCoin').onclick = () => setMode('coin');

// ---------- Ranges (Dice mode) ----------
// Dice mode works like a list: one row per range, tap a row to roll it,
// ✎ gives it an optional name such as "d6", ✕ removes it.
const RANGES_KEY = 'whostarts.ranges';
// Common dice to start with. A range can roll up to 5 dice and add them up,
// like 2d6: two dice of 1–6 (so 7 comes up far more often than 2 or 12).
const DEFAULT_RANGES = [
  { from: 1, to: 4, name: 'd4' },
  { from: 1, to: 6, name: 'd6' },
  { from: 1, to: 12, name: 'd12' },
  { from: 1, to: 20, name: 'd20' },
  { from: 1, to: 6, name: '2d6', dice: 2 },
  { from: 1, to: 6, name: '5 dice', dice: 5 }, // for dice games where you keep some and reroll the rest
];
const MAX_DICE = 5;

function normalizeRanges(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter(r => r && Number.isInteger(r.from) && Number.isInteger(r.to))
    .map(r => {
      // the first 2d6 was a plain 2–12 range, where every total was equally likely
      if (r.name === '2d6' && r.from === 2 && r.to === 12 && !r.dice) r = { ...r, from: 1, to: 6, dice: 2, used: [] };
      const from = Math.min(r.from, r.to);
      const to = Math.max(r.from, r.to);
      const dice = Number.isInteger(r.dice) ? Math.min(MAX_DICE, Math.max(1, r.dice)) : 1;
      return {
        from,
        to,
        name: typeof r.name === 'string' ? r.name.trim().slice(0, 20) : '',
        dice,
        // "roll each number only once" (one die only): the numbers rolled so far sit out
        once: dice === 1 && !!r.once,
        used: dice > 1 ? [] : [...new Set(Array.isArray(r.used) ? r.used : [])].filter(n => Number.isInteger(n) && n >= from && n <= to),
      };
    });
}

function rangeSize(r) {
  return r.to - r.from + 1;
}

function numbersLeft(r) {
  return rangeSize(r) - (r.used || []).length;
}

let ranges = (() => {
  try { return normalizeRanges(JSON.parse(pref(RANGES_KEY, 'null'))) || normalizeRanges(DEFAULT_RANGES); } catch (e) { return normalizeRanges(DEFAULT_RANGES); }
})();
let freshRange = null;   // row that was just added
// "5 dice" came later: ranges saved before it get it added once (and if it's
// removed, it stays removed)
const FIVE_DICE_KEY = 'whostarts.fiveDice';
if (pref(FIVE_DICE_KEY, '0') !== '1') {
  if (!ranges.some(r => r.from === 1 && r.to === 6 && r.dice === 5)) {
    ranges.push(...normalizeRanges(DEFAULT_RANGES.filter(r => r.dice === 5)));
    saveRanges();
  }
  setPref(FIVE_DICE_KEY, '1');
}

function saveRanges() {
  setPref(RANGES_KEY, JSON.stringify(ranges));
}

function sameRange(a, b) {
  return Math.min(a.from, a.to) === Math.min(b.from, b.to) && Math.max(a.from, a.to) === Math.max(b.from, b.to)
    && (a.dice || 1) === (b.dice || 1);
}

// "1 to 6", or "2 dice, each 1 to 6": words, so it can't be read as a sum
function rangeText(r) {
  const span = `${Math.min(r.from, r.to).toLocaleString()} to ${Math.max(r.from, r.to).toLocaleString()}`;
  return (r.dice || 1) > 1 ? `${r.dice} dice, each ${span}` : span;
}

// The range Roll! uses; falls back to the first row if the chosen one is gone.
function currentRange() {
  return ranges.find(r => sameRange(r, numbers)) || ranges[0] || null;
}

function selectRange(r) {
  numbers = { from: r.from, to: r.to, dice: r.dice };
  setPref(NUM_KEY, JSON.stringify(numbers));
}

// ---------- Editing a row ----------
// Each row has a ✎. Tapping it opens just that row: its fields and a Save button.
// Enter or Save saves, Esc cancels, and tapping somewhere else saves too (or
// drops changes that can't be saved, with a message).
let editingOption = null;   // id of the option being renamed
let editingRange = null;    // the range being changed
let activeEditSave = null;  // saves the open row before another one opens

function stopEditing() {
  editingOption = null;
  editingRange = null;
  activeEditSave = null;
}

function editButton(label, start) {
  const b = document.createElement('button');
  b.className = 'row-edit';
  b.textContent = '✎';
  b.setAttribute('aria-label', label);
  // keeps focus where it is, so an open row is saved by this tap, not by a blur
  b.addEventListener('pointerdown', (e) => e.preventDefault());
  b.onclick = () => {
    if (rolling) return;
    if (activeEditSave) activeEditSave();
    stopEditing();
    start();
    sfx.click();
    render();
    const field = document.querySelector('li.editing input');
    if (field) { field.focus(); field.select(); }
  };
  return b;
}

function makeEditRow(li, nodes, fields, saveRow, cancel) {
  li.classList.add('editing');
  const ok = document.createElement('button');
  ok.className = 'row-ok';
  ok.textContent = 'Save';
  ok.addEventListener('pointerdown', (e) => e.preventDefault());
  ok.onclick = () => saveRow(true);
  for (const f of fields) {
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveRow(true); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }
  li.addEventListener('focusout', (e) => {
    if (!li.contains(e.relatedTarget)) saveRow(false);
  });
  li.append(...nodes, ok);
}

function renderRanges() {
  const box = $('rangeList');
  box.innerHTML = '';
  if (!ranges.length) {
    box.innerHTML = '<div class="empty">No ranges yet. Add one above, like 1 to 6.</div>';
    return;
  }
  const selected = currentRange();
  const ul = document.createElement('ul');
  for (const r of ranges) {
    const li = document.createElement('li');
    li.className = (r === selected ? 'in current-range' : '') + (r === freshRange ? ' fresh' : '');

    // The range being changed: From, To and name fields and Save.
    if (r === editingRange) {
      const numberField = (value, label) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.step = '1';
        input.className = 'row-field num';
        input.value = value;
        input.setAttribute('aria-label', label);
        return input;
      };
      const fromField = numberField(r.from, 'From');
      const toField = numberField(r.to, 'To');
      const dash = document.createElement('span');
      dash.className = 'range-dash';
      dash.textContent = '–';
      const nameField = document.createElement('input');
      nameField.className = 'row-field';
      nameField.value = r.name;
      nameField.placeholder = 'Name';
      nameField.maxLength = 20;
      nameField.enterKeyHint = 'done';
      nameField.autocomplete = 'off';
      nameField.setAttribute('aria-label', 'Name (optional)');

      const close = () => { stopEditing(); render(); };
      // Keeps the numbers in order and never duplicates another range.
      const saveRow = (stay) => {
        if (editingRange !== r) return;
        const a = Number(fromField.value);
        const b = Number(toField.value);
        const whole = fromField.value !== '' && toField.value !== '' && Number.isInteger(a) && Number.isInteger(b);
        const next = { from: Math.min(a, b), to: Math.max(a, b), dice: r.dice };
        const problem = !whole ? 'Enter whole numbers'
          : next.to - next.from >= 2 ** 32 ? 'That range is too big'
          : ranges.some(x => x !== r && sameRange(x, next)) ? `You already have ${rangeText(next)}` : '';
        if (problem) {
          sfx.out();
          toast(problem);
          if (stay) { fromField.focus(); return; }
          close();
          return;
        }
        const name = nameField.value.trim().replace(/\s+/g, ' ').slice(0, 20);
        if (next.from !== r.from || next.to !== r.to || name !== r.name) {
          const wasCurrent = r === currentRange();
          r.from = next.from;
          r.to = next.to;
          r.name = name;
          r.used = (r.used || []).filter(n => n >= r.from && n <= r.to);
          saveRanges();
          if (wasCurrent) selectRange(r);
          sfx.in();
        }
        resetCard();
        close();
      };
      activeEditSave = () => saveRow(false);
      makeEditRow(li, [fromField, dash, toField, nameField], [fromField, toField, nameField], saveRow, close);
      ul.append(li);
      continue;
    }

    // The whole row chooses the range, shown as "d6  1 to 6" or "1 to 6".
    const row = document.createElement('button');
    row.className = 'toggle';
    row.setAttribute('aria-pressed', r === selected);
    row.innerHTML = '<span class="dot"></span><span class="label"></span>';
    const label = row.querySelector('.label');
    if (r.name) {
      const b = document.createElement('b');
      b.textContent = r.name;
      const small = document.createElement('small');
      small.textContent = rangeText(r);
      label.append(b, small);
    } else {
      label.textContent = rangeText(r);
    }
    row.onclick = () => {
      if (rolling || r === selected) return;
      selectRange(r);
      sfx.in();
      resetCard();
      render();
    };

    const edit = editButton(`Change ${r.name || rangeText(r)}`, () => { editingRange = r; });

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Remove ${r.name || rangeText(r)}`);
    confirmDelete(del, () => {
      if (rolling || li.classList.contains('leaving')) return;
      sfx.del();
      li.classList.add('leaving');
      setTimeout(() => {
        const wasSelected = r === currentRange();
        ranges = ranges.filter(x => x !== r);
        saveRanges();
        if (wasSelected && ranges.length) selectRange(ranges[0]);
        resetCard();
        render();
      }, reducedMotion ? 0 : 250);
    });

    li.append(row, edit, del);
    ul.append(li);
  }
  box.append(ul);
  freshRange = null;
}

// ---------- Adding a range ----------
// From and To are required, the name is optional; Add stays greyed out until
// both numbers are whole numbers.
function readNewRange() {
  const fromText = $('numFrom').value;
  const toText = $('numTo').value;
  const a = Number(fromText);
  const b = Number(toText);
  if (fromText === '' || toText === '' || !Number.isInteger(a) || !Number.isInteger(b)) return null;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

function updateAddRange() {
  $('addRangeBtn').disabled = !readNewRange();
}
for (const id of ['numFrom', 'numTo', 'numName']) $(id).addEventListener('input', updateAddRange);

// The add row stays on one line; when "Name (optional)" would be cut off
// (narrow phone, large text), the placeholder shortens to "Name".
const measureCtx = document.createElement('canvas').getContext('2d');
// Each field gets the longest of its placeholders that fits (the last one always does).
function fitPlaceholder(field, texts) {
  if (!field.clientWidth) return; // hidden in the other mode
  const style = getComputedStyle(field);
  measureCtx.font = `${style.fontSize} ${style.fontFamily}`;
  const room = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  field.placeholder = texts.find(t => measureCtx.measureText(t).width <= room) || texts.at(-1);
}
function fitNamePlaceholder() {
  fitPlaceholder($('numName'), ['Name (optional)', 'Name']);
  fitPlaceholder($('name'), ['Add options, e.g. Sam, Ben, Pizza, Burger', 'Add options, e.g. Sam, Ben, Pizza', 'Add options, e.g. Sam, Ben']);
}
addEventListener('resize', fitNamePlaceholder);
// Enter in From moves on to To
$('numFrom').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('numTo').focus(); }
});

$('addRange').onsubmit = (e) => {
  e.preventDefault();
  const n = readNewRange();
  if (!n) return;
  // randomInt works with 32-bit numbers, which covers any range people type
  if (n.to - n.from >= 2 ** 32) { sfx.out(); toast('That range is too big'); return; }
  const r = { ...n, name: $('numName').value.trim().replace(/\s+/g, ' ').slice(0, 20), dice: 1, once: false, used: [] };
  const existing = ranges.find(x => sameRange(x, r));
  if (existing) {
    selectRange(existing);
    sfx.in();
    toast(`You already have ${rangeText(r)}`);
  } else {
    ranges.push(r);
    saveRanges();
    selectRange(r);
    freshRange = r;
    sfx.add();
  }
  $('numFrom').value = '';
  $('numTo').value = '';
  $('numName').value = '';
  updateAddRange();
  document.activeElement?.blur?.();
  resetCard();
  render();
};

function switchTo(id) {
  stopEditing();
  state.current = id;
  resetCard();
  sfx.swap();
  save(); render();
}

function renderEmojiPicker() {
  const box = $('emojiPicker');
  box.innerHTML = '';
  // an emoji typed from the keyboard shows up first, selected
  const choices = EMOJIS.includes(chosenEmoji) ? EMOJIS : [chosenEmoji, ...EMOJIS];
  for (const e of choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.className = e === chosenEmoji ? 'on' : '';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', e === chosenEmoji);
    b.onclick = () => { chosenEmoji = e; sfx.click(); renderEmojiPicker(); };
    box.append(b);
  }
}

function openSetDialog(id) {
  editId = id;
  const set = state.sets.find(s => s.id === id);
  $('setTitle').textContent = set ? 'Edit list' : 'New list';
  $('setName').value = set ? set.name : '';
  $('setSave').textContent = set ? 'Save' : 'Create';
  $('setDelete').hidden = !set;
  $('setShare').hidden = !set;
  $('setLink').hidden = !set;
  $('setLinkHint').hidden = !set;
  // "Share" sends the list's contents to someone; the address opens your own copy
  if (set) $('setLinkHint').textContent = `Opens “${set.name}” straight away on this phone: …/randomizer/#${set.slug}`;
  $('setDelete').disabled = state.sets.length < 2;
  chosenEmoji = set ? set.emoji : '📋';
  $('emojiInput').value = '';
  renderEmojiPicker();
  dialog.showModal();
  // showModal focuses the name field, which pops up the keyboard; when editing,
  // move focus to the dialog itself so the keyboard only opens on a tap
  if (set) dialog.focus();
  else $('setName').focus();
}

$('setForm').onsubmit = (e) => {
  e.preventDefault();
  const name = $('setName').value.trim().replace(/\s+/g, ' ');
  if (!name) { $('setName').focus(); return; }
  const set = state.sets.find(s => s.id === editId);
  if (set) {
    if (slugify(name) !== slugify(set.name)) {
      // new address for the new name; the old one keeps working as an alias
      const next = uniqueSlug(name, set);
      set.aliases = [set.slug, ...set.aliases.filter(a => a !== set.slug && a !== next)].slice(0, 10);
      set.slug = next;
    }
    set.name = name;
    set.emoji = chosenEmoji;
    sfx.in();
  } else {
    const fresh = normalizeSet({ name, emoji: chosenEmoji });
    state.sets.push(fresh);
    ensureSlugs();
    state.current = fresh.id;
    resetCard();
    sheet.close();
    sfx.add();
  }
  dialog.close();
  save(); render();
};

$('setCancel').onclick = () => dialog.close();

// Any emoji (or character) typed here becomes the icon; only the first one counts.
$('emojiInput').addEventListener('input', (e) => {
  const g = firstGrapheme(e.target.value);
  if (!g) return;
  e.target.value = g;
  chosenEmoji = g;
  sfx.click();
  renderEmojiPicker();
});
// Enter in the emoji field saves the list instead of doing nothing
$('emojiInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('setForm').requestSubmit(); }
});

$('setDelete').onclick = () => {
  const set = state.sets.find(s => s.id === editId);
  if (!set || state.sets.length < 2) return;
  if (!confirm(`Delete the list "${set.name}" and everything in it?`)) return;
  state.sets = state.sets.filter(s => s.id !== set.id);
  if (state.current === set.id) {
    state.current = state.sets[0].id;
    resetCard();
  }
  sfx.del();
  dialog.close();
  save(); render();
};

// ---------- Sharing a list by link ----------
// The list travels inside the link itself (after #list=), so nothing is uploaded.
function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShare(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

$('setShare').onclick = async () => {
  const set = state.sets.find(s => s.id === editId);
  if (!set) return;
  const code = encodeShare({ n: set.name, e: set.emoji, o: set.once ? 1 : 0, i: set.items.map(p => p.name) });
  const url = `${location.origin}${location.pathname}#list=${code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `Randomizer: ${set.name}`, text: `${set.emoji} ${set.name} for Randomizer`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    sfx.add();
    toast('Link copied. Send it to anyone!');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    prompt('Copy this link to share the list:', url);
  }
};

let pendingImport = null;
const importDialog = $('importDialog');
closeOnBackdrop(importDialog);

function checkSharedLink() {
  const m = location.hash.match(/^#list=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const d = decodeShare(m[1]);
    if (!d || typeof d.n !== 'string' || !Array.isArray(d.i)) throw new Error('bad link');
    pendingImport = normalizeSet({ name: d.n, emoji: d.e, once: !!d.o, items: d.i.map(name => ({ name })) });
  } catch (e) {
    toast('That share link looks broken');
    return;
  }
  $('importText').textContent = `${pendingImport.emoji} ${pendingImport.name}, with ${pendingImport.items.length} option${pendingImport.items.length === 1 ? '' : 's'}:`;
  const ul = $('importList');
  ul.innerHTML = '';
  for (const p of pendingImport.items) {
    const li = document.createElement('li');
    li.textContent = p.name;
    ul.append(li);
  }
  ul.hidden = !pendingImport.items.length;
  importDialog.showModal();
}

function uniqueName(name) {
  const taken = new Set(state.sets.map(s => s.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

$('importAdd').onclick = () => {
  if (!pendingImport) return;
  pendingImport.name = uniqueName(pendingImport.name);
  state.sets.push(pendingImport);
  ensureSlugs();
  state.current = pendingImport.id;
  pendingImport = null;
  importDialog.close();
  resetCard();
  sfx.add();
  save(); render();
  toast('List added!');
};
$('importCancel').onclick = () => { pendingImport = null; importDialog.close(); };

// Opens the list named in the address (#game-night). Returns true when it switched.
function openFromAddress() {
  if (['#dice', '#number', '#coin'].includes(location.hash)) {
    const next = location.hash === '#coin' ? 'coin' : 'number';
    if (mode === next) return false;
    mode = next;
    setPref(MODE_KEY, mode);
    resetCard();
    return true;
  }
  const m = location.hash.match(/^#([a-z0-9-]+)$/);
  if (!m) return false;
  const set = state.sets.find(s => s.slug === m[1] || s.aliases.includes(m[1]));
  if (!set) {
    toast('That list isn’t on this phone');
    return false;
  }
  // a list's address always shows the list, even if Dice or Coin was open
  if (mode !== 'lists') { mode = 'lists'; setPref(MODE_KEY, mode); resetCard(); }
  if (set.id === state.current) return false;
  state.current = set.id;
  resetCard();
  save();
  return true;
}

// Keeps the address bar on the current list, so it can be copied or bookmarked.
function syncAddress() {
  if (location.hash.startsWith('#list=')) return;
  const want = mode === 'lists' ? '#' + cur().slug : mode === 'number' ? '#dice' : '#coin';
  if (location.hash !== want) history.replaceState(history.state, '', location.pathname + location.search + want); // keeps focus mode's entry
}

addEventListener('hashchange', () => {
  if (location.hash.startsWith('#list=')) { checkSharedLink(); return; }
  if (rolling) return;
  if (openFromAddress()) sfx.swap();
  render();
});

$('setLink').onclick = async () => {
  const set = state.sets.find(s => s.id === editId);
  if (!set) return;
  const url = addressOf(set);
  try {
    await navigator.clipboard.writeText(url);
    sfx.add();
    toast('Address copied');
  } catch (e) {
    prompt('This list’s address:', url);
  }
};

