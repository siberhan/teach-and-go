// Plan conversation check in the browser: an oversized document is rejected; the demo curriculum alone → topics saved,
// routine not guessed but asked; the teacher's answer → routine saved; the same document again with no instruction →
// nothing changes and the agent asks what to do. Usage: node scripts/check-setup.mjs <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'
import { planChat } from './plan-chat.mjs'

const SP = process.argv[2] ?? '.'
const { OPENROUTER_KEY, GROQ_KEY = '' } = loadEnv()
const U = 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))

await p.goto(U + '#/')
await p.goto(U + '#/settings')
await p.fill('input[name=openrouter]', OPENROUTER_KEY)
await p.fill('input[name=groq]', GROQ_KEY) // Groq first for speech, as a teacher with both keys would have it
await p.click('button[type=submit]')
await p.waitForURL(U + '#/')
await p.goto(U + '#/spaces')
await p.click('button:visible:text("New space")')
await p.fill('input[name=name]:visible', 'Maya')
await p.click('button:visible:text("Create")')
await p.waitForURL(/#\/space\/[^/]+$/)
const id = p.url().split('/').pop()
await p.click('[aria-label="Space settings"]')
const plan = () =>
  p.evaluate(
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

// Oversized document is rejected in the browser.
await p.setInputFiles('.plan-chat input[type=file]', { name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(21 * 1024 * 1024) })
const tooLong = await p.isVisible('text=Document too long')

const r = {}


r.first = await planChat(p, { file: 'demo/curriculum.pdf' })
r.afterDoc = await plan()
r.second = await planChat(p, { text: 'Tuesday and Friday at 19:00' })
const saved = await plan()
await p.screenshot({ path: SP + '/s3-plan.png', fullPage: true })
r.third = await planChat(p, { file: 'demo/curriculum.pdf' })
const afterAgain = await plan()
r.cancel = await planChat(p, { text: 'This week the lessons are cancelled, we start next week.' })
const afterCancel = (await plan()).schedule
// Today + days until next Monday = the start of next week.
const nextMonday = new Date(); nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7))
const nextWeek = nextMonday.toISOString().slice(0, 10)
r.afterCancel = afterCancel
const slots = saved?.schedule?.slots?.map((s) => s.day + s.time).sort().join()
const unchanged = JSON.stringify(afterAgain.topics) === JSON.stringify(saved.topics)
console.log({ tooLong, ...r, afterDoc: { topics: r.afterDoc?.topics.length, schedule: r.afterDoc?.schedule }, topics: saved?.topics.length, slots, unchanged, errs })
await b.close()
const ok =
  tooLong && r.afterDoc?.topics.length >= 6 && !r.afterDoc.schedule && /\?/.test(r.first) &&
  saved?.topics.length >= 6 && slots === 'Fri19:00,Tue19:00' && unchanged && /\?/.test(r.third) &&
  afterCancel?.startDate >= nextWeek && afterCancel.slots?.map((s) => s.day + s.time).sort().join() === slots && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
