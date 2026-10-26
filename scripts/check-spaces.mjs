import { chromium } from 'playwright-core'
// Slice 2 check: keys and spaces survive a reload. Usage: node scripts/check-spaces.mjs <screenshot-dir>
const SP = process.argv[2]
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 800 } })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()))
const U = 'http://localhost:5173/'
await p.goto(U + '#/'); await p.click('text=Settings')
await p.fill('input[name=groq]', 'gsk_test'); await p.fill('input[name=gemini]', 'AIza_test'); await p.click('button[type=submit]')
await p.waitForURL(U + '#/')
for (const n of ['Maya', 'Class 7B']) {
  await p.goto(U + '#/spaces'); await p.click('text=New space'); await p.fill('input[name=name]', n); await p.click('text=Create')
  await p.waitForSelector(`.topbar-title:text("${n}")`)
}
await p.screenshot({ path: SP + '/s2-space.png' })
await p.reload(); await p.goto(U + '#/spaces'); await p.reload()
await p.waitForSelector('.row')
const names = await p.$$eval('.row span:first-child', els => els.map(e => e.textContent))
await p.goto(U + '#/settings'); await p.reload(); await p.waitForTimeout(300)
const keys = [await p.inputValue('input[name=groq]'), await p.inputValue('input[name=gemini]')]
console.log({ names, keys, errs })
await p.goto(U + '#/spaces'); await p.screenshot({ path: SP + '/s2-spaces.png' })
await b.close()
process.exit(names.length === 2 && keys[0] === 'gsk_test' && keys[1] === 'AIza_test' && !errs.length ? 0 : 1)
