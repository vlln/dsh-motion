---
name: dsh-motion
description: 在工作区里做或改一条动画：写 motion/timeline.json 和 motion/scenes/*.mjs，用 dsh-motion 命令自己跑、自己看。当用户要求做动画、片头、讲解片、数据动画，或修改已有的 motion/ 片子时使用。
---

# dsh-motion

你用这个库做动画。方式就是写代码、跑、看、改——没有别的工具面。

**一条片子 = 工作区里的 `motion/` 目录**：

```
motion/
  timeline.json      片子：尺寸、帧率、幕和时长、调色板、文字、数值
  scenes/<id>.mjs    每一幕怎么画（导出 id、slots、render(t)）
  out/               渲染产物（已被 .gitignore）
```

所有命令都在工作区根目录跑，读写都落在 `motion/` 里，不需要碰外面的文件。

## 开工前：先写 `motion/PLAN.md`

**面对一个项目，第一件事不是写代码，是写计划书。** `dsh-motion init` 已经放好模板，
照它的七节填；用户改哪节就改哪节，不要另起格式。这份文档是给人看的，程序不读它——
程序读的是 `timeline.json`。但**没有它，你会一路改一路偏**。

八节，一节写不满就别开工。用户没给的（画风、素材、节奏）由你定，但必须写明理由：

| 节 | 写什么 | 写不满的表现 |
|---|---|---|
| 1 一句话 | 谁在什么场合看，看完记住什么 | 只有「做一个产品动画」 |
| 2 观众 | 已知什么、需要被说服什么 | 不知道要解释多少 |
| 3 参考 | 学什么、**不学什么**；没有参考就自己定三个方向选一个 | 把参考的构图和角色一起搬过来 |
| 4 画风 | 定调、**为什么是它**、色值、字体、材料、禁令 | 每镜一个风格，一拼就散 |
| 5 导演策略 | 结构 / 节奏 / 情绪线 / 结尾落在哪 | 只有一串镜头，没有全片 |
| 6 镜头表 | 时间｜物｜它做什么｜镜头｜字｜转场 | 写不出「物」，只剩字和图标 |
| 7 素材 | 每行必须写**怎么得到**，以及得不到怎么降级 | 写到一半才发现缺图 |
| 8 验收 | 三条以内、可判定 | 「做好看一点」 |

**素材的降级规则**：照片拿不到就画成图解，图解画不出就换镜头——**不允许留白**。
素材放在 `motion/assets/`，场景里 `drawImage`；字体放 `motion/fonts/`。

写完给用户看一眼再动手。**这是一次对话，不是一次校验。**

### 素材从哪来

**不要凭空想象图片，也不要留白。** 三档，按顺序试：

1. **代码画**——几何、渐变、文字、图表。这是引擎的本事，优先用它。
2. **找一张**——用标好的脚本去免费库里搜：

   ```bash
   node <skill>/scripts/find-asset.mjs "modern living room interior" --n 6
   node <skill>/scripts/find-asset.mjs "modern living room interior" --get 2 --name room-base
   ```

   它搜 Wikimedia Commons（不需要 key），列出尺寸与许可；`--get` 会把图存进
   `motion/assets/plates/`，并**自动往 `CREDITS.md` 追加一行**（文件名、标题、许可、来源）。
   交付前把 `CREDITS.md` 的内容抄进 README。

3. **降级**——找不到合适的，就画成图解（色块 + 光），或者换一镜。**不允许留白。**

在场景里用相对路径取：

```js
const img = new Image();
img.src = './assets/plates/room-base.jpg';   // mount() 里预先加载
// render(t) 里 if (img.complete) g.drawImage(img, …)
```

图片必须预先在 `mount()` 里开始加载，`render(t)` 不能等异步。

### 三条规矩（计划之后）

1. **一镜一镜做**：写一个场景 → 渲进/中/出三帧 → 自己看 → 过关再写下一个。
2. **相邻两镜不要同一种镜头动作**；推近之后要拉出来。每镜都慢推就是 PPT。
3. **不要空画面**：没有具体物的镜头、大面积纯色一直不变，都是没做完。

### 预览性能：一帧 33 毫秒是上限

```bash
dsh-motion check --perf        # 每个场景的单帧耗时，超 33ms 退出码 1
```

面板是按 60fps 反复重画同一帧的。单个场景一帧超过 33 毫秒，用户就觉得"卡"；
超过 200 毫秒，播放会掉到个位数帧率。常见的三个元凶：

1. **`ctx.filter = blur(...)` 大面积反复用**——每帧都重新算卷积，一秒几十次；
   改成在 `mount()` 里预渲染一张模糊图，`render(t)` 只 `drawImage`。
2. **每帧新建渐变 / 循环几千个粒子**——能缓存的都缓存，粒子按屏幕面积定数量。
3. **整幅 `ImageData` 读写**——一帧 200 万像素的循环就是几百毫秒。

写场景时按「一帧 16ms 舒服、33ms 可接受、100ms 就是坏」来要求自己。

### 交付前

- 接触表（每秒一帧）看一遍节奏；
- 用正常速度看一遍——抽帧看不出卡不卡；
- 结尾别落在字卡上。

### 问一轮就够了

用户在话里没说清的才问，问了就给默认值（30 秒 / 1920×1080 / 无声音）；不答就按默认走。
问完就开工，别问第二遍。

## 命令

```bash
dsh-motion init [--title "标题"] [--length 6]    # 建一条空片 + 一个起始场景
dsh-motion init --template <id> | --template list  # 从样板建，或看有哪些样板
dsh-motion reference <video> [--template id]     # 拆参考：帧、切点、分镜 → out/ref
dsh-motion check                                 # 校验时间轴和它引用的每个场景
dsh-motion render --stills 0,3,6 [--cols 3]      # 拼一张静帧对照表（快，用来审）
dsh-motion render --video [--out out/film.mp4]   # 整条视频
dsh-motion render --export [--gif]
dsh-motion version -m "把 1945 的图钉改成红色"    # 收尾：存成用户可切换的版本
dsh-motion version list                          # 列出所有版本
dsh-motion version use v3                        # 切回某个版本（会先保存当前状态）
```

五个动词，一个阶段一个：`init` / `reference` / `check` / `render` / `version`。
**没有第六个。** 想做新的事，先问它属于哪个阶段；不属于就别加。

改完先 `check`，再 `render --stills` 看几帧，最后才 `--video`。整条视频是逐帧渲染，慢。

**收尾必须落版本**：每完成一次用户能看见的修改，最后一步跑 `dsh-motion version -m "…"`，
标题写**用户看得见的变化**（"把片尾语速放慢"），不是"updated files"。用户在面板顶部
的版本下拉里就是靠这句话找回来的。漏了这步，用户就只剩「未保存的修改」一个点，没有历史。

## 时间轴

```jsonc
{
  "width": 1920, "height": 1080, "fps": 60,
  "duration": 10,                      // 所有场景时长之和
  "scenes": [
    { "id": "blank", "name": "开场", "start": 0, "length": 6, "palette": "main", "speed": 1 }
  ],
  "palettes": { "main": { "bg": "#0b1426", "fg": "#f2f2f0", "accent": "#e0b040", "muted": "#8b98ad", "grid": "#243450", "panel": "#101c33" } },
  "texts":    { "blank": { "title": "标题", "subtitle": "副标题" } },
  "values":   { },                     // 数字槽
  "overrides": { },                    // 某场景/某元素的颜色覆盖
  "assets":   { }                      // 图片与片段
}
```

- `start` 必须连续、从 0 开始；改一幕的 `length` 后要顺延后面的 `start` 并更新 `duration`。
- `texts` 里的值优先于场景里 `slots` 的默认值。

## 一个场景

```js
export const id = 'titlecard';           // 必须和文件名一致
export const duration = 6;               // 可选：你这条动画的自然时长（秒）
export const slots = {
  title: { default: '标题', role: 'title', maxChars: 60 },
};
export const textUsage = { title: 1 };   // 可选

let ctx;
export function mount(context) { ctx = context; }

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);

  ctx.drawText('title', {
    x: ctx.width * 0.08, y: ctx.height * 0.38, w: ctx.width * 0.6,
    size: Math.round(ctx.height * 0.09), weight: 700, lineHeight: 1.15,
  });
}
```

### 段长：裁剪还是变速

`render(t)` 里的 `t` 是**这一场自己的秒表**。时间轴里给这一幕多长，决定它怎么走：

| 场景是否声明 `duration` | 时间轴段长变化时 |
|---|---|
| 不声明 | **裁剪**：段长 14 改成 2，只播放前 2 秒 |
| `export const duration = 14` | **变速**：同样 14 秒的内容，用 7 倍速走完 |

声明了 `duration` 的场景，把动作写到自己的自然时长里就行；段长由时间轴控制节奏。
`speed`（0.5×/1×/2×）在两种模式下都额外乘一次。

节拍类动画（用 `ctx.beats`）在变速后会与音乐对不上，这类场景不要声明 `duration`。

### 硬规则

`render(t)` 只能是 `t` 和数据到图片的纯函数：

- 不读时钟（`Date.now()`、`performance.now()`）；
- 不用 `Math.random()`——要随机用 `ctx.rng('名字')`；
- 不改模块外状态。

同一个 `t` 永远画出同一张图，导出才有意义。

### `ctx` 能给什么

| | |
|---|---|
| `ctx.canvas` | 本幕的画布（2D 或 WebGL） |
| `ctx.width` / `ctx.height` / `ctx.dpr` | 画布尺寸 |
| `ctx.color(token)` | 调色板颜色，含 overrides |
| `ctx.text(slot)` | 取文字槽的当前值 |
| `ctx.drawText(slot, opts)` | 排版并绘制，同时登记为可编辑、可命中 |
| `ctx.value(key)` / `ctx.drawValue(key, opts)` | 数字槽 |
| `ctx.rng(key)` | 可复现的随机 |
| `ctx.sceneStart` | 本幕在整条片子里的起始秒 |
| `ctx.beats` / `ctx.bpm` | 节拍网格（时间轴有 audio 时） |
| `ctx.image(name, opts)` / `ctx.frame(name, at, opts)` | 素材（先在 `timeline.assets` 声明，再在场景 `assets` 里列出） |

`drawText` 的常用项：`x y w size weight family lineHeight maxLines align color alpha`。
文字排版（断行、禁则、省略号）由内核负责，不要自己 `fillText`。

## 数字、参数、颜色

- 数字槽：场景导出 `values = { key: { value: 0, format: 'int'|'decimal'|'percent'|'compact', max?: 100 } }`，
  用 `ctx.drawValue('key', …)` 画；值写在 `timeline.values[sceneId][key]`。
- 参数（滑杆）：场景导出 `params = { key: { min, max, default, step?, label? } }`，
  场景里用 `curr = ctx.param?.('key')` 拿当前值（没有就用默认）。写 `timeline.overrides` 或面板。
- 颜色：`palettes.<name>` 是共享色板；`overrides['<scene>']` 或 `overrides['<scene>/<element>']` 是局部覆盖。

## 预览

工作区里的 `motion/` 会自动出现在对话右侧的片子里。改完时间轴或场景，面板会跟上；
场景代码改了需要刷新面板（浏览器缓存模块）。

## 从模板开始，而不是从空目录开始

空目录里只给一句需求，出来的东西一定平庸：模型要先发明版式、配色、动效，才轮到内容。
所以先选一个已经成立的舞台，再往里面换字、换色、换数据：

```
dsh-motion init --template list        # 有哪些舞台
dsh-motion template kinetic     # 在 motion/ 里生成一条可跑的片子
dsh-motion check && dsh-motion render --stills 0,3
```

| 模板 | 引擎 | 适合 |
|---|---|---|
| `kinetic` | 2D | 大字、字距、遮罩揭示 |
| `board` | 2D | 排行榜、名次变化、镜头爬升 |
| `guide` | 2D | 手绘图鉴、引线、打字机、扫描 |
| `desk` | 2D | 产品片：设备 + 悬浮卡片 |
| `prism` | 2D | 光：光束、玻璃棱镜、光谱扇面 |
| `orbit` | 2D | 星场、气态行星、环带前后遮挡 |
| `tree` | 2D | 线描生长、粒子 |
| `cards3d` | WebGL | 真三维：倒角卡片、PBR、投影地面、泛光 |

四个角色是**默认值，不是封闭集合**：片子可以在 `timeline.fonts` 里自定任意角色
（`{ "<role>": { family, src? } }`，`src` 必须放在片子的 `fonts/` 目录里）。
包只保证四个默认角色在任何机器上都解析得到；要别的字形，自己带文件。

**引擎选错等于白做。** 需要真透视、材质、灯光、阴影的，用 `kind: 'webgl'`；
二维的排印、图表、界面，用 canvas 2D。不要在 2D 里假装 3D（斜切矩形一眼假），
也不要用 WebGL 画本来就该是排版的字。

## 字体：四种角色，不许下载

片子里只允许四种字体角色，全部是系统栈（渲染时不联网、不装字体）：

| 角色 | 用途 |
|---|---|
| `sans` | 正文、界面、默认标题 |
| `display` | 大字标题（字距收到 -0.03em 左右） |
| `serif` | 档案、图鉴、引文 |
| `mono` | 标签、数字、代码、时间码 |

用角色名，不要写字体文件：`ctx.font('display')`、`ctx.drawText(slot, { family: 'serif' })`。
写一个没登记的名字会直接报错并列出可选项。**不要下载字体**，也不要依赖只在某台机器上装了的字体——
片子要在别人的机器上渲染成同一个样子。

### 某条片子要用别的字体

字体文件跟着片子走，不跟着机器走：

1. 把字体文件放进 `motion/fonts/`（woff2 / ttf / otf）；
2. 在 `timeline.fonts` 里给某个角色换掉，**角色名不新增**：

```json
"fonts": {
  "display": { "family": "Studio Serif", "src": "fonts/studio-serif.woff2", "weight": "400 700" }
}
```

3. 渲染前内核会 `FontFace` 预载它；找不到文件会报错，不会悄悄回退成别的字体；
4. `dsh-motion fonts` 会列出「film display → Studio Serif (fonts/…, ok/MISSING)」。

这样模板可以带自己的字体，用户也能为某一条片子换字体，但**字体角色仍然是四种**，
agent 仍然只需要记住角色名。

## 参考优先的一条工序

用户丢来一条参考片时，不要"看一遍凭感觉"，也不要从空目录开始。一条命令把两件事做完：

```
dsh-motion reference ref.mp4 --template kinetic
```

它会：没有片子就先按模板建一条 → 把参考抽成帧、接触表、切点写进 `motion/out/ref/` →
再写一份 `brief.json`（模板、片子的画幅与时长、参考的切点、下一步建议）。

接着把切点变成分镜：

```
dsh-motion reference <video> --shots --write
```

- 切点之间的段落成为 Beat，过短合并、过长拆分；
- `--write` 会为每个 Beat 复制一份场景（`beat01.mjs…`，各自独立 id），重排 `timeline.scenes` 并跑校验；
  内置场景（如 `cards3d`）没有文件可复制，会提示先把场景拷进 `motion/scenes/`。

分镜只给**长度与顺序**，每个 Beat 里怎么动仍然要写。之后：

```
dsh-motion check
dsh-motion render --stills 0,2,4
dsh-motion version -m "用户看得见的变化"
```

## 读参考视频：抽帧、接触表、切点

拿到一条参考片，不要"看一遍凭感觉"，先把它变成可读的数据：

```
dsh-motion reference ref.mp4 --fps 2 --cols 4
```

- 帧落在 `motion/out/ref/f001.jpg…`（480 宽，够看构图和字重）；
- `sheet.jpg` 是一张接触表，一次能扫完整条片的节奏；
- `index.json` 记录时长、画幅、帧数、**切点时间**（scene 分数 > 0.25）。

帧给你构图、配色、字级、镜头高度；切点给你节奏。**它们给不了运动曲线**——
缓动、错位、遮罩方向仍然要自己写，或者让用户描述。

## 动效的"轨迹"可以给图

想要特定路线（弧线、S 形、绕一圈），在纯白图上画出路径再让 agent 读图，
比用文字描述"先往左上再往下"可靠得多。读进来之后把路径采样成点，
在 `render(t)` 里按 `t` 插值即可。

## 透明背景：目前没有

导出走 h264 MP4，没有 alpha 通道。需要透明素材时，先渲 PNG 序列（`--stills` 逐帧）
再在剪辑软件里合成；不要承诺"导出带透明通道的 MP4"。

## 常见错误

| 现象 | 原因 |
|---|---|
| `scene "x" is neither built in nor found at scenes/x.mjs` | 文件名或 `id` 不一致，或没写在 `motion/scenes/` |
| `scene module declares id "y"` | `export const id` 和文件名不符 |
| `invalid timeline: …` | 场景 id 不存在、`start` 不连续、`duration` 对不上、文字槽超长 |
| 画面全黑 | `render` 没铺底，或 `mount` 没保存 `ctx` |
| 导出比预览快/慢 | `render` 读了时间或用了随机 |
