// Layout check: seeds sample data (no AI calls) and screenshots key screens at desktop and phone width.
// Usage: node scripts/check-layout.mjs <screenshot-dir>
import { chromium } from 'playwright-core'

const SP = process.argv[2] ?? '.'
const U = 'http://localhost:5173/'
const b = await chromium.launch({ channel: 'chrome' })
const errs = []
for (const [name, viewport] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport })
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(U)
  const ids = await p.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts')
    await db.delete()
    await db.open()
    const plan = { summary: 'Calculus, eight topics.', lessonDays: ['Tue', 'Fri'], topics: ['Functions', 'Limits', 'Derivative rules', 'The chain rule', 'Integrals'].map((title, i) => ({ id: 't' + i, title })) }
    await db.spaces.bulkAdd([
      { id: 's1', name: 'Maya', createdAt: 2, plan },
      { id: 's2', name: 'Class 7B', createdAt: 1 },
    ])
    await db.lessons.add({ id: 'l1', spaceId: 's1', createdAt: Date.now(), durationSec: 2700, status: 'done', covered: ['power rule', 'product rule', 'quotient rule'], stoppingPoint: { text: 'finished derivative rules', topicId: 't2', topicFinished: true }, deferred: [{ id: 'd1', text: 'chain rule', topicId: 't3' }] })
    return 'ok'
  })
  for (const r of ['/', '/spaces', '/space/s1', '/space/s2', '/space/s1/settings', '/space/s2/settings', '/space/s1/thread', '/settings']) {
    await p.goto(U + '#' + r)
    await p.waitForTimeout(250)
    await p.screenshot({ path: `${SP}/${name}${r.replace(/\W/g, '_')}.png` })
  }
  console.log(name, ids)
  await p.close()
}
await b.close()
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'PASS')
process.exit(errs.length ? 1 : 0)
