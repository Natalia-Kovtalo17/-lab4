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

// ---------- Відправлення відповіді ----------
function reply(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- Обробник запитів ----------
function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname !== '/') {
      reply(res, 404, { error: 'Маршрут не знайдено' });
      return;
    }

    reply(res, 200, { message: 'Сервер працює' });
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