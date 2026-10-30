// Напоминания работают, только пока приложение открыто: для доставки при закрытом приложении нужен сервер.
import { kvGet, kvSet } from './db.js';
import { dateKey, getCustomReminders, getRoutines, getSettings, saveSettings } from './state.js';
import { toast } from './ui.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function environment() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const notification = 'Notification' in window;
  return { isIOS, standalone, notification, permission: notification ? Notification.permission : 'unsupported' };
}

export async function buildReminders() {
  const [settings, routines, custom] = await Promise.all([getSettings(), getRoutines(), getCustomReminders()]);
  const { notify } = settings;
  const list = [
    { id: 'morning', kind: 'base', time: settings.morningTime, title: 'Утренний уход', body: 'Пора начать утреннюю рутину', days: ALL_DAYS, enabled: notify.morning },
    { id: 'spf', kind: 'base', time: settings.spfTime, title: 'Нанесите SPF', body: 'Напоминание об SPF на сегодня', days: ALL_DAYS, enabled: notify.spf },
    { id: 'evening', kind: 'base', time: settings.eveningTime, title: 'Вечерний уход', body: 'Пора начать вечернюю рутину', days: ALL_DAYS, enabled: notify.evening },
  ];
  for (const part of ['morning', 'evening']) {
    for (const s of routines[part]) {
      if (s.reminder) list.push({ id: `step:${s.id}`, kind: 'step', time: s.reminder, title: s.title, body: part === 'morning' ? 'Этап утреннего ухода' : 'Этап вечернего ухода', days: ALL_DAYS, enabled: true });
    }
  }
  for (const r of custom) list.push({ ...r, id: `custom:${r.id}`, kind: 'custom', body: r.body || '', sourceId: r.id });
  return list.sort((a, b) => a.time.localeCompare(b.time));
}

export async function todayReminders() {
  const today = new Date().getDay();
  return (await buildReminders()).filter((r) => r.enabled && r.days.includes(today));
}

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const icsText = (s) => String(s).replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');

// Файл календаря: напоминания приходят от самого iPhone, поэтому работают при закрытом приложении.
export function buildIcs(reminders, now = new Date()) {
  const date = dateKey(now).replaceAll('-', '');
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, '');
  const events = reminders.map((r) => {
    const rule = r.days.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${r.days.map((d) => ICS_DAYS[d]).join(',')}`;
    const start = `${date}T${r.time.replace(':', '')}00`;
    return [
      'BEGIN:VEVENT', `UID:${r.id.replace(/[^\w-]/g, '-')}@skinly`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT5M', `RRULE:${rule}`,
      `SUMMARY:${icsText(r.title)}`, `DESCRIPTION:${icsText(r.body || 'Skinly')}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0S', `DESCRIPTION:${icsText(r.title)}`, 'END:VALARM', 'END:VEVENT',
    ];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Skinly AI//RU', 'CALSCALE:GREGORIAN', ...events.flat(), 'END:VCALENDAR', ''].join('\r\n');
}

export async function exportCalendar() {
  const reminders = (await buildReminders()).filter((r) => r.enabled);
  if (!reminders.length) {
    toast('Нет включённых напоминаний', 'error');
    return;
  }
  const file = new File([buildIcs(reminders)], 'skinly.ics', { type: 'text/calendar' });
  if (environment().standalone && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Напоминания Skinly' }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skinly.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function enableNotifications() {
  const env = environment();
  if (!env.notification) {
    toast(env.isIOS && !env.standalone ? 'Сначала добавьте приложение на экран «Домой»' : 'Браузер не поддерживает уведомления', 'error');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Уведомления не разрешены в настройках устройства', 'error');
    return false;
  }
  const settings = await getSettings();
  settings.notify.enabled = true;
  await saveSettings(settings);
  return true;
}

export async function disableNotifications() {
  const settings = await getSettings();
  settings.notify.enabled = false;
  await saveSettings(settings);
}

async function checkDue() {
  const settings = await getSettings();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = dateKey(now);
  const due = (await todayReminders()).filter((r) => r.time === hhmm);
  if (!due.length) return;
  const fired = await kvGet('fired', {});
  const fresh = due.filter((r) => fired[r.id] !== today);
  if (!fresh.length) return;
  for (const r of fresh) fired[r.id] = today;
  await kvSet('fired', fired);
  for (const r of fresh) {
    toast(`${r.title}${r.body ? ` — ${r.body}` : ''}`);
    if (!settings.notify.enabled || window.Notification?.permission !== 'granted') continue;
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.showNotification(r.title, { body: r.body, tag: r.id, icon: 'icons/icon-192.png' });
  }
}

export function startReminderLoop() {
  const run = () => checkDue().catch(() => {});
  run();
  setInterval(run, 20000);
}
