// Shared by the check scripts: one message in a space's plan conversation (a document, text, or both).
// Returns the agent's reply, including the change chips under it.
export async function planChat(p, { file, text }) {
  const before = await p.$$eval('.turn.assistant', (x) => x.length)
  if (file) await p.setInputFiles('.plan-chat input[type=file]', file)
  if (text) {
    if (!(await p.$('input[name=command]'))) await p.click('text=type instead')
    await p.fill('input[name=command]', text)
    await p.click('.assistant-input button[type=submit]')
  } else if (await p.$('input[name=command]')) await p.click('.assistant-input button[type=submit]')
  else await p.click('.chip-send')
  await p.waitForFunction((n) => document.querySelectorAll('.turn.assistant').length > n, before, { timeout: 90000 })
  return p.$$eval('.turn.assistant', (x) => x.at(-1).innerText)
}
