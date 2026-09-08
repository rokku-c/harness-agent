# Agent parity + Observation(监视/回放)

原则:**人能看见并操作 agent 看到的世界,能力完全等价** —— 同一份 UiDocument(声明)+
实时 state + 同一组动作(= 该 app 的 effect-interface tools,schema 驱动、同 authorize);
人不比 agent 多任何能力。原有漂亮 UI(console/各自界面)保留不动,这是额外的一个
“机器等价视图”。

## 组件

- `packages/effect-parity`:
  - `fromCatalogEntry(AppEntry)` → `ParityAppView { ns, appId, view, state, actions }`,
    actions **只**来自 entry.registry.tools(无多余项)→ 人=agent。
  - `interactiveSpec(view)` → 文字读态 + 每个 action 一个表单(按 inputSchema 生成输入)。
  - `submitAction(source, name, args)` → 只允许 agent 那组 action;未知名报错。
  - `parityFromSnapshot(snapshot)` → 用帧里的冻结 state 重建交互视图(回放)。
- `packages/effect-observe`(**SQLite 持久**):
  - `ObservationSnapshot { at, perspective: app|agent|global, target, data }`;stable hash。
  - `createObservationStore(file?)`:表 `observation_frames(at, perspective, target, data)`,
    索引 `(perspective,target,at)`;`record/frames/latest/count`,文件路径可重开续读。
  - `startObserver(...)`:基线帧 + 仅变化记录。
- `apps/effect-server` `monitor` plane(挂 `/console` 旁):
  - `GET /-/mirror/:appId` —— agent 视角的 parity 视图(含实时 state 与可操作 actions)。
  - `POST /-/mirror/:appId/call` —— 以 agent 方式执行动作(同 authorize)。
  - `GET /-/observe/tick` —— 采样 agent 视角,仅变化落帧(SQLite)。
  - `GET /-/observe/frames?perspective=&target=` —— 帧列表(回放输入)。

## 三种呈现(同一份 描述+数据)

| | 谁看 | 内容 |
|---|---|---|
| **webui** | 人(精美) | 正式界面(现有 board/console 组件保留) |
| **lui** | agent | 语言化形态:UiDocument(含 json-render)+ state + actions(tools) |
| **weblui** | 人(看 lui) | lui 渲染回给人:可点/可输入(动作=agent tool call,同授权);
  必须展示给人的(图片/媒体/JS 动画)= html 语言文档直接渲染 |

- `packages/effect-parity` `interactivePage(view,{submitUrl,richHtml?})` = weblui 页:
  view/state 文本读态 + 每个 action 一个表单(同一 tool schema),提交 POST 到 submitUrl;
  richHtml 直接渲染。
- effect-server: `GET /-/weblui/:appId`(weblui 页)、`POST /-/mirror/:appId/call`(执行同 agent)。

## RenderContract(渲染规则层,user-verified defaults)

- 规则**贴组件**:每元素 `component + data(绑定) + interactive[{on,action,argsTemplate}] + display`
  (`display:false`=可交互控件;`true`=纯展示);文档级附 actions 目录 + empty-data 规则
  (“0 data 也照渲:布局+空值+控件仍可用”)。
- **projector** 同一契约可投影成 `json` / `toml` / `compact`(均内嵌交互标注):
  `packages/effect-ui`: `makeRenderContract(view, actions)`,
  `contractToJson/Toml/Compact(contract, data)`;数据经绑定路径注入。

### RenderContract v1 features(规则=一等数据)

- 元素自述:`component · data(绑定路径)· display · collapsible · interactive[{on,action,args,refresh}]`;
  文档级:`actions` 目录 + `emptyDataRule`(0 数据照渲)+ `rules{collapsibleIds, exclusive:true, expandOn:click}` + `refresh{default:partial, partialVia:component-refs, warnWhenBaseFrameMissing:true}`。
- 投影:`contractToJson/Toml/Compact(contract,data)` + `contractToTokenized`(符号化 @s# + 缩略 [+] )。
- **局部刷新**:动作默认只刷新其 `refresh` 点名的组件 ref;只有显式“整屏刷新”才全量。
  若上一帧已被移出模型上下文,局部 patch 语义可能不完整 → `warnPartialWithoutBase` 提醒。
- **符号化连接**:组件以稳定 id(ref)连接;更新/滚动可只作用到被引用组件(局部滚动);
  同名长值跨处引用 → 定义一次、其余 `@s#` 引用(省字符)。

### App 开发者无感

- 开发者只写“展示什么 + 数据 + 能做什么动作”;契约 / 缩略 / 符号化 / 局部刷新 /
  投影(json·toml·compact·token)/ weblui **全部由引擎自动派生**。
- 入口:`packages/effect-ui` `defineUi({view, actions, data?})` →
  `{ contract, project(data?) => {json,toml,compact,token} }`;唯一可选的域标注
  (如某数据是大列表、某按钮对应某动作)仍走既有 view/actions 语义,不含 lui 细节。
