# Clutch — project memory for Claude Code

Read this first. It is the handoff from the Cowork session that built v1 through v47.

## What this is

Clutch is a planner for Moraine Valley Community College students with an AI coach. Built by Moon (no CS background, directs the work and makes the product calls) for a COM 101 group project. The class votes on the best project; presentation is roughly mid October 2026. The bar is "would a student in the room actually use this tonight," not "is the code elegant."

Live: https://clutch-mvcc.pages.dev (Cloudflare Pages, auto-deploys from `main` in about 30 seconds)
Repo: github.com/G80Moon/clutch

## How Moon works

- Casual, lowercase, direct. Wants honest pushback, not validation. If something is a bad idea, say so and say why.
- No em dashes anywhere: not in chat, not in UI copy, not in commit messages. Use a comma, a colon or a period.
- "Not too complex but good." Prefer the simplest change that fully solves the problem. Don't add frameworks, build steps or dependencies.
- He does not want Claude handling secrets. Never ask him to paste an API key into chat. Tell him the command to run himself (`npx wrangler pages secret put ANTHROPIC_API_KEY --project-name clutch-mvcc`) and move on.
- Ship both hosts when he asks for a change: commit to `main` (Cloudflare deploys) and, if he still wants the claude.ai artifact copy updated, tell him it needs a separate publish from a Cowork/claude.ai session. The Cloudflare site is the primary host now; the artifact is frozen at v47 unless he says otherwise.
- When he sends screenshots, look at what he is pointing at, fix the root cause, then say in plain words what was actually wrong. He likes knowing the "why."

## Layout

```
public/index.html          the entire app: CSS + HTML + JS in one file. This is the source of truth.
public/og.png              link preview card (1200x630). Referenced with ?v=3, bump when you replace it.
public/favicon.ico/.png    Clutch's head. favicon.ico must exist as a real file (Pages serves index.html for missing paths, which broke Safari).
public/apple-touch-icon.png, icon-192.png, icon-512.png, manifest.webmanifest
public/clutch-focus-extension.zip   Chrome site blocker (side project, rarely touched)
functions/api/chat.js      Pages Function: proxies to api.anthropic.com/v1/messages, streams SSE back. Key lives only here.
functions/api/health.js    returns {ok: key configured, caps: KV bound}
functions/api/groups.js    class groups on D1 (binding DB, database clutch-groups, schema db/schema.sql). Actions: create, join, state, leave, share, deck, unshare.
functions/api/canvas.js    fetches a student's Canvas Calendar Feed (.ics) and passes it back. Only canvas.morainevalley.edu / *.instructure.com /feeds/calendars/*.ics links. Stores nothing.
wrangler.toml              pages_build_output_dir = "public"
dev/                       mock server + Playwright tests (see Workflow)
```

There is no build step. The head of `public/index.html` (viewport, og tags, icons, manifest) is hand-written; keep it when editing.

## Architecture in one screen

- State: one object `S` in localStorage under key `clutch.planner.v1`: `{assignments, blocks[{id,date,start,min,label,by,at}], log[{date,min,n,...}], money, profile, ach, alerted, decks, tests, groups, groupsInit}`. `save()` writes it. Alerts prefs in `clutch.alerts`, sidebar state in `clutch.rail`.
- The planner is stored only on the device. AI chats, photos and the Canvas feed pass through the server and aren't kept. Class groups (added 2026-10-08, Moon approved) are the one thing stored on the server: group name/class/code, members' first names, focus minutes per week, decks they share. Leaving deletes your rows. This is the stated promise (landing footer). Don't add analytics or more server storage without asking.
- AI: the page looks for `window.claude` (claude.ai artifact runtime). When absent and `/api/health` says ok, `makeShim(endpoint)` builds an equivalent client that talks to `/api/chat`: Messages API body, streaming, up to 6 tool rounds, images downscaled to ~1.4MP JPEG, tolerant JSON parse. Model tiers: quick → claude-haiku-4-5, default → claude-sonnet-5, complex → downgraded to sonnet in the function.
- Tools the model can call (defined in `tools` in index.html): add_assignment, complete_assignment, add_study_block (refuses past times and overlapping blocks, returns the free slot), start_focus_timer, make_flashcards, make_practice_test. Rules text is built in `rules()` and includes `studySnapshot()` and `groupSnapshot()`.
- `send({text, display, quiet, bubble})`: `display` is the short text shown in the user bubble while `text` is what the model gets. Use it for any programmatic prompt so the chat doesn't show a wall of text.
- Views: `#grid[data-view]` = plan | focus | study | money | ask | groups. `setView(v)` on desktop, `switchTab(t)` on phones (tabs: due | focus | money | groups | ask). `TAB_OF_VIEW` maps between them. Columns: `.c-next .c-due .c-week .c-focus .c-study .c-ask .c-money .c-groups`.
- Desktop (>1160px): left rail `#rail` with icons, collapsible, remembered. Chat `.chat` is sticky and sized by `fitChat()` to fill the viewport. Planner view = hero + due list + chat. Focus = one card (Working on: defaults to Next up, with Change; one "Start focus" button that opens study mode; breaks run in place) + 7-day timeline with "Plan my week with Clutch" and a hidden "Add a block yourself" form. On phones the timeline lives in the Due tab and Focus shows the timer, then flashcards and practice tests. Study = flashcards + practice tests.
- Mobile (≤1160px): bottom tab bar, flat chat, toast at the top (it used to sit over the composer and swallow taps).
- Flashcards: `decks()`, `saveDeck()`, `studyDeck()` (modal `#fd`), photo → `makeCards(file)`, deduped by `photoHash()` so the same photo returns the same deck. Practice tests: `tests()`, modal `#pt`, `PT` state. Class groups are real (since 2026-10-08): join with a 6-character code or an invite link (`#join=CODE`), one shared weekly goal (60 focus min per member, cooperative, no ranking), shared flashcard decks. Identity is the device id (`deviceId()`, `clutch.id`) plus the profile first name, no accounts. `S.groups` caches `{code,name,course,last(state),wonWeek,wins}`; `syncAllGroups()` runs after each focus session. Only real sessions count (`log` rows with `real:true`; the example week's history doesn't).
- Trophies: `checkAch(quiet)`; 22 of them; quiet during boot so nothing toasts on the landing page.
- Canvas: "Connect Canvas" / "Sync Canvas" in the Due header, modal `#cx`, code under `/* Canvas calendar feed */` (`cxParse`, `cxReview`, `cxSync`). The feed link lives in `S.canvas = {url, seen[uids], last}` on the device. Imported assignments carry `src:'canvas', cid (feed UID), url, time ('HH:MM')`. Sync adds only unseen UIDs and follows due date changes. The feed has no "submitted" flag, so done = checked off in Clutch. Fallback: screenshot of the Canvas To Do list read by the AI. Canvas can't be framed (CSP frame-ancestors), so "Open Canvas Calendar" opens a separate window (`cxOpenCanvas`); pasting a valid link starts the import on its own. Setup's last step offers "My Canvas" first. Auto-sync (`cxAuto`) runs on open / tab return when the last sync is over 6h old. "Later" and "Done" fold when they have more than 3 items.
- Money 101 in the planner (2026-10-02, after the professor said planner + money felt like two apps): the 5 lessons are assignments with `src:'money', lesson, course:'MONEY 101'`, one a week. Done = that lesson's quiz is done (`syncMoney()` mirrors it; the checkbox opens the lesson). Optional: past dates slide forward instead of going late, and they never count in Next up, Due soon, alerts, the workload meter, the week progress or the "N open" count. Chat cards (`cvCard`) only show for Canvas items (real link, or the example data's demo page) and Money 101 lessons ("Open lesson"); hand-added work gets none. When Canvas isn't connected, the empty Next up card and the AI both point to Connect Canvas. Strip `#mStrip` under the meter. Finishing all 5 sets `S.money.reward` and opens `#mw`: a free semester of Clutch+ "saved for when it launches". There is no Clutch+ checkout, so the copy must stay honest about that. Pitch line: Clutch handles a student's two scarcest things, time and money.
- Due times: `a.time` is optional; `dueAt()` uses it or 11:59pm. Row colors (`stCls`): green done, yellow due within 48h, red late and not done.
- Example data: "Example data · Reset · Clear list" in the header. Reset gives a full demo state. Onboarding: `#ob`, `finishOb()`.

## Workflow

Before every push:

```
node dev/mock.js &        # serves public/index.html on :8787 with a fake /api/chat (no key needed). A chat message starting "echo " makes the bot reply with exactly the rest.
node dev/perr.js          # must print "clean"
node dev/smoke.js         # desktop: chat, plan-my-week tool round, practice test, photo deck
node dev/mobile.js        # iPhone 13: study a deck, "Have Clutch quiz me", chat box still tappable
node dev/errors.js        # what students see when the AI fails: daily cap, Claude down, bad key
node dev/money.js         # Money 101 in the planner: lessons in Due, quizzes turn rows green, reward window, remove/undo, setup question
node dev/groups.js        # real groups with two browser profiles: create, invite link, shared goal, share/save deck, leave
node dev/canvas.js        # Canvas feed: connect, review, add, row colors, sync, moved due date (screenshots in .shots/)
```

Playwright is needed (`npm i -D playwright && npx playwright install chromium`). To test against the real function locally: copy `.dev.vars.example` to `.dev.vars`, Moon puts the key in, then `npx wrangler pages dev public`.

Screenshots are the fastest way to check layout: take one at 1540x880 (Moon's Mac roughly), 1280x800, and iPhone 13, for the view you touched. Moon will send his own screenshots too.

Push to `main` deploys. Verify with `curl -s https://clutch-mvcc.pages.dev/ | grep <something you changed>` after ~30s.

## Gotchas learned the hard way

- Canvas (Instructure) returns 403 to requests with no User-Agent. Server-side fetches to Canvas must send one.
- Sonnet 5 thinks on its own when a task looks hard (images especially) and can spend all of max_tokens on it, returning no text. chat.js sends `thinking: {type:'disabled'}` for Sonnet 5. If the model is ever upgraded to Sonnet 5.5, `disabled` is a 400 there: use `{type:'between_tools'}` instead.

- Cloudflare Pages returns index.html (200) for any missing path. Anything a browser fetches by convention (favicon.ico, robots.txt) must be a real file.
- Safari caches favicons in its own store; a changed icon needs a cache-busted href (`?v=N`).
- iMessage only renders a link card when the message is the bare URL.
- Elements with `opacity:0` still catch taps. Anything that fades out needs `pointer-events:none` / `visibility:hidden` too.
- `position:sticky` needs a parent taller than the element. The chat column is `align-self:stretch` for that reason.
- CSS specificity ordering: the mobile block at the end of the stylesheet wins over the desktop rules above it. Put desktop-only overrides in the `@media (min-width:1161px)` block near the rail CSS, or use a more specific selector.
- Class names collide easily in a 3,000 line file (`.plan`, `.dh`, `.views` all bit us). Grep before adding a class.
- The model sometimes returns 7 cards when asked for "about 8"; prompts that need a count say "exactly N."
- Same-origin check in chat.js uses Origin/Referer; the mock skips it. Don't remove it.

## Roadmap (two weeks to presentation, in priority order)

1. Feedback from the group and 3 to 5 classmates watching them use it on their phones. Fix confusion first.
2. Canvas import (built 2026-09-30, worked on Moon's real feed on desktop: 53 found, 35 assignments. Still untested on a phone). This is the demo opener. A syllabus import was considered and dropped: syllabi miss most assignments.
3. First-minute experience: cold link to a set-up planner in under 60 seconds.
4. Reliability: KV `RATE` bound 2026-09-30 (80 AI requests per device per day, keyed by IP + `clutch.id` so a classroom on one wifi isn't one visitor; one KV write per request because the free plan allows 1,000 writes/day; fails open). AI error states swept (dev/errors.js). Still open: a "presentation" example profile that Reset restores. The budget guard is a spend limit on the Anthropic account, which Moon sets.
5. Proof on the landing page: real visitor numbers from Cloudflare analytics and real classmate quotes only. Never fabricated ones.
6. Presentation: live phone demo mirrored to the screen, six slides max, QR cards, a 60s screen recording as a wifi backup.

Skip for now: real accounts/class groups, push notifications, the Chrome extension, dark mode. None of them change the class vote.

## Things not to change without asking

- The "everything saves on your device" promise.
- The single-file architecture.
- Model allowlist, MAX_TOKENS and the same-origin check in `functions/api/chat.js`.
- Moraine Valley cost numbers in the semester cost planner (they cite sources in the Works cited section).
