// Browser check with real AI: plan setup asks about the routine with options → tap one → Schedule shows dated topics;
// assistant by voice (fake mic) creates "Alex" with Maya's topics after confirmation; typed commands open, edit, rename, delete.
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
  await p.click('.option >> nth=0')
  r.rounds++
  await p.waitForTimeout(500)
  await p.waitForSelector('button[type=submit]:text-is("Send")', { timeout: 60000 })
}
await p.screenshot({ path: SP + '/a-answered.png', fullPage: true })
r.routine = await p.innerText('.schedule-line')
await p.click('text=Confirm')
await p.waitForURL(/#\/space\/[^/]+$/)
await p.click('text=Schedule')
await p.waitForSelector('.timeline')
r.timeline = await p.$$eval('.timeline li', (x) => x.slice(0, 3).map((l) => l.innerText.replace(/\n/g, ' ')))
await p.screenshot({ path: SP + '/a-schedule.png', fullPage: true })

// Assistant by voice: it starts listening as soon as it opens.
await p.goto(U + '#/spaces')
await p.click('[aria-label="Assistant"]:visible')
await p.waitForSelector('[aria-label="Done speaking"]')
await p.waitForTimeout(5000)
await p.click('[aria-label="Done speaking"]')
await p.waitForSelector('text=Yes, do it', { timeout: 90000 })
r.said = await p.innerText('.bubble.teacher')
r.confirmText = await p.innerText('.assistant-panel .plan-summary')
await p.screenshot({ path: SP + '/a-confirm.png' })
await p.click('text=Yes, do it')
await p.waitForSelector('.bubble:has-text("Created Alex")', { timeout: 30000 })
const alex = (await spaces()).find((s) => s.name === 'Alex')
r.alexTopics = alex?.plan?.topics.length
r.alexSchedule = alex?.plan?.schedule ?? null
r.stillOpen = !!(await p.$('.assistant-panel'))

// The conversation continues in the same panel, by typing.
let bubbles = 0
async function typed(command) {
  bubbles = await p.$$eval('.bubble.assistant', (x) => x.length)
  await p.fill('input[name=command]', command)
  await p.click('.assistant-input button[type=submit]')
}
const nextReply = () => p.waitForFunction((n) => document.querySelectorAll('.bubble.assistant').length > n || document.querySelector('.assistant-panel .plan-summary'), bubbles, { timeout: 90000 })

await typed('Where did Maya stop?')
await nextReply()
r.answer = await p.$$eval('.bubble.assistant', (x) => x.at(-1).innerText)

await typed('Open Maya')
await p.waitForURL(mayaUrl, { timeout: 90000 })

await typed('Make derivatives more detailed: split it into three subtopics')
await p.waitForSelector('text=Yes, do it', { timeout: 90000 })
r.editPreview = await p.$$eval('.assistant-preview li', (x) => x.map((l) => l.innerText))
await p.screenshot({ path: SP + '/a-edit.png' })
await p.click('text=Yes, do it')
await p.waitForSelector('.bubble:has-text("Saved")', { timeout: 30000 })
r.mayaTopicsAfter = (await spaces()).find((s) => s.name === 'Maya').plan.topics.length

await typed('Rename Alex to Alex Kim')
await p.waitForSelector('text=Yes, do it', { timeout: 90000 })
await p.click('text=Yes, do it')
await p.waitForSelector('.bubble:has-text("Renamed")', { timeout: 30000 })
await typed('Delete Alex Kim')
await p.waitForSelector('text=Yes, do it', { timeout: 90000 })
r.deleteText = await p.innerText('.assistant-panel .plan-summary')
await p.click('text=Yes, do it')
await p.waitForSelector('.bubble:has-text("Deleted")', { timeout: 30000 })
r.namesAfter = (await spaces()).map((s) => s.name)

await typed('Can you edit the lesson from Oct 26?')
await nextReply()
r.cantReply = await p.$$eval('.bubble.assistant', (x) => x.at(-1).innerText)
await p.screenshot({ path: SP + '/a-chat.png' })
await p.click('[aria-label="Close assistant"]')
r.closed = !(await p.$('.assistant-panel'))

console.log(JSON.stringify(r, null, 1), errs)
await b.close()
const ok =
  r.options.length >= 2 && r.routine && !/No routine/.test(r.routine) &&
  r.timeline.length === 3 && !r.timeline.some((t) => t.startsWith('—')) &&
  /alex/i.test(r.said) && /Alex/.test(r.confirmText) && /Maya/.test(r.confirmText) &&
  r.alexTopics >= 6 && !(r.alexSchedule?.slots?.length || r.alexSchedule?.everyDays) && r.stillOpen &&
  r.answer.length > 5 &&
  r.editPreview.length > 8 && r.mayaTopicsAfter > 8 &&
  /Delete "Alex Kim"/.test(r.deleteText) && r.namesAfter.join() === 'Maya' &&
  r.cantReply.length > 10 && r.closed && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
