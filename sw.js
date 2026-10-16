/* ==========================================================================
   sw.js — Service Worker：把整个应用缓存到手机本地
   装上以后，即使关掉电脑、断网、飞行模式，也能照常打开和背单词。
   改动了应用文件后，请把 VERSION 加一，手机下次联网打开时会自动更新。
   ========================================================================== */
const VERSION = 'v1';
const CACHE = 'cet4-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/core.js',
  './assets/qr.js',
  './assets/store.js',
  './assets/data.js',
  './assets/srs.js',
  './assets/state.js',
  './assets/view-home.js',
  './assets/view-learn.js',
  './assets/view-quiz.js',
  './assets/view-exam.js',
  './assets/view-material.js',
  './assets/view-stats.js',
  './assets/view-setup.js',
  './assets/app.js',
  './data/words.js',
  './data/examples.js',
  './data/questions.js',
  './data/passages.js',
  './data/study.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个下载，个别文件失败不影响整体安装
    await Promise.all(PRECACHE.map((u) =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  // 学习记录接口永远走网络，绝不缓存
  if (url.pathname.indexOf('/api/') >= 0) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await caches.match(req, { ignoreSearch: true });

    if (hit) {
      // 缓存优先（保证离线可用），同时后台悄悄更新，下次打开就是最新的
      fetch(req).then((fresh) => {
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
      }).catch(() => {});
      return hit;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      const shell = await caches.match('./index.html', { ignoreSearch: true });
      if (shell) return shell;
      throw err;
    }
  })());
});

// 允许页面主动要求跳过等待（更新后立即生效）
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
