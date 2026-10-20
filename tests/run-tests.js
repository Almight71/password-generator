#!/usr/bin/env node
/**
 * PASSWORD GENERATOR — TEST RUNNER
 * ===============================
 * Запускает все 25 тест-кейсов проекта из tests/test-suite.js:
 *
 *   Unit (17)        — логика в изолированном контексте (vm + webcrypto)
 *   Integration (5)  — реальные страницы src/index.html и src/sdlc_cycle.html в jsdom
 *   UI (3)           — наличие скриншотов assets/screenshots/*.png
 *
 * Использование:
 *   npm install       (один раз, ставит jsdom)
 *   npm test          (все кейсы)
 *   npm run test:unit (только логика, без jsdom)
 *
 * Код выхода: 0 — все тесты пройдены, 1 — есть провалы.
 *
 * @version 1.0.0
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const onlyUnit = process.argv.includes('--unit');

/** Цвета терминала (отключаются, если вывод не в терминал). */
const useColor = process.stdout.isTTY;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = (t) => paint(32, t);
const red = (t) => paint(31, t);
const yellow = (t) => paint(33, t);
const dim = (t) => paint(2, t);

/**
 * Читает файл проекта.
 * @param {string} relative - Путь относительно корня репозитория
 * @returns {string} Содержимое файла
 */
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

/**
 * Создаёт изолированный контекст и загружает в него логику приложения
 * вместе со сьютом тестов.
 *
 * @returns {Object} Глобальный объект контекста (sandbox)
 */
function createLogicContext() {
  const sandbox = {
    console,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Date,
    Intl,
    Error,
    Map,
    Set,
    Promise,
    RegExp,
    isNaN,
    parseInt,
    parseFloat,
    setTimeout,
    clearTimeout,
    crypto: webcrypto,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.window = undefined;
  vm.createContext(sandbox);

  ['src/js/utils.js', 'src/js/generator.js', 'src/js/storage.js', 'tests/test-suite.js']
    .forEach((file) => vm.runInContext(read(file), sandbox, { filename: file }));

  return sandbox;
}

/**
 * Загружает реальную HTML-страницу в jsdom вместе со скриптами.
 *
 * @param {string} relative - Путь к HTML-файлу относительно корня
 * @returns {Promise<import('jsdom').JSDOM>} Экземпляр jsdom
 */
async function loadPage(relative) {
  // Ленивый require: блок Unit-тестов работает и без jsdom
  const { JSDOM, VirtualConsole } = require('jsdom');

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    console.warn(yellow(`  [страница ${relative}] ${error.message}`));
  });
  virtualConsole.on('error', (...args) => {
    console.warn(yellow(`  [console.error ${relative}] ${args.join(' ')}`));
  });

  const file = path.join(ROOT, relative);

  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // jsdom не реализует криптографию и буфер обмена — подставляем заглушки
      Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
      window.document.execCommand = () => true;
      window.Element.prototype.scrollIntoView = function scrollIntoView() {};
    }
  });

  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') {
      resolve();
      return;
    }
    dom.window.addEventListener('load', () => resolve());
    // Страховка, если события не пришли
    setTimeout(resolve, 5000);
  });

  // Даём отработать DOMContentLoaded-обработчикам приложения
  await new Promise((resolve) => setTimeout(resolve, 50));

  return dom;
}

/**
 * Проверяет, что файл-скриншот существует и не пуст.
 *
 * @param {string} fileName - Имя файла в assets/screenshots
 * @returns {boolean} true, если артефакт готов
 */
function screenshotExists(fileName) {
  const file = path.join(ROOT, 'assets', 'screenshots', fileName);
  try {
    return fs.statSync(file).size > 5000;
  } catch (error) {
    return false;
  }
}

/**
 * Запускает один тест-кейс и возвращает результат.
 *
 * @param {import('./test-suite').TestCase} testCase - Кейс
 * @param {Object} context - Контекст выполнения
 * @returns {Promise<{id:string, group:string, name:string, status:'PASS'|'FAIL'|'SKIP', message:string, ms:number}>}
 */
async function runCase(testCase, context) {
  const started = Date.now();

  if (testCase.requires !== 'logic' && !context.available[testCase.requires]) {
    return {
      id: testCase.id,
      group: testCase.group,
      name: testCase.name,
      status: 'SKIP',
      message: `контекст «${testCase.requires}» недоступен`,
      ms: 0
    };
  }

  // Часть кейсов намеренно провоцирует ошибки (битый JSON, отклонённые
  // записи) — их логи в консоль засоряли бы отчёт, поэтому глушим.
  const original = { error: console.error, warn: console.warn };
  console.error = () => {};
  console.warn = () => {};

  try {
    const result = testCase.run(context);
    if (result && typeof result.then === 'function') await result;
    console.error = original.error;
    console.warn = original.warn;
    return {
      id: testCase.id,
      group: testCase.group,
      name: testCase.name,
      status: 'PASS',
      message: '',
      ms: Date.now() - started
    };
  } catch (error) {
    console.error = original.error;
    console.warn = original.warn;
    return {
      id: testCase.id,
      group: testCase.group,
      name: testCase.name,
      status: 'FAIL',
      message: error.message,
      ms: Date.now() - started
    };
  }
}

/** Точка входа раннера. */
(async function main() {
  console.log('\n' + paint(1, 'Password Generator — прогон тестов'));
  console.log(dim('─'.repeat(72)));

  const sandbox = createLogicContext();
  const context = {
    available: { logic: true, dom: false, sdlc: false, ui: true },
    screenshotExists
  };

  let cases = sandbox.getTestCases(context);

  if (!onlyUnit) {
    try {
      context.indexDom = await loadPage('src/index.html');
      context.window = context.indexDom.window;
      context.dom = context.indexDom.window;
      context.available.dom = true;

      if (!context.window.app) {
        throw new Error('window.app не создан — приложение не инициализировалось');
      }
    } catch (error) {
      console.warn(red(`  Не удалось загрузить src/index.html: ${error.message}`));
    }

    try {
      context.sdlcDom = await loadPage('src/sdlc_cycle.html');
      context.sdlc = context.sdlcDom.window;
      context.available.sdlc = true;
    } catch (error) {
      console.warn(red(`  Не удалось загрузить src/sdlc_cycle.html: ${error.message}`));
    }
  } else {
    cases = cases.filter((item) => item.requires === 'logic');
  }

  const results = [];
  let currentGroup = '';

  for (const testCase of cases) {
    if (testCase.group !== currentGroup) {
      currentGroup = testCase.group;
      console.log(`\n${paint(1, currentGroup)}`);
    }

    const result = await runCase(testCase, context);
    results.push(result);

    const badge =
      result.status === 'PASS' ? green(' PASS ') :
      result.status === 'FAIL' ? red(' FAIL ') : yellow(' SKIP ');

    const time = dim(`${result.ms}ms`);
    console.log(`  ${badge} ${result.id.padEnd(5)} ${result.name} ${time}`);
    if (result.status === 'FAIL') console.log(`         ${red(result.message)}`);
    if (result.status === 'SKIP') console.log(`         ${yellow(result.message)}`);
  }

  /* --- Итоги --- */
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;
  const percent = total ? Math.round((passed / total) * 100) : 0;

  console.log('\n' + dim('─'.repeat(72)));
  console.log(`Итого: ${total} | ${green(`пройдено ${passed}`)} | ${failed ? red(`провалено ${failed}`) : red('провалено 0')} | ${skipped ? yellow(`пропущено ${skipped}`) : ''} | ${percent}%`);

  if (failed > 0) {
    console.log(red('\nЕсть провальные тесты.\n'));
    process.exit(1);
  }

  console.log(green('\nВсе тесты пройдены.\n'));
  process.exit(0);
})().catch((error) => {
  console.error(red(`Фатальная ошибка раннера: ${error.stack || error.message}`));
  process.exit(1);
});
