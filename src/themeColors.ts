import * as THREE from 'three';

/** Read a CSS custom property (color) in :root, or fall back. */
export function readCssColor(varName: string, fallback: string) {
  if (typeof document === 'undefined') return new THREE.Color(fallback);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return new THREE.Color(fallback);
  const c = new THREE.Color();
  try {
    c.setStyle(raw);
  } catch {
    c.set(fallback);
  }
  return c;
}
