/**
 * PASSWORD GENERATOR — UTILS.JS
 * =============================
 * Общие константы, типы и чистые утилиты приложения.
 * Модуль не зависит от DOM, поэтому может использоваться
 * в юнит-тестах (Node.js) и в браузере.
 *
 * @version 1.0.0
 * @author Almight71
 * @license MIT
 *
 * Содержит:
 * - Константы приложения (ключ хранилища, наборы символов, лимиты)
 * - Таблицу уровней силы пароля (5 уровней)
 * - Валидацию и санитизацию пользовательского ввода
 * - Экранирование HTML (защита от XSS)
 */

/* ============================================================
 * КОНСТАНТЫ
 * ============================================================ */

/**
 * Ключ хранилища браузера (localStorage).
 * Версионный суффикс `_v1` позволяет безопасно менять
 * структуру данных в будущих релизах (см. миграции в docs/ARCHITECTURE.md).
 * @type {string}
 */
const STORAGE_KEY = 'passwords_v1';

/**
 * Наборы символов для генерации паролей.
 * Ключи объекта соответствуют id чекбоксов в разметке.
 * @type {Readonly<Record<string, string>>}
 */
const CHAR_SETS = Object.freeze({
  UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
  NUMBERS: '0123456789',
  SYMBOLS: '!@#$%^&*()_+-=[]{}|;:,.<>?'
});

/**
 * Допустимые опции наборов символов.
 * @type {readonly string[]}
 */
const CHAR_SET_KEYS = Object.freeze(['UPPERCASE', 'LOWERCASE', 'NUMBERS', 'SYMBOLS']);

/**
 * Ограничения длины и имени пароля.
 * @type {Readonly<{MIN_LENGTH:number, MAX_LENGTH:number, DEFAULT_LENGTH:number, MAX_NAME_LENGTH:number}>}
 */
const PASSWORD_LIMITS = Object.freeze({
  MIN_LENGTH: 4,
  MAX_LENGTH: 32,
  DEFAULT_LENGTH: 16,
  MAX_NAME_LENGTH: 100
});

/**
 * Пять уровней силы пароля, пороги заданы в битах энтропии
 * (Шеннон: `length * log2(charsetSize)`).
 * @type {ReadonlyArray<{minBits:number, label:string, className:string, badge:string}>}
 */
const STRENGTH_LEVELS = Object.freeze([
  { minBits: 0,  label: 'Очень слабый',  className: 'strength-very-weak',  badge: 'strength-badge-weak' },
  { minBits: 28, label: 'Слабый',        className: 'strength-weak',       badge: 'strength-badge-weak' },
  { minBits: 44, label: 'Средний',       className: 'strength-medium',     badge: 'strength-badge-medium' },
  { minBits: 64, label: 'Сильный',       className: 'strength-strong',     badge: 'strength-badge-strong' },
  { minBits: 88, label: 'Очень сильный', className: 'strength-very-strong', badge: 'strength-badge-strong' }
]);

/**
 * Замаскированное отображение скрытого пароля в таблице.
 * @type {string}
 */
const PASSWORD_MASK = '••••••••••••••••';

/**
 * Пустой (не заданный) пароль: уровень не определён.
 * @type {string}
 */
const STRENGTH_EMPTY_LABEL = '—';

/* ============================================================
 * УТИЛИТЫ ВАЛИДАЦИИ
 * ============================================================ */

/**
 * Ограничивает число диапазоном [min, max].
 *
 * @param {number} value - Исходное значение
 * @param {number} min - Нижняя граница
 * @param {number} max - Верхняя граница
 * @returns {number} Значение внутри диапазона
 */
function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Проверяет, что значение — целое число внутри диапазона.
 *
 * @param {*} value - Проверяемое значение
 * @param {number} min - Нижняя граница (включительно)
 * @param {number} max - Верхняя граница (включительно)
 * @returns {boolean} true, если значение корректно
 */
function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Строит набор символов из выбранных опций.
 *
 * @param {{UPPERCASE?:boolean, LOWERCASE?:boolean, NUMBERS?:boolean, SYMBOLS?:boolean}} options
 *        Флаги включённых наборов
 * @returns {string} Строка доступных символов ('' если ничего не выбрано)
 */
function buildCharset(options) {
  const opts = options || {};
  let charset = '';

  CHAR_SET_KEYS.forEach((key) => {
    if (opts[key]) charset += CHAR_SETS[key];
  });

  return charset;
}

/**
 * Считает количество выбранных наборов символов.
 *
 * @param {{UPPERCASE?:boolean, LOWERCASE?:boolean, NUMBERS?:boolean, SYMBOLS?:boolean}} options
 * @returns {number} Число включённых наборов (0-4)
 */
function countSelectedSets(options) {
  const opts = options || {};
  return CHAR_SET_KEYS.reduce((total, key) => total + (opts[key] ? 1 : 0), 0);
}

/**
 * Считает энтропию пароля в битах по формуле Шеннона.
 *
 * @param {number} length - Длина пароля
 * @param {number} charsetSize - Размер алфавита
 * @returns {number} Энтропия в битах (0, если данных недостаточно)
 */
function calculateEntropyBits(length, charsetSize) {
  if (!Number.isFinite(length) || !Number.isFinite(charsetSize)) return 0;
  if (length <= 0 || charsetSize <= 1) return 0;
  return length * (Math.log(charsetSize) / Math.LN2);
}

/* ============================================================
 * УТИЛИТЫ БЕЗОПАСНОСТИ
 * ============================================================ */

/**
 * Экранирует HTML-символы строки (защита от XSS при вставке в разметку).
 *
 * @param {*} text - Исходный текст (будет приведён к строке)
 * @returns {string} Безопасная для вставки в HTML строка
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * Санитизирует пользовательский ввод: убирает потенциально
 * опасные символы, управляющие символы и ограничивает длину.
 *
 * @param {*} input - Входное значение
 * @param {number} [maxLength=100] - Максимальная длина результата
 * @returns {string} Очищенная строка
 */
function sanitizeInput(input, maxLength = PASSWORD_LIMITS.MAX_NAME_LENGTH) {
  if (input === null || input === undefined) return '';

  return String(input)
    .replace(/[<>\"'`]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Валидирует название сохраняемого пароля.
 *
 * @param {*} rawName - Название от пользователя
 * @returns {{ok: boolean, value: string, error?: string}} Результат проверки
 */
function validateName(rawName) {
  const raw = toSafeString(rawName).trim();

  // Проверяем длину исходной строки ДО санитизации,
  // чтобы длинный ввод отклонялся, а не молча обрезался.
  if (raw.length > PASSWORD_LIMITS.MAX_NAME_LENGTH) {
    return { ok: false, value: '', error: `Название не длиннее ${PASSWORD_LIMITS.MAX_NAME_LENGTH} символов` };
  }

  const value = sanitizeInput(rawName);

  if (!value) {
    return { ok: false, value: '', error: 'Введите название для пароля' };
  }
  if (value.length < 2) {
    return { ok: false, value, error: 'Название должно содержать минимум 2 символа' };
  }

  return { ok: true, value };
}

/* ============================================================
 * УТИЛИТЫ ДАННЫХ
 * ============================================================ */

/**
 * Создаёт уникальный идентификатор записи.
 * Склеивание timestamp и случайной части исключает коллизии
 * при быстром сохранении нескольких паролей подряд.
 *
 * @returns {number} Уникальное числовое id
 */
function createId() {
  const timePart = Date.now() % 1e9;
  const randomPart = Math.floor(Math.random() * 1e5);
  return timePart * 1e5 + randomPart;
}

/**
 * Форматирует дату в российский локальный формат.
 *
 * @param {Date|string|number} [date=new Date()] - Дата
 * @returns {string} Напр. «20.10.2026, 12:31»
 */
function formatDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(date));
  } catch (error) {
    console.error('[ERROR] Не удалось отформатировать дату:', error);
    return String(date);
  }
}

/**
 * Приводит значение к строке для безопасного отображения.
 *
 * @param {*} value - Любое значение
 * @returns {string} Стровковое представление
 */
function toSafeString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
