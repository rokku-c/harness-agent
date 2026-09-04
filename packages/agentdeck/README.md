# @effect-agent/agentdeck

中间抽象控制层（agent 控制面板的"引擎"）：把主流 agent（claude code / codex /
gemini / pi / 本框架自身的 effect 运行时 / 任意 CLI agent）统一成一套控制语义。

## 三个统一面（对应需求）

1. **流程控制** `SessionGateway`（src/types.ts）
   - `open / close / send / status / sessions`：开/关会话、跑一轮、看状态，
     与背后是哪个 agent 无关。适配器：`effectGateway`（进程内 EffectAgent）、
     `makeCliGateway`（spawn 非交互 CLI）。
2. **session -> 同意(consent) 映射** `ConsentLedger`（src/consent.ts）
   - 每个 session 一份账本：ask（需要操作者同意的调用）→ allow/deny，记录
     谁在何时决定；auto-approve 工具直接落 allow(by auto)。`mapping()` 直接给
     出 sessionId -> 账本。
3. **配置 -> 统一映射** `normalizeConfig(kind, raw)`（src/config.ts）
   - 任意 agent 的原始配置归一成 `UnifiedAgentConfig`（cwd/model/命令/env/
     超时/consent 策略/extra）；未识别的键无损保留在 extra。CLI 预设
     （claude-code `-p`、codex exec、gemini、pi）可被 command/args 覆盖。

## 注册与聚合

`AgentDeck`（src/registry.ts）：注册多种 gateway、共享一份 consent 账本、
`sessions()` 跨 agent 聚合所有会话。上层产品（控制台/看板）只面对这三个面。

## 测试（免模型/免真 CLI）

packages/agentdeck/test/agentdeck.test.ts（7 条）：配置归一、方言模型字段映射、
consent 账本全流程、effect gateway 用脚本 Model、cli gateway 用假可执行文件、
registry 跨 gateway 聚合。
