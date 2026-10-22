# 原语矩阵

> 原语 = 内核提供给场景作者的**能力件**。场景用原语组合镜头，不从零画像素。
>
> 一个原语只有同时满足四件事才算"存在"，缺一件就是欠账：
>
> | 件 | 含义 | 缺了会怎样 |
> |---|---|---|
> | **画得出** | 确定性绘制，只依赖 `t` 与数据 | 导出与预览不一致 |
> | **点得到** | 每帧往元素表登记 `{id, box}` | 批注点不到、面板列不出 |
> | **改得动** | 声明可编辑字段（文本槽 / 数值 / 参数） | 面板只能看，改动要绕回 agent |
> | **导得出** | 在捕获路径里正确出现，2× 时正确重采样 | 预览有、成片没有 |
>
> 四件套不是"以后补"，是**原语的验收标准**。新原语必须带门禁。

---

## 现状

| 原语 | 画得出 | 点得到 | 改得动 | 导得出 | 状态 | 工作项 |
|---|---|---|---|---|---|---|
| 文字 | ✅（`ctx.drawText`） | ✅（按槽命中） | ✅（面板 + 工具） | ✅ | 可用 | — |
| 形状 / 路径 | ✅ | ✅ | ✅（params） | ✅ | 可用 | — |
| 3D（WebGL） | ✅ | ❌ | ❌ | ✅ | 可用但不可编辑 | 未排期 |
| 图片 | ✅ | ✅ | ⚠️（数据通） | ✅ | 可用（P2） | 面板选择器 |
| 视频帧 | ✅（雪碧图） | ✅ | ⚠️（数据通） | ✅ | 可用（P2） | 面板选择器 |
| 数据 / 图表 | ✅（`ctx.value` / `drawValue`） | ✅ | ✅（面板 + 工具） | ✅ | 可用 | — |
| 粒子 / 噪声 | ✅（自写） | ❌ | ⚠️ | ✅ | 可用 | — |
| 音频（音床） | — | — | ✅（timeline.audio） | ✅ | 可用 | — |

"点得到 / 改得动"的空白格子，就是后面几个里程碑的工作项。

---

## 每个原语的契约

### 文字（P1，已完成绘制与命中）

`ctx.drawText(slot, opts)` 把断行、绘制、登记、槽身份合成一次调用。断行在 `src/text.mjs`：
中文按字断、英文按词断、闭括号不上行首、开括号不行尾；`maxLines` 超限加省略号。
命中由内核兜底——即使场景不写 `hitTest`，也能按槽命中。


```js
// 绘制 + 排版 + 登记 + 暴露槽身份，一次完成
const box = ctx.drawText('pin1Note', {
  x, y, w,              // 排版盒（w 决定换行）
  size, weight,         // px, 100..900
  lineHeight,           // 倍数，默认 1.35
  align,                // left | center | right
  maxLines,             // 超出省略
  style,                // 可选：'title' | 'body' | 'mono'（映射到 ctx.font 的族）
});
// → { box: {x,y,w,h}, lines: [{text, x, y, w, h}], truncated: boolean }
```

规则：

- 断行走 UAX #14（`css-line-break`），词边界用 `Intl.Segmenter('zh'|'en')`；
- 中文禁则：句号/逗号/右括号不出现在行首，左括号不出现在行尾；
- 每次调用把 `{slot, lines}` 记进元素表，供 `hitTest` 与 `audit` 使用；
- `maxChars` 超长时优先换行、再截断，截断必须可见（省略号）。

验收（`gate:text`）：中文长句换行不溢出、英文不破词、同一 t 两次渲染字节一致、
`hitTest` 命中文字时返回槽名、改槽后下一帧像素变化。

### 形状 / 路径（已有）

```js
ctx.shape({ x, y, w, h, radius, fill, stroke });   // 目前以场景自绘为主
```

建议在 P1 之后收敛成 `ctx.roundRect` / `ctx.path`，让命中与审计自动登记。

### 3D（已有，编辑面缺）

```js
// 现状：场景直接持有 three.js 场景图，命中与可编辑字段都没有
```

要补的是：`ctx.node(id, object3d)` 登记命中的屏幕包围盒；参数走 `params`。

### 图片（P2，已完成）

```js
await ctx.image('logo', { src: 'assets/logo.png', fit: 'contain', focus: [0.5, 0.5] });
// mount 阶段加载并解码（mount 是 async），render 阶段只 drawImage
```

规则：

- 资源在 `timeline.assets[名]` 声明，路径限制在包内（禁止绝对路径与 `..`）；
- 解码在 `mount` 完成，缺失则**抛错**，不留空帧；
- 命中登记为矩形；可编辑字段：`src` / `fit` / `focus`；
- 2× 时按 2× 重新采样，不能放大 1× 位图。

### 视频帧（P2，已完成）

```js
ctx.frame('clipA', t);   // 取该片段在 t 时刻的一帧并 drawImage
```

规则：

- **不在渲染时 seek `<video>`**（seek 是异步且不确定的），改为预处理：
  `motion_assets prep` 用 ffmpeg 按目标 fps 抽帧到 `assets/clips/<id>/%04d.png`；
- `mount` 预加载帧序列，`render` 按索引取图；
- 缺帧 → 抛错（不静默用上一帧）。

### 数据槽（P5，已完成）

```js
ctx.value('speed', { format: 'int', suffix: ' km/h' });  // 返回格式化字符串，并登记为可编辑数值
```

数据槽是「文字槽的数值版本」：可被面板改、可驱动图表与计数器，格式化（`int` / `decimal` /
`percent` / `compact` + 后缀）属于声明。**图表不是原语**——它由场景用 `ctx.value()` 取数、
自己画矩形/路径组成（`src/scenes/data-lab.mjs` 是例子）；只有需要刻度与比例尺时才引 `d3-scale`。

---

## 引入第三方库的纪律

1. **纯函数**：同样输入同样输出。带内部动画循环的（GSAP timeline、Pixi ticker）默认排除。
2. **随机可 seed**：`rough.js` 之类必须固定 seed，否则每帧纹理都在变。
3. **不接管时间**：库只负责"画这一帧"，不负责"下一帧什么时候来"。

已批准的候选：`css-line-break`（断行）、`intl-segmenter`（内置）、`rough.js`（纸感，需 seed）、
`d3-scale`（图表刻度）。不引入：Konva / Fabric / Pixi（会带来第二套场景图与时间模型）。
