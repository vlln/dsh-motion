<h1 align="center">dsh-motion</h1>

<p align="center">
  你描述一个镜头，Agent 把它写成代码，你拿到一条 MP4。<br>
  改一行，重渲一次，还是那条片子——只是这回对了。
</p>

<p align="center">
  <img src="docs/demo/platform.gif" width="720" alt="地铁进站时的一阵风：一个 Agent 照一句话题目做的 11 秒短片">
</p>

<p align="center"><sub>「地铁进站时的一阵风」，11 秒，带声音。做它的 Agent 之前没见过这个仓库，只拿到一句话的题目。<br>
  想听声音看 <a href="docs/demo/platform.mp4">完整片子</a>。</sub></p>

<p align="center">
  <img src="docs/demo/ui.gif" width="760" alt="同一个片子，在面板里改：画面上的字、时间、镜头都能直接改">
</p>

<p align="center"><sub>同一条片子，在面板里改。改完就是代码里的那一行。</sub></p>

---

## 为什么不直接用剪辑软件

我用剪辑软件做过东西，最烦的不是做，是改。挪两秒，后面十几轨要重新对齐；客户说"再来个竖版"，整条重摆一遍；三个月后想找"那一版"，只能翻工程文件，翻到了也说不清是哪一版。

所以这里把片子写成代码。一个场景一个文件，`render(t)` 拿到时间，算出这一帧。改一版就是改代码：能 diff、能回滚、同一份代码出三个尺寸。顺手的好处是 Agent 也改得动——它读代码比读时间轴靠谱。

它不是"AI 生成视频"。那边是模型在猜下一帧，字会糊、数字会飘，出错也没地方改。这边每个像素都是算出来的：文字就是文字，数字就是数字，渲一百次一个样。

还有个不太显眼的地方：**引擎里没有一行画画的代码**。画法在片子里，或者从样例里抄。所以你的片子不会和别人长得一样——这是故意的。

## 装

在 dsh 里：侧边栏 **Plugins → 添加插件 → `@vlln/dsh-motion`**。装完那里会出现一个 **Motion** 面板；要是没出现，重启一次 dsh——插件是启动的时候装配的。

命令行也行：

```bash
dsh plugin --profile web add @vlln/dsh-motion
```

只想拿它当命令行工具、不要面板，就 `npx @vlln/dsh-motion init`。

运行时只依赖 Playwright，用你本机已经有的 Chrome for Testing，不会再下一次浏览器。

装不上多半是一个原因：包没进 profile，解析不到官方那套依赖。用上面那条命令，别自己在某个目录 `npm i` 完再手改路径。

## 做第一条

```bash
mkdir my-film && cd my-film
dsh-motion init                                  # 时间轴、镜头表、一份可删的样例手艺
$EDITOR motion/镜头表.md                          # 一句话画风、三五个色值、每镜一个具体的物
dsh-motion check --deliver out/film.mp4
```

`check --deliver` 只说事实：有没有画面、有没有声音、长度对不对、是不是一帧没动。像不像、好不好看，它不管——那得你自己看，或者找个人看。

第一次做，多半会卡在镜头表那一行。写不出"这是什么物、它在干什么"，就先别做：那还不是一个镜头。

## 交给 Agent

装完插件，Agent 就能读到 `skills/dsh-motion/SKILL.md`——怎么写镜头表、怎么定画风、什么算交付、六种把它做坏的方式。你给它一句话的题目就行，剩下的它自己折腾。

## 兼容性

| dsh 版本 | 状态 |
|---|---|
| `0.2.1-rc.1` | 能用。2026-10-27 测过面板、参数、批注、版本切换和交付门禁 |
| 其它版本 | 没测过。面板入口要用宿主的 `slots` 服务，更老的 dsh 没有，入口就不出来 |

## 插件管理

```bash
dsh plugin --profile web add @vlln/dsh-motion      # 装
dsh plugin --profile web remove @vlln/dsh-motion   # 卸
```

装好之后在侧边栏 Plugins 页看它、配它。Settings 里那个「插件」只是清单，改不了东西。

## 参考

**Claude Motion** 是起因：让 Agent 直接产出会动的画面，而不是人做完再剪。区别在于这边把"生成"落在代码上，所以每一帧都还能改。

做法上欠了 **[alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion/tree/main)** 不少（花叔 · 花生，MIT）：六步做一种新风格的流程、"人用 AI 生帧、代码负责合成"、壁画的表面怎么刷出来，还有空工作区该给画廊而不是一段说明。这几条都是照着做的。

## 想深入

[功能细节](docs/features.md) · [契约](docs/kernel-contract.md) · [为什么这么设计](docs/decisions.md) ·
[已知限制](docs/limits.md) · [给 Agent 的说明书](skills/dsh-motion/SKILL.md)

## 许可

MIT
