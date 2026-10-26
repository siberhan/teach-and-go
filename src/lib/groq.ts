// Groq Whisper speech-to-text, called straight from the browser with the teacher's key.
export async function transcribe(key: string, audio: Blob, prompt?: string): Promise<string> {
  const form = new FormData()
  form.append('file', audio, 'audio.flac')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('response_format', 'json')
  if (prompt) form.append('prompt', prompt)
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { text: string }).text.trim()
}
