import { startReminderLoop } from './notifications.js';
import { getProfile } from './state.js';
import { h, icon, toast } from './ui.js';
import { renderAi } from './views/ai.js';
import { renderDiary } from './views/diary.js';
import { renderHome } from './views/home.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderProducts } from './views/products.js';
import { renderProfile } from './views/profile.js';
import { renderReminders } from './views/reminders.js';
import { renderRoutine } from './views/routine.js';

const ROUTES = { home: renderHome, routine: renderRoutine, diary: renderDiary, products: renderProducts, ai: renderAi, profile: renderProfile, reminders: renderReminders };
const TABS = [
  ['home', 'Главная', 'home'],
  ['routine', 'Уход', 'drop'],
  ['diary', 'Дневник', 'book'],
  ['products', 'Косметика', 'bottle'],
  ['ai', 'AI', 'spark'],
];

const view = document.getElementById('view');
const nav = document.getElementById('nav');
let renderToken = 0;
let lastRoute = '';

function parseRoute() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, ...rest] = path.split('/');
  return { name: ROUTES[name] ? name : 'home', rest, query: new URLSearchParams(query || '') };
}

function renderNav(active) {
  nav.replaceChildren(
    h('div.nav-brand', 'Skinly'),
    ...TABS.map(([id, label, ic]) => h('a', {
      href: `#/${id}`,
      class: id === active ? 'on' : '',
      'aria-current': id === active ? 'page' : undefined,
    }, icon(ic, 23), h('span', label))),
  );
}

async function render() {
  const token = ++renderToken;
  const route = parseRoute();
  const key = `${route.name}/${route.rest.join('/')}`;
  const profile = await getProfile();
  try {
    const node = profile.onboarded ? await ROUTES[route.name](route) : renderOnboarding();
    if (token !== renderToken) return;
    if (key !== lastRoute) {
      lastRoute = key;
      window.scrollTo(0, 0);
      node.classList.add('enter');
    }
    view.replaceChildren(node);
    renderNav(['profile', 'reminders'].includes(route.name) ? 'home' : route.name);
    document.getElementById('app').classList.toggle('bare', !profile.onboarded);
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('div.page', h('div.card', h('h2', 'Не удалось открыть раздел'), h('p.muted', 'Локальное хранилище недоступно. Проверьте, что браузер не в приватном режиме.'))));
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('skinly:refresh', render);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// Дата могла смениться, пока приложение было свёрнуто или открыто ночью.
let currentDay = new Date().getDate();
setInterval(() => {
  if (new Date().getDate() !== currentDay) {
    currentDay = new Date().getDate();
    render();
  }
}, 60000);

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'AbortError') return;
  console.error(e.reason);
  toast('Что-то пошло не так. Попробуйте ещё раз.', 'error');
});

async function boot() {
  await render();
  startReminderLoop();
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (err) {
      console.warn('Service worker не зарегистрирован', err);
    }
  }
  // Просим браузер не вытеснять данные: фото и дневник живут только на устройстве.
  navigator.storage?.persist?.().catch(() => {});
}

boot();
