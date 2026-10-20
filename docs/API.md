# Справочник API

**Проект:** Password Generator with Storage
**Версия:** 1.0.0
**Стабильность контракта:** `stable` для `utils.js`, `generator.js`, `storage.js`;
`internal` для `ui.js` и `app.js` (могут меняться без объявления мажорной версии).

Все модули подключаются обычными `<script>` в порядке зависимостей
(см. [ARCHITECTURE.md §3](ARCHITECTURE.md#3-схема-зависимостей-загрузка-скриптов))
и создают глобальные объекты в общем scope.

```html
<script src="js/utils.js"></script>
<script src="js/generator.js"></script>
<script src="js/storage.js"></script>
<script src="js/ui.js"></script>
<script src="js/app.js"></script>
```

> **Конвенции.** `@throws` — исключение, которое вызывающий обязан обработать.
> Все возвращаемые объекты заморожены на уровне документации: не мутируйте их.

---

## 1. `src/js/utils.js` — константы и утилиты

### 1.1. Константы

| Константа | Тип | Значение |
|---|---|---|
| `STORAGE_KEY` | `string` | `'passwords_v1'` |
| `CHAR_SETS` | `Readonly<Record<string,string>>` | `UPPERCASE`, `LOWERCASE`, `NUMBERS`, `SYMBOLS` |
| `CHAR_SET_KEYS` | `readonly string[]` | `['UPPERCASE','LOWERCASE','NUMBERS','SYMBOLS']` |
| `PASSWORD_LIMITS` | `{MIN_LENGTH:4, MAX_LENGTH:32, DEFAULT_LENGTH:16, MAX_NAME_LENGTH:100}` | |
| `STRENGTH_LEVELS` | `ReadonlyArray<{minBits,label,className,badge}>` | 5 уровней: 0 / 28 / 44 / 64 / 88 бит |
| `PASSWORD_MASK` | `string` | `'••••••••••••••••'` |
| `STRENGTH_EMPTY_LABEL` | `string` | `'—'` |

**Размеры наборов:** `UPPERCASE` 26, `LOWERCASE` 26, `NUMBERS` 10, `SYMBOLS` 26.
Полный алфавит = **88** символов.

### 1.2. Функции

#### `clamp(value, min, max): number`

Ограничивает число диапазоном `[min, max]`. Нечисловое значение
(включая `NaN` / `Infinity`) заменяется на `min`.

```js
clamp(999, 4, 32)  // 32
clamp('abc', 4, 32) // 4  → в generate() это DEFAULT_LENGTH
```

#### `isIntegerInRange(value, min, max): boolean`

`true`, только если значение — целое внутри границ.

#### `buildCharset(options): string`

Склеивает строки включённых наборов. Порядок фиксирован
(`UPPERCASE → LOWERCASE → NUMBERS → SYMBOLS`).

```js
buildCharset({ NUMBERS: true })                 // '0123456789'
buildCharset({ UPPERCASE: true, NUMBERS: true }) // 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
buildCharset({})                                 // ''
```

#### `countSelectedSets(options): number`

Число включённых наборов (0–4).

#### `calculateEntropyBits(length, charsetSize): number`

Энтропия по формуле Шеннон: `length × log2(charsetSize)`.
Возвращает `0`, если `length <= 0` или `charsetSize <= 1`.

```js
calculateEntropyBits(16, 88) // 103.3594…
calculateEntropyBits(4, 10)  // 13.2877…
```

#### `escapeHtml(text): string`

Экранирует `& < > " ' `` ` `` — шесть символов, достаточных для безопасной
вставки в атрибуты и текстовые узлы.

```js
escapeHtml('<img src=x onerror=alert(1)>')
// '&lt;img src=x onerror=alert(1)&gt;'
```

`null` и `undefined` превращаются в пустую строку.

#### `sanitizeInput(input, maxLength = 100): string`

Удаляет `<> " ' `` ` `` и управляющие символы `U+0000–U+001F`, `U+007F`,
обрезает пробелы по краям и ограничивает длину.

#### `validateName(rawName): {ok: boolean, value: string, error?: string}`

Проверяет название записи. Порядок проверок важен:

1. длина **исходной** строки ≤ 100 (длинный ввод отклоняется, а не режется);
2. после санитизации непустая;
3. минимум 2 символа.

```js
validateName('  Mail  ')     // { ok: true, value: 'Mail' }
validateName('<b>')          // { ok: false, error: 'Название должно содержать минимум 2 символа' }
validateName('')             // { ok: false, error: 'Введите название для пароля' }
```

#### `createId(): number`

Уникальный числовой id: `Date.now() % 1e9` × `1e5` + 5 случайных разрядов.
Число безопасно для JSON и для `===` сравнения.

#### `formatDate(date = new Date()): string`

Локальный формат `ru-RU` (`short` / `short`) → `'20.10.2026, 12:31'`.
При ошибке `Intl` возвращает `String(date)` и пишет `[ERROR]` в консоль.

#### `toSafeString(value): string`

`String(value)` с защитой от `null`/`undefined` → `''`.

---

## 2. `src/js/generator.js` — `PasswordGenerator`

Все методы **статические**, состояние отсутствует.
В модуле также объявлен алиас `const PasswordEngine = PasswordGenerator`.

#### `static secureRandomInt(maxExclusive): number`

Криптографически стойкое целое из `[0, maxExclusive)`.

- `@throws {Error}` если аргумент не положительное целое;
- `@throws {Error}` если `crypto.getRandomValues` недоступен;
- реализация — rejection sampling: отбрасываются значения из неполного
  остатка шкалы `2^32 % maxExclusive`, поэтому **смещения нет**.

```js
PasswordGenerator.secureRandomInt(10)  // 0…9
PasswordGenerator.secureRandomInt(0)   // throw
```

#### `static buildCharset(options): string`

`buildCharset()` из utils, но **бросает** `Error('Выберите хотя бы одну опцию символов')`
на пустом наборе.

#### `static shuffle(items): string[]`

Fisher–Yates на `secureRandomInt`. Исходный массив не мутируется.

#### `static generate(options): {password, length, charsetSize, entropyBits}`

| Параметр | Тип | По умолчанию |
|---|---|---|
| `options.length` | `number` | `PASSWORD_LIMITS.DEFAULT_LENGTH` (16) |
| `options.UPPERCASE` | `boolean` | `false` |
| `options.LOWERCASE` | `boolean` | `false` |
| `options.NUMBERS` | `boolean` | `false` |
| `options.SYMBOLS` | `boolean` | `false` |

Алгоритм: по одному гарантированному символу из каждого выбранного набора →
дополнение до длины из полного алфавита → перемешивание.
Гарантия «есть символ каждого класса» действует только при
`length ≥ число выбранных наборов`.

```js
PasswordGenerator.generate({ length: 16, UPPERCASE: true, LOWERCASE: true, NUMBERS: true, SYMBOLS: true })
// { password: 'aK3!x…', length: 16, charsetSize: 88, entropyBits: 103.4 }
```

`@throws {Error}` при пустом алфавите. Некорректная длина **не** бросает
исключение: она приводится через `clamp` / `DEFAULT_LENGTH`.

#### `static calculateStrength(password): StrengthInfo`

```ts
type StrengthInfo = {
  score: number,      // -1 пусто, иначе 0…4
  label: string,      // 'Очень слабый' … 'Очень сильный' или '—'
  className: string,  // CSS-класс полосы
  badge: string,      // CSS-класс бейджа
  bits: number,       // энтропия, 1 знак после запятой
  percent: number     // min(100, round(bits/128*100))
}
```

Уровень выбирается **обратным** перебором `STRENGTH_LEVELS`: берётся последний
порог, который не превышен. Пустая строка → `score: -1`, `label: '—'`.

#### `static estimateBits(password): number`

Энтропия готового пароля по фактически присутствующим классам символов
(регулярки `/[a-z]/`, `/[A-Z]/`, `/\d/`, `/[^a-zA-Z0-9]/`).

```js
PasswordGenerator.estimateBits('Abcdefgh1234') // 12 × log2(62) ≈ 71.4
PasswordGenerator.estimateBits('')             // 0
```

---

## 3. `src/js/storage.js`

### 3.1. `class MemoryStore`

Адаптер хранилища в памяти. Реализует тот же интерфейс, что и `localStorage`:
`getItem(key)`, `setItem(key, value)`, `removeItem(key)`, `clear()`.

### 3.2. `class PasswordStorage`

Репозиторий записей схемы v1. Подробности миграции —
[ARCHITECTURE.md §5](ARCHITECTURE.md#5-модель-данных).

#### `constructor(key = STORAGE_KEY, backend = null)`

`backend` — объект с `getItem`/`setItem`/`removeItem`. Если не передан,
вызывается `createDefaultBackend()`. Записи загружаются в конструкторе.

```js
const store = new PasswordStorage();                    // localStorage
const store = new PasswordStorage('t', new MemoryStore()); // память (тесты)
```

#### `static createDefaultBackend(): Backend`

Пробует `localStorage` пробной записью `__pg_probe__`; при исключении
(приватный режим Safari) возвращает `new MemoryStore()` и пишет `[WARN]`.

#### `static isValidRecord(raw): boolean`

`object`, конечный числовой `id`, непустая строка `name`,
непустая строка `password`.

#### `static normalizeRecord(raw): Object|null`

Приводит запись к схеме v1 (включая `sanitizeInput` имени и маппинг
легаси-силы). `null`, если запись невалидна.

#### `static legacyStrengthToScore(legacy = ''): number`

`weak → 1`, `medium → 2`, `strong → 3`, иначе `1`.

#### `load(): Object[]`

Читает и валидирует записи. Битый JSON, не-массив и мусорные элементы
не приводят к исключению — они пропускаются с сообщением в консоль.
Если ключ пуст — пытается мигрировать данные из `passwords`.

#### `migrateLegacyData(): Object[]`

Переносит данные из ключа `passwords` (v0) и удаляет старый ключ.
Возвращает `[]`, если `localStorage` недоступен или данных нет.

#### `save(records = this.cache): boolean`

Сериализует и пишет. `false` при `QuotaExceededError` или другой ошибке I/O.

#### `getAll(): Object[]`, `count(): number`, `find(id): Object|undefined`

`getAll()` возвращает **копию** массива — безопасно изменять снаружи.

#### `add(data): Object|null`

| Поле `data` | Обяз. | Поведение |
|---|---|---|
| `name` | ✅ | валидируется `validateName`; при ошибке — `null` + `[WARN]` |
| `password` | ✅ | непустая строка, иначе `null` + `[WARN]` |
| `strengthScore` | ❌ | по умолчанию `0`, обрезается в `[0, 4]` |

Возвращает созданную запись (с `id` и `createdAt`) либо `null`.

#### `remove(id): boolean`

`false`, если записи с таким `id` не было.

#### `clear(): boolean`

Записывает пустой массив.

#### `search(query = ''): Object[]`

Подстрока в `name` без учёта регистра; пустой запрос → `getAll()`.

---

## 4. `src/js/ui.js` — `UIManager` *(internal)*

#### `constructor(doc = document)`

Ищет по id: `passwordsList`, `password`, `strengthBar`, `strengthText`,
`entropyText`, `toast`. Отсутствующие элементы толерируются — методы
выходят молча.

#### `setPassword(password, placeholder = '—'): void`

`textContent` (не `innerHTML`) → XSS невозможен по построению.

#### `setStrength(strength): void`

Обновляет ширину полосы (`percent`), классы, `aria-valuenow`, `aria-valuetext`,
подпись уровня и текст энтропии (`≈ 84.2 бит` или `—`).

#### `resetStrength(): void`

Эквивалент `setStrength({score:-1, label:'—', …})`.

#### `renderTable(records, options = {}): void`

Рисует `<table class="passwords-table">` из записей. `options.showControls`
сегодня зарезервирован (`true` по умолчанию). Пустой массив →
блок `.empty-message` с текстом «Нет сохранённых паролей. Создайте первый!».

Все поля записи проходят `escapeHtml()`; пароль по умолчанию маскируется
`PASSWORD_MASK`.

#### `renderRow(record): string`

Возвращает HTML одной строки с кнопками
`data-action="toggle" | "copy" | "delete"` и `aria-label`.

#### `setExpanded(records, id): void`

Переключает раскрытую запись (toggle) и перерисовывает таблицу.

#### `toast(message, type = 'success', duration = 3000): void`

Не блокирующее уведомление в `#toast` с `role="status"` / `role="alert"`.
Повторный вызов сбрасывает предыдущий таймер. Без контейнера — пишет в консоль.

#### `confirm(message, confirmLabel = 'Подтвердить'): Promise<boolean>`

Модальное подтверждение вместо `window.confirm`: фокус внутрь диалога,
`Escape` → `false`, `Enter` → `true`, возврат фокуса на прежний элемент.
Если `#confirmOverlay` не смонтирован — откат на `window.confirm`.

#### `setLengthValue(value): void`, `setCounter(total, shown): void`

Счётчик длины у слайдера и счётчик записей
(`Всего: N` / `Найдено: M из N`).

#### `formatStoredDate(raw): string`

ISO → локальный формат; неразбираемая строка выводится как есть, пустая — `—`.

---

## 5. `src/js/app.js` — `PasswordApp` *(internal)*

#### `constructor(deps = {})`

`deps.storage` и `deps.ui` подставляются в тестах; по умолчанию создаются
`new PasswordStorage()` и `new UIManager()`.

Состояние: `currentPassword`, `lastResult`, `query`.

#### `init(): void`

`bindEvents()` → `render()` → `generate()`. Ошибка инициализации ловится
и показывается тостом.

#### `bindEvents(): void` · `on(el, type, handler): void`

Подписки на кнопки генерации/копирования/сохранения/очистки, ползунок
длины, четыре чекбокса, поиск, `Enter` в поле имени и клики по таблице.
`on()` толерирует `null`-элемент.

#### `readOptions(): {length, UPPERCASE, LOWERCASE, NUMBERS, SYMBOLS}`

Считывает форму. Длина проходит `clamp`, чекбоксы — `Boolean(...checked)`.

#### `generate(): string|null`

Генерирует пароль, обновляет вывод и индикатор силы. При ошибке очищает
поле, сбрасывает индикатор и показывает тост с текстом исключения.

#### `ensureAtLeastOneSet(changedId): boolean`

Снимает чекбокс только если остались другие включённые наборы; иначе
возвращает его в `checked` и показывает тост.

#### `copyCurrent(): Promise<boolean>` · `copyText(text, message = 'Скопировано'): Promise<boolean>`

Clipboard API в secure context, иначе `execCommand('copy')` на временный
`textarea`. Неудача → тост `error` и `false`.

#### `saveCurrent(): Object|null`

Валидирует имя, берёт `currentPassword`, вызывает `storage.add()`,
перерисовывает таблицу, очищает поле имени и показывает тост.

#### `toggleRecord(id): void`

Раскрытие/маскирование пароля в строке таблицы.

#### `clearAll(): Promise<boolean>`

Очистка всех записей через модальное подтверждение. Пустое хранилище →
тост `info` и `false`.

#### `getVisibleRecords(): Object[]`

`storage.search(this.query)` — текущий поисковый фильтр.

#### `render(): void`

Рисует отфильтрованные записи и обновляет счётчик.

#### `handleTableAction(event): void`

Делегирование: находит `button[data-action]` и `tr[data-id]`, вызывает
`copy` / `toggle` / `delete`.

---

## 6. `bootstrapApp()`

Глобальная функция запуска в конце `app.js`. Вызывается в `DOMContentLoaded`
и создаёт экземпляр `PasswordApp` с `init()`. Возвращает экземпляр приложения
(удобно для ручной отладки в консоли: `window.app`).

---

## 7. Пример интеграции

```js
// 1. Сгенерировать пароль без интерфейса
const { password, entropyBits } = PasswordGenerator.generate({
  length: 20,
  LOWERCASE: true,
  UPPERCASE: true,
  NUMBERS: true
});

// 2. Оценить силу
const strength = PasswordGenerator.calculateStrength(password);
console.log(strength.label, strength.bits);   // «Сильный», 118.1

// 3. Сохранить в изолированное хранилище (не трогает localStorage пользователя)
const store = new PasswordStorage('demo_v1', new MemoryStore());
const record = store.add({ name: 'Почта', password, strengthScore: strength.score });
console.log(record.id, store.count());        // …, 1

// 4. Найти и удалить
store.search('почт').length;                  // 1
store.remove(record.id);                      // true
```

---

## 8. Ошибки

| Исключение | Модуль | Условие |
|---|---|---|
| `Error('Диапазон случайного числа должен быть положительным целым числом')` | `generator` | `secureRandomInt` с некорректным аргументом |
| `Error('crypto.getRandomValues недоступен: безопасная генерация невозможна')` | `generator` | нет Web Crypto |
| `Error('Выберите хотя бы одну опцию символов')` | `generator` | пустой алфавит |

Все остальные отказы возвращают «мягкие» значения
(`null`, `false`, `[]`, `{ok:false}`) и логируются с префиксом
`[WARN]` / `[ERROR]` в консоль.

---

## 9. Версионирование контракта

| Изменение | Версия |
|---|---|
| Новый необязательный аргумент, новый возвращаемый ключ | minor |
| Изменение поведения существующей функции, смена схемы `localStorage` | major |
| Исправление дефекта без изменения контракта | patch |

Схема хранилища версионируется суффиксом ключа (`passwords` → `passwords_v1`)
и мигрирует автоматически — см. [docs/SDLC/06_DEPLOYMENT.md §6](SDLC/06_DEPLOYMENT.md#6-миграция-данных-при-обновлении).
