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

export const DEFAULT_PROFILE = { name: '', skinType: '', sensitivity: '', preferences: [], prefNote: '', onboarded: false };

export const DEFAULT_SETTINGS = {
  morningTime: '08:00',
  eveningTime: '21:30',
  spfTime: '12:00',
  notify: { enabled: false, morning: true, evening: true, spf: true },
  apiKey: '',
  model: 'grok-4.7',
};

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
