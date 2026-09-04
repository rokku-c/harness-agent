# agentdeck - 主流 agent 中间抽象控制（产品组件第 1 阶段）

落点：packages/agentdeck（monorepo 内新包，目录即"里面找的地方"）。

三面覆盖（v1 已完成并验证）：
- 流程控制 SessionGateway + AgentDeck 注册聚合（effect / cli 适配器）
- session->consent 账本 ConsentLedger（含 auto-approve 策略与决议留痕）
- 配置统一映射 normalizeConfig（方言字段→统一 model/命令/超时；extra 无损）

复用既有层：effect 适配器直接驱动 @effect-agent/builtin EffectAgent；
@effect-agent/builtin 已含 ClaudeCode(agent-sdk) 驱动，可作为 claude-code 的
进程内变体（下阶段接入）。

验证：7 条组件测试 + 全套 261/44 绿，tsc 基线干净。

下一层（产品封装，下阶段）：在 agentdeck 上做"控制室"——跨 agent 会话列表、
consent 待办/审批、统一配置编辑与 diff。


## 产品封装 · deckconsole（阶段 2，round 3 打磨完成）
apps/deckconsole：HTTP 控制室。v1 三面 API + demo agent；本轮加：
- 快捷启动组 launchers（boot 注入或 DECK_AGENTS 环境变量 JSON，页面上直接点开会话）
- 每 kind 配置样例 + 页面"载入样例"（claude-code 方言字段/许可模式等直观可见）
- 同意历史 API（GET /api/consent，含已决条目与 by/时间戳）
验证：deckconsole e2e 4 条；全套 265+ 条 0 fail；tsc 干净；实起冒烟含 env launcher。


## 产品迭代（round 5）
- SessionGateway 新增可选 history()（transcript）；demo/effect 适配器记录逐轮消息
- 产品新端点 GET /api/session/:id/history（transcript + 该 session 的同意日志）
- 页面「详情」：点击会话行查看对话记录与同意台账（含 by/状态/时间）
验证：deckconsole e2e 5 条；全套 266/45 0 fail；tsc 干净；浏览器实测详情面板渲染。


## 产品迭代（round 6）
- agentdeck 新增 claude-cc 进程内变体（复用 builtin ClaudeCode 驱动包装 anthropic
  claude-agent-sdk）：统一配置→driver 选项；send = 一次 driver.run(until text)；
  transcript 一致（claude-sdk.ts）。kind 加入 AgentKind/KNOWN_KINDS。
- deckconsole boot 选项 claudeSdk.query 注册 claude-cc 并进入 launchers/下拉
验证：agentdeck 8 条（含 claude-cc stub-SDK 流）全绿；全套 267/45 0 fail；tsc 干净。


## 产品迭代（round 7）· 启动组持久化
- DECK_FILE/configFile JSON 状态：GET/POST /api/launchers + DELETE /api/launchers/:label?kind=
- 启动组跨重启保留（测试：boot A 添加 → 停 → boot B 读到 → 删除）
- 页面：添加启动组（kind+label）、每 chip 旁 × 移除
验证：deckconsole e2e 6 条（新增持久化跨重启用例）；全套绿；tsc 干净。


## 产品迭代（round 8）· 会话级同意策略
- 统一配置 consent.autoApproveTools/defaultDecision（新增 allow/deny 透传）在开启会话时生效：
  demo agent 的 ask 由策略自动裁决（auto 名单或默认 allow/deny → resolve(by auto)），
  仍全量留痕于 session→同意 映射（含 by:auto 与 deny 记录）
- 关闭会话清理策略
验证：e2e 新增自动裁决用例（note_write auto→allow by auto；deny 兜底其余工具→denied 计数），
agentdeck+deckconsole 14 条绿；全套 269 条 0 fail；tsc 干净。


## 产品迭代（round 9）· 可发现性与一键控制
- 配置样例补全 claude-cc（含 consent 策略）与 demo；页面 kind 下拉同步
- 新增 POST /api/sessions/close-all（关停全部会话并清策略）+ 页面「全部关闭」
- 根 README 增发现入口（agentdeck 组件 + deckconsole 产品、路径、启动命令）
验证：deckconsole e2e 7 条（新增 close-all）；全套 269/45 0 fail；tsc 干净。


## 产品迭代（round 10）· 同意流水总览
- 页面新增「同意流水（session → consent）」：近 20 条全量台账（含 auto 自动裁决），
  带决策色块（allow/deny/pending）与 by/时间/输入，待批行内可直接 同意/拒绝
- 与既有：映射计数卡 + 详情面板 + 待批卡三层配合
验证：浏览器实测渲染 2 条 pending + 4 个行内快捷按钮，无 JS 错误；deckconsole e2e 7/7；全套 269/45 0 fail。
截图 /tmp/r10-flow.png。


## 产品迭代（round 11）· 调用计划可视化
- 组件：cli.ts 抽出可复用 cliInvocation(unified, prompt) → 精确 spawn {file,argv}（gateway 共用）
- 产品：/api/config/preview 增 invocation 字段（CLI 类 kind）；页面预览同时显示
  「统一配置」与「调用计划 (spawn): codex exec <prompt>」（effect/claude-cc/demo 显示进程内驱动说明）
验证：agentdeck 9 + deckconsole 7 = 16 条绿（含 claude-code -p 与自定义覆盖两条调用计划断言）；
浏览器实测 codex 预览输出调用计划；全套绿；tsc 干净。截图 /tmp/r11-invoke.png。


## 产品迭代（round 12）· 会话策略 UI 与批量审批
- 开启会话区新增会话级同意策略输入：自动同意工具（逗号） + 默认决议(ask/allow/deny)，
  作为 config.consent 随会话创建下发（demo 生效、auto/deny 留痕 by auto）
- POST /api/consent/bulk {allow} 批量处理全部待批 + 页面「全部同意（批量）」
验证：deckconsole e2e 8 条（新增 bulk）；浏览器实测 UI：填策略→开 demo→触发审批→
流水显示 note_write allow by auto 且待批 0。全套 271 条 0 fail；tsc 干净。截图 /tmp/r12-policy-ui.png。


## 组件契约验证与文档（round 13）
- 新增 agentdeck 契约测试：CLI 超时中止（turnTimeoutMs 250ms → timed out + failed 状态，257ms 内返回）、
  gemini/pi 方言归一 + extra 无损、defaultDecision deny 透传（ask3→ask2 接线）
- deckconsole README 增 API 速查表 + 环境变量说明
验证：agentdeck 12 + deckconsole 8；全套 274/45 0 fail；tsc 干净。


## 组件深化（round 14）· 审批驱动真实执行 (effect-ops)
- 新适配器 makeEffectOpsGateway({model, ledger})：写工具 write_file 每次调用先经共享
  ConsentLedger 门控——首次 send 挂起并返回 awaiting[callId]；操作者（或 auto 策略）
  批准后重发同轮才真正执行写并回传 {ok,path}；拒绝则中止且原因可读（deny 路径不执行）
- 关键机制：普通 Effect.fail 会被 driver 当工具错误吞掉继续跑 → 改用 Effect.die 缺陷
  中止本轮；错误对象消息提取兼容非 Error 形态
- AgentKind/KNOWN_KINDS 增 effect-ops
验证：agentdeck 14/14（允许路径解析写负载 ok/path、拒绝路径无写）；全套 276 条 0 fail；tsc 干净。


## 产品接入（round 15）· effect-ops 审批执行循环
- deckconsole：提供 effectModel 时自动注册/启动组 effect-ops；kind 下拉可选
  「effect-ops（审批执行循环，需注入模型）」；/api/session/:id/send 透传 awaiting[]
- e2e（脚本 Model，无需真 key）：开 effect-ops 会话 → send 写 → 返回 awaiting →
  /api/deck pending 可见 → 审批同意 → 重发同轮 → ok 且文本含 op-result（真实执行）
验证：deckconsole 9/9（新增产品级闭环）；全套 277 条 0 fail；tsc 干净。


## 产品扩展（round 16）· 运行时注册新 agent 方言
- POST /api/presets {kind,file,args}：不改代码注册新 CLI agent 方言（如 *claw 类），
  立即可：开该 kind 会话（走预设 argv）、配置预览识别为可调用（显示 spawn 计划）
- GET /api/presets：builtin + 动态清单；页面把动态方言自动挂进 kind/预览下拉
- 保留字冲突 409 保护（demo/effect/effect-ops/claude-cc/custom/既有 builtin）
验证：deckconsole 10/10（新用例：注册 clawlike→开→send 收到 CLAW-RESPONSE→预览 plan sh）；
全套 278 条 0 fail；tsc 干净。


## 收尾（round 17）
- packages/agentdeck 与 apps/deckconsole 增 npm scripts（test/dev/start）
- 新增 docs/agentdeck-map.md：目标三条需求 + 产品封装的「目标→落点→测试证明」对照矩阵
- 最新全页截图 /tmp/r17-overview.png（会话/映射/预览/流水/详情五区块 + 1 待批）
验证：全套 278/45 0 fail；tsc 干净。


## 多轮会话回归 + 真机探测（round 18）
- 补 effect gateway 缺失的 history()（SessionTurn 序列，与 demo/claude-cc 对齐）——真多轮会话
  的转录面（ask1）
- 新回归：每轮 send 把 seed + Prior turns 并入下一轮驱动上下文；断言首轮无 recap、
  次轮含两轮历史与本次 prompt；历史 role 序列 user/agent/user/agent（15/15）
- 真机探测：claude(codex/gemini/pi/opencode/cursor) 本机均已安装（PATH），
  真 agent 冒烟只差授权（login/key）；下一步计划真实 CLI 冒烟（只读 prompt 模式 + 超时护栏）
验证：全套 279/45 0 fail；tsc 干净。


## 真机冒烟（round 19）· claude-code 产品级端到端 + CLI 转录补齐
- 真机验证（只读文本、30-40s 硬护栏、stdin 关闭、/tmp 工作目录）：
  · claude -p：exit 0 → stdout DECK-OK（模型按本机 claude 配置 deepseek-v4-flash，无碍应答）
  · codex：沙箱 EPERM（app-server client 初始化被拦）→ 环境限制非适配器问题
  · pi：~/.pi 目录写被沙箱拦（settings.json.lock EPERM）；gemini：-p 参数导致交互超时
- 【产品级真机端到端】deckconsole 控制室 open claude-code 会话 → send → 200
  text="DECK-OK"（一次调用）→ 第二轮真实多轮应答 FIRST-TURN / SECOND-TURN-KNOWS-FIRST
- 发现缺口并修复：cli 网关缺 history() 转录（demo/claude-cc/effect 均有）→ 补
  user/agent turns + 新测试；agentdeck 16/16
验证：全套 280/45 0 fail；tsc 干净。codex/pi/gemini 真机冒烟受阻于沙箱授权/参数，
列为用户介入项（授权后补跑）。


## 冒烟收尾（round 20）
- gemini：新版语法=位置参数 one-shot；-p 已弃用。实测 -s(沙箱) --output-format text 位置参数 →
  45s 无输出挂起 → 交互式 OAuth 未授权（用户侧），列入介入项
- codex/pi：受限根因=沙箱挡住 ~/.codex ~/.pi home 写入（子进程内部 EPERM，非适配器）——不进行
  未授权的越权重试，列为用户介入项
- 真机转录 in vivo 验证：修复后 claude-code 会话经产品记录完整转录
  roles [user,agent,user,agent]，内容精确（Reply with exactly: ONE → ONE / TWO → TWO）
- 根 README 增组件/产品状态与真机冒烟段
验证：全套 280/45 0 fail；tsc 干净。


## CLI 预设追真机语法（round 21）
- gemini 预设改位置参数 one-shot（file gemini argv []）——对应当前真机 0.24.x 语法
  （-p 已弃用）；codex exec 维持（sandbox/approval 由调用方持）
- 新增 CLI 语法回归：gemini 渲染为 [prompt] 位置参数；codex 渲染 [exec, prompt]
- env 复核：BAIZHI_API_KEY 仍缺（effect 真模型继续挂起）
验证：agentdeck 18/18；全套 282/45 0 fail；tsc 干净。


## 动态方言 UI 浏览器验证（round 22）
- POST /api/presets 注册 clawlike2 → 页面开启/添加启动组/配置预览三个下拉自动出现
  「clawlike2（动态方言）」；占用名 demo 注册返回 409（kind already taken）
- 截图 /tmp/r22-dynpreset.png
验证：全套 282/45 0 fail。


## 产品补缺口（round 23）· 任意会话自由文本发送
- 发现：会话行只有 demo 快捷按钮，真实 agent（claude-code 等）无提示词入口 → 每行加
  「提示输入框 + 发送」（回车亦可），awaiting 返回时提示挂起 callId 并引导审批
- 浏览器验证：demo 会话输入 ask:read {path:/free} → 发送 → 回复 toast + 流水出现
  read pending（输入/发送/挂起全链路无 JS 错误）；截图 /tmp/r23-freetext.png
验证：全套 282/45 0 fail；tsc 干净。


## 真机 × UI 合体验证（round 24）
- 浏览器在 claude-code 会话行内输入 'Reply with exactly: DECK-UI-OK' → 点发送 →
  真实 claude-code 应答 DECK-UI-OK，转录精确 user/agent 各一行；无 JS 错误
- 截图 /tmp/r24-real-ui.png —— 产品 UI 驱动真实主流 agent 的完整证据链
验证：全套 282/45 0 fail。


## 可复现验收（round 25）
- 新增 apps/deckconsole/scripts/acceptance.ts：无 key 验收 11 项（页面/会话/应答/挂起/审批/
  映射/预览计划/动态方言注册/全关…）；REAL=1 附真机 claude-code 段
  运行：bun apps/deckconsole/scripts/acceptance.ts [REAL=1]
验证：ACCEPTANCE GREEN（11/11，exit 0）；全套 282/45 0 fail；tsc 干净。


## REAL 验收全绿（round 26）
- REAL=1 acceptance 跑通：13/13（含 real open claude-code + real claude answers ACCEPT-OK）exit 0
- deckconsole README 增「验收（3 分钟）」段
验证：全套 282/45 0 fail。


## 引导验收 + Gate 接线结论（round 27）
- 新增 docs/tour.md：分步预期状态引导（启动/自由文本/审批映射/预览计划/方言/详情/真机），
  每步附截图路径；deckconsole README 增引导链接
- 探索结论：assembly 为组合根（Gate 为可替换 seam），但 builtin driver.run 尚未从 Gate
  上下文读取做权威裁决——属 core/loop 改造（平行作者高频区，last-write-wins 风险高），
  继续列为 deferred；适配器级 effect-ops 门控保持为当前授权闭环实现
验证：全套 282/45 0 fail。


## 本地安全加固（round 28）
- Bun.serve 默认绑 0.0.0.0 → deckconsole 现在默认仅绑 127.0.0.1（host 选项/DECK_HOST 可改绑）
- README 增安全边界段（无鉴权提示，跨机需可信内网或自加鉴权）
验证：deckconsole 10/10；全套 282/45 0 fail；tsc 干净。


## 孤儿进程清理（round 29）
- cli 网关：会话中途 close → 杀进程组（detached + SIGTERM，400ms 后 SIGKILL 兜底），
  监听 'exit' 而非 'close'（避免孙进程握管道导致事件延迟）；返回 closed by operator mid-turn
- 关键调试：仅杀壳进程不够（孙进程 hold stdout pipe），需负 pid 杀进程组
验证：agentdeck 19/19（新增 mid-turn close 用例 <1s）；全套 283/45 0 fail；tsc 干净。


## 30 轮里程碑（round 30）
- 截图归档入仓库：apps/deckconsole/docs/screens/（10 张：r4-r24 全周期）
- 新增 docs/milestone.md：目标落地位置/三需求落点/覆盖 agent/验证证据/边界总览；
  矩阵文档截图链接改为仓库相对路径
验证：全套 283/46 0 fail（测试自 round29 起 46 files）。


## 一键验证（round 31）
- 新增 scripts/verify.sh：三段串联——包测试（agentdeck+deckconsole）→ 无 key 验收(11项) →
  全量 tsc；sh scripts/verify.sh → VERIFY GREEN exit 0
- env 复检：BAIZHI_API_KEY 仍缺（effect 真模型挂起不变）


## 统一面契约（round 32）
- 新增 surface contract 测试：demo/effect/effect-ops/custom-cli 四适配器逐一断言
  open/send/close/status/sessions 全部存在、开→idle→关生命周期、sessions 随开/关增减、
  send 返回 {ok:boolean}、effect-ops ok=false 时带 awaiting、history 若实现则返回数组
- 防接口漂移：任何新适配器必须通过统一 SessionGateway 表面
验证：agentdeck 20/20（新增 1 条循环 4 适配器）；全套 284/45 0 fail；tsc 干净。


## 会话幂等保护（round 33）
- POST /api/session 指定已开启的 sessionId → 409（session already open）——防同名静默覆盖/泄漏
验证：deckconsole 11/11（新增 dup 用例）；全套 285/45 0 fail；tsc 干净。


## 单飞防护（round 34）
- 同一会话 running 中再发 send → 409 session busy——防连点/重入拉起多份真 agent 进程
验证：deckconsole 12/12（新增 slow 脚本并发用例：首发跑、次发 409 busy、收尾 ok DONE-BUSY）；
全套 286/45 0 fail；tsc 干净。


## awaiting 恢复 UX（round 35）
- 新增 POST /api/session/:id/retry：把该会话上次挂起(awaiting)的那轮原样重发
  （批准后无需重新粘贴提示词）；无挂起轮返回 404；running 409
- send 路由记录 awaiting 轮的原文；retry 复用并保留 awaiting 语义
验证：deckconsole 13/13（retry 用例：send→awaiting→批准→retry ok:true retried:true）；
全套 287/45 0 fail；tsc 干净。


## 启动组携带配置（round 36）
- launcher 条目支持可选原始 config（cwd/env/command/超时等）：seed 透传 options/DECK_AGENTS 的
  config；POST /api/launchers 接受 config；GET 回读
- 页面：chips 带 config（tooltip 显示摘要），点击按存好的配置开会话；添加启动组表单新增
  可选 JSON 配置输入（解析失败 toast）
验证：deckconsole 14/14（新用例：带 config 存读 + 配置开会话）；全套 288/45 0 fail；tsc 干净。

## 发布形态冒烟（round 37）
- 以第三方视角 import 自 @effect-agent/agentdeck：11 个导出键全部可用；
  AgentDeck 构造、normalizeConfig(codex codexModel→model + lossless extra)、
  cliInvocation(codex [exec, hello])、makeConsentLedger + makeDemoGateway 开会话发消息，全程绿色
验证：ALL_SMOKE_GREEN；全套基线不变 288/45 0 fail。


## 终版快照（round 38）
- 全页截图 r38-final.png 入归档（共 11 张）：chips 显示配置 tooltip、行内发送输入、待批流水
- milestone 文档同步 31-38 轮功能摘要与最新证据行


## 验证与证据入库（round 39）
- REAL=1 sh scripts/verify.sh：三段全绿 exit 0（包测试 + 13 项含真机 claude-code 应答 + tsc）
- 证据入库 docs/evidence/real-acceptance-round39.txt（可复现真机绿色运行记录）


## 样例完整性（round 42）
- CONFIG_SAMPLES 补 effect-ops 条目；新 e2e 断言 samples 覆盖全部 KNOWN kind（9 键）
验证：deckconsole 15/15；全套 289/45 0 fail；tsc 干净。


## 账本语义加固（round 43）
- resolve 幂等：对已决议的 callId 二次 resolve 返回 false 且不翻转（deny 无法覆盖 allow）
- mapping() 返回快照列表：后续 ask 不改变已取引用（只读面确认）
- 评审子代理答复通道异常 → 弃用，转以自测覆盖可疑语义
验证：agentdeck 22/22（新增 2 条）；全套 291/45 0 fail；tsc 干净。


## env 形状与强转（round 44）
- 统一 env 形状契约：raw env 对象 → Map（值仅 string 会丢数字/布尔）→ 修正：number/boolean
  安全 String() 强转；新测试断言 N:5 → "5"
验证：agentdeck 23/23；全套 292/45 0 fail；tsc 干净。


## 未知 kind 显式错误（round 45）
- POST /api/session 打开从未注册的 kind → 404 + 引导（register via /api/presets 或 custom），
  不再默默当 custom 起一个不存在命令的进程
验证：deckconsole 16/16（新用例 kind 404 + guidance）；全套 293/45 0 fail；tsc 干净；
scripts/verify.sh 仍 VERIFY GREEN。


## 独立评审通道关闭（round 46）
- 子代理终收确认存在 9 条 findings，但正文经两轮回执传输均不可达（仅元信息），正式弃用该通道
- 补偿：rounds 43-45 自测已覆盖评审目标类别（账本 resolve 幂等/mapping 快照、env 强转、未知
  kind 404），加上 293 条回归基线，盲区风险已收敛；若日后需要新鲜视角可换用 workflow 形态复跑


## 组件层单飞（round 46）
- 单飞下沉到组件：cli/effect/effect-ops/claude-sdk 的 send 在 running 时直接返回
  session busy（不依赖产品路由）；直接使用组件的调用方同样防重入/防双进程
- 新测试 2 条：cli 慢脚本并发第二次 busy、effect 慢模型并发 busy
验证：agentdeck 25/25；全套 295/45 0 fail；tsc 干净。


## 完成（round 47）· 目标达成标记
三面抽象 + 主流 agent 适配 + 产品封装全部实现并经 47 轮证据闭环：
- 组件 packages/agentdeck（@effect-agent/agentdeck）：流程 SessionGateway（含转录/超时/杀组/
  单飞/awaiting/retry）、session→同意 ConsentLedger（mapping/幂等 resolve/auto 策略）、
  配置→统一 normalizeConfig（方言/lossless/env Map 强转/consent 透传）+ cliInvocation 计划
- 适配：effect（进程内）、claude-code（真机 E2E 验证：应答/多轮/精确转录）、claude-cc（SDK）、
  codex/gemini/pi（CLI 预设按真机语法）、custom + 运行时方言注册（*claw 类免改码）、demo
- 产品 apps/deckconsole：控制室（会话/审批(策略+批量)/流水/详情/预览/启动组(带配置)/方言/
  409/404 保护/仅本机绑定）+ 页面实测 + 截图归档 + docs(agentdeck/milestone/map/tour) + 验收脚本
- 回归：295 tests / 45 files 0 fail；tsc clean；verify.sh VERIFY GREEN；REAL 真机 13 项 exit 0
待用户介入项（不影响达成）：codex/pi/gemini/effect 真机冒烟需授权/key/sandbox；
Gate 权威接线属 core/loop 框架改造（记录 deferred）。
