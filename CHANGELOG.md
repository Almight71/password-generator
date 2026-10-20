# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

Все заметные изменения этого проекта описаны в этом файле.

---

## [1.0.0] — 2026-10-20

Первый production-релиз: полный цикл SDLC от требований до развёртывания.

### Добавлено

**Генерация**

- `PasswordGenerator.generate()` — пароли длиной 4–32 символа (по умолчанию 16)
- Четыре набора символов (`UPPERCASE`, `LOWERCASE`, `NUMBERS`, `SYMBOLS`, всего 88)
- `crypto.getRandomValues` + **rejection sampling** — без смещения, в отличие от `Math.random`
- Fisher–Yates на том же CSPRNG для перемешивания
- Гарантия минимум одного символа каждого выбранного класса
- `calculateStrength()` — 5 уровней силы по энтропии Шеннона (0 / 28 / 44 / 64 / 88 бит)
- `estimateBits()` — энтропия готового пароля по фактическому составу

**Хранение**

- `PasswordStorage` с CRUD: `getAll`, `count`, `find`, `add`, `remove`, `clear`, `search`
- Схема v1: `{id, name, password, createdAt, strengthScore}`
- Автоматическая миграция из легаси-ключа `passwords` (v0), включая
  `strength: "weak"|"medium"|"strong"` → `strengthScore: 0–4`
- `MemoryStore` — адаптер в памяти для тестов и приватного режима
- Устойчивость к битому JSON, посторонним записям и переполнению quota

**Интерфейс**

- Поле вывода пароля, индикатор силы с полосой и текстом энтропии
- Настройки: ползунок длины и 4 чекбокса с защитой «нельзя снять все»
- Таблица сохранённых паролей: показ/маскирование, копирование, удаление
- Поиск с реагированием на `input` и счётчик «Найдено: M из N»
- Модальное подтверждение вместо `window.confirm` (Escape / Enter, возврат фокуса)
- Не блокирующие тосты с `aria-live`
- Адаптивная раскладка от 320px

**Безопасность**

- `escapeHtml` (6 символов) во всех вставках в разметку
- `sanitizeInput` для пользовательского ввода (`<> " ' `` ` ``, управляющие символы)
- Clipboard API только в secure context + резервный `execCommand`
- Нет сетевых запросов, нет сторонних скриптов, нет аналитики

**Документация SDLC (7 документов)**

- `docs/SDLC/01_REQUIREMENTS.md` — FR1–FR9, NFR1–NFR8, personas, use cases
- `docs/SDLC/02_ANALYSIS.md` — потоки, модель данных, риски, технический выбор
- `docs/SDLC/03_DESIGN.md` — токены, компоненты, макеты, доступность
- `docs/SDLC/04_DEVELOPMENT.md` — 5 ADR, стиль кода, журнал исправлений
- `docs/SDLC/05_TESTING.md` — стратегия, покрытие требований, чек-лист
- `docs/SDLC/06_DEPLOYMENT.md` — GitHub Pages, миграция данных, откат
- `docs/SDLC/07_MAINTENANCE.md` — политика поддержки, роадмап, безопасность

**Сопутствующая документация**

- `docs/ARCHITECTURE.md` — слои, потоки данных, паттерны, точки расширения
- `docs/API.md` — справочник публичного API с примерами
- `docs/USER_GUIDE.md` — руководство пользователя со скриншотами

**Артефакты**

- `src/sdlc_cycle.html` — интерактивная диаграмма: 7 этапов, ARIA,
  навигация кликом, `←`/`→`, `Home`/`End`, `Escape`
- `assets/diagrams/*.svg` — architecture, data-flow, erd, sdlc-cycle
- `assets/mockups/*.svg` — wireframe-desktop, wireframe-mobile
- `assets/screenshots/*.png` — 320 / 768 / 1920 px + диаграмма SDLC

**Тестирование**

- 25 тест-кейсов: **17 unit + 5 интеграционных + 3 визуальных**
- `tests/run-tests.js` — раннер на Node.js (`vm` + jsdom), код выхода 1 при провале
- `tests/unit-tests.html` — интерактивный прогон логики в браузере
- `tests/test-suite.js` — единый источник правды для обоих раннеров
- `tests/take-screenshots.sh` — Firefox headless, режим `#snapshot` без анимаций
- Отчёты: `test-cases.md`, `test-report.md`, `integration-tests.md`

**Инфраструктура**

- `package.json` со скриптами `start`, `test`, `test:unit`, `screenshots`
- `index.html` в корне — точка входа сайта (редирект на `src/index.html`)
- `LICENSE` (MIT), `CONTRIBUTING.md`, `README.md`

### Исправлено

Дефекты, найденные и закрытые во время разработки (см.
[docs/SDLC/04_DEVELOPMENT.md §7](docs/SDLC/04_DEVELOPMENT.md)):

- `calculateStrength` всегда возвращал первый уровень — обратный перебор порогов
- `PasswordStorage.cache` был `undefined` в конструкторе (порядок инициализации)
- Нечисловая длина превращалась в 4 вместо значения по умолчанию
- Слишком длинное название молча обрезалось, а должно отклоняться
- `escapeHtml` не экранировал обратный апостроф
- Скриншоты фиксировали кадр анимации — введён режим `#snapshot`
- Подписи узлов диаграммы пересекали пунктирные дуги
- Firefox отклоняет `--window-size` с разделителем `x` — переход на `width,height`

### Известные ограничения

- Пароли хранятся в `localStorage` открытым текстом (план — мастер-пароль в v1.1)
- Копирование не покрыто автотестами: Clipboard API отсутствует в jsdom
- CSP пока не задействован: inline-скрипты нужны для работы по `file://`

---

## Нумерация в будущем

| Тип изменения | Версия |
|---|---|
| Новая совместимая функция | minor |
| Исправление дефекта | patch |
| Изменение API или схемы хранилища | major |

История версий: [https://github.com/Almight71/password-generator/releases](https://github.com/Almight71/password-generator/releases)
