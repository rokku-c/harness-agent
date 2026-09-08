# 当前配置与多上游（2026-09-08）

## 权威配置

默认数据库 `.effect-agent/config.sqlite`，表 `app_config` 保存完整值、来源和revision。
首次创建配置按 `schema defaults < effect.yaml config < 显式override` 校验后落库。
之后SQLite为权威；更新YAML不会覆盖已保存值。

**不支持旧格式、不自动迁移、不自动删库。** 旧数据库结构或旧配置字段不符合当前契约时明确报错。
操作者自行决定备份、重建或重新填写；测试不会操作真实配置库。

## 多个命名上游

```yaml
config:
  providers:
    - id: chat-a
      apiType: openai.chat
      baseURL: https://upstream-a.example.invalid/v1
      apiKey: YOUR_KEY_A
    - id: chat-b
      apiType: openai.chat
      baseURL: https://upstream-b.example.invalid/v1
      apiKey: YOUR_KEY_B
    - id: messages
      apiType: anthropic.message
      baseURL: https://messages.example.invalid
      apiKey: YOUR_KEY_C
```

- 数量不限；id唯一；apiType可重复，表示协议而非厂商或单选上游。
- `enabled:false`停用该项。默认按协议筛选后轮询，可用`x-upstream-id`显式选择。
- 显式目标不存在、被停用或协议不匹配则失败，不偷偷切换其它上游。
- 未配置provider时返回503，未知path返回404，无环境变量或内置URL回退。
- 选择上游之后才通过SDK选择出口（本机/主节点）；详见`platform-network.md`。
- 三种协议path：`/v1/chat/completions`、`/v1/responses`、`/v1/messages`。
- 上游鉴权由apiType决定；不拿客户请求凭据补配置，不转发内部选择头。
- baseURL可含前缀或尾部/v1，流请求/响应保留；失败不自动重放。

## UI与生效

`/console` → CONFIGURATION → ai-gateway。providers是可新增/删除的数组表单，
每项填写id、apiType、baseURL、key和enabled；可以同时添加多个相同协议上游。
监听端口不属于ai-gateway配置，归`platform-network`的listeners；独立入口自管端口。

- 保存并应用：验证 → SQLite → active配置 → 重新加载。
- 保存待重启：只写SQLite，运行时继续用旧active。
- 应用已保存配置：显式切换；重启也会激活已保存值。
- optional字段清空用unset，含schema默认的字段恢复默认值，不重新继承YAML。

HTTP：

- `GET /console/api/config/:id`：schema/value/sources/revision/pendingRestart。
- `POST /console/api/config/:id`：`{override,strategy:"apply"|"restart",unset?:string[]}`。
- `POST /console/api/config/:id/apply`：应用已保存值。

数组整体替换，普通字段按顶层patch；非法保存不更改原配置。
配置内有凭据，数据库和备份应作为敏感文件保护。Agent配置plane默认不可读；
操作员配置入口是可信本机管理面，不是已实现远程身份认证的管理服务。
