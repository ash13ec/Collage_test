/**
 * Default palette; overridden when :root defines --fill-swatch-0 … (see styles.css).
 */
export const DEFAULT_FILL_SWATCHES = [
  '#f74c2f',
  '#4bcfff',
  '#ff91dd',
  '#ffc403',
] as const;

const MAX_SWATCHES = 16;

export function readFillSwatches(): string[] {
  if (typeof document === 'undefined') {
    return [...DEFAULT_FILL_SWATCHES];
  }
  const root = getComputedStyle(document.documentElement);
  const out: string[] = [];
  for (let i = 0; i < MAX_SWATCHES; i += 1) {
    const v = root.getPropertyValue(`--fill-swatch-${i}`).trim();
    if (v) out.push(v);
  }
  return out.length > 0 ? out : [...DEFAULT_FILL_SWATCHES];
}
