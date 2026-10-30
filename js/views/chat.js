import { getStatus, streamChat } from '../api.js';
import { buildContext } from '../context.js';
import { kvGet, kvSet } from '../db.js';
import { confirmSheet, h, icon, pickPhoto, renderMarkdown, rerender, toast } from '../ui.js';

const SUGGESTIONS = ['Составь мне простой уход', 'Можно ли сочетать ретинол и кислоты?', 'Что делать, если кожа стягивает?', 'Какие мои средства использовать вечером?'];
const MAX_STORED = 100;

const chat = { messages: null, streaming: null, image: null, draft: '', abort: null };

async function save() {
  // Фото в истории не храним: они нужны только для текущего вопроса.
  const stored = chat.messages.slice(-MAX_STORED).map(({ image, ...m }) => (image ? { ...m, hadImage: true } : m));
  await kvSet('chat', stored);
}

function setupCard(status) {
  if (!status.ai) return h('div.notice', h('b', 'AI пока не подключён'), h('p', 'Добавьте ключ Grok в профиле. '), h('a.link-inline', { href: '#/profile' }, 'Открыть профиль'));
  if (status.offline) return h('div.notice', h('b', 'Нет интернета'), h('p', 'Для чата нужно соединение. Остальные разделы работают офлайн.'));
  return null;
}

function bubble(m) {
  const body = h('div.bubble');
  if (m.role === 'assistant') body.append(renderMarkdown(m.content));
  else {
    if (m.image) body.append(h('img.bubble-img', { src: m.image, alt: 'Прикреплённое фото' }));
    if (m.hadImage) body.append(h('p.hint', 'Фото не сохраняется в истории'));
    if (m.content) body.append(h('p.pre', m.content));
  }
  return h('div.msg', { class: m.role }, body);
}

async function send(text) {
  const content = text.trim();
  if ((!content && !chat.image) || chat.streaming) return;
  const user = { role: 'user', content };
  if (chat.image) user.image = chat.image;
  chat.messages.push(user);
  chat.image = null;
  chat.draft = '';
  chat.streaming = { text: '', el: null };
  chat.abort = new AbortController();
  rerender();
  await save();
  try {
    const context = await buildContext();
    const recent = chat.messages.slice(-24);
    const payload = recent.map(({ role, content: c, image }, i) => ({ role, content: c, ...(image && i === recent.length - 1 ? { image } : {}) }));
    await streamChat({ messages: payload, context }, (delta) => {
      chat.streaming.text += delta;
      const el = chat.streaming.el;
      if (el?.isConnected) {
        el.replaceChildren(renderMarkdown(chat.streaming.text));
        window.scrollTo({ top: document.body.scrollHeight });
      }
    }, chat.abort.signal);
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast(err.message, 'error');
      if (!chat.streaming.text) {
        const failed = chat.messages.pop();
        chat.draft = failed.content;
        chat.image = failed.image || null;
      }
    }
  }
  if (chat.streaming.text) chat.messages.push({ role: 'assistant', content: chat.streaming.text });
  chat.streaming = null;
  chat.abort = null;
  await save();
  rerender();
}

export async function renderChat() {
  if (!chat.messages) chat.messages = await kvGet('chat', []);
  const status = await getStatus();
  const notice = setupCard(status);
  const list = h('div.messages');

  if (!chat.messages.length && !notice) {
    list.append(h('div.chat-empty',
      h('p', 'Спросите об уходе, ингредиентах или своей косметике. Я учитываю ваш профиль, средства и дневник.'),
      h('div.chips', SUGGESTIONS.map((s) => h('button.chip', { type: 'button', onclick: () => send(s) }, s)))));
  }
  list.append(...chat.messages.map(bubble));
  if (chat.streaming) {
    const el = h('div.bubble');
    if (chat.streaming.text) el.append(renderMarkdown(chat.streaming.text));
    else el.append(h('span.dots', h('i'), h('i'), h('i')));
    chat.streaming.el = el;
    list.append(h('div.msg.assistant', el));
  }

  const input = h('textarea', {
    rows: 1,
    value: chat.draft,
    placeholder: 'Сообщение',
    'aria-label': 'Сообщение',
    maxLength: 4000,
    oninput: (e) => {
      chat.draft = e.target.value;
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
    },
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover: hover)').matches) {
        e.preventDefault();
        send(input.value);
      }
    },
  });

  const blocked = Boolean(notice);
  if (chat.messages.length || chat.streaming) requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));

  return h('div.chat',
    notice,
    list,
    h('form.composer', { onsubmit: (e) => { e.preventDefault(); send(input.value); } },
      chat.image && h('div.attach', h('img', { src: chat.image, alt: 'Вложение' }), h('button.photo-del', { type: 'button', 'aria-label': 'Убрать фото', onclick: () => { chat.image = null; rerender(); } }, icon('close', 14))),
      h('div.composer-row',
        h('button.icon-btn', {
          type: 'button',
          'aria-label': 'Прикрепить фото состава',
          disabled: blocked,
          onclick: async () => {
            const src = await pickPhoto(1280, 0.82);
            if (src) { chat.image = src; rerender(); }
          },
        }, icon('camera', 22)),
        input,
        chat.streaming
          ? h('button.send', { type: 'button', 'aria-label': 'Остановить', onclick: () => chat.abort?.abort() }, icon('stop', 20))
          : h('button.send', { type: 'submit', 'aria-label': 'Отправить', disabled: blocked }, icon('send', 20))),
      chat.messages.length > 0 && !chat.streaming && h('button.link', {
        type: 'button',
        onclick: async () => {
          if (!(await confirmSheet({ title: 'Начать новый чат?', text: 'История этого диалога будет удалена.', action: 'Удалить' }))) return;
          chat.messages = [];
          await save();
          rerender();
        },
      }, 'Новый чат')));
}

export function resetChat() {
  chat.messages = null;
  chat.draft = '';
  chat.image = null;
}
