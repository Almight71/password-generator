# 06. Развертывание (Deployment)

**Проект:** Password Generator with Storage
**Версия документа:** 1.0.0
**Статус:** ✅ Опубликовано
**Предыдущий этап:** [05_TESTING.md](05_TESTING.md) · **Следующий:** [07_MAINTENANCE.md](07_MAINTENANCE.md)

---

## 1. Артефакт развёртывания

| Свойство | Значение |
|---|---|
| Тип | статическое веб-приложение (HTML / CSS / JS), без сборки |
| Хостинг | GitHub Pages (HTTPS, CDN) |
| Адрес | **https://almight71.github.io/password-generator/** |
| Репозиторий | https://github.com/Almight71/password-generator |
| Ветка публикации | `main`, корень репозитория (`/`) |
| Передаваемый объём | 4 HTML/CSS/JS-файла ≈ 40 КБ + 4 изображения |
| Внешние запросы | **отсутствуют** (нет CDN, шрифтов, аналитики) |
| Время загрузки | < 200 мс на ширине 100 Мбит |

**Точка входа.** В корне размещён `index.html` с мета-редиректом
на `src/index.html`. Это единственный файл в корне, кроме документации:
исходный код существует в одном экземпляре в `src/`.

---

## 2. Локальный запуск

### Способ A — просто открыть файл (без сервера)

```bash
git clone https://github.com/Almight71/password-generator.git
cd password-generator
xdg-open src/index.html      # Linux
# open src/index.html        # macOS
# start src/index.html       # Windows
```

Работает: генерация, сохранение, поиск, диаграмма SDLC.
Копирование в буфер обмена использует резервный путь `execCommand`.

### Способ B — локальный сервер (рекомендуется, ближе к production)

```bash
npm start          # python3 -m http.server 8080 --directory src
# → http://localhost:8080
```

Альтернативы без Node.js:

```bash
npx serve src
python3 -m http.server 8080 --directory src
```

### Способ C — тесты и артефакты

```bash
npm install          # один раз
npm test             # 25/25 тестов
npm run screenshots  # переснять assets/screenshots/*.png
```

---

## 3. Публикация в GitHub Pages

### 3.1. Первичная настройка (выполняется один раз)

Через веб-интерфейс:

```
Репозиторий → Settings → Pages
  Source:     Deploy from a branch
  Branch:     main
  Folder:     / (root)
  → Save
```

Через CLI:

```bash
gh api -X POST repos/Almight71/password-generator/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

После сохранения сайт появляется по адресу из §1 в течение ~1 минуты.

### 3.2. Обычный релиз

```bash
# 1. Проверки перед публикацией
for f in src/js/*.js tests/*.js; do node --check "$f" || exit 1; done
npm test

# 2. Коммит и пуш
git add -A
git commit -m "release: v1.0.0 — <что изменилось>"
git push origin main

# 3. GitHub Pages подхватывает коммит автоматически
```

### 3.3. Проверка после развёртывания

| # | Проверка | Ожидание |
|---|---|---|
| 1 | Открыть корневой адрес | происходит переход на `/src/index.html` |
| 2 | Панель разработчика → Console | нет ошибок |
| 3 | Сгенерировать и сохранить пароль | запись появляется в таблице |
| 4 | Обновить страницу (F5) | запись на месте |
| 5 | Открыть `/src/sdlc_cycle.html` | диаграмма, клики и стрелки работают |
| 6 | `http://` → `https://` | редирект автоматический (Pages всегда HTTPS) |
| 7 | Пройти ссылку «Документация» | откроется README на GitHub |

---

## 4. Конфигурация окружения

Настроек окружения нет — приложение полностью клиентское.

| Фактор | Значение |
|---|---|
| Переменные окружения | не используются |
| Секреты | отсутствуют (не хранить токены в репозитории!) |
| `.env` | в `.gitignore`, не нужен |
| Зависимости времени выполнения | нет |
| Dev-зависимости | только `jsdom` для тестов (`node_modules` в `.gitignore`) |

---

## 5. Другие платформы размещения

Статический характер позволяет развернуть проект где угодно:

| Платформа | Команда / действие |
|---|---|
| GitHub Pages | раздел §3 |
| Netlify | перетащить репозиторий, Build command: пусто, Publish directory: `src` |
| Vercel | `vercel deploy --prod`, framework preset: *Other*, output: `src` |
| Cloudflare Pages | Connect repo, output directory: `src` |
| любой nginx | `scp -r src/* user@host:/var/www/` |
| локальная сеть | `python3 -m http.server 8080 --directory src` |

Для всех платформ точка входа — `src/index.html`
(файл `index.html` в корне нужен только там, где раздаётся весь репозиторий).

---

## 6. Миграция данных при обновлении

При переходе со старой версии приложения ключ хранилища меняется
`passwords` → `passwords_v1`. Миграция выполняется **автоматически**
при первом обращении к хранилищу:

```javascript
// PasswordStorage.migrateLegacyData()
localStorage["passwords"]  →  нормализация  →  localStorage["passwords_v1"]
                                                        │
                                                        └─ ключ v0 удаляется
```

Что нормализуется:

| Поле v0 | Поле v1 |
|---|---|
| `strength: "weak"/"medium"/"strong"` | `strengthScore: 1/2/3` |
| `createdAt: "20.10.2026"` | ISO 8601 (если строка разбирается, иначе остаётся как есть) |
| `name` без санитизации | `name` после `sanitizeInput()` |

**Откат:** после миграции ключ v0 удалён, поэтому откат на старую версию
приложения потребует повторного ввода паролей. Перед обновлением
рекомендуется скопировать нужные пароли.

**Проверка миграции:**

1. В старой версии сохранить 2–3 пароля.
2. Обновить приложение.
3. Открыть DevTools → Application → Local Storage → ключ `passwords_v1`
   должен содержать записи, ключ `passwords` — отсутствовать.

---

## 7. Чек-лист развёртывания

- [x] Все тесты зелёные (`npm test` → 25/25)
- [x] `node --check` для всех JS-файлов
- [x] `CHANGELOG.md` обновлён для новой версии
- [x] Версия в `package.json`, `README.md` и `src/index.html` совпадают
- [x] В корне нет лишних исполняемых файлов
- [x] `.gitignore` покрывает `node_modules`, профиль браузера, `.env`
- [x] GitHub Pages включён на `main` / корень
- [x] Проверка после публикации (§3.3) пройдена
- [x] Консоль продакшн-страницы чистая

---

## 8. Откат

1. **Быстрый откат кода:**
   ```bash
   git revert <sha>
   git push origin main
   ```
   Pages пересобирается автоматически за ~1 минуту.

2. **Откат данных пользователя** невозможен извне (данные только в его
   браузере). Это осознанно: см. ограничения в [01_REQUIREMENTS.md](01_REQUIREMENTS.md).

3. **Полное отключение сайта:** Settings → Pages → Disconnect branch.

---

## 9. Мониторинг

Серверной телеметрии нет (и не должно быть — данные не покидают браузер).
Вместо этого:

- консоль браузера: `[ERROR]` / `[WARN]` пишутся только при реальных сбоях;
- при сбое инициализации пользователь видит тост с причиной;
- обратная связь — GitHub Issues.

**Следующий этап:** [07_MAINTENANCE.md](07_MAINTENANCE.md)
