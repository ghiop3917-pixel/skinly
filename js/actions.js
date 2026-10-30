// Действия AI в приложении. Модель дописывает к ответу блок <actions>[...]</actions>,
// а здесь он проверяется и выполняется. Удалять данные AI не может, всё можно отменить.
import { LEVELS, OILINESS, OVERALL } from './data.js';
import { db } from './db.js';
import { ACTIVITY, MEALS, PACES, WORKOUTS, workoutKcal } from './fitness.js';
import { searchFoods } from './foods.js';
import { dateKey, getCustomReminders, getDay, getFitDays, getFitGoal, getHabits, getPlans, getRoutines, getSettings, saveCustomReminders, saveFitGoal, saveHabits, savePlans, saveRoutines, saveSettings, uid, updateFitDay } from './state.js';

const MAX_ACTIONS = 10;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SECTIONS = { home: '#/home', routine: '#/routine', fit: '#/fit', diary: '#/diary', products: '#/products', scan: '#/ai/scan', reminders: '#/reminders', profile: '#/profile' };

export function visibleText(text) {
  return text
    .replace(/<actions>[\s\S]*?(<\/actions>|$)/g, '')
    .replace(/<[a-z/]*$/, '')
    .trim();
}

export function extractActions(text) {
  // Модель иногда не закрывает блок, поэтому конец текста тоже считается концом блока.
  const match = text.match(/<actions>([\s\S]*?)(?:<\/actions>|$)/);
  if (!match) return [];
  try {
    const list = JSON.parse(match[1].replace(/^\s*```(?:json)?|```\s*$/g, ''));
    return (Array.isArray(list) ? list : [list]).filter((a) => a && typeof a.action === 'string').slice(0, MAX_ACTIONS);
  } catch {
    return [];
  }
}

const str = (v, max = 120) => {
  const s = String(v ?? '').trim().slice(0, max);
  if (!s) throw new Error('пустое значение');
  return s;
};
const num = (v, min, max) => {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('число вне диапазона');
  return n;
};
const level = (v, list, fallback) => (v === undefined || v === null ? fallback : Math.round(num(v, 0, list.length - 1)));
const part = (v) => (v === 'evening' ? 'evening' : 'morning');
const partName = (p) => (p === 'evening' ? 'вечернюю' : 'утреннюю');
const time = (v) => {
  const t = String(v).trim().padStart(5, '0');
  if (!TIME.test(t)) throw new Error('неверное время');
  return t;
};
const lastWeight = async () => (await getFitDays()).filter((d) => d.weight).pop()?.weight;

const HANDLERS = {
  add_food: async (a, keep) => {
    const known = searchFoods(String(a.name ?? ''))[0];
    const food = {
      id: uid(),
      meal: MEALS.find((m) => m.toLowerCase() === String(a.meal ?? '').trim().toLowerCase()) || 'Перекус',
      name: str(a.name),
      kcal: Math.round(num(a.kcal ?? known?.kcal ?? 0, 0, 5000)),
      protein: num(a.protein ?? known?.protein ?? 0, 0, 500),
      fat: num(a.fat ?? known?.fat ?? 0, 0, 500),
      carbs: num(a.carbs ?? known?.carbs ?? 0, 0, 1000),
    };
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.foods.push(food); });
    return `Еда: ${food.name}, ${food.kcal} ккал`;
  },
  add_water: async (a, keep) => {
    const ml = Math.round(num(a.ml, 10, 5000));
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.water += ml; });
    return `Вода: +${ml} мл`;
  },
  log_weight: async (a, keep) => {
    const kg = num(a.kg, 30, 300);
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.weight = kg; });
    return `Вес: ${kg} кг`;
  },
  log_steps: async (a, keep) => {
    const steps = Math.round(num(a.steps, 0, 200000));
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.steps = steps; });
    return `Шаги: ${steps}`;
  },
  log_sleep: async (a, keep) => {
    const hours = num(a.hours, 0, 24);
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.sleep = hours; });
    return `Сон: ${hours} ч`;
  },
  log_measures: async (a, keep) => {
    const value = (v) => (v === undefined || v === null ? null : num(v, 20, 300));
    const measures = { waist: value(a.waist), hips: value(a.hips), chest: value(a.chest) };
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.measures = { ...d.measures, ...Object.fromEntries(Object.entries(measures).filter(([, v]) => v)) }; });
    return 'Замеры записаны';
  },
  add_workout: async (a, keep) => {
    const type = WORKOUTS.find(([n]) => n === a.type) || WORKOUTS.find(([n]) => n === 'Другое');
    const minutes = num(a.minutes, 1, 600);
    const weight = await lastWeight();
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.workouts.push({ id: uid(), type: type[0], minutes, kcal: weight ? workoutKcal(type[1], weight, minutes) : 0 }); });
    return `Тренировка: ${type[0]}, ${minutes} мин`;
  },
  set_habit: async (a, keep) => {
    const name = str(a.name, 60);
    const habits = await getHabits();
    await keep('kv', 'fitHabits');
    if (!habits.includes(name)) await saveHabits([...habits, name]);
    await keep('fit', dateKey());
    await updateFitDay(dateKey(), (d) => { d.habits[name] = a.done !== false; });
    return `Привычка: ${name}`;
  },
  mark_routine: async (a, keep) => {
    const p = part(a.part);
    const routines = await getRoutines();
    const query = String(a.step ?? '').toLowerCase();
    const steps = routines[p].filter((s) => !query || s.title.toLowerCase().includes(query));
    if (!steps.length) throw new Error('этап не найден');
    await keep('days', dateKey());
    const day = await getDay(dateKey());
    for (const s of steps) day.done[s.id] = true;
    await db.put('days', day);
    return `Уход отмечен: ${steps.map((s) => s.title).join(', ')}`;
  },
  add_routine_step: async (a, keep) => {
    const p = part(a.part);
    const routines = await getRoutines();
    await keep('kv', 'routines');
    const step = { id: uid(), title: str(a.title, 60), desc: String(a.desc ?? '').slice(0, 200), reminder: a.time ? time(a.time) : '' };
    routines[p].push(step);
    await saveRoutines(routines);
    return `Этап в ${partName(p)} рутину: ${step.title}`;
  },
  add_reminder: async (a, keep) => {
    const days = Array.isArray(a.days) && a.days.length ? a.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6];
    const item = { id: uid(), title: str(a.title, 80), time: time(a.time), days, enabled: true };
    await keep('kv', 'reminders');
    await saveCustomReminders([...(await getCustomReminders()), item]);
    return `Напоминание: ${item.title} в ${item.time}`;
  },
  set_times: async (a, keep) => {
    const settings = await getSettings();
    await keep('kv', 'settings');
    if (a.morning) settings.morningTime = time(a.morning);
    if (a.evening) settings.eveningTime = time(a.evening);
    if (a.spf) settings.spfTime = time(a.spf);
    await saveSettings(settings);
    return 'Время ухода изменено';
  },
  add_diary: async (a, keep) => {
    const id = dateKey();
    await keep('diary', id);
    const old = (await db.get('diary', id)) || { id, overall: 2, oiliness: 2, redness: 0, breakouts: 0, sensitivity: 0, products: [], notes: '', photos: [] };
    await db.put('diary', {
      ...old,
      overall: level(a.overall, OVERALL, old.overall),
      oiliness: level(a.oiliness, OILINESS, old.oiliness),
      redness: level(a.redness, LEVELS, old.redness),
      breakouts: level(a.breakouts, LEVELS, old.breakouts),
      sensitivity: level(a.sensitivity, LEVELS, old.sensitivity),
      notes: [old.notes, String(a.notes ?? '').slice(0, 1000)].filter(Boolean).join('\n'),
    });
    return 'Запись в дневнике сохранена';
  },
  add_product: async (a) => {
    const product = {
      id: uid(), name: str(a.name, 100), brand: String(a.brand ?? '').slice(0, 80), category: String(a.category ?? '').slice(0, 40),
      frequency: String(a.frequency ?? '').slice(0, 40), inci: String(a.inci ?? '').slice(0, 8000), notes: String(a.notes ?? '').slice(0, 1000), photo: '', addedAt: new Date().toISOString(),
    };
    await db.put('products', product);
    return { label: `Косметика: ${product.name}`, undo: () => db.del('products', product.id) };
  },
  set_goal: async (a, keep) => {
    const goal = (await getFitGoal()) || {};
    const next = {
      activity: 1.375,
      pace: 0.5,
      ...goal,
      ...(a.target_weight !== undefined ? { targetWeight: num(a.target_weight, 30, 300) } : {}),
      ...(a.height !== undefined ? { height: num(a.height, 100, 250) } : {}),
      ...(a.age !== undefined ? { age: Math.round(num(a.age, 10, 110)) } : {}),
      ...(a.sex === 'm' || a.sex === 'f' ? { sex: a.sex } : {}),
      ...(ACTIVITY.some(([, v]) => v === a.activity) ? { activity: a.activity } : {}),
      ...(PACES.some(([, v]) => v === a.pace) ? { pace: a.pace } : {}),
    };
    if (!next.targetWeight || !next.height || !next.age || !next.sex) throw new Error('нужны рост, возраст, пол и желаемый вес');
    await keep('kv', 'fitGoal');
    await saveFitGoal(next);
    return `Цель: ${next.targetWeight} кг`;
  },
  save_plan: async (a, keep, text) => {
    await keep('kv', 'fitPlans');
    const title = str(a.title ?? 'План от AI', 60);
    await savePlans([{ id: uid(), kind: 'chat', title, text: str(text, 20000), createdAt: new Date().toISOString() }, ...(await getPlans())].slice(0, 30));
    return `Сохранено в планы: ${title}`;
  },
  open: async (a) => {
    const hash = SECTIONS[a.section];
    if (!hash) throw new Error('нет такого раздела');
    location.hash = hash;
    return null;
  },
};

// Выполняет действия по очереди. Ошибка одного не мешает остальным.
export async function runActions(actions, text) {
  const saved = new Map();
  const undos = [];
  const done = [];
  const failed = [];
  const keep = async (store, id) => {
    const key = `${store}/${id}`;
    if (!saved.has(key)) saved.set(key, { store, id, row: await db.get(store, id) });
  };
  for (const a of actions) {
    const handler = HANDLERS[a.action];
    if (!handler) continue;
    try {
      const result = await handler(a, keep, text);
      if (typeof result === 'string') done.push(result);
      else if (result) {
        done.push(result.label);
        undos.push(result.undo);
      }
    } catch (err) {
      failed.push(`${a.action}: ${err.message}`);
    }
  }
  const undo = async () => {
    for (const fn of undos) await fn();
    for (const { store, id, row } of saved.values()) {
      if (row === undefined) await db.del(store, id);
      else await db.put(store, row);
    }
  };
  return { done, failed, undo };
}
