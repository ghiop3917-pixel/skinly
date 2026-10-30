import { REMINDER_PRESETS, WEEKDAYS, WEEK_INDEX } from '../data.js';
import { buildReminders, disableNotifications, enableNotifications, environment } from '../notifications.js';
import { getCustomReminders, getSettings, saveCustomReminders, saveSettings, uid } from '../state.js';
import { confirmSheet, field, h, icon, openSheet, rerender, toast } from '../ui.js';

const BASE_TIME = { morning: 'morningTime', evening: 'eveningTime', spf: 'spfTime' };

const OPEN_ONLY = 'Skinly работает без сервера, поэтому при закрытом приложении напоминания не придут.';

function statusNote(env, settings) {
  if (env.isIOS && !env.standalone) return ['Только внутри приложения', `В Safari на iPhone системных уведомлений нет. ${OPEN_ONLY}`];
  if (!env.notification) return ['Только внутри приложения', OPEN_ONLY];
  if (env.permission === 'denied') return ['Уведомления запрещены', 'Разрешите их для Skinly в настройках устройства или браузера.'];
  if (!settings.notify.enabled) return ['Уведомления выключены', `Пока приложение открыто, напоминания появляются внутри него. ${OPEN_ONLY}`];
  return ['Работают только при открытом приложении', OPEN_ONLY];
}

function editCustom(item) {
  const data = item ? { ...item } : { id: uid(), title: '', time: '10:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true };
  openSheet(item ? 'Напоминание' : 'Новое напоминание', (body, close) => {
    const title = h('input', { type: 'text', value: data.title, required: true, maxLength: 80, placeholder: 'Например, сменить наволочку' });
    const time = h('input', { type: 'time', value: data.time, required: true });
    const days = h('div.chips', WEEK_INDEX.map((d, i) => {
      const b = h('button.chip', {
        type: 'button',
        class: data.days.includes(d) ? 'on' : '',
        onclick: () => {
          data.days = data.days.includes(d) ? data.days.filter((x) => x !== d) : [...data.days, d];
          b.classList.toggle('on');
        },
      }, WEEKDAYS[i]);
      return b;
    }));
    const write = async (fn) => {
      const list = await getCustomReminders();
      await saveCustomReminders(fn(list));
      close();
      rerender();
    };
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!data.days.length) { toast('Выберите хотя бы один день', 'error'); return; }
        Object.assign(data, { title: title.value.trim(), time: time.value });
        if (!data.title || !data.time) return;
        await write((list) => (item ? list.map((r) => (r.id === data.id ? data : r)) : [...list, data]));
      },
    },
    field('Название', title), field('Время', time), h('div.field', h('span.field-label', 'Дни'), days),
    h('button.btn.wide', { type: 'submit' }, 'Сохранить'),
    item && h('button.btn.ghost.wide.danger-text', {
      type: 'button',
      onclick: async () => {
        if (await confirmSheet({ title: 'Удалить напоминание?', text: `«${item.title}» будет удалено.`, action: 'Удалить' })) await write((list) => list.filter((r) => r.id !== item.id));
      },
    }, 'Удалить')));
  });
}

function toggle(checked, label, onchange) {
  return h('label.switch', h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onchange(e.target.checked) }), h('i'));
}

export async function renderReminders() {
  const [settings, reminders] = await Promise.all([getSettings(), buildReminders()]);
  const env = environment();
  const [noteTitle, noteText] = statusNote(env, settings);

  const update = async (fn) => {
    const s = await getSettings();
    fn(s);
    await saveSettings(s);
    rerender();
  };
  const toggleMaster = async (on) => {
    if (on) {
      if (await enableNotifications()) toast('Включено: только пока приложение открыто');
    } else {
      await disableNotifications();
      toast('Уведомления выключены');
    }
    rerender();
  };

  return h('div.page',
    h('header.top', h('div.title-row', h('a.icon-btn', { href: '#/profile', 'aria-label': 'Назад' }, icon('left', 22)), h('h1', 'Напоминания'))),
    h('section.card',
      h('div.setting', h('div', h('b', 'Системные уведомления')), toggle(settings.notify.enabled, 'Системные уведомления', toggleMaster)),
      h('div.notice.inline', h('b', noteTitle), h('p', noteText))),
    h('section.card',
      h('h3', 'Ежедневные'),
      reminders.filter((r) => r.kind === 'base').map((r) => h('div.setting',
        h('div', h('b', r.title)),
        h('input.time', { type: 'time', value: r.time, 'aria-label': `Время: ${r.title}`, onchange: (e) => { if (e.target.value) update((s) => { s[BASE_TIME[r.id]] = e.target.value; }); } }),
        toggle(r.enabled, r.title, (on) => update((s) => { s.notify[r.id] = on; }))))),
    reminders.some((r) => r.kind === 'step') && h('section.card',
      h('h3', 'Этапы ухода'),
      reminders.filter((r) => r.kind === 'step').map((r) => h('a.setting', { href: '#/routine' }, h('div', h('b', r.title), h('span.muted', r.body)), h('span.time', r.time)))),
    h('section.card',
      h('div.card-head', h('h3', 'Свои напоминания'), h('button.btn.small', { type: 'button', onclick: () => editCustom() }, icon('plus', 17), 'Добавить')),
      reminders.filter((r) => r.kind === 'custom').map((r) => h('div.setting',
        h('button.link-row', { type: 'button', onclick: async () => editCustom((await getCustomReminders()).find((c) => c.id === r.sourceId)) },
          h('b', r.title), h('span.muted', r.days.length === 7 ? 'Каждый день' : WEEK_INDEX.map((d, i) => (r.days.includes(d) ? WEEKDAYS[i] : '')).filter(Boolean).join(', '))),
        h('span.time', r.time),
        toggle(r.enabled, r.title, async (on) => {
          const list = await getCustomReminders();
          await saveCustomReminders(list.map((c) => (c.id === r.sourceId ? { ...c, enabled: on } : c)));
          rerender();
        }))),
      !reminders.some((r) => r.kind === 'custom') && h('p.muted', 'Пока нет своих напоминаний.'),
      h('div.chips', REMINDER_PRESETS.filter(([title]) => !reminders.some((r) => r.title === title)).map(([title, time, days]) => h('button.chip', {
        type: 'button',
        onclick: async () => {
          await saveCustomReminders([...(await getCustomReminders()), { id: uid(), title, time, days: days || [0, 1, 2, 3, 4, 5, 6], enabled: true }]);
          toast(`Напоминание: ${title} в ${time}`);
          rerender();
        },
      }, `+ ${title}`)))),
    h('p.hint.center', 'Пока приложение открыто, напоминания показываются внутри него.'));
}
