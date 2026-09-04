# board · 产品信息架构决策（control-room worktable）

> 2024-09 决策记录。为什么多 agent 工作台的主视图不是经典 Kanban。

## 问题
原主视图是经典 Kanban（todo→done 分列卡片）。真实使用数据（67 个工作项、
5 个 executor、独占资源互斥、依赖/阻塞链、长 result、事件流）暴露结构性缺陷：

1. **信息量低**：卡片只有 title + 两个胶囊；"谁在干 / 卡在哪 / 等什么 / 占什么
   资源 / 多久了 / 为什么失败"全部要逐个点开弹窗才能看到，列间无法对比。
2. **7 列大托盘在真实负载下大片空置**，屏幕有效利用率 <30%。
3. **布局与交互协议脱节**：面板没有拖拽，每次变更都走 `act()` MCP 工具
   （与 Claude Code 同协议）——Kanban 唯一的"拖卡"心智价值用不上，
   列布局只剩纯展示损耗。

## 产品判断
人机共同工作台的真实任务不是"搬卡片"，而是四件事：
**派活 → 盯阻塞 → 排资源 → 追失败**。
因此默认面应是**调度控制台**，不是墙面隐喻。

## 方案
- **默认视图 Worktable（主表）**：行 = 工作项；列 = 状态分组 / 执行者 /
  等待依赖 / 资源占用 / 年龄（createdAt/updatedAt）；标题下第二行直接透出
  labels、阻塞原因、失败 result 摘要——关键信号不点击即达。
- **顶栏筛选 chips**：按状态组（含计数）/ 执行者过滤 + 全文搜索；
  排序 = 状态组序 → 优先级 → 最近更新。
- **行内主操作**：Start / Mark done / Block / Unblock（与详情弹窗动作同源，
  同 `act()` 协议），触屏友好。
- **Kanban 保留为可选视图**（顶栏 Table ⇄ Board 切换），桌面拖拽心智模式
  仍在，但不再是默认。
- 行点击打开原详情弹窗（body / deps 树 / actions），不做信息重复。
- ≤960px：主表自动降级为流式信息卡（每行纵向展开全部字段），无横向滚动。

## 验证与后续
- 代码：`Worktable.tsx`（数据 100% 来自 `/api/state` 既有协议，无新后端面）、
  `style.css` 新增 wt-* 样式层（沿用 Clay 皮肤 token）。
- 回归：board 34/34 测试绿；bundle 含新组件；桌面 Clay 基线未动。
- 运行时验证（Puppeteer + 系统 Chrome 152，2024-09）：67 行真实数据渲染；
  表头 State/Assignee/Waits/Holds/Age 就位；组 chips 计数与 Kanban 列
  计数逐列一致（Todo 1 / Doing 0 / Blocked 1 / Done 55 / Cancelled 10，
  membership 以服务端 `col.itemIds` 为准，不二次推导）；行点击开详情
  弹窗（标题/状态一致）；Table⇄Board 切换均正常（Board 5 列 67 卡）；
  390px 触屏：无横向溢出、行流式布局、表头隐藏；全程零 JS 异常。
- 待办：与 mantis 控制台统一信息协议（同层状态协议供人与 agent）立项时，
  以本表为字段集参照。

## 验证工具链备忘
本机 Chrome 已升至 152：`--headless=new` 的 CLI dump-dom 间歇性失效，
且 DevTools WebSocket 需要 `--remote-allow-origins=*`。稳定路径 =
`puppeteer-core`（/tmp/pcap，npm 官方 registry）+ 系统 Chrome
（headless:true, args 含 --remote-allow-origins），waitUntil networkidle2。
