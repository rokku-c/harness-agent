import { Effect, Schema } from "effect"
import {
  Agent,
  AgentContext,
  ClaudeCode,
  Harness,
  SshConnection,
  Until,
  type Result
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

/**
 * 示例 09：通过 SSH 连接远程主机，注入远程文件读写工具，让 Claude Code 写一个 CLI 小游戏。
 *
 * 用法：
 *   bun run example ssh-game [target] [--allow-user-config]
 *
 *   target               SSH 端点，如 ssh://root@host/tmp/test1，或本机 ~/.ssh/config 中的 Host 别名（如 ubuntu_dev）
 *   --allow-user-config  启用后使用本机 ~/.ssh/config 的凭证（HostName / User / Port / IdentityFile）
 *
 *   bun run example ssh-game "ssh://root@10.9.32.228/tmp/test1"
 *   bun run example ssh-game ubuntu_dev --allow-user-config
 *   SSH_TARGET=ssh://root@host/tmp/test1 bun run example ssh-game
 *
 * 链路：
 *   ssh://root@host/tmp/test1
 *     → SshConnection（ssh2 + SFTP，可选合并 ~/.ssh/config 凭证）
 *     → open() 得到 ContainersService（远程文件系统容器）
 *     → 容器 binding 通过 Agent.writes(...) 注入（含 ssh.readFile 和 ssh.writeFile）
 *     → Claude Code 用 ssh.readFile / ssh.writeFile 在远程写一个小游戏
 */

// 解析示例参数：`bun run example ssh-game <target> [--allow-user-config]`
const args = Bun.argv.slice(3)
const allowUserConfig = args.includes("--allow-user-config")
const targetArg = args.find((arg) => !arg.startsWith("--"))
// target 优先级：命令行参数 > 环境变量 > 占位
const target = targetArg ?? Bun.env.SSH_TARGET ?? "ssh://root@127.0.0.1/tmp/test1"

console.error(`[ssh-game] target: ${target}`)
console.error(`[ssh-game] allow-user-config: ${allowUserConfig}`)

const GameInfo = Schema.Struct({
  game: Schema.String,
  files: Schema.Array(Schema.String),
  howToRun: Schema.String,
  summary: Schema.String
})

const program = Effect.gen(function*() {
  // 1. 实例化 SSH 连接：解析端点（可选合并本机 SSH config 凭证），open 后得到远程文件系统容器。
  const ssh = SshConnection(target, { allowUserConfig })
  const containers = yield* ssh.open
  const remoteBinding = containers.bindings[0]
  if (!remoteBinding)
    return yield* Effect.fail(new Error("SSH connection produced no remote container bindings"))

  // 2. Claude Code 作为 ComposedAgent 驱动。
  const claude = yield* ClaudeCode.configured({
    path: "config.toml",
    provider: "claude",
    overrides: {
      cwd: process.cwd(),
      maxTurns: undefined,
      permissionMode: "dontAsk",
      tools: [],
      settingSources: [],
      persistSession: false
    }
  })

  // 3. 定义 Agent：通过注入的 ssh.readFile / ssh.writeFile 操作远程目录。
  const observedClaude = Harness.withHooks(claude, DetailHook)

  const GameWriter = Agent
    .define<string>((task) => AgentContext.input({ operation: "create-cli-game", task }))
    .returns(Until.schema(GameInfo))
    .writes(remoteBinding)
    .implementedBy(observedClaude)

  return yield* GameWriter.run(
    `在远程目录中写一个 CLI 小游戏（例如猜数字、井字棋或贪吃蛇）。要求：
1. 用 Node.js 或纯 TypeScript 写，一个或多个源文件；
2. 先在远程目录用 ssh.writeFile 创建 package.json（含启动脚本），再创建游戏源码；
3. 游戏能独立运行（stdin 输入、stdout 输出）；
4. 完成后读取自己写的文件确认内容正确。

任务完成后，返回：游戏名、你创建的文件列表、以及一句实现摘要。`
  )
})

// program 的 R 因远程 binding 的泛型 Ops 被推断为 any；实际运行不依赖额外注入，cast 仅为满足 runPromise 签名。
const result = await Effect.runPromise(program as unknown as Effect.Effect<Result<typeof GameInfo.Type>>)

console.log(JSON.stringify(result.output, null, 2))
