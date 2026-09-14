# App surfaces

Inventory of the views declared under `apps/*/src/effect-ui*.ts`. Vocabulary: `EffectUiView`
(`packages/effect-ui/src/spec.ts`) carries `state`, `sources` (`UiSourceSpec`,
`packages/effect-ui/src/data-spec.ts`), `actions` (`UiActionSpec`, the same file), the start screen
in `nodes`, and optional extra `screens` (`UiScreen`, `packages/effect-ui/src/screen-spec.ts`). A
source's body lands at its `state` pointer on success only; per-source health lives at the
reserved `/_sources/<id>`. An action has `url`, `opens`, or both. All nine apps declare `screens`
explicitly — none relies on derivation.

Every reference here is a file and not a line. A line number is what made the previous revision of
this document wrong in detail while it still read as authoritative: `effect-ui-table.ts` and
`effect-ui-forms.ts` were cited long after they were deleted. What a screen's second level means is
`UiScreen.parent` and `UiScreen.onEnter`, and a screen's parameter is written to the reserved
`/_nav/<name>` by the press that opens it — which is why a row press and a pasted address are one
arrival rather than two paths to keep in step.

## board

**What this app is for.** The board's console view (`apps/board/src/effect-ui.ts`): hierarchical
work items as one read, drawn two ways. The worktable and the columns wall lead — two shapes of the
one start screen rather than two screens — and every record entered from it is a destination: the
task a row opened, the form that writes a new one, the documents the board holds, one of those
documents as the outline it is, and the ring of what the board has done.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | Board | — | reads the worktable or the columns wall, filters by state and by exact title or id, switches shape, opens a task, the documents, the events, or the new-task form |
| `task` | Task | `board.load` | edits the title, body and state of the task the address names; saves or deletes it |
| `new` | New task | — | fills title, body and state, creates a task |
| `documents` | Documents | — | reads the documents the board holds, opens one as an outline, deletes one, creates one |
| `outline` | Outline | `board.loadDocument` | reads the document the address names at the version it was read at, and renames it or inserts a node into it |
| `events` | Events | — | reads the ring of what the board has done, and follows a row out to Activity filtered to this app |

**Sources** — `apps/board/src/effect-ui-state.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| table | `/board/api/table?columns=id,title,state,body,agent,waits,failure,parentTitle` | `/table` | 10000 |
| documents | `/board/api/documents` | `/documents` | 10000 |
| events | `/board/api/events?tail=50` | `/events` | 10000 |

There is no second read for the other shape: the worktable and the columns wall are the same tasks
seen twice, and a second fetch of the same list is a second copy to drift from the first
(`effect-ui-worktable.ts`, which builds the url from the union of what both shapes read). The other
two reads are separate data and not another view of the tasks: a document is a structure read at an
address of its own, and the ring is the board's history of everything it has done, task or document.
A declared view mounts every source it names with the view and not with a screen, so both of those
are read while the task list is on screen too (`effect-ui.ts`).

**Actions** — `apps/board/src/effect-ui-actions.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| board.new | — | — | — | `new` |
| board.open | — | — | — | `task` |
| board.openDocuments | — | — | — | `documents` |
| board.openDocument | — | — | — | `outline` |
| board.openEvents | — | — | — | `events` |
| board.create | POST | `/board/api/tasks` | `/createResult` | — |
| board.load | GET | `/board/api/tasks/{taskId}` | `/selected` | — |
| board.save | PATCH | `/board/api/tasks/{taskId}` | `/selectedResult` | — |
| board.delete | DELETE | `/board/api/tasks/{taskId}` | `/selectedResult` | — |
| board.retry | — | — | — | — |
| board.createDocument | POST | `/board/api/documents` | `/docResult` | — |
| board.deleteDocument | DELETE | `/board/api/documents/{docId}` | `/docResult` | — |
| board.loadDocument | GET | `/board/api/documents/{docId}` | `/outline/read` | — |
| board.retitle | POST | `/board/api/documents/{docId}` | `/outlineResult` | — |
| board.insertNode | POST | `/board/api/documents/{docId}` | `/outlineResult` | — |

The five doors open a screen and make no call of their own. `board.load` takes `{taskId}` from
`/_nav/taskId`, and `board.loadDocument` takes `{docId}` from `/_nav/docId` — which the press that
opened the screen wrote — so a row press and a pasted link are one act, and the screen's own
`onEnter` is the only read of the record. `board.create` sends `{title}`, `{body}` and `{state}`
from `/create/title`, `/create/body` and `/create/state`, and on success clears the two fields it
consumed and refreshes `table`. `board.save` sends `{taskId}` from `/selected/id` plus every field
on screen, and refreshes `table`; `board.delete` sends the same id and refreshes `table`.
`board.retry` makes no call and writes nothing: it names the `table` source and repeats that read
(`effect-ui-notices.ts`).

The three document writes take `{docId}` from the row that was pressed and, for the two that edit
an outline, `{version}` from `/outline/read/version` — the version the tree on screen was built
from, which is what makes a stale edit a refusal rather than a silently applied one. Each sends its
operation as `op`, a whole object read from a state path (`/outline/rename`, `/outline/insert`),
because an action's parameter can name a path and can never assemble an object: the screen's own
controls fill those two objects in (`effect-ui-outline-edits.ts`, `effect-ui-state.ts`). Both edits
clear the text field they consumed and refresh `board.loadDocument`, so the tree and the version it
is edited against move on together. `board.createDocument` sends `{title}` from `/docDraft/title`
and refreshes `documents`.

**Controls.**

| state path | control |
| --- | --- |
| `/view` | SegmentedControl.Root Worktable, Columns (`effect-ui-header.ts`) |
| `/filter` | SegmentedControl.Root All and the five states To do, Doing, Blocked, Done, Cancelled (`effect-ui-filter.ts`, `effect-ui-states.ts`) |
| `/query` | TextField.Root Exact title or id (`effect-ui-filter.ts`) |
| `/create/title` | TextField.Root Title (`effect-ui-fields.ts`) |
| `/create/body` | TextArea Body (`effect-ui-fields.ts`) |
| `/create/state` | Select.Root State, the same five states (`effect-ui-fields.ts`) |
| `/selected/title` | TextField.Root Title (`effect-ui-fields.ts`) |
| `/selected/body` | TextArea Body (`effect-ui-fields.ts`) |
| `/selected/state` | Select.Root State, the same five states (`effect-ui-fields.ts`) |
| `/docDraft/title` | TextField.Root Title (`effect-ui-documents.ts`) |
| `/outline/rename/title` | TextField.Root Document title (`effect-ui-outline-edits.ts`) |
| `/outline/insert/text` | TextField.Root Node text (`effect-ui-outline-edits.ts`) |
| `/outline/insert/parentId` | Select.Root First node under, options repeated from the read's top-level nodes (`effect-ui-outline-edits.ts`) |

The filter's field is a text field and not a search box, and it is labelled for what it does: a
condition compares and does not search — neither `visible` nor a node's `source` has a substring
operator (`value-spec.ts`) — so a row survives it on an exact match of the title or the id, and a
partial title matches no row.

Seeded, not a control: `/outline/rename` = `{kind: "retitle", title: ""}` and `/outline/insert` =
`{kind: "insert", parentId: null, index: 0, text: ""}` (`effect-ui-state.ts`) — an action's
parameter cannot be an object, so each of the two outline edits is one such object whose varying
field the control above the press writes into. The operations that vary per node — toggle, retitle,
move, remove — are therefore not offered on the outline screen: `op`'s `nodeId` is the one value
that cannot come from the row it is about, and the tree's rows carry no control
(`effect-ui-outline-tree.ts`).

**Screens declaration.** Explicit `screens` array (`apps/board/src/effect-ui.ts`).

## agentd

**What this app is for.** The machine center's console view (`apps/agentd/src/effect-ui.ts`): the
fleet. Machines, fleet agents, and the server-observed liveness derived from their leases lead on
the first screen; the four jobs entered from it are destinations: one fleet agent (read its
resolution, plan the push, ask for a turn), one machine (read its node's binding, plan that push),
the launch queue those jobs feed, and the MCP servers and the sets they are grouped in.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | agentd | — | reads the fleet agents, machines and liveness inventories; opens an agent, a machine, the launches, the servers |
| `agent` | Fleet agent | `agentd.desired` | reads the agent's resolution, plans the push, runs a turn |
| `machine` | Machine | `agentd.node` | reads the node's binding (kernel, placements), plans the push |
| `launches` | Launches | — | reads every intent asked of a machine and what became of it |
| `servers` | MCP servers | — | reads the servers a set can name and the sets that group them |

**Sources** — `apps/agentd/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| status | `/agentd` | `/status` | 10000 |
| launches | `/agentd/launch` | `/launches` | 8000 |

`status` is the whole fleet in one read — agents, machines, liveness, servers, sets — so the start
screen's inventories share one failure notice (`effect-ui-fleet.ts`) and the servers screen reads
it too (`effect-ui-servers.ts`); `launches` feeds the queue alone, which carries its own read
states (`effect-ui-launches.ts`).

**Actions** — `apps/agentd/src/effect-ui.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| agentd.openAgent | — | — | — | `agent` |
| agentd.openMachine | — | — | — | `machine` |
| agentd.openLaunches | — | — | — | `launches` |
| agentd.openServers | — | — | — | `servers` |
| agentd.desired | GET | `/agentd/desired?agentId={agentId}` | `/agent/resolution` | — |
| agentd.plan | GET | `/agentd/plan?agentId={agentId}` | `/agent/plan` | — |
| agentd.launch | POST | `/agentd/launch` | `/agent/launch` | — |
| agentd.node | GET | `/agentd/node?nodeId={nodeId}` | `/machine/binding` | — |
| agentd.nodePlan | GET | `/agentd/node/plan?nodeId={nodeId}` | `/machine/plan` | — |
| agentd.retryStatus | — | — | — | — |
| agentd.retryLaunches | — | — | — | — |

The four `open*` actions open a screen and make no call: the screen's own `onEnter` is the read, so
a row press and a pasted link are one arrival with one read behind both. `desired`, `plan`,
`launch`, `node` and `nodePlan` take their id from `/_nav/<name>` — `agentId` for the agent room,
`nodeId` for the machine room, written by the row press that opened the screen — so a plan runs
for the id the address names and never for the answer above it (`effect-ui-agent-room.ts`,
`effect-ui-machine-room.ts`). `desired` clears `/agent/plan` and `/agent/launch`, `node` clears
`/machine/plan`. `launch` reads `/launch/workdir` and `/launch/prompt` from state, clears
`/launch/prompt` and refreshes `launches`; the working directory stays, being a place the operator
works in rather than a value the turn took with it. The two retries make no call: each names its
own source and repeats that read.

**Controls.**

| state path | control |
| --- | --- |
| `/launch/workdir` | TextField.Root Working directory (`effect-ui-launch-form.ts`) |
| `/launch/prompt` | TextArea Prompt (`effect-ui-launch-form.ts`) |

A turn started by hand belongs to no task, so the form names no task node
(`effect-ui-launch-form.ts`).

**Screens declaration.** Explicit `screens` array (`apps/agentd/src/effect-ui.ts`).

## mantis

**What this app is for.** Mantis's console (`apps/mantis/src/effect-ui.ts`): the decisions holding a
protected call up, and the conversations this host has held. The waiting decisions and the
conversation list lead the start screen, under the doors to the destinations; a conversation's room,
the form that names one this console has not held, the record store, and the event ring are
destinations entered from those doors.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | Mantis | — | decides a waiting call (Allow/Deny); reads the conversation list; opens a room, the start form, records, events |
| `conversation` | Conversation | `mantis.conversation` | reads the timeline and this room's decisions; types a message, picks the send style, sends it |
| `start` | New conversation | — | names a conversation id this console has not held and opens its room |
| `records` | Records | — | reads the declared kinds and their records; adds a record; updates or deletes one by id |
| `events` | Recent events | — | reads the event ring as rows, and links to the console's Activity place |

**Sources** — `apps/mantis/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| state | `/mantis/api/state` | `/mantis/state` | 5000 |
| events | `/mantis/api/events?after=0` | `/mantis/events` | 5000 |
| records | `/mantis/api/workspace` | `/mantis/records` | 10000 |

The room's timeline is deliberately not a source: a source's address is declared, and this one's
carries the conversation id, which belongs to the address bar, so reading a room is a press
(`effect-ui.ts`).

**Actions** — `apps/mantis/src/effect-ui-actions.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| mantis.send | POST | `/mantis/api/message` | `/mantis/send` | — |
| mantis.openConversation | — | — | — | `conversation` |
| mantis.newConversation | — | — | — | `start` |
| mantis.openRecords | — | — | — | `records` |
| mantis.openEvents | — | — | — | `events` |
| mantis.conversation | GET | `/mantis/api/conversation?conversationId={conversationId}` | `/mantis/conversation` | — |
| mantis.allow | POST | `/mantis/api/approval/resolve` | `/mantis/decision` | — |
| mantis.deny | POST | `/mantis/api/approval/resolve` | `/mantis/decision` | — |
| mantis.recordAdd | POST | `/mantis/api/workspace` | `/mantis/recordAdd` | — |
| mantis.recordUpdate | PATCH | `/mantis/api/workspace` | `/mantis/recordUpdate` | — |
| mantis.recordDelete | DELETE | `/mantis/api/workspace?recordId={recordId}` | `/mantis/recordDelete` | — |

`mantis.conversation` takes `{conversationId}` from `/_nav/conversationId`, which the row press writes
by opening the screen — so a row press and a pasted address are one act, and the screen's own
`onEnter` is the only read. With no id it makes no call, and it is the press behind "Read the timeline
again", so a fired turn's reply is reached by the same read. `mantis.send` reads its style from
`/message/wait` and its text from `/message/text`, clears `/message/text`, and refreshes `state`,
`events` and `mantis.conversation`. `mantis.allow`/`mantis.deny` take `{callId, allow}` from the row
press, refresh `state` and `events`, and answer into one result path, `/mantis/decision`. The four
opens make no call: a destination is a behaviour like any other. The three record writes refresh
`records` and only read `/mantis/api/workspace` — the screen's word changed to records, the route is
the server's contract.

**Controls.**

| state path | control |
| --- | --- |
| `/message/text` | TextArea Message (`effect-ui-chat.ts`) |
| `/message/wait` | Switch Wait for the reply, `as: "checked"` (`effect-ui-chat.ts`) |
| `/start/id` | TextField.Root Conversation id (`effect-ui-conversations.ts`) |
| `/recordAdd/kind` | Select.Root Kind, items repeated from `/mantis/records/resources` (`effect-ui-record-forms.ts`) |
| `/recordAdd/text` | TextArea Text (`effect-ui-record-forms.ts`) |
| `/recordEdit/recordId` | TextField.Root Record id (`effect-ui-record-forms.ts`) |
| `/recordEdit/text` | TextField.Root Replacement text (`effect-ui-record-forms.ts`) |

**Screens declaration.** Explicit `screens` array of four screens (`effect-ui.ts`); the start screen
is the top-level `nodes`.

## ai-gateway

**What this app is for.** The AI Gateway console (`apps/ai-gateway/src/effect-ui.ts`): the model
plane. The first screen answers three questions in order — what this is, what it has carried,
then the providers, the screen's own task — so the provider table, under the usage figures
counted from the same read, leads; the exchanges behind those figures, the routing rules and the
upstream endpoints are read-only destinations entered from the header's doors.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | AI Gateway | — | reads the usage figures and the provider table; probes one provider with Test; opens one of the three lists |
| `exchanges` | Exchanges | — | reads the twenty newest exchanges, each a request with the answer it got |
| `rules` | Routing rules | — | reads which rules match a request, what each injects and where |
| `endpoints` | Upstream endpoints | — | reads the paths the gateway answers on |

No screen declares `onEnter`, and that is the design rather than an omission: the three doors
carry nothing on the way in, because every list they show is part of the read the console already
keeps, so each screen is complete when it is entered and none of them makes a call
(`effect-ui.ts`).

**Sources** — `apps/ai-gateway/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| models (`MODEL_SOURCE`, `effect-ui-nodes.ts`) | `/models` | `/models` | 10000 |

One source carries all four lists, so the verdict of the source cannot say that any one of them
is empty: each list asks its own first row, and loading and failure are stated once per screen
above everything they cover (`effect-ui-nodes.ts`).

**Actions** — `apps/ai-gateway/src/effect-ui.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| gateway.testProvider | POST | `/models/providers/{providerId}/test` | `/health/result` | — |
| gateway.exchanges | — | — | — | `exchanges` |
| gateway.rules | — | — | — | `rules` |
| gateway.endpoints | — | — | — | `endpoints` |

`gateway.testProvider` takes `{providerId}` from the row press and not from `/_nav/...`: the
press carries the row's own `id`, and the answer lands at `/health/result`, where only the row it
names shows it (`effect-ui-providers.ts`). The three doors make no call and take no parameter,
each only opening its screen. No action clears a path or refreshes a source; the answer under
Test is the record of the last press, not a live reading, and stays on its row until the next one
(`effect-ui-providers.ts`).

**Controls.**

| state path | control |
| --- | --- |
| — | Button Test, one per provider row, pressing `gateway.testProvider` with `{providerId}` (`effect-ui-providers.ts`) |

No control binds a state path: the console reads the plane and its only write is Test, and the
header's posture line states that providers and rules are set in this app's configuration
(`effect-ui-header.ts`).

**Screens declaration.** Explicit `screens` array (`effect-ui.ts`).

## mcp-gateway-app

**What this app is for.** The MCP gateway console (`apps/mcp-gateway-app/src/effect-ui.ts`): it asks
whether one principal reaches one tool, and why not. The question leads; the answer, the principals
directory, the topology the door decides by, and the records of what it decided are destinations
entered from it.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | MCP Gateway | — | chooses a principal and a tool, presses Preview; opens Principals, Topology, Audit |
| `access` | Access decision | `gateway.previewAccess` | reads whether the call was allowed or denied, the reasons, the sets the principal is bound to, and the one edit that would change a denial |
| `grants` | Grant editor | — | reads the edit a denial named, on the principal and the entry it named; opens Topology |
| `principals` | Principals | — | reads the directory and every token; issues a token, turns a principal off or on, revokes a token |
| `topology` | Topology | — | reads the servers and tools the door offers, the sets and bindings, at the revision shown |
| `audit` | Audit | — | reads what the door decided, newest first |

**Sources** — `apps/mcp-gateway-app/src/effect-ui-source.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| topology | `/mcp-gateway` | `/gateway` | 10000 |
| audit | `/mcp-gateway/audit` | `/audit` | 10000 |
| identities | `/mcp-gateway/identities` | `/identities` | 10000 |

The source id and its URL segment still say `identities`; every word the console prints says
principal (`effect-ui-paths.ts`). All three share one ten-second cadence: they answer one subject at
three depths, and refreshing one faster could paint a refusal over a stale topology.

**Actions** — `apps/mcp-gateway-app/src/effect-ui-actions.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| gateway.openAccess | — | — | — | `access` |
| gateway.openPrincipals | — | — | — | `principals` |
| gateway.openTopology | — | — | — | `topology` |
| gateway.openAudit | — | — | — | `audit` |
| gateway.openGrants | — | — | — | `grants` |
| gateway.showEveryServer | — | — | — | `topology` |
| gateway.previewAccess | GET | `/mcp-gateway/access` | `/access/result` | — |
| gateway.issueToken | POST | `/mcp-gateway/tokens` | `/issue/result` | — |
| gateway.dismissToken | GET | `/mcp-gateway/identities` | `/issue/dismissed` | — |
| gateway.disablePrincipal | POST | `/mcp-gateway/principals/status` | `/principals/result` | — |
| gateway.enablePrincipal | POST | `/mcp-gateway/principals/status` | `/principals/result` | — |
| gateway.revokeToken | POST | `/mcp-gateway/tokens/revoke` | `/principals/revoked` | — |
| gateway.readTopology … readDirectory | — | — | — | — |

The six doors open a screen and make no call. `gateway.openAccess` — the Preview press — carries
`{agent, tool}` from `/access/agent` and `/access/tool` into `/_nav/agent` and `/_nav/tool`, which
`gateway.previewAccess` reads on arrival, so a press and a pasted link are one act; the question's
choice stays in view state, which a Back press would otherwise erase. `gateway.openGrants` — J7's
one fixing action — carries the *answer's* own values, off
`/access/result/access/fixing/{setId,list,tool,serverId}`, into `/_nav/{setId,list,entry,serverId}`:
a press from a denial and a colleague's pasted link render the same editor, so neither needs the
denial to still be on screen. `gateway.showEveryServer` opens the screen it already stands on
carrying nothing, which is how the topology's `?serverId=` filter is dropped; that filter is read
at `/_nav/serverId` and never written here.
`gateway.issueToken` takes the draft from `/issue/draft/{kind,id,name,days}`, clears
`/issue/draft/id` and refreshes `identities`; `gateway.dismissToken` calls the directory read the
principals screen is already about, lands its answer on a path nothing reads, and clears
`/issue/result`. `disablePrincipal` and `enablePrincipal` send only a literal status, with
`{kind, id}` off the row, and `revokeToken` sends the row's `{tokenHash}`; all three refresh
`identities`. The three reads make no call and write nothing.

**Controls.**

| state path | control |
| --- | --- |
| `/access/agent` | Select.Root Principal, options repeated from `/identities/principals` (`effect-ui-question.ts`) |
| `/access/tool` | Select.Root Tool, options repeated from `/gateway/tools` (`effect-ui-question.ts`) |
| `/issue/draft/kind` | Select.Root Kind, fixed items `app`, `user`, `system` (`effect-ui-issue.ts`) |
| `/issue/draft/id` | TextField.Root Id (`effect-ui-issue.ts`) |
| `/issue/draft/name` | TextField.Root Display name (`effect-ui-issue.ts`) |
| `/issue/draft/days` | TextField.Root Days until expiry (`effect-ui-issue.ts`) |

There is no `Copy` control beside the revealed token, and its absence is deliberate: a press runs a
declared action, the console has no clipboard action, and a button that claimed to copy and did not
would be worse than a mono value the operator selects (`effect-ui-issue.ts`).

Sets and bindings are read here and never written *by this app*: they are declared in the agentd
center, and a set the console wrote would be a set the door never enforces, because the door reads
the center (`effect-config.ts`). What a refusal therefore carries is the *edit* that would change
it — the reason and the one fixing action, from one switch, so the two cannot drift
(`access-reasons.ts`) — and that edit is a press, not a form: `Add read to staging` — the set's own
id, not its display name — opens the grant editor on the principal and the entry the engine named,
and a link to it renders the same screen. The grant editor holds no control: every value on it is a
`/_nav` parameter, and its last card names where the declaration is made rather than offering a
press that would fail (`effect-ui-grant-editor.ts`).

**Screens declaration.** Explicit `screens` array (`apps/mcp-gateway-app/src/effect-ui.ts`) listing
the five entered screens; the start screen is `nodes`, which no view names.

## mcp-registry-app

**What this app is for.** The registry console (`apps/mcp-registry-app/src/effect-ui.ts`): the
catalogue the gateway decides from, so it is a read first and an act second. The server list leads;
registering a server, withdrawing one, rotating a token and previewing a `ui://` resource one
declares are destinations entered from that list, and the three that act on a record carry that
server's token — or, when it is lost, its replacement — on their own screen.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | MCP Registry | — | reads the server list (version, era, status, declared `ui://` resources); opens Register or Preview |
| `register` | Register a server | — | pastes a declaration, enters that server's token, registers |
| `withdraw` | Withdraw a server | — | enters the named server's token and withdraws it; opens Rotate token when that token is lost |
| `rotate` | Rotate a server token | — | enters a new token for the named server, replacing the one it presented before |
| `preview` | Preview a resource | — | names a server id and a `ui://` uri, loads the body (a page, an image, or text) |

No screen declares `onEnter`: the read a move makes is the press on its own screen, and the list a
move changes is re-read by that act's `refresh`. There is no Withdraw door on the start screen:
removing a server is authorized by that server's own token, and the start screen has nowhere to
enter one, so the act belongs to the row that already names the server (`effect-ui-list.ts`). The
`Rotate token` door is on the withdraw screen for the same reason turned around: it is the one
route out of the dead end an operator meets there — a token they cannot produce — so it stands
under the field that asks for one and carries the server that screen already names.

**Sources** — `apps/mcp-registry-app/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| registry | `/mcp-registry` | `/registry` | 10000 |

One read behind the whole surface, with its health at `/_sources/registry`. `register` and
`withdraw` refresh it; `rotate` and `preview` each act on something the list does not state — a
credential it never holds, a resource on another server's own endpoint — so neither refreshes it,
and the list is re-read by the two acts that change a record.

**Actions** — `apps/mcp-registry-app/src/effect-ui.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| registry.openRegister | — | — | — | `register` |
| registry.openWithdraw | — | — | — | `withdraw` |
| registry.openRotate | — | — | — | `rotate` |
| registry.openPreview | — | — | — | `preview` |
| registry.register | POST | `/mcp-registry/register` | `/register/result` | — |
| registry.withdraw | DELETE | `/mcp-registry/withdraw` | `/withdraw/result` | — |
| registry.rotate | POST | `/mcp-registry/rotate` | `/rotate/result` | — |
| registry.preview | GET | `/mcp-registry/preview` | `/preview/result` | — |
| registry.retry | — | — | — | — |

The four opens are declared in `effect-ui-list.ts`, each act's action beside its screen, and the
retry in `effect-ui-registry-source.ts`. The start screen's doors carry nothing; the row's Preview
and Withdraw presses each carry `{serverId}` from the row, which the open writes to
`/_nav/serverId` — a row press and a pasted link are one act — and the rotate door on the withdraw
screen carries the id that screen is already naming. `register` takes `{declaration}` from
`/register/declaration` and `{token}` from `/register/token`, clears the token, and refreshes
`registry`; `withdraw` takes `{serverId}` from `/_nav/serverId` and `{token}` from
`/withdraw/token`, and refreshes `registry`; `rotate` takes `{serverId}` from `/_nav/serverId` and
`{newToken}` from `/rotate/token`, clears the token, and refreshes nothing, because the credential
it replaced is not a field of any row; `preview` takes `{serverId}` from `/_nav/serverId` and
`{uri}` from `/_nav/uri`, and refreshes nothing. `registry.retry` makes no call: it names `registry`
and repeats that read, so the verdict at `/_sources/registry` stays the runtime's to write.

**Controls.**

| state path | control |
| --- | --- |
| `/register/declaration` | TextArea Server declaration (`effect-ui-register.ts`) |
| `/register/token` | TextField.Root password Server token (`effect-ui-register.ts`) |
| `/withdraw/token` | TextField.Root password Server token (`effect-ui-withdraw.ts`) |
| `/rotate/token` | TextField.Root password New server token (`effect-ui-rotate.ts`) |
| `/_nav/serverId` | TextField.Root Server id (`effect-ui-preview.ts`) |
| `/_nav/uri` | TextField.Root Resource URI (`effect-ui-preview.ts`) |

**Screens declaration.** Explicit `screens` array (`effect-ui.ts`).

## ui-host

**What this app is for.** The UI Canvas app view (`apps/ui-host/src/effect-ui.ts`): it inspects
the runtime that draws declarative UI. The canvases and the canvas in view lead; one canvas's
document, the theme every canvas is drawn in, what a canvas can be built from, and what the
agents announced are destinations entered from that list.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | UI Canvas | — | reads the canvas in view and the canvas list; opens one canvas |
| `canvas` | Canvas | `uiHost.loadCanvas` | reads one canvas's resolved identity, version and nodes |
| `theme` | Theme | — | picks the theme every canvas is drawn in, reads the one in use, commits it |
| `catalog` | Catalog | — | reads registered component types and extensions |
| `announcements` | Announcements | — | reads what the agents using this canvas announced |

**Sources** — `apps/ui-host/src/effect-ui-sources.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| runtime | `/ui/api/runtime` | `/runtime` | 5000 |
| canvases | `/ui/api/canvases` | `/canvases` | 5000 |
| components | `/ui/api/components` | `/components` | — |
| extensions | `/ui/api/extensions` | `/extensions` | — |
| activity | `/ui/api/activity` | `/activity` | 5000 |

There is no `renderers` read and no renderer control: the host serves the web renderer directly,
so a canvas an agent authored and a screen an app declared cannot disagree about what a component
means (`flows.md` §7.7, dead end 1). One less read is the point rather than an omission.

**Actions** — `apps/ui-host/src/effect-ui.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| uiHost.openCanvas | — | — | — | `canvas` |
| uiHost.openTheme | — | — | — | `theme` |
| uiHost.openCatalog | — | — | — | `catalog` |
| uiHost.openAnnouncements | — | — | — | `announcements` |
| uiHost.loadCanvas | GET | `/ui/api/canvas` | `/canvas/loaded` | — |
| uiHost.setTheme | POST | `/ui/api/command` | `/commands/results/theme` | — |
| uiHost.retryRuntime … retryActivity | — | — | — | — |

`loadCanvas` takes `{canvasId}` from `/_nav/canvasId`, which the row press writes by opening the
screen — so a row press and a pasted link are one act, and the screen's own `onEnter` is the only
read. `setTheme` sends fixed `{kind: "set-theme"}` plus `{theme}` from `/commands/theme`, refreshes
`runtime`. The five retries make no call and write nothing: each names its own source and repeats
that read (`effect-ui-sources.ts`).

**Controls.**

| state path | control |
| --- | --- |
| `/commands/theme` | Select.Root Theme, fixed items `default`, `warm-paper`, `dusk` (`effect-ui-theme.ts`) |

**Screens declaration.** Explicit `screens` array (`apps/ui-host/src/effect-ui.ts`).

## deckconsole

**What this app is for.** The deck control room (`apps/deckconsole/src/effect-ui.ts`): the asks
waiting on an operator, which are the presses that release a blocked agent, and the sessions the
deck is running. The queue and the session list lead; the form that starts a session and the
catalogue of what it can be started as are destinations entered from the doors above them.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | Deck control room | — | decides a waiting ask (Allow/Deny); opens a session; closes one or all |
| `new` | Open session | — | picks an agent kind, an optional session id and prompt, and the consent policy; opens a session |
| `session` | Session | `deck.load` | sends a turn, retries the last, answers a decision, reads the transcript |
| `catalog` | Launchers and presets | — | reads saved launchers and CLI presets; removes a launcher |

**Sources** — `apps/deckconsole/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| deck | `/deck/api/deck` | `/deck` | 5000 |
| launchers | `/deck/api/launchers` | `/launchers` | 10000 |
| presets | `/deck/api/presets` | `/presets` | 10000 |

The one `deck` read carries both lists of the start screen, so each states its own emptiness: an
answer holding six arrays can never report that one of them is empty (`effect-ui-pending.ts`).
Nothing on `catalog` reads `deck`, so that screen reports no failure but the ones it makes itself.

**Actions** — `apps/deckconsole/src/effect-ui-actions.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| deck.new | — | — | — | `new` |
| deck.catalog | — | — | — | `catalog` |
| deck.open | — | — | — | `session` |
| deck.openCreated | — | — | — | `session` |
| deck.load | GET | `/deck/api/session/{sessionId}/history` | `/opened` | — |
| deck.reloadSession | GET | `/deck/api/session/{sessionId}/history` | `/opened` | — |
| deck.create | POST | `/deck/api/session` | `/result/open` | — |
| deck.close | POST | `/deck/api/session/{sessionId}/close` | `/result/session` | — |
| deck.closeAll | POST | `/deck/api/sessions/close-all` | `/result/session` | — |
| deck.send | POST | `/deck/api/session/{sessionId}/send` | `/result/turn` | — |
| deck.retry | POST | `/deck/api/session/{sessionId}/retry` | `/result/retry` | — |
| deck.allow | POST | `/deck/api/consent/{callId}` | `/result/consent` | — |
| deck.deny | POST | `/deck/api/consent/{callId}` | `/result/consent` | — |
| deck.removeLauncher | DELETE | `/deck/api/launchers/{label}?kind={kind}` | `/result/launcher` | — |
| deck.reload | GET | `/deck/api/deck` | — | — |
| deck.reloadLaunchers | GET | `/deck/api/launchers` | — | — |
| deck.reloadPresets | GET | `/deck/api/presets` | — | — |

`deck.load` and `deck.reloadSession` are one read of a session's history, and both take `{sessionId}`
from `/_nav/sessionId` — which the opening row's press writes by opening the screen, so a row press
and a pasted link are one act and `onEnter` is the screen's only read. `deck.load` clears
`/message/text`, `/result/turn` and `/result/retry`, because a draft carried in from another session
is a turn addressed to the wrong agent; `deck.reloadSession` is what a reader already here repeats
and clears nothing. `deck.openCreated` carries no call — a press's parameters resolve before it — and
takes the id the create answered with. The room's own presses carry that same answered id
(`/opened/sessionId`), not the one in the address, so what is on screen is what is sent.

`deck.create` takes `{kind, sessionId, prompt, config}` from `/create/*`, clears `/create/sessionId`
and `/create/prompt`, refreshes `deck`. `deck.close`, `deck.closeAll`, `deck.send`, `deck.retry`,
`deck.allow` and `deck.deny` each refresh `deck` and `deck.load`: a turn, a close and a consent all
move the transcript, so the screen a decision was made from reads it again. `deck.send` also clears
`/message/text`; the row presses supply `{sessionId}`, `{callId, allow}` and `{label, kind}`, and
`deck.removeLauncher` is the one that refreshes `launchers`. The three retries name their own source
in `refresh` and set no `result`: the verdict worth reading is the source's own, at `/_sources/<id>`.

**Controls.**

| state path | control |
| --- | --- |
| `/create/kind` | Select.Root Agent kind, options repeated from `/deck/kinds` and `/presets/presets` (`effect-ui-new.ts`) |
| `/create/sessionId` | TextField.Root Session id optional (`effect-ui-new.ts`) |
| `/create/prompt` | TextArea Prompt (`effect-ui-new.ts`) |
| `/create/config/consent/defaultDecision` | SegmentedControl.Root, fixed items `ask`, `allow`, `deny` (`effect-ui-consent.ts`) |
| `/create/config/consent/autoApproveTools/$0`–`/$3` | TextField.Root Tool name, four slots (`effect-ui-consent.ts`) |
| `/message/text` | TextArea Turn text (`effect-ui-room.ts`) |

`Close` and `Close all` carry no confirmation: `flows.md` §6.3 and `design-system.md` §11.3 give a
destructive press one shape, `AlertDialog`, and this layer cannot build it.

**Screens declaration.** Explicit `screens` array (`effect-ui.ts`).

## herdr-app

**What this app is for.** The Herdr console (`apps/herdr-app/src/effect-ui.ts`): the terminal agents a
running Herdr server owns, live over its socket API. The fleet leads; the three jobs off it — work one
agent, start an agent, read the workspaces one can be started in — are destinations.

**Screens.**

| id | title | onEnter | what the user does there |
| --- | --- | --- | --- |
| — (start) | Herdr | — | reads the fleet as a table, each row carrying the last lines its agent printed; opens one agent or a door |
| `agent` | Terminal agent | — | reads what one agent is printing and its scrollback; sends it a message or a key; brings it forward |
| `start` | Start an agent | — | names an agent, gives it a kind, picks a workspace, starts it |
| `workspaces` | Workspaces | — | reads the workspaces Herdr has open, which one is in front, what each one holds |

**Sources** — `apps/herdr-app/src/effect-ui.ts`.

| id | url | state | refreshMs |
| --- | --- | --- | --- |
| agents | `/herdr/agents?tail=12` | `/herdr/agents` | 5000 |
| workspaces | `/herdr/workspaces` | `/herdr/workspaces` | 30000 |

There is no source per agent: a source is a fixed url fetched verbatim, so the agent a read is about
cannot ride in the address. The fleet's read carries a 12-line tail of each agent instead, which is
what makes the agent screen live; its longer read is addressed by `/_nav/target`, not a source
(`effect-ui-output.ts`).

**Actions** — `apps/herdr-app/src/effect-ui-actions.ts`.

| name | method | url | result | opens |
| --- | --- | --- | --- | --- |
| herdr.openStart | — | — | — | `start` |
| herdr.openWorkspaces | — | — | — | `workspaces` |
| herdr.openAgent | — | — | — | `agent` |
| herdr.readFleet | GET | `/herdr/agents?tail=12` | — | — |
| herdr.readWorkspaces | GET | `/herdr/workspaces` | — | — |
| herdr.agentOutput | GET | `/herdr/agents/{target}/output` | `/herdr/result/agentOutput` | — |
| herdr.agentPrompt | POST | `/herdr/agents/{target}/prompt` | `/herdr/result/agentPrompt` | — |
| herdr.agentStart | POST | `/herdr/agents` | `/herdr/result/agentStart` | — |
| herdr.agentFocus | POST | `/herdr/agents/{target}/focus` | `/herdr/result/agentFocus` | — |
| herdr.agentEscape | POST | `/herdr/agents/{target}/keys` | `/herdr/result/agentEscape` | — |
| herdr.agentInterrupt | POST | `/herdr/agents/{target}/keys` | `/herdr/result/agentInterrupt` | — |

The three `open*` actions make no call: entering a screen is a behaviour, and no screen here is
filled by entering it — both reads run on the app's own cadence while any screen is up, so the
agent screen draws its output from `agents` rather than from an `onEnter`. `herdr.openAgent` is
the only press carrying a value of its own — the row's `pane_id`, written to `/_nav/target` — so a
row press and a pasted link are one arrival.
`herdr.agentOutput` takes `{target}` from `/_nav/target` plus fixed `{source: "recent", lines: 200}`:
it is the operator's one-shot read of the same terminal, longer than the tail the source carries,
and not what fills the screen. `herdr.agentPrompt` takes `{text}` from `/herdr/draft/message`,
clears that draft and refreshes
`agents`; `herdr.agentStart` takes `{name}`, `{kind}` and `{workspaceId}` from `/herdr/draft/*`, clears
nothing (the name and kind are what the next start reuses) and refreshes both reads;
`herdr.agentFocus` refreshes both; `herdr.agentEscape` and `herdr.agentInterrupt` take `{keys}` from
`/herdr/keys/escape` and `/herdr/keys/interrupt` and refresh `agents`. A source cannot be re-run by a
press, so the two repeatable reads are actions of their own: `herdr.readFleet` and
`herdr.readWorkspaces` make the read's own call and refresh that source — the call is what the failure
was about, and the refresh clears the verdict at `/_sources/<id>/error`.

**Controls.**

| state path | control |
| --- | --- |
| `/herdr/draft/startName` | TextField.Root Name (`effect-ui-start.ts`) |
| `/herdr/draft/startKind` | TextField.Root Kind (`effect-ui-start.ts`) |
| `/herdr/draft/startWorkspace` | Select.Root Workspace, options repeated from the workspaces read's rows (`effect-ui-start.ts`) |
| `/herdr/draft/message` | TextArea Message (`effect-ui-commands.ts`) |

Seeded, not a control: `/herdr/keys/escape` = `["esc"]`, `/herdr/keys/interrupt` = `["ctrl+c"]`
(`effect-ui.ts`) — an action's parameter cannot be an array, so a press reads the sequence by path.

**Screens declaration.** Explicit `screens` array (`effect-ui.ts`); the fleet is the view's own nodes.

---

Row count of the combined action tables: 98 (board 15, agentd 11, mantis 11, ai-gateway 4, mcp-gateway-app 13, mcp-registry-app 9, ui-host 7, deckconsole 17, herdr-app 11).
