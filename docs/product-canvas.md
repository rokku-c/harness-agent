# mantis product canvas (v1 · user correction)

> Purpose: pin "who it is for, what it solves, the minimal loop, what is explicitly out of scope" onto one page,
> so that every development round can be accepted. No feature code is written before this document is approved.

## 1. One-line positioning (corrected per the user's own words)
**mantis = a digital worker that behaves like a colleague**: it takes on work and does it like a person, but faster and parallel.
You (the operator) delegate work → mantis splits it into several work lines that advance in parallel (each line has its own conversation and memory),
writes to the shared workspace (records carry provenance and can be traced back), raises an approval card for protected writes asking you to let it through, and does not lose memory across a restart.
The console = its workbench + your supervision console (every work line's progress is visible, and you can step in at any time).

## 2. Target users and pain points
| User | Pain point | What mantis answers |
|---|---|---|
| The person delegating | an agent is either a one-off chat or needs someone watching every step | hand the work to it: it splits it up itself, drives it itself, and asks you only when needed |
| A team that needs "hands" | lots of mechanical/repetitive/parallelizable work | a digital worker is faster and runs several lines in parallel; people only supervise and gate |
| Team audit | no trail of who changed what | record-level provenance + an approval trail + state that survives a restart |

## 3. Core workflows (main scenarios)
**Loop A (delegate→parallel→approve→archive)**: you delegate a multi-step task → mantis splits it into work lines
(one per conversation) that advance in parallel: read memory → read/write the workspace → a protected write raises an approval card
(tool + input + which line it came from) → you let it through → it continues → the result lands in the workspace with its provenance and can be traced back.
**Loop B (parallel is visible)**: two work lines run at the same time, the supervision console shows their progress side by side, and you can step into either line at any time.
**Loop C (restarts are trustworthy)**: after a restart every line remembers the conversation, restores its enabled tools, and keeps its records as they were.
**Loop B (onboarding an external agent)**: the other side connects over MCP → it automatically gets memory + the tool surface +
approval semantics; one agents.md states the contract clearly.
**Loop C (restarts are trustworthy)**: after a process restart the same conversation remembers the dialogue, restores its enabled tools, and keeps its records as they were.

## 4. MVP scope (the UI does only these)
1. **Conversations**: one conversation per work line (messages + steps); pick a line to see progress; you can delegate/step in.
2. **Workspace**: every record it writes, grouped by resource + filtered by source + traceable; you can also write one by hand.
3. **Approvals**: pending cards (tool + input + which line it came from) approved/denied.
4. **System status**: health / approval toggle (minimal, top right).
> Reminders, dingtalk, and the event stream are all hidden/demoted to experiments and do not enter the first screen; A2UI was removed per your view (R31, outdated).

## 5. Explicitly out of scope (anti-scope)
- ❌ Claymorphism / childlike visuals (vetoed per your view)
- ❌ the perry route (dropped in R17)
- ❌ adding more new resource types or new tools (unless the canvas loop needs them)
- ❌ dingtalk/dws as a main battleground, multi-machine deployment, billing/multi-tenancy
- ❌ every kind of "capability showcase" UI (tools_catalog display and the like are left to the agent docs)

## 6. Visual and information-architecture baseline (restrained professional)
- Direction: **dark, information density first** (monitoring-console/Linear dark feel), stripping heavy ornament and light-washing;
- Layout: wide screen = top bar (brand/status) + left rail or top tabs (conversations/workspace/approvals) + main content;
  narrow screen = minimal bottom navigation (keeping the R19 responsive work);
- Principles: one task per screen; approval cards carry complete information; restrained provenance badges; no empty-state ornament.
> Small open items (they do not affect the canvas): the primary colour is either cool blue or warm orange; the font already uses the system stack.

## 7. Feature keep/drop mapping (current code → UI location)
| Capability (implemented, kept) | UI |
|---|---|
| workspace declarative resources + provenance | Store page |
| conversation timeline / durable memory | Conversations |
| enable + tool surface across restarts | Conversations status row (read-only display) |
| approvals + session context | Approvals |
| ~~ui_render (A2UI)~~ | removed (R31) |
| set_reminder / dingtalk | hidden/experimental |
| events/state API | System status (minimal, top right) |

## 8. Success criteria (this version counts as good)
- Delegate a multi-step task containing a protected write → it completes and reports without being watched, and approval is ≤3 clicks to let through;
- **Parallel**: two tasks delegated at once, both work lines complete and the supervision console shows them side by side (time ≈ one line);
- After a restart the same line's conversation + tool surface + records are all present (regression acceptance);
- In a 30-second screenshot you can say "this is a faster, parallel digital colleague".

## 9. Next steps (R22)
1. Roll back the clay light layer → a clean dark professional theme (keeping the R19 responsive work);
2. Converge to 3+1 screens per section 4 (conversations/workspace/approvals + top-right status), hide the experiments;
3. Turn the copy toward "digital colleague/delegate/work line" semantics;
4. Run Loop A end to end (including one approval) and record acceptance evidence; R23 then does the parallel (Loop B) acceptance.
