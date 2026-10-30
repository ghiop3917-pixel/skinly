// Сеть в приоритете, чтобы обновления приходили сразу; кэш — для работы офлайн.
// Пути относительные: на GitHub Pages приложение живёт в подпапке.
const CACHE = 'skinly-v8';
const SHELL = [
  './', 'manifest.webmanifest', 'css/app.css', 'icons/icon-192.png',
  'js/app.js', 'js/api.js', 'js/context.js', 'js/data.js', 'js/db.js', 'js/fitness.js', 'js/foods.js', 'js/notifications.js', 'js/state.js', 'js/ui.js',
  'js/views/ai.js', 'js/views/chat.js', 'js/views/diary.js', 'js/views/fit.js', 'js/views/home.js', 'js/views/onboarding.js',
  'js/views/products.js', 'js/views/profile.js', 'js/views/reminders.js', 'js/views/routine.js', 'js/views/scan.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    // no-cache: GitHub Pages разрешает хранить файлы 10 минут, а обновления должны приходить сразу.
    fetch(event.request.url, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('./') : Response.error())),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});
