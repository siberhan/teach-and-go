// Renders the app icons (Peach Paper style) into public/ with the installed Chrome.
import { chromium } from 'playwright-core'

const html = (size, pad) => `<html><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:#F4B99C;display:grid;place-items:center;font-family:Lexend,system-ui,sans-serif">
<div style="width:${size - pad * 2}px;height:${size - pad * 2}px;border-radius:${size * 0.12}px;background:#FFF8F1;border:${size * 0.02}px solid #2B2622;box-shadow:${size * 0.03}px ${size * 0.03}px 0 #2B2622;display:grid;place-items:center;font-weight:600;font-size:${size * 0.3}px;color:#2B2622;box-sizing:border-box">T&amp;G</div>
</div></body></html>`

const browser = await chromium.launch({ channel: 'chrome' })
for (const [file, size, pad] of [['pwa-192.png', 192, 30], ['pwa-512.png', 512, 80], ['maskable-512.png', 512, 110], ['apple-touch-icon.png', 180, 28]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(html(size, pad))
  await page.screenshot({ path: `public/${file}` })
  await page.close()
}
await browser.close()
