const ICONS = {
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
  drop: '<path d="M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12z"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
  bottle: '<path d="M10 3h4v3h-4z"/><path d="M9 6h6l2 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9z"/><path d="M7 13h10"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.5 4.2-5 7.5-5s6.100 1.500 7.500 5"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z"/><path d="M10 20a2.200 2.200 0 0 0 4 0"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.500 7l1 13h9l1-13"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M12 19V6M6 11.500L12 5.500l6 6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  camera: '<path d="M4 8h3.500L9 5.500h6L16.500 8H20v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>',
  moon: '<path d="M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10z"/>',
  flask: '<path d="M10 3h4M11 3v6l-5.500 9.500A1.700 1.700 0 0 0 7 21h10a1.700 1.700 0 0 0 1.500-2.500L13 9V3"/><path d="M8 15h8"/>',
  chat: '<path d="M4 5h16v12H9l-5 4z"/>',
};

export function icon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

// h('div.card', { onclick }, 'текст', node, [nodes]) — текст всегда вставляется как текст, не как HTML.
export function h(spec, props, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props instanceof Node || typeof props !== 'object' || props === null || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'style') Object.assign(el.style, value);
    else if (key === 'class') el.classList.add(...String(value).split(' ').filter(Boolean));
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export function toast(text, type = '') {
  const el = h('div.toast', { class: type }, text);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

export const rerender = () => window.dispatchEvent(new Event('skinly:refresh'));
export const go = (hash) => { location.hash = hash; };

export function openSheet(title, build) {
  const previous = document.activeElement;
  const body = h('div.sheet-body');
  const close = () => {
    overlay.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      overlay.remove();
      if (!document.querySelector('.overlay')) document.body.classList.remove('locked');
      previous?.focus?.();
    }, 220);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabIndex: -1 },
    h('div.sheet-head', h('h2', title), h('button.icon-btn', { type: 'button', onclick: close, 'aria-label': 'Закрыть' }, icon('close'))),
    body);
  const overlay = h('div.overlay', { onclick: (e) => { if (e.target === overlay) close(); } }, panel);
  document.body.append(overlay);
  document.body.classList.add('locked');
  document.addEventListener('keydown', onKey);
  build(body, close);
  panel.focus();
  return close;
}

export function confirmSheet({ title, text, action, danger = true }) {
  return new Promise((resolve) => {
    openSheet(title, (body, close) => {
      body.append(
        h('p.muted', text),
        h('div.row-actions',
          h('button.btn.ghost', { type: 'button', onclick: () => { resolve(false); close(); } }, 'Отмена'),
          h('button.btn', { type: 'button', class: danger ? 'danger' : '', onclick: () => { resolve(true); close(); } }, action)),
      );
    });
  });
}

export function field(label, control, hint) {
  return h('label.field', h('span.field-label', label), control, hint && h('span.hint', hint));
}

export function chips(options, selected, onChange, { multi = false } = {}) {
  const wrap = h('div.chips');
  let value = multi ? new Set(selected) : selected;
  const paint = () => {
    for (const b of wrap.children) {
      const on = multi ? value.has(b.dataset.v) : value === b.dataset.v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    }
  };
  for (const opt of options) {
    wrap.append(h('button.chip', {
      type: 'button',
      'data-v': opt,
      onclick: () => {
        if (multi) {
          if (value.has(opt)) value.delete(opt); else value.add(opt);
          onChange([...value]);
        } else {
          value = value === opt ? '' : opt;
          onChange(value);
        }
        paint();
      },
    }, opt));
  }
  paint();
  return wrap;
}

export function segmented(options, value, onChange) {
  return h('div.segmented', { role: 'tablist' }, options.map(([v, label, ic]) => h('button', {
    type: 'button',
    class: v === value ? 'on' : '',
    role: 'tab',
    'aria-selected': v === value,
    onclick: () => onChange(v),
  }, ic && icon(ic, 18), label)));
}

export function ring(ratio, label) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 84 84');
  svg.setAttribute('class', 'ring');
  svg.innerHTML = `<circle cx="42" cy="42" r="${r}" class="ring-bg"/><circle cx="42" cy="42" r="${r}" class="ring-fg" stroke-dasharray="${c * ratio} ${c}" transform="rotate(-90 42 42)"/>`;
  return h('div.ring-wrap', svg, h('span.ring-label', label));
}

export function bar(ratio) {
  return h('div.bar', h('i', { style: { width: `${Math.round(ratio * 100)}%` } }));
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

export function renderMarkdown(text) {
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    .map((p) => (p.startsWith('**') && p.endsWith('**') ? h('strong', p.slice(2, -2)) : document.createTextNode(p)));
  const root = document.createDocumentFragment();
  let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      if (!list) { list = h('ul'); root.append(list); }
      list.append(h('li', inline(item[1])));
      continue;
    }
    list = null;
    if (!line) continue;
    const head = line.match(/^#{1,6}\s+(.*)$/);
    root.append(head ? h('p', h('strong', head[1].replaceAll('**', ''))) : h('p', inline(line)));
  }
  return root;
}

export function pickImage() {
  return new Promise((resolve) => {
    const input = h('input.hidden-input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    input.addEventListener('cancel', () => { resolve(null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export async function compressImage(file, max = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = h('canvas', { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pickPhoto(max, quality) {
  const file = await pickImage();
  if (!file) return null;
  try {
    return await compressImage(file, max, quality);
  } catch {
    toast('Не удалось открыть изображение', 'error');
    return null;
  }
}

export const formatDate = (d, opts) => new Intl.DateTimeFormat('ru-RU', opts).format(d);
