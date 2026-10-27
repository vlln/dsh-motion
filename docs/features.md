# 功能说明

README 只讲「它是什么、怎么跑起来」。这一页是每一项功能的细节。

### 接口

1. **`render(t)`**：场景只导出 `mount(ctx)` / `render(t)`，`t` 为秒；禁 `Math.random` / `Date.now` / `rAF`，随机走 `ctx.rng(key)`。
2. **文本槽**：场景声明 `slots` + `textUsage`，代码只读 `ctx.text('title')`；写走 `setText()`，下一帧生效，不重编译。
3. **调色板**：代码只读 `ctx.color('accent')`；解析链 `元素覆盖 → 场景覆盖 → 场景调色板 → main → 抛错`，不静默回退黑色。

4. **参数**：场景可以声明 `params`（数值旋钮）；代码只读 `ctx.param('axisY')`，值存 `timeline.params`，缺省回落声明里的 `default`。范围校验不通过直接拒绝写入，**不静默 clamp**。

另外两条为可选 `overlay` 准备的约定：

- **场景各有自己的 canvas**：canvas 只能持一种 context，所以 2D 与 WebGL 场景各画各的，内核再 `drawImage` 合成到显示画布。
- **可选 `overlay(g, ctx, t)`**：合成之后在显示画布上画 2D 图层，WebGL 场景因此能复用同一套文本槽与排版。

### 目录

从「谁能改」分四层，不是一个平铺的文件清单：

```
src/           引擎：时间、画布、确定性、缓存、出片、音频、字体、素材。没有一行画画的代码
  kernel.mjs     时间轴、挂载、解析、渲染
  project.mjs    校验 → 快照 → 写入
  scenes/        只一个 index.mjs：按 id 动态 import 片子的场景

kit/           可整删的样例手艺（笔触/媒介/像素/透视/骨架/后期）。引擎永不 import
cards/         一个风格一张卡：管线、色板、签名特征、坑、短板、状态三档
howto/         做法的规程：新风格六步、从参考里取、角色、镜头表、六种做坏、审片、交付
scenes/        本仓库自己那条示例片的场景（不是引擎的一部分）
examples/      四部片子的证据：每部只留对照帧与并排图（不是可再跑的片子）
fixtures/      门禁用时间轴夹具
docs/          决策记录、内核契约、冷启动记录
skills/        给 agent 的那份说明书
scripts/       出片、抽帧、门禁
bin/           dsh-motion 命令行
```

判据三条：**`src/` 里没有画法；`kit/` 删掉照样跑；`cards/` 加一张，引擎不加一行。**

### 门禁抓到的两个真问题

1. **macOS 的颜色管理**：canvas 默认按 display-P3 读回，`#0b1426` 取出来是 `15,26,45`。修法是建 context 时钉 `colorSpace: 'srgb'`，且必须在任何场景取 context 之前。
2. **采样点落在网格线上**：门禁第 2 项一度"背景变了"，实际是采样点 `(12,12)` 正好压在一根竖网格线上。换成网格外坐标后恢复。

### 预览界面

```bash
npm run preview   # http://127.0.0.1:4173/preview.html
```

播放 / 暂停、拖播放头、点场景条跳转、点画面里的元素看它的几何（只读检视器）。

![面板](docs/ui-panel.png)

![选中元素](docs/ui-selection.png)

检视器里的 `x / y`、`w × h` 与场景实际绘制用的是**同一份布局函数**，不是估出来的。

### 批注回路

在暂停帧上拖出一个框 → 写一句 → 发送。批注有两半，各归其位：

- **钉子**留在片子里：`{ t, rect, elementId }` 加处理状态，拖回那一帧还能看见指的是哪儿；
- **话**进对话：作为一条人说出的消息（`[批注] 0:03.20 · title` + 正文），走宿主自己的
  投递路由——agent 空闲就开一个新回合，忙就排队或插入（按宿主的"忙时回车"设置）。

```jsonc
// 片子这一侧的记录 —— 先说出来，才有这颗钉子
{ "anchor": { "t": 3.2, "rect": {"x":150,"y":235,"w":570,"h":100}, "elementId": "pin-…" },
  "text": "把标题改成更短的说法", "status": "open", "sentAt": "2026-10-23T16:09:15.129Z" }
```

先发，再存：消息送不出去，钉子就不会留下。所以系统里没有"草稿"这种状态，也没有"重发"按钮。
**没有会话就没有批注入口**——独立打开预览时不显示批注区、不能拖框，只有命令行能看。

![批注列表](docs/ui-comments.png)

工具契约（agent 这一侧只看锚点和状态）：

```bash
node scripts/comments.mjs list --json --crops   # 列出线程，并为每个线程生成裁剪图
node scripts/comments.mjs resolve --id th_x     # 改完之后把钉子标成已处理
```

`--crops` 会按锚点打开对应时刻，把 `rect` 外扩 20% 截一张图（`out/comments/<id>.png`）——模型看图比读坐标准。
回复不写进这里：agent 的话说在对话里。

改文本走 `node scripts/texts.mjs set --scene … --slot … --value …`：写 `timeline.json` → 校验 → 下一帧生效，**不重编译**。

### 作为 dsh 插件

```bash
npm run build:client                      # 打包面板（约 106 KiB）
dsh plugin --profile web add <repo 路径>   # 本地目录安装（先 npm run link 供 SDK）
```

- **没有工具面。** agent 通过 skill 学这个库，然后像写代码一样工作：在工作区里写
  `motion/timeline.json` 和 `motion/scenes/*.mjs`，自己跑 `dsh-motion` 命令看结果。
  插件只提供三样东西：内核与命令、skill 文本、对话旁边的预览面板。
- **一部片子住在会话的工作区里**，不在插件的安装目录里：

  ```
  <会话工作区>/motion/
    timeline.json      片子：幕、时长、颜色、文字、数字
    scenes/*.mjs       每一幕怎么画（agent 写的，运行时加载）
    assets/            素材
    out/               渲染产物（.gitignore）
    .snapshots/        写前副本（.gitignore）
  ```

  工作区还没有片子时，面板显示空状态——**不借示例片**。agent 调 `motion_project` 建片，
  包里的 `timeline.json` 只是开发和门禁用的示例，任何会话都不读它。

  **agent 不需要知道这些路径，也不需要 shell。** 建片、写场景、渲染、导出全是工具调用：
  `motion_scene write` 收整段模块源码，先试着加载、校验 `id` / `render`，通过才落盘；
  `add=true` 顺手把它排进片子。目录布局是插件的实现细节，不是 agent 的知识。
- **入口是对话，不是面板**：在会话里让 agent 做片子 → `motion_render` 一开跑，对话里就出现
  一张卡片（帧计数、进度条）→ 渲染完成时卡片换成片子本身，右侧的片子栏同时自己打开
- **两个座位，同一部片子**（都是 `/plugins/dsh-motion/app` 的 iframe，只有 `embed` 不同，
  所以看片与改片不会走成两套行为）：

  | 座位 | 位置 | 用途 |
  |---|---|---|
  | 卡片 | 对话流里 | 这次渲染的成品与进度；一个「查看」按钮 |
  | 片子栏 | 右侧栏 | 常驻：画面 + 播放条 + 批注钉子，聊天时一直在 |

  右侧栏是 `/p/<会话>/app?embed=tab`（窄列上下堆叠），对话卡片是 `/p/<会话>/app?embed=card`。
  **片子栏不会替换对话**：没有"打开应用"的入口，也没有主区域面板——片子永远是对话旁边的一栏。
- **批注就是消息**：在画面上框一块、写一句，面板把它交给插件外壳，外壳用这个会话的身份
  把话送进对话（作为人说的话，排队等下一回合）。面板里只留下钉子（时刻、区域、元素、
  处理状态），不再有第二套聊天，也没有 agent 的回复气泡。
  独立打开预览时没有会话可说话，批注会显示为"未发送"，不会假装发出。
- **主题**：面板只消费 dsh 的语义 token（`--dsw-alias-*` / `--dsw-specific-*`），
  亮暗色跟随宿主；iframe 不继承变量，所以 client half 在加载时把 token 抄进去

![右侧预览标签](docs/ui-tab.png)

![对话里的渲染卡片](docs/ui-card.png)

渲染进度不是猜的：`motion_render` 把 capture 的 `
帧/总帧` 镜像到 `out/render-state.json`，
卡片轮询 `/api/render` 显示，所以“agent 正在做动画”在对话里是看得见的。

![亮色](docs/ui-sidebar.png)

面板里可以直接改这一帧的文字与数值：聚焦某个字段时，画面上会框出它对应的区域，
分区可以折叠，场景条可以拖动定位。

![聚焦](docs/ui-focus.png)

![暗色](docs/ui-sidebar-dark.png)

`npm run gate:plugin` 验证安装与启动；`npm run gate:client` 在隔离工作区里验证面板挂到 `/p/<会话>/`、时间轴与场景来自工作区、写回工作区、
场景条跳转、片子栏从 guide 打开、带着会话身份、对话不被替换；`npm run gate:card` 让真实会话
跑一次 `motion_render`，验证卡片出现、片子栏自动打开，并让面板发一条批注，验证它作为消息
落进对话（需要本机凭据，缺失时跳过）；
`npm run gate:tools` 用真实会话调一次工具，并跑一次“写错 inject”的负控（需要本机凭据，缺失时跳过）。

![Plugins 页](docs/plugins-page.png)

### 能力面

agent 用的是命令，不是工具：

```bash
dsh-motion init [--title "标题"] [--length 6]
dsh-motion check
dsh-motion render --stills 0,3,6 [--cols 3]
dsh-motion render --video [--out out/film.mp4]
dsh-motion render --export [--gif] [--out out/export.mp4]
```

`skills/dsh-motion/SKILL.md` 是完整的手册：目录布局、时间轴字段、场景模块契约
（`id` / `slots` / `render(t)`）、`ctx` 能用的原语、确定性规则、常见错误。

### 参数与回退

面板不只是“看”，它能写文件。场景声明 `params`，面板渲染成滑杆：拖动即时改画面，**松手才落盘**。

| 阶段 | 发生什么 |
|---|---|
| 拖动 | `kernel.setParam` 改内存 → 立即重绘 → 文件不动 |
| 松手 | `POST /api/params` → 范围校验 → 快照旧文件 → 写 `timeline.params` |
| 越界 | 400 拒绝，文件与快照都不动（门禁里有负控） |
| 回退 | `POST /api/history/restore` → 先把当前版本存成 `pre-restore` → 再覆盖 |

快照在 `.motion/snapshots/`（已 gitignore），每次写保留上一版，最多 20 份。面板的“回退一步”和
`motion_history` 读的是同一份列表，不存在两套历史。

设计参照是 ReMotion 教程里的 studio 参数回路——让 agent 把要调的地方做成可编辑参数，人自己拖，
省掉一轮轮描述。有一处刻意不同：教程里参数直接存回代码，调坏了靠 git 恢复；这里每次写先落快照，
回退是一等操作，因为面板的写操作比手改更频繁。

可调的是数值（画面比例或秒数），不是颜色或文案：颜色走 `motion_palette`，文案走 `motion_texts`，
三者共用同一条「校验 → 快照 → 写」的路径（`src/project.mjs`）。

![参数面板](docs/ui-params.png)

### 参考摄取

“我刷到一个视频，想要那种感觉”以前只能翻译成形容词。现在可以先翻译成数字：

```bash
node scripts/reference.mjs clip.mp4 --out out/reference.json
```

| 字段 | 内容 |
|---|---|
| `cuts` | 切点 `{t, score, kind, spike}`：`hard` 是硬切，`soft` 是共享背景下的场景交换 |
| `motion` | `mean` / `p90` / `max` + 每 0.5s 一点的运动曲线 |
| `palette` | 主色 top5，带像素占比 |
| `segments` | 每个镜头的 `start` / `length` / `motion` / 主色 |

两遍流式解码：10fps 灰度算切点与运动（只留上一帧），2fps RGB 算颜色（每镜头一个直方图）。
没有时间戳、没有随机数——同一个文件两次跑出同样的字节，门禁断言了这条。

### 为什么要 `soft`

本仓库自己的片子是“同一底色上换内容”，8s 与 15s 的切点在像素上只有 0.016 与 0.073 的跳变，
按 0.12 的硬切阈值一个都找不到。所以补了第二条判据：**比前 1 秒的局部中位数高 3 倍以上，
且绝对值不低于 0.012**。用前视而不是对称窗口，是因为切进运动镜头时，对称窗口会把新镜头的
运动算进基线——第一版就是在这里把 4.0s 的硬切后两帧误判成了新切点。

实测把示例片自己当参考：

```
cuts      8.00s soft (0.016 · ×16.4)   15.00s soft (0.073 · ×72.7)
segments  0+8 | 8+7 | 15+4              ← 与 timeline.json 的三幕完全一致
palette   #0b1427 83%  #131d33 3%
motion    0+8 段 0.001 | 8+7 段 0.001 | 15+4 段 0.038
```

它不读 `timeline.json`，只读像素，却把那三幕的边界、时长和“最后一段在动”都还原了出来。

### 成片门禁与版面审计

### 成片门禁（读成片，不读代码）

`dsh-motion check --deliver` 量的是**事实**，不是观感：

| 红灯 | 含义 |
|---|---|
| 没有画面 / 没有声音 | 文件里缺流 |
| 长度不对 | 片长和时间线差 0.5s 以上 |
| 空画面 | 中段有连续 0.3s 以上的近乎纯色 |
| 幻灯片 | 一半以上的相邻帧完全一样 |
| 蓝紫雾 | 蓝紫像素占全片 30% 以上（题材需要时 `--allow-blue-purple "理由"`） |

构图好不好、像不像那个风格、值不值得看——**这三样不在这里判**。
它们走 `howto/交付.md` 的第二道（并排图 + 审片四问）和第三道（独立审片）。

### `npm run gate:layout`（版面审计）

渲染每个采样帧，记录每次 `fillText` 的位置/字号/透明度，然后检查：

- 文字是否在安全区内（边距 60px）
- 字号是否 ≥14px（缩到手机宽度仍可读）
- 同一帧的文字框是否互相重叠

当前示例片：**384 个文本框、38 帧，零违规**。

### 兼容性

| dsh 版本 | 状态 |
|---|---|
| `0.2.1-rc.1` | ✅ 已验证（2026-10-19）：安装、启动、面板、工具调用、负控 |
| 其它版本 | ⚠️ 未验证——插件机制面（服务名 / 槽名 / manifest 字段）跨 rc 会改名；升级后若启动日志出现 `entry did not activate`，先核对 `webServer` 与 `tools` 两个服务名 |

### 插件管理

装/卸/启停用官方 CLI：`dsh plugin --profile web add|remove <包>`；已装插件在**侧边栏 Plugins 页**
里查看与配置。卸载不会自动删除 `out/comments.json` 等运行数据，需要时手动清理。

