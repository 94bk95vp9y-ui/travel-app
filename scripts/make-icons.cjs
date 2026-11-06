#!/usr/bin/env node
/**
 * Erzeugt App-Icons und iOS-Startbildschirme aus public/icons/favicon.svg.
 * Nutzt Playwright/Chromium (muss installiert sein).
 *
 * Aufruf: npm run build:icons
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public/icons/favicon.svg'), 'utf8');
const iconDir = path.join(root, 'public/icons');
const splashDir = path.join(root, 'public/splash');
fs.mkdirSync(splashDir, { recursive: true });

const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
];

// iPhone-Displays (Breite × Höhe in CSS-Pixeln, Pixeldichte) – Hochformat
const SPLASH = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE (2./3. Gen.), 8
];

const splashHtml = (w, h) => `<!doctype html><html><head><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#05070f;}
  body{display:grid;place-items:center;background:#05070f;}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:26px;margin-top:-40px;}
  .orb{width:${Math.round(w * 0.25)}px;height:${Math.round(w * 0.25)}px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%, #2b4a8f 0%, #0d1838 55%, #060b1c 100%);
    box-shadow:0 0 60px 8px rgba(91,140,255,0.28), inset -10px -12px 24px rgba(0,0,0,0.5);}
  .name{font:800 ${Math.round(w * 0.075)}px -apple-system, 'Inter', system-ui, sans-serif;letter-spacing:-0.03em;
    background:linear-gradient(140deg,#ffe3a6,#ffb547 50%,#ff8a3d);-webkit-background-clip:text;color:transparent;}
</style></head><body><div class="wrap"><div class="orb"></div><div class="name">Fernweh</div></div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { file, size } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:#04060e">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: path.join(iconDir, file), omitBackground: false });
    console.log('✓', file);
  }

  const links = [];
  for (const [w, h, dpr] of SPLASH) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    await p.setContent(splashHtml(w, h));
    const name = `splash-${w * dpr}x${h * dpr}.png`;
    await p.screenshot({ path: path.join(splashDir, name) });
    await ctx.close();
    links.push(
      `    <link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="/splash/${name}" />`,
    );
    console.log('✓', name);
  }
  await browser.close();

  // Links in index.html eintragen
  const indexPath = path.join(root, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const next = html.replace(
    /<!-- SPLASH:START -->[\s\S]*?<!-- SPLASH:END -->/,
    `<!-- SPLASH:START -->\n${links.join('\n')}\n    <!-- SPLASH:END -->`,
  );
  fs.writeFileSync(indexPath, next);
  console.log('✓ index.html aktualisiert');
})();
