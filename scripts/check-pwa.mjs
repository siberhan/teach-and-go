// Slice 6 check on the production build (npm run build && npm run preview): manifest, service worker, offline start.
import { chromium } from 'playwright-core'

const U = process.env.BASE ?? 'http://localhost:4173/'
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext()
const p = await ctx.newPage()
await p.goto(U)
const manifest = await (await p.request.get(U + 'manifest.webmanifest')).json()
const sw = await p.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)
await p.waitForTimeout(1000)
await ctx.setOffline(true)
await p.reload()
const offlineTitle = await p.innerText('.logo')
await ctx.setOffline(false)
console.log({ name: manifest.name, icons: manifest.icons.length, display: manifest.display, sw, offlineTitle })
await b.close()
const ok = manifest.name === 'Teach&Go' && manifest.icons.length === 3 && ['activating', 'activated'].includes(sw) && offlineTitle === 'Teach&Go'
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
