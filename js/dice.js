// ---------- The 3D dice ----------
// Real dice shapes, drawn on a canvas by a tiny 3D renderer (no libraries).
// Each shape is only its corner points; its faces are worked out from them.
// A range uses a real die when its size divides the die's sides and its numbers
// fit on the faces (1–3 on a d6 shows each number twice, 1–5 on a d10).
// Anything else gets a purple "magic" d20 with twinkling symbols instead of numbers.
const PHI = (1 + Math.sqrt(5)) / 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / Math.hypot(...a));
// every sign combination of a point (zeros stay zero), and its cyclic rotations
const signs = (p) => p.reduce((list, c) => list.flatMap(q => c ? [[...q, c], [...q, -c]] : [[...q, 0]]), [[]]);
const cyclic = ([a, b, c]) => [[a, b, c], [b, c, a], [c, a, b]];

const DIE_POINTS = {
  4: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  6: signs([1, 1, 1]),
  8: cyclic([1, 0, 0]).flatMap(signs),
  // d10: a point at the top and bottom with a zigzag ring between them; this
  // ring height makes each of the ten kite-shaped faces perfectly flat
  10: [[0, 1, 0], [0, -1, 0], ...Array.from({ length: 10 }, (_, k) => {
    const h = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
    return [Math.cos(k * Math.PI / 5), k % 2 ? -h : h, Math.sin(k * Math.PI / 5)];
  })],
  12: [...signs([1, 1, 1]), ...cyclic([0, 1 / PHI, PHI]).flatMap(signs)],
  20: cyclic([0, 1, PHI]).flatMap(signs),
};

// The faces of a convex shape: every plane through three corners that has all
// other corners on one side. Each face gets its outward direction, its middle,
// an "up" direction for its number, and how much room the number has.
function makeShape(points) {
  // scaled as a whole (not point by point, which would bend the d10's kites) so the farthest corner is 1 away
  const far = Math.max(...points.map(p => Math.hypot(...p)));
  const v = points.map(p => mul(p, 1 / far));
  const faces = [];
  const seen = new Set();
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) {
    let n = cross(sub(v[j], v[i]), sub(v[k], v[i]));
    if (Math.hypot(...n) < 1e-9) continue;
    n = unit(n);
    const d = dot(n, v[i]);
    const on = [];
    let above = 0, below = 0;
    v.forEach((p, m) => {
      const s = dot(n, p) - d;
      if (s > 1e-6) above++; else if (s < -1e-6) below++; else on.push(m);
    });
    if ((above && below) || seen.has(on.join())) continue;
    seen.add(on.join());
    if (above) n = mul(n, -1);
    const c = mul(on.reduce((s, m) => add(s, v[m]), [0, 0, 0]), 1 / on.length);
    const a = unit(sub(v[on[0]], c)), b = cross(n, a);
    const angle = (m) => Math.atan2(dot(sub(v[m], c), b), dot(sub(v[m], c), a));
    on.sort((p, q) => angle(p) - angle(q));
    const pts = on.map(m => v[m]);
    const mids = pts.map((p, t) => mul(add(p, pts[(t + 1) % pts.length]), 0.5));
    const dist = pts.map(p => Math.hypot(...sub(p, c)));
    const square = pts.length === 4 && Math.max(...dist) - Math.min(...dist) < 1e-6;
    // numbers point at a corner (at the edge's middle on a square, like a d6)
    const toward = square ? mids[0] : pts[dist.indexOf(Math.max(...dist))];
    const up = unit(sub(toward, c));
    faces.push({ idx: on, n, c, up, right: cross(up, n), room: Math.min(...mids.map(q => Math.hypot(...sub(q, c)))) });
  }
  // Numbering: opposite faces add up to sides + 1, like real dice.
  const done = new Set();
  let next = 1;
  faces.forEach((f, i) => {
    if (done.has(i)) return;
    done.add(i);
    f.num = next++;
    const j = faces.findIndex((g, gi) => !done.has(gi) && dot(g.n, f.n) < -0.999);
    if (j >= 0) { done.add(j); faces[j].num = faces.length + 1 - f.num; }
  });
  return { v, faces };
}
const SHAPES = Object.fromEntries(Object.entries(DIE_POINTS).map(([sides, pts]) => [sides, makeShape(pts)]));

// Which die a range rolls. Small triangles fit 2 characters, the bigger faces 3.
const REAL_DICE = [4, 6, 8, 10, 12, 20];
const FACE_ROOM = { 4: 2, 6: 3, 8: 2, 10: 3, 12: 3, 20: 2 };
// Anything no real die can roll (1 to 100 too) gets the magic die.
function dieFor(range) {
  const size = range.to - range.from + 1;
  const width = Math.max(String(range.from).length, String(range.to).length);
  const sides = REAL_DICE.find(s => s % size === 0 && width <= FACE_ROOM[s]);
  if (!sides) return { sides: 20, magic: true, pips: false };
  return { sides, magic: false, pips: sides === 6 && range.from === 1 && range.to === 6 };
}

// The face labels the shown dice land on for these values (one per die).
const faceLabels = (range, values) => values.map(String);
const MAGIC_SYMBOLS = ['✦', '✧', '✶', '✷', '✸', '✹', '✺', '✩', '✪', '★', '☆', '❂'];
const magicSymbol = () => MAGIC_SYMBOLS[randomInt(MAGIC_SYMBOLS.length)];

// ----- rotations (quaternions [w, x, y, z]) -----
const qMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qAxis = (axis, angle) => { const s = Math.sin(angle / 2); return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s]; };
function qFromTo(a, b) {
  const axis = cross(a, b);
  if (Math.hypot(...axis) < 1e-9) return dot(a, b) > 0 ? [1, 0, 0, 0] : qAxis(Math.abs(a[0]) < 0.9 ? unit(cross(a, [1, 0, 0])) : unit(cross(a, [0, 1, 0])), Math.PI);
  return qAxis(unit(axis), Math.acos(Math.max(-1, Math.min(1, dot(a, b)))));
}
function qMatrix([w, x, y, z]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}
function qFromMatrix(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; return [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]; }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; return [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]; }
  if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; return [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s]; }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
  return [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
}
const turn = (m, p) => [dot(m[0], p), dot(m[1], p), dot(m[2], p)];

// Resting pose showing a face: the face straight toward you, its number upright.
function restPose(face) {
  return qFromMatrix([face.right, face.up, face.n]);
}

// ----- the dice on screen -----
const dice = Array.from({ length: MAX_DICE }, () => {
  const canvas = document.createElement('canvas');
  $('die').append(canvas);
  return { canvas, ctx: canvas.getContext('2d'), key: '' };
});
let diceAnim = null; // true while any die is rolling
const TURN_MS = 600;  // how long one full turn takes at the start of a roll
// How far through its turning a die is (0–1) at a point of the roll (0–1):
// fast at first, slowing to a stop exactly at the end.
const slowDown = (x) => 1 - (1 - x) ** 3;

// Gives the shown dice the range's shape and numbers; keeps where they rest
// unless the range changed.
function setupDice(range) {
  const look = dieFor(range);
  const size = range.to - range.from + 1;
  const count = range.dice;
  // smaller with more dice, and never wider together than the space there is
  // (narrow phones, or a phone with its display zoom turned up)
  const room = ($('die').clientWidth || 300) - 4 * (count - 1);
  const cssSize = Math.min(count > 4 ? 58 : count > 3 ? 74 : count > 2 ? 100 : 112, Math.floor(room / count));
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  dice.forEach((d, i) => {
    d.canvas.hidden = i >= count;
    if (d.canvas.hidden) return;
    const px = Math.round(cssSize * dpr);
    // both sides: a new canvas is 300 × 150, so 3 dice at 3× (300 px) matched its width only
    if (d.canvas.width !== px || d.canvas.height !== px) d.canvas.width = d.canvas.height = px;
    d.canvas.style.width = d.canvas.style.height = `${cssSize}px`;
    const key = `${look.sides}:${look.magic}:${range.from}:${range.to}`;
    if (d.key === key) return;
    d.key = key;
    Object.assign(d, look, { shape: SHAPES[look.sides], target: null, ms: 0 });
    d.labels = d.shape.faces.map(f => look.magic ? magicSymbol() : String(range.from + (f.num - 1) % size));
    // at rest it shows a face straight on (a real die its highest number)
    const top = d.shape.faces.reduce((a, f) => f.num > a.num ? f : a);
    d.q = restPose(top);
  });
}

function showIdleDice(range) {
  if (diceAnim) return;
  setupDice(range);
  drawDice();
  keepSparkling();
}

// A magic die's sparkles keep twinkling while it's on screen, not only while
// it rolls: a light redraw (about 30 times a second) that stops by itself when
// the die is gone, another tab is shown or the app is in the background.
var sparkling = false; // var: render (and so this) may run before this line
function keepSparkling() {
  if (sparkling) return;
  sparkling = true;
  let last = 0;
  requestAnimationFrame(function twinkle(now) {
    if (mode !== 'number' || document.hidden || !dice.some(d => !d.canvas.hidden && d.magic)) { sparkling = false; return; }
    if (!diceAnim && now - last > 33) { last = now; drawDice(now); } // while rolling, diceFrame draws
    requestAnimationFrame(twinkle);
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepSparkling(); });
// the dice fit the screen again after it changes size (turning the phone)
addEventListener('resize', () => { if (mode === 'number' && currentRange()) showIdleDice(currentRange()); });

function drawDice(now = performance.now()) {
  for (const d of dice) if (!d.canvas.hidden && d.shape) drawDie(d, now);
}

const LIGHT = unit([-0.45, 0.65, 0.6]);
// pips for 1–6 on a d6, at spots of a 3×3 grid (in parts of the face's half size)
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

function drawDie(d, now) {
  const { ctx, canvas, shape } = d;
  const W = canvas.width;
  const R = qMatrix(d.q);
  const scale = W * 0.46, D = 5, mid = W / 2; // fills the canvas; corners reach at most 0.94 of the way to its edge as it turns
  const proj = (w) => { const f = D / (D - w[2]); return [mid + w[0] * scale * f, mid - w[1] * scale * f]; };
  const corners = shape.v.map(p => proj(turn(R, p)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, W);
  const hasSixAndNine = d.labels.includes('6') && d.labels.includes('9');
  shape.faces.forEach((f, fi) => {
    const n = turn(R, f.n), c = turn(R, f.c);
    if (dot(n, sub([0, 0, D], c)) <= 0) return; // facing away
    const lit = 0.55 + 0.45 * Math.max(0, dot(n, LIGHT));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    f.idx.forEach((m, t) => (t ? ctx.lineTo : ctx.moveTo).call(ctx, ...corners[m]));
    ctx.closePath();
    if (d.magic) {
      ctx.fillStyle = `rgb(${40 + 120 * lit}, ${14 + 92 * lit}, ${100 + 150 * lit})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(226, 206, 255, .75)';
    } else {
      const g = Math.round(150 + 105 * lit);
      ctx.fillStyle = `rgb(${g}, ${g}, ${Math.round(g * 0.985)})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, .22)';
    }
    ctx.lineWidth = W / 110;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // the face's own flat directions on screen (right and up), per unit of size
    const at = proj(c);
    const e = 0.05;
    const r = proj(add(c, mul(turn(R, f.right), e))), u = proj(add(c, mul(turn(R, f.up), e)));
    const ax = [(r[0] - at[0]) / e, (r[1] - at[1]) / e], ay = [(u[0] - at[0]) / e, (u[1] - at[1]) / e];
    ctx.setTransform(ax[0], ax[1], -ay[0], -ay[1], at[0], at[1]);
    if (d.pips) {
      ctx.fillStyle = '#1d2321';
      for (const [x, y] of PIPS[f.num]) {
        ctx.beginPath();
        ctx.arc(x * f.room * 0.5, y * f.room * 0.5, f.room * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const label = d.labels[fi];
    const size = f.room * (d.magic ? 1.25 : label.length === 1 ? 1.15 : label.length === 2 ? 0.95 : 0.72);
    ctx.scale(size / 100, size / 100);
    ctx.font = '800 100px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (d.magic) {
      ctx.shadowColor = '#d9c2ff';
      ctx.shadowBlur = W / 14;
      ctx.fillStyle = '#f7efff';
    } else {
      ctx.fillStyle = '#1d2321';
    }
    ctx.fillText(label, 0, 6);
    ctx.shadowBlur = 0;
    // 6 and 9 get a line underneath when both are on the die, like real dice
    if (hasSixAndNine && (label === '6' || label === '9')) ctx.fillRect(-26, 44, 52, 9);
  });
  if (d.magic) drawSparkles(ctx, W, now, d);
}

// a few twinkling stars around a magic die
function drawSparkles(ctx, W, now, d) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(232, 214, 255, .9)';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + (d.seed || 0);
    const x = W / 2 + Math.cos(a) * W * 0.47, y = W / 2 + Math.sin(a) * W * 0.47;
    const s = W * 0.035 * (0.55 + 0.45 * Math.sin(now / 230 + i * 1.7));
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * 0.5, y + s * 0.5);
    ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.5, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

// Rolls the dice for ms. Each die turns about one fixed axis the whole time,
// from exactly where it rests: a real die by the single turn that takes it to
// its rolled face, plus a few whole turns, so it slows to a stop on that face
// without changing direction. A magic die rolls the same way and lands on a
// face too (any face: it has symbols, not numbers).
// only: which shown dice to roll (all when left out); the others stay put.
function rollDice(range, values, ms, only = null) {
  setupDice(range);
  const labels = faceLabels(range, values);
  // at the start a die turns about once per TURN_MS; slowDown spreads that out
  const turns = Math.max(1, Math.round(ms / TURN_MS / 3));
  const now = performance.now();
  const spinning = []; // the axes of the dice rolled so far in this throw
  dice.forEach((d, i) => {
    if (d.canvas.hidden || (only && !only.includes(i))) return;
    d.start = now;
    d.ms = ms;
    d.from = d.q;
    d.seed = Math.random() * 6;
    // a magic die has symbols, not numbers, so any face will do
    const faces = d.shape.faces.map((f, fi) => fi).filter(fi => d.magic || d.labels[fi] === labels[i]);
    d.target = restPose(d.shape.faces[faces[randomInt(faces.length)]]);
    // the one turn from here to the target: its axis and angle
    const turn1 = qMul(d.target, [d.from[0], -d.from[1], -d.from[2], -d.from[3]]);
    let [w, x, y, z] = turn1;
    if (w < 0) [w, x, y, z] = [-w, -x, -y, -z];
    const half = Math.acos(Math.min(1, w));
    d.axis = Math.sin(half) > 1e-6 ? unit([x, y, z]) : null;
    d.total = 2 * half + Math.PI * 2 * turns;
    d.drift = null;
    // Turning straight about the x, y or z axis looks flat (a d6 always would:
    // one upright face to another is a quarter or half turn about x or y), so
    // then it turns about an axis leaning away from them instead, and the small
    // turn still needed to land on the face is spread evenly over the whole
    // roll (never saved up for the end). The same goes when another die in this
    // throw already turns about (nearly) the same axis, so every die spins its own way.
    const alike = (a) => spinning.some(b => Math.abs(dot(a, b)) > 0.9);
    if (!d.axis || Math.max(...d.axis.map(Math.abs)) > 0.94 || alike(d.axis)) {
      d.axis = leanAxis(d.axis, alike);
      let [dw, dx, dy, dz] = qMul(turn1, qAxis(d.axis, -d.total));
      if (dw < 0) [dw, dx, dy, dz] = [-dw, -dx, -dy, -dz];
      const dHalf = Math.acos(Math.min(1, dw));
      if (Math.sin(dHalf) > 1e-6) d.drift = { axis: unit([dx, dy, dz]), angle: 2 * dHalf };
    }
    spinning.push(d.axis);
    // a knock on the table every quarter turn: quick at first, further apart
    // and softer as it slows (slowDown run backwards gives when each happens);
    // a magic die twinkles instead (see rollNumber)
    if (ms <= 0 || d.magic) return;
    for (let k = 1; k * Math.PI / 2 < d.total; k++) {
      const x = 1 - (1 - k * Math.PI / 2 / d.total) ** (1 / 3);
      sfx.clack(inSync(x * ms / 1000 + Math.random() * 0.02), 1 - 0.6 * x);
    }
    sfx.diceStop(inSync(ms / 1000 + i * 0.03));
  });
  if (ms <= 0) { landDice(); return; }
  if (!diceAnim) { diceAnim = true; requestAnimationFrame(diceFrame); }
}

// An axis that leans 25–37° away from the x, y and z axes: near the given
// axis when there is one (so the roll keeps its direction), or anywhere, and
// not alike another die's (when it can't find one, it gives that up).
function leanAxis(near, alike = () => false) {
  for (let tries = 0; ; tries++) {
    const r = unit([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const a = near ? unit(add(mul(near, Math.cos(0.5)), mul(unit(cross(near, r)), Math.sin(0.5)))) : r;
    const most = Math.max(...a.map(Math.abs));
    if (most < Math.cos(25 * Math.PI / 180) && (near || most > 0.6) && (tries > 500 || !alike(a))) return a;
  }
}

// Each rolling die moves on its own clock, so one die can roll by itself.
function diceFrame(now) {
  if (!diceAnim) return;
  let moving = false;
  for (const d of dice) {
    if (d.canvas.hidden || !d.ms) continue;
    const e = Math.max(0, now - d.start);
    if (e >= d.ms) { d.q = d.target; d.ms = 0; continue; }
    const s = slowDown(e / d.ms);
    d.q = qMul(qAxis(d.axis, d.total * s), d.from);
    if (d.drift) d.q = qMul(qAxis(d.drift.axis, d.drift.angle * s), d.q);
    moving = true;
  }
  drawDice(now);
  if (moving) requestAnimationFrame(diceFrame);
  else diceAnim = null;
}

// Every tick a magic die's faces show new symbols.
function shuffleMagic() {
  for (const d of dice) if (!d.canvas.hidden && d.magic) d.labels = d.labels.map(magicSymbol);
}

// The dice come to rest where their roll ends.
function landDice() {
  diceAnim = null;
  for (const d of dice) if (!d.canvas.hidden && d.target) { d.q = d.target; d.ms = 0; }
  drawDice();
}

// Picks how many dice the chosen range rolls. More than one die can't use
// "roll each number only once", so that switches off.
$('dicePick').onclick = (e) => {
  const n = Number(e.target.dataset.n);
  const r = currentRange();
  if (!n || !r || rolling || n === r.dice) return;
  if (ranges.some(x => x !== r && sameRange(x, { ...r, dice: n }))) {
    sfx.out();
    toast(`You already have ${rangeText({ ...r, dice: n })}`);
    return;
  }
  r.dice = n;
  if (n > 1) { r.once = false; r.used = []; }
  saveRanges();
  selectRange(r);
  sfx.in();
  resetCard();
  render();
};

// ---------- Rolling a number ----------
// No number shows while real dice spin (numbers race past under the magic
// die, whose faces show symbols); it lands on a number picked
// uniformly at random from the chosen range (both ends included). With several
// dice, each die is rolled on its own and they're added up, like real dice.
// With "roll each number only once" (one die), it picks uniformly among the
// numbers not rolled yet: the k-th free number is found by stepping past the used ones.
var lastRoll = null; // { range, values } of the roll on screen, for rerolling one die (var: resetCard may run first)

// How long a roll spins: the pauses between its ticks, added up.
function rollLength(ticks) {
  let ms = 0;
  for (let t = 1; t < ticks; t++) ms += spinDelay(t / ticks);
  return ms;
}

function rollNumber() {
  if (rolling) return;
  const range = currentRange();
  if (!range) return;
  selectRange(range);
  const min = range.from;
  const max = range.to;
  const roll = () => min + randomInt(max - min + 1);
  const rollAll = () => Array.from({ length: range.dice }, roll);
  let values;
  if (range.once) {
    const left = numbersLeft(range);
    if (left <= 0) return;
    let number = min + randomInt(left);
    for (const u of [...range.used].sort((a, b) => a - b)) {
      if (u <= number) number++;
      else break;
    }
    values = [number];
  } else {
    values = rollAll();
  }

  document.activeElement?.blur?.(); // closes the keyboard
  const total = spinTicks(min !== max);
  rolling = true;
  $('card').className = 'starter rolling';
  $('crown').className = '';
  $('resultParts').hidden = true;
  $('rerollHint').hidden = true;
  clearResult();
  // the dice make their own sounds as they tumble (see rollDice)
  rollDice(range, values, rollLength(total));
  const magic = dieFor(range).magic;
  $('pick').textContent = 'Rolling…';
  $('pick').disabled = true;

  let tick = 0;
  (function spin() {
    tick++;
    if (tick < total) {
      const progress = tick / total;
      // the magic die's faces show symbols, so numbers race past under it instead
      if (magic) { shuffleMagic(); sfx.sparkle(); showName(rollAll().reduce((a, b) => a + b, 0).toLocaleString()); }
      if (navigator.vibrate) navigator.vibrate(5);
      setTimeout(spin, spinDelay(progress));
      return;
    }
    if (range.once) {
      range.used = [...(range.used || []), values[0]];
      saveRanges();
    }
    landDice();
    showRolled(range, values, true);
  })();
}

// No number while real dice roll: the result shows once they land.
function clearResult() {
  result.className = 'rolling-dice';
  result.textContent = ' ';
}

// Shows a roll that has landed: the total in the gold badge (with the dice
// under it), Recent rolls, and what screen readers say.
function showRolled(range, values, celebrate) {
  rolling = false;
  lastRoll = { range, values };
  const number = values.reduce((a, b) => a + b, 0);
  const shown = number.toLocaleString();
  const parts = values.length > 1 ? values.map(v => v.toLocaleString()).join(' + ') : '';
  // Recent rolls: the result, what was rolled ("2d6", "1 to 20") and the dice ("4 + 5")
  rolls.unshift({ value: shown, from: range.name || rangeText(range), parts, at: Date.now() });
  rolls.length = Math.min(rolls.length, MAX_HISTORY);
  saveRolls();
  result.className = '';
  void result.offsetWidth;
  result.className = 'won' + (shown.length > 14 ? ' long' : '') + (dieFor(range).magic ? ' from-die' : '');
  result.textContent = shown;
  $('resultParts').textContent = parts;
  $('resultParts').hidden = !parts;
  // tells you a die can be rerolled
  $('rerollHint').hidden = !parts;
  announce(parts ? `Rolled ${shown}: ${parts}` : `Rolled ${shown}`);
  $('card').className = 'starter winner';
  $('pick').textContent = 'Roll again';
  render();
  sfx.win();
  if (!celebrate) return;
  if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
  const r = result.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2);
}

// After a roll with several dice, tapping a die rolls just that one again and
// keeps the others, like in dice games. The total and Recent rolls update.
// With one die (or "roll each number only once"), tapping it is a new roll.
$('die').addEventListener('click', (e) => {
  if (mode !== 'number' || rolling) return;
  if (e.timeStamp - lastDiceSwipe() < 500) return; // the end of a swipe, which rolled them all
  const i = dice.findIndex(d => d.canvas === e.target);
  const range = currentRange();
  if (i < 0 || !range) return;
  if (!lastRoll || lastRoll.range !== range || range.dice < 2 || range.once) { $('pick').click(); return; }
  const values = lastRoll.values.slice();
  values[i] = range.from + randomInt(range.to - range.from + 1);
  rolling = true;
  $('pick').disabled = true;
  const ms = Math.round(rollLength(spinTicks(true)) * 0.6);
  clearResult();
  $('resultParts').hidden = true;
  rollDice(range, values, ms, [i]);
  if (navigator.vibrate) navigator.vibrate(10);
  setTimeout(() => { landDice(); showRolled(range, values, false); }, ms);
});
