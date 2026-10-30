import { SENSITIVITY, SKIN_TYPES } from '../data.js';
import { getProfile, saveProfile } from '../state.js';
import { chips, field, h, rerender } from '../ui.js';

export function renderOnboarding() {
  const draft = { name: '', skinType: '', sensitivity: '' };
  const name = h('input', { type: 'text', autocomplete: 'given-name', placeholder: 'Как к вам обращаться', maxLength: 40, oninput: (e) => { draft.name = e.target.value.trim(); } });
  const finish = async (e) => {
    e.preventDefault();
    await saveProfile({ ...(await getProfile()), ...draft, onboarded: true });
    location.hash = '#/home';
    rerender();
  };
  return h('div.onboarding',
    h('div.onb-logo', 'Skinly'),
    h('h1', 'Уход за кожей без лишнего'),
    h('p.muted', 'Рутина, дневник кожи, косметика и AI-помощник — в одном месте. Данные хранятся на этом устройстве.'),
    h('form.card.stack', { onsubmit: finish },
      field('Имя', name),
      field('Тип кожи', chips(SKIN_TYPES, '', (v) => { draft.skinType = v; })),
      field('Чувствительность', chips(SENSITIVITY, '', (v) => { draft.sensitivity = v; })),
      h('button.btn.wide', { type: 'submit' }, 'Начать')),
    h('p.hint.center', 'Skinly не заменяет консультацию врача. Всё можно изменить в профиле.'));
}
