/** Glyph x-height runs from y 10 to the baseline at 20; d rises to 4 and g drops to 26. */
const BASELINE = 20;
const X_HEIGHT = 10;

/** Single-stroke lowercase letters, like technical drawing lettering. */
const GLYPHS = {
  m: { width: 12, d: 'M0 20 V10 M0 13 a3 3 0 0 1 6 0 V20 M6 13 a3 3 0 0 1 6 0 V20' },
  o: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0' },
  d: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M10 4 V20' },
  s: {
    width: 8,
    d: 'M8 11.5 C7 10.4 5.6 10 4 10 C2 10 0.5 11 0.5 12.6 C0.5 16 8 14 8 17.4 C8 19 6.3 20 4 20 C2.3 20 1 19.5 0 18.3',
  },
  w: { width: 14, d: 'M0 10 L3.5 20 L7 12 L10.5 20 L14 10' },
  i: { width: 2, d: 'M1 10 V20 M1 6.4 V6.5' },
  n: { width: 8, d: 'M0 20 V10 M0 14 a4 4 0 0 1 8 0 V20' },
  g: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M10 10 V21 C10 24.5 7.5 26 5 26 C3 26 1.5 25.2 0.6 24' },
} as const;

const WORD = 'moodswing';
const GAP = 3.5;

const placed = [...WORD].reduce<{ x: number; glyph: (typeof GLYPHS)[keyof typeof GLYPHS] }[]>((letters, letter) => {
  const previous = letters.at(-1);
  const x = previous ? previous.x + previous.glyph.width + GAP : 0;

  return [...letters, { x, glyph: GLYPHS[letter as keyof typeof GLYPHS] }];
}, []);
const width = placed.at(-1)!.x + placed.at(-1)!.glyph.width;

/** The moodswing wordmark, lettered in single strokes between dashed guide lines. */
export function Logo() {
  return (
    <svg className="logo" viewBox={`-6 2 ${width + 12} 27`} role="img" aria-label={WORD}>
      <path
        className="logo__guide"
        d={`M-6 ${X_HEIGHT} H${width + 6} M-6 ${BASELINE} H${width + 6} M-3 ${X_HEIGHT - 2} V${BASELINE + 2} M${width + 3} ${X_HEIGHT - 2} V${BASELINE + 2}`}
      />
      <g className="logo__letters">
        {placed.map(({ x, glyph }, index) => (
          <path key={index} d={glyph.d} transform={`translate(${x} 0)`} />
        ))}
      </g>
    </svg>
  );
}
