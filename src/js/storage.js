/**
 * PASSWORD GENERATOR — STORAGE.JS
 * ===============================
 * Слой хранения: чтение, запись, валидация и миграция
 * записей о паролях.
 *
 * Хранилище инкапсулировано за интерфейсом ключ/значение,
 * поэтому модуль работает и с localStorage (браузер),
 * и с MemoryStore (юнит-тесты в Node.js).
 *
 * @version 1.0.0
 * @author Almight71
 * @license MIT
 *
 * Схема записи (schema v1):
 * {
 *   id: number,            // уникальный идентификатор
 *   name: string,          // для чего пароль (2-100 символов)
 *   password: string,      // сам пароль
 *   createdAt: string,     // ISO 8601
 *   strengthScore: number  // 0-4, см. STRENGTH_LEVELS
 * }
 */

/**
 * Внутреннее хранилище в оперативной памяти.
 * Используется как fallback, когда localStorage недоступен
 * (приватный режим, отключённые cookie, окружение Node.js).
 */
class MemoryStore {
  /** Создаёт пустое кэшированное хранилище. */
  constructor() {
    /** @type {Map<string, string>} */
    this.data = new Map();
  }

  /**
   * Возвращает значение по ключу.
   * @param {string} key - Ключ
   * @returns {string|null}
   */
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  /**
   * Сохраняет значение по ключу.
   * @param {string} key - Ключ
   * @param {string} value - Значение
   */
  setItem(key, value) {
    this.data.set(key, String(value));
  }

  /**
   * Удаляет ключ.
   * @param {string} key - Ключ
   */
  removeItem(key) {
    this.data.delete(key);
  }

  /**
   * Очищает хранилище.
   */
  clear() {
    this.data.clear();
  }
}

/**
 * Репозиторий сохранённых паролей.
 */
class PasswordStorage {
  /**
   * @param {string} [key=STORAGE_KEY] - Ключ в хранилище
   * @param {{getItem:Function, setItem:Function, removeItem:Function}} [backend]
   *        Адаптер хранилища; по умолчанию localStorage или MemoryStore
   */
  constructor(key = STORAGE_KEY, backend = null) {
    /** @type {string} */
    this.key = key;
    /** @type {{getItem:Function, setItem:Function, removeItem:Function}} */
    this.backend = backend || PasswordStorage.createDefaultBackend();
    /** @type {Array<Object>} Кэш записей текущей сессии */
    this.cache = [];
    this.cache = this.load();
  }

  /**
   * Возвращает доступный адаптер хранилища.
   * localStorage проверяется пробной записью: в приватном режиме
   * Safari обращение к нему бросает исключение.
   *
   * @returns {{getItem:Function, setItem:Function, removeItem:Function}}
   */
  static createDefaultBackend() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        const probeKey = '__pg_probe__';
        localStorage.setItem(probeKey, '1');
        localStorage.removeItem(probeKey);
        return localStorage;
      }
    } catch (error) {
      console.warn('[WARN] localStorage недоступен, используем память:', error.message);
    }

    return new MemoryStore();
  }

  /**
   * Проверяет, что объект — корректная запись схемы v1.
   *
   * @param {*} raw - Проверяемое значение
   * @returns {boolean} true, если запись валидна
   */
  static isValidRecord(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (!Number.isFinite(Number(raw.id))) return false;
    if (typeof raw.name !== 'string' || raw.name.trim() === '') return false;
    if (typeof raw.password !== 'string' || raw.password === '') return false;
    return true;
  }

  /**
   * Нормализует произвольный объект к схеме v1.
   *
   * @param {*} raw - Исходный объект (может быть из старой версии)
   * @returns {Object|null} Нормализованная запись или null при ошибке
   */
  static normalizeRecord(raw) {
    if (!PasswordStorage.isValidRecord(raw)) return null;

    return {
      id: Number(raw.id),
      name: sanitizeInput(raw.name),
      password: String(raw.password),
      createdAt: toSafeString(raw.createdAt) || new Date().toISOString(),
      strengthScore: clamp(
        raw.strengthScore === undefined
          ? PasswordStorage.legacyStrengthToScore(raw.strength)
          : raw.strengthScore,
        0,
        STRENGTH_LEVELS.length - 1
      )
    };
  }

  /**
   * Переводит силу из схемы v0 (`weak|medium|strong`) в балл 0-4.
   *
   * @param {string} [legacy=''] - Значение старой версии
   * @returns {number} Балл силы
   */
  static legacyStrengthToScore(legacy) {
    const map = { weak: 1, medium: 2, strong: 3 };
    return Object.prototype.hasOwnProperty.call(map, legacy) ? map[legacy] : 1;
  }

  /**
   * Читает и валидирует все записи из хранилища.
   * Повреждённые данные не роняют приложение: они пропускаются
   * с предупреждением в консоль.
   *
   * @returns {Array<Object>} Массив валидных записей
   */
  load() {
    try {
      const raw = this.backend.getItem(this.key);
      if (!raw) {
        const migrated = this.migrateLegacyData();
        if (migrated.length > 0) {
          this.cache = migrated;
          this.save(migrated);
          console.info('[INFO] Выполнена миграция записей из предыдущей версии:', migrated.length);
        }
        return this.cache;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[WARN] Ожидался массив записей, получен:', typeof parsed);
        return [];
      }

      const records = [];
      parsed.forEach((item) => {
        const normalized = PasswordStorage.normalizeRecord(item);
        if (normalized) {
          records.push(normalized);
        } else {
          console.warn('[WARN] Пропущена некорректная запись хранилища:', item);
        }
      });

      return records;
    } catch (error) {
      console.error('[ERROR] Ошибка чтения хранилища:', error);
      return [];
    }
  }

  /**
   * Переносит данные старого ключа `passwords` (v0) в `passwords_v1`.
   *
   * @returns {Array<Object>} Мигрированные записи (пустой массив, если нечего переносить)
   */
  migrateLegacyData() {
    try {
      if (typeof localStorage === 'undefined' || localStorage === null) return [];

      const legacy = localStorage.getItem('passwords');
      if (!legacy) return [];

      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed)) return [];

      const migrated = parsed
        .map((item) => PasswordStorage.normalizeRecord(item))
        .filter(Boolean);

      if (migrated.length > 0) localStorage.removeItem('passwords');
      return migrated;
    } catch (error) {
      console.error('[WARN] Миграция не выполнена:', error);
      return [];
    }
  }

  /**
   * Сохраняет массив записей в хранилище.
   *
   * @param {Array<Object>} [records=this.cache] - Что сохранить
   * @returns {boolean} true при успешной записи
   */
  save(records = this.cache) {
    try {
      this.backend.setItem(this.key, JSON.stringify(records));
      this.cache = records;
      return true;
    } catch (error) {
      // QuotaExceededError — переполнение лимита хранилища
      console.error('[ERROR] Не удалось сохранить данные:', error);
      return false;
    }
  }

  /**
   * Возвращает копию всех записей.
   * @returns {Array<Object>}
   */
  getAll() {
    return this.cache.slice();
  }

  /**
   * Возвращает количество записей.
   * @returns {number}
   */
  count() {
    return this.cache.length;
  }

  /**
   * Ищет запись по id.
   *
   * @param {number} id - Идентификатор
   * @returns {Object|undefined}
   */
  find(id) {
    return this.cache.find((record) => record.id === Number(id));
  }

  /**
   * Добавляет новую запись.
   *
   * @param {{name:string, password:string, strengthScore?:number}} data - Данные пароля
   * @returns {Object|null} Созданная запись или null при ошибке валидации
   */
  add(data) {
    const nameCheck = validateName(data ? data.name : '');
    if (!nameCheck.ok) {
      console.warn('[WARN] Запись отклонена:', nameCheck.error);
      return null;
    }

    if (!data || typeof data.password !== 'string' || data.password === '') {
      console.warn('[WARN] Запись отклонена: пароль пуст');
      return null;
    }

    const record = {
      id: createId(),
      name: nameCheck.value,
      password: String(data.password),
      createdAt: new Date().toISOString(),
      strengthScore: clamp(
        data.strengthScore === undefined ? 0 : data.strengthScore,
        0,
        STRENGTH_LEVELS.length - 1
      )
    };

    const next = this.cache.concat([record]);
    if (!this.save(next)) return null;

    return record;
  }

  /**
   * Удаляет запись по идентификатору.
   *
   * @param {number} id - Идентификатор записи
   * @returns {boolean} true, если запись была найдена и удалена
   */
  remove(id) {
    const next = this.cache.filter((record) => record.id !== Number(id));
    if (next.length === this.cache.length) return false;
    return this.save(next);
  }

  /**
   * Удаляет все записи.
   * @returns {boolean} true при успехе
   */
  clear() {
    return this.save([]);
  }

  /**
   * Фильтрует записи по названию (без учёта регистра).
   *
   * @param {string} [query=''] - Поисковый запрос
   * @returns {Array<Object>} Подходящие записи
   */
  search(query = '') {
    const needle = toSafeString(query).trim().toLowerCase();
    if (!needle) return this.getAll();

    return this.cache.filter((record) => record.name.toLowerCase().includes(needle));
  }
}
