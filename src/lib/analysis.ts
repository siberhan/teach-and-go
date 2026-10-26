import { db, newId, type Lesson } from './db.ts'
import { analyzeLesson } from './gemini.ts'
import { transcribe } from './groq.ts'
import { requireKeys } from './settings.ts'
import { lastDoneLesson, openDeferred } from './thread.ts'
import { fileToPcm } from './audio/importFile.ts'
import { SAMPLE_RATE, toFlacParts } from './audio/split.ts'

const running = new Set<string>()

// Saves the lesson audio (temporarily) and starts the background analysis.
// Runs outside React, so it keeps going while the teacher moves between screens.
export async function startLessonFromPcm(spaceId: string, pcm: Float32Array): Promise<Lesson> {
  const lesson: Lesson = {
    id: newId(),
    spaceId,
    createdAt: Date.now(),
    durationSec: Math.round(pcm.length / SAMPLE_RATE),
    status: 'analyzing',
  }
  await db.lessons.add(lesson)
  const parts = await toFlacParts(pcm)
  await db.audio.put({ lessonId: lesson.id, parts })
  void runAnalysis(lesson.id)
  return lesson
}

export async function startLessonFromFile(spaceId: string, file: Blob): Promise<Lesson> {
  return startLessonFromPcm(spaceId, await fileToPcm(file))
}

export async function runAnalysis(lessonId: string) {
  if (running.has(lessonId)) return
  running.add(lessonId)
  try {
    const lesson = await db.lessons.get(lessonId)
    const audio = await db.audio.get(lessonId)
    if (!lesson || !audio) return
    await db.lessons.update(lessonId, { status: 'analyzing', error: undefined })
    const keys = await requireKeys()

    // Each part gets the end of the previous text as context, so cuts don't lose meaning.
    let transcript = ''
    for (const part of audio.parts) {
      const text = await transcribe(keys.groqKey, part, transcript.slice(-200) || undefined)
      transcript += (transcript ? ' ' : '') + text
    }

    const space = await db.spaces.get(lesson.spaceId)
    const earlier = (await db.lessons.where('spaceId').equals(lesson.spaceId).toArray()).filter((l) => l.id !== lessonId)
    const open = openDeferred(earlier)
    const memory = await analyzeLesson(keys.geminiKey, space?.plan, lastDoneLesson(earlier)?.stoppingPoint, open, transcript)

    const topicIds = new Set(space?.plan?.topics.map((t) => t.id))
    const validTopic = (id?: string) => (id && topicIds.has(id) ? id : undefined)
    await db.transaction('rw', db.lessons, db.audio, async () => {
      await db.lessons.update(lessonId, {
        status: 'done',
        covered: memory.covered,
        stoppingPoint: { ...memory.stoppingPoint, topicId: validTopic(memory.stoppingPoint.topicId) },
        deferred: memory.deferred.map((d) => ({ id: newId(), text: d.text, topicId: validTopic(d.topicId) })),
      })
      for (const l of earlier) {
        if (!l.deferred?.some((d) => memory.resolvedDeferredIds.includes(d.id))) continue
        await db.lessons.update(l.id, {
          deferred: l.deferred.map((d) => (memory.resolvedDeferredIds.includes(d.id) ? { ...d, resolved: true } : d)),
        })
      }
      // Privacy promise: raw audio is deleted as soon as the analysis succeeds.
      await db.audio.delete(lessonId)
    })
  } catch (e) {
    console.warn('analysis failed', e)
    await db.lessons.update(lessonId, { status: 'failed', error: 'Free limit reached — try again later. Nothing was lost.' })
  } finally {
    running.delete(lessonId)
  }
}
