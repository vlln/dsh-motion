# examples · 四部片子的证据

这里**只剩证据**，没有可以再跑一遍的片子：每部只保留两张图。

| | 留下的图 |
|---|---|
| [`egypt/`](egypt/) | `out/ref/target.png` 是对照的那一帧；`out/look/` 里是并排图与我们的画面 |
| [`cold-start-1/`](cold-start-1/) | `out/look/sheet.jpg` 抽帧总表 |
| [`cold-start-2/`](cold-start-2/) | 同上 |
| [`cold-start-3/`](cold-start-3/) | 同上 |

## 为什么只留图

片子的场景、时间轴、音轨原本也在仓库里，占 34 MB 里的大部分。
它们能重新渲出成片，但**没人会为了看一眼而重渲**——要看的就是那几张图：
对照物是什么、我们做成了什么、差在哪。

省下的是仓库体积，不是信息：每部片子的结论、盲评分、失败原因都在
[`cards/`](../cards/) 和 [`docs/cold-start.md`](../docs/cold-start.md) 里，
比一整个 `motion/` 目录更好读。

## 想重做一部

照 [`howto/新风格.md`](../howto/新风格.md) 六步，从 `dsh-motion init` 开始；
样板在 `showcase/`，手艺在 `kit/`，判据在 `howto/审片.md`。
