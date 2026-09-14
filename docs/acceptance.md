# mantis acceptance matrix

Every layer of the product has an acceptance bar, and the only way to clear one is
to see it happen in a real running instance: a real model or a real browser.

There is no suite dimension. `AGENTS.md` forbids unit tests, so no row below can be
cleared by a test — a row marked `[ ]` was previously backed by one and is now
unverified until someone runs it live. A release is only shippable when every row
is `[L]`.

Legend: [L] verified live (this build) · [ ] not yet verified live · [·] evidence link

## L0 core (effect-agent foundation)
- [L] session loop runs one model turn to a FinalReply (decode tolerates prose)
- [ ] failed tool step injects one reflection then continues
- [ ] per-conversation history binding materializes prior turns

## L1 capability manifest (single source of the surface)
- [ ] supply registry, ops, catalog descriptions all derive from the manifest (no drift)
- [ ] tier economy: core always visible, extended appears only after enable
- [ ] manifest names == session op surface, in order

## L2 resources (declarations drive records + ops)
- [ ] one append op per declared resource, kind + copy single-sourced
- [ ] adding a new declared resource flows into manifest + supply with no op code
- [ ] recall filters by kind; read returns every kind
- [ ] update_record + delete_record declared (impl resource.update/.delete); the
  session op surface still matches the manifest exactly (no drift)
- [ ] durable mutations: update/delete op-lines replay on reload; update of a
  missing id is undefined/false, delete of a missing id is an error

## L3 human UI (derived, no per-resource code)
- [ ] /api/workspace round trip over MCP: write, read, unknown kind rejected
- [L] Workspace tab renders label / write badge / records from the declaration   -> real Chrome (R3): tab click, add task, auto refresh

## L4 shared durable workspace (one store, humans + agents)
- [ ] JSONL persistence: reload, id continuation, corrupted lines skipped
- [ ] sessions share the injected store; human UI writes land in agent-visible store
- [ ] operator record mutations (PATCH/DELETE /api/workspace via MCP) land in
  the same shared store the agent sessions read
- [L] process restart keeps records; fresh agent conversation recalls them       -> live (R4, mantis host)

## Approvals (operator gate, cards-only)
- [ ] protected write waits; resolve allow/deny commits or denies
- [ ] approvals render + resolve over HTTP/MCP

## Agent UI - REMOVED in R31 (superseded by user direction; no A2UI surface)

## Release smoke (real model, one live instance)
Legacy note: A2UI / ui_render were removed in R31; smokes below are historical.
Last smoke: R5 (real model deepseek-v4-flash, live instance on 3750): catalog ->
enable ui_render + task_write -> form render -> button click -> task_write ->
workspace has "冒烟测试任务-按钮回传" ("smoke-test task - button callback"). Evidence: SELFUSE.md R5.
R9 regression re-run (same build lineage, CLAWYP_PROTECTED=task_write):
  - protected agent write -> pending -> operator approve -> committed (source agent)
  - A2UI form -> button submit -> second protected write -> approve -> landed
  - operator seed record stays source "ui"
  Evidence: SELFUSE.md R9.
R15 restart rows (real model, memoryDir): agent enables note_read -> restart ->
same conversation reports note_read VISIBLE without re-enabling (tool surface
restored); /api/health ok. Evidence: SELFUSE.md R15.
