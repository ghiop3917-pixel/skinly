import { analyzeInci, getStatus } from '../api.js';
import { buildContext } from '../context.js';
import { db } from '../db.js';
import { getAnalyses, getProducts, uid } from '../state.js';
import { confirmSheet, formatDate, h, icon, pickPhoto, rerender, toast } from '../ui.js';

const ui = { text: '', image: null, title: '', busy: false, result: null };
const FLAGS = { irritant: 'Возможный раздражитель', attention: 'Обратите внимание' };

function group(title, nodes) {
  return nodes.length ? h('section.card', h('h3', title), nodes) : null;
}

function resultView(r) {
  if (!r.recognized) return h('div.notice', h('b', 'Состав не распознан'), h('p', r.summary || 'Попробуйте вставить текст или сделать более чёткое фото.'));
  return h('div.stack',
    h('section.card.summary', h('p.eyebrow', 'Заключение'), r.productType && h('p.muted', r.productType), h('p', r.summary)),
    group('Потенциальные раздражители', r.irritants.map((i) => h('div.item', h('b', i.name), h('p.muted', i.why)))),
    group('Возможные конфликты', r.conflicts.map((i) => h('div.item', h('b', i.with), h('p.muted', i.why)))),
    group('Хорошо сочетается', r.combinesWith.length ? [h('ul.plain', r.combinesWith.map((c) => h('li', c)))] : []),
    group(`Ингредиенты (${r.ingredients.length})`, r.ingredients.map((i) => h('div.item',
      h('div.item-head', h('b', i.name), FLAGS[i.flag] && h('span.pill', { class: i.flag }, FLAGS[i.flag])),
      h('p.muted', i.purpose)))),
    h('p.hint.center', 'Это ориентир, а не медицинское заключение. Реакция кожи индивидуальна: новое средство лучше сначала проверить на небольшом участке.'));
}

async function run() {
  if (ui.busy) return;
  if (!ui.text.trim() && !ui.image) {
    toast('Вставьте состав или добавьте фото', 'error');
    return;
  }
  ui.busy = true;
  ui.result = null;
  rerender();
  try {
    const context = await buildContext();
    delete context.diary;
    const result = await analyzeInci({ inci: ui.text, image: ui.image, context });
    ui.result = result;
    if (result.recognized) {
      await db.put('analyses', { id: uid(), createdAt: new Date().toISOString(), title: ui.title || result.productType || 'Состав', inci: ui.text, result });
    }
  } catch (err) {
    toast(err.message, 'error');
  }
  ui.busy = false;
  rerender();
}

export async function renderScan(route) {
  const productId = route.query.get('product');
  const [status, products, history] = await Promise.all([getStatus(), getProducts(), getAnalyses()]);
  if (productId) {
    const p = products.find((x) => x.id === productId);
    if (p) {
      ui.text = p.inci;
      ui.title = p.name;
      ui.image = null;
      ui.result = null;
    }
    window.history.replaceState(null, '', '#/ai/scan');
  }
  const withInci = products.filter((p) => p.inci);
  const blocked = !status.ai || status.offline;

  return h('div.stack',
    blocked && h('div.notice',
      h('b', status.ai ? 'Нет интернета' : 'AI пока не подключён'),
      status.ai ? h('p', 'Для анализа нужно соединение.') : h('a.link-inline', { href: '#/profile' }, 'Добавить ключ Grok в профиле')),
    h('section.card.stack',
      h('textarea', { rows: 5, value: ui.text, maxLength: 8000, 'aria-label': 'Состав', placeholder: 'Вставьте состав: Aqua, Glycerin, Niacinamide…', oninput: (e) => { ui.text = e.target.value; ui.title = ''; } }),
      ui.image && h('div.attach', h('img', { src: ui.image, alt: 'Фото состава' }), h('button.photo-del', { type: 'button', 'aria-label': 'Убрать фото', onclick: () => { ui.image = null; rerender(); } }, icon('close', 14))),
      withInci.length > 0 && h('select', {
        'aria-label': 'Взять состав из моей косметики',
        onchange: (e) => {
          const p = products.find((x) => x.id === e.target.value);
          if (p) { ui.text = p.inci; ui.title = p.name; ui.image = null; rerender(); }
        },
      }, h('option', { value: '' }, 'Взять состав из моей косметики'), withInci.map((p) => h('option', { value: p.id }, p.name))),
      h('div.row-actions',
        h('button.btn.ghost', { type: 'button', onclick: async () => { const src = await pickPhoto(1600, 0.85); if (src) { ui.image = src; rerender(); } } }, icon('camera', 18), 'Фото состава'),
        h('button.btn', { type: 'button', disabled: ui.busy || blocked, onclick: run }, ui.busy ? 'Анализирую…' : 'Разобрать'))),
    ui.busy && h('div.card.loading', h('span.dots', h('i'), h('i'), h('i')), h('p.muted', 'Обычно это занимает до минуты')),
    ui.result && resultView(ui.result),
    history.length > 0 && h('h2.section-title', 'История анализов'),
    history.length > 0 && h('ul.history', history.slice(0, 20).map((a) => h('li',
      h('div.history-row',
        h('button.link-row', { type: 'button', onclick: () => { ui.result = a.result; ui.text = a.inci; ui.title = a.title; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
          h('b', a.title), h('span.muted', formatDate(new Date(a.createdAt), { day: 'numeric', month: 'long' }))),
        h('button.icon-btn', {
          type: 'button',
          'aria-label': 'Удалить анализ',
          onclick: async () => {
            if (!(await confirmSheet({ title: 'Удалить анализ?', text: `«${a.title}» исчезнет из истории.`, action: 'Удалить' }))) return;
            await db.del('analyses', a.id);
            rerender();
          },
        }, icon('trash', 18)))))));
}
