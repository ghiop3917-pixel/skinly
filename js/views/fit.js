import { estimateFood, getStatus, streamChat } from '../api.js';
import { buildContext } from '../context.js';
import { ACTIVITY, MEALS, PACES, WORKOUTS, achievements, bmi, dayTotals, targets, weekSummary, workoutKcal } from '../fitness.js';
import {
  addDays, dateKey, getFast, getFitDay, getFitDays, getFitGoal, getHabits, getPlans, parseKey, saveFast, saveFitGoal, saveHabits, savePlans, uid, updateFitDay,
} from '../state.js';
import { bar, chips, confirmSheet, field, formatDate, go, h, icon, openSheet, pickPhoto, renderMarkdown, rerender, ring, segmented, toast } from '../ui.js';

const ui = { tab: 'today' };
const generation = { kind: null, text: '', el: null, abort: null };
const num = (v) => {
  const x = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};
const numInput = (value, placeholder) => h('input', { type: 'text', inputMode: 'decimal', autocomplete: 'off', value: value ?? '', placeholder });
const today = () => dateKey();

const PLANS = [
  ['plan', 'План похудения', 'Составь мой личный план похудения на 4 недели: питание, активность, привычки и как отслеживать результат. Учитывай мою норму калорий и цель.'],
  ['menu', 'Меню на день', 'Составь простое меню на сегодня в пределах моей нормы калорий: блюда, граммовки, калории и БЖУ. Учти, что я уже съел сегодня.'],
  ['week', 'Меню на неделю', 'Составь простое меню на 7 дней в пределах моей нормы калорий. Блюда из обычных продуктов, без сложных рецептов.'],
  ['workout', 'Тренировки', 'Составь план тренировок на неделю для похудения с учётом моего уровня: упражнения, подходы, время. Что можно делать дома без инвентаря.'],
  ['shop', 'Список покупок', 'Составь список покупок на неделю под моё меню для похудения, сгруппируй по отделам магазина.'],
  ['tip', 'Разбор недели', 'Разбери мою неделю по данным из раздела «Форма»: что идёт хорошо, что мешает и 3 конкретных шага на следующую неделю.'],
];

function editGoal(goal, weight) {
  const draft = { sex: '', activity: 1.375, pace: 0.5, ...goal };
  openSheet('Моя цель', (body, close) => {
    const current = numInput(weight, 'Например, 85');
    const target = numInput(goal?.targetWeight, 'Например, 75');
    const height = numInput(goal?.height, 'Например, 180');
    const age = numInput(goal?.age, 'Например, 30');
    const label = (list, v) => list.find(([, x]) => x === v)?.[0] || '';
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        const w = num(current.value);
        Object.assign(draft, { targetWeight: num(target.value), height: num(height.value), age: num(age.value) });
        if (!draft.sex || !w || !draft.targetWeight || !draft.height || !draft.age) {
          toast('Заполните все поля', 'error');
          return;
        }
        await saveFitGoal(draft);
        await updateFitDay(today(), (d) => { d.weight = w; });
        close();
        toast('Цель сохранена');
        rerender();
      },
    },
    field('Текущий вес, кг', current),
    field('Желаемый вес, кг', target),
    field('Рост, см', height),
    field('Возраст', age),
    field('Пол (нужен для расчёта нормы)', chips(['Мужской', 'Женский'], { m: 'Мужской', f: 'Женский' }[draft.sex] || '', (v) => { draft.sex = { Мужской: 'm', Женский: 'f' }[v] || ''; })),
    field('Активность', chips(ACTIVITY.map(([n]) => n), label(ACTIVITY, draft.activity), (v) => { draft.activity = ACTIVITY.find(([n]) => n === v)?.[1] ?? 1.375; })),
    field('Темп снижения', chips(PACES.map(([n, p]) => `${n}: ${p} кг в неделю`), (() => { const p = PACES.find(([, x]) => x === draft.pace); return p ? `${p[0]}: ${p[1]} кг в неделю` : ''; })(), (v) => { draft.pace = PACES.find(([n]) => v.startsWith(n))?.[1] ?? 0.5; })),
    h('button.btn.wide', { type: 'submit' }, 'Сохранить')));
  });
}

function addFood(recent) {
  const draft = { meal: new Date().getHours() < 11 ? 'Завтрак' : new Date().getHours() < 16 ? 'Обед' : 'Ужин' };
  openSheet('Добавить еду', (body, close) => {
    const name = h('input', { type: 'text', maxLength: 120, placeholder: 'Например, гречка с курицей 300 г' });
    const kcal = numInput('', 'ккал');
    const protein = numInput('', 'Б');
    const fat = numInput('', 'Ж');
    const carbs = numInput('', 'У');
    const fill = (f) => { name.value = f.name; kcal.value = f.kcal; protein.value = f.protein || ''; fat.value = f.fat || ''; carbs.value = f.carbs || ''; };
    const aiBtn = h('button.btn.ghost', { type: 'button' }, icon('spark', 18), 'Посчитать');
    const photoBtn = h('button.btn.ghost', { type: 'button' }, icon('camera', 18), 'По фото');
    const runAi = async (payload) => {
      aiBtn.disabled = true;
      photoBtn.disabled = true;
      aiBtn.textContent = 'Считаю…';
      try {
        fill(await estimateFood(payload));
        toast('Оценка приблизительная, проверьте');
      } catch (err) {
        toast(err.message, 'error');
      }
      aiBtn.disabled = false;
      photoBtn.disabled = false;
      aiBtn.replaceChildren(icon('spark', 18), 'Посчитать');
    };
    aiBtn.addEventListener('click', () => {
      if (name.value.trim()) runAi({ text: name.value.trim() });
      else toast('Напишите, что вы съели', 'error');
    });
    photoBtn.addEventListener('click', async () => {
      const image = await pickPhoto(1024, 0.8);
      if (image) runAi({ image, text: name.value.trim() });
    });
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        const food = { id: uid(), meal: draft.meal, name: name.value.trim(), kcal: Math.round(num(kcal.value) || 0), protein: num(protein.value) || 0, fat: num(fat.value) || 0, carbs: num(carbs.value) || 0 };
        if (!food.name) { toast('Напишите название', 'error'); return; }
        await updateFitDay(today(), (d) => { d.foods.push(food); });
        close();
        rerender();
      },
    },
    chips(MEALS, draft.meal, (v) => { draft.meal = v || draft.meal; }),
    field('Что съели', name),
    h('div.row-actions', aiBtn, photoBtn),
    h('div.quad', field('Ккал', kcal), field('Белки', protein), field('Жиры', fat), field('Углеводы', carbs)),
    recent.length > 0 && field('Недавнее', h('div.chips', recent.map((f) => h('button.chip', { type: 'button', onclick: () => fill(f) }, f.name)))),
    h('button.btn.wide', { type: 'submit' }, 'Добавить')));
  });
}

function addWorkout(weight) {
  const draft = { type: 'Ходьба' };
  openSheet('Тренировка', (body, close) => {
    const minutes = numInput('30', 'Минут');
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        const m = num(minutes.value);
        if (!m) { toast('Укажите минуты', 'error'); return; }
        const met = WORKOUTS.find(([n]) => n === draft.type)[1];
        await updateFitDay(today(), (d) => { d.workouts.push({ id: uid(), type: draft.type, minutes: m, kcal: weight ? workoutKcal(met, weight, m) : 0 }); });
        close();
        rerender();
      },
    },
    field('Вид', chips(WORKOUTS.map(([n]) => n), draft.type, (v) => { draft.type = v || draft.type; })),
    field('Минут', minutes),
    h('button.btn.wide', { type: 'submit' }, 'Добавить')));
  });
}

function editHabits(habits) {
  openSheet('Привычки', (body, close) => {
    const list = h('div.stack');
    let items = [...habits];
    const paint = () => list.replaceChildren(...items.map((name, i) => h('div.setting', h('b', name), h('button.icon-btn', { type: 'button', 'aria-label': `Удалить: ${name}`, onclick: () => { items.splice(i, 1); paint(); } }, icon('trash', 18)))));
    paint();
    const input = h('input', { type: 'text', maxLength: 60, placeholder: 'Новая привычка' });
    body.append(list, h('form.composer-inline', {
      onsubmit: (e) => {
        e.preventDefault();
        if (input.value.trim()) { items = [...items, input.value.trim()]; input.value = ''; paint(); }
      },
    }, input, h('button.btn.small', { type: 'submit' }, 'Добавить')),
    h('button.btn.wide', { type: 'button', onclick: async () => { await saveHabits(items); close(); rerender(); } }, 'Сохранить'));
  });
}

function stepper(label, value, unit, onChange) {
  const input = numInput(value ?? '', '—');
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onChange(num(input.value)));
  return h('div.mini-stat', h('span.muted', label), h('div.stat-row', input, h('span.muted', unit)));
}

function fastCard(fast) {
  const elapsed = h('p.big');
  const paint = () => {
    const mins = Math.floor((Date.now() - fast) / 60000);
    elapsed.textContent = `${Math.floor(mins / 60)} ч ${mins % 60} мин`;
  };
  if (fast) {
    paint();
    const timer = setInterval(() => { if (elapsed.isConnected) paint(); else clearInterval(timer); }, 30000);
  }
  return h('section.card',
    h('h3', 'Перерыв в еде'),
    fast && elapsed,
    fast && h('p.hint', 'Необязательная функция. Если плохо себя чувствуете, поешьте.'),
    h('button.btn.ghost.wide', { type: 'button', onclick: async () => { await saveFast(fast ? null : Date.now()); rerender(); } }, fast ? 'Закончить' : 'Начать таймер'));
}

async function renderToday(goal, weight) {
  const [day, habits, fast, all] = await Promise.all([getFitDay(today()), getHabits(), getFast(), getFitDays()]);
  const totals = dayTotals(day);
  const norm = goal && weight ? targets(goal, weight) : null;
  const left = norm ? norm.kcal - totals.kcal + totals.burned : 0;
  const recent = [...new Map(all.slice(-14).flatMap((d) => d.foods).reverse().map((f) => [f.name, f])).values()].slice(0, 8);
  const macro = (label, have, need) => h('div.macro', h('div.card-head', h('span.muted', label), h('span.muted', `${Math.round(have)} / ${need} г`)), bar(Math.min(1, have / (need || 1))));
  const setWater = (delta) => async () => { await updateFitDay(today(), (d) => { d.water = Math.max(0, d.water + delta); }); rerender(); };

  return h('div.stack',
    norm && h('section.hero',
      h('div.hero-text',
        h('p.eyebrow', 'Осталось на сегодня'),
        h('p.hero-tip', left >= 0 ? `${left} ккал` : `Сверх нормы на ${-left} ккал`),
        h('p.muted', `Съедено ${totals.kcal} из ${norm.kcal}${totals.burned ? `, сожжено ${totals.burned}` : ''}`)),
      ring(Math.min(1, totals.kcal / norm.kcal), `${Math.round((totals.kcal / norm.kcal) * 100)}%`)),
    norm && h('section.card', macro('Белки', totals.protein, norm.protein), macro('Жиры', totals.fat, norm.fat), macro('Углеводы', totals.carbs, norm.carbs)),
    h('section.card',
      h('div.card-head', h('h3', 'Еда'), h('button.btn.small', { type: 'button', onclick: () => addFood(recent) }, icon('plus', 17), 'Добавить')),
      day.foods.length ? day.foods.map((f) => h('div.setting',
        h('div', h('b', f.name), h('span.muted', `${f.meal} · ${f.kcal} ккал`)),
        h('button.icon-btn', { type: 'button', 'aria-label': `Удалить: ${f.name}`, onclick: async () => { await updateFitDay(today(), (d) => { d.foods = d.foods.filter((x) => x.id !== f.id); }); rerender(); } }, icon('trash', 18)))) : h('p.muted', 'Напишите или сфотографируйте еду, и AI посчитает калории.')),
    h('section.card',
      h('div.card-head', h('h3', 'Вода'), h('span.count', `${day.water}${norm ? ` / ${norm.water}` : ''} мл`)),
      norm && bar(Math.min(1, day.water / norm.water)),
      h('div.row-actions', h('button.btn.ghost', { type: 'button', onclick: setWater(250) }, '+250'), h('button.btn.ghost', { type: 'button', onclick: setWater(500) }, '+500'), h('button.btn.ghost', { type: 'button', 'aria-label': 'Убрать 250 мл', onclick: setWater(-250) }, '−250'))),
    h('section.card',
      h('div.quad.two',
        stepper('Шаги', day.steps, 'шагов', async (v) => { await updateFitDay(today(), (d) => { d.steps = v; }); rerender(); }),
        stepper('Сон', day.sleep, 'часов', async (v) => { await updateFitDay(today(), (d) => { d.sleep = v; }); rerender(); }))),
    h('section.card',
      h('div.card-head', h('h3', 'Тренировки'), h('button.btn.small', { type: 'button', onclick: () => addWorkout(weight) }, icon('plus', 17), 'Добавить')),
      day.workouts.length ? day.workouts.map((w) => h('div.setting',
        h('div', h('b', w.type), h('span.muted', `${w.minutes} мин · примерно ${w.kcal} ккал`)),
        h('button.icon-btn', { type: 'button', 'aria-label': `Удалить: ${w.type}`, onclick: async () => { await updateFitDay(today(), (d) => { d.workouts = d.workouts.filter((x) => x.id !== w.id); }); rerender(); } }, icon('trash', 18)))) : h('p.muted', 'Сегодня тренировок нет.')),
    h('section.card',
      h('div.card-head', h('h3', 'Привычки'), h('button.btn.small.ghost', { type: 'button', onclick: () => editHabits(habits) }, 'Изменить')),
      h('ul.mini-steps', habits.map((name) => h('li', h('button.mini-step', {
        type: 'button',
        class: day.habits[name] ? 'done' : '',
        'aria-pressed': Boolean(day.habits[name]),
        onclick: async () => { await updateFitDay(today(), (d) => { d.habits[name] = !d.habits[name]; }); rerender(); },
      }, h('span.tick', icon('check', 15)), h('span', name)))))),
    fastCard(fast));
}

async function generate(kind, prompt) {
  if (generation.kind) return;
  Object.assign(generation, { kind, text: '', el: null, abort: new AbortController() });
  rerender();
  try {
    await streamChat({ messages: [{ role: 'user', content: prompt }], context: await buildContext() }, (delta) => {
      generation.text += delta;
      if (generation.el?.isConnected) generation.el.replaceChildren(renderMarkdown(generation.text));
    }, generation.abort.signal);
  } catch (err) {
    if (err.name !== 'AbortError') toast(err.message, 'error');
  }
  if (generation.text) {
    const title = PLANS.find(([k]) => k === kind)?.[1] || 'Рецепт';
    await savePlans([{ id: uid(), kind, title, text: generation.text, createdAt: new Date().toISOString() }, ...(await getPlans())].slice(0, 30));
  }
  Object.assign(generation, { kind: null, text: '', el: null, abort: null });
  rerender();
}

async function renderPlan(goal) {
  const [status, plans] = await Promise.all([getStatus(), getPlans()]);
  const blocked = !status.ai || status.offline;
  const ingredients = h('input', { type: 'text', maxLength: 200, placeholder: 'Что есть дома: курица, рис, огурцы' });
  let live = null;
  if (generation.kind) {
    const el = h('div.plan-text');
    if (generation.text) el.append(renderMarkdown(generation.text));
    else el.append(h('span.dots', h('i'), h('i'), h('i')));
    generation.el = el;
    live = h('section.card', el, h('button.btn.ghost.wide', { type: 'button', onclick: () => generation.abort?.abort() }, 'Остановить'));
  }
  return h('div.stack',
    !goal && h('div.notice', h('b', 'Сначала настройте цель'), h('p', 'С целью план будет точнее и учтёт вашу норму калорий.')),
    !status.ai && h('div.notice', h('b', 'AI пока не подключён'), h('a.link-inline', { href: '#/profile' }, 'Добавить ключ OpenRouter в профиле')),
    h('section.plan-grid', PLANS.map(([kind, title, prompt]) => h('button.plan-btn', { type: 'button', disabled: blocked || Boolean(generation.kind), onclick: () => generate(kind, prompt) }, icon(kind === 'workout' ? 'flame' : 'spark', 20), title))),
    h('section.card.stack',
      h('h3', 'Рецепт из того, что есть'),
      ingredients,
      h('button.btn.wide', { type: 'button', disabled: blocked || Boolean(generation.kind), onclick: () => { if (ingredients.value.trim()) generate('recipe', `Предложи простой рецепт для похудения из этих продуктов: ${ingredients.value.trim()}. Укажи калории и БЖУ.`); else toast('Напишите продукты', 'error'); } }, 'Придумать')),
    live,
    plans.length > 0 && h('h2.section-title', 'Сохранённые планы'),
    plans.map((p) => h('details.card.saved',
      h('summary', h('b', p.title), h('span.muted', formatDate(new Date(p.createdAt), { day: 'numeric', month: 'long' }))),
      h('div.plan-text', renderMarkdown(p.text)),
      h('div.row-actions',
        h('button.btn.ghost', { type: 'button', onclick: async () => { await navigator.clipboard.writeText(p.text); toast('Скопировано'); } }, icon('copy', 18), 'Копировать'),
        h('button.btn.ghost.danger-text', {
          type: 'button',
          onclick: async () => {
            if (!(await confirmSheet({ title: 'Удалить план?', text: `«${p.title}» будет удалён.`, action: 'Удалить' }))) return;
            await savePlans((await getPlans()).filter((x) => x.id !== p.id));
            rerender();
          },
        }, 'Удалить')))));
}

function weightChart(points, goalWeight) {
  const W = 320; const H = 150; const PAD = 14;
  const NS = 'http://www.w3.org/2000/svg';
  const values = [...points.map((p) => p.weight), goalWeight].filter(Boolean);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const t0 = parseKey(points[0].id).getTime();
  const span = Math.max(1, parseKey(points[points.length - 1].id).getTime() - t0);
  const x = (p) => PAD + ((parseKey(p.id).getTime() - t0) / span) * (W - PAD * 2);
  const y = (v) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `График веса: от ${points[0].weight} до ${points[points.length - 1].weight} кг`);
  const line = points.map((p) => `${x(p).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  const goalY = goalWeight ? y(goalWeight).toFixed(1) : null;
  svg.innerHTML = `${goalY ? `<line class="chart-goal" x1="${PAD}" x2="${W - PAD}" y1="${goalY}" y2="${goalY}"/>` : ''}<polyline class="chart-line" points="${line}"/><circle class="chart-dot" r="4"/>`;
  const dot = svg.querySelector('.chart-dot');
  const tip = h('p.chart-tip');
  const select = (p) => {
    dot.setAttribute('cx', x(p));
    dot.setAttribute('cy', y(p.weight));
    tip.textContent = `${formatDate(parseKey(p.id), { day: 'numeric', month: 'long' })}: ${p.weight} кг`;
  };
  const pick = (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    select(points.reduce((best, p) => (Math.abs(x(p) - px) < Math.abs(x(best) - px) ? p : best)));
  };
  svg.addEventListener('pointermove', pick);
  svg.addEventListener('pointerdown', pick);
  select(points[points.length - 1]);
  return h('div', tip, svg, goalWeight && h('p.hint', `Пунктир — цель ${goalWeight} кг`));
}

function addMeasures(prev) {
  openSheet('Замеры, см', (body, close) => {
    const waist = numInput(prev?.waist, 'Талия');
    const hips = numInput(prev?.hips, 'Бёдра');
    const chest = numInput(prev?.chest, 'Грудь');
    body.append(h('form.stack', {
      onsubmit: async (e) => {
        e.preventDefault();
        await updateFitDay(today(), (d) => { d.measures = { waist: num(waist.value), hips: num(hips.value), chest: num(chest.value) }; });
        close();
        rerender();
      },
    }, field('Талия', waist), field('Бёдра', hips), field('Грудь', chest), h('button.btn.wide', { type: 'submit' }, 'Сохранить')));
  });
}

async function renderProgress(goal, weight) {
  const days = await getFitDays();
  const weights = days.filter((d) => d.weight);
  const measures = days.filter((d) => d.measures);
  const norm = goal && weight ? targets(goal, weight) : null;
  const week = weekSummary(days.filter((d) => d.id > addDays(today(), -7)));
  const first = weights[0]?.weight;
  const done = goal && first && first > goal.targetWeight ? Math.min(1, Math.max(0, (first - weight) / (first - goal.targetWeight))) : 0;
  const input = numInput('', 'Сегодняшний вес, кг');
  const stat = (label, value) => h('div.mini-stat', h('span.muted', label), h('b', value));
  const eta = norm?.weeks ? formatDate(parseKey(addDays(today(), norm.weeks * 7)), { month: 'long', year: 'numeric' }) : null;

  return h('div.stack',
    h('section.card',
      h('h3', 'Вес'),
      h('form.composer-inline', {
        onsubmit: async (e) => {
          e.preventDefault();
          const w = num(input.value);
          if (!w) return;
          await updateFitDay(today(), (d) => { d.weight = w; });
          toast('Вес записан');
          rerender();
        },
      }, input, h('button.btn.small', { type: 'submit' }, 'Записать')),
      weights.length >= 2 ? weightChart(weights, goal?.targetWeight) : h('p.muted', 'График появится после двух взвешиваний.')),
    goal && weight && h('section.card',
      h('div.card-head', h('h3', 'Путь к цели'), h('span.count', `${weight} → ${goal.targetWeight} кг`)),
      bar(done),
      h('div.quad.two',
        stat('Сброшено', `${first ? Math.max(0, Math.round((first - weight) * 10) / 10) : 0} кг`),
        stat('ИМТ', bmi(weight, goal.height).toFixed(1)),
        stat('Норма', `${norm.kcal} ккал`),
        stat('Прогноз', eta || '—')),
      norm.limited && h('p.hint', 'Норма поднята до безопасного минимума, поэтому прогноз дольше выбранного темпа.'),
      norm.lowTarget && h('div.notice', h('b', 'Цель ниже здорового веса'), h('p', 'Для такого роста индекс массы тела будет меньше 18,5. Лучше обсудить цель с врачом.')),
      norm.minor && h('div.notice', h('b', 'До 18 лет дефицит не закладывается'), h('p', 'Норма рассчитана на поддержание. Снижение веса лучше обсудить с врачом.')),
      h('p.hint', 'Расчёты приблизительные и не заменяют консультацию врача.')),
    h('section.card',
      h('h3', 'Итоги 7 дней'),
      h('div.quad.two',
        stat('Калории в день', week.kcal ? `${week.kcal}` : '—'),
        stat('Вода в день', week.water ? `${week.water} мл` : '—'),
        stat('Шаги в день', week.steps || '—'),
        stat('Сон', week.sleep ? `${week.sleep} ч` : '—'),
        stat('Тренировки', week.workouts),
        stat('Дней с записями', week.logged))),
    h('section.card',
      h('div.card-head', h('h3', 'Замеры'), h('button.btn.small', { type: 'button', onclick: () => addMeasures(measures[measures.length - 1]?.measures) }, icon('plus', 17), 'Добавить')),
      measures.length ? measures.slice(-5).reverse().map((d) => h('div.setting', h('b', formatDate(parseKey(d.id), { day: 'numeric', month: 'short' })), h('span.muted', [['Т', d.measures.waist], ['Б', d.measures.hips], ['Г', d.measures.chest]].filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(' · ')))) : h('p.muted', 'Записывайте талию, бёдра и грудь: это показывает результат, даже когда вес стоит.')),
    weights.length > 0 && h('section.card',
      h('h3', 'История веса'),
      weights.slice(-10).reverse().map((d) => h('div.setting', h('span', formatDate(parseKey(d.id), { day: 'numeric', month: 'long' })), h('b', `${d.weight} кг`)))),
    h('section.card',
      h('h3', 'Достижения'),
      h('ul.mini-steps', achievements({ days, weights, goal }).map(([name, got]) => h('li', h('div.mini-step', { class: got ? 'done' : '' }, h('span.tick', icon('check', 15)), h('span', name)))))));
}

export async function renderFit(route) {
  if (['today', 'plan', 'progress'].includes(route.rest[0])) ui.tab = route.rest[0];
  const [goal, days] = await Promise.all([getFitGoal(), getFitDays()]);
  const weight = days.filter((d) => d.weight).pop()?.weight ?? null;
  const content = ui.tab === 'plan' ? await renderPlan(goal) : ui.tab === 'progress' ? await renderProgress(goal, weight) : await renderToday(goal, weight);
  return h('div.page',
    h('header.top', h('h1', 'Форма'), h('button.btn.small.ghost', { type: 'button', onclick: () => editGoal(goal, weight) }, goal ? 'Моя цель' : 'Настроить цель')),
    !goal && ui.tab === 'today' && h('section.card.stack',
      h('h3', 'С чего начать'),
      h('p.muted', 'Укажите вес и цель, и приложение посчитает норму калорий, воды и БЖУ.'),
      h('button.btn.wide', { type: 'button', onclick: () => editGoal(goal, weight) }, 'Настроить цель')),
    segmented([['today', 'Сегодня', 'flame'], ['plan', 'План', 'spark'], ['progress', 'Прогресс', 'book']], ui.tab, (v) => { ui.tab = v; go(`#/fit/${v}`); }),
    content);
}
