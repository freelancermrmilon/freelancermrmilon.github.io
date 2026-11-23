/* আমার ব্যবসা — অফলাইনে অ্যাপ খোলার জন্য Service Worker */
const VERSION = 'amar-bebosha-v1';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
const LIBS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap';
// ডেটার অনলাইন API — এগুলো কখনো ক্যাশ করা হবে না (Firestore নিজেই অফলাইন ডেটা সামলায়)
const SKIP = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com', 'www.googleapis.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await Promise.all(LIBS.map(async (u) => { try { await c.put(u, await fetch(u, { mode: 'no-cors' })); } catch (_) {} }));
    try {
      const r = await fetch(FONT_CSS); const css = await r.clone().text(); await c.put(FONT_CSS, r);
      const urls = Array.from(new Set((css.match(/https:\/\/fonts\.gstatic\.com[^)'"\s]+/g) || [])));
      await Promise.all(urls.map(async (u) => { try { await c.put(u, await fetch(u)); } catch (_) {} }));
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (SKIP.indexOf(url.hostname) >= 0) return;

  // পেজ খোলা: আগে ইন্টারনেট (৪ সেকেন্ড), না পেলে ফোনে রাখা কপি
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = async () => (await cache.match('index.html')) || (await cache.match('./'));
      try {
        const net = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
        ]);
        if (net && net.ok) cache.put('index.html', net.clone());
        return net;
      } catch (_) {
        return (await cached()) || new Response('অফলাইন — আগে একবার ইন্টারনেটে অ্যাপ খুলুন', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // বাকি সব ফাইল: ফোনের কপি আগে, পেছনে নতুন করে আপডেট
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })());
});
