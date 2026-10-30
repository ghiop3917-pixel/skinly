import { LEVELS, OILINESS, OVERALL } from './data.js';
import { dayTotals, targets, weekSummary } from './fitness.js';
import { getDiary, getFitDays, getFitGoal, getHabits, getProducts, getProfile, getRoutines } from './state.js';

function fitContext(goal, days) {
  const weights = days.filter((d) => d.weight);
  const current = weights[weights.length - 1]?.weight;
  const today = days[days.length - 1];
  return {
    goal: goal && { sex: goal.sex, age: goal.age, height: goal.height, targetWeight: goal.targetWeight },
    norm: goal && current ? targets(goal, current) : null,
    weights: weights.slice(-5).map((d) => ({ date: d.id, weight: d.weight })),
    lastDay: today && { date: today.id, ...dayTotals(today), foods: today.foods.map((f) => f.name).slice(0, 10) },
    week: weekSummary(days.slice(-7)),
  };
}

// Сводка для AI. Фотографии дневника и косметики сюда намеренно не входят.
export async function buildContext() {
  const [profile, products, diary, routines, goal, days, habits] = await Promise.all([getProfile(), getProducts(), getDiary(), getRoutines(), getFitGoal(), getFitDays(), getHabits()]);
  return {
    now: new Date().toLocaleString('ru-RU'),
    fitness: { ...fitContext(goal, days), habits },
    profile: {
      name: profile.name,
      skinType: profile.skinType,
      sensitivity: profile.sensitivity,
      preferences: profile.preferences,
      note: profile.prefNote,
    },
    routine: {
      morning: routines.morning.map((s) => s.title),
      evening: routines.evening.map((s) => s.title),
    },
    products: products.slice(0, 30).map((p) => ({
      name: p.name, brand: p.brand, category: p.category, frequency: p.frequency, inci: (p.inci || '').slice(0, 200), notes: (p.notes || '').slice(0, 100),
    })),
    diary: diary.slice(0, 7).map((e) => ({
      date: e.id,
      overall: OVERALL[e.overall],
      oiliness: OILINESS[e.oiliness],
      redness: LEVELS[e.redness],
      breakouts: LEVELS[e.breakouts],
      sensitivity: LEVELS[e.sensitivity],
      products: e.products,
      notes: (e.notes || '').slice(0, 200),
    })),
  };
}
