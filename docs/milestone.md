# Milestone: the agentdeck component + the deckconsole product (30 rounds of autonomous iteration)

## Goal locations
- Component: packages/agentdeck (@effect-agent/agentdeck) — three-surface abstraction control
- Product: apps/deckconsole — the control room (a local admin UI + HTTP API)

## Where the three requirements land (see docs/agentdeck-map.md for the goal→code→test matrix)
1. Flow control (open/close/send/status/transcript/timeout/abort/kill process group) → types.ts SessionGateway + 5 adapters
2. session→consent mapping (ledger/mapping/auto policy/bulk/approval-driven real execution) → consent.ts + effect-ops
3. config→unified mapping (dialect normalization/lossless/invocation plan preview) → config.ts + cliInvocation

## Agents covered
- In-process: effect (the in-house runtime), effect-ops (the approval execution loop), claude-cc (SDK), demo (built-in demonstration)
- CLI: claude-code (real-machine verified) / codex / gemini (positional arguments per 0.24) / pi / custom
- Any new dialect: register at run time with POST /api/presets (the *claw family); a reserved name gives 409

## Verification evidence
- Regression: 283 tests / 46 files 0 fail; tsc (fullscope) clean
- Reproducible acceptance: bun apps/deckconsole/scripts/acceptance.ts (11 no-key items)
  REAL=1 (plus a real-machine claude-code answer, 13 items exit 0)
- Real machine: the deckconsole UI/API genuinely drives claude-code end to end (answer, multi-turn, precise transcript)
- Browser-checked screenshots (archived at apps/deckconsole/docs/screens/):
  r4-deckconsole.png home page  r4-config-preview.png config preview  r5-detail.png session detail
  r10-flow.png consent flow  r11-invoke.png invocation plan  r12-policy-ui.png policy UI
  r17-overview.png full-page overview  r22-dynpreset.png dynamic dialect  r23-freetext.png free text
  r24-real-ui.png real-machine UI answer  r38-final.png final overview
- Guided acceptance: docs/tour.md (step-by-step expected state)

## Boundaries (items requiring the user)
- codex/pi: the sandbox blocks ~/.codex ~/.pi home writes; gemini: interactive OAuth not logged in;
  the effect real model: needs a usable provider key; authoritative Gate access into driver.run is a core/loop change (deferred)
