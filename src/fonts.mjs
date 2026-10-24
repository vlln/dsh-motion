// The film's typefaces. Four named roles ship as system stacks so a film never
// needs a download; a film may add or replace any role of its own
// (`timeline.fonts.<role> = { family, src? }`) — the set is open, because a
// closed set cannot serve every film. Scenes still name a role, never a path.
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

/** Resolve a role to a CSS stack. Unknown roles fall back to the body stack. */
export function fontStack(key = 'sans') {
  const font = FONTS[key];
  return font ? font.stack : FONTS.sans.stack;
}

export function listFonts() {
  return FONT_KEYS.map((key) => ({ key, ...FONTS[key] }));
}

/** A film may override a role: { fonts: { display: { family, src } } }. */
export function resolveFont(timeline, role = 'sans') {
  const override = timeline?.fonts?.[role];
  if (override && typeof override === 'object' && override.family) {
    return `${override.family}, ${fontStack(role)}`;
  }
  return fontStack(role);
}

/** Every role the film can name: the four built-ins plus whatever it declared. */
export function roleNames(timeline) {
  return [...new Set([...FONT_KEYS, ...Object.keys(timeline?.fonts ?? {})])];
}

export function filmFontOverrides(timeline) {
  return Object.entries(timeline?.fonts ?? {}).filter(([, value]) => value && typeof value === 'object');
}

/**
 * Load the film's own font files before the first frame. Browser only: the
 * files travel with the film, so a render on another machine looks the same.
 */
export async function loadFilmFonts(timeline, base = './') {
  if (typeof document === 'undefined' || !document.fonts) return [];
  const loaded = [];
  for (const [role, spec] of filmFontOverrides(timeline)) {
    if (!spec.src) continue;
    const family = spec.family || role;
    const url = new URL(spec.src, new URL(base, location.href)).href;
    const face = new FontFace(family, `url(${url})`, { weight: String(spec.weight ?? '400 700'), style: 'normal' });
    await face.load();
    document.fonts.add(face);
    loaded.push({ role, family, src: spec.src });
  }
  return loaded;
}
