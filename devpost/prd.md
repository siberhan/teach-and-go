---
doc: prd
status: approved
---

# Teach&Go — Product Requirements

**Teach and go. We keep the thread.**
An open-source, free web app that remembers where each lesson stopped and the "I'll explain this later" promises, so a tutor or teacher starts the next lesson exactly where they left off.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`.

1. The teacher opens Teach&Go. The **Start screen** shows a Start button, a Settings button, and notifications at the top (upcoming lessons).
2. First time: they open **Settings** and enter their own OpenRouter API key (and, optionally, a free Groq key for speech-to-text).
3. They tap **Start** → the **Spaces screen**: their spaces listed top to bottom, the one with the nearest upcoming lesson on top. They tap **New space** and type a name (e.g. a student's name or a class name).
4. Inside the new space they open **Space settings** and send what the AI needs: a document (e.g. a curriculum), a screenshot or photo, and/or text (typed or dictated by voice).
5. The AI replies with its understanding of the plan and asks simple confirmation questions with buttons ("Is this your curriculum?", "How often are lessons?", "Should I make a lesson plan?"). The teacher confirms or sends a correction.
6. At the start of a lesson, the teacher taps **New recording** inside the space. On the New recording screen they either record live (starts with one tap) or upload a pre-recorded audio file.
7. They tap stop (or the upload finishes). The **Lesson finished** screen shows "Lesson complete" and the lesson length, with a loading indicator while analysis runs in the background. They can wait or leave.
8. When analysis finishes, the raw audio is deleted. The lesson appears at the top of the space's lesson list.
9. Next time they open the space, the **Thread card** at the top says where to start — and, if a deferred "I'll explain this later" topic fits this lesson's topic, reminds them.

Success: step 9 shows the correct stopping point and the correct deferred-topic reminder for the demo lecture.

## Screens and Layout

1. **Start screen** — Start button, Settings button, notifications at the top (upcoming lessons; tapping one shows the plan).
2. **Settings** — OpenRouter key field, plus an optional Groq key field.
3. **Spaces screen** — list of spaces, top to bottom, nearest upcoming lesson first. "New space" button.
4. **Space screen** — Thread card on top; "New recording" button; lesson list below (newest first, an in-progress analysis shows on top with a loading indicator); entry to Space settings.
5. **Space settings** — space details plus a single composer to send documents, screenshots, photos and text/voice-dictated text to the AI; AI replies with plan confirmation buttons.
6. **New recording screen** — two choices: record live (timer, stop button) or upload a pre-recorded audio file.
7. **Lesson finished screen** — "Lesson complete", lesson length, background analysis indicator.
8. **Lesson detail** — opened from the lesson list.
9. **Thread card detail** — opened by tapping the Thread card.

Works the same on phone and computer (responsive). It is a website that can be installed as an app ("Install app") on phone or desktop.

## Look and Feel
- Simple pastel color palette.
- An aesthetic font that is still very easy to read.
- Calm, minimal, few buttons, little text, one obvious next step — "as if every user has ADHD".
- Avoid: generic "AI slop" styling, text everywhere, cluttered dashboards.
- Process: before building screens, the agent designs 2–3 different interface options from this PRD; the learner picks one and it becomes the template for every screen.

## Features and Behavior

### Settings and API Keys
The teacher brings their own OpenRouter key; a lesson costs about 1.5 cents of their own credit, and the app itself stays free and open source. An optional free Groq key runs speech-to-text at no cost, with OpenRouter as the automatic fallback. *(Changed during the build from free Groq + Gemini keys — see Stretch Goals.)*
- [ ] Keys entered in Settings are remembered after closing and reopening the app.
- [ ] Without keys, any AI action sends the teacher to Settings with a short message instead of failing silently.

### Spaces
A space is one student or one class, with its own memory.
- [ ] Creating a space asks only for a name, then opens the new space.
- [ ] Spaces are listed with the nearest upcoming lesson on top.
- [ ] Each space's memory is separate: lessons in one space never appear in another.

### Space Setup (Space settings)
Source: `scope.md > The Core Loop` step 2. Not a free chatbot: one composer, short AI replies.
- The composer accepts: a document, a screenshot, a photo, and text. Text can be typed or dictated (voice becomes text before sending). Any of these alone or together.
- [ ] Sending a curriculum document returns the AI's short summary of the plan with confirm/correct buttons.
- [ ] If the curriculum has dates, the AI uses them; if not, it asks how often lessons happen and offers to make a plan.
- [ ] A document over the size limit is rejected with a clear message (e.g. "Document too long — upload only the curriculum pages").
- [ ] After confirmation, the plan (topics, and lesson days if known) is saved to the space and used to order spaces and show notifications.

### Recording a Lesson
- [ ] On the New recording screen, tapping record starts recording immediately; a timer is visible.
- [ ] The teacher can instead upload a pre-recorded audio file; it goes through the same analysis as a live recording (this is also how the TTS demo lecture is fed in).
- [ ] Tapping stop (or finishing an upload) shows "Lesson complete" with the lesson length and a loading indicator.
- [ ] The teacher can leave this screen; analysis continues, and the lesson shows on top of the space's list with a loading indicator.

### Lesson Analysis and Memory
Source: `scope.md > The Unique Kernel`.
After the lesson ends, the AI reads the lesson text against the plan and saves three separate things:
1. **Covered topics** — short, a few words each (short on purpose, to save tokens).
2. **Stopping point** — where the lesson stopped; this matters for the next lesson.
3. **Deferred topics** — things the teacher said they would explain later. Stored separately from the stopping point, because they may belong to a different, later lesson.
- [ ] For the demo lecture, the lesson detail shows the right covered topics and stopping point.
- [ ] The "I'll explain this later" sentence in the demo lecture appears as a deferred topic.
- [ ] Raw audio is deleted as soon as the analysis succeeds; it is never kept after that.

### The Thread Card
- [ ] Opening a space shows a card at the top: where the next lesson starts.
- [ ] If a deferred topic matches the topic of the upcoming lesson in the plan, the card also reminds about it.
- [ ] A deferred topic that does not match the upcoming lesson is not shown on the card; it waits for the lesson it matches.
- [ ] Tapping the card shows a more detailed view.

### Lesson Detail
- [ ] Shows covered topics (short), the stopping point, and any deferred topics from that lesson.

### Start Screen Notifications
- [ ] Shows upcoming lessons from spaces that have lesson days; tapping one shows that space's plan.

## States and Boundaries
- **First use, no keys** — Settings is the first stop; AI actions point there.
- **No spaces yet** — Spaces screen shows only "New space".
- **New space, no lessons** — Thread card invites setup or a first recording instead of showing a stopping point.
- **Analysis running** — loading indicator on the finished screen and on top of the lesson list.
- **Analysis failed / out of credit / too many requests** — the lesson shows a short error that names the cause and ends with "Nothing was lost.", plus a retry.
- **Document too long** — rejected with a clear message.
- **Persistence** — spaces, plans, lessons and memory stay after closing the app. Raw audio does not.

## Product Decisions
- Name **Teach&Go**, slogan "Teach and go. We keep the thread." — learner's choice.
- **No agent framework** (pi agent dropped). Simple, direct AI calls with low thinking effort — fewer tokens, so free limits go further. Supersedes the pi agent note in `scope.md > Inspiration & Identity`.
- **Bring your own OpenRouter key (optional free Groq key)** — keeps the app free and open source, with no server and no shared bill.
- **Composer instead of a chatbot** — avoids long conversations that use up free limits.
- **Document size limit** — big documents are rejected rather than breaking free limits.
- **Short covered-topics summaries** — output tokens cost too.
- **Stopping point and deferred topics stored separately** — the stopping point is for the next lesson; deferred topics may belong to a later one.
- **Analysis after the lesson, not live** — enough for the proof.
- **Live recording or audio-file upload** on the New recording screen — lets teachers use existing recordings and lets the demo use the TTS lecture.
- **Installable website instead of native/desktop apps** — learner agreed this is enough.
- **Interface first** — 2–3 designs from this PRD, learner picks the template, then the backend.

## What We're Building
Everything in **Features and Behavior** above, on the screens in **Screens and Layout**, demonstrated with an AI-written lecture turned into audio with text-to-speech (`scope.md > What "Working" Looks Like`).

## Deferred From the POC
- **Native desktop apps** (Windows/macOS/Linux) and app-store mobile apps — the installable website covers phone and desktop.
- **Live listening during the lesson** — after-lesson analysis is enough.
- **Accounts, login, sharing between teachers** — memory lives on the teacher's own device for now.

## Stretch Goals Added During the Build
None of these were in the original POC — they were kept out so the kernel (the thread between lessons) came first. Once the kernel worked end to end and time allowed, the learner's own hands-on testing at final review turned up each of them, and they were added. Each one has its own browser check in `scripts/`.

- **A recording that never gets lost** — the teacher can leave the recording screen to read last lesson's notes; recording keeps going, and a bar at the bottom of every screen shows the time and leads back. **Pause / Resume** for breaks.
- **One bell for upcoming lessons** — a teacher with many students got a stack of notices on the Start screen; they are now one notification menu with a count.
- **The routine is never guessed** — tutors teach every day, every few days, twice a day, mornings or evenings. The AI fills only what the document or the teacher says; if the routine is unknown, it asks. Weekly slots with times, "every N days", twice a day, and a start date are all supported.
- **Questions as options, not chat** — every AI question comes with 2–4 tap-able answers (A, B, C…) and the teacher can still write their own. Fast on a phone, fewer tokens, no free-form chat.
- **Safe new documents** — adding a new PDF to a space that already has a plan never overwrites it silently. The AI gets the current plan, what was already taught, and the new document; with no clear instruction it leaves the plan as it is and asks what to do (add after / replace what's not taught yet / add detail). Taught topics are never removed.
- **Schedule view** — a timeline of when each topic will be taught, projected from the routine: done, next, and later lessons, with estimated dates marked as such.
- **Voice assistant on every screen** — tap the sparkle, speak ("Create a space called Alex with Maya's topics", "Make the chain rule topic more detailed"). The conversation continues in a panel with a mic until the teacher closes it, and the assistant knows what is on screen. It is a small agent: for one message it can use several of the app's tools in a row (create two spaces, then write topics into one of them; read a plan, then change it). Changes apply right away and are listed as small chips under the reply; only deleting waits for a confirm tap. Every reply is written by the model in the language of the teacher's latest message.
- **Bring your own key, one key** — free tiers were often overloaded during testing, so the app moved to the teacher's own OpenRouter key. The model was chosen by measurement, not by name: GPT-6 Luna passed the routine check that MiMo-V2.6-Flash failed, faster and cheaper (`scripts/compare-models.mjs`). A 30-minute lesson costs about $0.015. An optional free Groq key is used first for speech-to-text, with OpenRouter as the automatic fallback.

Example: "Create a space called Alex with Maya's topics" → new space Alex with a copy of Maya's plan (topics only; Maya's lesson memory stays with Maya).

## Possible Later Enhancements
- More assistant tools (for example editing a recorded lesson's notes).
- Weekly overview of what was covered across lessons.
- Let the teacher pick the model in Settings.

## Non-Goals
- Not a free-form AI chatbot — it uses tokens and is not the kernel. (The stretch-goal assistant only acts on the teacher's spaces through a fixed set of app tools, at most 8 steps per message.)
- Never stores raw audio — privacy promise.
- No agent framework — simplicity and token cost.

## Open Questions
- **Audio on failed analysis** — to allow retry, audio may need to be kept until analysis succeeds, then deleted. Decide in `4-spec` (assumption: kept only until success).
- **Exact document size limit and free-tier limits** — check in `4-spec`.
- **Where data lives** (on the device vs. a server) — `4-spec`.
