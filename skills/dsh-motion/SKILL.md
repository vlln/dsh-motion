---
name: dsh-motion
description: 在工作区里做或改一条动画：写 motion/timeline.json 和 motion/scenes/*.mjs，用 dsh-motion 命令自己跑、自己看。当用户要求做动画、片头、讲解片、数据动画，或修改已有的 motion/ 片子时使用。
---

# dsh-motion

你用这个库做动画。方式是写代码、跑、看、改——没有别的工具面。

**你先想清楚画面，再动手。** 一条片子的质量在写第一行代码之前就基本定了：
你有没有真的看过参考、有没有量过它的颜色和节奏、有没有说清楚每一镜里**一个具体的物在做什么**。

**引擎不提供风格。** 它只提供时间、画布、确定性、缓存、出片、声音、字体和素材。
画法由你写。`motion/kit/` 里是可抄的样例——可以改、可以删、可以一个都不留。

## 先分档：你按哪一档读

- **开阔档**：你是有能力自己写渲染器的模型。全文适用；`kit/` 只是起点，不是清单；
  需要新画法就写进 `scenes/_<风格>.mjs`，不要往引擎里加。
- **轨道档**：其它情况，或者你判断不出自己是谁。只走这一条，按顺序，不跳步：

```
写镜头表  →  一帧先行  →  让它动  →  check  →  render  →  check --deliver  →  独立审片
```

## 用户说了什么，就读哪个

| 用户说的 | 做什么 | 读 |
|---|---|---|
| 「做个动画」「做条片子」 | 先写镜头表，再按上面的顺序走 | `motion/镜头表.md` → 本文「命令」「一个场景」 |
| 「做个 XX 风格的动画」「梵高／埃及／8-bit 那种」 | **新风格**：先量参考，再写程式 | [`protocol/新风格.md`](../protocol/新风格.md) 六步，然后 `cards/INDEX.md` 找最近的卡 |
| 「复刻这个动画」「拆一下这段」 | 抽帧、切点、接触表，再重建 | `dsh-motion reference` → 本文「读参考视频」 |
| 「配个乐」「卡节奏」 | 写谱子，渲成音轨 | 本文「声音」 |
| 画面里要有人（主角、脸、手） | **不要用代码小人代替**；有生图工具就生图，没有就只出手和背影 | [`protocol/角色.md`](../protocol/角色.md) |
| 「改一下这条片子」 | 读 `timeline.json` 和 `scenes/`，改最小的一处 | 本文「时间轴」「一个场景」 |
| 「这画面不好看」/ 分数上不去 | 先按涨分顺序查：色板量了吗、媒介抄源码了吗、人物生图了吗 | [`protocol/涨分.md`](../protocol/涨分.md) |

## 窄桥：照字面做

- **一镜一个具体的物和一个动作。** 写不出物的那一行，先别做——它还不是一个镜头。
- **一片一套画风、一套色板**，管到最后一帧。中途换画风就是拼贴。
- **样板只学做法，不搬画面。** 参考的构图、角色、配色不进成片。
- **有参考、或者用户点名了风格** → 走 [`protocol/新风格.md`](../protocol/新风格.md) 六步：
  至少 3 幅不同作品，写 5 条签名特征（必须／加分／禁忌）。没有这一步，做出来的一定是
  「同一个现代插画师换了套色板」。
- **只给了一个题目、没给参考** → 不走六步。在镜头表里定画风三行，自己挑一个方向做下去；
  但只要你打算把这个画法**登记成 `cards/` 里的一张卡**，就得补六步：量参考、写签名、并排、盲评。
- **能搬的都搬，不能搬的才自己造。** 色板用 `palette-from` 量；参考是代码就读参考的源码；
  人物走生图。三条都有实测涨分记录，见 [`protocol/涨分.md`](../protocol/涨分.md)。
- **人由生图给，代码只负责合成。** 没有生图能力就只出手和背影，**不要用代码小人代替**。
  见 [`protocol/角色.md`](../protocol/角色.md)。
- **禁止在扁平矢量上叠一层噪点就算风格。** 媒介改变的是形，不是表面。
- **确定性**：所有随机用 `ctx.rng(key)`，同一时刻渲两次逐像素一致。
- **一次对话，不是一次校验**：写完镜头表给用户看一眼再动手。

## 一条片子长什么样

```
motion/
  timeline.json      片子：尺寸、帧率、幕和时长、调色板、文字、数值
  scenes/<id>.mjs    每一幕怎么画（导出 id、slots、mount(ctx)、render(t)）
  scenes/_*.mjs      共享模块（世界、道具、画法），不是一幕——`_` 开头就不算场景
  镜头表.md          这一版的镜头表（画风三行 + 每镜一行）
  kit/               可抄的画法样例，删掉引擎照样跑
  audio.json         谱子（可选）
  out/               渲染产物（已被 .gitignore）
```

所有命令都在工作区根目录跑，读写都落在 `motion/` 里。

## 开工顺序

1. **填 `镜头表.md`**：画风三行、每镜的物和动作。填不满别往下走。
2. **一帧先行**：先把一镜的静帧画对，`dsh-motion render --stills 3 --out out/try.png`（`--out` 不带扩展名会自动补，但带上更清楚）。
   这一帧不对，动画只会放大这个不对。
3. **让它动**：一个主动作 + 两个母题循环。不要所有片子都用同一套淡入淡出。
4. **`check`**：时间线、每幕的单帧耗时、画面构成。
5. **`render --video`**，然后 **`check --deliver`**：它量的是片子本身——有没有画面、有没有声音、
   长度对不对、中段有没有空画面、是不是幻灯片、蓝紫占多少。见 [`protocol/交付.md`](../protocol/交付.md)。
6. **派一个没参与制作的 agent 只看成片审片**，结论写进 `motion/审片/*.md`。

## 开工前：先填 `motion/镜头表.md`

**第一件事不是写代码，是把画面说清楚。** `init` 放好的就是那张表：上面三行画风，下面每镜一行。
这张表是给人看的，程序不读它——程序读的是 `timeline.json`。但**没有它，你会一路改一路偏**。

表里只有两段：三行画风 + 每镜一行。写不满，多半是下面某一件事没想清楚——**这八条是想清楚的清单，不是文档的小节**。用户没给的（画风、素材、节奏）由你定，但必须写明理由：

| 节 | 写什么 | 写不满的表现 |
|---|---|---|
| 1 一句话 | 谁在什么场合看，看完记住什么 | 只有「做一个产品动画」 |
| 2 观众 | 已知什么、需要被说服什么 | 不知道要解释多少 |
| 3 参考 | **风格图还是成片**；学什么、不学什么；没有参考就自己定三个方向选一个 | 把参考的构图和角色一起搬过来 |
| 4 画风 | 定调、**为什么是它**、色值、字体、材料、禁令 | 每镜一个风格，一拼就散 |
| 5 导演策略 | 结构 / 节奏 / 情绪线 / 声音 / 结尾落在哪 | 只有一串镜头，没有全片 |
| 6 镜头表 | 时间｜物｜它做什么｜机位与运动｜主光｜字｜转场 | 写不出「物」和「机位」，只剩字和图标 |
| 7 素材 | 每行必须写**怎么得到**，以及得不到怎么降级 | 写到一半才发现缺图 |
| 8 验收 | 三条以内、可判定 | 「做好看一点」 |

**素材的降级规则**：照片拿不到就画成图解，图解画不出就换镜头——**不允许留白**。
素材放在 `motion/assets/`，场景里 `drawImage`；字体放 `motion/fonts/`。

写完给用户看一眼再动手。**这是一次对话，不是一次校验。**

### 先出一条能看的粗版，再回头精修

**不要等到素材齐、镜头设计完才渲染第一帧。** 拿到素材的十分钟内就要有一条能跑的粗版：
时间轴对、每镜有东西、`check` 绿。之后每次只改一处，改完立刻渲一帧看。

这条规矩是为了防一种失败：整段时间都花在找素材和设计上，最后什么都没渲出来。

### 素材从哪来

**不要凭空想象图片，也不要留白。** 三档，按顺序试：

1. **代码画**——几何、渐变、文字、图表。要精确控制的东西优先用它。
2. **找一张**——用标好的脚本去免费库里搜：

   ```bash
   node <skill>/scripts/find-asset.mjs "modern living room interior" --n 5
   node <skill>/scripts/find-asset.mjs "modern living room interior" --get 2 --name room-base
   ```

   **有时间预算：最多搜两轮、最多拿 3 张，选一张就停。** 素材不是片子——找不到合适的就
   进第 3 档，不要为了一张图换五个关键词。

   它搜 Wikimedia Commons（不需要 key），列出尺寸与许可；`--get` 会把图存进
   `motion/assets/plates/`，并**自动往 `CREDITS.md` 追加一行**（文件名、标题、许可、来源）。
   交付前把 `CREDITS.md` 的内容抄进 README。

   还有一种用法比贴图更强：**把整张图当世界**，人在上面走——底图不进 `render()`，进 `mount()`。

3. **降级**——找不到合适的，就画成图解（色块 + 光），或者换一镜。**不允许留白。**

在场景里用相对路径取：

```js
const img = new Image();
img.src = './assets/plates/room-base.jpg';   // mount() 里预先加载
// render(t) 里 if (img.complete) g.drawImage(img, …)
```

图片必须预先在 `mount()` 里开始加载，`render(t)` 不能等异步。

**声音有两条路**：设计的（提示单合成）或自带的（一条现成的轨），见下面「声音」一节。

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

**最快也最像画的那条路是同一件事**：把不动的东西（墙、地板、书架、底层笔触）在 `mount()`
里画进一张离屏 canvas，`render(t)` 只 `drawImage` 它，再画会动的那几样（光、粒子、一个
主体动作）。厚涂、网点、几千笔笔触这类"画得起但算不起"的东西，都能这么做。

写场景时按「一帧 16ms 舒服、33ms 可接受、100ms 就是坏」来要求自己。

### 交付前

**先量，再看，最后请外人看。** 三道，一道没过别开下一道：

1. `dsh-motion check --deliver` —— 画面、声音、长度、空画面、幻灯片、蓝紫，六条事实；
2. 抽帧排一排对着镜头表看，再并排看参考：**去掉名字还认得出吗**；
3. 派一个没参与制作的 agent 只看成片审片，结论写进 `motion/审片/*.md`。

`check` 里 look 那三个数（`solid` 大块同色占比 / `texture` 局部细节 / `contrast` 明度跨度）**只是线索，不是门槛**：
暗帧天然低，平涂天然高。有参考就比参考，没参考就挑一张同类的帧比，别拿它当分数。
详见 [`protocol/交付.md`](../protocol/交付.md)。


### 问一轮就够了

用户在话里没说清的才问，问了就给默认值（30 秒 / 1920×1080 / 有环境声）；不答就按默认走。
问完就开工，别问第二遍。

## 命令

```bash
dsh-motion init [--title "标题"]                     # 空时间线 + 镜头表 + kit/，没有场景
dsh-motion reference <video> [--fps 2]           # 拆参考：帧、切点、分镜 → out/ref
dsh-motion check                                 # 校验时间轴、每幕耗时、画面构成
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

## 声音：设计出来的，或者带进来的一条轨

默认**要有声音**。没声音的片子，观众第一秒就知道它还差一块。两条路，选一条：

| | 什么时候用 | 怎么做 |
|---|---|---|
| **合成**（提示单） | 声音要和画面事件对位：翻页在 34 秒、铃在 10 秒 | 写 `motion/audio.json`，`make-audio` 合成 |
| **自带**（一条轨） | 整片只要一条情绪轨；用户给了音乐；用了实录音效 | 文件放进 `motion/assets/audio/`，`make-audio --use` 声明它 |

两条路都落在同一个地方：`timeline.audio = { src, targetLufs, fit }`。**片的长度永远由画面决定**，
音轨短了就按 `fit` 处理——`trim` 只放一遍、后面是静音（默认）；`loop` 循环到片尾。

### 合成：写一张提示单

```json
{
  "layers": [
    { "kind": "rain", "gain": 0.13 },
    { "kind": "roomtone" },
    { "kind": "pad", "bpm": 56 },
    { "kind": "page", "at": 34 },
    { "kind": "wheel", "at": 56 }
  ]
}
```

- **不写 `length`**：片多长声音就多长，跟着剪辑走。写死了就会和改过的剪辑对不上；
- 没有 `at` 的层铺满全片（环境）；有 `at` 的层是那一秒的事件；
- `gain` 不写就用这一类的默认值，环境类默认已经很轻；
- 有 `pad` 或 `score` 就有节拍：`timeline.beats` 会被写上，场景里 `ctx.beats` 直接对得上。

```bash
# 脚本在包的 skills/dsh-motion/scripts/ 下。从片子根目录跑时给相对路径，或先 cd 到包目录：
node ../../skills/dsh-motion/scripts/make-audio.mjs      # 渲染，打印要贴进 timeline 的那行
node skills/dsh-motion/scripts/make-audio.mjs --write   # 渲染并写回 timeline.json
```

它产出三样：`motion/assets/audio/bed.wav`、`motion/out/audio/wave.png`（波形 + 每条 cue
一根竖线）、终端上一行 `level ▅▆▇▆▇▆█▆`（一秒一个块）。

**你听不见，但你能看**：一条平的块说明没有起伏，事件被环境盖住了——把环境的 `gain`
降下来重跑。波形图该在某几秒明显高出其余部分，那就是你的重音。

| kind | 是什么 | 参数 |
|---|---|---|
| `rain` `roomtone` `wind` `pad` | 铺底 | `gain`；`pad` 还有 `bpm`（每分钟拍数）、`root`（**频率，Hz**，不是音名）、`chord`（**频率倍数数组**，不是和弦名） |
| `score` | **配乐**：段落、和声、动机 | `bpm`、`key`、`chords`、`motif`、`sections` |
| `clock` | 铺底，秒针 | `every`（默认 1 秒一响） |
| `page` `bell` `wheel` `click` | 事件 | `at`、`gain`；`bell` 还有 `freq` `decay` |

三条规矩：铺底不超过两层；每镜的重音最多一个 cue；最后 1–2 秒只留环境声，让片子落地。

### 配乐：段落按八分音符数，一换段就换音色

`score` 不是"铺一层和声"，是一小段**编曲**。写法只有四个概念：

```json
{ "kind": "score", "bpm": 128, "key": "D3",
  "chords": ["Dm", "Bb", "F", "C"],
  "motif": [0, 3, 7],
  "sections": [
    { "eighths": 6, "voice": "harp" },
    { "eighths": 4, "voice": "flute" },
    { "eighths": 4, "voice": "harpsichord" },
    { "eighths": 2, "voice": "square", "drums": true },
    { "eighths": 12, "voice": "saw", "drums": true } ] }
```

- **`bpm` 是网格**，不是情绪。画面的事件时间点要对到网格上，才有那个"咔"和顿挫是同一下的感觉；
- **`sections` 里的 `eighths` 是这一段的长度（八分音符数）**。要更快，**让段变短**，不要提 bpm——6 → 4 → 2 → 1 就是这个效果；
- **`chords` 一小节一个和弦，四和弦循环就够**；换段就往下走一个，动机随之移调（会保持在六度以内，不会掉八度）；
- **`motif` 是相对和弦根音的半音数**，三个音足够。一段里每三个八分音符陈述一次，太短的段自然只响第一个音。

音色（`voice`）：`flute` `harp` `harpsichord` `organ` `marimba` `square` `saw`，外加低音 `bass`（自动）。
写错了会报错并列出这些名字。段上可以 `"drums": true` 加底鼓和踩镲。

`make-audio` 会告诉你**配乐在哪一秒结束**——短于片长不是错误（尾巴留环境声很好），
但要你自己知道。有 `score` 时 `timeline.beats` 写的就是它的网格，场景里 `ctx.beats` 直接踩点。

### 自带：把一条轨变成片子的配乐

```bash
node skills/dsh-motion/scripts/make-audio.mjs --use assets/audio/theme.wav --write
node skills/dsh-motion/scripts/make-audio.mjs --use ~/Downloads/music.mp3 --loop --write
```

- 文件不在片子里就先复制进 `motion/assets/audio/`——片子要能整个搬走；
- 它会读时长、跟片长比，告诉你短了多少、要不要 `--loop`；
- **是 wav 就顺手分析节拍**并写 `timeline.beats`（mp3 不分析，要踩点就转成 wav）；
- 用哪条路由 `fit` 决定，不是由文件长短决定。

自带一条别人的音乐时，许可记进 `motion/CREDITS.md`（和 `find-asset` 的图片同一条规矩），
交付前抄进 README。自己录的、合成的、公有领域的，都要写清出处。

写进 `timeline.audio` 之后，面板播放就有声音，导出自动混流（`targetLufs` 默认 -20）。

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
  "assets":   { },                     // 图片与片段
  "audio":    { "src": "assets/audio/bed.wav", "targetLufs": -20 },
  "beats":    { "bpm": 56, "beats": [0, 1.07, 2.14] }   // 由 audio.json 的 pad 决定，不要手写
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
| `ctx.beats` / `ctx.bpm` | 节拍网格（`audio.json` 里有 `pad` 时自动写上） |
| `ctx.still(draw, {scale})` | 画一次存起来，每帧贴回；`scale > 1` 画得更大，推近不糊 |
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
4. 文件不在 `motion/fonts/` 里时，`dsh-motion check` 直接报错——不会悄悄回退成别的字体。

这样作品可以带自己的字体
agent 仍然只需要记住角色名。

## 拿到风格参考：先量，再写成代码

用户丢来一张画、一张图，说「用这个风格」——**不是让你临摹它，也不是让你挑一个现成滤镜**。
先按 [`protocol/新风格.md`](../protocol/新风格.md) 走六步，第一步就是量四件事：

1. **笔触**：方向（顺结构还是逆结构）、长度、密度、抖不抖；平涂还是厚涂；
2. **色**：主色 3–6 个、有没有互补色对、暗部往冷还是往暖偏；
3. **边缘**：硬边（矢量／印刷）还是软边（油画／摄影），有没有描边、多宽；
4. **底**：纸纤维、网点、画布纹理、胶片颗粒、暗角——**也可能这一切都没有**（埃及壁画、8-bit 就没有）。

然后写 5 条签名特征（必须／加分／禁忌），**再动手**。

**「第 3 层：表面」不是默认。** 平涂、像素、壁画这些年代，加材质就是毁掉它；
它们是**程式**（怎么画一张脸、一块砖、一个字）＋**色板**＋**纹样密度**。

参考是**成片**（视频）时走下一节；两者可以同时用——视频给节奏和机位，图给色彩关系和造型。
用户没说「复刻」，就不要把参考的构图和物件一起搬过来。


## 读参考视频：抽帧、接触表、切点、分镜

拿到一条参考片，不要「看一遍凭感觉」，先把它变成可读的数据：

```
dsh-motion reference ref.mp4 --fps 2 --cols 4
```

- 帧落在 `motion/out/ref/f001.jpg…`（480 宽，够看构图和字重）；
- `sheet.jpg` 是一张接触表，一次扫完整条片的节奏；
- `index.json` 记录时长、画幅、帧数、**切点时间**；
- `brief.json` 是给下一步的简报：画幅、时长、切点、建议。

把切点变成分镜：

```
dsh-motion reference ref.mp4 --shots --write
```

- 切点之间的段落成为 Beat，过短合并、过长拆分；
- 它写出一张 `out/ref/镜头表.md`（时间段已经填好，「物」和「动词」留空）；
- 片子里**已经有镜头**时，才会把那一个场景按 Beat 复制成 `beat01.mjs…` 并重排 `timeline.scenes`。
  没有镜头就只给表——先写第一镜，再回来拆。

帧给你构图、配色、字级、镜头高度；切点给你节奏。**它们给不了运动曲线**——
缓动、错位、遮罩方向仍然要自己写，或者让用户描述。

之后：

```
dsh-motion check
dsh-motion render --stills 0,2,4
dsh-motion version -m "用户看得见的变化"
```


## 动效的"轨迹"可以给图

想要特定路线（弧线、S 形、绕一圈），在纯白图上画出路径再让 agent 读图，
比用文字描述"先往左上再往下"可靠得多。读进来之后把路径采样成点，
在 `render(t)` 里按 `t` 插值即可。

## 透明背景：目前没有

导出走 h264 MP4，没有 alpha 通道。需要透明素材时，先渲 PNG 序列（`--stills` 逐帧）
再在剪辑软件里合成；不要承诺"导出带透明通道的 MP4"。

## 画法住在哪

| 放哪 | 是什么 | 规则 |
|---|---|---|
| `motion/kit/` | 可抄的样例：笔触、媒介通道、像素栅格、透视、骨架、后期 | 可以改、可以删、可以一个都不留 |
| `motion/scenes/_<风格>.mjs` | 这个片子自己的画法 | 一个风格一份；场景 import 它 |
| `src/` | 引擎 | **不要碰**。改引擎不是你的活，而且下次升级会被覆盖 |

需要 `kit/` 里没有的画法，写进 `scenes/_<风格>.mjs`，不要往引擎里加，也不要等引擎加。

## 方向不对时，先量再改

「不好看」不是一个可执行的意见。先分清是哪一种：

| 症状 | 多半是 | 怎么查 |
|---|---|---|
| 不像那个风格 | 画法：形、色、描边、构图规则 | 并排图；签名特征逐条打钩 |
| 每一帧都在跳 | 运动：整层重抖，或者元素位移太大 | `check --deliver` 看每帧改动 |
| 看着脏 / 糊 / 一眼 AI | 表面：在不该叠材质的地方叠了材质 | 关掉后期再看一眼 |
| 空的、没东西看 | 构图：主体太小，或者根本没写「物」 | 抽帧排一排，逐镜问「这镜在讲什么」 |

**先删，再加。** 画面不对时，第一反应不要是「再叠一层效果」，而是**删到只剩签名**：
去掉后期、去掉装饰、只留那个风格必须有的东西。剩下的还不对，才是画法的问题。


## 常见错误

| 现象 | 原因 |
|---|---|
| `scene "x" has no module at scenes/x.mjs` | 文件名或 `id` 不一致，或没写在 `motion/scenes/` |
| `scene module declares id "y"` | `export const id` 和文件名不符 |
| `invalid timeline: …` | 场景 id 不存在、`start` 不连续、`duration` 对不上、文字槽超长 |
| `this film has no shots yet` | 还没写 `scenes/<id>.mjs`，或 `timeline.scenes` 是空的 |
| `check --deliver` 报 no audio stream | 没写 `audio.json`，或没有 `make-audio.mjs --write` |
| 画面全黑 | `render` 没铺底，或 `mount` 没保存 `ctx` |
| 导出比预览快/慢 | `render` 读了时间或用了随机 |
