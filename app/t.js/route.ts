/**
 * Comuno website tracking script. Site owners embed:
 *   <script async src="https://<comuno-host>/t.js" data-key="<tracking key>"></script>
 * It keeps a first-party visitor id in localStorage, reports page views (including SPA
 * navigations) to /api/track, and exposes window.comuno.identify(email).
 */

const SCRIPT = String.raw`(function(){
  if (window.comuno && window.comuno.__loaded) return;
  var s = document.currentScript || document.querySelector('script[data-key][src*="/t.js"]');
  if (!s) return;
  var key = s.getAttribute('data-key');
  if (!key) return;
  var endpoint = new URL(s.src, location.href).origin + '/api/track';
  var VID = 'comuno_vid', CID = 'comuno_cid';
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var vid = store(VID);
  if (!vid) {
    vid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    store(VID, vid);
  }
  var params = new URLSearchParams(location.search);
  var cid = params.get('cid') || store(CID) || undefined;
  if (params.get('cid')) store(CID, params.get('cid'));
  var email = params.get('email') || undefined;
  function send(extra) {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    var payload = { k: key, v: vid, u: location.href, t: document.title, r: document.referrer || undefined, c: cid };
    for (var x in extra) payload[x] = extra[x];
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) {}
    try { fetch(endpoint, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' }); } catch (e) {}
  }
  var last = '';
  function pageview() {
    if (location.href === last) return;
    last = location.href;
    send(email ? { e: email } : {});
    email = undefined;
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(pageview, 0); return r; };
  });
  window.addEventListener('popstate', pageview);
  window.comuno = {
    __loaded: true,
    identify: function (e) { if (e && typeof e === 'string') send({ type: 'identify', e: e.trim().toLowerCase() }); },
    track: pageview
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') pageview();
  else document.addEventListener('DOMContentLoaded', pageview);
})();
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
