<h1 align="center">dsh-motion</h1>

<p align="center">
  用一句话做出动画：Agent 把镜头写成代码，你拿到逐帧可复现的 MP4。<br>
  <sub>不是「AI 生成视频」——画面是画出来的，所以文字不糊、数字是真的、重渲一百次一个像素都不差。</sub>
</p>

<p align="center">
  <img src="docs/demo/platform.gif" width="720" alt="地铁进站时的一阵风：一个 Agent 照一句话题目做的 11 秒短片">
</p>

<p align="center"><sub>「地铁进站时的一阵风」· 11 秒 · 1920×1080 · 带音轨 · 一个没参与过本仓库的 Agent 从 <code>init</code> 开始做的<br>
  完整 11 秒（带声音）<a href="https://github.com/vlln/dsh-motion/blob/main/docs/demo/platform.mp4">点这里</a></sub></p>

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

## 面板怎么用

<p align="center">
  <img src="docs/demo/ui.gif" width="760" alt="面板操作：播放、拖动时间条跳到别的镜头、点镜头签回到开头">
</p>

上面这段是实际操作录屏，四件事连着做：

1. **点画面上的站台号，直接改字**——「3」改成「7」，画布当场变，右边「这一镜的文字」同步；
2. **播放**，时间码往下走；
3. **拖时间条**跳到隧道口那一镜，右上角跟着换成那一镜的名字；
4. **点镜头签**回到别的镜。

指针是白色的圈。所有改动都落到 `timeline.json` 和场景代码里，Agent 下一步读到的就是你改过的版本。

| 你在这做什么 | 它会带回什么 |
|---|---|
| 拖时间条 | 任意时刻都能停；拖到哪一镜，右上角就换成那一镜的名字 |
| 点底部镜头签 | 跳到该镜开头；签上的 `⋯` 能改镜长、改文案 |
| 点画面上的字直接改 | 写进文本槽，场景代码不用重编译 |
| 在画面上画个框写批注 | 落到 `motion/comments/`，Agent 下一步照着改 |
| 右上角看版本 | 面板显示的是**已发布的版本**，Agent 边写边改不会打断你的播放 |

空工作区打开是画廊，七格能播的样板；点开能看做法，也能一句话丢给 Agent 复刻。

## 三步做第一条

```bash
mkdir my-film && cd my-film
dsh-motion init                                  # 时间轴 + 镜头表 + 可删的样例手艺
$EDITOR motion/镜头表.md                          # 一句话画风、3–6 个色值、每镜一个具体的物
dsh-motion check --deliver out/film.mp4
```

`check` 只断言**事实**：有画面、有声音、长度对得上、不是静止。
像不像、好不好看，它不判——那是并排图和人的事。

## 给 Agent 用

装完插件，Agent 会看到 `skills/dsh-motion/SKILL.md`：怎么写镜头表、怎么定画风、
怎么交付、六种做坏的方式。你只要给一句话的题目。

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

## 参考

这个插件是参考 **[Claude Motion](https://support.claude.com/zh-CN/articles/17454997-%E5%BC%80%E5%A7%8B%E4%BD%BF%E7%94%A8-claude-motion)**
的做法做的：让 Agent 直接产出带动画的画面，而不是由人生成一段视频再剪。
区别在于 dsh-motion 把「生成」落到了代码上——每一帧可复现、可 diff、可回滚。

做法上的另一处来源是
**[alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion/tree/main)**
（花叔 · 花生，MIT）：六步做一种新风格的流程、「人用 AI 生帧，代码负责合成」、
壁画的表面做法、空工作区给画廊。

## 想深入

[功能细节](docs/features.md) · [契约](docs/kernel-contract.md) · [为什么这么设计](docs/decisions.md) ·
[已知限制](docs/limits.md) · [给 Agent 的说明书](skills/dsh-motion/SKILL.md)

## 许可

MIT
