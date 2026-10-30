import { LEVELS, OILINESS, OVERALL } from './data.js';
import { getDiary, getProducts, getProfile, getRoutines } from './state.js';

// Сводка для AI. Фотографии дневника и косметики сюда намеренно не входят.
export async function buildContext() {
  const [profile, products, diary, routines] = await Promise.all([getProfile(), getProducts(), getDiary(), getRoutines()]);
  return {
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
