// ---------- Flipping a coin ----------
// The coin is drawn in 3D on a canvas, seen from above as it lies on a table:
// gold on the heads side and silver on the tails side, each with a raised rim
// around a sunken field, a raised emblem (a crown or a star) in a ring of
// raised dots. The ridged edge is half gold, half silver.
// Its metal catches the light as it turns.
//
// A flip is planned before it starts, like the dice: the side is picked first
// (each half the time). Then a thumb flicks it (a small dip), it flies up out of
// the card, turning end over end about one axis and tilted a little so you see
// its edge, blurred while it's fast, and comes down flat with the picked side
// up, bouncing once. Its shadow stays on the table, shrinking as it rises.
const COIN_EDGE = 48;          // segments around the rim (alternate shades make the ridges)
const COIN_THICK = 0.13;       // thickness, in coin radii
const COIN_R = 56;             // radius at rest, in CSS pixels
const COIN_W = 300, COIN_H = 400, COIN_Y = 260; // the canvas, and the coin's middle at rest (see .coin-box)
const COIN_RISE = 62;          // how far up the screen it goes per unit of height (it peaks about 105 px up)
const FLICK = 0.07, FLY = 0.84, BOUNCE = 0.97; // parts of the flip: the flick, in the air until FLY, one bounce until BOUNCE
const COIN_TILT = 0.5;         // how far it leans in the air (radians), back to flat by the landing
const HEADS_UP = [1, 0, 0, 0];
const TAILS_UP = qAxis([1, 0, 0], Math.PI);
const coinCanvas = $('coinCanvas');
const coinCtx = coinCanvas.getContext('2d');
let coin = { q: HEADS_UP, z: 0, blur: 0, ghost: null };  // how it lies, how high above the table, and its motion blur (how strong, and the copy's pose)
let coinAnim = null;

// the two metals: color, the color of its shine, and the dark and light edges of raised shapes
const GOLD = { color: [226, 168, 38], shine: [255, 245, 190], dark: 'rgba(95, 58, 0, .7)', light: 'rgba(255, 246, 200, .75)' };
const SILVER = { color: [196, 203, 212], shine: [255, 255, 255], dark: 'rgba(38, 46, 58, .6)', light: 'rgba(255, 255, 255, .85)' };

// rim corners on both sides, and the outward direction of each ridge
const COIN_RIM = Array.from({ length: COIN_EDGE }, (_, i) => {
  const a = i / COIN_EDGE * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
});

function metal(n, ridge = 1, m = GOLD) {
  const diffuse = Math.max(0, dot(n, LIGHT));
  // light bounced off the surface straight at you makes the shine
  const bounce = sub(mul(n, 2 * dot(n, LIGHT)), LIGHT);
  const shine = Math.max(0, bounce[2]) ** 10;
  // bright when it faces you, darker as it turns away
  const k = (0.42 + 0.33 * diffuse + 0.3 * Math.max(0, n[2])) * ridge;
  return m.color.map((c, i) => Math.round(Math.min(255, c * k + m.shine[i] * shine * 0.8)));
}
const rgb = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const shadeBy = (c, k) => c.map(v => Math.min(255, Math.round(v * k)));

// Kept light for phones: at most 2× resolution (sharp enough at this size),
// and each frame only clears and redraws the area the coin and its shadow
// were in, not the whole tall canvas.
let coinDirty = null; // [x, y, w, h] drawn last frame, in canvas pixels
function drawCoin() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(COIN_W * dpr), H = Math.round(COIN_H * dpr);
  // (both sides: a new canvas is 300 × 150, so at 1× its width already matches)
  if (coinCanvas.width !== W || coinCanvas.height !== H) { coinCanvas.width = W; coinCanvas.height = H; coinDirty = null; }
  const ctx = coinCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (coinDirty) ctx.clearRect(...coinDirty);
  else ctx.clearRect(0, 0, W, H);
  const size = COIN_R * dpr, mx = W / 2, my = COIN_Y * dpr;
  const lift = coin.z * COIN_RISE * dpr; // higher in the air is further up the screen
  const top = turn(qMatrix(coin.q), [0, 0, 1]);

  // the shadow stays on the table where it will land: smaller and fainter the higher the coin is
  const high = Math.max(0, coin.z);
  const sx = mx + size * 0.08, sy = my + size * 0.12;
  const sr = size * (0.7 + 0.3 * Math.abs(top[2])) * (1 - Math.min(0.45, high * 0.25));
  const shade = ctx.createRadialGradient(sx, sy, sr * 0.45, sx, sy, sr * 1.15);
  shade.addColorStop(0, `rgba(0, 0, 0, ${0.42 * (1 - Math.min(0.75, high * 0.4))})`);
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(sx, sy, sr * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // motion blur, faked cheaply: a faint copy of the coin a little behind in
  // its turn (plain, without the relief), under the coin itself
  if (coin.ghost) {
    ctx.globalAlpha = coin.blur;
    drawCoinBody(coin.ghost, size, mx, my - lift, true);
    ctx.globalAlpha = 1;
  }
  drawCoinBody(coin.q, size, mx, my - lift, false);

  // what to clear next time: the coin (up to 1.5× bigger in the air) and the shadow
  const cr = size * 1.6, cy = my - lift;
  const x0 = Math.floor(Math.min(mx - cr, sx - sr * 1.2)), x1 = Math.ceil(Math.max(mx + cr, sx + sr * 1.2));
  const y0 = Math.floor(Math.min(cy - cr, sy - sr * 1.2)), y1 = Math.ceil(Math.max(cy + cr, sy + sr * 1.2));
  coinDirty = [x0, y0, x1 - x0, y1 - y0];
}

// The coin itself, turned by q, with its middle at (mx, my). plain leaves out
// the sheen and the relief (for the motion-blur copy).
function drawCoinBody(q, size, mx, my, plain) {
  const ctx = coinCtx, D = 6;
  const R = qMatrix(q);
  const at = (p) => { const w = turn(R, p); const f = D / (D - w[2] - coin.z); return [mx + w[0] * size * f, my - w[1] * size * f]; };
  const facing = (n, c) => dot(turn(R, n), sub([0, 0, D - coin.z], turn(R, c))) > 0;
  // the ridged edge: one thin side per segment, alternately lighter and darker,
  // gold on the heads half of its thickness and silver on the tails half
  const h = COIN_THICK / 2;
  for (let i = 0; i < COIN_EDGE; i++) {
    const [a1, b1] = COIN_RIM[i], [a2, b2] = COIN_RIM[(i + 1) % COIN_EDGE];
    const n = unit([a1 + a2, b1 + b2, 0]);
    if (!facing(n, mul(n, 1))) continue;
    for (const [z1, z2, m] of [[h, 0, GOLD], [0, -h, SILVER]]) {
      const quad = [[a1, b1, z1], [a2, b2, z1], [a2, b2, z2], [a1, b1, z2]].map(at);
      ctx.beginPath();
      quad.forEach((p, t) => (t ? ctx.lineTo : ctx.moveTo).call(ctx, ...p));
      ctx.closePath();
      ctx.fillStyle = rgb(metal(turn(R, n), i % 2 ? 0.7 : 0.95, m));
      ctx.fill();
    }
  }

  // the face toward you (heads, gold, on +z; tails, silver, on -z)
  for (const side of [1, -1]) {
    const n = [0, 0, side], c = [0, 0, side * h];
    if (!facing(n, c)) continue;
    const m = side === 1 ? GOLD : SILVER;
    const ring = COIN_RIM.map(([a, b]) => at([a, b, c[2]]));
    const base = metal(turn(R, n), 1, m);
    ctx.beginPath();
    ring.forEach((p, t) => (t ? ctx.lineTo : ctx.moveTo).call(ctx, ...p));
    ctx.closePath();
    if (plain) { ctx.fillStyle = rgb(base); ctx.fill(); continue; }
    // a soft sheen across the face that moves as the coin turns
    const p1 = at([-0.9, 0.9 * side, c[2]]), p2 = at([0.9, -0.9 * side, c[2]]);
    const sheen = ctx.createLinearGradient(p1[0], p1[1], p2[0], p2[1]);
    sheen.addColorStop(0, rgb(shadeBy(base, 1.25)));
    sheen.addColorStop(0.55, rgb(base));
    sheen.addColorStop(1, rgb(shadeBy(base, 0.75)));
    ctx.fillStyle = sheen;
    ctx.fill();

    // the face's own flat directions on screen; everything on it is drawn in coin radii
    const o = at(c);
    const r = at(add(c, [0.05, 0, 0])), u = at(add(c, [0, 0.05 * side, 0]));
    ctx.setTransform((r[0] - o[0]) / 0.05, (r[1] - o[1]) / 0.05, -(u[0] - o[0]) / 0.05, -(u[1] - o[1]) / 0.05, o[0], o[1]);

    // the sunken field inside the raised rim: a little darker, with the rim's
    // shadow along its top left and light catching its bottom right
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 0.84, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, .1)';
    ctx.fill();
    ctx.lineWidth = 0.09;
    ctx.strokeStyle = m.dark;
    ctx.beginPath(); ctx.arc(0.035, 0.035, 0.86, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = m.light;
    ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(-0.03, -0.03, 0.87, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // raised shapes: a dark edge below right, a light edge above left, then the shape
    const raised = (draw, fill) => {
      for (const [dx, dy, color] of [[0.03, 0.03, m.dark], [-0.022, -0.022, m.light], [0, 0, fill]]) {
        ctx.save();
        ctx.translate(dx, dy);
        draw(color);
        ctx.restore();
      }
    };
    const relief = rgb(shadeBy(base, 1.02));
    raised((color) => { ctx.fillStyle = color; side === 1 ? crownPath() : starPath(); ctx.fill(); }, relief);
    raised((color) => { ctx.fillStyle = color; rimDots(); ctx.fill(); }, relief);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// heads: a crown with three points and a band (in coin radii, y down)
function crownPath() {
  coinCtx.beginPath();
  coinCtx.moveTo(-0.42, 0.26);
  coinCtx.lineTo(-0.47, -0.16);
  coinCtx.lineTo(-0.22, 0.06);
  coinCtx.lineTo(0, -0.26);
  coinCtx.lineTo(0.22, 0.06);
  coinCtx.lineTo(0.47, -0.16);
  coinCtx.lineTo(0.42, 0.26);
  coinCtx.closePath();
  coinCtx.rect(-0.42, 0.31, 0.84, 0.12);
  for (const [x, y] of [[-0.47, -0.21], [0, -0.32], [0.47, -0.21]]) {
    coinCtx.moveTo(x + 0.065, y);
    coinCtx.arc(x, y, 0.065, 0, Math.PI * 2);
  }
}

// tails: a five-pointed star
function starPath() {
  coinCtx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.19 : 0.45;
    (i ? coinCtx.lineTo : coinCtx.moveTo).call(coinCtx, Math.cos(a) * r, Math.sin(a) * r + 0.04);
  }
  coinCtx.closePath();
}

// a ring of dots inside the rim, on both sides
function rimDots() {
  coinCtx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2, x = Math.cos(a) * 0.68, y = Math.sin(a) * 0.68;
    coinCtx.moveTo(x + 0.035, y);
    coinCtx.arc(x, y, 0.035, 0, Math.PI * 2);
  }
}

// The flip, worked out before it starts: a thumb flicks it (a small dip), it's
// tossed up and toward you, turning end over end at a steady speed about the
// x axis and leaning a little about the y axis, then lands flat with the
// picked side up and bounces once. The sounds are timed to match.
function tossCoin(heads, ms) {
  const from = coin.q;
  const end = heads ? HEADS_UP : TAILS_UP;
  const wasHeads = dot(turn(qMatrix(from), [0, 0, 1]), [0, 0, 1]) > 0;
  const flyMs = ms * (FLY - FLICK);
  const flips = Math.max(2, Math.round(flyMs / 260));
  // whole turns, plus a half turn when it changes sides
  const total = Math.PI * 2 * flips + (wasHeads === heads ? 0 : Math.PI);
  // it leans one way or the other (this doesn't change the side it lands on)
  const lean = (randomInt(2) ? 1 : -1) * COIN_TILT;
  coinAnim = { start: performance.now(), ms, from, end, total, lean };

  const flick = ms * FLICK / 1000;
  sfx.whoosh(inSync(flick));
  // a faint shimmer each time a face turns toward you in the air
  for (let k = 1; k * Math.PI < total; k++) sfx.ting(inSync(flick + (k * Math.PI / total) * flyMs / 1000), 1 - 0.4 * k * Math.PI / total);
  sfx.clink(inSync(ms * FLY / 1000));
  sfx.clink(inSync(ms * BOUNCE / 1000), 0.45);
  requestAnimationFrame(coinFrame);
}

function coinFrame(now) {
  const a = coinAnim;
  if (!a) return;
  const x = Math.min(1, Math.max(0, (now - a.start) / a.ms));
  if (x < FLICK) {
    // the thumb presses it down a little and it rocks back, ready to fly
    const dip = Math.sin(Math.PI * x / FLICK);
    coin.q = qMul(qAxis([1, 0, 0], -0.22 * dip), a.from);
    coin.z = -0.12 * dip;
    coin.ghost = null;
  } else if (x < FLY) {
    const u = (x - FLICK) / (FLY - FLICK);
    const pose = (u) => qMul(qAxis([0, 1, 0], a.lean * Math.sin(Math.PI * u)), qMul(qAxis([1, 0, 0], a.total * u), a.from));
    coin.q = pose(u);
    coin.z = 1.7 * 4 * u * (1 - u);
    // blurred at the start, sharp by the time it comes down, so you can read the side
    coin.blur = 0.45 * Math.min(1, u / 0.06) * Math.max(0, 1 - u / 0.7);
    coin.ghost = coin.blur > 0.02 ? pose(Math.max(0, u - 0.5 / a.total)) : null;
  } else {
    const w = Math.min(1, (x - FLY) / (BOUNCE - FLY));
    coin.q = a.end;
    coin.z = 0.2 * 4 * w * (1 - w); // one small hop, flat
    coin.ghost = null;
  }
  drawCoin();
  if (x < 1) requestAnimationFrame(coinFrame);
}

function flipCoin() {
  if (rolling) return;
  const heads = randomInt(2) === 0;
  const total = spinTicks(true);
  let flipMs = 0;
  for (let t = 1; t < total; t++) flipMs += spinDelay(t / total);

  rolling = true;
  $('card').className = 'starter rolling';
  result.className = 'hint';
  result.textContent = '';
  $('pick').textContent = 'Flipping…';
  $('pick').disabled = true;
  if (flipMs > 0) tossCoin(heads, flipMs);

  const land = () => {
    rolling = false;
    coinAnim = null;
    coin = { q: heads ? HEADS_UP : TAILS_UP, z: 0 };
    drawCoin();
    coinTally[heads ? 'heads' : 'tails']++;
    setPref(COIN_KEY, JSON.stringify(coinTally));
    result.className = '';
    void result.offsetWidth;
    result.className = 'won';
    result.textContent = heads ? 'Heads' : 'Tails';
    announce(heads ? 'Heads' : 'Tails');
    $('card').className = 'starter winner';
    $('pick').textContent = 'Flip again';
    render();
    sfx.win();
    if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
    const r = result.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
  };
  if (flipMs > 0) {
    // a short buzz when it hits the table and when it bounces
    setTimeout(() => navigator.vibrate && navigator.vibrate(15), flipMs * FLY);
    setTimeout(() => navigator.vibrate && navigator.vibrate(8), flipMs * BOUNCE);
    setTimeout(land, flipMs);
  } else {
    land();
  }
}

$('coinReset').onclick = () => {
  if (rolling) return;
  coinTally = { heads: 0, tails: 0 };
  setPref(COIN_KEY, JSON.stringify(coinTally));
  sfx.swap();
  resetCard();
  render();
};

$('support').onclick = () => sfx.add();

renderMute();
openFromAddress();
resetCard();
render();
checkSharedLink();
