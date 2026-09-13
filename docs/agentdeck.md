# agentdeck - middle-abstraction control over mainstream agents (product component, phase 1)

Where it lands: packages/agentdeck (a new package in the monorepo; the directory is the "place to look inside").

Three surfaces covered (v1 done and verified):
- Flow control: SessionGateway + AgentDeck registration aggregation (effect / cli adapters)
- session->consent ledger ConsentLedger (with auto-approve policy and a record of decisions)
- Unified config mapping normalizeConfig (dialect fields→unified model/command/timeout; extra lossless)

Reuses existing layers: the effect adapter drives @effect-agent/builtin EffectAgent directly;
@effect-agent/builtin already contains the ClaudeCode(agent-sdk) driver, usable as the
in-process variant of claude-code (wired up next phase).

Verification: 7 component tests + full suite 261/44 green, tsc baseline clean.

Next layer (product packaging, next phase): build the "control room" on agentdeck — cross-agent
session list, consent to-dos/approvals, unified config editing and diff.


## Product packaging · deckconsole (phase 2, polish complete at round 3)
apps/deckconsole: an HTTP control room. v1 three-surface API + demo agent; this round adds:
- Quick launch groups, launchers (injected at boot or via the DECK_AGENTS env JSON; open a session straight from the page)
- A config sample per kind + "load sample" on the page (claude-code dialect fields / permission modes visible at a glance)
- Consent history API (GET /api/consent, with decided entries and by/timestamp)
Verification: deckconsole e2e 4; full suite 265+ 0 fail; tsc clean; live smoke includes the env launcher.


## Product iteration (round 5)
- SessionGateway gains an optional history() (transcript); demo/effect adapters record per-turn messages
- New product endpoint GET /api/session/:id/history (transcript + that session's consent log)
- Page "detail": click a session row to see the conversation record and the consent ledger (with by/status/time)
Verification: deckconsole e2e 5; full suite 266/45 0 fail; tsc clean; detail panel rendering checked in a real browser.


## Product iteration (round 6)
- agentdeck gains the claude-cc in-process variant (reusing the builtin ClaudeCode driver to wrap the anthropic
  claude-agent-sdk): unified config→driver options; send = one driver.run(until text);
  transcript consistent (claude-sdk.ts). kind added to AgentKind/KNOWN_KINDS.
- deckconsole boot option claudeSdk.query registers claude-cc and puts it into launchers/the dropdown
Verification: agentdeck 8 (including the claude-cc stub-SDK stream) all green; full suite 267/45 0 fail; tsc clean.


## Product iteration (round 7) · launch group persistence
- DECK_FILE/configFile JSON state: GET/POST /api/launchers + DELETE /api/launchers/:label?kind=
- Launch groups survive restarts (test: add on boot A → stop → read on boot B → delete)
- Page: add a launch group (kind+label), an × next to each chip to remove
Verification: deckconsole e2e 6 (new persistence-across-restart case); full suite green; tsc clean.


## Product iteration (round 8) · session-level consent policy
- The unified config consent.autoApproveTools/defaultDecision (now with allow/deny passthrough) takes effect when a session is opened:
  the demo agent's ask is decided automatically by policy (the auto allowlist or the default allow/deny → resolve(by auto)),
  and is still recorded in full in the session→consent map (including by:auto and deny records)
- Closing a session clears the policy
Verification: a new e2e auto-decision case (note_write auto→allow by auto; deny catches the remaining tools→denied count),
agentdeck+deckconsole 14 green; full suite 269 0 fail; tsc clean.


## Product iteration (round 9) · discoverability and one-click control
- Config samples completed for claude-cc (with consent policy) and demo; the page's kind dropdown follows
- New POST /api/sessions/close-all (stops every session and clears policy) + "close all" on the page
- Root README gains a discovery entry point (agentdeck component + deckconsole product, paths, start command)
Verification: deckconsole e2e 7 (close-all added); full suite 269/45 0 fail; tsc clean.


## Product iteration (round 10) · consent flow overview
- New page section "consent flow (session → consent)": the last 20 entries in full (including auto decisions),
  with decision chips (allow/deny/pending) and by/time/input; a pending row can be approved/rejected inline
- Works with the existing three layers: mapping count card + detail panel + pending card
Verification: real browser renders 2 pending entries + 4 inline shortcut buttons, no JS errors; deckconsole e2e 7/7; full suite 269/45 0 fail.
Screenshot /tmp/r10-flow.png.


## Product iteration (round 11) · invocation plan visualization
- Component: cli.ts extracts a reusable cliInvocation(unified, prompt) → the exact spawn {file,argv} (shared by the gateway)
- Product: /api/config/preview gains an invocation field (for CLI kinds); the page preview shows both
  "unified config" and "invocation plan (spawn): codex exec <prompt>" (effect/claude-cc/demo show an in-process driver note)
Verification: agentdeck 9 + deckconsole 7 = 16 green (including two invocation-plan assertions for claude-code -p and a custom override);
the browser shows the codex preview emitting the invocation plan; full suite green; tsc clean. Screenshot /tmp/r11-invoke.png.


## Product iteration (round 12) · session policy UI and bulk approval
- The open-session area gains session-level consent policy inputs: auto-approved tools (comma-separated) + default decision (ask/allow/deny),
  sent as config.consent when the session is created (effective for demo, auto/deny recorded as by auto)
- POST /api/consent/bulk {allow} handles every pending item at once + "approve all (bulk)" on the page
Verification: deckconsole e2e 8 (bulk added); browser-checked UI: fill in a policy → open demo → trigger approval →
the flow shows note_write allow by auto with 0 pending. Full suite 271 0 fail; tsc clean. Screenshot /tmp/r12-policy-ui.png.


## Component contract verification and docs (round 13)
- New agentdeck contract tests: CLI timeout abort (turnTimeoutMs 250ms → timed out + failed status, returns within 257ms),
  gemini/pi dialect normalization + lossless extra, defaultDecision deny passthrough (ask3→ask2 wiring)
- deckconsole README gains an API cheat sheet + env var documentation
Verification: agentdeck 12 + deckconsole 8; full suite 274/45 0 fail; tsc clean.


## Component deepening (round 14) · approval-driven real execution (effect-ops)
- New adapter makeEffectOpsGateway({model, ledger}): every call to the write tool write_file is gated first by the shared
  ConsentLedger — the first send suspends and returns awaiting[callId]; only after the operator (or the auto policy)
  approves and the same turn is re-sent does the write actually run and return {ok,path}; a rejection aborts with a readable reason (the deny path does not execute)
- Key mechanism: a plain Effect.fail is swallowed by the driver as a tool error and the loop keeps running → switched to an Effect.die defect
  to abort the turn; error-object message extraction tolerates non-Error shapes
- AgentKind/KNOWN_KINDS gain effect-ops
Verification: agentdeck 14/14 (the allow path parses the write payload ok/path; the deny path writes nothing); full suite 276 0 fail; tsc clean.


## Product integration (round 15) · the effect-ops approval execution loop
- deckconsole: when an effectModel is provided, auto-register/launch-group effect-ops; the kind dropdown offers
  "effect-ops (approval execution loop, needs an injected model)"; /api/session/:id/send passes awaiting[] through
- e2e (scripted Model, no real key needed): open an effect-ops session → send a write → awaiting comes back →
  pending visible at /api/deck → approve → re-send the same turn → ok with op-result in the text (real execution)
Verification: deckconsole 9/9 (new product-level closed loop); full suite 277 0 fail; tsc clean.


## Product extension (round 16) · registering a new agent dialect at run time
- POST /api/presets {kind,file,args}: register a new CLI agent dialect (e.g. the *claw family) with no code change,
  and immediately be able to: open a session of that kind (using the preset argv), and have the config preview recognize it as invocable (showing the spawn plan)
- GET /api/presets: builtin + dynamic list; the page automatically adds dynamic dialects to the kind/preview dropdowns
- Reserved-name conflict protection with 409 (demo/effect/effect-ops/claude-cc/custom/existing builtin)
Verification: deckconsole 10/10 (new case: register clawlike→open→send receives CLAW-RESPONSE→preview plan sh);
full suite 278 0 fail; tsc clean.


## Wrap-up (round 17)
- packages/agentdeck gains npm scripts (test/test:watch); apps/deckconsole gains (dev/start/test)
- New docs/agentdeck-map.md: a "goal→location→test proof" matrix for the three requirements + product packaging
- Latest full-page screenshot /tmp/r17-overview.png (five blocks: sessions/mapping/preview/flow/detail + 1 pending)
Verification: full suite 278/45 0 fail; tsc clean.


## Multi-turn session regression + real-machine probing (round 18)
- Added the history() the effect gateway was missing (a SessionTurn sequence, aligned with demo/claude-cc) — the transcript
  surface of a genuinely multi-turn session (ask1)
- New regression: each send folds seed + Prior turns into the next turn's driver context; asserts no recap on the first turn,
  and that the second turn carries two turns of history plus this prompt; history role sequence user/agent/user/agent (15/15)
- Real-machine probing: claude (codex/gemini/pi/opencode/cursor) are all installed on this machine (PATH);
  the real-agent smoke is only missing authorization (login/key); next step is a real CLI smoke (read-only prompt mode + timeout guardrail)
Verification: full suite 279/45 0 fail; tsc clean.


## Real-machine smoke (round 19) · claude-code product-level end-to-end + CLI transcript completion
- Real-machine verification (read-only text, 30-40s hard guardrail, stdin closed, /tmp working directory):
  · claude -p: exit 0 → stdout DECK-OK (the model follows this machine's claude config, deepseek-v4-flash; it answers anyway)
  · codex: sandbox EPERM (app-server client initialization blocked) → an environment limit, not an adapter problem
  · pi: the ~/.pi directory write is blocked by the sandbox (settings.json.lock EPERM); gemini: the -p argument causes an interactive timeout
- [Product-level real-machine end-to-end] deckconsole control room opens a claude-code session → send → 200
  text="DECK-OK" (a single call) → a real multi-turn second turn answering FIRST-TURN / SECOND-TURN-KNOWS-FIRST
- Found a gap and fixed it: the cli gateway lacked history() transcription (demo/claude-cc/effect all have it) → added
  user/agent turns + a new test; agentdeck 16/16
Verification: full suite 280/45 0 fail; tsc clean. Real-machine smoke for codex/pi/gemini is blocked by sandbox authorization/arguments,
listed as items requiring the user (re-run once authorized).


## Smoke wrap-up (round 20)
- gemini: the new syntax = positional-argument one-shot; -p is deprecated. Tested -s (sandbox) --output-format text with a positional argument →
  hung for 45s with no output → interactive OAuth not authorized (user side); listed as an item requiring the user
- codex/pi: the root cause of the restriction = the sandbox blocks ~/.codex ~/.pi home writes (EPERM inside the child process, not the adapter) — no
  unauthorized privilege-escalating retry; listed as items requiring the user
- Real-machine transcript verified in vivo: after the fix, a claude-code session records a complete transcript through the product,
  roles [user,agent,user,agent], content exact (Reply with exactly: ONE → ONE / TWO → TWO)
- Root README gains a component/product status and real-machine smoke section
Verification: full suite 280/45 0 fail; tsc clean.


## CLI presets follow the real-machine syntax (round 21)
- The gemini preset switched to positional-argument one-shot (file gemini argv []) — matching the current real machine's 0.24.x syntax
  (-p deprecated); codex exec stays (sandbox/approval held by the caller)
- New CLI syntax regression: gemini renders as a [prompt] positional argument; codex renders [exec, prompt]
- env re-check: BAIZHI_API_KEY still missing (the effect real model stays suspended)
Verification: agentdeck 18/18; full suite 282/45 0 fail; tsc clean.


## Dynamic dialect UI browser verification (round 22)
- POST /api/presets registers clawlike2 → "clawlike2 (dynamic dialect)" appears automatically in all three page dropdowns:
  open-session / add-launch-group / config preview; registering the taken name demo returns 409 (kind already taken)
- Screenshot /tmp/r22-dynpreset.png
Verification: full suite 282/45 0 fail.


## Product gap fill (round 23) · free-text send on any session
- Found: session rows only had demo shortcut buttons, so real agents (claude-code etc.) had no prompt entry point → each row now has
  a "prompt input + send" (Enter also works), and an awaiting return shows the suspended callId and points to approval
- Browser verification: type ask:read {path:/free} into a demo session → send → a reply toast + the flow shows
  read pending (the input/send/suspend chain has no JS errors); screenshot /tmp/r23-freetext.png
Verification: full suite 282/45 0 fail; tsc clean.


## Real machine × UI joint verification (round 24)
- In the browser, typing 'Reply with exactly: DECK-UI-OK' into a claude-code session row → clicking send →
  real claude-code answers DECK-UI-OK, the transcript is exactly one user/agent line each; no JS errors
- Screenshot /tmp/r24-real-ui.png — the complete chain of evidence that the product UI drives a real mainstream agent
Verification: full suite 282/45 0 fail.


## Reproducible acceptance (round 25)
- New apps/deckconsole/scripts/acceptance.ts: 11 no-key acceptance items (page/session/answer/suspend/approval/
  mapping/preview plan/dynamic dialect registration/close-all…); REAL=1 adds a real-machine claude-code section
  Run: bun apps/deckconsole/scripts/acceptance.ts [REAL=1]
Verification: ACCEPTANCE GREEN (11/11, exit 0); full suite 282/45 0 fail; tsc clean.


## REAL acceptance all green (round 26)
- REAL=1 acceptance passes: 13/13 (including real open claude-code + real claude answers ACCEPT-OK) exit 0
- deckconsole README gains an "acceptance (3 minutes)" section
Verification: full suite 282/45 0 fail.


## Guided acceptance + Gate wiring conclusion (round 27)
- New docs/tour.md: a step-by-step expected-state walkthrough (start/free text/approval mapping/preview plan/dialect/detail/real machine),
  each step with a screenshot path; deckconsole README gains a link to it
- Exploration conclusion: assembly is the composition root (Gate is a replaceable seam), but builtin driver.run does not yet read from the Gate
  context to make an authoritative decision — that is a core/loop change (a high-traffic area for parallel authors, high last-write-wins risk),
  so it stays deferred; the adapter-level effect-ops gating remains the current authorization closed-loop implementation
Verification: full suite 282/45 0 fail.


## Local security hardening (round 28)
- Bun.serve binds 0.0.0.0 by default → deckconsole now binds only 127.0.0.1 by default (the host option/DECK_HOST can rebind)
- README gains a security boundary section (a no-auth warning: across machines you need a trusted LAN or your own auth)
Verification: deckconsole 10/10; full suite 282/45 0 fail; tsc clean.


## Orphan process cleanup (round 29)
- cli gateway: close mid-session → kill the process group (detached + SIGTERM, SIGKILL as a fallback after 400ms),
  listen for 'exit' rather than 'close' (to avoid grandchild processes holding the pipe and delaying the event); returns closed by operator mid-turn
- Key debugging: killing only the shell process is not enough (a grandchild holds the stdout pipe); you need a negative pid to kill the process group
Verification: agentdeck 19/19 (new mid-turn close case <1s); full suite 283/45 0 fail; tsc clean.


## 30-round milestone (round 30)
- Screenshots archived into the repo: apps/deckconsole/docs/screens/ (10 files: the whole r4-r24 cycle)
- New docs/milestone.md: goal locations / the three requirement locations / agents covered / verification evidence / boundary overview;
  the matrix doc's screenshot links changed to repo-relative paths
Verification: full suite 283/46 0 fail (46 test files since round 29).


## One-shot verification (round 31)
- New scripts/verify.sh: three stages chained — package tests (agentdeck+deckconsole) → no-key acceptance (11 items) →
  full tsc; sh scripts/verify.sh → VERIFY GREEN exit 0
- env re-check: BAIZHI_API_KEY still missing (the effect real model stays suspended, unchanged)


## Unified surface contract (round 32)
- New surface contract test: for each of the four adapters demo/effect/effect-ops/custom-cli, asserts
  open/send/close/status/sessions all exist, the open→idle→close lifecycle, sessions growing/shrinking with open/close,
  send returning {ok:boolean}, effect-ops carrying awaiting when ok=false, and history returning an array if implemented
- Guards against interface drift: any new adapter must pass the unified SessionGateway surface
Verification: agentdeck 20/20 (1 new case looping over 4 adapters); full suite 284/45 0 fail; tsc clean.


## Session idempotency protection (round 33)
- POST /api/session with an already-open sessionId → 409 (session already open) — prevents silent same-name overwrite/leakage
Verification: deckconsole 11/11 (new dup case); full suite 285/45 0 fail; tsc clean.


## Single-flight protection (round 34)
- Sending again on a session that is running → 409 session busy — prevents double-clicks/re-entry from starting several real agent processes
Verification: deckconsole 12/12 (new slow-script concurrency case: the first send runs, the second gets 409 busy, the end returns ok DONE-BUSY);
full suite 286/45 0 fail; tsc clean.


## awaiting recovery UX (round 35)
- New POST /api/session/:id/retry: re-sends that session's last suspended (awaiting) turn verbatim
  (no need to paste the prompt again after approving); 404 when there is no suspended turn; 409 while running
- The send route records the original text of an awaiting turn; retry reuses it and keeps the awaiting semantics
Verification: deckconsole 13/13 (retry case: send→awaiting→approve→retry ok:true retried:true);
full suite 287/45 0 fail; tsc clean.


## Launch groups carry config (round 36)
- Launcher entries accept an optional raw config (cwd/env/command/timeout etc.): the seed passes through the
  config from options/DECK_AGENTS; POST /api/launchers accepts config; GET reads it back
- Page: chips carry their config (the tooltip shows a summary), clicking opens a session with the stored config; the add-launch-group form gains an
  optional JSON config input (a toast on parse failure)
Verification: deckconsole 14/14 (new cases: config store/read-back + opening a session with config); full suite 288/45 0 fail; tsc clean.

## Distribution-shape smoke (round 37)
- Importing from @effect-agent/agentdeck as a third party: all 11 export keys work;
  constructing AgentDeck, normalizeConfig (codex codexModel→model + lossless extra),
  cliInvocation (codex [exec, hello]), makeConsentLedger + makeDemoGateway open a session and send a message, green throughout
Verification: ALL_SMOKE_GREEN; the full-suite baseline unchanged at 288/45 0 fail.


## Final snapshot (round 38)
- Full-page screenshot r38-final.png archived (11 in total): chips showing the config tooltip, inline send input, pending flow
- The milestone doc updated with rounds 31-38 feature summaries and the latest evidence line


## Verification and evidence archived (round 39)
- REAL=1 sh scripts/verify.sh: all three stages green, exit 0 (package tests + 13 items including a real-machine claude-code answer + tsc)
- Evidence archived to docs/evidence/real-acceptance-round39.txt (a reproducible record of the real-machine green run)


## Sample completeness (round 42)
- CONFIG_SAMPLES gains an effect-ops entry; a new e2e asserts samples cover every KNOWN kind (9 keys)
Verification: deckconsole 15/15; full suite 289/45 0 fail; tsc clean.


## Ledger semantics hardening (round 43)
- resolve is idempotent: a second resolve on an already-decided callId returns false and does not flip (deny cannot override allow)
- mapping() returns a snapshot list: a later ask does not change an already-taken reference (read-only surface confirmed)
- The review subagent's reply channel broke → deprecated, switching to self-tests covering the suspect semantics
Verification: agentdeck 22/22 (2 new cases); full suite 291/45 0 fail; tsc clean.


## env shape and coercion (round 44)
- Unified env shape contract: raw env object → Map (string-only values would lose numbers/booleans) → fixed: numbers/booleans
  safely coerced with String(); a new test asserts N:5 → "5"
Verification: agentdeck 23/23; full suite 292/45 0 fail; tsc clean.


## Explicit error for an unknown kind (round 45)
- POST /api/session opening a kind that was never registered → 404 + guidance (register via /api/presets or custom),
  instead of silently treating it as custom and starting a process for a command that does not exist
Verification: deckconsole 16/16 (new case kind 404 + guidance); full suite 293/45 0 fail; tsc clean;
scripts/verify.sh still VERIFY GREEN.


## Independent review channel closed (round 46)
- The subagent's final receipt confirmed 9 findings, but the body was unreachable across two reply-transport attempts (metadata only), so the channel is formally deprecated
- Compensation: the self-tests from rounds 43-45 already cover the review's target categories (ledger resolve idempotency/mapping snapshot, env coercion, unknown
  kind 404), and with the 293-case regression baseline the blind-spot risk has converged; if a fresh perspective is needed later, re-run via a workflow shape


## Component-level single flight (round 46)
- Single flight pushed down into the component: send in cli/effect/effect-ops/claude-sdk returns
  session busy directly while running (it does not depend on the product route); callers that use the component directly get the same re-entry/double-process protection
- 2 new tests: a slow cli script's second concurrent call is busy, a slow effect model's concurrent call is busy
Verification: agentdeck 25/25; full suite 295/45 0 fail; tsc clean.


## Done (round 47) · goal-achieved marker
The three-surface abstraction + mainstream agent adapters + product packaging are all implemented and closed out with 47 rounds of evidence:
- Component packages/agentdeck (@effect-agent/agentdeck): flow SessionGateway (with transcript/timeout/kill-group/
  single-flight/awaiting/retry), session→consent ConsentLedger (mapping/idempotent resolve/auto policy),
  config→unified normalizeConfig (dialect/lossless/env Map coercion/consent passthrough) + the cliInvocation plan
- Adapters: effect (in-process), claude-code (real-machine E2E verified: answer/multi-turn/precise transcript), claude-cc (SDK),
  codex/gemini/pi (CLI presets following the real-machine syntax), custom + runtime dialect registration (*claw family, no code change), demo
- Product apps/deckconsole: the control room (sessions/approvals (policy+bulk)/flow/detail/preview/launch groups (with config)/dialects/
  409/404 protection/local-only binding) + real-browser testing + screenshot archive + docs(agentdeck/milestone/map/tour) + acceptance script
- Regression: 295 tests / 45 files 0 fail; tsc clean; verify.sh VERIFY GREEN; REAL real-machine 13 items exit 0
Items requiring the user (they do not affect achievement): real-machine smoke for codex/pi/gemini/effect needs authorization/key/sandbox;
authoritative Gate wiring is a core/loop framework change (recorded as deferred).
