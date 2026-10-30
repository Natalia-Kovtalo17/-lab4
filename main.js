import fs from 'node:fs';
import http from 'node:http';
import { Command } from 'commander';

// ---------- Параметри командного рядка ----------
const program = new Command();

program
  .name('lab4')
  .helpOption('--help', 'показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл, у який записується остання відповідь');

program.parse(process.argv);
const options = program.opts();

const port = Number(options.port);
if (options.port.trim() === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Помилка: --port має бути цілим числом від 1 до 65535');
  process.exit(1);
}

// ---------- Допоміжні функції ----------
// Повертає число або null, якщо значення не є скінченним числом
function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Повертає значення або null, якщо воно відсутнє / null / порожній рядок
function textOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  return value;
}

function isRated(value) {
  return String(value).trim().toUpperCase() === 'TRUE';
}

// Читає параметри запиту; повертає { error } або { rated, minTurns }
function parseParams(searchParams) {
  const rated = searchParams.get('rated') === 'true';
  let minTurns = null;
  if (searchParams.has('min_turns')) {
    minTurns = toNumber(searchParams.get('min_turns'));
    if (minTurns === null) {
      return { error: 'Параметр min_turns має бути числом' };
    }
  }
  return { rated, minTurns };
}

// Фільтрація й перетворення записів
function buildResult(records, params) {
  const result = [];
  for (const game of records) {
    if (game === null || typeof game !== 'object') continue;
    if (params.rated && !isRated(game.rated)) continue;

    const turns = toNumber(game.turns);
    if (params.minTurns !== null && (turns === null || turns <= params.minTurns)) {
      continue;
    }

    result.push({
      id: textOrNull(game.id),
      winner: textOrNull(game.winner),
      turns: turns,
      opening: textOrNull(game.opening_name),
    });
  }
  return result;
}

// Розбір тексту файлу; повертає { status, data }
function processData(text, params) {
  let records;
  try {
    records = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (e) {
    return { status: 500, data: { error: 'Файл даних пошкоджений: некоректний JSON' } };
  }
  if (!Array.isArray(records)) {
    return { status: 500, data: { error: 'Файл даних пошкоджений: очікувався JSON-масив' } };
  }
  return { status: 200, data: buildResult(records, params) };
}

// ---------- Відправлення відповіді ----------
function finish(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function reply(res, status, data) {
  const body = JSON.stringify(data, null, 2);

  if (!options.output) {
    finish(res, status, body);
    return;
  }

  // Спершу записуємо у файл, щоб помилку запису можна було повідомити клієнту
  fs.writeFile(options.output, body, 'utf8', (err) => {
    if (err) {
      const errorBody = JSON.stringify({ error: 'Не вдалося записати відповідь у файл' }, null, 2);
      finish(res, 500, errorBody);
      return;
    }
    finish(res, status, body);
  });
}
// ---------- Обробник запитів ----------
function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname !== '/') {
      reply(res, 404, { error: 'Маршрут не знайдено' });
      return;
    }

    const params = parseParams(url.searchParams);
    if (params.error) {
      reply(res, 400, { error: params.error });
      return;
    }

    fs.readFile(options.input, 'utf8', (err, text) => {
      if (err) {
        reply(res, 500, { error: 'Не вдалося прочитати файл даних' });
        return;
      }

      let outcome;
      try {
        outcome = processData(text, params);
      } catch (e) {
        outcome = { status: 500, data: { error: 'Внутрішня помилка сервера' } };
      }
      reply(res, outcome.status, outcome.data);
    });
  } catch (e) {
    reply(res, 500, { error: 'Внутрішня помилка сервера' });
  }
}

// ---------- Запуск ----------
function startServer() {
  const server = http.createServer(handleRequest);

  server.on('error', (err) => {
    console.error(`Не вдалося запустити сервер: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${port}/`);
  });
}

// Перевірка існування файлу через колбек-функцію fs
fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  startServer();
});