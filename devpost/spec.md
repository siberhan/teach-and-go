---
doc: spec
status: approved
---

# Teach&Go — Technical Spec

## How This Works, In Plain Language
Teach&Go is a website that runs entirely in the teacher's browser. There is **no server of ours**.

- **The app** (React) draws the screens. It can be installed like an app on a phone or computer.
- **The notebook** (IndexedDB) is a small database the browser keeps for this site, on the teacher's own device. Spaces, plans, lesson memory and the teacher's API keys live there. Cookies are too small (about 4 KB), so we don't use them.
- **The ears** (Whisper large v3) turn speech into text. Lesson audio is recorded at 16 kHz mono and saved as FLAC, which keeps files small. After the lesson it is split into parts of about 5 minutes. Each part keeps the last few seconds of the part before it, so no context is lost at the cut. If the teacher added a free **Groq** key, Groq runs it; otherwise, or if Groq fails, **OpenRouter** runs the same model.
- **The brain** (GPT-6 Luna through OpenRouter, reasoning off) reads text and documents and answers with structured data (JSON). There is no agent framework, only direct calls.

*Changed during the build:* the first version used Gemini 3.5 Flash Lite and Groq with free keys. Free tiers were often busy (503 errors) during testing, so the app moved to one **OpenRouter** key the teacher brings (see Revisions in `checklist.md`).

When a document is uploaded, the AI reads it **once** and turns it into a plan (a list of topics and dates). After that, only this short plan is sent, never the document again. When a lesson ends, the transcript plus the plan go to the AI. It returns what was covered, where the lesson stopped, and any "I'll explain this later" topics, each linked to the plan topic it belongs to. When the teacher opens a space, the app looks at the next planned topic and shows the stopping point plus any deferred topic linked to that next topic. That last step needs no AI call.

Why this shape: no server means nothing to host or pay for, each teacher's data stays on their own device (privacy), and the app can be published free on GitHub Pages.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. Teacher opens the site → the app reads the notebook → the Start screen shows upcoming lessons, calculated from each space's plan.
2. Settings → keys are saved in the notebook.
3. Start → Spaces screen lists spaces from the notebook, sorted by next lesson date → New space saves `{name}` and opens it.
4. Space settings → the teacher attaches a PDF or image and/or types or dictates text. Dictation: audio → Whisper → text in the box. Send → the AI gets the file plus the text → returns a plan and at most one question with tap-able options → shown with Confirm/Cancel.
5. Confirm → plan saved in the notebook. Any later message → current plan plus the message → the AI → updated plan (or a question).
6. New recording → the microphone records 16 kHz mono audio, or the teacher picks an audio file, which is converted to 16 kHz mono. Saved as a temporary FLAC in the notebook, and a lesson is created with `status: analyzing`.
7. Lesson finished screen shows the duration. In the background: split into ~5-minute parts → each part to Whisper (Groq first if a Groq key is set, with the previous part's last words as context) → one transcript → the AI (plan + previous stopping point + open deferred topics + transcript) → memory JSON.
8. Memory is saved → **audio deleted** → lesson `status: done`. The lesson list updates.
9. Opening the space → the Thread card is calculated locally: stopping point + deferred topics whose `topicId` is the next planned topic.

## Stack
- **React 19 + TypeScript + Vite** — learner agreed: common, works well with parallel AI agents. [react.dev](https://react.dev), [vite.dev](https://vite.dev)
- **React Router (HashRouter)** — page navigation; hash URLs work on GitHub Pages without server config. [reactrouter.com](https://reactrouter.com)
- **vite-plugin-pwa** — "Install app" (manifest + service worker). [vite-pwa-org.netlify.app](https://vite-pwa-org.netlify.app)
- **Dexie** — simple wrapper around IndexedDB. [dexie.org](https://dexie.org)
- **OpenRouter REST API** via `fetch` — chat completions with strict JSON schema output, and audio transcriptions. [openrouter.ai/docs](https://openrouter.ai/docs)
- **Groq REST API** via `fetch` (`multipart/form-data`), optional. [console.groq.com/docs/speech-to-text](https://console.groq.com/docs/speech-to-text)
- **FLAC encoder in the browser** — `libflacjs` 5.6.0 (WebAssembly, MIT).
- **Plain CSS with CSS variables** for the design tokens (colors, font, spacing) chosen in the interface step.

Verify early in the build (could change the plan):
1. ~~Groq API accepts calls straight from the browser (CORS).~~ **Verified 2026-10-26.** No proxy needed.
2. ~~Model ID and thinking setting~~ — verified (see Decisions).
3. ~~The FLAC encoder works in the browser and its output is accepted~~ — verified with Groq and OpenRouter.

## Where It Runs and How Someone Tries It
- Runs in any modern browser (Chrome recommended for the demo). Needs Node.js 20+ for development.
- The user needs their own **OpenRouter** API key (and optionally a free **Groq** key), entered in Settings. No `.env` file and no keys in the repo.
- Local: `npm install` → `npm run dev` → open `http://localhost:5173`.
- **Deploy (learner's choice): GitHub Pages**, a free public link. Build with `npm run build`, publish `dist/` with a GitHub Actions workflow. Set Vite `base` to the repo name.
- Demo recording: create a space, upload a curriculum, confirm the plan, upload the TTS lecture on the New recording screen, wait for analysis, reopen the space to show the Thread card with the stopping point and the deferred reminder.
- Submission also needs the demo video (English or English subtitles) and a public repo with an open-source license (e.g. MIT).

## Look and Feel
From `prd.md > Look and Feel`:
- A soft **pastel** palette: one calm background, one or two pastel accents, dark readable text. Strong contrast for text.
- **One aesthetic but very readable font** (candidates to try in the design options: a rounded or humanist sans serif from Google Fonts).
- Spacious, calm, very little text, one obvious main action per screen. Large touch targets for phone use.
- Short, friendly interface text. No "AI slop": no gradients-everywhere, no emoji clutter, no dense dashboards.
- **First build step:** 2–3 interface options for the key screens (Start, Space, New recording). The learner picks one; its tokens go into `src/styles/tokens.css` and every screen uses them.

## Components

### Screens (`src/screens/`)
One file per screen in `prd.md > Screens and Layout`: Start, Settings, Spaces, Space, SpaceSettings, NewRecording, LessonFinished, LessonDetail, ThreadDetail. Screens only read and write through `src/lib/` and never call APIs directly.

### Notebook — local storage (`src/lib/db.ts`)
Dexie database; see **Data Model**. Implements `prd.md > States and Boundaries` (persistence).

### Settings and Keys (`src/lib/settings.ts`)
Read and save keys (OpenRouter required, Groq optional); `requireKeys()` sends the user to Settings with a message if the OpenRouter key is missing.
PRD ref: `prd.md > Settings and API Keys`.

### Audio Pipeline (`src/lib/audio/`)
- `recorder.ts` — microphone → 16 kHz mono PCM (Web Audio) → FLAC.
- `importFile.ts` — uploaded audio file → decode → resample to 16 kHz mono → FLAC.
- `split.ts` — after recording: split into ~5-minute FLAC parts with ~3 s overlap, so each speech-to-text request stays far under the providers' time and size limits.
PRD ref: `prd.md > Recording a Lesson`.

### Transcription (`src/lib/speech.ts`, `groq.ts`, `openrouter.ts`)
`speechToText(keys, blob, prompt?)` → text. Groq first when the teacher added a Groq key, OpenRouter when there is none or Groq fails. Used for lessons (part by part; on Groq, `prompt` = last ~200 characters of the previous part's text, for continuity) and for dictation.

### AI Calls (`src/lib/ai.ts`, transport in `src/lib/openrouter.ts`)
Each function is one request with a strict JSON schema, reasoning off:
- `planTurn(plan?, taught, files, message, asked?)` → plan + at most one question with options. Builds, changes or only asks. PRD ref: `prd.md > Space Setup (Space settings)`.
- `analyzeLesson(plan, lastStop, openDeferred, transcript)` → `LessonMemory`. PRD ref: `prd.md > Lesson Analysis and Memory`.
`openrouter.ts` turns each schema into strict form (every field required, empty values removed after the reply), because some models skip optional fields otherwise.

### Assistant Agent (`src/lib/agent.ts`)
`runAgent(key, history, said, env)` runs a tool loop with the Vercel AI SDK (`ai` + `@openrouter/ai-sdk-provider`, GPT-6 Luna, reasoning off, at most 8 steps). Tools: `read_space`, `create_space`, `open_space`, `rename_space`, `set_topics`, `set_routine`, `start_recording`, `delete_space`. Tools write to Dexie directly; `delete_space` only returns a pending delete that the panel confirms. Taught topics cannot be removed (`set_topics` rejects it). The model sees what is on screen and one line per space; the conversation history stays until the panel closes. PRD ref: `prd.md > Stretch Goals Added During the Build`.

### Analysis Runner (`src/lib/analysis.ts`)
Runs steps 7–8 of the journey for one lesson and updates `lesson.status`. It keeps running while the teacher moves between screens. When the app starts, any lesson still `analyzing` with audio saved is resumed. On error: `status: failed` + message; audio is kept for **Retry**.

### Thread Logic (`src/lib/thread.ts`)
Pure functions with no AI: `nextTopic(plan, lastStop)`, `threadCard(space)` → stopping point + deferred topics where `topicId === nextTopic.id`, `upcomingLessons(spaces)` for notifications and sorting.
PRD ref: `prd.md > The Thread Card`, `prd.md > Start Screen Notifications`, `prd.md > Spaces`.

### Composer (`src/components/Composer.tsx`)
Attach file (PDF/image), text box, mic button (dictation via Whisper). Checks the document limit before sending.

## Data Model
All in IndexedDB (Dexie). Everything persists between visits except audio.

```ts
Settings  { id: 'main', openrouterKey, groqKey? }
Space     { id, name, createdAt, plan?: Plan }
Plan      { summary, lessonDays?: string[] /* e.g. ['Mon','Thu'] */,
            topics: { id, title, date?: string }[] }
Lesson    { id, spaceId, createdAt, durationSec,
            status: 'analyzing' | 'done' | 'failed', error?,
            covered?: string[],              // short, few words each
            stoppingPoint?: { text, topicId? },
            deferred?: { id, text, topicId? }[] } // "I'll explain this later"
AudioBlob { lessonId, parts: Blob[] }        // temporary; deleted when analysis succeeds
```
- Stopping point and deferred topics are stored separately (`prd.md > Product Decisions`).
- The space's **open deferred topics** = all `deferred` from its lessons that a later analysis did not mark as covered. `analyzeLesson` returns `resolvedDeferredIds`, which we save as `resolved: true`.
- Document files are **not** stored. Only the plan made from them is.

## File Structure
```
teach-and-go/
├── index.html
├── vite.config.ts            # base path for GitHub Pages + PWA plugin
├── public/                   # app icons, manifest assets
├── src/
│   ├── main.tsx              # app start, router
│   ├── App.tsx               # routes for all screens
│   ├── styles/
│   │   ├── tokens.css        # colors, font, spacing from the chosen design
│   │   └── global.css
│   ├── screens/              # one file per screen (see Components > Screens)
│   ├── components/           # Composer, ThreadCard, LessonRow, Button, Loading...
│   └── lib/
│       ├── db.ts             # Dexie notebook
│       ├── settings.ts
│       ├── ai.ts             # prompts + schemas: plan, lesson memory
│       ├── agent.ts          # assistant: tool loop over the app's actions
│       ├── openrouter.ts     # chat + transcription requests
│       ├── groq.ts           # optional free speech-to-text
│       ├── speech.ts         # Groq first, OpenRouter fallback
│       ├── schedule.ts       # routine → lesson dates (no AI)
│       ├── analysis.ts       # background lesson analysis
│       ├── thread.ts         # thread card + upcoming lessons (no AI)
│       └── audio/            # recorder, importFile, split, flac encoder wrapper
├── demo/                     # TTS demo lecture script + sample curriculum
├── .github/workflows/deploy.yml  # GitHub Pages
├── LICENSE                   # MIT
├── README.md
└── devpost/                  # planning docs
```

## External Services and Dependencies

### OpenRouter — AI and speech to text (required key)
- Chat: `POST https://openrouter.ai/api/v1/chat/completions`, model `openai/gpt-6-luna`, `reasoning: { effort: 'none' }`, `response_format: json_schema` (strict), `provider.require_parameters: true`. PDFs and images are sent inline (base64 data URLs).
- Speech: `POST https://openrouter.ai/api/v1/audio/transcriptions`, model `openai/whisper-large-v3`, JSON body `{ input_audio: { data, format: 'flac' } }` → `{ text }`.
- Prices (2026-10-26): Luna $0.10 / M input, $0.50 / M output tokens; Whisper large v3 about $0.0000075 per audio second (more if routed to another provider).
- **Cost of a 30-minute lesson:** Whisper ≈ 1,800 s × $0.0000075 ≈ $0.014; analysis ≈ 9k input + 0.5k output tokens ≈ $0.001. **≈ $0.015 per lesson.** A plan from the demo PDF plus three changes cost $0.0008 in testing.
- Model choice was measured during the build (`scripts/compare-models.mjs`): MiMo-V2.6-Flash failed the routine check; GPT-6 Luna passed it faster and cheaper.

### Groq — Free speech to text (optional key)
- `POST https://api.groq.com/openai/v1/audio/transcriptions`, header `Authorization: Bearer <groqKey>`; form fields `file` (FLAC), `model` = `whisper-large-v3`, optional `prompt`, `response_format=json`.
- Free limits (learner's screenshot): 20 req/min, 2,000 req/day, 7,200 audio s/hour, 28,800 audio s/day; 25 MB per file. Any error → the same part goes to OpenRouter.

### Document limit
At most **100 pages or 20 MB** per document (PDF or image). Checked in the browser before sending.

## Important Failure Modes
- **Missing key** → message plus a link to Settings; nothing is sent.
- **Out of credit / rate limit / network or API error during analysis** → lesson `failed` with a matching message ("Your OpenRouter credit ran out…", "Too many requests…") ending in "Nothing was lost." plus Retry (audio kept until success). A busy provider is retried automatically up to 3 times.
- **Document over the limit** → rejected before sending: "Document too long — upload only the curriculum pages (max 100 pages / 20 MB)."
- **App closed during analysis** → on next start, the lesson is resumed from the saved audio.
- **The AI returns invalid JSON** → one automatic retry, then `failed` with Retry.

## What Was Simplified and Why
- **No server** instead of a backend — nothing to host. Tradeoff: keys live in the browser, which is fine because they are the user's own keys on their own device.
- **No agent framework** instead of pi agent — fewer tokens, simpler code (learner's decision).
- **Deferred matching done by the AI once per lesson** (linking each deferred topic to a plan topic) instead of an extra AI call when a space opens — fewer requests.
- **Splitting audio only after the lesson** instead of during recording (learner's decision).
- **Installable website** instead of native apps (`prd.md > Deferred From the POC`).

## Decisions and Open Issues
Learner decisions:
- Whisper large v3 for speech, GPT-6 Luna (reasoning off) for reading and analysis, through the user's own OpenRouter key; an optional free Groq key is used first for speech. (Changed during the build from Groq + Gemini free keys.)
- FLAC, 16 kHz, mono; split into short overlapping parts after the lesson.
- Document read once into a plan; the document itself is never re-sent or stored.
- Data in IndexedDB on the device, no server.
- React + Vite + TypeScript (accepted recommendation).
- GitHub Pages for a public link.
- Document limit 100 pages / 20 MB (accepted recommendation).

Implementation details derived from these: Dexie, HashRouter, vite-plugin-pwa, `prompt` continuity between audio parts, audio kept until analysis succeeds (resolves `prd.md > Open Questions` — privacy promise kept: audio deleted as soon as analysis succeeds).

Learner uncertainty discussed: **where data lives on the device** ("cookie olarak mı tutuluyor?"). Clarified: cookies are ~4 KB and are sent to servers; IndexedDB is the browser's own local database for the site, works in the installed app, and fits our data. Check during build: close and reopen the installed app and see that spaces and lessons are still there.

Open, check early in the build:
1. ~~Groq CORS from the browser~~ — verified OK (see Stack).
2. ~~Model ID + thinking setting~~ — resolved: `openai/gpt-6-luna`, `reasoning.effort: 'none'` (verified with real calls).
3. ~~FLAC encoder library choice~~ — `libflacjs` 5.6.0, verified with real transcriptions.
