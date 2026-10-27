<h1 align="center">dsh-motion</h1>

<p align="center">
  用一句话做出动画：Agent 把镜头写成代码，你拿到逐帧可复现的 MP4。<br>
  <sub>不是「AI 生成视频」——画面是画出来的，所以文字不糊、数字是真的、重渲一百次一个像素都不差。</sub>
</p>

<p align="center">
  <img src="docs/demo/platform.gif" width="720" alt="地铁进站时的一阵风：一个 Agent 照一句话题目做的 11 秒短片">
</p>

<p align="center"><sub>「地铁进站时的一阵风」· 11 秒 · 1920×1080 · 带音轨 · 一个没参与过本仓库的 Agent 从 <code>init</code> 开始做的</sub></p>

---

## 为什么需要它

你已经会用剪辑软件。问题不是做不出来，是**改不动**：

- 改一处节奏，要在时间轴上重新对齐十几轨；
- 同一条片子做两个尺寸、三种文案，得再摆一遍；
- 三个月后想复现"那一版"，只能靠工程文件里的一堆图层。

dsh-motion 把片子变成**代码**：一个场景一个文件，`render(t)` 是时间的纯函数。
改一版就是改一次代码——可 diff、可回滚、可复用、可让 Agent 改。

它和"用 AI 生成视频"是两件事：那边是模型在猜下一帧，文字会糊、数字会飘；
这边每一帧都是算出来的。它和模板剪辑也不一样：**引擎里没有一行画画的代码**，
画法写在你的片子里，或者从样例里抄。

## 装

**在 dsh 里装插件**（推荐）：侧边栏 **Plugins → 添加插件 → `@vlln/dsh-motion`**，
装完在插件页里能看到 **Motion** 面板。

**命令行**：

```bash
dsh plugin --profile web add @vlln/dsh-motion
```

只想当命令行工具用，不装插件：`npx @vlln/dsh-motion init`。

运行时只依赖 Playwright，用本机已有的 Chrome for Testing，不额外下浏览器。

**装不上时**：多半是 profile 树外解析不到官方包——把包装进 profile（上面的命令就是），
不要在任意目录 `npm i` 后手改路径。

## 用起来

### 三步做第一条

```bash
mkdir my-film && cd my-film
dsh-motion init                                  # 时间轴 + 镜头表 + 可删的样例手艺
$EDITOR motion/镜头表.md                          # 一句话画风、3–6 个色值、每镜一个具体的物
dsh-motion check --deliver out/film.mp4
```

### 面板

在 dsh 里打开 **Motion**，左边是片子，右边是参数与批注，右下是镜头条。

| 你在这做什么 | 它会带回什么 |
|---|---|
| 拖一个参数旋钮 | 数值写进 `timeline.json`，下一帧生效，Agent 也读得到 |
| 点画面上的字直接改 | 写进文本槽，场景代码不用重编译 |
| 在画面上画个框写批注 | 落到 `motion/comments/`，Agent 下一步照着改 |
| 右上角看版本 | 面板显示的是**已发布的版本**，Agent 边写边改不会打断你的播放 |

空工作区打开是画廊，七格能播的样板；点开能看做法，也能一句话丢给 Agent 复刻。

### 命令

| 命令 | 做什么 |
|---|---|
| `dsh-motion init` | 建一条空片子：时间轴、镜头表、样例手艺 |
| `dsh-motion reference <视频>` | 抽帧、切点，读一段参考片当依据 |
| `dsh-motion render --stills\|--video` | 出静帧 / 出成片 |
| `dsh-motion check --deliver <mp4>` | 交付门禁：有画面、有声音、长度对、不是静止 |
| `dsh-motion version -m "…"` | 发布一个版本（面板跟的是这个） |

`check` 只断言**事实**。像不像、好不好看，它不判——那是并排图和人的事。

### 给 Agent 用

装完插件，Agent 会看到 `skills/dsh-motion/SKILL.md`：怎么写镜头表、怎么定画风、
怎么交付、六种做坏的方式。你只要给一句话的题目。

## 它现在能做成什么样

诚实地说：**结构像样，细节还粗。**

| | 盲评 | 是什么 |
|---|---|---|
| 地铁进站的一阵风 | 55 | 上面那条。麻胶版三色套印，独立 Agent 自写画法 |
| 埃及墓室壁画 | 64 | 卡在媒介质感与密度，不在骨架 |
| 一杯茶凉掉的过程 | 51 | 双版木口木刻 |
| 一枚硬币转到停下 | 37 | 铜版画排线 |

它做不到的：实拍、3D、浅景深、真实高光。它是图形与排版的工具，不是摄影机。
完整边界见 [docs/limits.md](docs/limits.md)。

## 里面有什么

```
src/       引擎：时间、画布、确定性、缓存、编码、音频、字体、素材。没有一行画画的代码
kit/       可整删的样例手艺，init 时复制进你的片子
cards/     一个风格一张卡：管线、色板、签名特征、坑、短板
howto/     做法的规程：新风格六步、从参考里取、角色、镜头表、审片、交付
showcase/  给用户看的样板（画廊）。引擎不引用它
```

判据三条：**`src/` 里没有画法；`kit/` 删掉照样跑；`cards/` 加一张，引擎不加一行。**

## 安全与数据

- **它会写你的磁盘**：`init` 在 `motion/` 下建文件；`version` 在 `motion/.versions/` 存快照；
  面板的改动直接写回 `timeline.json` 和场景代码。
- **它会起一个本地浏览器**：渲染走 Playwright + Chrome，只访问本机静态服务，不联网。
- **没有网络请求**：不下载素材、不上传片子、不调用任何 API。
- **凭据**：不需要任何 key。

## 兼容性

| dsh 版本 | 状态 |
|---|---|
| `0.2.1-rc.1` | ✅ 已验证（2026-10-27：面板、参数、批注、版本切换、交付门禁） |
| 其它版本 | ⚠️ 未验证——面板入口依赖宿主 client 的 `slots` 服务；更旧的 dsh 没有该服务时，入口不会出现 |

## 插件管理

装 / 卸 / 启停都用官方 CLI：

```bash
dsh plugin --profile web add @vlln/dsh-motion      # 装
dsh plugin --profile web remove @vlln/dsh-motion   # 卸
```

已装插件在**侧边栏 Plugins 页**里查看与配置；Settings 里的「插件」只是只读清单。

## 想深入

[功能细节](docs/features.md) · [契约](docs/kernel-contract.md) · [为什么这么设计](docs/decisions.md) ·
[门禁清单](docs/gates.md) · [给 Agent 的说明书](skills/dsh-motion/SKILL.md)

## 来源与致谢

这套做法源自 **[alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion/tree/main)**
（花叔 · 花生，MIT）：六步做一种新风格的流程、「人用 AI 生帧，代码负责合成」、
壁画的表面做法、空工作区给画廊。

分界：它的引擎里带着画法（`brush`/`medium`/`finish`），这里一行都没有。

## 许可

MIT
