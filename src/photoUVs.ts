import * as THREE from 'three';

/**
 * Object-fit: cover on the mesh AABB: one uniform scale, image centered, excess cropped.
 * Pairs with configureTexture (flipY=false, rotation=0) so the bitmap is not double-flipped.
 */
export function applyObjectFitCoverUVs(
  geometry: THREE.BufferGeometry,
  imageWidth: number,
  imageHeight: number,
) {
  if (imageWidth <= 0 || imageHeight <= 0) return;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | null;
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | null;
  if (!pos) return;
  if (!uv || uv.count !== pos.count) {
    const next = new Float32Array(pos.count * 2);
    uv = new THREE.BufferAttribute(next, 2);
    geometry.setAttribute('uv', uv);
  }
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  if (!b) return;
  const W = b.max.x - b.min.x;
  const H = b.max.y - b.min.y;
  if (W < 1e-8 || H < 1e-8) return;

  const s = Math.max(W / imageWidth, H / imageHeight);
  if (!Number.isFinite(s) || s <= 0) return;

  const uOff = 0.5 * (W - s * imageWidth);
  const vOff = 0.5 * (H - s * imageHeight);
  const wTex = s * imageWidth;
  const hTex = s * imageHeight;
  if (wTex < 1e-8 || hTex < 1e-8) return;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let uu = (x - b.min.x - uOff) / wTex;
    let vv = (y - b.min.y - vOff) / hTex;
    uu = Math.min(1, Math.max(0, uu));
    vv = Math.min(1, Math.max(0, vv));
    uv.setXY(i, uu, 1.0 - vv);
  }
  uv.needsUpdate = true;
}
