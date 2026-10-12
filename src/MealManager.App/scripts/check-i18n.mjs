import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceLocale = JSON.parse(fs.readFileSync('angular.json', 'utf8')).projects.mealmanager.i18n
  .sourceLocale;
const source = JSON.parse(fs.readFileSync(`src/locale/messages.${sourceLocale}.json`, 'utf8'));
const translatedFiles = fs
  .readdirSync('src/locale')
  .filter(
    (file) => /^messages\.[^.]+\.json$/.test(file) && file !== `messages.${sourceLocale}.json`,
  );
const errors = [];
const placeholders = (text) =>
  [...text.matchAll(/\{\$([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mealmanager-i18n-'));
let extracted;
try {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/@angular/cli/bin/ng.js',
      'extract-i18n',
      '--format=json',
      `--output-path=${tempDir}`,
      '--out-file=messages.json',
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0 || result.error) {
    console.error(result.stderr || result.stdout || result.error);
    process.exit(1);
  }
  if (result.stdout.includes('WARNINGS:') || result.stderr.includes('WARNINGS:'))
    errors.push('Angular extraction reported warnings.');
  extracted = JSON.parse(fs.readFileSync(path.join(tempDir, 'messages.json'), 'utf8'));
} finally {
  const catalogPath = path.join(tempDir, 'messages.json');
  if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);
  fs.rmdirSync(tempDir);
}

if (source.locale !== sourceLocale) errors.push('Source catalog locale is incorrect.');
if (!source.translations || typeof source.translations !== 'object') {
  throw new Error('Source catalog has no translations.');
}

for (const [key, message] of Object.entries(extracted.translations)) {
  const stored = source.translations[key];
  if (typeof stored !== 'string' || normalize(stored) !== normalize(message)) {
    errors.push(`Source catalog is out of date: ${key}`);
  }
}
for (const key of Object.keys(source.translations)) {
  if (!(key in extracted.translations)) errors.push(`Unused source message: ${key}`);
  if (/^\d+$/.test(key)) errors.push(`Generated numeric key: ${key}`);
}

for (const file of translatedFiles) {
  const locale = file.slice('messages.'.length, -'.json'.length);
  const catalog = JSON.parse(fs.readFileSync(path.join('src/locale', file), 'utf8'));
  if (catalog.locale !== locale) errors.push(`Catalog locale is incorrect: ${file}`);
  if (!catalog.translations || typeof catalog.translations !== 'object') {
    errors.push(`Catalog has no translations: ${file}`);
    continue;
  }
  for (const [key, message] of Object.entries(source.translations)) {
    const target = catalog.translations[key];
    if (typeof target !== 'string' || !target.trim()) {
      errors.push(`Missing ${locale} translation: ${key}`);
      continue;
    }
    if (
      /(?:\uFFFD|[\u00C2\u00C3][\u0080-\u00BF]|\u00E2[\u0080-\u00BF\u20AC\u2020\u2021])/u.test(
        target,
      )
    ) {
      errors.push(`Suspected text encoding corruption in ${locale}: ${key}`);
    }
    if (JSON.stringify(placeholders(message)) !== JSON.stringify(placeholders(target))) {
      errors.push(`Placeholder mismatch in ${locale}: ${key}`);
    }
  }
  for (const key of Object.keys(catalog.translations)) {
    if (!(key in source.translations)) errors.push(`Unused ${locale} translation: ${key}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${Object.keys(source.translations).length} source messages across ${translatedFiles.length} translation catalogs.`,
  );
}
