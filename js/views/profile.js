import { PREFERENCES, SENSITIVITY, SKIN_TYPES } from '../data.js';
import { STORES, db } from '../db.js';
import { getProfile, getSettings, saveProfile, saveSettings } from '../state.js';
import { chips, confirmSheet, field, h, icon, rerender, toast } from '../ui.js';
import { resetChat } from './chat.js';

const EXPORT_FORMAT = 'skinly-export';

async function exportData() {
  const stores = {};
  for (const s of STORES) stores[s] = await db.all(s);
  // Ключ AI в файл экспорта не попадает.
  stores.kv = stores.kv.map((row) => (row.id === 'settings' ? { ...row, value: { ...row.value, aiKey: '' } } : row));
  const blob = new Blob([JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), stores })], { type: 'application/json' });
  const name = `skinly-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  // В приложении с экрана «Домой» на iPhone скачивание по ссылке ненадёжно, там есть системное меню.
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(hover: none)').matches) {
    await navigator.share({ files: [file], title: 'Данные Skinly' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Файл с данными сохранён');
}

async function importData() {
  const file = await pickImportFile();
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  if (data?.format !== EXPORT_FORMAT || typeof data.stores !== 'object') {
    toast('Это не файл экспорта Skinly', 'error');
    return;
  }
  if (!(await confirmSheet({ title: 'Загрузить данные?', text: 'Текущие данные на этом устройстве будут заменены данными из файла.', action: 'Заменить' }))) return;
  const { aiKey } = await getSettings();
  for (const s of STORES) {
    await db.clear(s);
    for (const row of data.stores[s] || []) await db.put(s, row);
  }
  await saveSettings({ ...(await getSettings()), aiKey });
  resetChat();
  toast('Данные загружены');
  rerender();
}

function pickImportFile() {
  return new Promise((resolve) => {
    const input = h('input.hidden-input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    input.addEventListener('cancel', () => { resolve(null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

async function deleteAll() {
  if (!(await confirmSheet({ title: 'Удалить все данные?', text: 'Профиль, дневник, фото, косметика, прогресс, чат и ключ AI будут удалены с этого устройства без возможности восстановления.', action: 'Удалить всё' }))) return;
  for (const s of STORES) await db.clear(s);
  resetChat();
  location.hash = '#/home';
  rerender();
}

export async function renderProfile() {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const save = async () => { await saveProfile(profile); };
  const saveTime = (key) => async (e) => {
    if (!e.target.value) return;
    settings[key] = e.target.value;
    await saveSettings(settings);
  };

  return h('div.page',
    h('header.top', h('div.title-row', h('a.icon-btn', { href: '#/home', 'aria-label': 'Назад' }, icon('left', 22)), h('h1', 'Профиль'))),
    h('section.card.stack',
      field('Имя', h('input', { type: 'text', value: profile.name, maxLength: 40, onchange: (e) => { profile.name = e.target.value.trim(); save(); } })),
      field('Тип кожи', chips(SKIN_TYPES, profile.skinType, (v) => { profile.skinType = v; save(); })),
      field('Чувствительность', chips(SENSITIVITY, profile.sensitivity, (v) => { profile.sensitivity = v; save(); })),
      field('Предпочтения', chips(PREFERENCES, profile.preferences, (v) => { profile.preferences = v; save(); }, { multi: true })),
      field('Что ещё важно учитывать', h('textarea', { rows: 2, maxLength: 500, value: profile.prefNote, placeholder: 'Аллергии, бюджет, любимые текстуры', onchange: (e) => { profile.prefNote = e.target.value.trim(); save(); } }))),
    h('section.card',
      h('h3', 'Время ухода'),
      h('div.setting', h('b', 'Утренний уход'), h('input.time', { type: 'time', value: settings.morningTime, 'aria-label': 'Утренний уход', onchange: saveTime('morningTime') })),
      h('div.setting', h('b', 'Вечерний уход'), h('input.time', { type: 'time', value: settings.eveningTime, 'aria-label': 'Вечерний уход', onchange: saveTime('eveningTime') })),
      h('a.setting', { href: '#/reminders' }, h('b', 'Настройки уведомлений'), icon('right', 18))),
    h('section.card.stack',
      h('h3', 'AI'),
      h('p.muted', 'AI уже работает бесплатно, настраивать ничего не нужно.'),
      field('Ключ OpenRouter (необязательно)', h('input', { type: 'password', autocomplete: 'off', value: settings.aiKey, placeholder: 'sk-or-…', onchange: async (e) => { settings.aiKey = e.target.value.trim(); await saveSettings(settings); toast(settings.aiKey ? 'Ключ сохранён' : 'Ключ удалён'); } }), 'Бесплатный ключ с openrouter.ai делает ответы сильнее и включает фото. Хранится только на этом устройстве.')),
    h('section.card.stack',
      h('h3', 'Данные'),
      h('p.muted', 'Профиль, дневник и фото хранятся только на этом устройстве. В бесплатный AI-сервис (Pollinations или OpenRouter) уходят ваш запрос и краткая сводка для ответа. Такие сервисы могут использовать запросы для обучения. Фото дневника не отправляются.'),
      h('button.btn.ghost.wide', { type: 'button', onclick: exportData }, 'Экспорт данных'),
      h('button.btn.ghost.wide', { type: 'button', onclick: importData }, 'Загрузить из файла'),
      h('button.btn.ghost.wide.danger-text', { type: 'button', onclick: deleteAll }, 'Удалить все данные')),
    h('p.hint.center', 'Skinly помогает с уходом, но не ставит диагнозы и не заменяет врача.'));
}
