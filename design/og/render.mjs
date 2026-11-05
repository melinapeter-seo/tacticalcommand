import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('/home/user/tacticalcommand/node_modules/sharp');
const [html, dir] = process.argv.slice(2);
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
await pg.goto('file://' + html, { waitUntil: 'networkidle' });
for (const v of ['B', 'C']) {
  await pg.evaluate((v) => { document.querySelectorAll('.c').forEach((c) => (c.style.display = c.id === v ? 'block' : 'none')); }, v);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(300);
  const png = await pg.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(`${dir}/og-${v}.jpg`);
}
await b.close();
console.log('ok');
