# Board and the fleet — architecture and sequences

> Diagrams for `docs/board-white-paper.md` at implementation granularity. Every node and
> message below is a real file, route or call: package paths are relative to the repository
> root, HTTP paths are the ones `http:` in the `operation()` declarations serve, and the
> tool names are board's and agentd's own.
>
> Design: `docs/board.md`. Contract: `docs/board-tools.md`. Product: `docs/board-white-paper.md`.

## 1. Deployment

Who talks to whom, and over what. Two rules shape every edge: **a machine only ever calls
out**, and **an agent has exactly one door**.

```mermaid
flowchart TB
  subgraph HUM["Human"]
    UI["console view<br/>tree · table · outline editor · calendar"]
  end

  subgraph AGT["Agents"]
    AG["claude-code · codex · gemini · pi · effect<br/>any MCP client"]
  end

  subgraph MAIN["Main node — effect-server host"]
    GW["mcp-gateway app · /mcp-gateway<br/>identity then resolve then authz then rules then upstream then audit"]
    AIG["ai-gateway app<br/>provider routing and credentials"]
    BRD["board app<br/>/api/* · /api/calendar.ics · board_* tools"]
    AGD["agentd app<br/>/agentd/* · agentd_* tools · /agentd/tunnel"]
    REG["mcp-registry app<br/>server topology"]
  end

  subgraph PEER["Peer machine — agentd probe resident"]
    PP["agentd-probe<br/>beat every 1500 ms"]
    PA["agents: claude-code · codex · gemini · pi"]
    PT["local face 127.0.0.1/agentd/tunnel/NAME"]
  end

  subgraph SSH["host C — no agentd at all"]
    SC["~/.claude/projects · ~/.pi/agent/sessions<br/>codex store · gemini store"]
  end

  UI -->|"HTTP"| BRD
  AG -->|"MCP tools"| GW
  GW -->|"upstream stdio or streamable-http"| BRD
  REG -.->|"topology"| GW
  AG -->|"provider traffic to one local address"| PT
  PT -->|"forward — nothing rewritten"| AIG
  PP -->|"POST /agentd/node/announce · heartbeat · withdraw"| AGD
  PP -->|"GET /agentd/node/plan · POST /agentd/node/report"| AGD
  PP -->|"POST /agentd/launch/poll · /agentd/launch/report"| AGD
  PP -->|"POST /agentd/facts · /agentd/sessions · /agentd/note"| AGD
  PP -->|"agentdeck launcher — spawn here"| PA
  PP -->|"agentdeck ssh — sh -s N with COLLECTOR"| SC
  AGD -.->|"MISSING — see section 5"| BRD
```

The dashed edge is the one gap: an intent agentd queued and a machine ran does not, by
itself, become a run on a board node. Section 5 draws what is missing.

## 2. Module map

```mermaid
flowchart LR
  subgraph DECL["One declaration, two surfaces"]
    OP["operation({ name, description, access, input, handler, http })<br/>packages/effect-interface/src/surface/operation.ts"]
    OP --> T1["toEffectTools — tools/list and tools/call"]
    OP --> T2["toHttpHandler — method and path, :segments bound into input"]
  end
```

```mermaid
flowchart TB
  subgraph BOARD["apps/board/src"]
    BOPS["tasks/ops.ts · runs/ops.ts · docs/ops.ts — 21 operations"]
    BAPI["api.ts — boardOperations() · makeBoardTools()"]
    BBOARD["board.ts — composition root · one sqlite transaction per mutation"]
    BT["tasks/ — schema · relations · mutations · rollup · table · calendar"]
    BR["runs/ — schema · rules · service · store · presence"]
    BDOC["docs/ — schema · outline · service · store"]
    BST["storage/ — database VERSION 3 and fingerprint · store · clean"]
    BH["hosts/web/server.ts handler · hosts/web/main.ts · hosts/mcp/main.ts"]
    BE["effect-bundle-entry.ts · effect.bundle.json<br/>abi effect-1 · runtimes os · namespace ops"]
  end

  subgraph AGENTDAPP["apps/agentd/src"]
    AG1["ops/ — agent · facts · install · launch · node · plan · registry — 31 operations"]
    AG2["tunnel-routes.ts — /agentd/tunnel"]
    AG3["handle.ts · http.ts · seed.ts · status.ts · effect-config.ts"]
  end

  subgraph PROBEPKG["packages/agentd-probe/src"]
    PB1["probe.ts — tick · lease · a refusal halts the loop"]
    PB2["cycle.ts — announce or heartbeat then plan then apply then report"]
    PB3["launch-cycle.ts · launch-step.ts · machine-launcher.ts"]
    PB4["facts-cycle.ts · machine-facts.ts"]
    PB5["transport.ts · call.ts — outbound fetch with the node token"]
    PB6["apply.ts · stage.ts · stage-write.ts — artifact staging"]
  end

  subgraph DECKP["packages/agentdeck/src"]
    DK1["discover/ — jsonl · codex · gemini · tails · remote · collector"]
    DK2["probe/ — claude · codex · executables · install · settings-json"]
    DK3["launch/ — command · local · remote"]
    DK4["remote/ — ssh with BatchMode=yes"]
    DK5["adapters/ — claude-sdk · cli · effect"]
  end

  BOPS --> BAPI --> BBOARD
  BBOARD --> BT
  BBOARD --> BR
  BBOARD --> BDOC
  BBOARD --> BST
  BH --> BBOARD
  AG1 --> AG3
  AG2 --> AG3
  PB1 --> PB2
  PB1 --> PB3
  PB1 --> PB4
  PB2 --> PB5
  PB3 --> PB5
  PB3 --> DK3
  PB4 --> DK1
  PB6 --> PB5
  DK3 --> DK4
  DK2 --> DK4
```

`apps/agentd` depends on `packages/agentd-probe` for the node vocabulary;
`packages/agentd-probe` reaches `packages/agentdeck` only at the edge
(`machine-launcher.ts`), which is why `launch-cycle.ts` can declare what it needs from a
runner structurally and stay free of any CLI dialect.

## 3. The beat

One pass of `probe.ts`'s `tick()`. The order matters: a machine that cannot report a
deployment has no business claiming work, so the deployment cycle runs first.

```mermaid
sequenceDiagram
  autonumber
  participant Sch as schedule — 1500 ms default
  participant P as probe.ts tick()
  participant Cy as cycle.ts runCycle
  participant NC as transport.ts NodeControl
  participant S as agentd app
  participant AC as AgentdControl — plan builder

  Sch->>P: tick()
  P->>Cy: runCycle with machine control apply leased reported
  alt leased
    Cy->>NC: heartbeat(nodeId)
    NC->>S: POST /agentd/node/heartbeat
  else first beat or lease lapsed
    Cy->>NC: announce(machine)
    NC->>S: POST /agentd/node/announce
  end
  S-->>NC: 200 presence
  Cy->>NC: plan(nodeId)
  NC->>S: GET /agentd/node/plan?nodeId=...
  S->>AC: desiredNode(nodeId) then adjudicate artifact by artifact
  AC-->>S: NodeAdapterPlan revision changes desired
  S-->>Cy: plan
  alt plan.revision equals the revision we already receipted
    Cy-->>P: in-sync
    Note over Cy,P: no receipt is sent — a receipt every 1500 ms<br/>stops being a receipt and becomes a heartbeat
  else a new revision
    Cy->>Cy: apply(plan) — declarativeApply or stagingApply
    alt the apply threw
      Cy->>NC: report(nodeId, revision, ok false and the error)
      NC->>S: POST /agentd/node/report
      Cy-->>P: apply-failed
    else applied
      Cy->>NC: report(nodeId, revision, ok true and the deployment)
      NC->>S: POST /agentd/node/report
      Cy-->>P: applied
    end
  end
  opt this machine runs agents
    P->>P: launchStep — section 4
  end
  opt this machine collects and 60 s have passed
    P->>P: factsStep — section 4 continued
  end
  P->>Sch: schedule the next tick
```

A `refused` fault halts the loop and says so — the identical call is refused identically
forever, so repeating it is a spin rather than a retry. Every other fault, an unreachable
control plane included, is worth another beat: a node that keeps trying and ages offline is
telling the truth, while one that gives up is reporting a health it cannot know. On `stop()`
the goodbye is delivered before the loop ends, because an undelivered `withdraw` would leave
a node listed as up until its lease happened to lapse.

## 4. What the machine reports

### 4.1 Sessions and facts — local, and over ssh

```mermaid
sequenceDiagram
  autonumber
  participant P as factsStep — 60 s clock
  participant F as facts-cycle.ts runFacts
  participant Src as FactSource.collect — the host program
  participant D as agentdeck discover/
  participant T as remoteSessions plus ssh transport
  participant C as host C — no agentd
  participant NC as transport.ts
  participant S as agentd app

  P->>F: runFacts with control and source
  F->>Src: collect()
  Src->>D: discoverSessions with home and limit 50
  D->>D: mapLimit over sessionSources at 4 — claude-code jsonl pi jsonl codex gemini
  D->>D: sort by updatedAt descending then slice to the limit
  D->>D: attachTails then readTail per newest session — TAIL_BYTES
  D-->>Src: DiscoveredSession list carrying a bounded tail
  Src->>T: remoteSessions over the transport
  T->>C: ssh BatchMode=yes ConnectTimeout=10 sh -s N with COLLECTOR on stdin
  C-->>T: TSV — kind sessionId cwd mtime size path
  alt timed out or non-zero exit
    T-->>Src: ok false and the error
    Src-->>F: CollectedMachine with a note
  else answered
    T->>T: parseLine then sort descending then remoteTail per path
    T-->>Src: ok true and the sessions
    Src-->>F: CollectedMachine with sessions
  end
  F->>NC: reportFacts(machineId, facts)
  NC->>S: POST /agentd/facts
  F->>NC: reportSessions(machineId, sessions)
  NC->>S: POST /agentd/sessions
  opt a machine could not be read
    F->>NC: reportNote(machineId, note)
    NC->>S: POST /agentd/note
    Note over F,S: so a stale snapshot is not shown as a quiet one
  end
```

A remote result is a typed outcome where local discovery quietly returns fewer sessions:
"This machine has no sessions" and "this machine did not answer" are different facts, and a
control plane that conflates them reports an unreachable host as idle.

### 4.2 Launch — the queue is pulled, never pushed

```mermaid
sequenceDiagram
  autonumber
  actor Op as operator or agent
  participant AG as agentd app
  participant Q as launches.ts queue
  participant PR as probe on the machine
  participant L as agentdeck makeLauncher
  participant W as the agent process in its workdir

  Op->>AG: agentd_launch with nodeId machineId kind workdir prompt
  AG->>Q: enqueue — intentId is a fresh uuid and the state is queued
  Q-->>Op: 201 with the intent
  Note over Q: it waits here until that machine asks

  loop every beat
    PR->>AG: POST /agentd/launch/poll with machineId and limit
    AG->>Q: poll(machineId, limit)
    Q-->>PR: intents — a claim is what makes one this machine's own
    PR->>AG: POST /agentd/launch/report with state running
    Note over PR,AG: reported before the agent starts, so a launch<br/>that takes minutes is visible for those minutes
    PR->>L: runner.run with kind workdir prompt and optional command and args
    L->>L: assertRunnable then configFor with cwd set to workdir then cliInvocation
    alt no target — this host
      L->>W: spawn(file, argv) in the workdir
    else a remote target
      L->>W: ssh with cd workdir and the same argv, every word quoted
    end
    W-->>L: ok output durationMs
    PR->>AG: POST /agentd/launch/report with done or failed and the detail
  end
  Op->>AG: agentd_launches with machineId or nodeId
  AG-->>Op: queued and finished work
```

A kind with no preset and no explicit command is refused rather than run: the dialect table
falls back to `custom` for anything it does not know, which is right for a caller who asked
for custom and a silent wrong answer for one who asked for an agent this machine has never
heard of. `agentd_install` is this same path — the argv comes from the machine's own reported
`installs`, so the center never looks up a package name.

## 5. The agent against the graph

```mermaid
sequenceDiagram
  autonumber
  actor Ag as agent — any MCP client
  participant BO as board runs/ops.ts
  participant R as runs/service.ts
  participant RL as runs/rules.ts
  participant DB as board.sqlite — one transaction
  participant RD as tasks/rollup.ts

  Ag->>BO: board_sync with agentId kind channel host
  BO->>R: announce, and receive the board just joined
  R->>DB: putAgent(announced(previous, value, now))
  R-->>Ag: agent and agents and roots

  Ag->>BO: board_run_start with nodeId agentId kind channel sessionRef
  BO->>R: start — inside one transaction
  R->>RL: assertNodeExists — 404 when the task is missing
  R->>RL: assertStartable(runs.runningOn(nodeId))
  alt another run holds the node
    RL-->>Ag: 409 Node X is already running run R held by agent A
  else free
    R->>DB: putRun then if a leaf set the node to doing then event run.started
    R-->>Ag: 201 with the run
  end

  loop while it works
    Ag->>BO: board_run_progress with runId agentId note
    BO->>RL: assertHolds(run, agentId, runId)
    R->>DB: putRun with the note
    opt 1000 ms or more since this run last emitted
      R->>DB: event run.progress
    end
  end

  Ag->>BO: board_run_finish with runId agentId status summary
  BO->>RL: assertHolds — only the holder may report
  R->>DB: putRun with status endedAt summary
  R->>DB: leaf state becomes nodeStateFor(status) — done stays done and failed becomes blocked
  R->>DB: event run.finished or run.failed
  Note over R,DB: the run and the node state it changes commit in the same transaction

  Ag->>BO: board_state or board_tree
  BO->>RD: rollupTree(tasks, runs)
  RD-->>Ag: parent state derived from the leaves, plus kind progress running and interrupted
```

Three rules are visible in that diagram and nowhere else: a node has at most one running
run, only the holder may report, and board schedules nothing — the agent starts the run and
board records the claim. `channel` says how it arrived — `mcp-self` for this path, `probe`
for a run a machine reported on the agent's behalf, `runtime` for the in-process runtime.

**The dashed edge from section 1, drawn.** What is missing is not a rule inside board; it is
a caller. A launched agent reports to agentd (section 4.2) and to board only if it happens to
hold board's tools and chooses to use them:

```mermaid
sequenceDiagram
  autonumber
  participant PR as probe on the machine
  participant L as launch runner
  participant AG as agentd app
  participant BO as board app

  PR->>L: runner.run for intent I on node N
  L-->>PR: finished
  PR->>AG: POST /agentd/launch/report state done
  Note over PR,AG: the truth stops here — board never hears about intent I

  rect rgb(255, 235, 235)
    Note over BO: board_run_start accepts intentId in startRunSchema<br/>and runs/service.ts never writes it to the run — runSchema has no such field.<br/>Nothing in the repository outside apps/board calls board_run_start at all.
  end
```

Closing it is one seam: when a machine settles a launch intent that names a board node, board
should carry the run with `channel: "probe"` and `intentId` filled — so a launched agent and
a self-announced one land in the same record, which is what the two fields were added for.

## 6. Through the door

```mermaid
sequenceDiagram
  autonumber
  participant Ag as agent
  participant SRV as mcp-server.ts
  participant GW as gateway.ts handle
  participant SET as sets.ts setRegistry.resolve
  participant AZ as authorize.ts authorizeCall
  participant RU as rules.ts decideAction
  participant UP as upstream — stdio or streamable-http
  participant AU as access-audit.ts recorder

  Ag->>SRV: tools/call board_run_start
  SRV->>GW: handle with agent session tool args callId
  GW->>SET: resolve(agent, setId, tool)
  SET-->>GW: serverId setId allowed
  alt nothing resolves
    GW->>AU: error 404 no_server
    GW-->>Ag: 404
  else the set denies this tool
    GW->>AU: call then error 403 denied_by_set
    GW-->>Ag: 403
  else resolved and allowed by the set
    GW->>AU: call
    GW->>AZ: authorizeCall(authz, ctx)
    alt no principal or the principal is denied
      GW->>AU: authz then error 403 no_principal or denied_by_principal
      GW-->>Ag: 403
    else the principal is allowed
      GW->>RU: decideAction(rules, ctx, fallback)
      alt a rule denies
        GW->>AU: rule then error 403 denied_by_rule
        GW-->>Ag: 403
      else allowed
        GW->>UP: call with serverId tool args
        UP-->>GW: ok status durationMs
        GW->>AU: response or error, with redacted args when captureArgs is on
        GW-->>Ag: the result
      end
    end
  end
```

Identity is trusted only from standard transport headers (`x-agent-id`, `x-session-id`,
`x-request-id`) or a validated auth, and every path through this pipeline emits an audit
event. Real upstream endpoints and stdio commands never appear in agent configuration.

## 7. The tunnel

```mermaid
sequenceDiagram
  autonumber
  participant Ag as agent on a peer machine
  participant TR as tunnel-routes.ts
  participant TU as tunnel.ts forward
  participant EG as the platform egress-bound send
  participant Main as main node — ai-gateway or mcp-gateway

  Ag->>TR: POST to 127.0.0.1/agentd/tunnel/NAME/tail
  Note over Ag,TR: the agent is configured with one local address.<br/>What is behind it is chosen by policy, not by the caller.
  TR->>TR: name is the first segment and the tail is the rest plus the query
  TR->>TU: forward(name, tail, method headers body)
  TU->>TU: resolve the name among the registered upstreams
  TU->>EG: send as it arrived
  EG->>Main: request with nothing rewritten
  Main-->>EG: response
  EG-->>TU: response
  TU-->>TR: response
  TR-->>Ag: the response, passed through
  Note over TR,Ag: a forward that failed keeps its own status, so an egress 503 stays a 503.<br/>Anything with no status of its own failed on the wire and is a 502.
```

`GET /agentd/tunnel` lists the upstreams with their local paths; any other method there is a
405. The tunnel is not a second proxy with its own rules — it resolves a name and hands the
request to the platform's governed send, which is what keeps policy, credentials and audit in
one place.

## 8. Board's own start

```mermaid
sequenceDiagram
  autonumber
  participant M as makeBoard()
  participant DB as openBoardDatabase(file, policy)
  participant F as the file on disk
  participant RS as runStore

  M->>DB: open with dataFile and incompatibleStore
  DB->>F: busy_timeout 5000 then listTables()
  alt there are no tables
    DB->>F: createSchema — board_meta at VERSION 3 and the five tables
  else reasonFor() finds no reason
    DB-->>M: the same handle
  else incompatible — no board_meta or a different version or a different table set
    alt policy is clean
      DB->>F: rename to FILE.incompatible-STAMP with the wal and shm siblings
      DB->>F: then create a fresh store
    else policy is refuse
      DB-->>M: BoardError 409 — every byte left alone and board does not start
    end
  end
  M->>RS: orphanRunning()
  Note over RS: every run still marked running has no live agent behind it,<br/>so it becomes orphan. No endedAt is invented — board knows the run<br/>stopped being held, not when.
```

`orphan` is board's own finding and can never be an agent's claim, and the most recent run
decides whether a node is still reported as `interrupted`.

## 9. What these diagrams deliberately leave out

- **The kernel and artifact lifecycle.** `effect.bundle.json`, staging, activation, rollback,
  the ABI gate and kernel hot-swap are on the path between the host and every app, and only
  board ships a bundle. Drawn separately in `docs/architecture-rework.md` §7–8.
- **The console's own rendering.** `effect-ui.ts` and the public scripts in
  `apps/board/src/hosts/web/public/` are a client of the same `/api/*` routes the MCP tools
  are served on — which is the point of section 6, and why no second API exists to draw.
- **The unverified path.** The ssh collection in 4.1 is exercised against the collector
  script and a fake transport; this development machine has no sshd, so the live-remote
  success path has not been observed.
