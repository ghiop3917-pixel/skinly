import { OVERALL } from '../data.js';
import { dayTotals, targets } from '../fitness.js';
import { todayReminders } from '../notifications.js';
import { dateKey, getDay, getDiary, getFitDay, getFitDays, getFitGoal, getProducts, getProfile, getRoutines, getStreak, parseKey, progress, toggleStep } from '../state.js';
import { bar, formatDate, h, icon, plural, rerender, ring } from '../ui.js';

function greeting(hour) {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// Подсказка строится по данным пользователя, без AI и без случайных фраз.
function tip({ hour, morning, evening, entry, products, routines }) {
  if (entry && entry.id === dateKey() && entry.sensitivity >= 2) return 'Сегодня кожа чувствительная. Лучше обойтись мягким уходом и отложить активные средства.';
  if (entry && entry.oiliness <= 1) return 'В последней записи кожа была сухой. Уделите внимание увлажняющему крему.';
  const spf = routines.morning.find((s) => /spf/i.test(s.title));
  if (hour < 14 && morning.done < morning.total) {
    return spf ? 'Начните с утренней рутины и не забудьте SPF в конце.' : 'Начните день с утренней рутины.';
  }
  if (hour >= 18 && evening.done < evening.total) return 'Вечерний уход поможет завершить день. Начните с очищения.';
  if (morning.ratio === 1 && evening.ratio === 1) return 'Весь уход на сегодня выполнен. Отличная работа!';
  if (!products) return 'Добавьте свою косметику, и AI-помощник сможет учитывать её в советах.';
  if (!entry) return 'Сделайте первую запись в дневнике, чтобы видеть, как меняется кожа.';
  return 'Постоянство важнее количества средств. Хорошего дня!';
}

function routineCard(title, ic, steps, day, prog, part) {
  return h('section.card',
    h('div.card-head',
      h('a.card-title', { href: `#/routine/${part}` }, icon(ic, 20), h('h3', title)),
      h('span.count', `${prog.done} из ${prog.total}`)),
    bar(prog.ratio),
    h('ul.mini-steps', steps.map((s) => h('li',
      h('button.mini-step', {
        type: 'button',
        class: day.done[s.id] ? 'done' : '',
        'aria-pressed': Boolean(day.done[s.id]),
        onclick: async () => { await toggleStep(dateKey(), s.id); rerender(); },
      }, h('span.tick', icon('check', 15)), h('span', s.title))))),
    !steps.length && h('p.muted', 'Этапов пока нет.'));
}

function fitCard(goal, fitDay, days) {
  const weight = days.filter((d) => d.weight).pop()?.weight;
  const norm = goal && weight ? targets(goal, weight) : null;
  const eaten = dayTotals(fitDay).kcal;
  return h('a.card.link-card', { href: '#/fit' },
    h('div.card-title', icon('flame', 20), h('h3', 'Форма')),
    norm
      ? [h('p.big', `${eaten} / ${norm.kcal}`), h('p.muted', `ккал · вода ${fitDay.water} мл · вес ${weight} кг`)]
      : h('p.muted', 'Настройте цель: норма калорий, план похудения и график веса'));
}

export async function renderHome() {
  const now = new Date();
  const hour = now.getHours();
  const [profile, routines, day, diary, products, reminders, streak, goal, fitDay, fitDays] = await Promise.all([
    getProfile(), getRoutines(), getDay(dateKey()), getDiary(), getProducts(), todayReminders(), getStreak(), getFitGoal(), getFitDay(dateKey()), getFitDays(),
  ]);
  const morning = progress(routines.morning, day);
  const evening = progress(routines.evening, day);
  const all = progress([...routines.morning, ...routines.evening], day);
  const entry = diary[0];
  const hhmm = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return h('div.page',
    h('header.top',
      h('div',
        h('p.date', formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })),
        h('h1', profile.name ? `${greeting(hour)}, ${profile.name}` : greeting(hour))),
      h('a.avatar', { href: '#/profile', 'aria-label': 'Профиль' }, icon('user', 22))),
    h('section.hero',
      h('div.hero-text',
        h('p.eyebrow', 'На сегодня'),
        h('p.hero-tip', tip({ hour, morning, evening, entry, products: products.length, routines }))),
      ring(all.ratio, `${Math.round(all.ratio * 100)}%`)),
    streak > 0 && h('p.streak', `${streak} ${plural(streak, 'день', 'дня', 'дней')} ухода подряд`),
    h('div.grid',
      routineCard('Утро', 'sun', routines.morning, day, morning, 'morning'),
      routineCard('Вечер', 'moon', routines.evening, day, evening, 'evening'),
      fitCard(goal, fitDay, fitDays),
      h('a.card.ai-card', { href: '#/ai/chat' },
        h('span.ai-badge', icon('spark', 22)),
        h('div', h('h3', 'Спросить Skinly'), h('p.muted', 'Уход, ингредиенты, сочетания средств')),
        icon('right', 20)),
      h('a.card.link-card', { href: entry ? `#/diary/${entry.id}` : '#/diary' },
        h('div.card-title', icon('book', 20), h('h3', 'Последняя запись')),
        entry
          ? [h('p', OVERALL[entry.overall]), h('p.muted', formatDate(parseKey(entry.id), { day: 'numeric', month: 'long' })), entry.notes && h('p.muted.clamp', entry.notes)]
          : h('p.muted', 'Записей пока нет')),
      h('a.card.link-card', { href: '#/products' },
        h('div.card-title', icon('bottle', 20), h('h3', 'Моя косметика')),
        h('p.big', products.length),
        h('p.muted', plural(products.length, 'средство', 'средства', 'средств'))),
      h('section.card',
        h('div.card-head', h('a.card-title', { href: '#/reminders' }, icon('bell', 20), h('h3', 'Напоминания на сегодня'))),
        reminders.length
          ? h('ul.rem-list', reminders.map((r) => h('li', { class: r.time < hhmm ? 'past' : '' }, h('span.time', r.time), h('span', r.title))))
          : h('p.muted', 'На сегодня напоминаний нет.'))));
}
