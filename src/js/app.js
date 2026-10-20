/**
 * PASSWORD GENERATOR — APP.JS
 * ===========================
 * Точка входа приложения: связывает генератор, хранилище и интерфейс.
 *
 * Класс PasswordApp владеет состоянием сессии и координирует
 * остальные модули. Никакой логики в разметке и никаких
 * inline-обработчиков — только делегирование событий.
 *
 * @version 1.0.0
 * @author Almight71
 * @license MIT
 *
 * Поток данных:
 *   DOM (опции) → PasswordApp.readOptions()
 *     → PasswordGenerator.generate()
 *     → UIManager.setPassword()/setStrength()
 *     → PasswordStorage.add()/remove()
 *     → UIManager.renderTable()
 */

/**
 * Основной класс приложения.
 */
class PasswordApp {
  /**
   * @param {{storage?:PasswordStorage, ui?:UIManager}} [deps] - Зависимости (для тестов)
   */
  constructor(deps = {}) {
    /** @type {PasswordStorage} */
    this.storage = deps.storage || new PasswordStorage();
    /** @type {UIManager} */
    this.ui = deps.ui || new UIManager();
    /** @type {string} Последний сгенерированный пароль */
    this.currentPassword = '';
    /** @type {{password:string, length:number, charsetSize:number, entropyBits:number}|null} */
    this.lastResult = null;
    /** @type {string} Последний применённый поисковый запрос */
    this.query = '';
  }

  /* ============================================================
   * ЖИЗНЕННЫЙ ЦИКЛ
   * ============================================================ */

  /**
   * Инициализирует приложение: навешивает обработчики,
   * восстанавливает данные и генерирует первый пароль.
   *
   * @returns {void}
   */
  init() {
    try {
      this.bindEvents();
      this.render();
      this.generate();
      console.info('[INFO] Приложение инициализировано. Записей в хранилище:', this.storage.count());
    } catch (error) {
      console.error('[ERROR] Ошибка инициализации:', error);
      this.ui.toast('Не удалось инициализировать приложение', 'error');
    }
  }

  /**
   * Подписывается на события интерфейса.
   * Обработчики строк таблицы вешаются один раз на контейнер
   * (делегирование), поэтому работают после любой перерисовки.
   *
   * @returns {void}
   */
  bindEvents() {
    const doc = this.ui.doc;

    this.on(doc.getElementById('generateBtn'), 'click', () => this.generate());
    this.on(doc.getElementById('copyBtn'), 'click', () => this.copyCurrent());
    this.on(doc.getElementById('saveBtn'), 'click', () => this.saveCurrent());
    this.on(doc.getElementById('clearBtn'), 'click', () => this.clearAll());

    this.on(doc.getElementById('length'), 'input', (event) => {
      this.ui.setLengthValue(event.target.value);
      this.generate();
    });

    ['uppercase', 'lowercase', 'numbers', 'symbols'].forEach((id) => {
      this.on(doc.getElementById(id), 'change', () => {
        if (!this.ensureAtLeastOneSet(id)) return;
        this.generate();
      });
    });

    this.on(doc.getElementById('searchBox'), 'input', (event) => {
      this.query = event.target.value;
      this.render();
    });

    this.on(doc.getElementById('passwordName'), 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.saveCurrent();
      }
    });

    this.on(doc.getElementById('passwordsList'), 'click', (event) => {
      this.handleTableAction(event);
    });
  }

  /**
   * Безопасно вешает обработчик, игнорируя отсутствующие элементы.
   *
   * @param {Element|null} el - Целевой элемент
   * @param {string} type - Тип события
   * @param {Function} handler - Обработчик
   * @returns {void}
   */
  on(el, type, handler) {
    if (!el) {
      console.warn(`[WARN] Элемент для события "${type}" не найден`);
      return;
    }
    el.addEventListener(type, handler);
  }

  /* ============================================================
   * ГЕНЕРАЦИЯ
   * ============================================================ */

  /**
   * Считывает параметры генерации из формы.
   *
   * @returns {{length:number, UPPERCASE:boolean, LOWERCASE:boolean, NUMBERS:boolean, SYMBOLS:boolean}}
   */
  readOptions() {
    const doc = this.ui.doc;
    const rawLength = doc.getElementById('length');

    return {
      length: clamp(
        rawLength ? rawLength.value : PASSWORD_LIMITS.DEFAULT_LENGTH,
        PASSWORD_LIMITS.MIN_LENGTH,
        PASSWORD_LIMITS.MAX_LENGTH
      ),
      UPPERCASE: Boolean(doc.getElementById('uppercase')?.checked),
      LOWERCASE: Boolean(doc.getElementById('lowercase')?.checked),
      NUMBERS: Boolean(doc.getElementById('numbers')?.checked),
      SYMBOLS: Boolean(doc.getElementById('symbols')?.checked)
    };
  }

  /**
   * Генерирует новый пароль и обновляет интерфейс.
   *
   * @returns {string|null} Пароль или null при ошибке
   */
  generate() {
    try {
      const options = this.readOptions();
      const result = PasswordGenerator.generate(options);

      this.currentPassword = result.password;
      this.lastResult = result;

      this.ui.setPassword(result.password);
      this.ui.setStrength(PasswordGenerator.calculateStrength(result.password));

      console.debug('[DEBUG] Пароль сгенерирован:', {
        length: result.length,
        entropyBits: result.entropyBits,
        charsetSize: result.charsetSize
      });

      return result.password;
    } catch (error) {
      this.currentPassword = '';
      this.ui.setPassword('');
      this.ui.resetStrength();
      this.ui.toast(error.message, 'error');
      console.error('[ERROR] Ошибка генерации:', error);
      return null;
    }
  }

  /**
   * Не даёт снять все чекбоксы: минимум один набор обязателен.
   *
   * @param {string} changedId - id чекбокса, который сняли
   * @returns {boolean} true, если выбор допустим
   */
  ensureAtLeastOneSet(changedId) {
    const doc = this.ui.doc;
    const box = doc.getElementById(changedId);
    if (!box || box.checked) return true;

    const anyChecked = ['uppercase', 'lowercase', 'numbers', 'symbols']
      .map((id) => doc.getElementById(id))
      .some((el) => el && el.checked);

    if (anyChecked) return true;

    box.checked = true;
    this.ui.toast('Нужен хотя бы один набор символов', 'error');
    return false;
  }

  /* ============================================================
   * БУФЕР ОБМЕНА
   * ============================================================ */

  /**
   * Копирует текущий сгенерированный пароль.
   *
   * @returns {Promise<boolean>} true при успехе
   */
  async copyCurrent() {
    if (!this.currentPassword) {
      this.ui.toast('Сначала сгенерируйте пароль', 'error');
      return false;
    }
    return this.copyText(this.currentPassword, 'Пароль скопирован в буфер обмена');
  }

  /**
   * Копирует текст в буфер обмена.
   * Clipboard API работает только в secure context (HTTPS/localhost),
   * поэтому предусмотрен fallback через execCommand для file://.
   *
   * @param {string} text - Текст
   * @param {string} [successMessage='Скопировано'] - Сообщение об успехе
   * @returns {Promise<boolean>} true при успехе
   */
  async copyText(text, successMessage = 'Скопировано') {
    if (!text) {
      this.ui.toast('Нечего копировать', 'error');
      return false;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else if (!PasswordApp.fallbackCopy(text)) {
        throw new Error('Буфер обмена недоступен в этом браузере');
      }

      this.ui.toast(successMessage, 'success');
      console.info('[INFO] Скопировано в буфер обмена');
      return true;
    } catch (error) {
      this.ui.toast(`Ошибка копирования: ${error.message}`, 'error');
      console.error('[ERROR] Копирование не удалось:', error);
      return false;
    }
  }

  /**
   * Резервный способ копирования для не-HTTPS окружений.
   *
   * @param {string} text - Текст
   * @returns {boolean} true, если копирование удалось
   */
  static fallbackCopy(text) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (error) {
      console.error('[ERROR] Fallback-копирование не удалось:', error);
      return false;
    }
  }

  /* ============================================================
   * СОХРАНЕНИЕ И УПРАВЛЕНИЕ ЗАПИСЯМИ
   * ============================================================ */

  /**
   * Сохраняет текущий пароль под указанным названием.
   *
   * @returns {Object|null} Созданная запись или null при ошибке
   */
  saveCurrent() {
    try {
      const input = this.ui.doc.getElementById('passwordName');
      const check = validateName(input ? input.value : '');

      if (!check.ok) {
        this.ui.toast(check.error, 'error');
        if (input) input.focus();
        return null;
      }

      if (!this.currentPassword) {
        this.ui.toast('Сначала сгенерируйте пароль', 'error');
        return null;
      }

      const strength = PasswordGenerator.calculateStrength(this.currentPassword);
      const record = this.storage.add({
        name: check.value,
        password: this.currentPassword,
        strengthScore: Math.max(0, strength.score)
      });

      if (!record) {
        this.ui.toast('Не удалось сохранить пароль (хранилище переполнено?)', 'error');
        return null;
      }

      if (input) input.value = '';
      this.render();
      this.ui.toast(`Пароль «${record.name}» сохранён`, 'success');
      console.info('[INFO] Сохранена запись:', record.name);
      return record;
    } catch (error) {
      this.ui.toast('Ошибка сохранения', 'error');
      console.error('[ERROR] saveCurrent:', error);
      return null;
    }
  }

  /**
   * Удаляет запись после подтверждения.
   *
   * @param {number} id - Идентификатор записи
   * @returns {Promise<boolean>} true, если запись удалена
   */
  async deleteRecord(id) {
    const record = this.storage.find(id);
    if (!record) {
      this.ui.toast('Запись не найдена', 'error');
      return false;
    }

    const confirmed = await this.ui.confirm(
      `Удалить пароль «${record.name}»? Действие необратимо.`,
      'Удалить'
    );

    if (!confirmed) return false;

    const removed = this.storage.remove(id);
    if (removed) {
      if (this.ui.expandedId === id) this.ui.expandedId = null;
      this.render();
      this.ui.toast('Пароль удалён', 'success');
      console.info('[INFO] Удалена запись id=', id);
    } else {
      this.ui.toast('Не удалось удалить запись', 'error');
    }

    return removed;
  }

  /**
   * Показывает или скрывает пароль в строке таблицы.
   *
   * @param {number} id - Идентификатор записи
   * @returns {void}
   */
  toggleRecord(id) {
    const records = this.getVisibleRecords();
    this.ui.setExpanded(records, id);
  }

  /**
   * Удаляет все записи после подтверждения.
   *
   * @returns {Promise<boolean>} true, если хранилище очищено
   */
  async clearAll() {
    if (this.storage.count() === 0) {
      this.ui.toast('Сохранённых паролей нет', 'info');
      return false;
    }

    const confirmed = await this.ui.confirm(
      `Удалить все сохранённые пароли (${this.storage.count()} шт.)?`,
      'Удалить всё'
    );

    if (!confirmed) return false;

    this.storage.clear();
    this.render();
    this.ui.toast('Хранилище очищено', 'success');
    return true;
  }

  /* ============================================================
   * ПОИСК И ОТРИСОВКА
   * ============================================================ */

  /**
   * Возвращает записи, подходящие под текущий запрос.
   *
   * @returns {Array<Object>}
   */
  getVisibleRecords() {
    return this.storage.search(this.query);
  }

  /**
   * Перерисовывает таблицу и счётчики.
   *
   * @returns {void}
   */
  render() {
    const records = this.getVisibleRecords();
    this.ui.renderTable(records);
    this.ui.setCounter(this.storage.count(), records.length);
  }

  /**
   * Обрабатывает клики по кнопкам таблицы (делегирование).
   *
   * @param {MouseEvent} event - Событие клика
   * @returns {void}
   */
  handleTableAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const row = button.closest('tr[data-id]');
    if (!row) return;

    const id = Number(row.dataset.id);
    if (!Number.isFinite(id)) return;

    switch (button.dataset.action) {
      case 'toggle':
        this.toggleRecord(id);
        break;
      case 'copy':
        this.copyFromList(id);
        break;
      case 'delete':
        this.deleteRecord(id);
        break;
      default:
        console.warn('[WARN] Неизвестное действие:', button.dataset.action);
    }
  }

  /**
   * Копирует сохранённый пароль из таблицы.
   *
   * @param {number} id - Идентификатор записи
   * @returns {Promise<boolean>} true при успехе
   */
  async copyFromList(id) {
    const record = this.storage.find(id);
    if (!record) {
      this.ui.toast('Запись не найдена', 'error');
      return false;
    }
    return this.copyText(record.password, `Пароль «${record.name}» скопирован`);
  }
}

/* ============================================================
 * ЗАПУСК
 * ============================================================ */

/**
 * Фабрика приложения, отложенная до полной загрузки DOM.
 * Экспортируется в window.app для отладки и интеграционных тестов.
 *
 * @returns {PasswordApp} Экземпляр приложения
 */
function bootstrapApp() {
  const instance = new PasswordApp();
  instance.init();
  if (typeof window !== 'undefined') window.app = instance;
  return instance;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp, { once: true });
  } else {
    bootstrapApp();
  }
}
