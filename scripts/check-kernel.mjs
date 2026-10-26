// Slice 4 end-to-end check in the browser: curriculum → plan → demo lecture upload → analysis →
// Thread card shows where to start and the "explain later" reminder; audio is deleted.
// Usage: node scripts/check-kernel.mjs <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const SP = process.argv[2] ?? '.'
const { GEMINI_KEY, GROQ_KEY } = loadEnv()
const U = process.env.BASE ?? 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'warning' && console.log('warn:', m.text()))

await p.goto(U + '#/')
await p.goto(U + '#/settings')
await p.fill('input[name=groq]', GROQ_KEY)
await p.fill('input[name=gemini]', GEMINI_KEY)
await p.click('button[type=submit]')
await p.waitForURL(U + '#/')
await p.goto(U + '#/spaces')
await p.click('button:visible:text("New space")')
await p.fill('input[name=name]:visible', 'Maya')
await p.click('button:visible:text("Create")')
await p.click('[aria-label="Space settings"]')
await p.setInputFiles('input[type=file]', 'demo/curriculum.pdf')
await p.click('button[type=submit]')
await p.waitForSelector('text=Confirm', { timeout: 60000 })
await p.click('text=Confirm')
await p.waitForURL(/#\/space\/[^/]+$/)
const spaceUrl = p.url()

await p.click('text=New recording')
await p.setInputFiles('input[type=file]', 'demo/lecture.m4a')
await p.waitForSelector('text=Lesson complete', { timeout: 60000 })
const finishedText = await p.innerText('main')
await p.screenshot({ path: SP + '/s4-finished.png' })
await p.click('text=Leave')
await p.waitForURL(spaceUrl)
const analyzingShown = await p.isVisible('text=Analyzing')
await p.waitForSelector('.analyzing', { state: 'detached', timeout: 120000 })
await p.screenshot({ path: SP + '/s4-space.png' })
const card = await p.innerText('.thread')
const audioLeft = await p.evaluate(
  () =>
    new Promise((res) => {
      const r = indexedDB.open('teach-and-go')
      r.onsuccess = () => {
        const c = r.result.transaction('audio').objectStore('audio').count()
        c.onsuccess = () => res(c.result)
      }
    }),
)
await p.click('.row-link')
await p.waitForSelector('text=Stopped at')
const detail = await p.innerText('main')
await p.screenshot({ path: SP + '/s4-lesson.png' })
await p.goto(spaceUrl)
await p.click('.thread')
await p.waitForSelector('text=The thread')
await p.screenshot({ path: SP + '/s4-thread.png' })

console.log({ finishedText, analyzingShown, card, audioLeft, detail, errs })
await b.close()
const ok = /1 min 2\d s/.test(finishedText) && analyzingShown && /chain rule/i.test(card) && /explain/i.test(card) && audioLeft === 0 && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
