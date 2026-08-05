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
| 0.1 | 5 levels of real grammar content (6 patterns × 2 examples each), each example illustrated with a custom SVG scene | ✅ Done |
| 0.2 | 294 master vocabulary words across 5 levels and 9 categories (incl. `particles`) | ✅ Done |
| 0.3 | 3 quiz modes per level (Translation, Phonetics, Word Match), 7/10 to pass | ✅ Done |
| 0.4 | GrowKOR sentence-builder engine, 7 themed pools (~30 words each) | ✅ Done |
| 0.5 | 8 Games-tab games (Sentence Builder, Opposite Game 40 pairs, Conversation Fill 15, Word Match, Flashcards, Days & Months, Tense Transformer, Question Builder) + 5 level-specific Test-3 mini-games gating the Quiz (see below) | ✅ Done |
| 0.6 | Word Bank (294 words, 9 categories) + Phrase Bank (100 phrases, 10 categories), word-tap modal with example sentence + illustration | ✅ Done |
| 0.7 | XP / streak / level-unlock persistence via localStorage | ✅ Done |
| 0.8 | Web Audio sound effects (tap/correct/wrong/level-up/victory/fail), no audio assets needed | ✅ Done |
| 0.9 | Repo pushed to `github.com/cherrypow/koreanlang` (`main`) | ✅ Done |
| 0.10 | Mascot (hanbok character, taegeuk hairpin) wired into splash + home hero; 5-tap dev mode | ✅ Done |

### Test 3 — level-specific mini-games (corrected 2026-08-04)
**These are NOT Games-tab entries.** A HardScan re-check of ManLang/JapanLang found that
Test 3 of every level's Quiz is gated by one distinct arcade mini-game per level — never a
generic multiple-choice mode, never a standalone Games entry (see `langapp_launch_process.md`
for the full pattern and source references). KoreanLang's 5 games were relocated from the
Games tab into `#sec-quiz` and rewired as each level's Test 3, dispatched by
`startQuizMode3(lv)`:

| Level | Game | Win condition | Lose condition |
|---|---|---|---|
| 1 | Delivery Boxes (택배 상자) | 8 correct bin-sorts | 3 wrong |
| 2 | Falling Rice | 6 caught | 3 missed |
| 3 | Transfer (환승) | 3 completed sentences | 3 wrong tile taps |
| 4 | Noraebang 100 (노래방 100) | reach 100점 | 3 misses |
| 5 | Suneung Mock Exam (수능 모의고사) | survive all 25 questions | 5 wrong (instant fail, anywhere) |

Every game is strike-based (survive until the win target, one miss too many = instant
"Try again"), all timers route through `qgSetTimeout()` and are cleared by
`stopAllQuizGameTimers()` on any navigation away from Quiz (fixes an earlier bug where
falling-word/round timers kept firing sound effects after leaving the section). Each game
opens on a static SVG scene built from the same `gs*` actor/prop library used for grammar
illustrations, for visual consistency with the rest of the app.

---

## GATE 1 — Code (verify with a fresh HardScan before submitting)

| # | Item | Status |
|---|------|--------|
| 1.1 | `node --check app.js` passes | ✅ Done |
| 1.2 | Full click-through HardScan (every screen, every game) | ✅ Done 2026-08-06 |
| 1.3 | GrowKOR semantic nonsense check on all 7 pools (see §10 of process_langapp.md) | ✅ Done 2026-08-05 — subject+adjective compatibility (`oa` tag), 30-trial randomized verification, zero nonsense combos |
| 1.4 | Onboarding shows once, `koreanlang_onboarded` persists correctly | ✅ Done — 5-step modal, verified persists across reload |
| 1.5 | **`npm run build` includes every asset the app actually loads** | ✅ Fixed 2026-08-06 — `home-bg1.png` (home screen background) was missing from the build script's copy list; the app would have shipped with a broken/blank home screen. Verified by running the real build and serving `www/` directly — zero failed requests, zero console errors. |
| 1.6 | iPhone landscape rotation doesn't break the layout | ✅ Fixed 2026-08-06 — nothing was locking orientation; rotating to landscape overlapped the quiz answer options with the bottom nav (unusable). Added `supportedInterfaceOrientationsFor` → `.portrait` in `AppDelegate.swift` (Info.plist still declares all 4 iPad orientations as documented — required by Apple — the lock is enforced at runtime instead). |
| 1.7 | iPad (portrait + landscape, 3 sizes: 10th-gen, mini, Pro 12.9") renders without overflow or hidden content | ✅ Verified 2026-08-06 — home screen pillarboxes cleanly (art keeps its aspect ratio via CSS, no stretching/cropping), Word Bank grid reflows to more columns, grammar/quiz/GrowKOR all readable. Zero horizontal overflow, zero console errors across all 5 tested sizes. |

---

## GATE 2 — Content (manual check, do this on device)

| # | Item | Status |
|---|------|--------|
| 2.1 | GrowKOR Pools B–G — play 10 sentences at each level, no nonsense | ✅ Done 2026-08-05 (see 1.3) |
| 2.2 | Every quiz mode completes a full 10-question round without crashing | ✅ Verified via automated Playwright pass |
| 2.3 | Word Match timer, Flashcard sets, Opposite Game, Conversation Fill, Days & Months, Tense Transformer, Question Builder — all playable start to finish | ✅ Verified — every game also now speaks its Korean text on render/correct-answer (2026-08-05 HardScan found several were silent) |
| 2.4 | Level unlock actually gates Level 2–5 correctly (test by passing all 3 quiz modes) | ✅ Verified — unlock is now a two-condition gate (quiz pass + cumulative Games-tab win count, `GRAMMAR_GAME_REQ`), matching ManLang/JapanLang exactly, not quiz-only as it originally shipped |
| 2.5 | Native speaker review of all Korean text (grammar examples, vocab, GrowKOR pools, phrases) — **strongly recommended before public launch** | ⬜ Not done — no native speaker was available this session; ship with this as a known post-launch follow-up |

---

## GATE 3 — Visual assets (real design work still needed)

Grammar examples are now illustrated (60/60, via a reusable SVG actor/prop builder — see
`gsWrap`/`gsActor`/`gs*` functions in `app.js`), and the home/level cards use a shared
`svgI()` line-icon set. What's still missing is **photographic/illustrated** artwork —
no image generation tool was available this session:

| # | Item | Status |
|---|------|--------|
| 3.1 | Real app icon (taegeuk circle — the yin-yang symbol from the Korean flag) | ✅ Done — 1024×1024, no alpha channel, verified in `AppIcon.appiconset` |
| 3.2 | Home screen illustration (`home-bg.png` style road/level art, per Phase 2 of the launch checklist) | ✅ Done 2026-08-05 — `home-bg1.png`, generated hero art with 5 baked-in level cards + mascot, CSS aspect-ratio-locked overlay with tap zones/locks/checkmarks |
| 3.3 | Section background texture (`section-bg.png` equivalent) | ⬜ Not started — currently a radial gradient |
| 3.4 | Mascot / victory / failure art reviewed — currently simple inline SVGs, functional but basic | ⬜ Review recommended |
| 3.5 | Grammar example illustrations — reviewed for grammatical/cultural accuracy by a native speaker | ⬜ Not done (60 auto-composed scenes, not hand-reviewed) |
| 3.6 | iPhone 6.5" screenshots (3 minimum) | ⬜ Not done |
| 3.7 | App Store description / keywords / subtitle written (template in `langapp_launch_process.md` Phase 8) | ⬜ Not done |

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
| 5.3 | `npm run build` produces a complete, correct `www/` folder | ✅ Verified 2026-08-06 — ran the real build, served `www/` directly, zero failed requests/console errors (this is what caught 1.5's missing-asset bug). `npx cap sync ios` (CocoaPods/Xcode step) still needs verifying on an actual Mac — not available in this environment. |
| 5.4 | GitHub repo `cherrypow/koreanlang` created and pushed | ✅ Done |
| 5.5 | App Store Connect app record created | ⬜ Not done |

---

## Note on scope vs. ManLang / JapanLang

ManLang and JapanLang's current `app.js` files reflect many iterations beyond their
original launch. As of 2026-08-06, every system flagged across four rounds of HardScan has
been ported:

| System | ManLang has it as... | Status |
|---|---|---|
| Arcade minigames | Bamboo Rain, Panda Climb, Lantern Catch, Dragon Whisper, Wall Builder (quiz-mode-3 games) | ✅ Ported as Korean-themed equivalents — Delivery Boxes, Falling Rice, Transfer, Noraebang 100, Suneung Mock Exam |
| Extra grammar page types | Speed Round, Listen & Repeat, Sentence Grow (paginated-lesson bonus pages) | ✅ Ported 2026-08-06 |
| Home road art | Photographic `home-bg1.png` with baked-in level cards + absolutely-positioned tap zones | ✅ Ported 2026-08-05 |
| Tense Transformer / Question Builder | Extra Games-tab entries beyond the 5 already in KoreanLang | ✅ Ported 2026-08-04 |
| Calendar (Days & Months) game | Separate Games-tab entry | ✅ Ported 2026-08-04 |
| Games gated by grammar level | `GAME_UNLOCK` map + cumulative game-win count folded into level-unlock | ✅ Ported 2026-08-05 |
| TTS voice quality | Name-scored voice picker preferring female/high-quality voices | ✅ Ported 2026-08-05 |

Ported across this session (originally missing, found via HardScan): Web Audio sound
effects, the word-tap example-sentence modal, GRAMMAR_IMGS SVG illustrations (60/60),
word/phrase bank expansion to ManLang's scale (294 words / 100 phrases), the full Games-tab
unlock/vocabulary-scaling system, per-section onboarding toasts (Games/Bank/GrowKOR), the
photographic home screen, and the three paginated-grammar checkpoint types. See
`langapp_launch_process.md` for the conditions each HardScan added to the master checklist
for future language apps.

### Remaining before actual App Store submission (not code — operational)
These can't be completed by an agent session; they need the account holder:
- [ ] iPhone 6.5" screenshots (3 minimum) — capture from a real device or Xcode simulator
- [ ] App Store description / keywords / subtitle written (template in `langapp_launch_process.md` Phase 8)
- [ ] App Store Connect app record created, bundle ID `com.cherrypow.koreanlang` registered
- [ ] Privacy policy URL (App Store Connect requires one even for apps with no data collection)
- [ ] Export compliance / encryption question answered in App Store Connect (answer "No" — no custom encryption, matches JapanLang's Phase 9 note)
- [ ] Confirm Capacitor's bundled Privacy Manifest is present after `pod install` (Apple now requires this for "required reason" API usage; Capacitor's own SPM/CocoaPods package should supply it — verify during Xcode's Archive → Validate step, which will surface a clear actionable error if it's missing rather than a silent rejection)

---

*Contact: mnemomemory@proton.me*
