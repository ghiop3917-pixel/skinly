import { addDays, dateKey, getDay, getRoutines, parseKey, progress, saveRoutines, toggleStep, uid } from '../state.js';
import { bar, confirmSheet, field, formatDate, h, icon, openSheet, rerender, segmented, toast } from '../ui.js';

const ui = { date: null, editing: false, part: null };

async function persist(routines) {
  await saveRoutines(routines);
  rerender();
}

function editStep(routines, part, step) {
  const isNew = !step;
  openSheet(isNew ? 'Новый этап' : 'Этап ухода', (body, close) => {
    const title = h('input', { type: 'text', value: step?.title || '', maxLength: 60, required: true, placeholder: 'Например, патчи для глаз' });
    const desc = h('textarea', { rows: 2, value: step?.desc || '', maxLength: 200, placeholder: 'Короткое описание' });
    const time = h('input', { type: 'time', value: step?.reminder || '' });
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        const data = { title: title.value.trim(), desc: desc.value.trim(), reminder: time.value || '' };
        if (!data.title) return;
        if (isNew) routines[part].push({ id: uid(), ...data });
        else Object.assign(routines[part].find((s) => s.id === step.id), data);
        close();
        await persist(routines);
      },
    },
    field('Название', title),
    field('Описание', desc),
    field('Время напоминания', time, 'Необязательно. Управление уведомлениями — в разделе «Напоминания».'),
    h('button.btn.wide', { type: 'submit' }, 'Сохранить'),
    !isNew && h('button.btn.ghost.wide.danger-text', {
      type: 'button',
      onclick: async () => {
        if (!(await confirmSheet({ title: 'Удалить этап?', text: `Этап «${step.title}» исчезнет из рутины.`, action: 'Удалить' }))) return;
        routines[part] = routines[part].filter((s) => s.id !== step.id);
        close();
        await persist(routines);
        toast('Этап удалён');
      },
    }, 'Удалить этап')));
  });
}

async function move(routines, part, index, delta) {
  const list = routines[part];
  [list[index], list[index + delta]] = [list[index + delta], list[index]];
  await persist(routines);
}

async function weekStrip(routines, today) {
  const keys = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const days = await Promise.all(keys.map(getDay));
  const all = [...routines.morning, ...routines.evening];
  return h('div.week', keys.map((key, i) => {
    const d = parseKey(key);
    const p = progress(all, days[i]);
    return h('button.week-day', {
      type: 'button',
      class: key === ui.date ? 'on' : '',
      'aria-label': formatDate(d, { day: 'numeric', month: 'long' }),
      onclick: () => { ui.date = key; rerender(); },
    }, h('span', formatDate(d, { weekday: 'short' })), h('b', d.getDate()), h('i', { class: p.ratio === 1 ? 'full' : p.done ? 'part' : '' }));
  }));
}

export async function renderRoutine(route) {
  const today = dateKey();
  if (!ui.date || ui.date > today) ui.date = today;
  if (route.rest[0]) ui.part = route.rest[0] === 'evening' ? 'evening' : 'morning';
  if (!ui.part) ui.part = new Date().getHours() >= 15 ? 'evening' : 'morning';
  const part = ui.part;
  const routines = await getRoutines();
  const day = await getDay(ui.date);
  const steps = routines[part];
  const prog = progress(steps, day);

  return h('div.page',
    h('header.top',
      h('h1', 'Уход'),
      h('button.btn.small.ghost', { type: 'button', onclick: () => { ui.editing = !ui.editing; rerender(); } }, ui.editing ? 'Готово' : 'Изменить')),
    segmented([['morning', 'Утро', 'sun'], ['evening', 'Вечер', 'moon']], part, (v) => { ui.part = v; location.hash = `#/routine/${v}`; }),
    await weekStrip(routines, today),
    h('div.card',
      h('div.card-head',
        h('h3', ui.date === today ? 'Сегодня' : formatDate(parseKey(ui.date), { day: 'numeric', month: 'long' })),
        h('span.count', `${prog.done} из ${prog.total}`)),
      bar(prog.ratio)),
    h('ul.steps', steps.map((s, i) => h('li.step', { class: day.done[s.id] ? 'done' : '' },
      h('button.check', {
        type: 'button',
        'aria-label': `${s.title}: ${day.done[s.id] ? 'отменить' : 'отметить'}`,
        'aria-pressed': Boolean(day.done[s.id]),
        onclick: async () => { await toggleStep(ui.date, s.id); rerender(); },
      }, icon('check', 18)),
      h('button.step-text', { type: 'button', onclick: () => editStep(routines, part, s) },
        h('b', s.title),
        s.desc && h('span.muted', s.desc),
        s.reminder && h('span.step-time', icon('bell', 13), s.reminder)),
      ui.editing && h('div.step-tools',
        h('button.icon-btn', { type: 'button', disabled: i === 0, 'aria-label': 'Выше', onclick: () => move(routines, part, i, -1) }, icon('up', 19)),
        h('button.icon-btn', { type: 'button', disabled: i === steps.length - 1, 'aria-label': 'Ниже', onclick: () => move(routines, part, i, 1) }, icon('down', 19)))))),
    !steps.length && h('p.empty', 'В этой рутине пока нет этапов.'),
    h('button.btn.ghost.wide', { type: 'button', onclick: () => editStep(routines, part, null) }, icon('plus', 18), 'Добавить этап'));
}
