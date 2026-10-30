import fs from 'node:fs';
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

// Перевірка існування файлу через колбек-функцію fs
fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  console.log('Файл знайдено, параметри коректні');
});