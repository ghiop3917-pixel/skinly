import { CATEGORIES, FREQUENCIES } from '../data.js';
import { db } from '../db.js';
import { getProducts, uid } from '../state.js';
import { confirmSheet, field, formatDate, go, h, icon, openSheet, pickPhoto, plural, rerender, toast } from '../ui.js';

const ui = { query: '', category: '' };

function select(options, value) {
  return h('select', { value }, h('option', { value: '' }, 'Не выбрано'), options.map((o) => h('option', { value: o, selected: o === value }, o)));
}

function editProduct(product) {
  const data = product ? { ...product } : { id: uid(), name: '', brand: '', category: '', photo: '', inci: '', notes: '', frequency: '', addedAt: new Date().toISOString() };
  openSheet(product ? 'Редактировать средство' : 'Новое средство', (body, close) => {
    const name = h('input', { type: 'text', value: data.name, required: true, maxLength: 100, placeholder: 'Название средства' });
    const brand = h('input', { type: 'text', value: data.brand, maxLength: 80, placeholder: 'Бренд' });
    const category = select(CATEGORIES, data.category);
    const frequency = select(FREQUENCIES, data.frequency);
    const inci = h('textarea', { rows: 4, value: data.inci, maxLength: 8000, placeholder: 'Aqua, Glycerin, Niacinamide…' });
    const notes = h('textarea', { rows: 2, value: data.notes, maxLength: 1000, placeholder: 'Впечатления, срок годности' });
    const photo = h('div.photos');
    const paint = () => photo.replaceChildren(data.photo
      ? h('div.photo', h('img', { src: data.photo, alt: 'Фото средства' }), h('button.photo-del', { type: 'button', 'aria-label': 'Удалить фото', onclick: () => { data.photo = ''; paint(); } }, icon('close', 14)))
      : h('button.photo-add', { type: 'button', 'aria-label': 'Добавить фото', onclick: async () => { const src = await pickPhoto(800, 0.78); if (src) { data.photo = src; paint(); } } }, icon('camera', 22)));
    paint();
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        Object.assign(data, { name: name.value.trim(), brand: brand.value.trim(), category: category.value, frequency: frequency.value, inci: inci.value.trim(), notes: notes.value.trim() });
        if (!data.name) return;
        await db.put('products', data);
        close();
        toast(product ? 'Изменения сохранены' : 'Средство добавлено');
        rerender();
      },
    },
    h('div.field', h('span.field-label', 'Фотография'), photo),
    field('Название', name), field('Бренд', brand), field('Категория', category),
    field('Состав INCI', inci), field('Частота использования', frequency), field('Заметки', notes),
    h('button.btn.wide', { type: 'submit' }, 'Сохранить')));
  });
}

function showProduct(p) {
  openSheet(p.name, (body, close) => {
    body.append(
      p.photo && h('img.product-photo', { src: p.photo, alt: p.name }),
      h('dl.metrics',
        p.brand && [h('dt', 'Бренд'), h('dd', p.brand)],
        p.category && [h('dt', 'Категория'), h('dd', p.category)],
        p.frequency && [h('dt', 'Частота'), h('dd', p.frequency)],
        h('dt', 'Добавлено'), h('dd', formatDate(new Date(p.addedAt), { day: 'numeric', month: 'long', year: 'numeric' }))),
      p.inci && h('div', h('p.field-label', 'Состав'), h('p.pre.small', p.inci)),
      p.notes && h('div', h('p.field-label', 'Заметки'), h('p.pre', p.notes)),
      h('div.stack',
        p.inci && h('button.btn.wide', { type: 'button', onclick: () => { close(); go(`#/ai/scan?product=${p.id}`); } }, icon('flask', 18), 'Разобрать состав'),
        h('button.btn.ghost.wide', { type: 'button', onclick: () => { close(); editProduct(p); } }, 'Редактировать'),
        h('button.btn.ghost.wide.danger-text', {
          type: 'button',
          onclick: async () => {
            if (!(await confirmSheet({ title: 'Удалить средство?', text: `«${p.name}» будет удалено из каталога.`, action: 'Удалить' }))) return;
            await db.del('products', p.id);
            close();
            toast('Средство удалено');
            rerender();
          },
        }, 'Удалить')),
    );
  });
}

export async function renderProducts() {
  const products = await getProducts();
  const grid = h('div.product-grid');
  const counter = h('p.muted');
  const paint = () => {
    const q = ui.query.toLowerCase();
    const found = products.filter((p) => (!ui.category || p.category === ui.category)
      && (!q || `${p.name} ${p.brand} ${p.inci}`.toLowerCase().includes(q)));
    counter.textContent = `${found.length} ${plural(found.length, 'средство', 'средства', 'средств')}`;
    grid.replaceChildren(...found.map((p) => h('button.product', { type: 'button', onclick: () => showProduct(p) },
      h('div.product-img', p.photo ? h('img', { src: p.photo, alt: '' }) : icon('bottle', 30)),
      h('b', p.name),
      h('span.muted', [p.brand, p.category].filter(Boolean).join(' · ')))));
    if (!found.length) grid.append(h('p.empty.full', products.length ? 'Ничего не найдено.' : 'Каталог пуст. Добавьте первое средство.'));
  };
  paint();
  const used = CATEGORIES.filter((c) => products.some((p) => p.category === c));

  return h('div.page',
    h('header.top',
      h('h1', 'Моя косметика'),
      h('button.btn.small', { type: 'button', onclick: () => editProduct() }, icon('plus', 17), 'Добавить')),
    products.length > 0 && h('div.search', icon('search', 18), h('input', { type: 'search', placeholder: 'Название, бренд или ингредиент', 'aria-label': 'Поиск', value: ui.query, oninput: (e) => { ui.query = e.target.value; paint(); } })),
    used.length > 1 && h('div.chips.scroll', ['', ...used].map((c) => h('button.chip', { type: 'button', class: ui.category === c ? 'on' : '', onclick: () => { ui.category = c; rerender(); } }, c || 'Все'))),
    products.length > 0 && counter,
    grid);
}
