# AGENTS.md

面向所有改动此仓库（packages/ + apps/）的 agent 的约定。

## 结构化输出：走模型原生的 tool call，不要自造"文本 JSON + 手动解码重试"

模型原生支持 tool call，且工具入参 schema 由提供商侧强制/校验——需要结构化结果时，
把它表达成**协议级工具调用**，而不是让模型吐 JSON 文本再由本地解码并重试：

- 结构化结果的"工具名/描述/入参 schema"一律由 **agent/应用层** 通过
  `until.schema(schema, { asTool: { name, description } })` 声明；核心循环只负责
  "当 until 是 Schema 且带 asTool 时暴露该协议工具并拦截它的调用"。核心不得硬编码
  任何产品工具名（如 final_answer）或产品文案。
- 携带 Schema 结果的工具调用失败走既有 tool-error 通道（可读诊断回喂模型自纠）：
  malformed 参数按 decode 预算重试后干净失败；模型若以纯文本回复，仅作一次性遗留
  降级（能解码则静默接受，否则立即干净失败、原因可读）。不伪造 user 消息反复呵斥，
  也不在本地 JSON.parse + 通用文案上重试。
- 纯文本 JSON 回复仅作为迁移期遗留降级被静默接受（一次解码不成即干净失败，
  原因人读），新能力一律用 tool call；不要在旧机制上加新逻辑。
- 判断取舍时的提问："现在模型都支持 tool call 了，为什么还要自己实现？"

## 文件大小与拆分方式（lint 强制）

- 每个实现文件（packages/*/src、apps/*/src、scripts/、examples/ 与各 test 目录）
  不得超过 100 行，由 `bun scripts/check-lines.ts`（npm script：`bun run lint:lines`）
  强制，超限即非零退出。
- 拆分必须**按概念/层次**进行：先想清楚文件里的内聚概念与依赖方向，让每个文件 =
  一个单一职责的层（示例：packages/builtin/src/loop/ 下 types → protocol →
  execute/turn/decide → cycle → driver）。**禁止**按行号机械切割（把一个大函数
  的连续几十行挪进 helper 不算拆分）。
- 一个概念大到写不进 100 行，说明它其实是一层：继续往下一层拆，而不是放宽行数。

- 拆分实践教训（来自 mantis config/agent/capabilities/tools/conversation）：
  - 被拆文件用 import.meta.dir 推导资源路径时，新子目录深了一层，相对寻址会
    静默算错——把被拆文件里 import.meta.dir 的引用按新层级同步修正（或改从
    稳定锚点 resolve）。
  - 从大函数里抽出"单个 op 构造器"时，先确认它返回 Op 还是对象/数组，组装处
    不得按错形状解构（曾把单 Op 当对象解构，manifest 顺序测试立刻抓到）。
  - 抽出 helper 的函数名若与类成员方法同名，成员箭头函数体内裸名会解析到
    模块作用域——要么 import 改名（如 historyBinding as makeHistoryBinding），
    要么方法体里显式 this.xxx；bun import 探针只证明模块可加载，不证明方法可
    调用，回归必须以真实测试为准。
  - 把文件拷进更深子目录时逐条核对相对导入层级：跨层类型导入（如
    ../messages.ts 从 channels/robot.ts 变成 channels/robot/parse.ts 需要
    ../../messages.ts）最易错；bun 会擦除类型导入，运行时 import 探针测不出
    这类错误——类型错误必须以 tsc 为准，运行时探针只是必要非充分。
