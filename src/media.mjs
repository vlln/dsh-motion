// Geometry for drawing images and clip frames. Pure functions: the kernel owns
// loading and painting, this file only answers "which pixels go where".

/** Where a source image lands inside a destination box. */
export function fitRect({ srcW, srcH, boxX, boxY, boxW, boxH, fit = 'cover', focus = [0.5, 0.5] }) {
  if (!(srcW > 0 && srcH > 0 && boxW > 0 && boxH > 0)) {
    throw new Error(`fitRect needs positive sizes (src ${srcW}x${srcH}, box ${boxW}x${boxH})`);
  }
  const [fx, fy] = focus;
  if (fit === 'fill' || fit === 'stretch') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: boxX, dy: boxY, dw: boxW, dh: boxH };
  }
  if (fit === 'contain') {
    const scale = Math.min(boxW / srcW, boxH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    return {
      sx: 0,
      sy: 0,
      sw: srcW,
      sh: srcH,
      dx: boxX + (boxW - dw) / 2,
      dy: boxY + (boxH - dh) / 2,
      dw,
      dh,
    };
  }
  if (fit === 'cover') {
    const scale = Math.max(boxW / srcW, boxH / srcH);
    const sw = Math.min(srcW, boxW / scale);
    const sh = Math.min(srcH, boxH / scale);
    return {
      sx: (srcW - sw) * clamp01(fx),
      sy: (srcH - sh) * clamp01(fy),
      sw,
      sh,
      dx: boxX,
      dy: boxY,
      dw: boxW,
      dh: boxH,
    };
  }
  if (fit === 'none') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: boxX, dy: boxY, dw: srcW, dh: srcH };
  }
  throw new Error(`unknown fit "${fit}" (cover | contain | fill | none)`);
}

/** Which cell of the sprite sheet holds frame `index`. */
export function frameRect(index, { cols, rows, frameW, frameH, count }) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`frame ${index} out of range 0..${count - 1}`);
  }
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (row >= rows) throw new Error(`frame ${index} falls outside a ${cols}x${rows} sheet`);
  return { sx: col * frameW, sy: row * frameH, sw: frameW, sh: frameH };
}

/** Frame index for a time: floor, so t=0 and t=(1/fps)-ε share frame 0. */
export function frameAt(t, { fps, count }) {
  if (!(fps > 0) || !(count > 0)) throw new Error('frameAt needs fps and count');
  const index = Math.floor(Math.max(0, t) * fps);
  return Math.min(count - 1, index);
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));
