/**
 * PASSWORD GENERATOR — GENERATOR.JS
 * =================================
 * Чистая логика генерации паролей и оценки их силы.
 *
 * Модуль не трогает DOM и не работает с хранилищем —
 * только входные данные и результат. Это делает его
 * полностью покрываемым юнит-тестами (tests/unit-tests.html).
 *
 * @version 1.0.0
 * @author Almight71
 * @license MIT
 *
 * Алгоритм:
 * 1. Построить алфавит из выбранных наборов символов
 * 2. Гарантировать минимум по одному символу из каждого набора
 * 3. Дополнить пароль до нужной длины случайными символами
 * 4. Перемешать результат (Fisher–Yates)
 *
 * Случайные числа берутся через crypto.getRandomValues
 * ( CSPRNG ), а не через Math.random — это критично
 * для криптографической стойкости пароля.
 */

/**
 * Основной класс генерации паролей.
 * Все методы статические: состояние не требуется.
 */
class PasswordGenerator {
  /**
   * Возвращает криптографически стойкое случайное целое число
   * из диапазона [0, maxExclusive) без смещения (bias).
   *
   * Используется метод «отсечения» (rejection sampling):
   * отбрасываем значения, попадающие в неполный остаток шкалы.
   *
   * @param {number} maxExclusive - Верхняя граница (не включительно)
   * @returns {number} Случайное целое число
   * @throws {Error} Если maxExclusive не положительное целое число
   */
  static secureRandomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('Диапазон случайного числа должен быть положительным целым числом');
    }

    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('crypto.getRandomValues недоступен: безопасная генерация невозможна');
    }

    // Наибольшее кратное maxExclusive, не превышающее 2^32
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    let value = 0;

    do {
      cryptoApi.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);

    return value % maxExclusive;
  }

  /**
   * Строит алфавит по выбранным опциям.
   *
   * @param {{UPPERCASE?:boolean, LOWERCASE?:boolean, NUMBERS?:boolean, SYMBOLS?:boolean}} options
   *        Флаги наборов символов
   * @returns {string} Алфавит генерации
   * @throws {Error} Если не выбран ни один набор
   */
  static buildCharset(options) {
    const charset = buildCharset(options);

    if (charset === '') {
      throw new Error('Выберите хотя бы одну опцию символов');
    }

    return charset;
  }

  /**
   * Перемешивает массив по алгоритму Fisher–Yates
   * с использованием CSPRNG.
   *
   * @param {string[]} items - Массив символов для перемешивания
   * @returns {string[]} Новый перемешанный массив
   */
  static shuffle(items) {
    const result = items.slice();

    for (let i = result.length - 1; i > 0; i--) {
      const j = PasswordGenerator.secureRandomInt(i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }

    return result;
  }

  /**
   * Генерирует пароль по заданным параметрам.
   *
   * @param {{length?:number, UPPERCASE?:boolean, LOWERCASE?:boolean, NUMBERS?:boolean, SYMBOLS?:boolean}} options
   *        Параметры генерации
   * @returns {{password:string, length:number, charsetSize:number, entropyBits:number}}
   *          Сгенерированный пароль и метаданные
   * @throws {Error} При некорректной длине или пустом алфавите
   *
   * @example
   * PasswordGenerator.generate({ length: 16, UPPERCASE: true, NUMBERS: true });
   */
  static generate(options) {
    const opts = options || {};
    const charset = PasswordGenerator.buildCharset(opts);

    const rawLength = Number(opts.length);
    const length = Number.isFinite(rawLength)
      ? clamp(rawLength, PASSWORD_LIMITS.MIN_LENGTH, PASSWORD_LIMITS.MAX_LENGTH)
      : PASSWORD_LIMITS.DEFAULT_LENGTH;

    const selectedKeys = CHAR_SET_KEYS.filter((key) => opts[key]);

    // 1. По одному гарантированному символу из каждого выбранного набора
    const chars = selectedKeys
      .filter(() => length >= selectedKeys.length)
      .map((key) => CHAR_SETS[key][PasswordGenerator.secureRandomInt(CHAR_SETS[key].length)]);

    // 2. Дополняем до нужной длины
    while (chars.length < length) {
      chars.push(charset[PasswordGenerator.secureRandomInt(charset.length)]);
    }

    // 3. Перемешиваем, чтобы гарантированные символы не стояли в начале
    const password = PasswordGenerator.shuffle(chars).join('');

    return {
      password,
      length: password.length,
      charsetSize: charset.length,
      entropyBits: Number(calculateEntropyBits(password.length, charset.length).toFixed(1))
    };
  }

  /**
   * Оценивает силу пароля по энтропии (5 уровней).
   *
   * @param {string} password - Пароль для оценки
   * @returns {{score:number, label:string, className:string, badge:string, bits:number, percent:number}}
   *          Оценка: score 0-4, label — русское название уровня
   */
  static calculateStrength(password) {
    const value = toSafeString(password);

    if (value.length === 0) {
      return {
        score: -1,
        label: STRENGTH_EMPTY_LABEL,
        className: '',
        badge: '',
        bits: 0,
        percent: 0
      };
    }

    const bits = PasswordGenerator.estimateBits(value);

    // Берём последний порог, который не превышен:
    // уровни отсортированы по возрастанию minBits.
    let level = STRENGTH_LEVELS[0];
    for (let i = STRENGTH_LEVELS.length - 1; i >= 0; i--) {
      if (bits >= STRENGTH_LEVELS[i].minBits) {
        level = STRENGTH_LEVELS[i];
        break;
      }
    }

    const score = STRENGTH_LEVELS.indexOf(level);

    return {
      score,
      label: level.label,
      className: level.className,
      badge: level.badge,
      bits: Number(bits.toFixed(1)),
      percent: Math.min(100, Math.round((bits / 128) * 100))
    };
  }

  /**
   * Оценивает энтропию готового пароля по фактическому составу
   * использованных классов символов.
   *
   * @param {string} password - Пароль
   * @returns {number} Энтропия в битах
   */
  static estimateBits(password) {
    const value = toSafeString(password);
    if (value.length === 0) return 0;

    let poolSize = 0;
    if (/[a-z]/.test(value)) poolSize += CHAR_SETS.LOWERCASE.length;
    if (/[A-Z]/.test(value)) poolSize += CHAR_SETS.UPPERCASE.length;
    if (/\d/.test(value)) poolSize += CHAR_SETS.NUMBERS.length;
    if (/[^a-zA-Z0-9]/.test(value)) poolSize += CHAR_SETS.SYMBOLS.length;

    if (poolSize === 0) return 0;
    return calculateEntropyBits(value.length, poolSize);
  }
}

/**
 * Глобальный алиас для использования в разметке (inline-обработчики, тесты).
 * @type {typeof PasswordGenerator}
 */
const PasswordEngine = PasswordGenerator;
