import { db, type Settings } from './db.ts'

export async function getKeys(): Promise<Settings> {
  return (await db.settings.get('main')) ?? { id: 'main', groqKey: '', geminiKey: '' }
}

export async function saveKeys(groqKey: string, geminiKey: string) {
  await db.settings.put({ id: 'main', groqKey: groqKey.trim(), geminiKey: geminiKey.trim() })
}

export class MissingKeysError extends Error {
  constructor() {
    super('Add your Groq and Gemini keys in Settings first.')
  }
}

// Every AI action calls this first; screens catch MissingKeysError and send the teacher to Settings.
export async function requireKeys(): Promise<Settings> {
  const keys = await getKeys()
  if (!keys.groqKey || !keys.geminiKey) throw new MissingKeysError()
  return keys
}
