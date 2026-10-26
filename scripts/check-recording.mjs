// Slice 5 checks in the browser, with Chrome's fake microphone playing a WAV file:
// live recording → analysis; composer dictation; bad key → failed + audio kept → Retry; reload during analysis resumes.
// Usage: node scripts/check-recording.mjs <fake-mic.wav> <screenshot-dir>
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const [wav, SP = '.'] = process.argv.slice(2)
const { GEMINI_KEY, GROQ_KEY } = loadEnv()
const U = 'http://localhost:5173/'
const b = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`],
})
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
const count = (store) =>
  p.evaluate(
    (store) =>
      new Promise((res) => {
        const r = indexedDB.open('teach-and-go')
        r.onsuccess = () => {
          const c = r.result.transaction(store).objectStore(store).count()
          c.onsuccess = () => res(c.result)
        }
      }),
    store,
  )
async function setKeys(groq) {
  await p.goto(U + '#/settings')
  await p.fill('input[name=groq]', groq)
  await p.fill('input[name=gemini]', GEMINI_KEY)
  await p.click('button[type=submit]')
  await p.waitForURL((u) => !u.hash.includes('settings'))
}
const result = {}

await p.goto(U + '#/')
await setKeys(GROQ_KEY)
await p.goto(U + '#/spaces')
await p.click('button:visible:text("New space")')
await p.fill('input[name=name]:visible', 'Live test')
await p.click('button:visible:text("Create")')
await p.waitForURL(/#\/space\/[^/]+$/)
const spaceUrl = p.url()

// 1. Dictation in the composer.
await p.click('[aria-label="Space settings"]')
await p.click('[aria-label="Dictate"]')
await p.waitForTimeout(8000)
await p.click('[aria-label="Stop dictation"]')
await p.waitForFunction(() => document.querySelector('textarea').value.length > 10, null, { timeout: 30000 })
result.dictation = await p.inputValue('textarea')

// 2. Live recording → analysis done, audio deleted.
await p.goto(spaceUrl)
await p.click('text=New recording')
await p.click('[aria-label="Record"]')
await p.waitForTimeout(15000)
result.timer = await p.innerText('.timer')
await p.screenshot({ path: SP + '/s5-recording.png' })
await p.click('[aria-label="Stop"]')
await p.waitForSelector('text=Lesson complete')
await p.waitForSelector('text=Saved to memory', { timeout: 120000 })
result.liveAudioLeft = await count('audio')

// 3. Bad key → failed with message, audio kept → Retry with the right key → done.
await setKeys('gsk_wrong')
await p.goto(spaceUrl)
await p.click('text=New recording')
await p.click('[aria-label="Record"]')
await p.waitForTimeout(5000)
await p.click('[aria-label="Stop"]')
await p.waitForSelector('text=Nothing was lost', { timeout: 60000 })
result.failedText = await p.innerText('.hero')
result.failedAudioKept = await count('audio')
await setKeys(GROQ_KEY)
await p.goto(spaceUrl)
await p.click('text=Not analyzed')
await p.click('text=Retry')
await p.waitForSelector('text=Stopped at', { timeout: 120000 })
result.afterRetryAudio = await count('audio')

// 4. Reload while analyzing → resumes and finishes.
await p.goto(spaceUrl)
await p.click('text=New recording')
await p.setInputFiles('input[type=file]', 'demo/lecture.m4a')
await p.waitForSelector('text=Analyzing in the background')
await p.waitForTimeout(1500) // let the audio be saved
await p.reload()
await p.goto(spaceUrl)
await p.waitForSelector('.analyzing', { state: 'detached', timeout: 120000 })
result.afterResume = await p.$$eval('.row-link', (rows) => rows.map((r) => r.innerText.replace(/\n/g, ' ')))
result.finalAudio = await count('audio')
await p.screenshot({ path: SP + '/s5-space.png' })

console.log(result, errs)
await b.close()
const ok =
  /derivative|rule|Maya/i.test(result.dictation) &&
  result.liveAudioLeft === 0 &&
  /Nothing was lost/.test(result.failedText) &&
  result.failedAudioKept === 1 &&
  result.afterRetryAudio === 0 &&
  result.afterResume.length === 3 &&
  !result.afterResume.some((r) => /Analyzing|Not analyzed/.test(r)) &&
  result.finalAudio === 0 &&
  !errs.length
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
