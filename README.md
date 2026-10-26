# Teach&Go

**Teach and go. We keep the thread.**

Teach&Go remembers where each lesson stopped — and every "I'll explain this later" — so a tutor or teacher starts the next lesson exactly where they left off.

**Try it:** https://siberhan.me/teach-and-go/ (bring your own OpenRouter key, entered in Settings).

1. Create a **space** for a student or a class.
2. Send your curriculum (PDF, photo or a short note) in the plan conversation, by voice or text. The AI turns it into a plan and asks about your lesson routine instead of guessing it.
3. Tap **record** at the start of a lesson (or upload a recording).
4. Next time you open the space, the **thread card** tells you where to start — and reminds you of a postponed topic when today's lesson is the right time for it.

## Privacy

- There is no server. Spaces, plans and lesson memory live in your browser (IndexedDB), on your own device.
- Raw lesson audio is kept only until the analysis succeeds, then deleted. Uploaded documents are never stored — only the plan made from them.
- You bring your own OpenRouter API key (about $0.015 per 30-minute lesson); it stays on your device.

## Try it

You need an [OpenRouter](https://openrouter.ai/settings/keys) key. Enter it in **Settings**. Optionally add a free [Groq](https://console.groq.com/keys) key: speech-to-text then runs on Groq's free tier, and falls back to OpenRouter if Groq fails.

Run locally (Node.js 20+):

```bash
npm install
npm run dev
# open http://localhost:5173
```

Demo material we wrote ourselves is in [`demo/`](demo): a sample curriculum (`curriculum.pdf`) and a short lecture (`lecture.m4a`, from `lecture.txt`) that contains an "I'll explain that later" moment.

Install it like an app: in Chrome, use **Install app** in the address bar (desktop) or **Add to Home screen** (phone).

## How it works

- **React + TypeScript + Vite**, installable as a PWA.
- **Whisper large v3** turns lesson audio into text — through [OpenRouter](https://openrouter.ai), or Groq's free tier first if you add a Groq key. Audio is recorded as 16 kHz mono FLAC in the browser ([libflac.js](https://github.com/mmig/libflac.js), MIT) and split into overlapping ~5-minute parts.
- **GPT-6 Luna** (through OpenRouter, reasoning off, strict JSON output) reads the curriculum once into a plan, asks about your routine instead of guessing it, and after each lesson returns covered topics, the stopping point and postponed topics — each linked to a plan topic.
- A **voice assistant** on every screen: a small agent that uses the app's tools (create, open, rename, plan, record, delete after a tap) and answers in your language.
- The thread card is computed locally with no AI call: the next planned topic plus any postponed topic linked to it.

Code map: screens in `src/screens/`, logic in `src/lib/` (`analysis.ts` runs the background lesson analysis, `thread.ts` builds the thread card), planning docs in `devpost/`.

## Deploy

Push to `main` on GitHub with Pages set to "GitHub Actions" — `.github/workflows/deploy.yml` builds and publishes `dist/`.

## Development checks

`scripts/` holds the browser checks used while building (they use your installed Chrome). Checks that call the AI read test keys from a git-ignored `.env.local` (`OPENROUTER_KEY=…`, optional `GROQ_KEY=…`).

## License

MIT
