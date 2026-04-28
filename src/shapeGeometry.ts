import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { getShapeDef, type ShapeId } from './shapeCatalog';
import type { CollageLayer } from './types';

const SHAPE_DIVISIONS = 10;
const NORM_MAX = 1; // inner mask fits in about [-1,1] before outer frame
const INVERT_OUTER = 1.1;

/**
 * Filled square -1..1, or a frame (outer minus inner) when inverted.
 */
export function createRectangleMaskShape(inverted: boolean): THREE.Shape {
  if (!inverted) {
    const s = new THREE.Shape();
    s.moveTo(-1, -1);
    s.lineTo(1, -1);
    s.lineTo(1, 0);
    s.lineTo(-1, 0);
    s.lineTo(-1, -1);
    return s;
  }
  const outer = new THREE.Shape();
  const o = INVERT_OUTER;
  outer.moveTo(-o, -o);
  outer.lineTo(o, -o);
  outer.lineTo(o, o);
  outer.lineTo(-o, o);
  outer.lineTo(-o, -o);
  const inner = 0.88;
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner);
  hole.lineTo(inner, -inner);
  hole.lineTo(inner, inner);
  hole.lineTo(-inner, inner);
  hole.lineTo(-inner, -inner);
  outer.holes.push(hole);
  return outer;
}

/**
 * One SVG → largest THREE.Shape from SVGLoader, or fallback square.
 */
function svgStringToRawShape(svg: string): THREE.Shape {
  const data = new SVGLoader().parse(svg);
  if (!data.paths || data.paths.length === 0) {
    return createRectangleMaskShape(false);
  }
  const candidates: THREE.Shape[] = [];
  for (const p of data.paths) {
    const shapes = SVGLoader.createShapes(p);
    for (const s of shapes) {
      candidates.push(s);
    }
  }
  if (candidates.length === 0) {
    return createRectangleMaskShape(false);
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }
  const areas = candidates.map((sh) => {
    const g = new THREE.ShapeGeometry(sh, 8);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const a = (b.max.x - b.min.x) * (b.max.y - b.min.y);
    g.dispose();
    return a;
  });
  let bestI = 0;
  for (let i = 1; i < areas.length; i += 1) {
    if (areas[i]! > areas[bestI]!) bestI = i;
  }
  return candidates[bestI]!;
}

/**
 * SVGLoader uses a Y-down space; three.js and ShapeGeometry are Y-up.
 */
function flipYShape(s: THREE.Shape): THREE.Shape {
  const n = 300;
  const out = new THREE.Shape();
  const pts = s.getPoints(n);
  if (pts.length < 3) return s;
  out.moveTo(pts[0]!.x, -pts[0]!.y);
  for (let i = 1; i < pts.length; i += 1) {
    out.lineTo(pts[i]!.x, -pts[i]!.y);
  }
  if (pts.length) out.lineTo(pts[0]!.x, -pts[0]!.y);
  for (const h of s.holes) {
    const hp = h.getPoints(120);
    if (hp.length < 3) continue;
    const p = new THREE.Path();
    p.moveTo(hp[0]!.x, -hp[0]!.y);
    for (let j = 1; j < hp.length; j += 1) p.lineTo(hp[j]!.x, -hp[j]!.y);
    if (hp.length) p.lineTo(hp[0]!.x, -hp[0]!.y);
    out.holes.push(p);
  }
  return out;
}

/**
 * Centers and scales a shape to fit a square of half-edge NORM_MAX.
 */
function shapeToUnitSquare(shape: THREE.Shape): THREE.Shape {
  const g = new THREE.ShapeGeometry(shape, SHAPE_DIVISIONS);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.dispose();
  if (!b) return shape;
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const cx = (b.max.x + b.min.x) / 2;
  const cy = (b.max.y + b.min.y) / 2;
  const s = (2 * NORM_MAX) / Math.max(w, h, 1e-8);
  const newPts = shape
    .getPoints(180)
    .map((p) => new THREE.Vector2( (p.x - cx) * s, (p.y - cy) * s));
  if (newPts.length < 3) return shape;
  const sh = new THREE.Shape();
  sh.moveTo( newPts[0]!.x, newPts[0]!.y );
  for (let i = 1; i < newPts.length; i += 1) {
    sh.lineTo( newPts[i]!.x, newPts[i]!.y );
  }
  if (newPts.length > 0) {
    sh.lineTo( newPts[0]!.x, newPts[0]!.y );
  }
  return sh;
}

/**
 * Inverted: image visible outside the silhouette; hole = mask interior.
 */
function withInvertedHole(innerUnit: THREE.Shape, outerSize: number): THREE.Shape {
  const geom = new THREE.ShapeGeometry(innerUnit, 8);
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  geom.dispose();
  const pad = 0.05;
  const outer = new THREE.Shape();
  outer.moveTo(b.min.x - pad, b.min.y - pad);
  outer.lineTo(b.max.x + pad, b.min.y - pad);
  outer.lineTo(b.max.x + pad, b.max.y + pad);
  outer.lineTo(b.min.x - pad, b.max.y + pad);
  outer.lineTo(b.min.x - pad, b.min.y - pad);
  const pathPoints = innerUnit.getPoints( 200 );
  const hole = new THREE.Path( pathPoints );
  outer.holes.push(hole);
  return outer;
}

export function layerGeometryKey(layer: CollageLayer): string {
  return `${layer.shape}\u0000${layer.maskInverted ? 1 : 0}`;
}

/**
 * Builds 2D mask geometry in normalized clip space (centered, then scaled by layer in scene).
 */
export function buildLayerMaskShape(layer: CollageLayer): THREE.Shape {
  const def = getShapeDef(layer.shape as ShapeId);
  const inv = layer.maskInverted;
  const shapeId = layer.shape as ShapeId;

  if (shapeId === 'rectangle') {
    return createRectangleMaskShape(inv);
  }

  if (def && def.type === 'mask' && 'svg' in def) {
    const raw = flipYShape(svgStringToRawShape(def.svg));
    const inner = shapeToUnitSquare(raw);
    if (inv) {
      return withInvertedHole(inner, INVERT_OUTER);
    }
    return inner;
  }

  return createRectangleMaskShape(false);
}
