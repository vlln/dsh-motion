// Line breaking for canvas text. The browser shapes glyphs for us (canvas uses
// the same Skia/HarfBuzz path as DOM), but it will not lay out a paragraph:
// fillText draws one line at whatever x/y you give it. This module supplies the
// missing half — where the lines break.
//
// Scope: Chinese and English, which is what this project makes. It is not a full
// UAX #14 implementation; the subset is documented below and covered by tests.
//
//   - CJK: a break opportunity exists between any two ideographs (words do not
//     matter), minus the punctuation rules (禁则): closing marks may not start a
//     line, opening marks may not end one.
//   - Latin: breaks at spaces only. Words are never split, hyphens are not
//     break points (a deliberate simplification).

const CJK = /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/;

// Punctuation that may not begin a line (closing marks and trailing punctuation).
const NO_START = '）】》」』”’，。、；：？！…—·%‰、︒︔︕︖';
// Punctuation that may not end a line (opening marks).
const NO_END = '（【《「『“‘([{';

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\u00a0';

/**
 * Split into the smallest units a line may be broken between. Adjacent units
 * that the punctuation rules glue together are merged here, so the wrapper can
 * stay a simple greedy fill.
 */
export function segments(text) {
  const units = [];
  let word = '';
  let space = false;

  const flushWord = () => {
    if (!word) return;
    units.push({ text: (space ? ' ' : '') + word, kind: 'word' });
    word = '';
    space = false;
  };

  for (const ch of String(text ?? '')) {
    if (isSpace(ch)) {
      flushWord();
      space = true;
      continue;
    }
    if (CJK.test(ch)) {
      flushWord();
      units.push({ text: (space ? ' ' : '') + ch, kind: 'cjk' });
      space = false;
      continue;
    }
    word += ch;
  }
  flushWord();

  // 禁则: a unit that may not start a line joins the previous one; a unit whose
  // last char may not end a line absorbs the next one.
  const merged = [];
  for (const unit of units) {
    const prev = merged[merged.length - 1];
    const cannotStart = NO_START.includes(unit.text[0]);
    const cannotEnd = prev && NO_END.includes(prev.text[prev.text.length - 1]);
    if (prev && (cannotStart || cannotEnd)) prev.text += unit.text;
    else merged.push({ ...unit });
  }
  return merged;
}

/**
 * Greedy fill. `measure` is supplied by the caller (canvas measureText), so this
 * stays a pure function and can be unit-tested without a browser.
 */
export function layoutText({ text, measure, maxWidth, maxLines = Infinity, ellipsis = '…' }) {
  const units = segments(text);
  const lines = [];
  let current = '';

  for (const unit of units) {
    if (!current) {
      current = unit.text.trimStart();
      continue;
    }
    if (measure(current + unit.text) <= maxWidth) {
      current += unit.text;
      continue;
    }
    lines.push(current);
    current = unit.text.trimStart();
  }
  if (current) lines.push(current);

  let truncated = false;
  let shown = lines;
  if (lines.length > maxLines) {
    shown = lines.slice(0, maxLines);
    truncated = true;
    let last = shown[shown.length - 1];
    while (last.length > 1 && measure(last + ellipsis) > maxWidth) last = last.slice(0, -1);
    shown[shown.length - 1] = last + ellipsis;
  }

  return { lines: shown, truncated };
}
