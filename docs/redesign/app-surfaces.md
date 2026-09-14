# App surfaces

Inventory of the views declared under `apps/*/src/effect-ui*.ts`. Vocabulary: `EffectUiView`
(`packages/effect-ui/src/spec.ts:57`) carries `state`, `sources` (`UiSourceSpec`,
`packages/effect-ui/src/data-spec.ts:12`), `actions` (`UiActionSpec`,
`packages/effect-ui/src/data-spec.ts:29`), the start screen in `nodes`, and optional extra
`screens` (`UiScreen`, `packages/effect-ui/src/screen-spec.ts:21`). A source's body lands at its
`state` pointer on success only; per-source health lives at the reserved `/_sources/<id>`. An
action has `url`, `opens`, or both. All nine apps declare `screens` explicitly — none relies on
derivation.

## board

**What this app is for.** The board's console (`apps/board/src/effect-ui.ts:1-16`): hierarchical
work items as one source read three ways — a worktable, a columns wall — plus the two editable
records. An operator dispatches work, watches for blockers and failures, creates a task, and
opens one to save or delete it.

**Screens.** Start screen is `nodes`; three screens total (one per thing an operator is doing).

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | Board | reads the worktable or columns, filters by state, switches shape, opens a task or the new-task form |
| `task` | Opened task | `onEnter: board.load`; edits title/body/state of the opened task, saves, deletes |
| `new` | New task | fills title/body/state and creates a task |

**Sources** — `apps/board/src/effect-ui.ts:44`; url built at `apps/board/src/effect-ui-table.ts:18`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 44 | table | `/board/api/table?columns=id,title,state,body,agent,waits,failure,parentTitle` | `/table` | 10000 |

**Actions** — `apps/board/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 47 | board.new | — | — | — | `new` |
| 51 | board.open | — | — | — | `task` |
| 52 | board.create | POST | `/board/api/tasks` | `/createResult` | — |
| 57 | board.load | GET | `/board/api/tasks/{taskId}` | `/selected` | — |
| 59 | board.save | PATCH | `/board/api/tasks/{taskId}` | `/selectedResult` | — |
| 60 | board.delete | DELETE | `/board/api/tasks/{taskId}` | `/selectedResult` | — |

`board.create` clears `/create/title`, `/create/body`, refreshes `table`; `board.load` takes
`{taskId}` from `/_nav/taskId`; `board.save`/`board.delete` take `{taskId}` from `/selected/id`
and refresh `table`.

**Controls.**

| state path | control |
| --- | --- |
| `/view` | SegmentedControl.Root, Worktable/Columns (`effect-ui-header.ts:22`) |
| `/filter` | SegmentedControl.Root chips All + 5 states (`effect-ui-table.ts:76`) |
| `/create/title`, `/create/body`, `/create/state` | TextField / TextArea / Select (`effect-ui-forms.ts:21-23`) |
| `/selected/title`, `/selected/body`, `/selected/state` | TextField / TextArea / Select (`effect-ui-forms.ts:49-51`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:76-79`).

## agentd

**What this app is for.** The agentd console (`apps/agentd/src/effect-ui.ts:1-18`): the fleet on
the first screen — machines, agents, and server-observed liveness — and four jobs entered from
it. An operator reads each agent's and machine's desired vs. reported revision, plans a push,
asks an agent for a turn, reads the launch queue, and reads the registry those bindings are
assembled from.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | agentd | reads Agents, Machines, Liveness inventories; opens an agent, a machine, the launch queue, the registry |
| `agent` | Agent | `onEnter: agentd.desired`; reads the agent's resolution, plans the push, runs a turn |
| `machine` | Machine | `onEnter: agentd.node`; reads the node's binding (kernel, placements), plans the push |
| `launches` | Launches | reads every intent asked of a machine and its outcome |
| `registry` | MCP registry | reads MCP servers and the sets they are grouped in |

**Sources** — `apps/agentd/src/effect-ui.ts:43-46`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 44 | status (`STATUS_SOURCE`, `effect-ui-nodes.ts:27`) | `/agentd` | `/status` | 10000 |
| 45 | launches | `/agentd/launch` | `/launches` | 8000 |

**Actions** — `apps/agentd/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 50 | agentd.openAgent | — | — | — | `agent` |
| 51 | agentd.openMachine | — | — | — | `machine` |
| 52 | agentd.openLaunches | — | — | — | `launches` |
| 53 | agentd.openRegistry | — | — | — | `registry` |
| 59 | agentd.desired | GET | `/agentd/desired?agentId={agentId}` | `/inspect/desired` | — |
| 61 | agentd.plan | GET | `/agentd/plan` | `/inspect/plan` | — |
| 65 | agentd.launch | POST | `/agentd/launch` | `/inspect/launch` | — |
| 66 | agentd.node | GET | `/agentd/node?nodeId={nodeId}` | `/inspect/node` | — |
| 68 | agentd.nodePlan | GET | `/agentd/node/plan` | `/inspect/nodePlan` | — |

`agentd.desired` takes `{agentId}` from `/_nav/agentId`, clears `/inspect/plan`,
`/inspect/launch`; `agentd.launch` clears `/launch/prompt` and refreshes `launches`;
`agentd.node` takes `{nodeId}` from `/_nav/nodeId`, clears `/inspect/nodePlan`.
`agentd.plan`/`agentd.nodePlan` take their id from the answer they are rendered in
(`effect-ui-agent-room.ts:37`, `effect-ui-machine-room.ts:36`).

**Controls.**

| state path | control |
| --- | --- |
| `/launch/workdir` | TextField.Root Working directory (`effect-ui-launch.ts:37`) |
| `/launch/prompt` | TextArea Prompt (`effect-ui-launch.ts:38`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:84-89`).

## mantis

**What this app is for.** Mantis's console (`apps/mantis/src/effect-ui.ts:1-17`): human–agent
conversations, the approvals holding an agent up, and workspace records. An operator decides
pending approvals, reads and continues a conversation, starts one the console has not held,
edits workspace records, and reads the event log.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | Mantis | reads pending approvals and held conversations; opens a room, the start form, workspace, events |
| `conversation` | Conversation | `onEnter: mantis.conversation`; reads the timeline, types and sends a message |
| `start` | New conversation | names a conversation id the console has not held and enters its room |
| `workspace` | Workspace | reads declared resources and their records; adds a record; updates or deletes one by id |
| `events` | Recent events | reads the event ring as rows |

**Sources** — `apps/mantis/src/effect-ui.ts:46-50`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 47 | state | `/mantis/api/state` | `/mantis/state` | 5000 |
| 48 | events | `/mantis/api/events?after=0` | `/mantis/events` | 5000 |
| 49 | workspace | `/mantis/api/workspace` | `/mantis/workspace` | 10000 |

**Actions** — `apps/mantis/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 55 | mantis.send | POST | `/mantis/api/message` | `/mantis/send` | — |
| 59 | mantis.openConversation | — | — | — | `conversation` |
| 60 | mantis.newConversation | — | — | — | `start` |
| 61 | mantis.openWorkspace | — | — | — | `workspace` |
| 62 | mantis.openEvents | — | — | — | `events` |
| 67 | mantis.conversation | GET | `/mantis/api/conversation?conversationId={conversationId}` | `/mantis/conversation` | — |
| 70 | mantis.allow | POST | `/mantis/api/approval/resolve` | `/mantis/approval` | — |
| 71 | mantis.deny | POST | `/mantis/api/approval/resolve` | `/mantis/approval` | — |
| 72 | mantis.workspaceAdd | POST | `/mantis/api/workspace` | `/mantis/workspaceAdd` | — |
| 73 | mantis.workspaceUpdate | PATCH | `/mantis/api/workspace` | `/mantis/workspaceUpdate` | — |
| 74 | mantis.workspaceDelete | DELETE | `/mantis/api/workspace?recordId={recordId}` | `/mantis/workspaceDelete` | — |

`mantis.send` has fixed param `{wait: true}`, clears `/message/text`, refreshes `state`,
`events`, `mantis.conversation`. `mantis.conversation` takes `{conversationId}` from
`/_nav/conversationId` and clears `/message/text`. `mantis.allow`/`deny` take `{callId, allow}`
from the row press and refresh `state`, `events`. Every workspace write refreshes `workspace`.

**Controls.**

| state path | control |
| --- | --- |
| `/message/text` | TextArea Message (`effect-ui-chat.ts:49`) |
| `/start/id` | TextField.Root Conversation id (`effect-ui-conversations.ts:36`) |
| `/workspaceAdd/kind` | Select.Root Kind, options repeated from `/mantis/workspace/resources` (`effect-ui-workspace-forms.ts:17-23`) |
| `/workspaceAdd/text` | TextArea Text (`effect-ui-workspace-forms.ts:30`) |
| `/workspaceEdit/recordId` | TextField.Root Record id (`effect-ui-workspace-forms.ts:42`) |
| `/workspaceEdit/text` | TextField.Root Replacement text (`effect-ui-workspace-forms.ts:43`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:92-97`).

## ai-gateway

**What this app is for.** The AI Gateway console (`apps/ai-gateway/src/effect-ui.ts:1-17`): the
model plane. It presents what the gateway is, the usage figures it is carrying, and the providers
— every upstream the operator can ask to answer — then routes the three read-only lists
(activity, rules, endpoints) to screens of their own.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | AI Gateway | reads figures and the provider table; probes one provider with Test |
| `activity` | Recent activity | reads the twenty newest exchanges behind the figures |
| `rules` | Routing rules | reads which rules rewrite a request |
| `endpoints` | Upstream endpoints | reads which paths the gateway answers on |

**Sources** — `apps/ai-gateway/src/effect-ui.ts:33`; id at `effect-ui-nodes.ts:15`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 33 | models (`MODEL_SOURCE`) | `/models` | `/models` | 10000 |

**Actions** — `apps/ai-gateway/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 35 | gateway.testProvider | POST | `/models/providers/{providerId}/test` | `/health/result` | — |
| 39 | gateway.activity | — | — | — | `activity` |
| 40 | gateway.rules | — | — | — | `rules` |
| 41 | gateway.endpoints | — | — | — | `endpoints` |

`gateway.testProvider` takes `{providerId}` from the row press (`effect-ui-providers.ts:30`); no
`clear` or `refresh` declared on any action.

**Controls.** None declared. The only interactive control is the per-row `Test` press; every
other node is a bind or repeat read.

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:57-61`).

## mcp-gateway-app

**What this app is for.** The gateway console (`apps/mcp-gateway-app/src/effect-ui.ts:1-21`): who
may reach which server, and why. The first screen asks the access question and nothing else; the
identities directory, the topology that decides, and the decision log are screens reached from
the doors, in the order of a request's own journey — identified, then authorized, then recorded.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | MCP Gateway | chooses an identity and a tool, presses Preview, reads Allowed/Denied and the reasons |
| `identities` | Identities | issues a token (shown once), turns an identity on/off, revokes a token |
| `topology` | Topology | reads servers, sets, and agent→set bindings |
| `audit` | Recent decisions | reads what the gateway decided, newest first |

**Sources** — `apps/mcp-gateway-app/src/effect-ui.ts:70-74`; identities url/path at
`effect-ui-nodes.ts:54-58`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 71 | topology | `/mcp-gateway` | `/gateway` | 10000 |
| 72 | audit | `/mcp-gateway/audit` | `/audit` | 10000 |
| 73 | identities | `/mcp-gateway/identities` | `/identities` | 10000 |

**Actions** — `apps/mcp-gateway-app/src/effect-ui.ts:42-58`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 43 | gateway.previewAccess | GET | `/mcp-gateway/access` | `/access/result` | — |
| 44 | gateway.issueToken | POST | `/mcp-gateway/tokens` | `/issue/result` | — |
| 52 | gateway.revokeToken | POST | `/mcp-gateway/tokens/revoke` | `/revoke/result` | — |
| 53 | gateway.setStatus | POST | `/mcp-gateway/principals/status` | `/principal/result` | — |
| 55 | gateway.openIdentities | — | — | — | `identities` |
| 56 | gateway.openTopology | — | — | — | `topology` |
| 57 | gateway.openAudit | — | — | — | `audit` |

`gateway.previewAccess` takes `{agent}` from `/access/agent`, `{tool}` from `/access/tool`.
`gateway.issueToken` takes `{kind, id, displayName, ttlDays}` from
`/issue/draft/{kind,id,name,days}`, clears `/issue/draft/id`, refreshes `identities`.
`revokeToken` takes `{tokenHash}` from the row press; `setStatus` takes `{kind, id, status}` from
the row press; both refresh `identities`.

**Controls.**

| state path | control |
| --- | --- |
| `/access/agent` | Select.Root identity chooser, options repeated from `/identities/principals` (`effect-ui-choices.ts:48`) |
| `/access/tool` | Select.Root tool chooser, options repeated from `/gateway/tools` (`effect-ui-choices.ts:51`) |
| `/issue/draft/kind` | Select.Root Kind, items app/user/system (`effect-ui-issue.ts:28-36`) |
| `/issue/draft/id` | TextField.Root Id (`effect-ui-issue.ts:44`) |
| `/issue/draft/name` | TextField.Root Name (`effect-ui-issue.ts:45`) |
| `/issue/draft/days` | TextField.Root Expires in days (`effect-ui-issue.ts:46`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:82-86`).

## mcp-registry-app

**What this app is for.** The registry console (`apps/mcp-registry-app/src/effect-ui.ts:1-17`):
the servers it holds on the first screen, plus the three moves around them. Each move carries the
credential it needs on its own screen, because the registry holds one token per server id.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | MCP Registry | reads the server list (version, era, status, declared ui:// resources); opens Withdraw |
| `register` | Register a server | pastes a declaration, enters that server's token, registers |
| `withdraw` | Withdraw a server | enters the named server's token and withdraws it |
| `preview` | Preview a resource | names a server id and a `ui://` uri, loads the body (text, html, or image) |

**Sources** — `apps/mcp-registry-app/src/effect-ui.ts:36`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 36 | registry | `/mcp-registry` | `/registry` | 10000 |

**Actions** — `apps/mcp-registry-app/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 40 | registry.openRegister | — | — | — | `register` |
| 41 | registry.openWithdraw | — | — | — | `withdraw` |
| 42 | registry.openPreview | — | — | — | `preview` |
| 43 | registry.register | POST | `/mcp-registry/register` | `/register/result` | — |
| 44 | registry.withdraw | DELETE | `/mcp-registry/withdraw` | `/withdraw/result` | — |
| 45 | registry.preview | GET | `/-/registry/preview` | `/preview/result` | — |

`registry.openWithdraw` takes `{serverId}` from the row press. `register` takes `{token}` from
`/register/token`, `{declaration}` from `/register/declaration`, refreshes `registry`. `withdraw`
takes `{serverId}` from `/_nav/serverId`, `{token}` from `/withdraw/token`, refreshes
`registry`. `preview` takes `{serverId}` from `/preview/serverId`, `{uri}` from `/preview/uri`.

**Controls.**

| state path | control |
| --- | --- |
| `/register/declaration` | TextArea Server declaration (`effect-ui-register.ts:34`) |
| `/register/token` | TextField.Root password Server token (`effect-ui-register.ts:35`) |
| `/withdraw/token` | TextField.Root password Server token (`effect-ui-withdraw.ts:38`) |
| `/preview/serverId` | TextField.Root Server id (`effect-ui-preview.ts:37`) |
| `/preview/uri` | TextField.Root Resource URI (`effect-ui-preview.ts:38`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:54-58`).

## ui-host

**What this app is for.** The UI Canvas app view (`apps/ui-host/src/effect-ui.ts:1-15`): it
inspects and controls the declarative UI runtime. The canvases and the canvas in view lead; the
renderer/theme control surface, the catalog of what the runtime can draw, and the record of what
the agents announced are destinations.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | UI Canvas | reads the canvas in view and the canvas list; Inspects one canvas's document |
| `renderer` | Renderer and theme | picks a renderer and a theme, reads the values in use, commits each |
| `catalog` | Catalog | reads registered component types and extensions |
| `activity` | Activity | reads what agents using this canvas announced |

**Sources** — `apps/ui-host/src/effect-ui.ts:38-45`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 39 | runtime | `/ui/api/runtime` | `/runtime` | 5000 |
| 40 | canvases | `/ui/api/canvases` | `/canvases` | 5000 |
| 41 | renderers | `/ui/api/renderers` | `/renderers` | — |
| 42 | components | `/ui/api/components` | `/components` | — |
| 43 | extensions | `/ui/api/extensions` | `/extensions` | — |
| 44 | activity | `/ui/api/activity` | `/activity` | 5000 |

**Actions** — `apps/ui-host/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 48 | uiHost.openRenderer | — | — | — | `renderer` |
| 49 | uiHost.openCatalog | — | — | — | `catalog` |
| 50 | uiHost.openActivity | — | — | — | `activity` |
| 51 | uiHost.setRenderer | POST | `/ui/api/command` | `/commands/results/renderer` | — |
| 52 | uiHost.setTheme | POST | `/ui/api/command` | `/commands/results/theme` | — |
| 53 | uiHost.loadCanvas | GET | `/ui/api/canvas` | `/canvas/loaded` | — |

`setRenderer` sends fixed `{kind: "set-renderer"}` plus `{renderer}` from `/commands/renderer`,
refreshes `runtime`. `setTheme` sends fixed `{kind: "set-theme"}` plus `{theme}` from
`/commands/theme`, refreshes `runtime`. `loadCanvas` takes `{canvasId}` from the row press.

**Controls.**

| state path | control |
| --- | --- |
| `/commands/renderer` | Select.Root Renderer, options repeated from `/renderers` (`effect-ui-command.ts:14-23`) |
| `/commands/theme` | Select.Root Theme, fixed items `default`, `warm-paper`, `dusk` (`effect-ui-command.ts:26-35`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:72-76`).

## deckconsole

**What this app is for.** The deck control room (`apps/deckconsole/src/effect-ui.ts:1-19`): the
asks waiting on an operator (which release an agent) and the sessions the deck is running. A
row's Open enters a session's own screen; the header's doors open the form that starts one and
the launchers/presets it can be started as.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | Deck control room | decides pending consent (Allow/Deny); opens a session; closes one or all |
| `new` | Open session | picks an agent kind, optional session id and prompt, opens a session |
| `session` | Session | `onEnter: deck.load`; sends a turn, retries the last, reads the transcript |
| `catalog` | Launchers and presets | reads saved launchers and CLI presets; removes a launcher |

**Sources** — `apps/deckconsole/src/effect-ui.ts:43-47`.

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 44 | deck | `/deck/api/deck` | `/deck` | 5000 |
| 45 | launchers | `/deck/api/launchers` | `/launchers` | 10000 |
| 46 | presets | `/deck/api/presets` | `/presets` | 10000 |

**Actions** — `apps/deckconsole/src/effect-ui.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 50 | deck.new | — | — | — | `new` |
| 51 | deck.catalog | — | — | — | `catalog` |
| 55 | deck.open | — | — | — | `session` |
| 58 | deck.load | GET | `/deck/api/session/{sessionId}/history` | `/opened` | — |
| 60 | deck.create | POST | `/deck/api/session` | `/result/open` | — |
| 66 | deck.close | POST | `/deck/api/session/{sessionId}/close` | `/result/session` | — |
| 67 | deck.closeAll | POST | `/deck/api/sessions/close-all` | `/result/session` | — |
| 71 | deck.send | POST | `/deck/api/session/{sessionId}/send` | `/result/turn` | — |
| 73 | deck.retry | POST | `/deck/api/session/{sessionId}/retry` | `/result/turn` | — |
| 74 | deck.allow | POST | `/deck/api/consent/{callId}` | `/result/consent` | — |
| 75 | deck.deny | POST | `/deck/api/consent/{callId}` | `/result/consent` | — |
| 76 | deck.removeLauncher | DELETE | `/deck/api/launchers/{label}?kind={kind}` | `/result/launcher` | — |

`deck.open` takes `{sessionId}` from the row press. `deck.load` takes `{sessionId}` from
`/_nav/sessionId`, clears `/message/text` and `/result/turn`. `deck.create` takes
`{kind, sessionId, prompt}` from `/create/*`, clears `/create/sessionId`, `/create/prompt`,
refreshes `deck`. `deck.close`/`closeAll` refresh `deck` and `deck.load`. `deck.send`/`retry`
refresh `deck` and `deck.load`; `send` clears `/message/text`. `deck.allow`/`deny` take
`{callId, allow}` from the row press, refresh `deck`. `deck.removeLauncher` takes `{label, kind}`
from the row press, refreshes `launchers`.

**Controls.**

| state path | control |
| --- | --- |
| `/create/kind` | Select.Root Agent kind, options repeated from `/deck/kinds` and `/presets/presets` (`effect-ui-kinds.ts:24-34`) |
| `/create/sessionId` | TextField.Root Session id optional (`effect-ui-session.ts:52`) |
| `/create/prompt` | TextArea Prompt (`effect-ui-session.ts:53`) |
| `/message/text` | TextArea Turn text (`effect-ui-session.ts:69`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:92-96`).

## herdr-app

**What this app is for.** The Herdr console (`apps/herdr-app/src/effect-ui.ts:1-25`): the agents
of one running Herdr server, live over its socket API. Two reads on different timers — the agent
listing carries a 12-line tail because a source fetches a fixed url. The console is four screens,
one per function; the socket it is pointed at is named in the header.

**Screens.**

| id | title | what the user does there |
| --- | --- | --- |
| — (start) | Herdr | reads the fleet as cards (lifecycle, pane, cwd, tail); opens one or a door |
| `agent` | Agent | `onEnter: herdr.agentOutput`; reads the terminal, sends a message, Esc, Interrupt, Focus |
| `start` | Start an agent | names it, gives a kind, picks a workspace, starts it |
| `workspaces` | Workspaces | reads the workspaces Herdr has open, which is focused, which wants attention |

**Sources** — `apps/herdr-app/src/effect-ui.ts:61-64`; paths via `sourcePath`
(`effect-ui-nodes.ts:22`).

| line | id | url | state | refreshMs |
| --- | --- | --- | --- | --- |
| 62 | workspaces | `/herdr/workspaces` | `/herdr/workspaces` | 30000 |
| 63 | agents | `/herdr/agents?tail=12` | `/herdr/agents` | 5000 |

**Actions** — `apps/herdr-app/src/effect-ui-actions.ts`.

| line | name | method | url | result | opens |
| --- | --- | --- | --- | --- | --- |
| 29 | herdr.openStart | — | — | — | `start` |
| 30 | herdr.openWorkspaces | — | — | — | `workspaces` |
| 31 | herdr.agentStart | POST | `/herdr/agents` | `/herdr/result/agentStart` | — |
| 42 | herdr.openAgent | — | — | — | `agent` |
| 37 | herdr.agentPrompt | POST | `/herdr/agents/{target}/prompt` | `/herdr/result/agentPrompt` | — |
| 47 | herdr.agentOutput | GET | `/herdr/agents/{target}/output` | `/herdr/result/agentOutput` | — |
| 51 | herdr.agentFocus | POST | `/herdr/agents/{target}/focus` | `/herdr/result/agentFocus` | — |
| 55 | herdr.agentKeys | POST | `/herdr/agents/{target}/keys` | `/herdr/result/agentKeys` | — |

`herdr.agentStart` takes `{name, kind, workspaceId}` from `/herdr/draft/*`, clears
`/herdr/draft/startName`, refreshes both sources. `herdr.agentPrompt` takes `{target}` from the
press and `{text}` from `/herdr/draft/message`, clears the message draft, refreshes `agents`.
`herdr.agentOutput` sends fixed `{source: "recent", lines: 200}` and `{target}` from
`/_nav/target`. `agentFocus` refreshes both sources; `agentKeys` refreshes `agents`.

**Controls.**

| state path | control |
| --- | --- |
| `/herdr/draft/startName` | TextField.Root Name (`effect-ui-start.ts:37`) |
| `/herdr/draft/startKind` | TextField.Root Kind (`effect-ui-start.ts:38`) |
| `/herdr/draft/startWorkspace` | Select.Root Workspace, options repeated from `/herdr/workspaces/workspaces` (`effect-ui-start.ts:26-33`) |
| `/herdr/draft/message` | TextArea Message, on both the start-adjacent panel and the opened panel (`effect-ui-opened.ts:48`) |

Seeded, not user-editable: `/herdr/keys/escape` = `["esc"]` and `/herdr/keys/interrupt` =
`["ctrl+c"]` (`effect-ui-nodes.ts:56`), carried as action params rather than controls.

**Screens declaration.** Explicit `screens` array (`effect-ui.ts:84-88`).

---

**Row count of the combined action tables: 69** (board 6, agentd 9, mantis 11, ai-gateway 4,
mcp-gateway-app 7, mcp-registry-app 6, ui-host 6, deckconsole 12, herdr-app 8).
