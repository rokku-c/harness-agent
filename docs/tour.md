# deckconsole guided acceptance (text version, paired with screenshot paths)

> Each step gives the "expected screen state"; screenshot paths are listed below so you can open them and compare.

## Start
    DECK_PORT=4851 bun apps/deckconsole/src/main.ts
    Browser http://127.0.0.1:4851

## Step 1 · Get to know the home page (/tmp/r17-overview.png, /tmp/r4-deckconsole.png)
- Five blocks: sessions and agents / session→consent mapping / config→unified mapping preview / consent flow / session detail
- Above: kind selector + session label + [Open session] + session-level consent policy inputs (auto-approved tools, default decision)
- Top-line counters: agents N · sessions N · pending N

## Step 2 · Open a session and send messages freely (/tmp/r23-freetext.png)
- kind=demo, any label → open session → a session row appears in the table
- The row has a "prompt input + send" (Enter works too); it also carries greet/trigger approval/close/detail shortcut buttons
- Type ask:read {"path":"/x"} → send → a toast shows the reply and read pending appears in the consent flow

## Step 3 · Approval and mapping (/tmp/r12-policy-ui.png, /tmp/r10-flow.png)
- approve/reject at the end of a consent flow row → after the decision it carries a by marker (auto/operator)
- The mapping panel count goes +1; set the policy to autoApproveTools: note_write,read and open the session again,
  and triggering an approval goes straight to allow by auto without entering pending
- Bulk: "approve all (bulk)" at the head of the flow clears every pending item at once

## Step 4 · Config normalization and the invocation plan (/tmp/r4-config-preview.png, /tmp/r11-invoke.png)
- In the preview area pick a kind and fill in the raw config (e.g. claude-code model) → it shows the unified config and the spawn invocation plan
- The raw sample for each kind is at /api/config/samples

## Step 5 · Launch groups and dialect registration (/tmp/r22-dynpreset.png)
- Launch group chips + add/remove; after registering a new dialect (POST /api/presets), "dynamic dialect" appears automatically in all three dropdowns
- A conflicting name returns 409

## Step 6 · Detail and the multi-turn transcript
- Detail in the row → the session detail panel: the user/agent transcript + that session's consent log (with a failed-turn hint)

## Step 6.5 · Session protection and recovery
- Sending again while the same session is running → 409 busy (single flight); opening a duplicate same-name session → 409 already open
- After approving a suspended (awaiting) turn: POST /api/session/:id/retry re-sends it verbatim, no need to paste the prompt again
- A launch group can carry a raw config (cwd/env etc.): hover a chip to see the config summary, click to open a session with that config

## Step 7 · A real agent (/tmp/r24-real-ui.png)
- kind=claude-code, open a real session → type any prompt in the row → send → the real answer lands in the transcript
- One-shot acceptance: bun apps/deckconsole/scripts/acceptance.ts (11 no-key items)
  REAL=1 ... (plus the real-machine claude section, 13 items, exit 0)

## Known boundaries (items needing your involvement)
- codex/pi: the sandbox blocks home writes (~/.codex ~/.pi EPERM); gemini: interactive OAuth not logged in;
  the effect real model: needs a usable provider key — once the authorization/key is in place we fill in the real-machine smoke run
