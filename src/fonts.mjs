// The film's typefaces. Four roles, all system stacks: nothing to download, no
// network at render time, no "agent picked a font that only exists on its
// machine". Scenes name a role, never a font file.
export const FONTS = {
  sans: {
    stack: 'Inter, "Helvetica Neue", Arial, sans-serif',
    note: '正文、界面、绝大多数标题的默认',
  },
  display: {
    stack: '"Helvetica Neue", "Arial Black", Arial, sans-serif',
    note: '大字标题；字距收紧到 -0.03em 左右',
  },
  serif: {
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    note: '档案、图鉴、引文',
  },
  mono: {
    stack: 'ui-monospace, "SF Mono", Menlo, monospace',
    note: '标签、数字、代码、时间码',
  },
};

export const FONT_KEYS = Object.keys(FONTS);

/** Resolve a role to a CSS stack, refusing anything that is not registered. */
export function fontStack(key = 'sans') {
  const font = FONTS[key];
  if (!font) throw new Error(`unknown font "${key}"; use one of: ${FONT_KEYS.join(', ')}`);
  return font.stack;
}

export function listFonts() {
  return FONT_KEYS.map((key) => ({ key, ...FONTS[key] }));
}
