# 02. Анализ (Analysis)

**Проект:** Password Generator with Storage
**Версия документа:** 1.0.0
**Статус:** ✅ Завершено
**Предыдущий этап:** [01_REQUIREMENTS.md](01_REQUIREMENTS.md) · **Следующий:** [03_DESIGN.md](03_DESIGN.md)

---

## 1. Архитектура приложения

Приложение построено по слоям: каждый слой знает только о слое под собой
и не знает о слоях выше. Это позволяет заменить хранилище или интерфейс,
не трогая бизнес-логику.

```
┌───────────────────────────────────────────────────────────────┐
│                     PASSWORD GENERATOR                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  PRESENTATION (src/index.html, src/css/styles.css)      │  │
│  │  • форма параметров  • поле вывода  • таблица записей   │  │
│  │  • тосты и модальный диалог  • диаграмма SDLC           │  │
│  └───────────────────────────▲─────────────────────────────┘  │
│                              │ DOM / события                  │
│  ┌───────────────────────────┴─────────────────────────────┐  │
│  │  APPLICATION (src/js/app.js — class PasswordApp)        │  │
│  │  • чтение опций формы      • маршрутизация действий     │  │
│  │  • жизненный цикл          • делегирование событий      │  │
│  └───────────▲───────────────────────────────▲─────────────┘  │
│              │                               │                │
│  ┌───────────┴───────────────┐  ┌────────────┴─────────────┐  │
│  │  DOMAIN (generator.js)    │  │  DATA (storage.js)       │  │
│  │  class PasswordGenerator  │  │  class PasswordStorage   │  │
│  │  • CSPRNG-генерация       │  │  • CRUD над записями     │  │
│  │  • алфавит из опций       │  │  • валидация схемы v1    │  │
│  │  • энтропия и оценка      │  │  • миграция v0 → v1      │  │
│  │  (чистые функции, 0 DOM)  │  │  • адаптер хранилища     │  │
│  └───────────▲───────────────┘  └────────────▲─────────────┘  │
│              │                              │                 │
│  ┌───────────┴──────────────────────────────┴─────────────┐   │
│  │  SHARED (utils.js)                                     │   │
│  │  константы • валидация • escapeHtml • sanitizeInput    │   │
│  └────────────────────────────▲───────────────────────────┘   │
│                               │                               │
│  ┌────────────────────────────┴───────────────────────────┐   │
│  │  BROWSER APIs                                          │   │
│  │  crypto.getRandomValues • localStorage • clipboard     │   │
│  │  Intl.DateTimeFormat  • DOM Level 3                    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Векторная версия: [`assets/diagrams/architecture.svg`](../assets/diagrams/architecture.svg)

---

## 2. Технологический стек

| Слой | Технология | Обоснование выбора |
|---|---|---|
| Разметка | HTML5 | Семантика, доступность, нулевые зависимости |
| Стили | CSS3 (Custom Properties, Grid, Flexbox) | Токены дизайн-системы, простая адаптивность |
| Логика | JavaScript (классы, async/await) | Без сборщика: страница открывается двойным кликом |
| Случайность | `crypto.getRandomValues` (CSPRNG) | `Math.random` не криптостойкий — неприемлем для паролей |
| Хранение | `localStorage` + адаптер | Мгновенно, офлайн, не требует аккаунта |
| Тесты | Node.js + jsdom + Firefox headless | Автотесты логики и DOM, визуальные артефакты |
| Хостинг | GitHub Pages | Статика, HTTPS, публичный URL |

**Почему без бандлера и без ES-модулей:** `type="module"` блокируется политикой
CORS при открытии файла по `file://`. Классические `<script>` в фиксированном
порядке дают рабочее приложение «открой и пользуйся» и при этом полностью
покрываются автотестами.

**Порядок подключения скриптов** (от нижнего уровня к верхнему):

```html
<script src="js/utils.js"></script>      <!-- константы и чистые функции -->
<script src="js/generator.js"></script>  <!-- генерация и оценка -->
<script src="js/storage.js"></script>    <!-- хранилище -->
<script src="js/ui.js"></script>         <!-- отрисовка -->
<script src="js/app.js"></script>        <!-- запуск -->
```

---

## 3. Потоки данных

### 3.1. Генерация пароля

```
Пользователь (слайдер/чекбокс)
        │  input / change
        ▼
PasswordApp.readOptions() ──► {length, UPPERCASE, LOWERCASE, NUMBERS, SYMBOLS}
        │
        ▼
PasswordGenerator.generate(options)
        │  1. buildCharset()       → алфавит (или Error)
        │  2. secureRandomInt()    → по 1 символу из каждого набора
        │  3. заполнение до длины
        │  4. shuffle() (Fisher–Yates)
        ▼
{password, length, charsetSize, entropyBits}
        │
        ├─► UIManager.setPassword()        → <code id="password">
        └─► PasswordGenerator.calculateStrength()
                    │
                    ▼
            UIManager.setStrength()        → полоса, уровень, биты
```

### 3.2. Сохранение и отображение

```
saveCurrent()
   │
   ├─► validateName()  ── не ок ──► UIManager.toast(ошибка)
   │
   ├─► PasswordStorage.add()
   │        ├─ normalizeRecord()
   │        ├─ backend.setItem(JSON)   ← если переполнение → false
   │        └─ вернуть запись
   │
   └─► PasswordApp.render()
            ├─► storage.search(query)
            ├─► UIManager.renderTable()   (все вставки через escapeHtml)
            └─► UIManager.setCounter()
```

Векторная версия: [`assets/diagrams/data-flow.svg`](../assets/diagrams/data-flow.svg)

### 3.3. Таблица событий

| Источник | Событие | Обработчик | Результат |
|---|---|---|---|
| `#generateBtn` | `click` | `generate()` | новый пароль |
| `#copyBtn` | `click` | `copyCurrent()` | буфер обмена + тост |
| `#saveBtn`, `#passwordName` | `click`, `Enter` | `saveCurrent()` | новая запись |
| `#clearBtn` | `click` | `clearAll()` | диалог → очистка |
| `#length` | `input` | `setLengthValue()` + `generate()` | живое обновление |
| `#uppercase`…`#symbols` | `change` | `ensureAtLeastOneSet()` + `generate()` | защита от пустого набора |
| `#searchBox` | `input` | `render()` | фильтрация таблицы |
| `#passwordsList` | `click` (делегирование) | `handleTableAction()` | toggle / copy / delete |
| `#confirmOverlay` | `click`, `Escape` | `UIManager.confirm()` | `Promise<boolean>` |

---

## 4. Модель данных

### 4.1. Схема записи v1

```json
{
  "id": 123456789012345,
  "name": "Gmail",
  "password": "fbT9w6$SCX32}7+d",
  "createdAt": "2026-10-20T07:31:00.000Z",
  "strengthScore": 4
}
```

| Поле | Тип | Правила |
|---|---|---|
| `id` | `number` | уникален; `Date.now()%1e9 * 1e5 + random(0..1e5)` — защита от коллизий |
| `name` | `string` | 2–100 символов после санитизации |
| `password` | `string` | не пустой; хранится открытым текстом (см. риски) |
| `createdAt` | `string` | ISO 8601; форматируется в `ru-RU` при отображении |
| `strengthScore` | `number` | целое 0–4, индекс в `STRENGTH_LEVELS` |

Сохранённый **уровень** не хранится — только балл. При смене порогов в
`STRENGTH_LEVELS` все старые записи автоматически получают актуальную подпись.

### 4.2. Ключи хранилища

| Ключ | Версия | Назначение |
|---|---|---|
| `passwords_v1` | v1 | актуальные данные |
| `passwords` | v0 | данные первой версии; читаются и **удаляются** при первой загрузке (миграция) |

Миграция выполняется в `PasswordStorage.migrateLegacyData()`:

```
localStorage["passwords"] (v0)
   │  strength: "weak" | "medium" | "strong"
   │  createdAt: "20.10.2026"
   ▼
normalizeRecord()
   ├─ strength   → strengthScore (1 | 2 | 3)
   ├─ createdAt  → ISO (при удачном разборе, иначе остаётся строка)
   └─ name       → sanitizeInput()
   ▼
localStorage["passwords_v1"]  +  удаление ключа v0
```

Векторная версия: [`assets/diagrams/erd.svg`](../assets/diagrams/erd.svg)

---

## 5. Классы и зависимости

```
PasswordApp ─────── uses ──────► PasswordStorage ──► backend (localStorage | MemoryStore)
    │                                   │
    │ uses                              │ uses
    ▼                                   ▼
UIManager                          PasswordStorage.normalizeRecord()
    │                                   │
    │ reads DOM                         │ uses
    ▼                                   ▼
index.html / styles.css           utils.js (validateName, sanitizeInput, clamp…)

PasswordApp ─────── uses ──────► PasswordGenerator ──► utils.js (CHAR_SETS, calculateEntropyBits)
                                     │
                                     └──► globalThis.crypto.getRandomValues
```

| Класс / модуль | Ответственность | Зависит от |
|---|---|---|
| `utils.js` | константы, валидация, экранирование | ничего (чистый модуль) |
| `PasswordGenerator` | генерация и оценка | `utils.js`, `crypto` |
| `PasswordStorage` | персистентность записей | `utils.js`, адаптер хранилища |
| `UIManager` | весь DOM: вывод, таблица, тосты, диалог | `utils.js`, `document` |
| `PasswordApp` | координация сценариев | все перечисленные |

**Слабая связанность:** слой данных не знает о DOM, слой DOM не знает о бизнес-правилах.
Поэтому `PasswordStorage` и `PasswordGenerator` тестируются в Node.js без браузера.

---

## 6. Анализ рисков

| # | Риск | Влияние | Вероятность | Меры |
|---|---|---|---|---|
| R1 | XSS через название пароля | Критическое | Средняя | `escapeHtml` на всех вставках (TC14, TC20), санитизация на входе |
| R2 | Криптослабая генерация | Критическое | Низкая | только `crypto.getRandomValues`, rejection sampling без bias (TC7) |
| R3 | Потеря данных (очистка сайта) | Высокое | Высокая | предупреждение в UI, роадмап: экспорт JSON (v1.2) |
| R4 | Чтение паролей другим скриптом origin | Высокое | Низкая | документировано в [07_MAINTENANCE.md](07_MAINTENANCE.md); шифрование в v1.1 |
| R5 | Переполнение localStorage | Среднее | Низкая | `try/catch` в `save()`, понятное сообщение |
| R6 | Повреждённый JSON в хранилище | Среднее | Низкая | `load()` возвращает `[]`, битые записи отбрасываются (TC17) |
| R7 | Блокировка Clipboard API на `file://` | Низкая | Высокая | резервный `execCommand`, понятная ошибка |
| R8 | Коллизии `id` при быстром сохранении | Низкая | Низкая | 5-значный случайный суффикс в `createId()` |

---

## 7. Выводы анализа

1. Трёхслойная архитектура достаточна для продукта такого объёма и оставляет
   место для роста (подмена хранилища на IndexedDB без изменения UI).
2. Главные технические риски — XSS и криптостойкость — закрыты и покрыты тестами.
3. Отказ от бандлера и ES-модулей — осознанное решение в пользу работоспособности
   «из коробки»; ограничение зафиксировано и документируется.
4. Миграция данных между версиями схемы предусмотрена с первого релиза.

**Следующий этап:** [03_DESIGN.md](03_DESIGN.md)
