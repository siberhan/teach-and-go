// Recording survives leaving the screen, shows the bottom bar, pauses and resumes, and still becomes one lesson.
// Usage: node scripts/check-live-recording.mjs <fake-mic.wav> <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const [wav, SP = '.'] = process.argv.slice(2)
const { OPENROUTER_KEY, GROQ_KEY = '' } = loadEnv()
const U = process.env.BASE ?? 'http://localhost:5173/'
const b = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`],
})
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
const secs = async () => {
  const [m, s] = (await p.innerText('.timer')).split(':').map(Number)
  return m * 60 + s
}
const r = {}

await p.goto(U + '#/settings')
await p.fill('input[name=openrouter]', OPENROUTER_KEY)
await p.fill('input[name=groq]', GROQ_KEY) // Groq first for speech, as a teacher with both keys would have it
await p.click('button[type=submit]')
await p.waitForURL((u) => !u.hash.includes('settings'))
await p.goto(U + '#/spaces')
await p.click('button:visible:text("New space")')
await p.fill('input[name=name]:visible', 'Pause test')
await p.click('button:visible:text("Create")')
await p.waitForURL(/#\/space\/[^/]+$/)

await p.click('text=New recording')
await p.click('[aria-label="Record"]')
await p.waitForTimeout(4000)
// Leave with the back arrow: the bar appears and the clock keeps going.
await p.click('[aria-label="Back"]')
await p.waitForSelector('.rec-bar')
r.barText = await p.innerText('.rec-bar')
await p.screenshot({ path: SP + '/live-bar.png' })
await p.waitForTimeout(3000)
await p.click('.rec-bar')
await p.waitForSelector('.timer')
r.afterReturn = await secs()
r.barOnRecordScreen = await p.$$eval('.rec-bar', (x) => x.length)

// Pause: the clock stops. Resume: it runs again.
await p.click('button:text-is("Pause")')
await p.waitForTimeout(500)
const pausedAt = await secs()
await p.waitForTimeout(3000)
r.pausedDelta = (await secs()) - pausedAt
await p.click('[aria-label="Back"]')
r.pausedBar = await p.innerText('.rec-bar')
await p.click('.rec-bar')
await p.click('button:text-is("Resume")')
await p.waitForTimeout(3000)
r.resumedDelta = (await secs()) - pausedAt
await p.screenshot({ path: SP + '/live-resumed.png' })
await p.click('[aria-label="Stop"]')
await p.waitForSelector('text=Lesson complete')
await p.waitForSelector('text=Saved to memory', { timeout: 120000 })
r.barAfterStop = await p.$$eval('.rec-bar', (x) => x.length)
r.lessons = await p.evaluate(
  () =>
    new Promise((res) => {
      const o = indexedDB.open('teach-and-go')
      o.onsuccess = () => {
        const g = o.result.transaction('lessons').objectStore('lessons').getAll()
        g.onsuccess = () => res(g.result.map((l) => Math.round(l.durationSec)))
      }
    }),
)

console.log(r, errs)
await b.close()
const ok =
  /Recording/.test(r.barText) && /Back to recording/.test(r.barText) &&
  r.afterReturn >= 6 && r.barOnRecordScreen === 0 &&
  r.pausedDelta === 0 && /Paused/.test(r.pausedBar) && r.resumedDelta >= 2 &&
  r.barAfterStop === 0 && r.lessons.length === 1 && !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
