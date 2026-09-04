# deckconsole 引导验收（文本版，配合截图路径）

> 每步给「预期界面状态」；截图在下方列出路径供打开对照。

## 启动
    DECK_PORT=4851 bun apps/deckconsole/src/main.ts
    浏览器 http://127.0.0.1:4851

## 步 1 · 认识主页（/tmp/r17-overview.png、/tmp/r4-deckconsole.png）
- 五个区块：会话与代理 / session→同意 映射 / 配置→统一映射 预览 / 同意流水 / 会话详情
- 上方：kind 选择 + 会话标签 + 【开启会话】 + 会话级同意策略输入（自动同意工具、默认决议）
- 顶行计数：代理 N · 会话 N · 待批 N

## 步 2 · 开启一个会话并自由发消息（/tmp/r23-freetext.png）
- kind=demo，标签随意 → 开启会话 → 表格出现会话行
- 行内有「提示输入框 + 发送」（回车可）；另带 问候/触发审批/关闭/详情 快捷按钮
- 输入 ask:read {"path":"/x"} → 发送 → toast 显示回复，同意流水出现 read pending

## 步 3 · 审批与映射（/tmp/r12-policy-ui.png、/tmp/r10-flow.png）
- 同意流水行尾部 同意/拒绝 → 决议后带 by 标记（auto/operator）
- 映射面板计数 +1；把策略设为 autoApproveTools: note_write,read 再开会话，
  触发审批会直接 allow by auto 不进待批
- 批量：流水头「全部同意（批量）」一次清空待批

## 步 4 · 配置归一与调用计划（/tmp/r4-config-preview.png、/tmp/r11-invoke.png）
- 预览区选 kind 填原始配置（如 claude-code model）→ 显示 统一配置 与 spawn 调用计划
- 每 kind 原始样例在 /api/config/samples

## 步 5 · 启动组与方言注册（/tmp/r22-dynpreset.png）
- 启动组 chips + 增删；注册新方言（POST /api/presets）后三个下拉自动出现「动态方言」
- 冲突名返回 409

## 步 6 · 详情与多轮转录
- 行内 详情 → 会话详情面板：user/agent 转录 + 该会话同意日志（含失败轮提示）

## 步 6.5 · 会话保护与恢复
- 同一会话 running 中再发 → 409 busy（单飞）；重复开同名会话 → 409 already open
- 挂起(awaiting)轮批准后：POST /api/session/:id/retry 原样重发，无需重粘提示词
- 启动组可带原始配置（cwd/env 等）：chip 悬停看配置摘要，点击按配置开会话

## 步 7 · 真实 agent（/tmp/r24-real-ui.png）
- kind=claude-code 开真实会话 → 行内输入任意提示词 → 发送 → 真实应答进转录
- 一键验收：bun apps/deckconsole/scripts/acceptance.ts（无 key 11 项）
  REAL=1 ...（+真机 claude 段 13 项，exit 0）

## 已知边界（待你介入项）
- codex/pi：沙箱挡 home 写（~/.codex ~/.pi EPERM）；gemini：交互式 OAuth 未登录；
  effect 真模型：需可用 provider key——授权/key 到位即补真机冒烟
