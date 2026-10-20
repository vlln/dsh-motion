// A small timeline-style history scene, shared by both demo scenes.
// Everything user-visible comes from ctx.text() / ctx.color(); nothing is hardcoded.

const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const v = Math.min(1, Math.max(0, x));
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Knobs the panel can tune. Values are fractions of W/H or seconds, so a knob
// means the same thing at any canvas size. Ranges are wide enough to change the
// composition and narrow enough that the result never stops being this scene.
export const PARAMS = {
  axisY: { default: 0.68, min: 0.45, max: 0.82, step: 0.005, label: '轴线位置' },
  lift: { default: 0.14, min: 0.06, max: 0.26, step: 0.005, label: '卡片离轴' },
  laneGap: { default: 0.135, min: 0.08, max: 0.2, step: 0.005, label: '双行间距' },
  cardW: { default: 0.3, min: 0.18, max: 0.4, step: 0.005, label: '卡片宽度' },
  cardH: { default: 0.118, min: 0.09, max: 0.16, step: 0.002, label: '卡片高度' },
  enter: { default: 0.32, min: 0.1, max: 0.9, step: 0.01, label: '入场时长' },
};

export function makeHistoryScene(config) {
  const { id, slots, textUsage, ticks, pins, palette: _palette } = config;
  let ctx = null;

  function mount(context) {
    ctx = context;
  }

  const param = (key) => ctx.param(key);
  const cardTop = (axisY, H, lane) => axisY - H * (param('lift') + lane * param('laneGap'));

  function render(t) {
    const g = ctx.canvas.getContext('2d');
    const W = ctx.width;
    const H = ctx.height;

    const bg = ctx.color('bg');
    const fg = ctx.color('fg');
    const accent = ctx.color('accent');
    const muted = ctx.color('muted');
    const grid = ctx.color('grid');

    // background
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // faint vertical grid, drifting slowly with t (deterministic)
    g.strokeStyle = grid;
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    const step = W / 24;
    const drift = (t * 6) % step;
    for (let x = -step + drift; x < W + step; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    g.globalAlpha = 1;

    // frame 0 must be a real image (it is the thumbnail), so the header is
    // visible immediately; only the axis and pins animate in.
    const capA = 1;
    g.globalAlpha = capA;
    g.fillStyle = muted;
    g.font = `600 ${Math.round(H * 0.018)}px ${ctx.font('sans')}`;
    g.fillText(ctx.text('era').toUpperCase(), W * 0.08, H * 0.16);
    g.globalAlpha = 1;

    // title
    const titleA = 1; // frame 0 must be a real image
    g.save();
    g.globalAlpha = titleA;
    g.translate(0, (1 - titleA) * H * 0.06);
    g.fillStyle = fg;
    g.font = `500 ${Math.round(H * 0.072)}px ${ctx.font('serif')}`;
    g.fillText(ctx.text('title'), W * 0.08, H * 0.26);
    g.restore();

    // subtitle
    const subA = easeOut((t - 0.25) / 0.45);
    g.globalAlpha = subA;
    g.fillStyle = muted;
    g.font = `${Math.round(H * 0.026)}px ${ctx.font('sans')}`;
    g.fillText(ctx.text('subtitle'), W * 0.08, H * 0.325);
    g.globalAlpha = 1;

    // timeline axis
    const { axisY, x0, x1, cardW, cardH, placed } = layoutPins(W, H);
    const axisA = easeOut((t - 0.9) / 0.9);
    g.save();
    g.globalAlpha = axisA;
    g.strokeStyle = grid;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, axisY);
    g.lineTo(x1, axisY);
    g.stroke();

    // ticks
    g.fillStyle = muted;
    g.font = `${Math.round(H * 0.016)}px ${ctx.font('mono')}`;
    for (const tick of ticks) {
      const x = x0 + (x1 - x0) * tick.at;
      g.strokeStyle = grid;
      g.beginPath();
      g.moveTo(x, axisY - 6);
      g.lineTo(x, axisY + 6);
      g.stroke();
      g.textAlign = 'center';
      g.fillText(tick.label, x, axisY + H * 0.032);
    }
    g.textAlign = 'left';
    g.restore();

    // pins — two lanes, collision-free cards
    const pinA = easeOut((t - 1.2) / 0.8);

    g.globalAlpha = pinA;

    const stemFor = (pin) => cardTop(axisY, H, pin.lane) + cardH;

    // pass 1: stems + dots (behind every card)
    for (const pin of placed) {
      const appear = easeOutBack((t - pin.tIn) / param('enter'));
      if (appear <= 0) continue;
      const pinColor = ctx.color('accent', pin.elementId);
      g.save();
      g.globalAlpha = appear * axisA;
      g.strokeStyle = pinColor;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(pin.px, axisY);
      g.lineTo(pin.px, stemFor(pin));
      g.stroke();
      g.fillStyle = pinColor;
      g.beginPath();
      g.arc(pin.px, axisY, 7, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // pass 2: cards on top of every stem
    for (const pin of placed) {
      const appear = easeOutBack((t - pin.tIn) / param('enter'));
      if (appear <= 0) continue;

      const pinColor = ctx.color('accent', pin.elementId);
      const cardY = cardTop(axisY, H, pin.lane);

      g.save();
      g.globalAlpha = appear * axisA;
      g.translate(0, (1 - appear) * H * 0.07);

      g.fillStyle = ctx.color('panel');
      g.strokeStyle = pinColor;
      g.lineWidth = 1.5;
      roundRect(g, pin.cx, cardY, cardW, cardH, 10);
      g.fill();
      g.stroke();

      g.fillStyle = pinColor;
      g.font = `600 ${Math.round(H * 0.017)}px ${ctx.font('mono')}`;
      g.fillText(pin.eraText, pin.cx + 18, cardY + H * 0.032);

      g.fillStyle = fg;
      g.font = `600 ${Math.round(H * 0.0205)}px ${ctx.font('sans')}`;
      wrapText(g, pin.noteText, pin.cx + 18, cardY + H * 0.070, cardW - 36, H * 0.027, 2);

      g.restore();
    }
    g.globalAlpha = 1;

    // beat pulse: the whole composition breathes with the track
    const beatGrid = ctx.beats ?? [];
    let pulse = 0;
    if (beatGrid.length) {
      const globalT = t + (ctx.sceneStart ?? 0);
      let nearest = Infinity;
      for (const bt of beatGrid) nearest = Math.min(nearest, Math.abs(bt - globalT));
      pulse = Math.exp(-Math.pow(nearest / 0.10, 2));
    }

    // accent rule at the very bottom (grows with t, pulses on the beat)
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    g.fillRect(0, H - (6 + pulse * 6), W * clamp01(t / 15), 6 + pulse * 6);
    g.globalAlpha = 1;

    void _palette;
  }

  function layoutPins(W, H) {
    const axisY = H * param('axisY');
    const x0 = W * 0.08;
    const x1 = W * 0.92;
    const cardW = W * param('cardW');
    const cardH = H * param('cardH');
    const gap = 12;
    const lanes = [[], []];
    const placed = [];

    for (const pin of [...pins].sort((a, b) => a.at - b.at)) {
      const px = x0 + (x1 - x0) * pin.at;
      const cx = Math.min(Math.max(px - cardW / 2, x0), x1 - cardW);
      let lane = 0;
      for (let l = 0; l < lanes.length; l++) {
        const clash = lanes[l].some(([a, b]) => cx < b + gap && cx + cardW > a - gap);
        if (!clash) { lane = l; break; }
      }
      lanes[lane].push([cx, cx + cardW]);
      placed.push({ ...pin, px, cx, lane });
    }
    return { axisY, x0, x1, cardW, cardH, placed };
  }

  // Read-only hit test for the preview inspector: geometry matches what is drawn.
  function hitTest(x, y, t) {
    const { axisY, cardW, cardH, placed } = layoutPins(ctx.width, ctx.height);
    for (const pin of placed) {
      if (t < pin.tIn) continue;
      const cardY = cardTop(axisY, ctx.height, pin.lane);
      if (x >= pin.cx && x <= pin.cx + cardW && y >= cardY && y <= cardY + cardH) {
        return {
          id: pin.elementId ? `pin-${pin.elementId}` : `pin-${pin.eraText}`,
          kind: 'pin',
          x: Math.round(pin.cx),
          y: Math.round(cardY),
          w: Math.round(cardW),
          h: Math.round(cardH),
          label: pin.eraText,
          at: Number(t.toFixed(2)),
        };
      }
    }
    return null;
  }

  return { id, kind: 'canvas2d', slots, textUsage, params: PARAMS, mount, render, hitTest };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(g, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(' ');
  let line = '';
  let row = 0;
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 1 && g.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    shown[maxLines - 1] = `${last}…`;
  }
  for (const [i, l] of shown.entries()) {
    g.fillText(l, x, y + i * lineHeight);
    void row;
  }
}
