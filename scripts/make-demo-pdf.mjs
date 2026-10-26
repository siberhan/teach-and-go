// Renders demo/curriculum.html to demo/curriculum.pdf with the installed Chrome.
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto(pathToFileURL('demo/curriculum.html').href)
await page.pdf({ path: 'demo/curriculum.pdf', format: 'A4' })
await browser.close()
