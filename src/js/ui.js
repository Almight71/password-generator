/**
 * PASSWORD GENERATOR — UI.JS
 * ==========================
 * Визуальный слой: отображение пароля, индикатор силы,
 * таблица записей, всплывающие уведомления и модальное подтверждение.
 *
 * Модуль не содержит бизнес-логики — только DOM.
 * Все данные приходят извне, все события возвращаются
 * обработчику через делегирование (см. app.js).
 *
 * @version 1.0.0
 * @author Almight71
 * @license MIT
 *
 * Особенности:
 * - Делегирование событий вместо inline onclick (безопаснее и CSP-совместимо)
 * - aria-live для уведомлений (доступность, WCAG 2.1)
 * - Модальное подтверждение вместо блокирующего confirm()
 */

/**
 * Управляет DOM-состоянием интерфейса.
 */
class UIManager {
  /**
   * @param {Document} [doc=document] - Документ (позволяет тестировать с jsdom)
   */
  constructor(doc = document) {
    /** @type {Document} */
    this.doc = doc;
    /** @type {HTMLElement|null} Контейнер таблицы */
    this.listEl = doc.getElementById('passwordsList');
    /** @type {HTMLElement|null} Элемент вывода пароля */
    this.passwordEl = doc.getElementById('password');
    /** @type {HTMLElement|null} Полоса индикатора силы */
    this.strengthBarEl = doc.getElementById('strengthBar');
    /** @type {HTMLElement|null} Текст уровня силы */
    this.strengthTextEl = doc.getElementById('strengthText');
    /** @type {HTMLElement|null} Текст энтропии */
    this.entropyTextEl = doc.getElementById('entropyText');
    /** @type {HTMLElement|null} Контейнер уведомлений */
    this.toastEl = doc.getElementById('toast');
    /** @type {number} Идентификатор таймера скрытия уведомления */
    this.toastTimer = null;
    /** @type {number} id записи, открытой в таблице */
    this.expandedId = null;
  }

  /* ============================================================
   * ВЫВОД ТЕКУЩЕГО ПАРОЛЯ
   * ============================================================ */

  /**
   * Показывает сгенерированный пароль.
   *
   * @param {string} password - Пароль для отображения
   * @param {string} [placeholder='—'] - Текст, если пароль пуст
   * @returns {void}
   */
  setPassword(password, placeholder = '—') {
    if (!this.passwordEl) return;
    this.passwordEl.textContent = password || placeholder;
  }

  /**
   * Обновляет индикатор силы: цвет полосы, подпись, биты энтропии.
   *
   * @param {{score:number, label:string, className:string, bits:number, percent:number}} strength
   *        Результат PasswordGenerator.calculateStrength
   * @returns {void}
   */
  setStrength(strength) {
    if (!strength) return;

    if (this.strengthBarEl) {
      this.strengthBarEl.className = `strength-bar ${strength.className}`.trim();
      this.strengthBarEl.style.width = `${clamp(strength.percent, 0, 100)}%`;
      this.strengthBarEl.setAttribute('aria-valuenow', String(strength.percent));
      this.strengthBarEl.setAttribute('aria-valuetext', strength.label);
    }

    if (this.strengthTextEl) {
      this.strengthTextEl.textContent = strength.label;
    }

    if (this.entropyTextEl) {
      this.entropyTextEl.textContent =
        strength.score < 0 ? '—' : `≈ ${strength.bits} бит`;
    }
  }

  /**
   * Сбрасывает индикатор в исходное состояние.
   * @returns {void}
   */
  resetStrength() {
    this.setStrength({ score: -1, label: STRENGTH_EMPTY_LABEL, className: '', bits: 0, percent: 0 });
  }

  /* ============================================================
   * ТАБЛИЦА ЗАПИСЕЙ
   * ============================================================ */

  /**
   * Рисует таблицу сохранённых паролей.
   *
   * @param {Array<Object>} records - Записи (уже отфильтрованные)
   * @param {{showControls:boolean}} [options]
   * @returns {void}
   */
  renderTable(records, options = {}) {
    if (!this.listEl) return;

    const showControls = options.showControls !== false;
    const items = Array.isArray(records) ? records : [];

    if (items.length === 0) {
      this.listEl.innerHTML =
        '<div class="empty-message" role="status">Нет сохранённых паролей. Создайте первый!</div>';
      this.expandedId = null;
      return;
    }

    const head = `
      <table class="passwords-table">
        <caption class="visually-hidden">Сохранённые пароли</caption>
        <thead>
          <tr>
            <th scope="col">Название</th>
            <th scope="col">Пароль</th>
            <th scope="col">Сила</th>
            <th scope="col">Создан</th>
            <th scope="col">Действия</th>
          </tr>
        </thead>
        <tbody>`;

    const rows = items.map((record) => this.renderRow(record)).join('');
    const controls = showControls ? '' : '';

    this.listEl.innerHTML = `${head}${rows}</tbody></table>${controls}`;
  }

  /**
   * Рендерит одну строку таблицы.
   *
   * @param {Object} record - Запись схемы v1
   * @returns {string} HTML строки
   */
  renderRow(record) {
    const level = STRENGTH_LEVELS[clamp(record.strengthScore, 0, STRENGTH_LEVELS.length - 1)];
    const expanded = this.expandedId === record.id;
    const shownValue = expanded ? escapeHtml(record.password) : PASSWORD_MASK;
    const visibilityLabel = expanded ? 'Скрыть пароль' : 'Показать пароль';
    const visibilityIcon = expanded ? '🙈' : '👁️';

    return `
      <tr data-id="${escapeHtml(record.id)}">
        <td class="name-cell" title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</td>
        <td class="password-cell">
          <code class="password-content ${expanded ? '' : 'masked'}">${shownValue}</code>
        </td>
        <td>
          <span class="strength-badge ${level.badge}">${escapeHtml(level.label)}</span>
        </td>
        <td class="date-cell">${escapeHtml(formatStoredDate(record.createdAt))}</td>
        <td>
          <div class="action-buttons">
            <button type="button" class="btn-toggle btn-small" data-action="toggle"
                    aria-label="${visibilityLabel}: ${escapeHtml(record.name)}"
                    title="${visibilityLabel}">${visibilityIcon}</button>
            <button type="button" class="btn-copy btn-small" data-action="copy"
                    aria-label="Скопировать пароль: ${escapeHtml(record.name)}"
                    title="Скопировать">📋</button>
            <button type="button" class="btn-delete btn-small" data-action="delete"
                    aria-label="Удалить пароль: ${escapeHtml(record.name)}"
                    title="Удалить">🗑️</button>
          </div>
        </td>
      </tr>`;
  }

  /**
   * Запоминает, какая запись раскрыта, и перерисовывает строку.
   *
   * @param {Array<Object>} records - Текущий набор записей
   * @param {number} id - id раскрытой записи
   * @returns {void}
   */
  setExpanded(records, id) {
    this.expandedId = this.expandedId === id ? null : id;
    this.renderTable(records);
  }

  /* ============================================================
   * УВЕДОМЛЕНИЯ И ДИАЛОГИ
   * ============================================================ */

  /**
   * Показывает не блокирующее уведомление.
   *
   * @param {string} message - Текст
   * @param {'success'|'error'|'info'} [type='success'] - Тип уведомления
   * @param {number} [duration=3000] - Время показа, мс
   * @returns {void}
   */
  toast(message, type = 'success', duration = 3000) {
    if (!this.toastEl) {
      console.log(`[UI:${type}] ${message}`);
      return;
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    const icon = type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '✓';
    this.toastEl.textContent = `${icon} ${message}`;
    this.toastEl.className = `toast toast-${type} show`;
    this.toastEl.setAttribute('role', type === 'error' ? 'alert' : 'status');

    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastTimer = null;
    }, duration);
  }

  /**
   * Показывает модальное подтверждение (замена confirm()).
   *
   * @param {string} message - Вопрос пользователю
   * @param {string} [confirmLabel='Удалить'] - Текст кнопки подтверждения
   * @returns {Promise<boolean>} true, если пользователь подтвердил
   */
  confirm(message, confirmLabel = 'Подтвердить') {
    return new Promise((resolve) => {
      const overlay = this.doc.getElementById('confirmOverlay');
      if (!overlay) {
        // Fallback, если модальное окно не смонтировано
        resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
        return;
      }

      const textEl = overlay.querySelector('[data-confirm-message]');
      const acceptEl = overlay.querySelector('[data-confirm-accept]');
      const rejectEl = overlay.querySelector('[data-confirm-reject]');

      if (textEl) textEl.textContent = message;
      if (acceptEl) acceptEl.textContent = confirmLabel;

      const previousFocus = this.doc.activeElement;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      if (acceptEl) acceptEl.focus();

      let settled = false;

      /** Закрывает диалог и передаёт результат. */
      const close = (result) => {
        if (settled) return;
        settled = true;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        acceptEl?.removeEventListener('click', onAccept);
        rejectEl?.removeEventListener('click', onReject);
        overlay.removeEventListener('keydown', onKeydown);
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(result);
      };

      const onAccept = () => close(true);
      const onReject = () => close(false);
      const onKeydown = (event) => {
        if (event.key === 'Escape') close(false);
        if (event.key === 'Enter') close(true);
      };

      acceptEl?.addEventListener('click', onAccept);
      rejectEl?.addEventListener('click', onReject);
      overlay.addEventListener('keydown', onKeydown);
    });
  }

  /* ============================================================
   * ВСПОМОГАТЕЛЬНОЕ
   * ============================================================ */

  /**
   * Подставляет значение в счётчик длины рядом со слайдером.
   *
   * @param {number} value - Текущая длина
   * @returns {void}
   */
  setLengthValue(value) {
    const el = this.doc.getElementById('lengthValue');
    if (el) el.textContent = String(clamp(value, PASSWORD_LIMITS.MIN_LENGTH, PASSWORD_LIMITS.MAX_LENGTH));
  }

  /**
   * Обновляет счётчик количества сохранённых паролей.
   *
   * @param {number} total - Всего записей
   * @param {number} shown - Показано после фильтра
   * @returns {void}
   */
  setCounter(total, shown) {
    const el = this.doc.getElementById('passwordsCount');
    if (!el) return;
    if (total === 0) {
      el.textContent = '';
      return;
    }
    el.textContent = shown === total ? `Всего: ${total}` : `Найдено: ${shown} из ${total}`;
  }
}

/**
 * Форматирует дату записи: ISO → локальный формат,
 * а если значение не парсится — выводит как есть.
 *
 * @param {string} raw - Значение поля createdAt
 * @returns {string} Отображаемая дата
 */
function formatStoredDate(raw) {
  const value = toSafeString(raw);
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return formatDate(parsed);
}
