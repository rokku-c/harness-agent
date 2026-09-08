> 历史记录：此轮迁移/三固定协议块设计已被 `platform-refactor-tasks.md` 和 `config-providers.md` 取代，不是当前契约。

# SQLite 配置与协议路由：当前实施计划

日期：2026-09-08。工作区包含既有未提交改动；不覆盖、不提交生产凭据。

## 本轮交付

| 任务 | 负责人 | 写入边界 | 验收 |
|---|---|---|---|
| A 权威配置 | Raman | packages/effect-config | 首次导入、SQLite重开、来源、非法保存不变、旧数据迁移 |
| B 协议路由 | Hypatia | apps/ai-gateway、packages/ai-gateway | 三协议独立URL/鉴权、缺省拒绝、热读、旧schema迁移 |
| C 配置界面 | Pascal | effect-ui表单、console页面/客户端 | 三个provider块、正确类型、保存/应用状态 |
| D 调用与生命周期 | Kant | effect-apps、effect-parity映射 | 跨应用隔离、校验、加载回滚、对称注销 |
| E 既有应用接入 | Halley | Board/UI Host/Deck插件与Board HTTP分层 | 注入配置、延迟加载、Web契约 |
| F 宿主集成 | 主线程 | effect-server组合根/配置路由/monitor | 真实Save→路由变化、重启、迁移、组合测试 |

## 已锁定契约

- config schema 默认 + effect.yaml config + 旧 override 仅在初始化时合并。
- SQLite 保存已验证完整值、来源、版本，之后为权威。YAML改变不隐式覆盖已保存值。
- providers = [{ apiType, baseURL, apiKey? }]；每 apiType 最多一条。
- apiType = openai.chat / openai.responses / anthropic.message。
- 路由仅按精确path。缺少provider返回503；未知path返回404。
- provider不从环境变量或内置URL补值。密钥不沿用请求方凭据。
- baseURL为API根或服务根，可含路径前缀；附加对应协议路径而非抹掉前缀。
- POST /console/api/config/:id：{override, strategy: apply|restart, unset?:string[]}。
- 可选字段清空用unset明确删除；不使用空字符串冒充未设置。
- apply保存并应用；restart只保存，旧active配置保持到显式应用或进程重启。
- POST /console/api/config/:id/apply：应用已保存配置。
- GET同时返回saved值、revision与pendingRestart；不把保存成功伪装成运行中已生效。
- 旧JSON和旧SQLite override只迁移一次，保留源文件；应用负责旧schema迁移。

## 不在本轮扩张

Board单写者与调度状态恢复、远程身份认证、MCP完整Schema桥接另开阶段。
本轮边界修复不宣称已具备多租户或远程安全部署能力。

Deckconsole 的 `startDeckServer` 尚未暴露 SQLite disposer；当前插件 `stop` 仅停止 HTTP listener，不能宣称数据库连接已随 apply/reload 关闭。SQLite close 留待独立生命周期任务，本轮不扩张。

## 进度（本轮完成）

- A/B/C/D/E worker均完成并关闭；主线程完成整合与复核。
- 已验证SQLite重开、两种旧存储迁移、key-only迁移、晚注册bundle的YAML导入。
- 已验证三协议独立路由/鉴权、未知路由拒绝、流转发、真实Save→apply→restart。
- 已验证跨应用/namespace伪装拒绝、镜像与agent统一校验、注册/注销竞态与失败清理。
- 浏览器：桌面三块表单、待重启/显式应用、可选boolean清除通过；390px无横向溢出。
- 所有测试使用模拟上游与隔离配置数据库；未迁移/重启用户实际配置与运行实例。
- 运行说明见 `docs/config-providers.md`。

## 验证结果

- 本轮组合定向测试：265通过，0失败；不是全仓测试。
- 受影响范围tsc通过；已修正链路依赖中两处只读数组类型错误。
- 本轮核心范围100行检查通过；仓库其它历史超限文件不在本轮宣称清零。
- Import boundary：0错误，12条已有其它依赖声明警告；diff whitespace检查通过。

## 下一批任务（尚未实施）

1. Board：固定唯一状态拥有者；恢复资源占用/等待队列/Probe命令，重启后核对orphan执行。
2. 统一运行配置：清理Board coordinator/captureBodies和Mantis facade等“有声明但未接runtime”的字段。
3. 生命周期：Deck数据库显式close；统一异步持久化资源的所有权。
4. 远程能力：可信身份与授权入口、完整MCP Schema桥接、真实namespace多实例；不靠名字隔离替代鉴权。

