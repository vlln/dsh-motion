# dsh-motion 路线图

> 目标（goal-46e4ff3f）：把内核做成**可安装、可验证的 dsh 插件**。
> 规则：**每个里程碑必须有可复现的退出证据**；门禁是累积的，后一个里程碑不许让前一个门禁变红。

## 现在在哪

- **M0–M10 完成**（内核、面板、批注、插件化、发布）。
- **M11–M15 完成**（第二程：材料通道、拿来通道、标杆库、判据、默认成本）。M16 冷启动验收进行中。
- 下一个开口的问题不是"还能不能更好看"，是**换一个 agent、换一条 brief，它自己能不能做到**。
- 空状态这条线共 28 次提交（`926efd4..HEAD`），其中 **11 次**发生在"样板 → 建片"闭环之后；
  这 11 次是**制作侧工具**（frames / reference / storyboard / fonts / template / 封面），
  记为 M9.1–M9.5，不是新里程碑——它们让做片更快，不改变片子好不好。
- 上一轮 goal 以"四个问题全做完"关闭，但其中的"质量一致"实际上没有退出证据，
  这是它被关闭后又继续做十一件事的根因：**能被门禁数的事一直在做，不能被门禁数的事一直没做。**

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

### M9 · 空状态即产品入口 ✅（2026-10-23，D008–D014、D020、D022–D023）

- 八个样板 = 八个随包模板：`templates/<id>/{timeline.json,scenes/*.mjs}`，选中即建片
- 建片一个动作走完：画廊格子 → `POST /api/template` → 面板带 `?from=template` 落到封面帧
- 实验片移出产品路径（`templates/saas-promo`、`mono-study`、`mono-3d` → `experiments/`）
- 退出证据：`gate:templates` 25 项（模板声明封面、封面在时长内、时间轴可校验、场景已注册）、
  `gate:poster` 5 项、`dsh-motion template <id>` 实测建片；全量 **27 组**绿

### M10 · 一种完成度 ✅（2026-10-24，D024–D026）

问题不是"画得更好"，是**同一面墙上挂着不同完成度的东西**：

| 格子 | 现在是什么 |
|---|---|
| `desk` `guide` `board` `type` `tree` | 片子（有主体、有节拍、有结尾） |
| `prism` `orbit` | **纹理**：三团径向渐变 + 一根细框；一圈椭圆 + 星点。按 `prompt` 写的就是背景 |
| `cards3d` | **元素演示**：三块灰色圆角板，证明 WebGL 通了，但不是一条片子 |

分组（D011）没有错，错在"全部"这一栏的**准入标准**：按运动语法归类，会把纹理和演示混进片子墙。

- 退出标准：920px 宽下逐格看渲染图，每格能用**一句话**说清"这是一条什么片子"；
  说不清的**移出**（回 `experiments/`，或降级为分组里的小样），不是补两句文案糊过去。
- 不做：加第 9 个样板；给每格加装饰；用新的调色板重涂（已经证明无效）。
- 什么会让我们改主意：如果 `prism`/`orbit` 能被改成"有主体、有时间"的特效片头（而不是纹理），
  它们留下——但那需要重画，不是调参。

**结果**（2026-10-24）：重画而不是调参——

| 格子 | 现在 | 一句话 |
|---|---|---|
| `prism` | 光束穿玻璃三棱镜散成光谱 | 一条关于光的光学片头 |
| `orbit` | 气态行星 + 环带遮挡 + 边缘光 | 一条关于一颗行星的定格镜头 |
| `cards3d` | PBR 玻璃卡 + 彩色环境光 + 光环 | 一条应用发布的主视觉 |
| `board` | 四行大字号榜屏 | 一条排行榜揭晓 |
| `desk` | 笔记本有厚度、屏幕发光、键盘吃光 | 一条产品功能片 |

同一条规矩也应用到了别处：`cards3d` 样板帧比改成 16:9（原来 4:5 把构图裁掉一半），
`orbit` 场景不再是一份独立的 three.js 实现（样板即模板），列表顺序按列高重排。

---

## 第二程 · 让它做出「画出来的动画」

> 依据 `docs/craft.md`。前九个里程碑解决的是"片子能不能跑、能不能改、能不能装"；
> 这一程解决的是"agent 做出来的东西像不像一张画"。判定标准不是我们做出了好片，
> 是**换一条没见过的 brief、冷启动的 agent，它自己也能做出来**。

三件事同时缺，所以这一程按"能力 → 标杆 → 判据 → 默认成本 → 冷启动验收"排，
每一段的退出证据都必须能被机器复现。

### M11 · 材料通道 ✅（2026-10-24）

让"画得像"比"画得平"省事。一次调用，把已经画好的形整体重画成材料。

- `src/medium.mjs`：`broken`（顺方向场的弯笔）／`charcoal`（炭笔夜景）／`silk`（墨与绢）／
  `print`（网点）／`glass`（屏幕反光）；纯函数、可种子化、接受任意 CanvasImageSource；
- 场景里 `ctx.medium.broken(src, { angle, density })`，返回新画布，`render(t)` 只 `drawImage`；
- 性能：静态部分在 `mount()` 里过一次材质，动的东西画在它上面。

退出证据（已完成）：
- `gate:medium` **13/13**：四个重画通道计划出的笔触互不相同、同输入逐字节确定、
  覆盖率 100%、网点落在格子上、密度翻倍笔触翻倍；
- 真实链路渲染：同一场景左半原始、右半过材质，边缘密度 0.19 → **2.66**（14×）；
- 1080p 整幅过一遍：10.6k 笔，一次渲染（含起浏览器）2.2 秒；
- 一张六格对照图：原始 / broken / charcoal / silk / print / broken+film。

### M12 · 拿来通道 ✅（2026-10-24）

让"拿一张真的"成为一条正规路线，而不是素材降级里的第三档。

- `ctx.plate(img, { zoom, pan, anchor })`：cover 适配 + 移动窗口，推/移/摇就是改参数；
- `dsh-motion init --template plate`：一张公版画当世界 + 一个演员 + 材质 + 机位，
  8 秒一条，初始化即可跑；
- `find-asset.mjs` 出来的图默认写进 `assets/plates/` 并进 `CREDITS.md`（已有），
  README 里补一条"整张图当世界"的用法。

退出证据（已完成）：
- `gate:plate` **9/9**：模板建片 → 图与 CREDITS 跟着走 → `check` 绿 → 渲出一帧 → 帧里真有图；
- `templates/plate` 是模板也是样例：公版画当世界 + 一个 10fps 步进的像素演员 + 前景草遮挡 + 颗粒/暗角；
- `ctx.image` 的 `focus` + 放大窗口本来就够用，**没有新增 `ctx.plate`**——不需要的东西不加。

### M13 · 标杆库 ✅（2026-10-24）

给 agent 可读、可抄的参照。**一个媒介一条，不做画廊。**

- 3 条完整片子（8–15 秒，源码可读），覆盖：材料（plate + 演员）、墨、印刷／网点；
- 每条一段 `docs/exemplars/<id>.md` 拆解：靠哪道工序成立、哪一处是决定性细节；
- `dsh-motion init --template list` 里能直接看到它们。

退出证据（已完成）：
- `gate:exemplars` **33/33**：plate / guide / tree / street 四条都能建、都过 `check`、都有 `poster`、
  源码都能打开、都有拆解、拆解里写明"抄什么/换什么"，且没有孤儿文档；
- 拆解文档：`docs/exemplars/plate.md`（拿来的画+演员）、`guide.md`（纸上印刷）、`tree.md`（绢本水墨）、
  `street.md`（代码画的世界：画一次 → 上材料 → 细线画在上面）。

### M14 · 判据：它能自己算出"太扁了" ✅（2026-10-24）

- `scripts/look.mjs`：算三样——**平涂占比**（大面积同色）、**纹理密度**（边缘率）、
  **色板距离**（有 `out/ref` 时与参考图比）；
- `check` 默认输出一行 look 报告（软报警，不致命）；`check --strict` 变致命；
- `out/look/vs-ref.jpg`：有参考时自动出并排图（原作 / 自己，同一时间点）；
- 阈值写在 `docs/craft.md` 附录，可按媒介调。

退出证据（已完成）：
- `gate:look` **12/12**：纯色图 flatness 1.00 / texture 0，实拍画帧 0.03 / 25.7，
  差 97 个百分点；有 `out/ref` 时报告带上参考的数字、色差和并排图；`--strict` 只拦"整幅一个颜色"；
- `check` 默认输出一行 look；参考片在时显示 "ref texture 37.5 vs mine 25.5"；
- 并排图 `out/look/vs-ref.jpg`（原作图在上、自己的帧在下）。

**同时修掉一个测量假象**：`check --perf` 之前对每个片子都报 116–150ms——因为它在面板
预热期测 rAF。现在先预热、丢掉 seek 后的前几帧，再和"直接渲一帧"的成本对照：
直接渲 0.09ms、rAF 150ms 时，报"环境在丢帧，不是场景慢"，不再冤枉片子。

### M15 · 默认成本：把正确路径做成最省事的路径 ✅（2026-10-24）

- `init` 不再默认给 `blank`：默认给 `plate`（一次性场景 + 演员 + 材质 + 机位）；
- `check` 的 look 报告里，平涂占比过高时给出一句**具体建议**（去用模板 / 去拿一张图 / 去过材质）；
- SKILL 的起点从"选一个舞台"改成"先决定世界从哪来：拿、搭、还是混合"。

退出证据（已完成）：
- `dsh-motion init` 默认建 **plate**（图 + 演员 + 颗粒/暗角），`init --blank` 保留空起手，
  两条都自动带上 `PLAN.md`；全新目录建出来的片子 `check` 绿、能渲；
- `check` 的 look 行在画面偏平时给出两条具体出路（过材料 / 换拿一张画）；
- 技能第一屏从"写 timeline"改成"世界从哪来：拿 / 搭 / 混合"。

### M16 · 冷启动验收 ✅（2026-10-24，第三次通过）

这一程唯一的真验收：**不看我们的对话，只读文档，agent 能不能做到。**

- 建一个干净的 workspace，只给它 `dsh-motion` 的技能和一条没见过的 brief；
- 观察三件事：它有没有出并排图、有没有自己发现"太扁"、有没有回去改；
- 结果写进 `docs/craft.md` 的"验收记录"。

**第一次尝试（失败）**：给了冷启动 agent 一条没见过的 brief（雨后停车场），只给它手册和 CLI。

- ✅ 它**默认就走了"拿"那条路**（`init` 建出 plate 模板），并写好了 PLAN；
- ✅ 它用 `find-asset.mjs` 在 Wikimedia 找了 7 张"雨后停车场/水洼倒影"，把许可和来源全记进
  `CREDITS.md`（含 CC BY / CC BY-SA）；
- ❌ **之后什么都没交**：15 分钟里没有再改 timeline、没有写场景、没有出 REPORT，最后被中断。

**结论：缺的不是三条腿，是时间预算。** 系统给了"素材三档、不允许留白"，却没给"什么时候停"，
于是一个认真的 agent 会一直在找素材。补了两条：

1. `find-asset` 的用法里写明**最多两轮、最多拿 3 张，选一张就停**；
2. 技能里加一节「先出一条能看的粗版，再回头精修」——拿到素材十分钟内必须有能跑的粗版。

**第二次尝试（通过交付，未通过质量）**：同一 brief（雨后停车场），加了时间预算后重跑。

- ✅ 20 分钟内交片：12 秒 3 镜、`check` 绿、16.7ms/帧、存了 v1、写了 REPORT；
- ✅ 走了「搭」＋`ctx.paint.space`，倒影是**真几何**（灯的虚像逐段投影再按水洼裁剪），机位动倒影跟着动；
- ✅ **看了 look 并真的改了三次**（锥桶配色、空画面、水面硬边/倒影亮度）——判据这条腿第一次在
  一个陌生 agent 手里起了作用；
- ❌ 没救回 texture：0.88/2.3 → 0.90/2.7。它自己诊断对了："水面占大半幅且近似同色，缺天空反射碎块"；
- ❌ **完全没碰 `ctx.medium`**，理由是"怕每帧重画太慢"——它把静态底也逐帧重绘，反而更慢。

**补丁（同日）**：缺的那个"默认架构"做出来了——

- `ctx.still(draw)`：把世界画一次（和 render 同尺寸、同坐标系）；
- `templates/street`：**画一次 → 过材料 → 细线画在上面**，夜街 + 雨 + 一次灯闪 + 一个 8fps 步进的纸杯，
  拆解在 `docs/exemplars/street.md`；
- 材料通道按画幅取笔触尺寸（`size`），暗处不描厚涂边——否则夜戏会糊成"毛皮/面条"；
- `look` 现在同时报 `contrast`：暗帧的 texture 天然低于亮帧，两个数一起看才不会冤枉。

**第三次尝试（通过）**：第三句没见过的 brief（凌晨的洗衣店），默认模板 + 新架构都在位。

- ✅ **默认就走"拿"**：把模板里那张画换成自己找的 CC0 夜间洗衣店照片，未改路线；
- ✅ **自己得出结论"照片自带纹理，所以不需要再上 medium"**（写在场景注释里）——这正是要教的那件事：
  材料可以来自一张真图，也可以来自材料通道，不必两个都上；
- ✅ 在照片上做水汽（模糊版 + 奶白渐变 + 细水珠）、七道往下爬的水痕、4 秒一次灯抖；
- ✅ **第一次有声音**：`timeline.audio` + `assets/audio/bed.wav` + `wave.png`；
- 数字：`solid 0.65 · texture 10.3 · contrast 51.1`（第二次是 0.88 / 2.7，参考级 0.01 / 39）。

**三次放在一起，结论是清楚的**：系统只要把"拿"做成默认、"停"做成规矩、"像不像"做成数字，
陌生 agent 就会自己走到有材料的那条路上——它甚至能解释为什么这条路此刻不需要材料通道。

**这一轮暴露的是判据缺"标尺"**：`texture 2.7` 是个孤立数字，agent 不知道 2.7 算好还是差。
于是给 look 加了标尺：三条件样板 14–26，参考级 39，低于 8 报"图形不是画"，并把这句话写进技能。

这条改动同时暴露了 `solid` 不适合当绝对指标（水墨样板 `tree` 是 0.89，因为大片留白），
所以结论是：**看 texture，solid 只当参考**。

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
