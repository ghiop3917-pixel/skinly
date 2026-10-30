// Расчёты для раздела «Форма». Формула Миффлина — Сан-Жеора даёт оценку, а не точную норму.
export const ACTIVITY = [['Сидячая', 1.2], ['Лёгкая', 1.375], ['Средняя', 1.55], ['Высокая', 1.725]];
export const PACES = [['Мягкий', 0.25], ['Обычный', 0.5], ['Быстрый', 0.75]];
export const WORKOUTS = [['Ходьба', 3.5], ['Бег', 9], ['Велосипед', 7], ['Силовая', 5], ['Плавание', 7], ['Дома', 5], ['Растяжка', 2.5], ['Другое', 4]];
export const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
export const DEFAULT_HABITS = ['Без сладкого', 'Без газировки', 'Ужин за 3 часа до сна', '30 минут ходьбы'];

const KCAL_PER_KG = 7700;
const MIN_KCAL = { m: 1500, f: 1200 };
const HEALTHY_BMI = 18.5;

export const bmi = (weight, height) => weight / (height / 100) ** 2;

export function targets(goal, weight) {
  const base = 10 * weight + 6.25 * goal.height - 5 * goal.age + (goal.sex === 'm' ? 5 : -161);
  const maintain = base * goal.activity;
  const minor = goal.age < 18;
  const wanted = minor ? maintain : maintain - (goal.pace * KCAL_PER_KG) / 7;
  const floor = MIN_KCAL[goal.sex];
  const kcal = Math.round(Math.max(wanted, Math.min(floor, maintain)));
  const protein = Math.round(weight * 1.6);
  const fat = Math.round(weight * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const toLose = Math.max(0, weight - goal.targetWeight);
  const realPace = minor ? 0 : Math.max(0, ((maintain - kcal) * 7) / KCAL_PER_KG);
  return {
    kcal,
    maintain: Math.round(maintain),
    protein,
    fat,
    carbs,
    water: Math.round((weight * 30) / 50) * 50,
    limited: !minor && wanted < floor,
    minor,
    lowTarget: bmi(goal.targetWeight, goal.height) < HEALTHY_BMI,
    weeks: realPace > 0 ? Math.ceil(toLose / realPace) : null,
  };
}

export const workoutKcal = (met, weight, minutes) => Math.round((met * weight * minutes) / 60);

export function dayTotals(day) {
  const sum = (key) => day.foods.reduce((a, f) => a + (f[key] || 0), 0);
  return {
    kcal: sum('kcal'),
    protein: sum('protein'),
    fat: sum('fat'),
    carbs: sum('carbs'),
    burned: day.workouts.reduce((a, w) => a + (w.kcal || 0), 0),
  };
}

// Сводка за неделю считает средние только по дням, где что-то записано.
export function weekSummary(days) {
  const avg = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
  const fed = days.filter((d) => d.foods.length);
  return {
    kcal: avg(fed.map((d) => dayTotals(d).kcal)),
    water: avg(days.filter((d) => d.water).map((d) => d.water)),
    steps: avg(days.filter((d) => d.steps).map((d) => d.steps)),
    sleep: Math.round(avg(days.filter((d) => d.sleep).map((d) => d.sleep * 10))) / 10,
    workouts: days.reduce((a, d) => a + d.workouts.length, 0),
    logged: fed.length,
  };
}

export function achievements({ days, weights, goal }) {
  const lost = weights.length ? weights[0].weight - weights[weights.length - 1].weight : 0;
  const workouts = days.reduce((a, d) => a + d.workouts.length, 0);
  const foodDays = days.filter((d) => d.foods.length).length;
  return [
    ['Первое взвешивание', weights.length > 0],
    ['Цель настроена', Boolean(goal)],
    ['Первая тренировка', workouts > 0],
    ['10 тренировок', workouts >= 10],
    ['7 дней записей еды', foodDays >= 7],
    ['30 дней записей еды', foodDays >= 30],
    ['Минус 1 кг', lost >= 1],
    ['Минус 3 кг', lost >= 3],
    ['Минус 5 кг', lost >= 5],
    ['Цель достигнута', Boolean(goal && weights.length && weights[weights.length - 1].weight <= goal.targetWeight)],
  ];
}
