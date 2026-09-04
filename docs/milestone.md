# 里程碑：agentdeck 组件 + deckconsole 产品（30 轮自主迭代）

## 目标落地位置
- 组件：packages/agentdeck（@effect-agent/agentdeck）——三面抽象控制
- 产品：apps/deckconsole —— 控制室（本地管理 UI + HTTP API）

## 三条需求的落点（详见 docs/agentdeck-map.md 目标→代码→测试矩阵）
1. 流程控制（开/关/发/状态/转录/超时/中止/杀进程组）→ types.ts SessionGateway + 5 适配器
2. session→同意 映射（台账/mapping/自动策略/批量/审批驱动真实执行）→ consent.ts + effect-ops
3. 配置→统一 映射（方言归一/lossless/调用计划预览）→ config.ts + cliInvocation

## 覆盖的 agent
- 进程内：effect（自研运行时）、effect-ops（审批执行循环）、claude-cc（SDK）、demo（内置演示）
- CLI：claude-code（真机验证）/ codex / gemini（按 0.24 位置参数）/ pi / custom
- 任何新方言：POST /api/presets 运行时注册（*claw 类）；保留名 409

## 验证证据
- 回归：283 tests / 46 files 0 fail；tsc（fullscope）干净
- 可复现验收：bun apps/deckconsole/scripts/acceptance.ts（无 key 11 项）
  REAL=1（+真机 claude-code 应答，13 项 exit 0）
- 真机：deckconsole UI/API 真实驱动 claude-code 端到端（应答、多轮、精确转录）
- 浏览器实测截图（归档 apps/deckconsole/docs/screens/）：
  r4-deckconsole.png 主页  r4-config-preview.png 配置预览  r5-detail.png 会话详情
  r10-flow.png 同意流水  r11-invoke.png 调用计划  r12-policy-ui.png 策略 UI
  r17-overview.png 全页总览  r22-dynpreset.png 动态方言  r23-freetext.png 自由文本
  r24-real-ui.png 真机 UI 应答  r38-final.png 终版总览
- 引导验收：docs/tour.md（分步预期状态）

## 边界（待用户介入项）
- codex/pi：沙箱挡 ~/.codex ~/.pi home 写；gemini：交互式 OAuth 未登录；
  effect 真模型：需可用 provider key；Gate 权威接入 driver.run 属 core/loop 改造（deferred）
