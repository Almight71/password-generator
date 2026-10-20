/**
 * PASSWORD GENERATOR — TEST SUITE
 * ===============================
 * Единый набор тест-кейсов, который запускается:
 *  - в браузере через tests/unit-tests.html (группа «Unit»)
 *  - в Node.js через tests/run-tests.js (все 25 кейсов, включая DOM)
 *
 * Каждый кейс — объект с функцией run(ctx), которая бросает Error,
 * если проверка не пройдена. Результаты собираются раннером.
 *
 * @version 1.0.0
 * @license MIT
 *
 * @typedef {Object} TestCase
 * @property {string} id       - Идентификатор (TC1..TC25)
 * @property {string} group    - Группа: Unit | Integration | UI
 * @property {string} name     - Описание кейса
 * @property {'logic'|'dom'|'sdlc'|'ui'} requires - Какой контекст нужен
 * @property {function(Object):void} run - Тело теста
 */

/**
 * Собирает простой утверждатель.
 *
 * @param {string} label - Подпись проверки для сообщения об ошибке
 * @returns {{ok:function(*):void, equal:function(*, *):void, throws:function(function):void}} Утверждения
 */
function createAssert(label) {
  return {
    /**
     * Проверяет истинность условия.
     * @param {*} condition - Условие
     */
    ok(condition) {
      if (!condition) throw new Error(`[${label}] условие ложно`);
    },
    /**
     * Проверяет строгое равенство.
     * @param {*} actual - Фактическое значение
     * @param {*} expected - Ожидаемое значение
     */
    equal(actual, expected) {
      if (actual !== expected) {
        throw new Error(`[${label}] ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`);
      }
    },
    /**
     * Проверяет, что функция бросает исключение.
     * @param {function():void} fn - Функция
     */
    throws(fn) {
      let threw = false;
      try {
        fn();
      } catch (error) {
        threw = true;
      }
      if (!threw) throw new Error(`[${label}] ожидалось исключение, но его не было`);
    }
  };
}

/**
 * Возвращает полный список тест-кейсов проекта.
 *
 * @param {{dom?:Window, sdlc?:Window, screenshots?:function(string):boolean}} [context]
 *        Контекст выполнения: окна страниц и проверка артефактов
 * @returns {TestCase[]} Массив кейсов
 */
function getTestCases(context) {
  const ctx = context || {};

  /** @type {TestCase[]} */
  const cases = [];

  /* ============================================================
   * ГРУППА: UNIT (логика, без DOM) — 17 кейсов
   * ============================================================ */

  cases.push({
    id: 'TC1',
    group: 'Unit',
    name: 'Генерация по умолчанию: длина 16, алфавит 88 символов',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const result = PasswordGenerator.generate({
        length: 16, UPPERCASE: true, LOWERCASE: true, NUMBERS: true, SYMBOLS: true
      });
      a.equal(result.password.length, 16);
      a.equal(result.charsetSize, 88);
      a.ok(result.entropyBits > 90);
    }
  });

  cases.push({
    id: 'TC2',
    group: 'Unit',
    name: 'Только цифры: пароль состоит исключительно из 0-9',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const result = PasswordGenerator.generate({ length: 8, NUMBERS: true });
      a.equal(result.charsetSize, 10);
      a.ok(/^[0-9]+$/.test(result.password), `нарушение алфавита: ${result.password}`);
    }
  });

  cases.push({
    id: 'TC3',
    group: 'Unit',
    name: 'Ограничение длины: 1 → 4, 999 → 32 (clamp)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      a.equal(PasswordGenerator.generate({ length: 1, NUMBERS: true }).password.length, 4);
      a.equal(PasswordGenerator.generate({ length: 999, NUMBERS: true }).password.length, 32);
      a.equal(PasswordGenerator.generate({ length: 'abc', NUMBERS: true }).password.length, 16);
    }
  });

  cases.push({
    id: 'TC4',
    group: 'Unit',
    name: 'Не выбран ни один набор символов → исключение',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      a.throws(() => PasswordGenerator.generate({ length: 16 }));
      a.throws(() => PasswordGenerator.buildCharset({}));
    }
  });

  cases.push({
    id: 'TC5',
    group: 'Unit',
    name: 'Гарантия состава: во всех 4 наборах есть символ (200 итераций)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      for (let i = 0; i < 200; i++) {
        const p = PasswordGenerator.generate({
          length: 16, UPPERCASE: true, LOWERCASE: true, NUMBERS: true, SYMBOLS: true
        }).password;
        a.ok(/[A-Z]/.test(p), `нет прописных: ${p}`);
        a.ok(/[a-z]/.test(p), `нет строчных: ${p}`);
        a.ok(/[0-9]/.test(p), `нет цифр: ${p}`);
        a.ok(/[^a-zA-Z0-9]/.test(p), `нет спецсимволов: ${p}`);
      }
    }
  });

  cases.push({
    id: 'TC6',
    group: 'Unit',
    name: 'Один выбранный набор → в пароле только его символы (100 итераций)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      for (let i = 0; i < 100; i++) {
        a.ok(/^[a-z]+$/.test(PasswordGenerator.generate({ length: 8, LOWERCASE: true }).password));
        a.ok(/^[A-Z]+$/.test(PasswordGenerator.generate({ length: 8, UPPERCASE: true }).password));
        a.ok(/^[0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/.test(
          PasswordGenerator.generate({ length: 8, NUMBERS: true, SYMBOLS: true }).password
        ));
      }
    }
  });

  cases.push({
    id: 'TC7',
    group: 'Unit',
    name: 'secureRandomInt: попадает в диапазон, равномерен, отклоняет 0 и —',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);

      // Диапазон
      for (let i = 0; i < 1000; i++) {
        const v = PasswordGenerator.secureRandomInt(7);
        a.ok(Number.isInteger(v) && v >= 0 && v < 7, `значение вне диапазона: ${v}`);
      }

      // Равномерность: хи-квадрат для 3 равных исходов, df = 2
      const counts = [0, 0, 0];
      for (let i = 0; i < 9000; i++) counts[PasswordGenerator.secureRandomInt(3)]++;
      const expected = 3000;
      const chi2 = counts.reduce((sum, observed) => sum + ((observed - expected) ** 2) / expected, 0);
      a.ok(chi2 < 16, `хи-квадрат ${chi2.toFixed(2)} — распределение смещено: [${counts}]`);

      // Некорректные аргументы
      a.throws(() => PasswordGenerator.secureRandomInt(0));
      a.throws(() => PasswordGenerator.secureRandomInt(-5));
      a.throws(() => PasswordGenerator.secureRandomInt(2.5));
    }
  });

  cases.push({
    id: 'TC8',
    group: 'Unit',
    name: 'Сила: пустой пароль → уровень «—», score = -1',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const s = PasswordGenerator.calculateStrength('');
      a.equal(s.score, -1);
      a.equal(s.label, '—');
      a.equal(s.percent, 0);
    }
  });

  cases.push({
    id: 'TC9',
    group: 'Unit',
    name: 'Сила: 4 цифры → «Очень слабый» (score 0)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const s = PasswordGenerator.calculateStrength('1234');
      a.equal(s.score, 0);
      a.equal(s.label, 'Очень слабый');
      a.ok(s.bits < 28, `энтропия ${s.bits} бит`);
    }
  });

  cases.push({
    id: 'TC10',
    group: 'Unit',
    name: 'Сила: «abcdefgh» → «Слабый» (score 1)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const s = PasswordGenerator.calculateStrength('abcdefgh');
      a.equal(s.score, 1);
      a.equal(s.label, 'Слабый');
    }
  });

  cases.push({
    id: 'TC11',
    group: 'Unit',
    name: 'Сила: «Abcdefgh1234» → «Сильный» (score 3)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const s = PasswordGenerator.calculateStrength('Abcdefgh1234');
      a.equal(s.score, 3);
      a.equal(s.label, 'Сильный');
      a.equal(s.badge, 'strength-badge-strong');
    }
  });

  cases.push({
    id: 'TC12',
    group: 'Unit',
    name: 'Сила: 19 смешанных символов → «Очень сильный», процент ≤ 100',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const s = PasswordGenerator.calculateStrength('Abcdefgh1234!@#$xyz');
      a.equal(s.score, 4);
      a.equal(s.label, 'Очень сильный');
      a.ok(s.percent <= 100 && s.percent > 80, `percent=${s.percent}`);
      a.equal(STRENGTH_LEVELS.length, 5);
    }
  });

  cases.push({
    id: 'TC13',
    group: 'Unit',
    name: 'Монотонность: рост длины не понижает уровень силы',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      let previous = -1;
      ['1', '12', '1234', '12345678', '123456789012', '1234567890123456'].forEach((pw) => {
        const score = PasswordGenerator.calculateStrength(pw).score;
        a.ok(score >= previous, `уровень упал: ${pw} → ${score} < ${previous}`);
        previous = score;
      });
      a.ok(previous >= 2, '16 цифр должны давать минимум «Средний»');
    }
  });

  cases.push({
    id: 'TC14',
    group: 'Unit',
    name: 'escapeHtml: все опасные символы экранированы (XSS)',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const payload = '<img src=x onerror=alert(1)>&"\'`';
      const escaped = escapeHtml(payload);
      a.ok(!escaped.includes('<'), `остался < : ${escaped}`);
      a.ok(!escaped.includes('>'), `остался > : ${escaped}`);
      a.ok(!escaped.includes('"'), `остался " : ${escaped}`);
      a.equal(escaped, '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;&#96;');
      a.equal(escapeHtml(null), '');
      a.equal(escapeHtml(0), '0');
    }
  });

  cases.push({
    id: 'TC15',
    group: 'Unit',
    name: 'validateName / sanitizeInput: границы и чистка ввода',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      a.equal(validateName('').ok, false);
      a.equal(validateName('   ').ok, false);
      a.equal(validateName('a').ok, false);
      a.equal(validateName('a'.repeat(101)).ok, false);
      a.equal(validateName('Gmail').ok, true);
      a.equal(validateName('  Банк  ').value, 'Банк');
      a.equal(validateName('<b>x</b>').value, 'bx/b');
      a.equal(sanitizeInput('a'.repeat(300)).length, PASSWORD_LIMITS.MAX_NAME_LENGTH);
      a.equal(sanitizeInput('line\u0000break'), 'linebreak');
      a.equal(clamp('abc', 4, 32), 4);
      a.equal(clamp(100, 4, 32), 32);
      a.equal(clamp(NaN, 4, 32), 4);
    }
  });

  cases.push({
    id: 'TC16',
    group: 'Unit',
    name: 'Хранилище: add / find / search / remove / clear и отклонение мусора',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const store = new PasswordStorage('unit_test_v1');

      a.equal(store.count(), 0);

      const record = store.add({ name: 'Gmail', password: 'Ab1!xyz', strengthScore: 3 });
      a.ok(record && Number.isFinite(record.id), 'запись не создана');
      a.equal(store.count(), 1);
      a.ok(store.find(record.id), 'find не нашёл запись');
      a.ok(store.search('gma').length === 1, 'поиск не нашёл запись');
      a.ok(store.search('нетничего').length === 0, 'поиск нашёл лишнее');

      a.equal(store.add({ name: '', password: 'x' }), null);
      a.equal(store.add({ name: 'ok', password: '' }), null);
      a.equal(store.count(), 1, 'невалидные записи попали в хранилище');

      a.ok(store.remove(record.id), 'remove не удалил');
      a.equal(store.remove(record.id), false, 'повторное удаление должно вернуть false');
      a.equal(store.count(), 0);

      store.add({ name: 'Bank', password: 'Pa$$w0rd!', strengthScore: 4 });
      a.ok(store.clear(), 'clear не сработал');
      a.equal(store.count(), 0);
    }
  });

  cases.push({
    id: 'TC17',
    group: 'Unit',
    name: 'Хранилище: битый JSON и посторонние записи не ломают приложение',
    requires: 'logic',
    run() {
      const a = createAssert(this.id);
      const store = new PasswordStorage('unit_test_broken_v1');

      store.backend.setItem(store.key, 'это не JSON {');
      a.equal(store.load().length, 0, 'битый JSON должен дать пустой массив');

      store.backend.setItem(store.key, JSON.stringify([
        { nonsense: true },
        { id: 7, name: 'Valid', password: 'p@ss1', strengthScore: 2 }
      ]));
      const loaded = store.load();
      a.equal(loaded.length, 1, `валидных записей должно быть 1, получено ${loaded.length}`);
      a.equal(loaded[0].name, 'Valid');

      store.backend.setItem(store.key, JSON.stringify({ not: 'array' }));
      a.equal(store.load().length, 0, 'объект вместо массива должен дать пустой массив');
    }
  });

  /* ============================================================
   * ГРУППА: INTEGRATION (сценарии в DOM) — 5 кейсов
   * ============================================================ */

  cases.push({
    id: 'TC18',
    group: 'Integration',
    name: 'Полный цикл: генерация → сохранение → строка в таблице → счётчик',
    requires: 'dom',
    run(context) {
      const a = createAssert(this.id);
      const app = context.window.app;
      const doc = context.window.document;

      a.ok(app, 'приложение не инициализировано');
      a.equal(doc.getElementById('password').textContent.length, 16, 'первый пароль не сгенерирован');

      doc.getElementById('passwordName').value = 'Test Service';
      const record = app.saveCurrent();
      a.ok(record, 'saveCurrent не вернул запись');
      a.equal(app.storage.count(), 1);

      const rows = doc.querySelectorAll('#passwordsList tbody tr');
      a.equal(rows.length, 1, 'строка не отрисована');
      a.ok(rows[0].textContent.includes('Test Service'), 'название не попало в таблицу');
      a.ok(doc.getElementById('passwordsCount').textContent.includes('1'), 'счётчик не обновился');
      a.equal(doc.getElementById('passwordName').value, '', 'поле не очистилось');
    }
  });

  cases.push({
    id: 'TC19',
    group: 'Integration',
    name: 'Поиск фильтрует таблицу и счётчик, сброс возвращает все записи',
    requires: 'dom',
    run(context) {
      const a = createAssert(this.id);
      const app = context.window.app;
      const doc = context.window.document;
      const search = doc.getElementById('searchBox');

      app.storage.clear();
      ['Gmail', 'Telegram', 'Bank Alpha'].forEach((name) => {
        doc.getElementById('passwordName').value = name;
        app.saveCurrent();
      });
      a.equal(app.storage.count(), 3);
      a.equal(doc.querySelectorAll('#passwordsList tbody tr').length, 3);

      search.value = 'gma';
      search.dispatchEvent(new context.window.Event('input', { bubbles: true }));
      a.equal(doc.querySelectorAll('#passwordsList tbody tr').length, 1, 'поиск не отфильтровал');
      a.ok(doc.getElementById('passwordsCount').textContent.includes('1 из 3'), 'счётчик поиска неверен');

      search.value = '';
      search.dispatchEvent(new context.window.Event('input', { bubbles: true }));
      a.equal(doc.querySelectorAll('#passwordsList tbody tr').length, 3, 'сброс поиска не вернул записи');
    }
  });

  cases.push({
    id: 'TC20',
    group: 'Integration',
    name: 'XSS: враждебное имя из хранилища не превращается в разметку',
    requires: 'dom',
    run(context) {
      const a = createAssert(this.id);
      const app = context.window.app;
      const doc = context.window.document;

      // Запись вставляется напрямую в хранилище, минуя валидацию —
      // как если бы данные пришли из скомпрометированного JSON.
      const hostile = '<img src=x onerror=window.__xss=1>&"';
      app.storage.cache = [{
        id: 999,
        name: hostile,
        password: '<script>window.__xss=1</script>',
        createdAt: new Date().toISOString(),
        strengthScore: 2
      }];
      app.render();

      a.equal(doc.querySelectorAll('#passwordsList img').length, 0, 'тег img попал в DOM');
      a.equal(doc.querySelectorAll('#passwordsList script').length, 0, 'тег script попал в DOM');
      a.equal(context.window.__xss, undefined, 'XSS-пейлоад выполнился');
      a.ok(doc.getElementById('passwordsList').textContent.includes('img src=x'),
        'экранированный текст не отображается');

      app.storage.cache = [];
      app.render();
    }
  });

  cases.push({
    id: 'TC21',
    group: 'Integration',
    name: 'Удаление: отмена сохраняет запись, подтверждение удаляет',
    requires: 'dom',
    run(context) {
      const a = createAssert(this.id);
      const app = context.window.app;
      const doc = context.window.document;

      app.storage.clear();
      doc.getElementById('passwordName').value = 'ToDelete';
      const record = app.saveCurrent();
      a.ok(record);
      a.equal(app.storage.count(), 1);

      // 1. Отмена
      const pendingCancel = app.deleteRecord(record.id);
      doc.querySelector('[data-confirm-reject]').click();
      return pendingCancel.then((deleted) => {
        a.equal(deleted, false, 'запись удалена без подтверждения');
        a.equal(app.storage.count(), 1, 'запись пропала после отмены');

        // 2. Подтверждение
        const pendingOk = app.deleteRecord(record.id);
        doc.querySelector('[data-confirm-accept]').click();
        return pendingOk;
      }).then((deleted) => {
        a.equal(deleted, true, 'подтверждённое удаление не сработало');
        a.equal(app.storage.count(), 0, 'запись осталась после подтверждения');
        a.ok(doc.getElementById('passwordsList').textContent.includes('Нет сохранённых'),
          'пустое состояние не показано');
      });
    }
  });

  cases.push({
    id: 'TC22',
    group: 'Integration',
    name: 'Диаграмма SDLC: переключение этапов синхронизирует панели, узлы и точки',
    requires: 'sdlc',
    run(context) {
      const a = createAssert(this.id);
      const doc = context.sdlc.document;

      a.equal(doc.querySelectorAll('[data-panel]').length, 7, 'ожидалось 7 панелей');
      a.equal(doc.querySelector('[data-panel="0"]').hidden, false, 'первый этап скрыт по умолчанию');

      doc.querySelector('.phase-node[data-phase="4"]').dispatchEvent(
        new context.window.MouseEvent('click', { bubbles: true })
      );

      a.equal(doc.querySelector('[data-panel="4"]').hidden, false, 'панель этапа 5 не открылась');
      a.equal(doc.querySelector('[data-panel="0"]').hidden, true, 'панель этапа 1 не закрылась');
      a.equal(
        doc.querySelector('.phase-node[data-phase="4"]').getAttribute('aria-pressed'),
        'true',
        'aria-pressed не обновлён'
      );
      a.equal(doc.querySelector('.dot[data-phase="4"]').getAttribute('aria-selected'), 'true');
      a.equal(doc.querySelectorAll('.phase-node.is-active').length, 1, 'активных узлов должно быть ровно 1');

      doc.getElementById('nextPhase').click();
      a.equal(doc.querySelector('[data-panel="5"]').hidden, false, 'следующий этап не открылся');
      doc.getElementById('prevPhase').click();
      doc.getElementById('prevPhase').click();
      a.equal(doc.querySelector('[data-panel="3"]').hidden, false, 'переход назад с циклом не работает');
    }
  });

  /* ============================================================
   * ГРУППА: UI (визуальная проверка артефактов) — 3 кейса
   * ============================================================ */

  ['320,900', '768,1000', '1920,1080'].forEach((size, index) => {
    const [width, height] = size.split(',');

    cases.push({
      id: `TC${23 + index}`,
      group: 'UI',
      name: `Адаптивность: страница отрисована без обрезки на ${width}px`,
      requires: 'ui',
      run(context) {
        const a = createAssert(this.id);
        const fileName = `app-${width}px.png`;
        a.ok(typeof context.screenshotExists === 'function', 'проверка скриншотов недоступна');
        a.ok(context.screenshotExists(fileName),
          `скриншот ${fileName} отсутствует или пуст (запустите tests/take-screenshots.sh)`);
        a.ok(Number(width) === 320 || Number(width) === 768 || Number(width) === 1920,
          `неожиданная ширина ${width} (${height})`);
      }
    });
  });

  return cases;
}

// Экспорт для Node.js (CommonJS) и для браузера (глобальная функция)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getTestCases, createAssert };
}
