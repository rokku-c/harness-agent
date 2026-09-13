# deckconsole · agentdeck control room (product layer v1)

A small product wrapped around the packages/agentdeck component: an HTTP control room (JSON API +
a single dark admin page) that exposes the three unified surfaces directly for human use:

- session/flow: POST /api/session (open; any kind + raw config auto-normalized),
  POST /api/session/:id/send, POST /api/session/:id/close
- session→consent: GET /api/deck returns pending and the per-session mapping stats;
  POST /api/consent/:callId { allow } decides one call
- config→unified: GET /api/config/preview?kind=&raw= (raw JSON → normalized result, interactive preview in the page)
- page GET / (session table, one-click approval trigger, allow/deny, config normalization preview)

Start: bun apps/deckconsole/src/main.ts (DECK_PORT defaults to 4851).
The built-in demo agent (no model / no binary) demonstrates the full open→send→ask→approve
flow; other kinds go through the CLI gateway (claude-code/codex/gemini/pi/custom), and effect
needs a model provider injected at startDeckServer({ effectModel }).

Verification: apps/deckconsole/test/deckconsole.test.ts (3 e2e cases, starts a real HTTP server).


## API quick reference (JSON)

| method path | purpose |
|---|---|
| GET / | admin page |
| GET /api/deck | kinds/launchers/sessions/pending/mapping stats/samples |
| POST /api/session | open a session {kind, sessionId?, config(raw config→auto-normalized), prompt?} |
| POST /api/session/:id/send | run one turn {text} (the demo triggers an approval on an ask:tool JSON marker) |
| POST /api/session/:id/close | close the session |
| GET /api/session/:id/history | transcript + that session's consent log |
| POST /api/sessions/close-all | close every session and clear policies |
| GET /api/consent | the full consent ledger |
| POST /api/consent/bulk | bulk-resolve pending approvals {allow} |
| POST /api/consent/:callId | decide one call {allow} |
| GET /api/config/preview?kind=&raw= | config normalization preview + CLI invocation plan |
| GET /api/config/samples | raw config samples per kind |
| GET/POST /api/launchers · DELETE /api/launchers/:label?kind= | launcher group CRUD (persisted to DECK_FILE) |

Environment: DECK_PORT, DECK_AGENTS (JSON launchers), DECK_FILE (launcher group state file).

## Security boundary
- Binds 127.0.0.1 (localhost) only by default. startDeckServer({ host }) or DECK_HOST rebinds it;
  the console has no authentication and can launch arbitrary commands, so for cross-machine use put it on a trusted intranet or add your own auth layer.


## Acceptance (3 minutes)
No key: bun apps/deckconsole/scripts/acceptance.ts   (11 core flows, exit 0 = green)
Real:   REAL=1 bun apps/deckconsole/scripts/acceptance.ts (+ a real claude-code reply segment, 13 items)
Page:   DECK_PORT=4851 bun apps/deckconsole/src/main.ts → http://127.0.0.1:4851
Tour:   docs/tour.md (step-by-step expected states + screenshot index)
