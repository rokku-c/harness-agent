# mantis acceptance matrix

Every layer of the product has an acceptance bar. "suite" = covered by the bun
test suite (run: `bun test` at repo root; clawyp tests under apps/clawyp/test).
"live" = verified against a real running instance (real model or real browser).
Checkmarks are updated by each release smoke; a release is only shippable when
every row below is checked.

Legend: [s] suite green · [L] verified live (this build) · [·] evidence link

## L0 core (effect-agent foundation)
- [s] session loop runs one model turn to a FinalReply (decode tolerates prose)   -> test/failures.test.ts
- [s] failed tool step injects one reflection then continues                     -> packages/builtin loop tests
- [s] per-conversation history binding materializes prior turns                  -> test/clawyp.test.ts, dingtalk

## L1 capability manifest (single source of the surface)
- [s] supply registry, ops, catalog descriptions all derive from the manifest (no drift)
- [s] tier economy: core always visible, extended appears only after enable
- [s] manifest names == session op surface, in order                             -> test/capabilities.test.ts

## L2 resources (declarations drive records + ops)
- [s] one append op per declared resource, kind + copy single-sourced            -> test/resources.test.ts
- [s] adding a new declared resource flows into manifest + supply with no op code
- [s] recall filters by kind; read returns every kind
- [s] update_record + delete_record declared (impl resource.update/.delete); the
  session op surface still matches the manifest exactly (no drift)              -> test/mutation.test.ts
- [s] durable mutations: update/delete op-lines replay on reload; update of a
  missing id is undefined/false, delete of a missing id is an error           -> test/mutation.test.ts

## L3 human UI (derived, no per-resource code)
- [s] /api/workspace round trip over MCP: write, read, unknown kind rejected     -> test/webui.test.ts
- [L] Workspace tab renders label / write badge / records from the declaration   -> real Chrome (R3): tab click, add task, auto refresh

## L4 shared durable workspace (one store, humans + agents)
- [s] JSONL persistence: reload, id continuation, corrupted lines skipped        -> test/durable.test.ts
- [s] sessions share the injected store; human UI writes land in agent-visible store
- [s] operator record mutations (PATCH/DELETE /api/workspace via MCP) land in
  the same shared store the agent sessions read                             -> test/mutation.test.ts (REST smoke R20)
- [L] process restart keeps records; fresh agent conversation recalls them       -> live (R4, mantis host)

## Approvals (operator gate, cards-only)
- [s] protected write waits; resolve allow/deny commits or denies                -> test/clawyp.test.ts
- [s] approvals render + resolve over HTTP/MCP                                   -> test/webui.test.ts, test/mcp.test.ts

## Agent UI (A2UI v0.9 official catalog)
- [s] invalid renders sanitize: strict schema violations repair or degrade with a visible reason
- [L] real-model render on the console is versioned and replayable               -> live (R2/R3)
- [L] button events round trip: [ui.action] name + values back to the agent      -> smoke R5: real model renders a form
  (TextField /form/task + Button submit_task), /api/ui/action click arrives as
  [ui.action], agent records the typed task into the shared workspace

## Release smoke (real model, one live instance)
Last smoke: R5 (real model deepseek-v4-flash, live instance on 3750): catalog ->
enable ui_render + task_write -> form render -> button click -> task_write -> 
workspace has "冒烟测试任务-按钮回传". Evidence: SELFUSE.md R5.
R9 regression re-run (same build lineage, CLAWYP_PROTECTED=task_write):
  - protected agent write -> pending -> operator approve -> committed (source agent)
  - A2UI form -> button submit -> second protected write -> approve -> landed
  - operator seed record stays source "ui"
  Evidence: SELFUSE.md R9.
R15 restart rows (real model, memoryDir): agent enables note_read -> restart ->
same conversation reports note_read VISIBLE without re-enabling (tool surface
restored); /api/health ok. Evidence: SELFUSE.md R15.
