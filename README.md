<div align="center">

# 🔐 Password Generator with Storage

**Генератор криптографически стойких паролей с локальным хранилищем,
диаграммой SDLC и полной документацией жизненного цикла.**

[![Version](https://img.shields.io/badge/version-1.0.0-7c5cff)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-25%2F25-3ecf8e)](tests/test-report.md)
[![SDLC](https://img.shields.io/badge/SDLC-7%2F7%20этапов-5b8def)](docs/SDLC/01_REQUIREMENTS.md)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-3ecf8e)](package.json)

[Онлайн](https://almight71.github.io/password-generator/) ·
[Документация](#-документация) ·
[Тесты](tests/test-report.md) ·
[Issues](https://github.com/Almight71/password-generator/issues)

<img src="assets/screenshots/app-1920px.png" alt="Главный экран генератора паролей" width="820">

</div>

---

## Возможности

| | Функция |
|---|---|
| 🔑 | Генерация паролей длиной **4–32** символа |
| 🎛️ | Четыре набора символов: заглавные, строчные, цифры, спецсимволы (88 символов) |
| 🛡️ | **`crypto.getRandomValues`** + rejection sampling — без смещения, как требует криптография |
| 📏 | **5 уровней силы** по энтропии Шеннона (0 / 28 / 44 / 64 / 88 бит) |
| 💾 | Сохранение записей в `localStorage` с поиском и удалением |
| 🧪 | **25 автотестов** (unit + интеграция + визуальные) |
| 📚 | **7 документов SDLC** + ARCHITECTURE / API / USER_GUIDE |
| 🖼️ | Интерактивная **диаграмма SDLC** с 7 этапами |
| ♿ | Доступность: ARIA, клавиатурная навигация, видимый фокус |
| 📱 | Адаптив от **320px** до 4K |

**Без сервера. Без сети. Без аналитики.** Всё считается и хранится в вашем браузере.

---

## Быстрый старт

### Вариант 1 — сразу открыть

```bash
git clone https://github.com/Almight71/password-generator.git
cd password-generator
xdg-open src/index.html     # Linux · open / start — macOS / Windows
```

Работает по `file://`, интернет не нужен.

### Вариант 2 — локальный сервер

```bash
npm start                   # → http://localhost:8080
```

### Вариант 3 — тесты

```bash
npm install                 # один раз (нужен только jsdom)
npm test                    # 25/25
```

Откройте `tests/unit-tests.html` в браузере — те же 17 логических тестов
интерактивно.

### Вариант 4 — диаграмма SDLC

Откройте `src/sdlc_cycle.html`: 7 этапов, навигация кликом, `←`/`→`,
`Home`/`End`, `Escape`.

---

## Структура репозитория

```
password-generator/
├── src/                          # всё, что уходит на GitHub Pages
│   ├── index.html                # приложение
│   ├── sdlc_cycle.html           # интерактивная диаграмма SDLC
│   ├── css/styles.css            # дизайн-система
│   └── js/                       # 5 модулей
│       ├── utils.js              # константы, валидация, escapeHtml
│       ├── generator.js          # CSPRNG-генерация, энтропия
│       ├── storage.js            # localStorage + MemoryStore, миграция v0→v1
│       ├── ui.js                 # DOM: вывод, таблица, тосты, диалог
│       └── app.js                # PasswordApp — оркестратор
├── docs/
│   ├── SDLC/                     # 7 этапов жизненного цикла
│   │   ├── 01_REQUIREMENTS.md    # FR1–FR9, NFR1–NFR8, use cases
│   │   ├── 02_ANALYSIS.md        # архитектура, потоки, модель, риски
│   │   ├── 03_DESIGN.md          # токены, компоненты, макеты, a11y
│   │   ├── 04_DEVELOPMENT.md     # ADR, стиль кода, процесс
│   │   ├── 05_TESTING.md         # план, покрытие, результаты
│   │   ├── 06_DEPLOYMENT.md      # GitHub Pages, миграции, откат
│   │   └── 07_MAINTENANCE.md     # поддержка, роадмап, безопасность
│   ├── ARCHITECTURE.md           # слои, потоки, паттерны, расширение
│   ├── API.md                    # справочник публичного API
│   └── USER_GUIDE.md             # руководство пользователя со скриншотами
├── tests/                        # 25 кейсов + раннеры + отчёты
├── assets/                       # диаграммы (SVG), макеты, скриншоты
├── index.html                    # точка входа сайта (редирект на src/)
├── README.md · CHANGELOG.md · CONTRIBUTING.md · COMPLETION_REPORT.md
└── package.json · .gitignore
```

---

## Технологии

| Слой | Решение |
|---|---|
| Разметка | HTML5, семантические теги, ARIA |
| Стили | CSS без препроцессоров, дизайн-система на 10 токенах |
| Логика | JavaScript (ES2020), классические `<script>` — работает по `file://` |
| Криптография | `crypto.getRandomValues`, rejection sampling, Fisher–Yates |
| Хранение | `localStorage` с адаптером `MemoryStore` для тестов |
| Тесты | Node.js + `vm` + **jsdom 24**, Firefox headless для скриншотов |
| Зависимости в проде | **0** |

---

## Документация

| Документ | О чём |
|---|---|
| [Руководство пользователя](docs/USER_GUIDE.md) | как пользоваться, уровни силы, FAQ |
| [Архитектура](docs/ARCHITECTURE.md) | слои, потоки данных, паттерны, точки расширения |
| [API](docs/API.md) | сигнатуры всех модулей с примерами |
| [01 Требования](docs/SDLC/01_REQUIREMENTS.md) | FR/NFR, personas, use cases, вне рамок |
| [02 Анализ](docs/SDLC/02_ANALYSIS.md) | потоки, модель данных, риски, технический выбор |
| [03 Дизайн](docs/SDLC/03_DESIGN.md) | токены, компоненты, адаптив, доступность |
| [04 Разработка](docs/SDLC/04_DEVELOPMENT.md) | ADR, стиль кода, журнал исправлений |
| [05 Тестирование](docs/SDLC/05_TESTING.md) | стратегия, покрытие, чек-лист |
| [06 Развёртывание](docs/SDLC/06_DEPLOYMENT.md) | GitHub Pages, миграция данных, откат |
| [07 Поддержка](docs/SDLC/07_MAINTENANCE.md) | политика, роадмап, безопасность |
| [Тест-кейсы](tests/test-cases.md) · [Отчёт](tests/test-report.md) | 25 кейсов и результаты прогона |

---

## Как это устроено

```
utils.js ──► generator.js ──┐
     │                      ├──► app.js ──► DOM · localStorage
     ├──► storage.js ───────┤
     └──► ui.js ────────────┘
```

- **Домен и данные не знают о DOM** — поэтому гоняются в Node.js в автотестах.
- Сила пароля — `bits = length × log₂(размер алфавита)`, 5 порогов.
- Схема хранилища версионируется: `passwords` (v0) → `passwords_v1`
  с автоматической миграцией и маппингом `strength` → `strengthScore`.

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Запуск тестов

```bash
npm test            # 25 кейсов: 17 unit + 5 интеграция + 3 UI
npm run test:unit   # только логика, без jsdom
npm run screenshots # переснять assets/screenshots/*.png
```

Последний прогон: **25/25 PASS, 100 %** ([отчёт](tests/test-report.md)).

---

## План развития

- **v1.1** — мастер-пароль + AES-GCM, авто-блокировка, CSP без `unsafe-inline`
- **v1.2** — экспорт/импорт JSON и CSV, категории, автотест Clipboard API
- **v1.3** — исключение неоднозначных символов, diceware-пароли, PIN
- **v2.0** — ES-модули + сборщик, TypeScript, PWA

Полный список: [docs/SDLC/07_MAINTENANCE.md §4](docs/SDLC/07_MAINTENANCE.md).

---

## Участие

См. [CONTRIBUTING.md](CONTRIBUTING.md). Кратко: проверьте `npm test` перед
pull request, добавьте регрессионный тест к каждому фиксу, пишите на русском.

Нашли проблему? [Заведите issue](https://github.com/Almight71/password-generator/issues).

---

## Лицензия

MIT — см. [LICENSE](LICENSE).

<div align="center"><sub>Сделано в рамках полного цикла SDLC · 2026</sub></div>
