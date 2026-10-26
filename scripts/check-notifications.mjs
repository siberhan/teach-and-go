// Start screen bell: count of upcoming lessons, panel lists them soonest first, links to the thread, closes on outside tap.
// Usage: node scripts/check-notifications.mjs <screenshot-dir>
import { chromium } from 'playwright-core'

const [SP = '.'] = process.argv.slice(2)
const U = process.env.BASE ?? 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(U + '#/')
await p.evaluate(async () => {
  const { db } = await import('/src/lib/db.ts')
  const today = new Date().getDay()
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const plan = (days, title) => ({ summary: 's', lessonDays: days.map((d) => W[d]), topics: [{ id: 't0', title }] })
  await db.spaces.bulkAdd([
    { id: 'a', name: 'Maya', createdAt: 1, plan: plan([today], 'The chain rule') },
    { id: 'b', name: 'Class 7B', createdAt: 2, plan: plan([(today + 1) % 7], 'Fractions') },
    { id: 'c', name: 'Leo', createdAt: 3, plan: plan([(today + 3) % 7], 'Past tense') },
    { id: 'd', name: 'No plan', createdAt: 4 },
  ])
})
await p.reload()
const r = {}
r.count = await p.innerText('.notif-count')
r.panelBefore = await p.$$eval('.notif-panel', (x) => x.length)
await p.click('[aria-label="Upcoming lessons"]')
r.items = await p.$$eval('.notif-item', (x) => x.map((i) => i.innerText.replace(/\n/g, ' ')))
await p.screenshot({ path: SP + '/notif-open.png' })
await p.mouse.click(195, 500)
r.panelAfterOutside = await p.$$eval('.notif-panel', (x) => x.length)
await p.click('[aria-label="Upcoming lessons"]')
await p.click('.notif-item >> nth=1')
r.url = p.url()
console.log(r, errs)
await b.close()
const ok =
  r.count === '3' && r.panelBefore === 0 && r.items.length === 3 &&
  /^Today Maya The chain rule/.test(r.items[0]) && /^Tomorrow Class 7B/.test(r.items[1]) &&
  r.panelAfterOutside === 0 && r.url.endsWith('#/space/b/thread') && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
