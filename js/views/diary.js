import { LEVELS, OILINESS, OVERALL } from '../data.js';
import { db } from '../db.js';
import { dateKey, getDiary, getProducts, parseKey } from '../state.js';
import { chips, confirmSheet, field, formatDate, h, icon, openSheet, pickPhoto, rerender, toast } from '../ui.js';

const MAX_PHOTOS = 3;
const METRICS = [['overall', 'Общее состояние', OVERALL], ['oiliness', 'Сухость / жирность', OILINESS], ['redness', 'Покраснения', LEVELS], ['breakouts', 'Высыпания', LEVELS], ['sensitivity', 'Чувствительность', LEVELS]];
const ui = { month: null };

function scale(options, value, onChange) {
  return chips(options, options[value] ?? '', (v) => onChange(v ? options.indexOf(v) : null));
}

async function editEntry(date, existing) {
  const products = await getProducts();
  const entry = existing ? structuredClone(existing) : { id: date, overall: 2, oiliness: 2, redness: 0, breakouts: 0, sensitivity: 0, products: [], notes: '', photos: [] };
  openSheet(formatDate(parseKey(date), { day: 'numeric', month: 'long' }), (body, close) => {
    const photos = h('div.photos');
    const paintPhotos = () => {
      photos.replaceChildren(
        ...entry.photos.map((src, i) => h('div.photo', h('img', { src, alt: 'Фото кожи' }), h('button.photo-del', { type: 'button', 'aria-label': 'Удалить фото', onclick: () => { entry.photos.splice(i, 1); paintPhotos(); } }, icon('close', 14)))),
        entry.photos.length < MAX_PHOTOS ? h('button.photo-add', {
          type: 'button',
          'aria-label': 'Добавить фото',
          onclick: async () => {
            const src = await pickPhoto(1000, 0.78);
            if (src) { entry.photos.push(src); paintPhotos(); }
          },
        }, icon('camera', 22)) : '',
      );
    };
    paintPhotos();
    const notes = h('textarea', { rows: 3, value: entry.notes, maxLength: 2000, placeholder: 'Что заметили сегодня', oninput: (e) => { entry.notes = e.target.value; } });
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        for (const [key] of METRICS) if (entry[key] === null) entry[key] = key === 'overall' || key === 'oiliness' ? 2 : 0;
        try {
          await db.put('diary', entry);
        } catch {
          toast('Не удалось сохранить: мало места на устройстве', 'error');
          return;
        }
        close();
        toast('Запись сохранена');
        rerender();
      },
    },
    METRICS.map(([key, label, options]) => field(label, scale(options, entry[key], (v) => { entry[key] = v; }))),
    products.length ? field('Использованные средства', chips(products.map((p) => p.name), entry.products, (v) => { entry.products = v; }, { multi: true })) : null,
    field('Заметки', notes),
    h('div.field', h('span.field-label', 'Фотографии'), photos, h('span.hint', 'Необязательно. Хранятся только на устройстве и не отправляются AI.')),
    h('button.btn.wide', { type: 'submit' }, 'Сохранить'),
    existing && h('button.btn.ghost.wide.danger-text', {
      type: 'button',
      onclick: async () => {
        if (!(await confirmSheet({ title: 'Удалить запись?', text: 'Запись и её фотографии будут удалены.', action: 'Удалить' }))) return;
        await db.del('diary', date);
        close();
        rerender();
      },
    }, 'Удалить запись')));
  });
}

function calendar(entries, selected) {
  const [year, month] = ui.month.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const count = new Date(year, month, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const today = dateKey();
  const cells = Array.from({ length: offset }, () => h('span'));
  for (let d = 1; d <= count; d++) {
    const key = dateKey(new Date(year, month - 1, d));
    const entry = entries.get(key);
    cells.push(h('button.cal-day', {
      type: 'button',
      disabled: key > today,
      class: [key === selected ? 'on' : '', key === today ? 'today' : '', entry ? `lvl${entry.overall}` : ''].join(' '),
      'aria-label': `${d}${entry ? `, ${OVERALL[entry.overall]}` : ''}`,
      onclick: () => { location.hash = `#/diary/${key}`; },
    }, d));
  }
  const shift = (n) => {
    const m = new Date(year, month - 1 + n, 1);
    ui.month = dateKey(m).slice(0, 7);
    rerender();
  };
  return h('section.card',
    h('div.cal-head',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Предыдущий месяц', onclick: () => shift(-1) }, icon('left', 20)),
      h('h3.cap', formatDate(first, { month: 'long', year: 'numeric' })),
      h('button.icon-btn', { type: 'button', disabled: ui.month >= today.slice(0, 7), 'aria-label': 'Следующий месяц', onclick: () => shift(1) }, icon('right', 20))),
    h('div.cal-grid.cal-names', ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((n) => h('span', n))),
    h('div.cal-grid', cells));
}

function entryDetails(date, entry) {
  const title = date === dateKey() ? 'Сегодня' : formatDate(parseKey(date), { day: 'numeric', month: 'long' });
  if (!entry) {
    return h('section.card',
      h('h3', title),
      h('p.muted', 'Записи за этот день нет.'),
      h('button.btn.wide', { type: 'button', onclick: () => editEntry(date) }, icon('plus', 18), 'Добавить запись'));
  }
  return h('section.card',
    h('div.card-head', h('h3', title), h('button.btn.small.ghost', { type: 'button', onclick: () => editEntry(date, entry) }, 'Изменить')),
    h('dl.metrics', METRICS.map(([key, label, options]) => [h('dt', label), h('dd', options[entry[key]])])),
    entry.products.length > 0 && h('p.muted', `Средства: ${entry.products.join(', ')}`),
    entry.notes && h('p.pre', entry.notes),
    entry.photos.length > 0 && h('div.photos', entry.photos.map((src) => h('div.photo', h('img', { src, alt: 'Фото кожи' })))));
}

// Что изменилось относительно предыдущей записи.
function changes(entry, prev) {
  if (!prev) return [];
  return METRICS.filter(([key]) => entry[key] !== prev[key]).map(([key, label, options]) => `${label}: ${options[prev[key]]} → ${options[entry[key]]}`);
}

export async function renderDiary(route) {
  const today = dateKey();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(route.rest[0] || '') ? route.rest[0] : today;
  if (!ui.month || route.rest[0]) ui.month = selected.slice(0, 7);
  const list = await getDiary();
  const entries = new Map(list.map((e) => [e.id, e]));

  return h('div.page',
    h('header.top', h('h1', 'Дневник кожи')),
    h('div.grid',
      calendar(entries, selected),
      entryDetails(selected, entries.get(selected))),
    h('h2.section-title', 'История изменений'),
    list.length
      ? h('ul.history', list.slice(0, 30).map((e, i) => {
        const diff = changes(e, list[i + 1]);
        return h('li', h('a', { href: `#/diary/${e.id}` },
          h('div.card-head', h('b', formatDate(parseKey(e.id), { day: 'numeric', month: 'long' })), h('span.pill', { class: `lvl${e.overall}` }, OVERALL[e.overall])),
          diff.length ? diff.map((t) => h('p.muted', t)) : h('p.muted', list[i + 1] ? 'Без изменений' : 'Первая запись')));
      }))
      : h('p.empty', 'Здесь появится динамика, когда вы сделаете первые записи.'),
    h('p.hint.center', 'Дневник помогает замечать изменения, но не заменяет осмотр у дерматолога.'));
}
