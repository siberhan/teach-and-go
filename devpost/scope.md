---
doc: scope
status: approved
---

# Lesson Memory (working name)

An open-source AI assistant that remembers where each lesson stopped — and the "I'll explain that later" promises — so a teacher starts the next lesson exactly where they left off.

## The Unique Kernel
When the teacher opens a space, it greets them with where they stopped **and** connects a deferred promise to today's topic: "Last lesson you stopped at derivatives. Also, the chain rule you said you'd explain later fits this week's topic." No manual notes. All of this lives behind a very simple, beautiful interface with only a few buttons.

## Who It's For
First user: private tutors teaching one-on-one, who keep track of each student's progress in their head or on paper. School teachers with whole classes can use it too. A memory can belong to one student or to one class.

## The Core Loop
1. The teacher opens a **space** (one student or one class). Each space has its own memory.
2. Before the first lesson, they set it up: upload a document (e.g. a curriculum), write or speak a note ("we stopped at …"), or just chat with the AI. The AI checks the plan with them ("Is this your curriculum?", "How often are lessons?", "Should I make a lesson plan?") using simple buttons, and the teacher asks for changes in chat.
3. At the start of a lesson, the teacher taps record. When the lesson ends, the AI analyzes the recording: how much of the plan was done, where it stopped, and what was deferred ("I'll explain this later").
4. Next time they open the space, they see where to start, plus a reminder when a deferred topic matches this lesson.

They come back every lesson because the app does the remembering for them.

## Inspiration & Identity
Very simple, elegant, smooth. A few buttons. Not an "AI slop" interface with text everywhere — "as if every user has ADHD": calm, little text, obvious next step. The agent "brain" should be minimal: pi agent (open-source on GitHub) or something even more minimal — final choice in `4-spec`.

## Why This Matters to the Learner
They want to build something for a general audience rather than another AI developer tool. They also want to learn how to keep AI-driven development efficient and under their own control.

## What "Working" Looks Like
Using a lecture we own — the hackathon rules forbid copyrighted material without permission in the demo video, so no third-party lectures. We write a short lecture script with AI, on purpose including a sentence like "I'll explain this later", and turn it into audio with text-to-speech (TTS). This also tests whether the analysis works correctly. The demo video must be in English or have English subtitles (hackathon rule).
1. Create a space, upload a curriculum, confirm the plan with the AI.
2. Record/feed the lesson; analysis runs when the lesson ends.
3. Open the space again → it shows where the lesson stopped and reminds about an "explain later" topic that fits this lesson's topic.

The "oh, that's cool" beat: the deferred topic resurfacing at exactly the right lesson.

## The POC Boundary
Learner's decision: all of these are in.
- Multiple spaces, each with its own memory.
- Setup screen: document upload, text or voice note, chat with the AI, simple button prompts to confirm or create the lesson plan.
- A screen for switching between spaces and creating new ones.
- Lesson screen: one record button; analysis after the lesson ends (not live).
- Memory: stopping point, progress against the plan, deferred topics; next-lesson start point and matching reminders.
- Privacy: raw audio is deleted as soon as text analysis finishes; never stored.
- Open source.

Build order: **design the interface first** and review it early, so mistakes are fixed before the backend depends on them.

## Later
- Live listening during the lesson (analysis after the lesson is enough for now).
- Accounts, login, sharing between teachers.
- Mobile app; deployment (optional for the hackathon).
- **Stretch goal — voice assistant (added during the build, time allowed):** one button on every screen; the teacher says what they want ("Create a space called Alex with Maya's topics"), the app shows one confirmation card, and does it. Kept out of the original POC so the kernel came first; added at final review once the kernel worked.
- **Also added during the build, time allowed** (details in `prd.md > Stretch Goals Added During the Build`): recording that keeps going across screens with pause/resume, a notification menu, a schedule view, a routine the AI never guesses, questions as tap-able options, safe handling of new documents, and bring-your-own OpenRouter key (optional free Groq key for speech).

## Explicitly Cut
- A separate weekly-plan feature — the curriculum (with dates, if it has them) is the plan; if there is none, the AI asks and helps make one.
- Storing raw audio — cut on purpose for privacy.
