import * as THREE from 'three';
import { applyObjectFitCoverUVs } from './photoUVs';

const textureCache = new Map<string, THREE.Texture>();

/**
 * No texture rotation; flipY false pairs with u,v in applyObjectFitCoverUVs.
 */
export function configureTexture(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.center.set(0.5, 0.5);
  t.rotation = 0;
  t.offset.set(0, 0);
  t.repeat.set(1, 1);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.premultiplyAlpha = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
}

function applyUvs(geometry: THREE.BufferGeometry, img: HTMLImageElement) {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    applyObjectFitCoverUVs(geometry, img.naturalWidth, img.naturalHeight);
  }
}

function whenImagePixelsReady(img: HTMLImageElement, fn: () => void) {
  if (img.naturalWidth > 0) {
    fn();
    return;
  }
  const run = () => {
    if (img.naturalWidth > 0) fn();
  };
  if (img.decode) {
    img
      .decode()
      .then(run)
      .catch(() => img.addEventListener('load', run, { once: true }));
  } else {
    img.addEventListener('load', run, { once: true });
  }
}

/**
 * Fills the mesh with cover UVs and assigns map only when pixels are ready
 * (avoids a frame of wrong default ShapeGeometry UVs).
 * Pass `mesh` so async apply skips if the layer was switched to color (material replaced).
 */
export function attachPhotoToMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  src: string,
  mesh: THREE.Mesh,
) {
  material.map = null;
  material.color.set(0xffffff);
  delete (material.userData as { photoSrc?: string }).photoSrc;

  const go = (tex: THREE.Texture) => {
    configureTexture(tex);
    const img = tex.image as HTMLImageElement | undefined;
    if (!img) return;
    const apply = () => {
      if (mesh.material !== material) return;
      applyUvs(geometry, img);
      material.map = tex;
      (material.userData as { photoSrc: string }).photoSrc = src;
      material.needsUpdate = true;
    };
    whenImagePixelsReady(img, apply);
  };

  const existing = textureCache.get(src);
  if (existing) {
    go(existing);
    return;
  }

  const tex = new THREE.TextureLoader().load(
    src,
    (loaded) => {
      textureCache.set(src, loaded);
      go(loaded);
    },
    undefined,
    () => {
      /* keep flat fill on error */
    },
  );
  textureCache.set(src, tex);
}

export function isPhotoSrcCurrent(material: THREE.MeshStandardMaterial, src: string) {
  return (material.userData as { photoSrc?: string }).photoSrc === src && material.map;
}
