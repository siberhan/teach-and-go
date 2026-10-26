// OpenRouter, called straight from the browser with the teacher's own key.
// One key for both: GPT-6 Luna for the thinking, Whisper large v3 for speech-to-text.
export const llm = { model: 'openai/gpt-6-luna' } // scripts may swap it to compare models
export const STT_MODEL = 'openai/whisper-large-v3'
const API = 'https://openrouter.ai/api/v1'

export interface Attachment {
  name: string
  mimeType: string
  data: Blob
}

export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  'X-Title': 'Teach&Go',
})

async function post(key: string, path: string, body: object): Promise<Response> {
  const res = await fetch(API + path, { method: 'POST', headers: headers(key), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res
}

// Luna reads PDFs and images directly.
async function attachmentPart(f: Attachment): Promise<object> {
  const url = `data:${f.mimeType};base64,${await toBase64(f.data)}`
  if (f.mimeType.startsWith('image/')) return { type: 'image_url', image_url: { url } }
  return { type: 'file', file: { filename: f.name, file_data: url } }
}

type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; required?: string[]; description?: string }

// Strict structured output needs every field required and nothing extra.
// Optional fields become "empty" (blank text, 0, empty list) and are removed again after the reply.
function strictSchema(s: Schema): object {
  if (s.type === 'array' && s.items) return { ...s, items: strictSchema(s.items) }
  if (s.type !== 'object' || !s.properties) return s
  const properties: Record<string, object> = {}
  for (const [k, v] of Object.entries(s.properties)) {
    const optional = !s.required?.includes(k)
    const empty = v.type === 'string' ? 'blank' : v.type === 'integer' ? '0' : v.type === 'object' ? 'blank text' : 'empty'
    properties[k] = strictSchema(optional ? { ...v, description: `${v.description ?? ''} If unknown or not needed: ${empty}.`.trim() } : v)
  }
  return { ...s, properties, required: Object.keys(s.properties), additionalProperties: false }
}

function dropEmpty(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropEmpty)
  if (!v || typeof v !== 'object') return v
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) {
    if (x === '' || x === 0 || x === null) continue
    if (x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((y) => y === '' || (Array.isArray(y) && !y.length))) continue
    out[k] = dropEmpty(x)
  }
  return out
}

const busy = (e: unknown) => /\b(429|502|503|504)\b|overloaded|timed? ?out/i.test(String((e as Error)?.message ?? e))

// Asks Luna for JSON that matches the schema. Reasoning is off: the tasks are short and the teacher is waiting.
// Retries once if the reply is not valid JSON, and up to 3 times when the provider is busy.
export async function askJson<T>(key: string, prompt: string, schema: object, files: Attachment[] = []): Promise<T> {
  const content = [{ type: 'text', text: prompt }, ...(await Promise.all(files.map(attachmentPart)))]
  const body = {
    model: llm.model,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_schema', json_schema: { name: 'reply', strict: true, schema: strictSchema(schema as Schema) } },
    reasoning: { effort: 'none' },
    // Only providers that enforce the JSON schema; the others return free text in the fields.
    provider: { require_parameters: true },
  }
  let lastError: unknown
  for (let attempt = 0, busyTries = 0; attempt < 2; attempt++) {
    let text: string
    try {
      const data = (await (await post(key, '/chat/completions', body)).json()) as { choices?: { message?: { content?: string } }[] }
      text = data.choices?.[0]?.message?.content ?? ''
    } catch (e) {
      if (!busy(e) || ++busyTries > 3) throw e
      await new Promise((r) => setTimeout(r, 1500 * busyTries))
      attempt--
      continue
    }
    try {
      return dropEmpty(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))) as T
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

// Speech-to-text for one FLAC part (a few minutes at most, so each request stays well under the provider's time limit).
export async function transcribe(key: string, audio: Blob): Promise<string> {
  const res = await post(key, '/audio/transcriptions', {
    model: STT_MODEL,
    input_audio: { data: await toBase64(audio), format: 'flac' },
  })
  return ((await res.json()) as { text: string }).text.trim()
}
