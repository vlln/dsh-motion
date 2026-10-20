# dsh-motion 路线图

> 目标（goal-46e4ff3f）：把内核做成**可安装、可验证的 dsh 插件**。
> 规则：**每个里程碑必须有可复现的退出证据**；门禁是累积的，后一个里程碑不许让前一个门禁变红。

---

## 里程碑

### M0 · 渲染内核 ✅（已完成，2026-10-19）

- timeline / 文本槽 / 调色板 / 音频 / WebGL 五条链路跑通
- 退出证据：`npm run gates` **14/14**、`npm run gate:audio` **8/8**、19s 成片

### M1 · 契约固化与仓库化 ✅（2026-10-19）

- 契约文档 → 可直接执行的 `src/types.d.ts` + `src/validate.mjs`（运行时校验 timeline / slots / palettes）
- git init、`.gitignore`、`package.json` 元数据（description / icon / license 占位）
- 退出证据：
  - 非法 timeline（缺 token、槽未声明、scene 重叠）**会被 validate 拒绝**，每条有单测
  - `npm run gates` 仍 14/14
  - 已达成：`npm run validate` **10/10**；运行时在 mount 前 `assertTimeline`；首次提交 `6d47ffe`

### M2 · 预览面板（standalone，不依赖 dsh）✅（2026-10-19）

- 播放器：播放 / 暂停 / 拖播放头 / 时间码 / 循环
- 场景条：按时长比例分段、点击跳转、当前幕高亮
- 元素检视：点选元素 → 显示 `t · x y · w×h`（只读）
- 退出证据：
  - Playwright 脚本驱动：点场景条 → 播放头落点正确（±1 帧）；拖播放头 → 时间码同步
  - 一张“面板全貌”截图 + 一张“选中元素”截图
  - 已达成：`npm run gate:ui` **11/11**；截图在 `docs/ui-panel.png` / `docs/ui-selection.png`

### M3 · 批注回路 ✅（2026-10-19）

- `comments.json`：`{threadId, anchor:{t, rect, elementId}, text, activated, resolved}`
- 浮层：在暂停帧上框选 → 写指令 → `Send to Claude`
- 工具契约：`motion_comments { action: comments|reply|resolve }`，返回锚点 + 裁剪图路径
- 退出证据（端到端、可脚本复现）：
  1. 在 t=3.2、框选标题区域、写“换掉这句”
  2. `motion_comments comments` 返回该 thread（含 `crop.png`）
  3. 脚本改 `texts` → 预览该帧像素变化
  4. `reply` + `resolve` 后 thread 状态正确
  - 已达成：`npm run gate:comments` **13/13**；截图 `docs/ui-comments.png`；裁剪图 `out/comments/<id>.png`

### M4a · 插件骨架与 Node half ✅（2026-10-19）

- `dsh.bundle.patch` + `icon.svg` + `lib/index.mjs`
- 工具：`motion_info` / `motion_texts` / `motion_palette` / `motion_comments` / `motion_render`
- 退出证据：`npm run gate:plugin` **4/4**（临时 DSH_HOME 安装 → dump-config 含行 → web 启动无错误）

### M4b · client half（预览播放器 + 场景条 + 元素检视 + 批注浮层）✅（2026-10-19）

- 把 standalone 预览打包成自包含 bundle（esbuild + three 内联）
- Node half 注册静态路由（app / app.js / timeline / comments）
- client bundle 自渲染：`__ModuleLoader__.load` 注册浮动面板（iframe 或直接 DOM）
- 退出证据：
  - `/plugins/dsh-motion/app` 200，面板能在真实会话里打开
  - 面板里点场景条/元素/批注，与 standalone 行为一致
  - 已达成：`npm run gate:client` **8/8**（真实 dsh web + iframe）；截图 `docs/ui-launcher.png`

### M5 · 安装验证（隔离环境）✅（2026-10-19）

- 独立 `DSH_HOME` + `--port 0`，绝不碰共享 3080
- 步骤：建临时 profile → add → 启动 → 会话里调 `motion_init` → 调 `motion_render --stills` → 看到面板
- **负控**：故意写错一个 `inject` 服务名，确认日志响亮报错且条目 pending
- 退出证据：
  - 安装日志 + 工具调用结果 + 面板截图
  - 负控日志（证明“干净日志”不是侥幸）
  - 已达成：`npm run gate:tools` **4/4**——真实会话调 `motion_info` 返回本仓库时间轴；故意写错 `inject` 后日志出现 `1 entry did not activate` + `waiting for service: noSuchService`

### M6 · 文档与交付 ✅（2026-10-19）

- README：这是什么 / 为什么 / 怎么装 / 用起来什么样 / 能力面表 / **兼容性** / **插件管理** / 已知限制
- 至少一张功能图（面板截图）与一个可跑的示例 timeline
- 退出证据：
  - README 含「兼容性」「插件管理」「已知限制」
  - 图标在真实 Plugins 页渲染（`docs/plugins-page.png`）
  - `dependencies` / `peerDependencies` 为空；`devDependencies` 仅本地工具链
  - 冒烟含真实调用与负控（`gate:tools`）

### M7 · 参数写回与回退 ✅（2026-10-20）

- 场景声明 `params`（数值旋钮），值存 `timeline.params`，缺省回落 `default`；越界拒绝，不 clamp
- 面板：滑杆拖动即时重绘，**松手才写**；`src/project.mjs` 统一「校验 → 快照 → 写」，面板 API 与工具共用
- 回退：每次写前把上一版存进 `.motion/snapshots/`（保留 20 份），`motion_history` 与面板的“回退”读同一份列表
- 工具：`motion_params`（list / set）、`motion_history`（list / restore）
- 退出证据：
  - `npm run gate:params` **13/13**：拖动改的是画面像素（不只 DOM）→ 松手写文件 + 留快照 → 重载读到持久值 → 越界 400 且文件与快照都不动 → 回退把文件和画面一起带回
  - `npm run gate:surface` **14/14**：8 个工具全部注册并真跑一次只读路径；负控三项。此门禁在写它时立刻抓到一个真 bug——`motion_comments` 调了未导入的 `list()`
  - README 增「参数与回退」；截图 `docs/ui-params.png`

动机来自 ReMotion 教程里“让 agent 把要调的地方做成可编辑参数”的工序：**需求精度决定难度，所以改一次参数必须比描述一次便宜**。
与其说是抄功能，不如说是补上“看得见但改不动”这个缺口。

### M8 · 参考摄取 ✅（2026-10-20）

- `motion_reference` / `scripts/reference.mjs`：读一支参考视频 → 切点、运动曲线、主色、分镜摘要
- 两遍流式解码（10fps 灰度 / 2fps RGB），同一文件两次跑出同样字节
- 两条切点判据：`hard`（帧差 ≥0.12）与 `soft`（≥ 前 1 秒中位数 3 倍且 ≥0.012），后者专治“同底色换场景”
- 退出证据：
  - `npm run gate:reference` **15/15**：合成片（2s 藏青 | 2s 金 | 2s 运动）切点落在 2.0/4.0、分镜 3 段、主色还原、运动段与静止段分离；静态片零切点零运动；软切合成片检出 1 个 `soft`；两次跑字节相同；缺文件非零退出
  - 自测：把示例片自己当参考，恢复出 8.00s / 15.00s 两个切点与 8+7+4 三幕，与 `timeline.json` 一致（不读时间轴）
  - 写这条门禁时踩了一次“旧 fixture 不重建”：改配方后仍读旧文件，差点让 `soft` 判据无证据通过；现在每次强制重建

---

## 门禁（累积，任何时候都要绿）

| 门禁 | 命令 | 通过标准 |
|---|---|---|
| 内核 | `npm run gates` | 14/14 |
| 音频 | `npm run gate:audio` | 8/8 |
| 校验 | `node scripts/validate-tests.mjs` | 全部非法样例被拒 |
| 交互 | `npm run gate:ui` | 播放头/场景条/选中 3 项 |
| 批注 | `npm run gate:comments` | 4 步闭环 |
| 参数 | `npm run gate:params` | 13/13（拖 → 写 → 快照 → 重载 → 越界 → 回退） |
| 工具面 | `npm run gate:surface` | 15/15（每个工具真跑一次） |
| 参考摄取 | `npm run gate:reference` | 15/15（硬切 / 软切 / 静态负控 / 确定性） |
| 插件 | `npm run gate:plugin` | 安装冒烟 + 负控 |

---

## 工作纪律

1. **没有截图就没有 UI 结论**——每次改面板都必须看渲染图。
2. **门禁先怀疑自己**——两次误报（P3 色偏、ebur128 首行）都出在测量方法上。
3. **一个里程碑一次提交**——提交信息写清“改了什么 + 哪条门禁证明了它”。
4. **不写死会过期的东西**——版本号一律现场取；实测记录必须带日期。
