# agentdeck：目标 → 落点 对照矩阵

> 用户目标（三条需求 + 产品封装）的每一条对应到仓库位置与测试证明。

## 需求 1 · 控制开启会话等流程
| 能力 | 落点 | 证明 |
|---|---|---|
| 会话生命周期 open/close/send/status/sessions/history | packages/agentdeck/src/types.ts（SessionGateway/SessionTurn）+ adapters/ | test/agentdeck.test.ts flow 组 |
| 注册聚合多个 agent | packages/agentdeck/src/registry.ts（AgentDeck） | registry 聚合用例 |
| effect 进程内驱动 | adapters/effect.ts | effect flow 用例 |
| claude-code 进程内 SDK | adapters/claude-sdk.ts | claude-cc 用例 |
| 通用 CLI（claude-code -p/codex/gemini/pi/custom） | adapters/cli.ts + cliInvocation | CLI 假进程 + 超时中止用例 |
| 写操作审批门控、可中止 | adapters/effect-ops.ts | effect-ops allow/deny 用例 |

## 需求 2 · session → 同意 映射
| 能力 | 落点 | 证明 |
|---|---|---|
| 账本 ask/allow/deny、by/time 留痕 | packages/agentdeck/src/consent.ts（makeConsentLedger） | consent 组用例 |
| mapping() 会话维度映射 | 同上 | 用例含 s1/s2 映射断言 |
| auto 名单/默认决议自动裁决 | 产品会话策略（deckconsole）+ config.consent | round8/12 e2e（allow by auto/deny） |
| 审批驱动真实执行 | adapters/effect-ops.ts（Effect.die 中止→批准重发执行） | effect-ops + 产品级 loop e2e |

## 需求 3 · 配置 → 统一映射
| 能力 | 落点 | 证明 |
|---|---|---|
| normalizeConfig(kind, raw) 方言归一 | packages/agentdeck/src/config.ts | 各 kind 归一断言（codex/gemini/pi/model） |
| extra 无损保留 | 同上 extraOf | lossless 断言 |
| consent 策略透传（allow/deny） | 同上 consentOf | deny 透传断言 |
| CLI 调用计划可视化 | cli.ts cliInvocation + 产品 preview.invocation | cliInvocation 用例 + 页面显示 |

## 产品封装 · deckconsole（apps/deckconsole）
- HTTP API + 暗色管理页：会话/审批（策略+批量）/同意流水/会话详情/配置归一+调用计划/
  启动组（DECK_FILE 持久化）/一键全关/运行时方言注册（POST /api/presets）
- 启动：DECK_PORT=4851 bun apps/deckconsole/src/main.ts → http://127.0.0.1:4851
- 页面截图：apps/deckconsole/docs/screens/r4-deckconsole.png、apps/deckconsole/docs/screens/r4-config-preview.png、apps/deckconsole/docs/screens/r5-detail.png、
  apps/deckconsole/docs/screens/r10-flow.png、apps/deckconsole/docs/screens/r11-invoke.png、apps/deckconsole/docs/screens/r12-policy-ui.png

## 回归基线
- agentdeck 14 条 + deckconsole 10 条；全套 278 条 0 fail；tsc(fullscope) 干净
