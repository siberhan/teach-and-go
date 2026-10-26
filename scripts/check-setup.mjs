// Slice 3 check in the browser: send the demo curriculum, pick lesson days, confirm, plan is saved.
// Also checks that an oversized document is rejected before sending. Usage: node scripts/check-setup.mjs <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const SP = process.argv[2] ?? '.'
const { GEMINI_KEY, GROQ_KEY } = loadEnv()
const U = 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))

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

// Oversized document is rejected in the browser.
await p.setInputFiles('input[type=file]', { name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(21 * 1024 * 1024) })
const tooLong = await p.isVisible('text=Document too long')

await p.setInputFiles('input[type=file]', 'demo/curriculum.pdf')
await p.click('button[type=submit]')
await p.waitForSelector('text=Confirm', { timeout: 60000 })
await p.click('.day:text("Tue")')
await p.click('.day:text("Fri")')
await p.screenshot({ path: SP + '/s3-draft.png', fullPage: true })
await p.click('text=Confirm')
await p.waitForURL(/#\/space\/[^/]+$/)
const id = p.url().split('/').pop()
const plan = await p.evaluate(
  (id) =>
    new Promise((res) => {
      const r = indexedDB.open('teach-and-go')
      r.onsuccess = () => {
        const g = r.result.transaction('spaces').objectStore('spaces').get(id)
        g.onsuccess = () => res(g.result.plan)
      }
    }),
  id,
)
console.log({ tooLong, topics: plan?.topics.length, lessonDays: plan?.lessonDays, errs })
await b.close()
const ok = tooLong && plan?.topics.length >= 6 && plan.lessonDays?.join() === 'Tue,Fri' && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
