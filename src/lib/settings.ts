import { db, type Settings } from './db.ts'

export async function getKeys(): Promise<Settings> {
  const saved = await db.settings.get('main')
  return { id: 'main', openrouterKey: saved?.openrouterKey ?? '', groqKey: saved?.groqKey ?? '' }
}

export async function saveKeys(openrouterKey: string, groqKey: string) {
  await db.settings.put({ id: 'main', openrouterKey: openrouterKey.trim(), groqKey: groqKey.trim() })
}

export class MissingKeysError extends Error {
  constructor() {
    super('Add your OpenRouter key in Settings first.')
  }
}

// Every AI action calls this first; screens catch MissingKeysError and send the teacher to Settings.
export async function requireKeys(): Promise<Settings> {
  const keys = await getKeys()
  if (!keys.openrouterKey) throw new MissingKeysError()
  return keys
}
