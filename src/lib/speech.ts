import type { Settings } from './db.ts'
import { groqTranscribe } from './groq.ts'
import { transcribe } from './openrouter.ts'

// Speech-to-text: the free Groq key first when the teacher added one, OpenRouter when there is none or Groq fails.
export async function speechToText(keys: Settings, audio: Blob, prompt?: string): Promise<string> {
  if (keys.groqKey) {
    try {
      return await groqTranscribe(keys.groqKey, audio, prompt)
    } catch (e) {
      console.warn('Groq failed, using OpenRouter', e)
    }
  }
  return transcribe(keys.openrouterKey, audio)
}
