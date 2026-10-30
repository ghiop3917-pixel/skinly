import { go, h, segmented } from '../ui.js';
import { renderChat } from './chat.js';
import { renderScan } from './scan.js';

export async function renderAi(route) {
  const tab = route.rest[0] === 'scan' ? 'scan' : 'chat';
  const content = tab === 'scan' ? await renderScan(route) : await renderChat();
  return h('div.page', { class: tab === 'chat' ? 'chat-page' : '' },
    h('header.top', h('h1', 'Skinly AI')),
    segmented([['chat', 'Чат', 'chat'], ['scan', 'Анализ состава', 'flask']], tab, (v) => go(`#/ai/${v}`)),
    content);
}
