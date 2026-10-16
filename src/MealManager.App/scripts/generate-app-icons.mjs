import { chromium } from 'playwright';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(appRoot, 'public');
const iconSource = await readFile(
  path.join(appRoot, 'src/app/shared/components/app-icon/app-icon.ts'),
  'utf8',
);
const restaurant = iconSource.match(/restaurant:\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,?\s*\]/);

if (!restaurant) {
  throw new Error('Could not read the restaurant icon paths from app-icon.ts.');
}

const paths = restaurant.slice(1);
const themeSource = await readFile(path.join(appRoot, 'src/styles.css'), 'utf8');
function themeColor(name) {
  const color = themeSource.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!color) throw new Error(`Could not read the ${name} brand color.`);
  return color;
}
const background = themeColor('secondary');
const foreground = themeColor('primary');

function createSvg({ scale = 1, rounded = false } = {}) {
  const inset = (24 * (1 - scale)) / 2;
  const transform = scale < 1 ? ` transform="translate(${inset} ${inset}) scale(${scale})"` : '';
  const radius = rounded ? ' rx="7"' : '';
  const pathElements = paths.map((data) => `    <path d="${data}"/>`).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24"${radius} fill="${background}"/>
  <g${transform} fill="none" stroke="${foreground}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
${pathElements}
  </g>
</svg>
`;
}

async function renderPng(browser, svg, outputPath, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>*{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.locator('svg').screenshot({ path: outputPath });
  await page.close();
}

function createIco(png) {
  const header = Buffer.from([0, 0, 1, 0, 1, 0]);
  const entry = Buffer.alloc(16);
  entry[0] = 64;
  entry[1] = 64;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const standardSvg = createSvg({ scale: 2 / 3 });
const maskableSvg = createSvg({ scale: 0.6 });
const faviconSvg = createSvg({ scale: 0.78, rounded: true });
const temporaryFavicon = path.join(publicRoot, 'favicon-64.tmp.png');
const browser = await chromium.launch({ headless: true });

try {
  await writeFile(path.join(publicRoot, 'favicon.svg'), faviconSvg);
  await renderPng(browser, standardSvg, path.join(publicRoot, 'icons/app-icon-192.png'), 192);
  await renderPng(browser, standardSvg, path.join(publicRoot, 'icons/app-icon-512.png'), 512);
  await renderPng(
    browser,
    maskableSvg,
    path.join(publicRoot, 'icons/app-icon-maskable-512.png'),
    512,
  );
  await renderPng(browser, standardSvg, path.join(publicRoot, 'icons/apple-touch-icon.png'), 180);
  await renderPng(browser, faviconSvg, temporaryFavicon, 64);
  const faviconPng = await readFile(temporaryFavicon);
  await writeFile(path.join(publicRoot, 'favicon.ico'), createIco(faviconPng));
} finally {
  await browser.close();
  await unlink(temporaryFavicon).catch(() => undefined);
}
