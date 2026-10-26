// Renders the app icons from public/logo.png into public/ with the installed Chrome.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const logo = `data:image/png;base64,${readFileSync('public/logo.png').toString('base64')}`
// The logo sits on its own paper colour; maskable icons get extra room because launchers crop them to a circle.
const html = (size, scale) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:#FBF3E6;display:grid;place-items:center">
<img src="${logo}" style="width:${size * scale}px;height:${size * scale}px"></body></html>`

const browser = await chromium.launch({ channel: 'chrome' })
for (const [file, size, scale] of [['pwa-192.png', 192, 1], ['pwa-512.png', 512, 1], ['maskable-512.png', 512, 0.8], ['apple-touch-icon.png', 180, 1], ['favicon.png', 64, 1.15]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(html(size, scale))
  await page.screenshot({ path: `public/${file}` })
  await page.close()
}
await browser.close()
