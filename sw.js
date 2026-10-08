var CACHE = 'resume-ai-v3';

var URLS = [
  '/',
  '/index.html',
  '/resume-editor.js',
  '/favicon.svg',
  '/templates/modern-professional.html',
  '/templates/apple-minimal.html',
  '/templates/cyberpunk-tech.html',
  '/templates/stripe-notion.html',
  '/templates/luxury-black-gold.html',
  '/templates/creative-creator.html',
  '/templates/nordic-clean.html',
  '/templates/bold-impact.html',
  '/templates/editorial.html',
  '/templates/soft-gradient.html',
  '/templates/mono-chrome.html',
  '/templates/brutalist.html',
  '/templates/glassmorphism.html',
  '/templates/neon-nights.html',
  '/templates/synthwave-80s.html',
  '/templates/synthwave.html',
  '/templates/precision-finance.html',
  '/templates/blueprint.html',
  '/templates/vaporwave.html',
  '/templates/terminal-cli.html',
  '/templates/newspaper.html',
  '/templates/timeline-right.html'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(URLS);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var request = e.request;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Network first so fresh content always wins, with the cache as an offline
  // fallback. Assets are still stored on every successful fetch.
  e.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || Response.error();
      });
    })
  );
});
