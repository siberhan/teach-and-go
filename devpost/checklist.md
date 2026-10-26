---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. You can open the app and pick one of three interface designs**
  Becomes usable: A running Teach&Go app (`npm run dev`) with a design-options page showing the Start, Space and New recording screens in 3 different pastel styles side by side. After the learner picks one, its colors, font and spacing become `src/styles/tokens.css` and the real Start screen uses them.
  Why now: The PRD and scope say "interface first" — every later screen copies this template, so a wrong look found later would mean redoing every screen. Scaffolding (Vite, React, TypeScript, router) rides along here.
  PRD ref: `prd.md > Look and Feel`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Stack`, `spec.md > File Structure`
  Build: Scaffold React 19 + TypeScript + Vite at the repo root with HashRouter; add a `#/designs` page with 3 static options of the three key screens; after the pick, write `tokens.css` + `global.css` and build the real Start screen (Start and Settings buttons, empty notifications area) from them.
  Verify (mechanical): `npm run build` passes with no type errors; dev server starts; `#/designs` and `#/` load with no console errors (checked in a headless browser).
  Learner check: Open `http://localhost:5173/#/designs`, compare the three options on phone width and desktop width, and tell me which one you want (or what to mix).
  Commit: `Scaffold app and add chosen design tokens`

- [x] **2. You can save your keys, create spaces, and they are still there after closing**
  Becomes usable: Settings saves Groq and Gemini keys; Start → Spaces screen → "New space" asks only for a name and opens the new space; the Space screen shows the empty Thread card ("Set up this space or record a first lesson"). Everything survives a reload.
  Why now: The notebook (IndexedDB) is where the data model can first be wrong, and every later slice writes into it. Also answers the learner's open question about where data lives.
  PRD ref: `prd.md > Settings and API Keys`, `prd.md > Spaces`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Data Model`, `spec.md > Components` (Notebook, Settings and Keys, Screens)
  Build: Dexie `db.ts` with the spec's tables; `settings.ts` with `requireKeys()`; Settings, Spaces and Space screens; empty states ("No spaces yet", "New space, no lessons").
  Verify (mechanical): `npm run build` passes; headless browser script saves keys, creates two spaces, reloads, and confirms keys and both spaces load from IndexedDB.
  Learner check: Enter your keys, create a space with a student's name, close the tab, open it again — the space and keys are still there.
  Commit: `Add settings, spaces and local notebook`

- [x] **3. You can send a curriculum and confirm the plan the AI makes from it**
  Becomes usable: In Space settings, the composer takes a PDF/image and/or text; Gemini returns a short plan summary plus questions with confirm/correct buttons; confirming saves the plan (topics, dates or lesson days) to the space. A correction sends the plan back to Gemini and shows the updated one. Documents over 100 pages / 20 MB are rejected before sending.
  Why now: First real AI call — proves the unverified Gemini 3.5 Flash Lite model ID and low-thinking setting early. The kernel's deferred-topic matching needs a plan with topic IDs, so the plan must exist before lesson analysis.
  PRD ref: `prd.md > Space Setup (Space settings)`, `prd.md > The Core Journey` (steps 4-5)
  Spec ref: `spec.md > Components` (Gemini Calls, Composer), `spec.md > External Services and Dependencies` (Gemini, Document limit), `spec.md > Important Failure Modes`
  Build: `gemini.ts` with `buildPlan` and `revisePlan` (JSON schema, low thinking, one retry on bad JSON); Composer (file + text; mic comes in slice 5); Space settings screen with plan card and confirm/correct buttons; demo curriculum in `demo/`.
  Verify (mechanical): Node script calls `buildPlan` with the demo curriculum and the learner's key and checks the JSON has topics with IDs; `revisePlan` with a correction changes the plan; oversize file is rejected; `npm run build` passes.
  Learner check: Open your space → Space settings, attach the demo curriculum, read the AI's summary, press confirm (or send a correction) and check the plan looks right.
  Commit: `Turn uploaded curriculum into a confirmed plan`

- [x] **4. You upload a lesson recording and the space tells you where to start — and reminds you of the "explain later" topic**
  Becomes usable: New recording → upload an audio file → Lesson finished screen ("Lesson complete", length, loading) → in the background: convert to 16 kHz mono FLAC, split if over ~24 MB, Groq transcript, Gemini analysis → lesson saved with covered topics, stopping point and deferred topics → audio deleted. The Space screen's Thread card shows where to start and the deferred reminder when it fits the next topic. Lesson detail and Thread detail open on tap.
  Why now: This is the unique kernel. It also carries the two riskiest unknowns (FLAC encoder in the browser, Groq accepting it), so it comes right after the plan exists.
  PRD ref: `prd.md > Recording a Lesson`, `prd.md > Lesson Analysis and Memory`, `prd.md > The Thread Card`, `prd.md > Lesson Detail`, `prd.md > The Core Journey` (steps 6-9)
  Spec ref: `spec.md > Components` (Audio Pipeline, Transcription, Gemini Calls, Analysis Runner, Thread Logic), `spec.md > Data Model`, `spec.md > External Services and Dependencies` (Groq)
  Build: `audio/importFile.ts`, `audio/split.ts`, FLAC encoder wrapper; `groq.ts`; `analyzeLesson`; `analysis.ts` runner with `status` updates and audio deletion on success; `thread.ts` pure functions; New recording (upload part), Lesson finished, Space lesson list, Lesson detail, Thread detail screens; TTS demo lecture (our own AI-written script with an "I'll explain this later" line) in `demo/`.
  Verify (mechanical): Browser run with the demo lecture: transcript is non-empty, lesson ends `done` with the expected stopping point and the deferred topic, the `AudioBlob` row is gone; `thread.ts` checked with a small script (deferred topic shown only when its `topicId` is the next topic); `npm run build` passes.
  Learner check: In your space, upload the demo lecture, leave the finished screen, come back when the loading stops, and check the Thread card: right stopping point, and the "explain later" reminder.
  Commit: `Analyze uploaded lessons and show the thread card`

- [x] **5. You can record a lesson live, dictate notes, and nothing is lost when something fails**
  Becomes usable: One-tap live recording with a timer and stop button (16 kHz mono → FLAC); mic dictation in the composer; failed analysis shows "Free limit reached — try again later. Nothing was lost." with Retry; a lesson still analyzing when the app closes resumes on next start; missing keys send you to Settings with a short message.
  Why now: Builds on the working pipeline from slice 4 — same analysis path, new input — and closes the failure modes before polishing.
  PRD ref: `prd.md > Recording a Lesson`, `prd.md > States and Boundaries`, `prd.md > Space Setup (Space settings)` (dictation)
  Spec ref: `spec.md > Components` (Audio Pipeline `recorder.ts`, Analysis Runner, Composer, Settings and Keys), `spec.md > Important Failure Modes`
  Build: `audio/recorder.ts`; live mode on New recording screen; mic button in Composer using `transcribe`; failed state + Retry in lesson list; resume-on-start in `analysis.ts`; `requireKeys()` wired into every AI action.
  Verify (mechanical): Headless Chrome with a fake microphone (`--use-file-for-fake-audio-capture`) records and analysis finishes `done`; with a broken key the lesson becomes `failed` with the message and audio is kept, Retry with the right key succeeds; reload during analysis resumes; `npm run build` passes.
  Learner check: Record yourself for 30 seconds talking like a teacher, stop, and see the lesson analyzed. Then try the dictation mic in Space settings.
  Commit: `Add live recording, dictation, retry and resume`

- [x] **6. You see upcoming lessons, install the app, and anyone can try it from a public link**
  Becomes usable: Start screen notifications show upcoming lessons (tap → that space's plan); the Spaces list is sorted by nearest lesson; "Install app" works on phone and desktop; README, MIT LICENSE and a GitHub Pages workflow are ready.
  Why now: Uses the plans and lessons from earlier slices; finishing touches that need everything else to exist.
  PRD ref: `prd.md > Start Screen Notifications`, `prd.md > Spaces` (sorting), `prd.md > Screens and Layout` (installable)
  Spec ref: `spec.md > Components` (Thread Logic `upcomingLessons`), `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Stack` (vite-plugin-pwa)
  Build: `upcomingLessons` + notifications + sorting; vite-plugin-pwa with icons; Vite `base` for GitHub Pages; `.github/workflows/deploy.yml`; README with how to try it; LICENSE (MIT).
  Verify (mechanical): Script checks `upcomingLessons` ordering; `npm run build && npm run preview` serves a valid manifest and service worker; installed-app check of IndexedDB persistence in Chrome.
  Learner check: Install the app from Chrome, close it, open it from your desktop/phone, and check the upcoming lessons and your spaces are still there.
  Commit: `Add upcoming lessons, install support and deploy workflow`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1 (design pick shapes every screen) and after slice 4 (the kernel works with the demo lecture)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Recording keeps going when the teacher leaves the recording screen; a bottom bar shows it and leads back to it (learner feedback: going back deleted the recording)
- [ ] Recording can be paused and resumed (and discarded); paused time is not recorded and the result is still one lesson
- [ ] Start screen: upcoming lessons move into a notification menu instead of stacking at the top (learner feedback: many students would cover the screen)
- [ ] Schedule view: a timeline of when each topic will be taught, from the routine (learner: "ders programını göremiyoruz")
- [ ] The AI never guesses the routine; it asks, and every AI question offers tap-able options plus "write your own"
- [ ] A new document on an existing plan is never applied silently; with no clear instruction the AI asks what to do and taught topics stay
- [ ] Voice assistant on every screen, as a continuing conversation with a mic; confirmation before changes (open needs none)
- [ ] Bring your own OpenRouter key (GPT-6 Luna, reasoning off; Whisper large v3), optional free Groq key for speech with OpenRouter fallback
- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- App lives at the repo root, not in a `teach-and-go/` subfolder — the repo already holds `devpost/`, so the root is the project folder.
- Vite `base` is `./` instead of the repo name — relative paths work on GitHub Pages under any repo name with HashRouter.
- Design pick: option C "Peach Paper" (Lexend, peach + sky, crisp borders and paper shadows); the temporary `#/designs` page was removed after the pick.
- Added `scripts/check-pages.mjs` (playwright-core + installed Chrome) as the headless browser check used in mechanical verification.
- Gemini model ID is `gemini-3.5-flash-lite` and low thinking is `thinkingConfig.thinkingLevel: LOW` (verified against the docs and SDK types, and with a real call) — this was open in the spec.
- Lesson-day buttons appear on the plan card when the curriculum has no dates — the "How often are lessons?" question became tappable day buttons instead of a free-text reply, matching "simple buttons" in the PRD.
- Dev-only test keys live in git-ignored `.env.local`, read only by `scripts/` checks; the app still takes keys from Settings.
- FLAC encoder: `libflacjs` 5.6.0 (MIT) WASM build is vendored in `public/flac/` and runs in a classic Web Worker — it ships as an Emscripten UMD script, not a Vite-friendly module. Verified in Chrome: output starts with `fLaC` and Groq transcribes it correctly. FLAC at 16 kHz mono is ~1.2 MB/min, so lessons over ~20 min are split.
- Splitting re-encodes overlapping PCM ranges instead of cutting FLAC bytes — a FLAC file can't be cut at arbitrary bytes.
- `stoppingPoint` gained `topicFinished` — the Thread card needs to know whether the next lesson continues the same topic or starts the next one; without it, the deferred reminder could never match the following topic.
- Demo lecture audio is made with macOS `say` from our own script (`demo/lecture.txt`) for testing; a nicer TTS voice can replace it for the video.
- Desktop layout added at the slice-4 checkpoint (learner feedback: screens looked phone-only and empty on a computer) — from 900 px wide, a sidebar with spaces, New space and Settings stays open beside the screen; the Space screen puts the Thread card and lessons side by side; the composer sits under the content instead of at the bottom. Phone layout is unchanged.
- Desktop follow-up (learner feedback): content is left-aligned next to the sidebar, and the back arrow is hidden on the Spaces and Space screens on desktop (the sidebar does that job); deeper screens keep it.
- Encoding to FLAC now runs after the "Lesson complete" screen opens — long lessons take seconds to encode, and the teacher shouldn't wait on the recording screen.
- Failure messages are split by cause: missing keys, free limit (429/quota), or other errors — all say "Nothing was lost." and keep the audio for Retry.
- Slice-4 hands-on checkpoint: learner tried the app on desktop and asked for the desktop layout and a dictation mic (both done); they have not yet tried plan creation and lesson analysis themselves — still open.
- Slice 6: install support uses vite-plugin-pwa (manifest, service worker, offline start) with app icons generated by `scripts/make-icons.mjs`; the GitHub Pages workflow builds with Node 22; LICENSE is MIT under the git author name; check scripts accept a `BASE` env var so they also run against the production preview.
- Final review: the learner asked for a voice assistant that changes the app on command. Recorded as a stretch goal in `scope.md > Later` and `prd.md > Stretch Goals Added During the Build` — outside the original POC, added because the kernel was done. Single request + confirmation card, no agent loop: fewer tokens, more reliable, fits the remaining time before the deadline.
- The day-toggle buttons on the plan card were replaced by a routine the AI asks about with options (learner: tutors teach every day, every N days, twice a day, mornings or evenings — never guess). `Plan.schedule` holds weekly slots with times or "every N days", plus a start date; old `lessonDays` plans are still read. `buildPlan`/`revisePlan` became one `planTurn` request per teacher message.
- Moved from Gemini + Groq free keys to the teacher's own OpenRouter key (learner's decision: free tiers were overloaded during testing, 503s and timeouts). Models measured with `scripts/compare-models.mjs`: MiMo-V2.6-Flash failed the routine check; GPT-6 Luna passed in less time and for less money, so it is the model. Luna's lowest setting `reasoning.effort: 'none'` still passes every check. Schemas are sent in strict form (all fields required, empties removed after) — without it, models skipped or overfilled optional fields.
- Optional Groq key (learner's request): speech-to-text uses Groq's free `whisper-large-v3` when a Groq key is set, and falls back to OpenRouter's `openai/whisper-large-v3` on any Groq error (`scripts/check-speech.mjs`).
- Audio is split into ~5-minute parts with 3 s overlap (was: only over 24 MB) so each speech request stays far under the providers' time limits.
- Measured cost of a 30-minute lesson: ≈ $0.015 (Whisper ≈ $0.014 + analysis ≈ $0.001).
