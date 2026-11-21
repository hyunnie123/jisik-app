/* 지식 작업실 폰앱 — 앱 파일을 폰에 담아 두고(인터넷 없어도 열림), 켜질 때 뒤에서 새 판을 받아 둔다(다음 열 때 반영). 글은 여기 아님(IndexedDB). */
const V = 'jisik-52e809a013';
const SHELL = ["./", "index.html", "content.css", "phone.js", "merge.js", "mind.js", "mind.css", "blocks.js", "blocks.css", "board.js", "patterns.css", "ptwrap.css", "pattern.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "fonts/NK-400.woff2", "fonts/NK-500.woff2", "fonts/NK-600.woff2", "fonts/NK-700.woff2", "fonts/NK-800.woff2", "fonts/NK-900.woff2", "fonts/BHS.woff2", "pdfjs/pdf.min.mjs", "pdfjs/pdf.worker.min.mjs"];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;   // 깃허브 API 등은 그대로
  const key = req.mode === 'navigate' ? new Request('index.html') : req;
  e.respondWith((async () => {
    const c = await caches.open(V), hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok && r.type === 'basic') c.put(key, r.clone()); return r; }).catch(() => hit);
    if (hit) { e.waitUntil(net.then(() => {})); return hit; }
    return net;
  })());
});
