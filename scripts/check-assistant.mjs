// Browser check with real AI: plan setup asks about the routine with options → tap one → Schedule shows dated topics;
// the assistant agent by voice (fake mic) creates "Alex" with Maya's topics; typed commands answer, open, edit topics,
// create two spaces from one non-English message (reply in that language), fill an empty space's topics, rename, and delete two spaces after one tap.
// Usage: node scripts/check-assistant.mjs <spoken-command.wav> <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const [wav, SP = '.'] = process.argv.slice(2)
const { OPENROUTER_KEY, GROQ_KEY = '' } = loadEnv()
const U = process.env.BASE ?? 'http://localhost:5173/'
const b = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`],
})
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
const spaces = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const o = indexedDB.open('teach-and-go')
        o.onsuccess = () => {
          const g = o.result.transaction('spaces').objectStore('spaces').getAll()
          g.onsuccess = () => res(g.result)
        }
      }),
  )
const r = {}

await p.goto(U + '#/settings')
await p.fill('input[name=openrouter]', OPENROUTER_KEY)
await p.fill('input[name=groq]', GROQ_KEY) // Groq first for speech, as a teacher with both keys would have it
await p.click('button[type=submit]')
await p.waitForURL((u) => !u.hash.includes('settings'))
await p.goto(U + '#/spaces')
await p.click('button:visible:text("New space")')
await p.fill('input[name=name]:visible', 'Maya')
await p.click('button:visible:text("Create")')
await p.waitForURL(/#\/space\/[^/]+$/)
const mayaUrl = p.url()

// Setup: the AI asks about the routine with options.
await p.click('[aria-label="Space settings"]')
await p.setInputFiles('input[type=file]', 'demo/curriculum.pdf')
await p.click('button[type=submit]')
await p.waitForSelector('.question', { timeout: 60000 })
r.question = await p.innerText('.question-text')
r.options = await p.$$eval('.option', (x) => x.map((o) => o.innerText.replace(/\n/g, ' ')))
await p.screenshot({ path: SP + '/a-question.png', fullPage: true })
// Tap the first option until the routine is known (the AI may ask a follow-up, e.g. days after frequency).
r.rounds = 0
while (!(await p.$('.schedule-line')) && r.rounds < 3) {
  r.asked = [...(r.asked ?? []), (await p.innerText('.question-text')) + ' → ' + (await p.innerText('.option >> nth=0'))]
  await p.click('.option >> nth=0')
  r.rounds++
  await p.waitForTimeout(500)
  await p.waitForSelector('button[type=submit]:text-is("Send")', { timeout: 60000 })
}
await p.screenshot({ path: SP + '/a-answered.png', fullPage: true })
console.log(r.asked)
r.routine = await p.innerText('.schedule-line')
await p.click('text=Confirm')
await p.waitForURL(/#\/space\/[^/]+$/)
await p.click('text=Schedule')
await p.waitForSelector('.timeline')
r.timeline = await p.$$eval('.timeline li', (x) => x.slice(0, 3).map((l) => l.innerText.replace(/\n/g, ' ')))
await p.screenshot({ path: SP + '/a-schedule.png', fullPage: true })

// Assistant by voice: it starts listening as soon as it opens. Changes apply right away and show as chips.
await p.goto(U + '#/spaces')
await p.click('[aria-label="Assistant"]:visible')
await p.waitForSelector('[aria-label="Done speaking"]')
await p.waitForTimeout(5000)
await p.click('[aria-label="Done speaking"]')
await p.waitForSelector('.agent-actions li:has-text("Alex")', { timeout: 90000 })
r.said = await p.innerText('.bubble.teacher')
r.firstReply = await p.$$eval('.bubble.assistant:not(.thinking)', (x) => x.at(-1)?.innerText)
await p.screenshot({ path: SP + '/a-created.png' })
const named = async (n) => (await spaces()).find((s) => s.name === n)
const alex = await named('Alex')
r.alexTopics = alex?.plan?.topics.length
r.alexSchedule = alex?.plan?.schedule ?? null
r.stillOpen = !!(await p.$('.assistant-panel'))

// The conversation continues in the same panel, by typing.
let turns = 0
async function typed(command) {
  turns = await p.$$eval('.turn.assistant', (x) => x.length)
  if (!(await p.$('input[name=command]'))) await p.click('text=type instead')
  await p.fill('input[name=command]', command)
  await p.click('.assistant-input button[type=submit]')
  await p.waitForFunction((n) => document.querySelectorAll('.turn.assistant').length > n, turns, { timeout: 90000 })
  return p.$$eval('.turn.assistant', (x) => x.at(-1).innerText)
}

r.noName = await typed('Yeni alan oluşturabilir misin?')
r.countAfterNoName = (await spaces()).length
await typed('İsmi Mehmet olsun.')
r.mehmet = !!(await named('Mehmet')) && (await spaces()).length === r.countAfterNoName + 1 && (await spaces()).every((s) => s.name.trim())
await typed('Mehmet alanını sil')
await p.click('text=Yes, delete')
await p.waitForSelector('.agent-actions li:has-text("🗑 Mehmet")', { timeout: 30000 })
r.answer = await typed('Where did Maya stop?')
await typed('Open Maya')
r.openedMaya = p.url() === mayaUrl
const mayaBefore = (await named('Maya')).plan.topics.length
r.edit = await typed('Make Derivative rules more detailed: split it into three subtopics')
r.mayaTopics = [mayaBefore, (await named('Maya')).plan.topics.length]
r.two = await typed('İki yeni alan oluştur: biri Ronaldo, diğeri Messi')
r.ronaldoMessi = [!!(await named('Ronaldo')), !!(await named('Messi'))]
r.stayedOnMaya = p.url() === mayaUrl // creating a space does not move the teacher
r.fill = await typed('Ronaldo için konular: kesirler, ondalık sayılar, yüzdeler')
r.ronaldoTopics = (await named('Ronaldo'))?.plan?.topics.map((t) => t.title)
r.rename = await typed('Rename Alex to Alex Kim')
r.renamed = !!(await named('Alex Kim'))
await typed('Delete Alex Kim and Messi')
await p.waitForSelector('text=Yes, delete', { timeout: 30000 })
r.deleteText = await p.innerText('.assistant-panel .plan-summary')
r.deleteAsk = await p.$$eval('.bubble.assistant:not(.thinking)', (x) => x.at(-1).innerText)
r.notYetDeleted = !!(await named('Alex Kim')) && !!(await named('Messi'))
await p.screenshot({ path: SP + '/a-delete.png' })
await p.click('text=Yes, delete')
await p.waitForSelector('.agent-actions li:has-text("🗑 Messi")', { timeout: 30000 })
r.namesAfter = (await spaces()).map((s) => s.name).sort()

r.cantReply = await typed('Can you edit the lesson from Oct 26?')
await p.screenshot({ path: SP + '/a-chat.png' })
await p.click('[aria-label="Close assistant"]')
r.closed = !(await p.$('.assistant-panel'))

console.log(JSON.stringify(r, null, 1), errs)
await b.close()
const notEnglish = (t) => /[çğıöşü]/i.test(t) && !/\b(the|created|anything)\b/i.test(t)
const ok =
  r.options.length >= 2 && r.routine && !/No routine/.test(r.routine) &&
  r.timeline.length === 3 && !r.timeline.some((t) => t.startsWith('—')) &&
  /alex/i.test(r.said) && r.alexTopics >= 6 && !(r.alexSchedule?.slots?.length || r.alexSchedule?.everyDays) && r.stillOpen &&
  r.countAfterNoName === 2 && r.mehmet && /Maya/.test(r.answer) && r.openedMaya && r.mayaTopics[1] > r.mayaTopics[0] &&
  r.ronaldoMessi.every(Boolean) && notEnglish(r.two) && r.ronaldoTopics?.length === 3 && notEnglish(r.fill) &&
  r.renamed && /Alex Kim/.test(r.deleteText) && /Messi/.test(r.deleteText) && !notEnglish(r.deleteAsk) && r.notYetDeleted && r.namesAfter.join() === 'Maya,Ronaldo' && r.stayedOnMaya &&
  r.cantReply.length > 10 && r.closed && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
