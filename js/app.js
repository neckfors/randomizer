// ---------- Focus mode ----------
// Only the pick card, in the middle of the screen, and fullscreen where the
// phone allows it (iPhone keeps its bars). ✕, Esc or the phone's back gesture
// leaves it: entering adds a step to the history, so back undoes just that.
const inFocus = () => document.body.classList.contains('focus-mode');
function enterFocus() {
  if (inFocus()) return;
  document.body.classList.add('focus-mode');
  $('focusExit').hidden = false;
  history.pushState({ focus: true }, '', location.href);
  const root = document.documentElement;
  if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  sfx.swap();
}
function leaveFocus() {
  if (!inFocus()) return;
  document.body.classList.remove('focus-mode');
  $('focusExit').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  sfx.swap();
}
$('focusBtn').onclick = enterFocus;
// ✕ steps back through history, which leaves focus mode (see popstate)
$('focusExit').onclick = () => { if (history.state && history.state.focus) history.back(); else leaveFocus(); };
addEventListener('popstate', leaveFocus);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && inFocus() && !document.querySelector('dialog[open]')) $('focusExit').click(); });
// leaving fullscreen some other way (like swiping it away) leaves focus mode too
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && inFocus()) $('focusExit').click(); });

// ---------- Fullscreen edge swipes ----------
// Fullscreen (the installed app on Android, or focus mode), the phone's own
// bars come back with a swipe in from the bottom edge. A touch that starts
// right at that edge is left to the phone, so the swipe doesn't also scroll or
// tap something in the app.
const SYSTEM_EDGE = 24;
addEventListener('touchstart', (e) => {
  const fullscreen = document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches;
  const t = e.touches[0];
  if (fullscreen && t && t.clientY > innerHeight - SYSTEM_EDGE) e.preventDefault();
}, { passive: false });

// ---------- Updates ----------
// A new version downloads in the background and waits; a bar offers it, and
// only tapping Update lets it take over and reloads. It never reloads by itself,
// so a pick is never cut off.
const CHECK_EVERY = 30 * 60 * 1000;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  let waiting = null;
  let updating = false;
  // on the very first visit there is nothing to update from
  const offer = (worker) => {
    if (!navigator.serviceWorker.controller) return;
    waiting = worker;
    $('updateBar').hidden = false;
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') offer(worker);
      });
    });
    // an installed app can stay open for days, so look again whenever it comes
    // back, and every half hour while it stays open
    const check = () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    setInterval(check, CHECK_EVERY);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) location.reload();
  });
  $('updateBtn').onclick = () => {
    updating = true;
    if (waiting) waiting.postMessage('update');
    else location.reload();
  };
}

// Settings shows the version this phone is running, asked from the service worker.
function showVersion() {
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return;
  const channel = new MessageChannel();
  channel.port1.onmessage = (e) => { $('appVersion').textContent = `Version ${e.data}`; };
  worker.postMessage('version', [channel.port2]);
}
showVersion();
navigator.serviceWorker?.addEventListener('controllerchange', showVersion);
