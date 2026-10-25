# 重做：把「风格」从引擎里移出去

这条计划来自一次明确的判断错误：**每次看到新风格，就给引擎加一个只服务它的函数**。
油画缺笔触 → 加 `strokes`；8-bit 缺网格 → 想加 `grid`。这条路追不上，因为风格是无限的，
而且它教坏了 Agent：它学会「画 = 调用现成工具」，碰到没有的就报缺口。

一句话：

> 系统该能做的是一切；引擎该提供的**只有 Agent 写不出来的那部分**。

## 界线

| 层 | 装什么 | 谁写 |
|---|---|---|
| `src/` | 时间、画布、确定性、缓存、编码、音频、字体、素材、并排、技术门禁 | 只能宿主给 |
| `kit/` | 笔触、媒介通道、透视、像素栅格、人物骨架、成片质感 | 样例；**可整个删掉，引擎不认识它** |
| `cards/` | 管线 + 色板 + 签名特征 + 坑 + 短板 + 状态 | 一张卡 = 一个风格 |
| `protocol/` | 新风格六步 + 打分表 + 六种做坏方式 + 镜头表模板 | 不变 |

`ctx` 只暴露 `canvas / ctx / w / h / t / lt / still() / seed / font() / asset() / timeline`。
不得存在 `ctx.paint`、`ctx.medium`、`look.finish`。

## 阶段

- [x] **P0 删除无争议的错误**：`experiments/`、`docs/primitives.md`、`docs/exemplars/`、
      只测画法的六个门禁（paint / medium / plate / look / exemplars / templates）及其 check 接线。
- [x] **P1 引擎手术**：删 `src/starters.mjs`(1432) / `src/medium.mjs`(552) / `src/look.mjs`(207) /
      `src/paint.mjs`(362)；拆掉 kernel 的 `ctx.paint` / `ctx.medium` / `look.finish`；
      preview 的空画廊改成「怎么开始」。门禁 477 → 321。
- [x] **P2 删模板**：`templates/` 十二个全部删除；`init` 只给骨架 + `kit/` + 空镜头表。
      顺序：① `src/film.mjs` 去掉 `createFilmFromTemplate` 与 `TEMPLATE(S)`；② `src/project.mjs`
      去掉 `TEMPLATES` 与 `createProject`；③ `src/params-http.mjs` 去掉 `/api/template`；
      ④ `src/preview.mjs` 去掉 `from=template` 的封面逻辑；⑤ `bin/dsh-motion.mjs` 的 `init` 改写；
      ⑥ `src/scenes/` 里剩下的 five 个 demo 场景搬到 `fixtures/`（引擎不再带片子）；
      ⑦ 用 `fixtures/` 的片跑门禁，根 `timeline.json` 只剩一个「引擎自检片」。
      已完成 ①–⑤、⑦：两套模板机制全删；`init` 只给空 timeline + 镜头表 + `kit/`；
      需要画面的三个门禁改用共享 fixture（`scripts/lib/fixture-film.mjs`）。
      ⑥ 也已完成：六个 demo 场景搬到项目自己的 `scenes/`，`src/scenes/` 只剩 `index.mjs`（一个动态 import 循环）。
- [x] **P3 建 `kit/`**：六个样例模块（brush / medium / pixel / perspective / figure / grade），
      引擎双向不 import，门禁 `gate:kit` 看着这条线。
- [x] **P4 建 `protocol/`**：六步、打分表（80 门槛 / 两轮 / 两否决）、六种做坏方式、镜头表模板。
- [x] **P5 建 `cards/`**：五段结构 + 状态三档。
- [x] **P6 重写 `skills/dsh-motion/SKILL.md`**：分档 / 路由 / 窄桥 / 协议 / 门禁 / 回流。
- [ ] **P7 第一张真卡**：埃及墓室壁画，走完六步，并排 + 打分 ≥80。
- [ ] **P8 冷启动重测**：≥3 次从 `init` 开始，必须交完整 MP4 + 音轨；`check` 必须能报出缺音轨／缺片。
- [ ] **P9 门禁重建**：留下的每一条只测载具或契约。

P4/P5 已完成：`protocol/` 四份（新风格六步 / 六种做坏方式 / 交付三道 / 打分表）＋ `cards/`
（README 五段结构 + 状态三档 + INDEX）。同时把交付门禁变成真的能跑的东西：
`scripts/film-gate.mjs` 量画面/声音/长度/空画面/幻灯片/蓝紫，`check --deliver` 调它，
`gate:deliver` 用合成片验证它抓得住「没音轨」和「幻灯片」。

P6 已完成：734 → 537 行。新增分档（开阔档／轨道档）、按用户话术的路由表、窄桥、
「画法住在哪」（kit / scenes / src 三级）、「方向不对时，先量再改」；
删掉「底图 + 笔触层」「纯几何」「一张真画当世界」「从模板开始」四条把某年代当默认的路线，
以及 `ctx.paint` 六个动词。交付那一节换成三道（check --deliver / 并排 / 独立审片），
look 的三个数降级成线索。

## 判断标准

每阶段收尾：`npm run check` 全绿，工作树干净。

这一轮之后，如果我又一次想说「缺个 XX 工具」，那就说明线破了。
