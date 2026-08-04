# KoreanLang — Ship Checklist
**Only submit to App Store when every item below is ✅**

---

## GATE 0 — What v1 actually is

KoreanLang v1 was scaffolded from the `langapp_launch_process.md` / `process_langapp.md`
playbook (Phases 1–3), using JapanLang's engine as the structural reference since Korean
is SOV like Japanese. It is a **leaner, from-scratch build**, not a byte-for-byte port of
JapanLang's current (much more iterated) production app — see note at the bottom.

| # | Item | Status |
|---|------|--------|
| 0.1 | 5 levels of real grammar content (6 patterns × 2 examples each) | ✅ Done |
| 0.2 | 150 master vocabulary words across 5 levels (30/level) | ✅ Done |
| 0.3 | 3 quiz modes per level (Translation, Phonetics, Word Match), 7/10 to pass | ✅ Done |
| 0.4 | GrowKOR sentence-builder engine, 7 themed pools (~30 words each) | ✅ Done |
| 0.5 | 5 games: Sentence Builder, Opposite Game (40 pairs), Conversation Fill (15), Word Match, Flashcards | ✅ Done |
| 0.6 | Word Bank + Phrase Bank (5 categories, ~35 phrases) | ✅ Done |
| 0.7 | XP / streak / level-unlock persistence via localStorage | ✅ Done |

---

## GATE 1 — Code (verify with a fresh HardScan before submitting)

| # | Item | Status |
|---|------|--------|
| 1.1 | `node --check app.js` passes | ✅ Done |
| 1.2 | Full click-through HardScan (every screen, every game) | ⬜ Not done |
| 1.3 | GrowKOR semantic nonsense check on all 7 pools (see §10 of process_langapp.md) | ⬜ Not done |
| 1.4 | Onboarding shows once, `koreanlang_onboarded` persists correctly | ⬜ Not done |

---

## GATE 2 — Content (manual check, do this on device)

| # | Item | Status |
|---|------|--------|
| 2.1 | GrowKOR Pools B–G — play 10 sentences at each level, no nonsense | ⬜ Not done |
| 2.2 | Every quiz mode completes a full 10-question round without crashing | ⬜ Not done |
| 2.3 | Word Match timer, Flashcard sets, Opposite Game, Conversation Fill — all playable start to finish | ⬜ Not done |
| 2.4 | Level unlock actually gates Level 2–5 correctly (test by passing all 3 quiz modes) | ⬜ Not done |
| 2.5 | Native speaker review of all Korean text (grammar examples, vocab, GrowKOR pools, phrases) — **strongly recommended before public launch** | ⬜ Not done |

---

## GATE 3 — Visual assets (real design work still needed)

Unlike JapanLang, this build has **no photographic/illustrated artwork** — no image
generation tool was available this session. Everything is CSS gradients + inline SVG,
which is fully functional but visually plain compared to JapanLang's road/level-card
home screen. Before public launch:

| # | Item | Status |
|---|------|--------|
| 3.1 | Real app icon (current one is a placeholder taegeuk circle, programmatically drawn) | ⬜ Placeholder only |
| 3.2 | Home screen illustration (`home-bg.png` style road/level art, per Phase 2 of the launch checklist) | ⬜ Not started — currently a plain gradient + level-card list |
| 3.3 | Section background texture (`section-bg.png` equivalent) | ⬜ Not started — currently a radial gradient |
| 3.4 | Mascot / victory / failure art reviewed — currently simple inline SVGs, functional but basic | ⬜ Review recommended |
| 3.5 | iPhone 6.5" screenshots (3 minimum) | ⬜ Not done |
| 3.6 | App Store description / keywords / subtitle written (template in `langapp_launch_process.md` Phase 8) | ⬜ Not done |

---

## GATE 4 — Audio (optional for v1)

`korean_audio.js` currently ships empty (falls back to the browser/WebView's built-in
`ko-KR` speech-synthesis voice via `speakKorean()`). This works for testing but is not a
substitute for real TTS/native-speaker audio.

| Item | Status |
|------|--------|
| Google Cloud TTS (or similar) API key obtained | ⬜ |
| Audio generated and `korean_audio.js` populated | ⬜ |
| Audio tested on-device (WebView Korean voice availability varies by iOS locale settings) | ⬜ |

Audio is not blocking for v1 submission — ship without it and add in an update, same as JapanLang did.

---

## GATE 5 — iOS / CI

| # | Item | Status |
|---|------|--------|
| 5.1 | Bundle ID `com.cherrypow.koreanlang` set in `capacitor.config.json`, `Info.plist`, `project.pbxproj` | ✅ Done |
| 5.2 | `codemagic.yaml` environment group renamed to `AppKoreanLang` | ✅ Done — **create this group in Codemagic before first CI run** |
| 5.3 | `npm install && npm run build && npx cap sync ios` runs clean | ⬜ Not verified (needs Node/Xcode environment) |
| 5.4 | GitHub repo `cherrypow/koreanlang` created and pushed | ⬜ **Not done — no push was made this session** |
| 5.5 | App Store Connect app record created | ⬜ Not done |

---

## Note on scope vs. JapanLang

JapanLang's current `app.js` (616 KB) reflects many iterations beyond its original launch —
extra mini-games (Koi Fish, Samurai Sneak, Monk Memory, Sentence Rain, Tense Transformer,
Question Builder, Days & Months), accumulated bug fixes, and a hand-illustrated home
screen. Reproducing all of that verbatim for Korean in one pass wasn't feasible, so this
build implements the **checklist's actual Phase 1–3 spec** faithfully — grammar, GrowKOR,
quiz, games, bank — with original Korean content, rather than a line-by-line port. Treat
this as a solid v1 foundation, not a finished, launch-ready parity clone.

---

*Contact: mnemomemory@proton.me*
