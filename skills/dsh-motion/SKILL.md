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

## 命令

```bash
dsh-motion init [--title "标题"] [--length 6]   # 建一条空片 + 一个起始场景
dsh-motion validate                             # 校验时间轴和它引用的每个场景
dsh-motion render --stills 0,3,6 [--cols 3]     # 拼一张静帧对照表（快，用来审）
dsh-motion render --video [--out out/film.mp4]  # 整条视频
dsh-motion export [--gif] [--out out/export.mp4]
```

改完先 `validate`，再 `render --stills` 看几帧，最后才 `--video`。整条视频是逐帧渲染，慢。

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

## 常见错误

| 现象 | 原因 |
|---|---|
| `scene "x" is neither built in nor found at scenes/x.mjs` | 文件名或 `id` 不一致，或没写在 `motion/scenes/` |
| `scene module declares id "y"` | `export const id` 和文件名不符 |
| `invalid timeline: …` | 场景 id 不存在、`start` 不连续、`duration` 对不上、文字槽超长 |
| 画面全黑 | `render` 没铺底，或 `mount` 没保存 `ctx` |
| 导出比预览快/慢 | `render` 读了时间或用了随机 |
