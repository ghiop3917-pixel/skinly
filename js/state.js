import { DEFAULT_PROFILE, DEFAULT_ROUTINES, DEFAULT_SETTINGS } from './data.js';
import { db, kvGet, kvSet } from './db.js';

export const uid = () => crypto.randomUUID();

export function dateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const parseKey = (key) => new Date(`${key}T12:00:00`);

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export const getProfile = async () => ({ ...DEFAULT_PROFILE, ...(await kvGet('profile', {})) });
export const saveProfile = (p) => kvSet('profile', p);

export async function getSettings() {
  // apiKey и model остались от версии с Grok: старый ключ нельзя отправлять другому сервису.
  const { apiKey, model, ...s } = await kvGet('settings', {});
  return { ...DEFAULT_SETTINGS, ...s, notify: { ...DEFAULT_SETTINGS.notify, ...s.notify } };
}
export const saveSettings = (s) => kvSet('settings', s);

export const getRoutines = () => kvGet('routines', structuredClone(DEFAULT_ROUTINES));
export const saveRoutines = (r) => kvSet('routines', r);

export const getCustomReminders = () => kvGet('reminders', []);
export const saveCustomReminders = (r) => kvSet('reminders', r);

export const getDay = async (date) => (await db.get('days', date)) || { id: date, done: {} };

export async function toggleStep(date, stepId) {
  const day = await getDay(date);
  if (day.done[stepId]) delete day.done[stepId];
  else day.done[stepId] = true;
  await db.put('days', day);
  return day;
}

export function progress(steps, day) {
  const done = steps.filter((s) => day.done[s.id]).length;
  return { done, total: steps.length, ratio: steps.length ? done / steps.length : 0 };
}

export async function getDiary() {
  const all = await db.all('diary');
  return all.sort((a, b) => b.id.localeCompare(a.id));
}

export async function getProducts() {
  const all = await db.all('products');
  return all.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function getAnalyses() {
  const all = await db.all('analyses');
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Сколько дней подряд выполнен хотя бы один этап; незавершённое сегодня серию не обрывает.
export async function getStreak() {
  const days = await db.all('days');
  const active = new Set(days.filter((d) => Object.keys(d.done).length).map((d) => d.id));
  let key = dateKey();
  if (!active.has(key)) key = addDays(key, -1);
  let n = 0;
  while (active.has(key)) {
    n += 1;
    key = addDays(key, -1);
  }
  return n;
}
