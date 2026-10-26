// Records the demo footage: a phone-sized Chrome with a fake microphone that plays a WAV file,
// filmed frame by frame through the DevTools screencast at 3x pixel density.
// Usage: node video/capture/capture.mjs <phase>   (phases below, run in order)
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../../scripts/env.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const OUT = path.resolve(HERE, '../public/cap')
const U = process.env.BASE ?? 'http://localhost:5173/'
const phase = process.argv[2]
const wavFor = { plan: 'plan', lesson: 'lecture', a1: 'a1', a2: 'a2', a3: 'a3' }
const wav = wavFor[phase] && path.join(HERE, 'wav', wavFor[phase] + '.wav')
const state = path.join(HERE, 'state.json')
const saved = fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf8')) : {}

const ctx = await chromium.launchPersistentContext(path.join(HERE, phase === 'keys' ? 'profile-fresh' : 'profile'), {
  channel: 'chrome',
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  colorScheme: 'light',
  permissions: ['microphone'],
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(wav ? [`--use-file-for-fake-audio-capture=${wav}%noloop`] : [])],
})
for (const old of ctx.pages()) await old.close()
const p = await ctx.newPage()
const sleep = (ms) => p.waitForTimeout(ms)
const dur = (f) => Number(fs.statSync(f).size - 44) / (48000 * 2) * 1000

// Film: grab 3x screenshots as fast as Chrome gives them (~30 per second), each with its time.
const dir = path.join(OUT, phase)
const frames = []
const marks = []
async function film() {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const cdp = await ctx.newCDPSession(p)
  let on = true
  const start = Date.now()
  const loop = (async () => {
    while (on) {
      const t = Date.now() - start
      const y = (await cdp.send('Runtime.evaluate', { expression: 'scrollY', returnByValue: true }).catch(() => null))?.result?.value ?? 0
      const clip = { x: 0, y, width: 390, height: 844, scale: 3 }
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, clip }).catch(() => ({}))
      if (!data) continue
      const file = String(frames.length).padStart(5, '0') + '.jpg'
      fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'))
      frames.push({ file, t })
    }
  })()
  return async () => {
    on = false
    await loop
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ frames, marks }, null, 1))
    console.log(phase, frames.length, 'frames,', frames.at(-1)?.t, 'ms', marks)
  }
}
let t0Wall = 0
const mark = (name) => marks.push({ name, t: Date.now() - t0Wall })

async function typeSlow(sel, text) {
  await p.click(sel)
  await p.keyboard.type(text, { delay: 70 })
}

async function speak(micSel, doneSel) {
  if (micSel) await p.click(micSel)
  mark('speak')
  await sleep(dur(wav) + 300)
  await p.click(doneSel)
  mark('done')
}

async function waitReply(before) {
  await p.waitForFunction((n) => document.querySelectorAll('.turn.assistant').length > n, before, { timeout: 120000 })
}
const replies = () => p.$$eval('.turn.assistant', (x) => x.length)

if (phase === 'setup') {
  const { OPENROUTER_KEY, GROQ_KEY = '' } = loadEnv()
  await p.goto(U + '#/')
  await p.goto(U + '#/settings')
  await p.waitForTimeout(1500)
  await p.fill('input[name=openrouter]', OPENROUTER_KEY)
  await p.fill('input[name=groq]', GROQ_KEY)
  await p.click('button[type=submit]')
  await p.waitForURL(U + '#/')
  console.log('keys saved (not filmed)')
  await ctx.close()
  process.exit(0)
}

await p.goto(U + '#/')
await sleep(800)
const stop = await film()
t0Wall = Date.now()

if (phase === 'plan') {
  await sleep(1500)
  await p.click('a:has-text("Start")')
  await sleep(1200)
  await p.click('button:visible:text("New space")')
  await sleep(400)
  await typeSlow('input[name=name]:visible', 'Maya')
  await sleep(500)
  await p.click('button:visible:text("Create")')
  await p.waitForURL(/#\/space\/[^/]+$/)
  saved.maya = p.url().split('#')[1]
  await sleep(1500)
  await p.click('[aria-label="Space settings"]')
  await sleep(1200)
  await p.setInputFiles('.plan-chat input[type=file]', path.join(ROOT, 'demo/curriculum.pdf'))
  await sleep(1200)
  let n = await replies()
  mark('send-pdf')
  await p.click('.chip-send')
  await waitReply(n)
  mark('reply-1')
  await sleep(2500)
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1500)
  n = await replies()
  await speak('.mic-big', '[aria-label="Done speaking"]')
  await waitReply(n)
  mark('reply-2')
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(3000)
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(3000)
}

if (phase === 'lesson') {
  await p.goto(U + '#' + saved.maya)
  await sleep(1500)
  await p.click('text=New recording')
  await sleep(1200)
  mark('record')
  await p.click('[aria-label="Record"]')
  await sleep(dur(wav) + 500)
  mark('stop')
  await p.click('[aria-label="Stop"]')
  await p.waitForSelector('text=Lesson complete', { timeout: 60000 })
  await sleep(2500)
  await p.click('text=Leave')
  mark('analyzing')
  await p.waitForSelector('.analyzing', { state: 'detached', timeout: 180000 })
  mark('thread')
  await sleep(4000)
  await p.click('.thread')
  await p.waitForSelector('text=The thread')
  mark('thread-open')
  await sleep(4500)
}

if (phase === 'a1' || phase === 'a2' || phase === 'a3') {
  if (phase === 'a1') await p.goto(U + '#/spaces')
  else await p.goto(U + '#' + saved.alex)
  await sleep(1500)
  const n = 0
  mark('open')
  await p.click('[aria-label="Assistant"]')
  await speak(null, '[aria-label="Done speaking"]')
  await waitReply(n)
  mark('reply')
  await sleep(4000)
  await p.click('[aria-label="Close assistant"]')
  await sleep(1000)
  if (phase === 'a1') {
    await p.click('.row-link:has-text("Alex")')
    await p.waitForURL(/#\/space\/[^/]+$/)
    saved.alex = p.url().split('#')[1]
    await sleep(2500)
  } else {
    await p.click('[aria-label="Space settings"]').catch(() => {})
    await sleep(3500)
  }
}

if (phase === 'tour') {
  // Lesson notes, the schedule with finished topics crossed out, then the bell.
  await p.goto(U + '#' + saved.maya)
  await sleep(2500)
  mark('notes')
  await p.click('.row-link')
  await sleep(4000)
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(2500)
  await p.goto(U + '#' + saved.maya)
  await sleep(1200)
  mark('schedule')
  await p.click('a:has-text("Schedule")')
  await sleep(4500)
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(2500)
  await p.goto(U + '#/')
  await sleep(1500)
  mark('bell')
  await p.click('[aria-label="Upcoming lessons"]')
  await sleep(4500)
}

if (phase === 'keys') {
  // A fresh browser with no keys: the settings screen as a new user sees it.
  await sleep(1500)
  mark('settings')
  await p.goto(U + '#/settings')
  await sleep(4500)
}

await stop()
fs.writeFileSync(state, JSON.stringify(saved, null, 1))
await ctx.close()
