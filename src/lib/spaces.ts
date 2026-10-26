import { db, newId, type Space } from './db.ts'

export async function createSpace(name: string): Promise<Space> {
  const space: Space = { id: newId(), name: name.trim(), createdAt: Date.now() }
  await db.spaces.add(space)
  return space
}
