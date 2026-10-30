export const DEFAULT_ROUTINES = {
  morning: [
    { id: 'm-cleanse', title: 'Очищение', desc: 'Мягкое средство для умывания' },
    { id: 'm-toner', title: 'Тоник', desc: 'Выравнивает и подготавливает кожу' },
    { id: 'm-serum', title: 'Сыворотка', desc: 'Активный уход по вашим задачам' },
    { id: 'm-cream', title: 'Увлажняющий крем', desc: 'Поддерживает защитный барьер' },
    { id: 'm-spf', title: 'SPF', desc: 'Завершающий этап утреннего ухода' },
  ],
  evening: [
    { id: 'e-cleanse', title: 'Очищение', desc: 'Удаляет SPF, макияж и загрязнения' },
    { id: 'e-extra', title: 'Дополнительные средства', desc: 'Кислоты, ретинол, маски — по графику' },
    { id: 'e-serum', title: 'Сыворотка', desc: 'Восстановление за ночь' },
    { id: 'e-cream', title: 'Увлажняющий крем', desc: 'Закрепляет вечерний уход' },
  ],
};

const step = (title, desc) => ({ title, desc });

// Готовые рутины: выбирается одно нажатие вместо ручной настройки этапов.
export const ROUTINE_PRESETS = [
  ['Минимум', { morning: [step('Умывание', 'Мягкое средство'), step('Крем', 'Лёгкое увлажнение'), step('SPF', 'Завершающий этап')], evening: [step('Умывание', 'Смыть день и SPF'), step('Крем', 'Увлажнение на ночь')] }],
  ['С бритьём', { morning: [step('Умывание', 'Подготовить кожу'), step('Бритьё', 'Гель и острое лезвие'), step('После бритья', 'Без спирта, успокаивает'), step('Крем', 'Увлажнение'), step('SPF', 'Завершающий этап')], evening: [step('Умывание', 'Смыть день и SPF'), step('Сыворотка', 'По вашим задачам'), step('Крем', 'Увлажнение на ночь')] }],
  ['Жирная кожа', { morning: [step('Гель для умывания', 'Без пересушивания'), step('Лёгкий крем', 'Гель-крем'), step('SPF', 'Матирующий')], evening: [step('Гель для умывания', 'Смыть день и SPF'), step('Актив', 'Например, BHA, по графику'), step('Лёгкий крем', 'Увлажнение на ночь')] }],
  ['Полный', DEFAULT_ROUTINES],
];

export const REMINDER_PRESETS = [
  ['Выпить воды', '15:00'],
  ['Взвеситься', '08:00'],
  ['Тренировка', '18:00'],
  ['Лечь спать вовремя', '22:30'],
  ['Сменить наволочку', '10:00', [0]],
];

export const DEFAULT_PROFILE = { name: '', skinType: '', sensitivity: '', preferences: [], prefNote: '', onboarded: false };

export const DEFAULT_SETTINGS = {
  morningTime: '08:00',
  eveningTime: '21:30',
  spfTime: '12:00',
  notify: { enabled: false, morning: true, evening: true, spf: true },
  aiKey: '',
};

export const FREE_FALLBACK = 'openrouter/free';
// Только бесплатные модели. OpenRouter берёт первую свободную из списка.
export const modelChain = (hasImage) => [
  ...(hasImage ? ['thinkingmachines/inkling:free', 'nvidia/nemotron-3.5-super-vl:free'] : ['nvidia/nemotron-3-ultra-550b-a55b:free', 'thinkingmachines/inkling:free']),
  FREE_FALLBACK,
];

export const SKIN_TYPES = ['Нормальная', 'Сухая', 'Жирная', 'Комбинированная', 'Не знаю'];
export const SENSITIVITY = ['Низкая', 'Средняя', 'Высокая'];
export const PREFERENCES = ['Без отдушек', 'Без спирта', 'Без эфирных масел', 'Веган', 'Минимум этапов', 'Бюджетные средства', 'Беременность или ГВ'];

export const CATEGORIES = ['Очищение', 'Тоник', 'Сыворотка', 'Крем', 'SPF', 'Маска', 'Пилинг', 'Вокруг глаз', 'Другое'];
export const FREQUENCIES = ['Каждый день', 'Утром', 'Вечером', '2–3 раза в неделю', 'Раз в неделю', 'По необходимости'];

export const OVERALL = ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
export const OILINESS = ['Очень сухая', 'Суховатая', 'Баланс', 'Жирноватая', 'Очень жирная'];
export const LEVELS = ['Нет', 'Слабо', 'Умеренно', 'Сильно'];

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEK_INDEX = [1, 2, 3, 4, 5, 6, 0];
