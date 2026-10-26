// Opens app routes in headless Chrome, fails on console errors, saves screenshots.
import { chromium } from 'playwright-core'

const base = process.env.BASE ?? 'http://localhost:5173/'
const routes = process.argv.slice(2)
const out = process.env.SHOTS ?? '.'
const browser = await chromium.launch({ channel: 'chrome' })
let failed = false
for (const r of routes) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base + '#' + r, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${out}/shot${r.replace(/\W/g, '_')}.png`, fullPage: true })
  console.log(r, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok')
  if (errors.length) failed = true
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
