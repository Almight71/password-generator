#!/usr/bin/env bash
# =============================================================================
# PASSWORD GENERATOR — SCREENSHOT HARNESS
# =============================================================================
# Снимает скриншоты интерфейса в assets/screenshots/ для:
#   - тестовой группы UI (TC23-TC25)
#   - документации (docs/USER_GUIDE.md, README)
#
# Использование:
#   bash tests/take-screenshots.sh
#
# Требуется Firefox (используется отдельный профиль, чтобы не конфликтовать
# с уже запущенной сессией браузера пользователя).
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/screenshots"
PROFILE="${FIREFOX_PROFILE:-$ROOT/.firefox-screenshots}"

mkdir -p "$OUT"

if ! command -v firefox >/dev/null 2>&1; then
  echo "ОШИБКА: Firefox не найден в PATH" >&2
  exit 1
fi

mkdir -p "$PROFILE"

# Ширина x высота для каждого проверяемого разрешения
# (firefox принимает --window-size только с запятой: width,height)
SIZES=("320,900" "768,1000" "1920,1080")
FILENAMES=("app-320px.png" "app-768px.png" "app-1920px.png")

echo "Снимаем скриншоты в $OUT"

for i in "${!SIZES[@]}"; do
  SIZE="${SIZES[$i]}"
  TARGET="$OUT/${FILENAMES[$i]}"
  WIDTH="${SIZE%%,*}"

  echo "  → ${FILENAMES[$i]} (${SIZE})"

  firefox \
    --headless \
    --profile "$PROFILE" \
    --window-size="$SIZE" \
    --screenshot="$TARGET" \
    "file://$ROOT/src/index.html#snapshot" >/dev/null 2>&1 || {
      echo "    ОШИБКА при снятии ${FILENAMES[$i]}" >&2
      exit 1
    }

  # Даём файлу осесть на диске
  sleep 1

  if [[ ! -s "$TARGET" ]]; then
    echo "    ОШИБКА: файл не создан — $TARGET" >&2
    exit 1
  fi

  SIZE_BYTES=$(stat -c%s "$TARGET")
  echo "    готово: ${SIZE_BYTES} байт, ширина ${WIDTH}px"
done

# Дополнительный артефакт для документации: страница цикла SDLC
echo "  → sdlc-1920px.png"
firefox \
  --headless \
  --profile "$PROFILE" \
  --window-size=1920,1080 \
  --screenshot="$OUT/sdlc-1920px.png" \
  "file://$ROOT/src/sdlc_cycle.html#snapshot" >/dev/null 2>&1 || true
sleep 1

echo ""
echo "Готово. Артефакты:"
ls -la "$OUT"
