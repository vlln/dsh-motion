# 内核契约

> 场景代码与可编辑数据彻底分离：**改字改色不碰代码，改构图不碰数据**。
> 这份文档是场景作者（人或 agent）与内核之间的接口；实现见 `src/kernel.mjs`，
> 校验实现见 `src/validate.mjs`。原语清单见 [primitives.md](primitives.md)，
> 栈选择与理由见 [decisions.md](decisions.md)。

---

## 0. 一张图

```
timeline.json ──┬─ scenes[]   ──► 场景模块（代码）
                ├─ texts{}    ──► 文本槽（数据，可编辑）
                ├─ params{}   ──► 数值旋钮（数据，可编辑）
                └─ palettes{} ──► 调色板（数据，可编辑）
                                  │
                        ┌─────────┴─────────┐
                        │   Kernel（宿主）   │
                        │ resolve → render   │
                        └─────────┬─────────┘
                                  │
              renderAt(t) → page.screenshot(jpeg) → ffmpeg
```

**铁律**：场景代码里不出现用户文案、不出现 `#rrggbb`。两者只能来自数据。

---

## 1. 场景模块契约

```ts
export type SceneKind = 'canvas2d' | 'webgl';

export interface SceneModule {
  id: string;                                   // 必须与 timeline.scenes[].id 一致
  kind?: SceneKind;                             // 缺省 canvas2d
  slots?: Record<string, SlotSpec>;             // 文本槽声明
  textUsage?: Record<string, number>;           // 每帧读取次数，用于 "changes N places"
  params?: Record<string, ParamSpec>;           // 数值旋钮声明
  mount(ctx: MountContext): void | Promise<void>;  // 只调用一次；异步加载都放这里
  render(t: number): void;                      // 逐帧；t 为场景内本地时间（秒）
  overlay?(g: CanvasRenderingContext2D, ctx: MountContext, t: number): void;  // 合成后的 2D 层
  hitTest?(x: number, y: number, t: number): Hit | null;  // 只读命中，坐标见 §5.4
}
```

### 1.1 MountContext

```ts
export interface MountContext {
  readonly canvas: HTMLCanvasElement;   // 该场景独占的画布
  readonly kind: SceneKind;
  readonly width: number;               // CSS px
  readonly height: number;
  readonly dpr: number;
  readonly seed: number;                // timeline.seed，缺省 746337560
  readonly sceneStart: number;          // 该场景在全局时间轴上的起点（秒）
  readonly beats: number[];             // out/beats.json 的拍点（全局时间）
  readonly bpm: number | null;
  readonly capture: boolean;            // true = 导出模式

  text(slot: string): string;                      // §2
  param(key: string): number;                      // §3
  color(token: string, elementId?: string): string; // §4
  colorNumber(token: string, elementId?: string): number;
  font(family: 'serif' | 'sans' | 'mono' | string): string;
  rng(key: string): () => number;                  // §1.3
  asset(name: string): string;                     // assets/ 下的 URL
  preload(names?: string[]): Promise<void>;        // 内核在 mount 前调用，装载 scene.assets
  image(name: string, opts?: MediaOpts): Box;      // §2.2
  frame(name: string, t: number, opts?: MediaOpts): Box;
}
```

### 1.2 确定性规则（硬性）

`render(t)` 必须是 `(t, 只读数据) → 像素` 的纯函数：

| 禁止 | 原因 | 替代 |
|---|---|---|
| `Math.random()` | 每帧不同 | `ctx.rng(key)` |
| `Date.now()` / `performance.now()` | 捕获时不是真实时间 | 只用 `t` |
| `requestAnimationFrame` | 捕获期间没人驱动 | 宿主调 `render(t)` |
| 渲染阶段发网络请求 | 不可复现、可能超时 | 放到 `mount` |
| 跨帧可变状态（闭包计数器） | 丢帧即错位 | 预计算到 `mount` |

**颜色空间**：每个画布必须在创建时固定 sRGB——`getContext('2d', { colorSpace: 'srgb' })`，
WebGL 同理。否则 macOS 的 display-P3 会让读回值偏移（本项目踩过）。

**验收**：同一 `t` 连调两次，截图像素必须一致（`gates.mjs` 的确定性组）。

### 1.3 随机

```js
const rand = ctx.rng('particles');   // 按 seed + 场景 id + key 派生，互不干扰
rand();                              // [0, 1)
```

---

## 2. 文本槽

```ts
interface SlotSpec {
  default: string;                                  // 兜底文案，也是初始值
  maxChars?: number;                                // 超长时 UI 提示，不硬截
  role?: 'title' | 'subtitle' | 'label' | 'caption' | 'data';
}
```

读取解析顺序：

```
timeline.texts[sceneId][slot] ?? slots[slot].default ?? ''（并记一条 warning）
```

写入（两个入口，同一条路径）：

- 面板 / agent：`motion_texts` → `scripts/texts.mjs` → 校验 → 快照 → 写 `timeline.json`；
- 内核：`kernel.setText(sceneId, slot, value)`。

写入后**下一帧立即生效**，不需要重新构建场景。

`textUsage` 是声明式的"这个词改一次会动几处"，运行时统计实际读取次数并比对，
不一致时进 `kernel.warnings`。

### 2.2 媒体（P2）

```jsonc
// timeline.json
"assets": {
  "plate": { "kind": "image", "src": "assets/plate.png" },
  "clipA": { "kind": "clip",  "src": "assets/clip.mp4", "fps": 24 }
}
```

场景用 `export const assets = ['plate', 'clipA']` 声明；内核在 `mount` 之前把它们装载好，
`render` 里只做同步绘制：

```js
ctx.image('plate', { x, y, w, h, fit: 'cover', focus: [0.5, 0.5] });
ctx.frame('clipA', t, { x, y, w, h, fit: 'cover' });
```

- 片段不是逐帧文件，而是**一张雪碧图 + 清单**（`out/media/<name>.jpg|json`），
  `npm run assets` 生成。一个位图就能装下整段，`drawImage` 用源矩形取帧，捕获期没有文件 IO。
- 帧索引用 `floor(t × fps)` 并夹在 `[0, count-1]`，所以同一 t 永远是同一帧。
- 缺素材 → `mount` 抛错（`HTTP 404` / `not prepared`），**不留空帧**。
- 素材路径必须落在包内（`scripts/assets.mjs` 拒绝 `../` 与绝对路径）。

### 2.1 `ctx.drawText`（P1，已完成）

文字绘制、换行、登记元素、暴露槽身份合并成一个原语，见 [primitives.md](primitives.md#文字p1)。
在此之前，场景用 `ctx.text(slot)` + `fillText`，换行由场景自己负责（**已知缺陷：中文不换行**）。

---

## 3. 参数

```ts
interface ParamSpec {
  default: number;
  min: number;
  max: number;
  step?: number;     // 面板滑杆步长，默认 0.01
  label?: string;    // 面板显示名
}
```

- 值存 `timeline.params[sceneId][key]`，缺失即用 `spec.default`；
- **越界拒绝，不静默 clamp**——静默夹取会让面板对文件撒谎；
- 写入路径：`POST /api/params` → 校验 → 快照 → 写盘；工具 `motion_params` 走同一层
  （`src/project.mjs`）。

---

## 4. 调色板

```jsonc
{
  "palettes": {
    "main": { "bg": "#0b1426", "fg": "#f2f2f0", "accent": "#e0b040",
              "muted": "#8b98ad", "grid": "#243450", "panel": "#101c33" },
    "cold": { "accent": "#d94a3d" }
  },
  "overrides": { "cold-war/pin1": { "accent": "#ff2b2b" } }
}
```

解析顺序（后者覆盖前者）：

```
overrides[sceneId/elementId][token]
  → overrides[sceneId][token]
  → palettes[scene.palette][token]
  → palettes.main[token]
  → 抛错（不静默回退黑）
```

`main` 必须包含 `bg / fg / accent / muted / grid / panel` 六个 token（`validate.mjs` 校验）。

---

## 5. 宿主 API

```ts
interface Kernel {
  mountAll(canvas: HTMLCanvasElement, size?: { width?: number; height?: number; dpr?: number }): Promise<void>;
  renderAt(t: number): void;                 // 全局时间（秒）
  describe(): { scenes: SceneDescriptor[] }; // 含 slots / params / 当前值
  reload(next: Timeline): void;              // 恢复快照后原地替换，不重新 mount
  setText(sceneId: string, slot: string, value: string): string;
  setParam(sceneId: string, key: string, value: number): number;
  pick(x: number, y: number, t: number): Hit | null;
  audit(t: number): TextBox[];               // 渲染一帧并返回文字框（版面审计用）
}
```

页面暴露 `window.__MOTION__`（捕获页）与 `window.__PREVIEW__`（面板），
捕获脚本只调用 `renderAt` 与 `page.screenshot`。

### 5.1 挂载与合成

- 每个场景一块 canvas（canvas 只能持一种 context），内核把当前场景的 canvas
  `drawImage` 到显示画布；
- `overlay` 在合成之后画在显示画布上，用于 3D 场景配排版；
- 场景切换按 `timeline.scenes[].start` 判定，边界取左闭右开。

### 5.2 时间轴校验（mount 前必过）

- `scenes` 必须从 0 开始、首尾相接、最后一场结束于 `duration`；
- `palette` 名字必须存在；`speed` 只允许 0.5 / 1 / 2；
- `texts` / `params` / `overrides` 的 key 必须是已声明场景；
- 槽名必须由场景声明，`maxChars` 超长拒绝；参数越界拒绝；
- 任一失败 → `assertTimeline` 抛错，不渲染黑屏。

### 5.3 捕获

```
renderAt(t) → page.screenshot({ type: 'jpeg', quality: 95 }) → ffmpeg -f image2pipe → libx264 crf 18
```

音频在视频完成后单独 mux（`loudnorm=I=-14:TP=-1`），视频流直接 copy。
帧率由本次运行决定（`--fps`），时长由 `timeline.duration` 决定。

### 5.4 命中坐标

`pick(x, y, t)` 的坐标是 **CSS px / 场景坐标**（0..width, 0..height），不是设备像素；
`hitTest` 收到的 `t` 是**场景内本地时间**，由内核换算。

---

## 6. 错误与降级

| 情况 | 行为 |
|---|---|
| 场景 mount 抛错 | 构建失败，报错带场景 id |
| 槽缺失 | 用 default；无 default 则空串 + warning |
| 颜色 token 缺失 | **抛错** |
| 参数越界 | 拒绝写入并说明范围 |
| 同一 t 两次渲染不一致 | 门禁失败 |

---

## 7. 最小场景

```js
export const id = 'hello';
export const kind = 'canvas2d';
export const slots = { title: { default: 'Hello', role: 'title' } };
export const textUsage = { title: 1 };

let ctx;
export function mount(context) { ctx = context; }

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);
  g.fillStyle = ctx.color('fg');
  g.font = `600 ${Math.round(ctx.height * 0.08)}px ${ctx.font('sans')}`;
  g.fillText(ctx.text('title'), ctx.width * 0.1, ctx.height * 0.5);
}

export function hitTest(x, y) {
  return x > ctx.width * 0.1 && y > ctx.height * 0.4
    ? { id: 'title', kind: 'text', label: 'Hello' }
    : null;
}
```

在 `timeline.json` 的 `scenes` 里加一条 `{ id: 'hello', start, length, palette: 'main', speed: 1 }`，
并在 `src/scenes/index.mjs` 注册即可。
