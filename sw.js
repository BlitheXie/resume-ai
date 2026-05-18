var CACHE = 'resume-ai-v1';

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
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(URLS);
    })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
