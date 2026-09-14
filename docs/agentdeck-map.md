# agentdeck: goal → location matrix

> Every one of the user's goals (three requirements + product packaging) mapped to a repo location and the case that once proved it. The test suite behind those proofs was deleted 2026-09-14, so the Proof column is a record of what was checked then, not a check that can be run today.

## Requirement 1 · Control flows such as opening sessions
| Capability | Location | Proof (deleted suite) |
|---|---|---|
| Session lifecycle open/close/send/status/sessions/history | packages/agentdeck/src/types.ts (SessionGateway/SessionTurn) + adapters/ | the flow group |
| Registration aggregating several agents | packages/agentdeck/src/registry.ts (AgentDeck) | the registry aggregation case |
| effect in-process driver | adapters/effect.ts | the effect flow case |
| claude-code in-process SDK | adapters/claude-sdk.ts | the claude-cc case |
| Generic CLI (claude-code -p/codex/gemini/pi/custom) | adapters/cli.ts + cliInvocation | the fake CLI process + timeout abort case |
| Write-operation approval gating, abortable | adapters/effect-ops.ts | the effect-ops allow/deny cases |

## Requirement 2 · session → consent mapping
| Capability | Location | Proof (deleted suite) |
|---|---|---|
| Ledger ask/allow/deny, by/time recorded | packages/agentdeck/src/consent.ts (makeConsentLedger) | the consent group cases |
| mapping() per-session mapping | same as above | the s1/s2 mapping case |
| Auto decision from the auto allowlist/default decision | the product session policy (deckconsole) + config.consent | round8/12 e2e (allow by auto/deny) |
| Approval-driven real execution | adapters/effect-ops.ts (Effect.die aborts → approve and re-send executes) | effect-ops + the product-level loop e2e |

## Requirement 3 · config → unified mapping
| Capability | Location | Proof (deleted suite) |
|---|---|---|
| normalizeConfig(kind, raw) dialect normalization | packages/agentdeck/src/config.ts | per-kind normalization assertions (codex/gemini/pi/model) |
| extra kept lossless | same as above, extraOf | the lossless assertion |
| consent policy passthrough (allow/deny) | same as above, consentOf | the deny passthrough assertion |
| CLI invocation plan visualization | cli.ts cliInvocation + the product's preview.invocation | the cliInvocation case + the page display |

## Product packaging · deckconsole (apps/deckconsole)
- HTTP API + a dark admin page: sessions/approvals (policy+bulk)/consent flow/session detail/config normalization + invocation plan/
  launch groups (DECK_FILE persistence)/one-button close-all/runtime dialect registration (POST /api/presets)
- Start: DECK_PORT=4851 bun apps/deckconsole/src/main.ts → http://127.0.0.1:4851
- Page screenshots: apps/deckconsole/docs/screens/r4-deckconsole.png, apps/deckconsole/docs/screens/r4-config-preview.png, apps/deckconsole/docs/screens/r5-detail.png,
  apps/deckconsole/docs/screens/r10-flow.png, apps/deckconsole/docs/screens/r11-invoke.png, apps/deckconsole/docs/screens/r12-policy-ui.png

## Regression baseline
- the suite that used to be the baseline (agentdeck 14 + deckconsole 10; full 278, 0 fail) was deleted 2026-09-14; tsc(fullscope) clean
