import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { attachPhotoToMesh, isPhotoSrcCurrent } from './photoTexture';
import { readCssColor } from './themeColors';
import { buildLayerMaskShape, layerGeometryKey } from './shapeGeometry';
import type { CollageLayer } from './types';

const PREVIEW_TILT_LIMIT = THREE.MathUtils.degToRad(30);

type ViewMode = 'edit' | 'preview';

export type ThreeCollagePreviewProps = {
  layers: CollageLayer[];
  selectedLayerId: string;
  width: number;
  height: number;
  viewMode: ViewMode;
  /** Increment to reset the camera to the default flat, head-on view (for Edit and Preview). */
  centerViewKey: number;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<CollageLayer>) => void;
};

export type ThreeCollagePreviewHandle = {
  /** Renders the current view to a PNG (no selection handles) and starts a download. */
  exportPng: () => void;
};

const SHAPE_CURVE_DIVISIONS = 12;

function boardW(w: number) {
  return w / 140;
}

function boardH(h: number) {
  return h / 140;
}

function layerWorldPosition(layer: CollageLayer, width: number, height: number) {
  const bw = boardW(width);
  const bh = boardH(height);
  return {
    x: (layer.x / 2.4) * (bw / 2.4),
    y: (layer.y / 1.6) * (bh / 2.35),
  };
}

function worldToLayerX(wx: number, width: number) {
  const bw = boardW(width);
  return (wx * 2.4 * 2.4) / bw;
}

function worldToLayerY(wy: number, height: number) {
  const bh = boardH(height);
  return (wy * 1.6 * 2.35) / bh;
}

type BBoxLocal = { cx: number; cy: number; hw: number; hh: number };

type LayerBundleInternal = {
  subGroup: THREE.Group;
  mesh: THREE.Mesh;
  selectionFrame: THREE.LineLoop;
  handles: THREE.Group;
  rotateHandle: THREE.Mesh;
  handleSharedGeom: THREE.CircleGeometry;
  handleMaterial: THREE.MeshBasicMaterial;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  selectionMaterial: THREE.LineBasicMaterial;
  layerId: string;
  geometryKey: string;
  bbox: BBoxLocal;
};

function getMeshBBox(geometry: THREE.BufferGeometry, pad: number): BBoxLocal {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox!;
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  const hw = ((b.max.x - b.min.x) / 2) * pad;
  const hh = ((b.max.y - b.min.y) / 2) * pad;
  return { cx, cy, hw, hh };
}

const HANDLE_Z = 0.035;
const SELECTION_Z = 0.021;
const BBOX_PAD = 1.04;

function makeSelectionBbox(
  b: BBoxLocal,
  material: THREE.LineBasicMaterial,
  z: number = SELECTION_Z,
): THREE.LineLoop {
  const { cx, cy, hw, hh } = b;
  const pts = [
    new THREE.Vector3(cx - hw, cy - hh, z),
    new THREE.Vector3(cx + hw, cy - hh, z),
    new THREE.Vector3(cx + hw, cy + hh, z),
    new THREE.Vector3(cx - hw, cy + hh, z),
  ];
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(g, material);
}

const CORNER_HANDLES: { sx: number; sy: number; cursor: string }[] = [
  { sx: 1, sy: 1, cursor: 'nwse-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' },
  { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: -1, sy: -1, cursor: 'nwse-resize' },
];

function makeScaleHandleGroup(
  b: BBoxLocal,
  material: THREE.MeshBasicMaterial,
  layerId: string,
  shared: THREE.CircleGeometry,
) {
  const g = new THREE.Group();
  const { cx, cy, hw, hh } = b;
  for (const c of CORNER_HANDLES) {
    const m = new THREE.Mesh(shared, material);
    m.position.set(cx + c.sx * hw, cy + c.sy * hh, HANDLE_Z);
    m.userData.scaleHandle = {
      layerId,
      sx: c.sx,
      sy: c.sy,
      cursor: c.cursor,
    } as const;
    g.add(m);
  }
  return g;
}

const ROTATE_OFFSET = 1.22;

function makeRotateHandle(
  material: THREE.MeshBasicMaterial,
  layerId: string,
  shared: THREE.CircleGeometry,
): THREE.Mesh {
  const m = new THREE.Mesh(shared, material);
  m.name = 'rotate';
  m.userData.rotateHandle = { layerId, cursor: 'alias' } as const;
  return m;
}

function applyLayerTransforms(
  bundle: LayerBundleInternal,
  layer: CollageLayer,
  width: number,
  height: number,
  z: number,
  isSelected: boolean,
  showEditUi: boolean,
) {
  const { x, y } = layerWorldPosition(layer, width, height);
  bundle.subGroup.position.set(x, y, z);
  bundle.subGroup.rotation.z = THREE.MathUtils.degToRad(layer.rotation);
  const s = layer.scale * 0.72;
  bundle.subGroup.scale.set(s, s, 1);
  const { cx, cy, hw, hh } = bundle.bbox;
  const invS = 1 / Math.max(s, 0.2);
  const pin = invS * 0.85;
  bundle.handles.children.forEach((ch) => {
    (ch as THREE.Mesh).scale.setScalar(pin);
  });
  bundle.rotateHandle.position.set(cx, cy + hh * ROTATE_OFFSET, HANDLE_Z + 0.012);
  bundle.rotateHandle.scale.setScalar(pin);
  bundle.selectionFrame.visible = isSelected && showEditUi;
  bundle.handles.visible = isSelected && showEditUi;
  bundle.rotateHandle.visible = isSelected && showEditUi;
}

function makePhotoMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: null,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function makeColorMaterial(hex: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    side: THREE.DoubleSide,
  });
}

function disposeLayerMaterial(m: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial) {
  if (m instanceof THREE.MeshStandardMaterial) {
    m.map = null;
  }
  m.dispose();
}

function ensureLayerMaterial(bundle: LayerBundleInternal, layer: CollageLayer) {
  const wantPhoto = layer.fillMode === 'photo';
  const havePhoto = bundle.material instanceof THREE.MeshStandardMaterial;
  if (wantPhoto && !havePhoto) {
    const m = makePhotoMaterial();
    const old = bundle.material;
    bundle.material = m;
    bundle.mesh.material = m;
    disposeLayerMaterial(old);
  } else if (!wantPhoto && havePhoto) {
    const m = makeColorMaterial(layer.color);
    const old = bundle.material;
    bundle.material = m;
    bundle.mesh.material = m;
    disposeLayerMaterial(old);
  }
}

function createLayerBundle(
  layer: CollageLayer,
  width: number,
  height: number,
  z: number,
  isSelected: boolean,
  showEditUi: boolean,
): LayerBundleInternal {
  const twoD = buildLayerMaskShape(layer);
  const geometry = new THREE.ShapeGeometry(twoD, SHAPE_CURVE_DIVISIONS);
  const material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial =
    layer.fillMode === 'photo' ? makePhotoMaterial() : makeColorMaterial(layer.color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.layerId = layer.id;
  if (layer.fillMode === 'photo' && material instanceof THREE.MeshStandardMaterial) {
    attachPhotoToMesh(geometry, material, layer.image, mesh);
  }

  const selectionMaterial = new THREE.LineBasicMaterial({ color: readCssColor('--color-ink', '#0a0a0a') });
  const bbox = getMeshBBox(geometry, BBOX_PAD);
  const selectionFrame = makeSelectionBbox(bbox, selectionMaterial, SELECTION_Z);
  const handleSharedGeom = new THREE.CircleGeometry(0.08, 24);
  const handleMaterial = new THREE.MeshBasicMaterial({ color: readCssColor('--color-ink', '#0a0a0a'), depthTest: true });
  const handles = makeScaleHandleGroup(bbox, handleMaterial, layer.id, handleSharedGeom);
  const rotateHandle = makeRotateHandle(handleMaterial, layer.id, handleSharedGeom);

  const subGroup = new THREE.Group();
  subGroup.add(mesh);
  subGroup.add(selectionFrame);
  subGroup.add(handles);
  subGroup.add(rotateHandle);
  const bundle: LayerBundleInternal = {
    subGroup,
    mesh,
    selectionFrame,
    handles,
    rotateHandle,
    handleSharedGeom,
    handleMaterial,
    geometry,
    material,
    selectionMaterial,
    layerId: layer.id,
    geometryKey: layerGeometryKey(layer),
    bbox,
  };
  applyLayerTransforms(bundle, layer, width, height, z, isSelected, showEditUi);
  return bundle;
}

function updateLayerContent(bundle: LayerBundleInternal, layer: CollageLayer) {
  ensureLayerMaterial(bundle, layer);
  if (layer.fillMode === 'color' && bundle.material instanceof THREE.MeshBasicMaterial) {
    bundle.material.color.set(layer.color);
  } else if (layer.fillMode === 'photo' && bundle.material instanceof THREE.MeshStandardMaterial) {
    bundle.material.color.set(0xffffff);
    if (!isPhotoSrcCurrent(bundle.material, layer.image)) {
      attachPhotoToMesh(bundle.geometry, bundle.material, layer.image, bundle.mesh);
    }
  }
  bundle.material.needsUpdate = true;
}

function disposeLayerBundle(b: LayerBundleInternal) {
  b.selectionFrame.geometry.dispose();
  b.handleSharedGeom.dispose();
  b.handleMaterial.dispose();
  b.geometry.dispose();
  disposeLayerMaterial(b.material);
  b.selectionMaterial.dispose();
}

function syncLayers(
  group: THREE.Group,
  orderedLayers: CollageLayer[],
  selectedId: string,
  width: number,
  height: number,
  viewMode: ViewMode,
  bundles: Map<string, LayerBundleInternal>,
  suppressEditChrome: boolean = false,
) {
  const usedIds = new Set<string>();
  let index = 0;
  for (const layer of orderedLayers) {
    const z = index * 0.16;
    const isSelected = layer.id === selectedId;
    const showEditUi = isSelected && viewMode === 'edit' && !suppressEditChrome;
    usedIds.add(layer.id);
    const existing = bundles.get(layer.id);
    if (!existing) {
      const b = createLayerBundle(layer, width, height, z, isSelected, showEditUi);
      bundles.set(layer.id, b);
      group.add(b.subGroup);
    } else if (existing.geometryKey !== layerGeometryKey(layer)) {
      group.remove(existing.subGroup);
      disposeLayerBundle(existing);
      bundles.delete(layer.id);
      const b = createLayerBundle(layer, width, height, z, isSelected, showEditUi);
      bundles.set(layer.id, b);
      group.add(b.subGroup);
    } else {
      updateLayerContent(existing, layer);
      applyLayerTransforms(existing, layer, width, height, z, isSelected, showEditUi);
      existing.geometryKey = layerGeometryKey(layer);
    }
    index += 1;
  }

  for (const [id, bundle] of [...bundles]) {
    if (!usedIds.has(id)) {
      group.remove(bundle.subGroup);
      disposeLayerBundle(bundle);
      bundles.delete(id);
    }
  }
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 200;

function clampValue(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function wrapAngleDeltaRad(a0: number, a1: number) {
  return Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
}

function triggerPngDownload(dataUrl: string, baseName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${baseName}.png`;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const ThreeCollagePreview = forwardRef<ThreeCollagePreviewHandle, ThreeCollagePreviewProps>(
  function ThreeCollagePreview(
  {
  layers,
  selectedLayerId,
  width,
  height,
  viewMode,
  centerViewKey,
  onSelectLayer,
  onUpdateLayer,
},
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const viewModeRef = useRef(viewMode);
  const layersRef = useRef(layers);
  const selectedRef = useRef(selectedLayerId);
  const onSelectRef = useRef(onSelectLayer);
  const onUpdateRef = useRef(onUpdateLayer);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const bundleByIdRef = useRef(new Map<string, LayerBundleInternal>());
  const dragStateRef = useRef<{
    id: string;
    startLayer: { x: number; y: number };
    planeX: number;
    planeY: number;
  } | null>(null);
  const scaleDragRef = useRef<{
    layerId: string;
    pivot: THREE.Vector2;
    v0: THREE.Vector2;
    r0: number;
    startScale: number;
  } | null>(null);
  const rotationDragRef = useRef<{
    layerId: string;
    centerX: number;
    centerY: number;
    a0: number;
    r0: number;
  } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const planeHit = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  viewModeRef.current = viewMode;
  layersRef.current = layers;
  selectedRef.current = selectedLayerId;
  onSelectRef.current = onSelectLayer;
  onUpdateRef.current = onUpdateLayer;
  widthRef.current = width;
  heightRef.current = height;

  const orderedLayers = useMemo(
    () => [...layers].sort((a, b) => a.depth - b.depth),
    [layers],
  );

  useLayoutEffect(() => {
    if (!sceneReady || !groupRef.current) return;
    syncLayers(
      groupRef.current,
      orderedLayers,
      selectedLayerId,
      width,
      height,
      viewMode,
      bundleByIdRef.current,
    );
  }, [sceneReady, orderedLayers, selectedLayerId, width, height, viewMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = readCssColor('--color-surface-raised', '#fafafa');
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 0);
    controls.minDistance = 4.5;
    controls.maxDistance = 18;
    controls.enablePan = false;
    controlsRef.current = controls;

    const applyModeToControls = () => {
      const isPreview = viewModeRef.current === 'preview';
      if (isPreview) {
        controls.enableRotate = true;
        const polarCenter = Math.PI / 2;
        controls.minAzimuthAngle = -PREVIEW_TILT_LIMIT;
        controls.maxAzimuthAngle = PREVIEW_TILT_LIMIT;
        controls.minPolarAngle = polarCenter - PREVIEW_TILT_LIMIT;
        controls.maxPolarAngle = polarCenter + PREVIEW_TILT_LIMIT;
        mount.classList.add('three-preview--preview');
        mount.classList.remove('three-preview--edit');
        renderer.domElement.style.cursor = 'grab';
      } else {
        controls.enableRotate = false;
        camera.position.set(0, 0, 8);
        controls.target.set(0, 0, 0);
        controls.update();
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        mount.classList.add('three-preview--edit');
        mount.classList.remove('three-preview--preview');
        renderer.domElement.style.cursor = 'default';
      }
    };

    applyModeToControls();

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(-2, 4, 6);
    scene.add(light);

    setSceneReady(true);

    const pLocal3 = new THREE.Vector3();
    const pLocal2a = new THREE.Vector2();
    const pLocal2b = new THREE.Vector2();
    const worldCenter3 = new THREE.Vector3();

    const worldDeltaToLayerD = (dwx: number, dwy: number, w: number, h: number) => {
      const bw = boardW(w);
      const bh = boardH(h);
      return { dx: (dwx * 2.4 * 2.4) / bw, dy: (dwy * 1.6 * 2.35) / bh };
    };

    const pickMeshes = (): THREE.Mesh[] => {
      return [...bundleByIdRef.current.values()].map((b) => b.mesh);
    };

    const pickScaleHandleMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      for (const b of bundleByIdRef.current.values()) {
        if (!b.handles.visible) continue;
        b.handles.children.forEach((c) => list.push(c));
      }
      return list;
    };

    const pickRotateHandleMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      for (const b of bundleByIdRef.current.values()) {
        if (b.rotateHandle.visible) list.push(b.rotateHandle);
      }
      return list;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerNdc.set(nx, ny);
      raycaster.setFromCamera(pointerNdc, camera);
      const mode = viewModeRef.current;

      if (mode === 'edit' && raycaster.ray.intersectPlane(dragPlane, planeHit)) {
        const rotHits = raycaster.intersectObjects(pickRotateHandleMeshes(), false);
        if (rotHits.length > 0) {
          const ro = (rotHits[0]!.object as THREE.Mesh).userData.rotateHandle as
            | { layerId: string }
            | undefined;
          if (ro) {
            const bundle = bundleByIdRef.current.get(ro.layerId);
            const layer = layersRef.current.find((l) => l.id === ro.layerId);
            if (bundle && layer) {
              worldCenter3.set(0, 0, 0);
              bundle.subGroup.getWorldPosition(worldCenter3);
              const a0 = Math.atan2(planeHit.y - worldCenter3.y, planeHit.x - worldCenter3.x);
              rotationDragRef.current = {
                layerId: ro.layerId,
                centerX: worldCenter3.x,
                centerY: worldCenter3.y,
                a0,
                r0: layer.rotation,
              };
              pointerIdRef.current = event.pointerId;
              event.stopImmediatePropagation();
              try {
                renderer.domElement.setPointerCapture(event.pointerId);
              } catch {
                // ignore
              }
            }
            return;
          }
        }
      }

      if (mode === 'edit') {
        const hHits = raycaster.intersectObjects(pickScaleHandleMeshes(), false);
        if (hHits.length > 0) {
          const mesh = hHits[0]!.object as THREE.Mesh;
          const hU = mesh.userData.scaleHandle as { layerId: string; sx: number; sy: number } | undefined;
          if (hU && raycaster.ray.intersectPlane(dragPlane, planeHit)) {
            const bundle = bundleByIdRef.current.get(hU.layerId);
            const layer = layersRef.current.find((l) => l.id === hU.layerId);
            if (bundle && layer) {
              pLocal3.set(planeHit.x, planeHit.y, 0);
              bundle.subGroup.worldToLocal(pLocal3);
              const { cx, cy, hw, hh } = bundle.bbox;
              const pivot = pLocal2a.set(cx - hU.sx * hw, cy - hU.sy * hh);
              const v0 = new THREE.Vector2(2 * hU.sx * hw, 2 * hU.sy * hh);
              pLocal2b.set(pLocal3.x, pLocal3.y).sub(pivot);
              const r0 = Math.max(1e-3, pLocal2b.dot(v0) / Math.max(1e-8, v0.dot(v0)));
              scaleDragRef.current = {
                layerId: hU.layerId,
                pivot: pivot.clone(),
                v0,
                r0,
                startScale: layer.scale,
              };
              pointerIdRef.current = event.pointerId;
              event.stopImmediatePropagation();
              try {
                renderer.domElement.setPointerCapture(event.pointerId);
              } catch {
                // ignore
              }
            }
            return;
          }
        }
      }

      const hits = raycaster.intersectObjects(pickMeshes(), false);

      if (hits.length > 0) {
        const id = (hits[0]!.object as THREE.Mesh).userData.layerId as string;
        event.stopImmediatePropagation();
        onSelectRef.current(id);
        if (mode === 'edit') {
          const layer = layersRef.current.find((l) => l.id === id);
          if (!layer) return;
          if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
          dragStateRef.current = {
            id,
            startLayer: { x: layer.x, y: layer.y },
            planeX: planeHit.x,
            planeY: planeHit.y,
          };
          pointerIdRef.current = event.pointerId;
          try {
            renderer.domElement.setPointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }
        return;
      }
      onSelectRef.current('');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (viewModeRef.current !== 'edit') return;
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerNdc.set(nx, ny);
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;

      const rDrag = rotationDragRef.current;
      if (rDrag) {
        const a1 = Math.atan2(planeHit.y - rDrag.centerY, planeHit.x - rDrag.centerX);
        const d = wrapAngleDeltaRad(rDrag.a0, a1);
        onUpdateRef.current(rDrag.layerId, { rotation: rDrag.r0 + THREE.MathUtils.radToDeg(d) });
        return;
      }

      const sDrag = scaleDragRef.current;
      if (sDrag) {
        const bundle = bundleByIdRef.current.get(sDrag.layerId);
        if (!bundle) {
          scaleDragRef.current = null;
          return;
        }
        pLocal3.set(planeHit.x, planeHit.y, 0);
        bundle.subGroup.worldToLocal(pLocal3);
        const v1 = pLocal2a.set(pLocal3.x, pLocal3.y).sub(sDrag.pivot);
        const r1 = v1.dot(sDrag.v0) / sDrag.v0.dot(sDrag.v0);
        const rel = sDrag.r0 > 0 ? r1 / sDrag.r0 : 1;
        const next = clampValue(sDrag.startScale * rel, MIN_SCALE, MAX_SCALE);
        onUpdateRef.current(sDrag.layerId, { scale: next });
        return;
      }

      const d = dragStateRef.current;
      if (!d) {
        if (viewModeRef.current === 'edit') {
          const hovR = raycaster.intersectObjects(pickRotateHandleMeshes(), false);
          if (hovR.length > 0) {
            const c = (hovR[0]!.object as THREE.Mesh).userData.rotateHandle as { cursor?: string } | undefined;
            renderer.domElement.style.cursor = c?.cursor ?? 'alias';
            return;
          }
        }
        if (viewModeRef.current === 'edit') {
          const hov = raycaster.intersectObjects(pickScaleHandleMeshes(), false);
          if (hov.length > 0) {
            const c = (hov[0]!.object as THREE.Mesh).userData.scaleHandle as { cursor?: string } | undefined;
            renderer.domElement.style.cursor = c?.cursor ?? 'default';
            return;
          }
        }
        if (viewModeRef.current === 'edit') {
          const meshHits = raycaster.intersectObjects(pickMeshes(), false);
          if (meshHits.length > 0) {
            renderer.domElement.style.cursor = 'grab';
            return;
          }
        }
        if (viewModeRef.current === 'edit') {
          renderer.domElement.style.cursor = 'default';
        }
        return;
      }

      const dwx = planeHit.x - d.planeX;
      const dwy = planeHit.y - d.planeY;
      const w = widthRef.current;
      const h = heightRef.current;
      const { dx, dy } = worldDeltaToLayerD(dwx, dwy, w, h);
      const nextLx = clampValue(d.startLayer.x + dx, -2.4, 2.4);
      const nextLy = clampValue(d.startLayer.y + dy, -1.6, 1.6);
      onUpdateRef.current(d.id, { x: nextLx, y: nextLy });
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current === event.pointerId) {
        dragStateRef.current = null;
        scaleDragRef.current = null;
        rotationDragRef.current = null;
        pointerIdRef.current = null;
        try {
          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }
        } catch {
          // ignore
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (viewModeRef.current !== 'edit') return;
      const id = selectedRef.current;
      if (!id) return;
      if (!event.shiftKey) return;
      event.preventDefault();
      const layer = layersRef.current.find((l) => l.id === id);
      if (!layer) return;
      const delta = event.deltaY * -0.002;
      const next = clampValue(layer.scale + delta, MIN_SCALE, MAX_SCALE);
      onUpdateRef.current(id, { scale: next });
    };

    let frameId = 0;
    const tick = () => {
      frameId = window.requestAnimationFrame(tick);
      if (viewModeRef.current === 'edit' && renderer.domElement) {
        if (pointerIdRef.current != null) {
          renderer.domElement.style.cursor = 'grabbing';
        }
      } else if (viewModeRef.current === 'preview' && renderer.domElement) {
        renderer.domElement.style.cursor = 'grab';
      }
      controlsRef.current?.update();
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const pointerOptions = { capture: true } as const;
    renderer.domElement.addEventListener('pointerdown', onPointerDown, pointerOptions);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, true);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    frameId = window.requestAnimationFrame(tick);

    const handleResize = () => {
      const nextW = mount.clientWidth;
      const nextH = mount.clientHeight;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      setSceneReady(false);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp, true);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, { capture: true } as const);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      for (const bundle of bundleByIdRef.current.values()) {
        disposeLayerBundle(bundle);
      }
      bundleByIdRef.current.clear();
      groupRef.current = null;
      controlsRef.current = null;
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const c = controlsRef.current;
    const m = mountRef.current;
    const r = rendererRef.current;
    if (!c || !m || !r) return;

    if (viewMode === 'preview') {
      c.enableRotate = true;
      const polarCenter = Math.PI / 2;
      c.minAzimuthAngle = -PREVIEW_TILT_LIMIT;
      c.maxAzimuthAngle = PREVIEW_TILT_LIMIT;
      c.minPolarAngle = polarCenter - PREVIEW_TILT_LIMIT;
      c.maxPolarAngle = polarCenter + PREVIEW_TILT_LIMIT;
      m.classList.add('three-preview--preview');
      m.classList.remove('three-preview--edit');
      r.domElement.style.cursor = 'grab';
    } else {
      c.enableRotate = false;
      c.minAzimuthAngle = -Infinity;
      c.maxAzimuthAngle = Infinity;
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI;
      m.classList.add('three-preview--edit');
      m.classList.remove('three-preview--preview');
      r.domElement.style.cursor = 'default';
      const camera = cameraRef.current;
      if (camera) {
        camera.position.set(0, 0, 8);
        c.target.set(0, 0, 0);
        c.update();
      }
    }
  }, [viewMode]);

  useEffect(() => {
    const c = controlsRef.current;
    const camera = cameraRef.current;
    if (!c || !camera) return;
    camera.position.set(0, 0, 8);
    c.target.set(0, 0, 0);
    c.update();
  }, [centerViewKey]);

  useImperativeHandle(
    ref,
    () => ({
      exportPng: () => {
        const group = groupRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const renderer = rendererRef.current;
        const controls = controlsRef.current;
        if (!group || !scene || !camera || !renderer) return;

        const ordered = [...layersRef.current].sort((a, b) => a.depth - b.depth);
        const w = widthRef.current;
        const h = heightRef.current;
        const selected = selectedRef.current;
        const mode = viewModeRef.current;
        const bundles = bundleByIdRef.current;

        const stamp = new Date();
        const baseName = `collage-${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}-${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}`;

        syncLayers(group, ordered, selected, w, h, mode, bundles, true);
        controls?.update();
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        syncLayers(group, ordered, selected, w, h, mode, bundles, false);

        triggerPngDownload(dataUrl, baseName);
      },
    }),
    [],
  );

  return <div className="three-preview" data-view-mode={viewMode} ref={mountRef} aria-label="Collage preview" />;
  },
);

ThreeCollagePreview.displayName = 'ThreeCollagePreview';