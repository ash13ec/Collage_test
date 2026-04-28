import { ChangeEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Layers,
  Maximize2,
  PanelLeft,
  Plus,
  RotateCcw,
  SlidersVertical,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { PHOTO_BANK } from './photobank';
import { DEFAULT_SHAPE, SHAPE_OPTIONS, type ShapeId } from './shapeCatalog';
import { readFillSwatches } from './fillSwatches';
import { ThreeCollagePreview } from './ThreeCollagePreview';
import type { CollageLayer, FillMode, ShapeKind } from './types';

const FILL_SWATCHES = readFillSwatches();

type AppProps = {
  layers: CollageLayer[];
  selectedId: string;
  setLayers: React.Dispatch<React.SetStateAction<CollageLayer[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string>>;
};

const makeLayer = (image: string, index: number, patch: Partial<CollageLayer> = {}): CollageLayer => {
  const list = SHAPE_OPTIONS as { id: ShapeId }[];
  const layer: CollageLayer = {
    id: crypto.randomUUID(),
    name: `Layer ${index + 1}`,
    image,
    shape: (list[index % list.length]?.id ?? DEFAULT_SHAPE) as ShapeKind,
    maskInverted: false,
    fillMode: 'photo',
    color: FILL_SWATCHES[index % FILL_SWATCHES.length],
    rotation: 0,
    x: 0,
    y: 0,
    scale: 1,
    depth: index,
  };

  return { ...layer, ...patch, id: patch.id ?? layer.id, depth: patch.depth ?? layer.depth };
};

const randomShapeId = () => {
  const list = SHAPE_OPTIONS as { id: ShapeId }[];
  return list[Math.floor(Math.random() * list.length)]?.id ?? DEFAULT_SHAPE;
};

const randomPhotoSource = () => {
  if (PHOTO_BANK.length === 0) return '';
  return PHOTO_BANK[Math.floor(Math.random() * PHOTO_BANK.length)]!.src;
};

/** Three random cutouts with random photobank images, laid out in the central board area. */
export const starterLayers = (): CollageLayer[] => {
  return [0, 1, 2].map((i) => {
    const j = (Math.random() * 2 - 1) * 0.9;
    const k = (Math.random() * 2 - 1) * 0.75;
    return makeLayer(randomPhotoSource(), i, {
      name: `Layer ${i + 1}`,
      shape: randomShapeId() as ShapeKind,
      x: j,
      y: k,
      fillMode: 'photo',
    });
  });
};

type ViewMode = 'edit' | 'preview';

function ViewModeSegment({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="view-mode-segment" role="group" aria-label="Workspace mode">
      <div className="view-mode-segment__track" data-active={value}>
        <div className="view-mode-segment__thumb" aria-hidden />
        <button
          type="button"
          className={`view-mode-segment__cell ${value === 'edit' ? 'is-active' : ''}`}
          aria-pressed={value === 'edit'}
          onClick={() => onChange('edit')}
        >
          <span className="view-mode-segment__name">Edit</span>
          <span className="view-mode-segment__hint">Flat, centered</span>
        </button>
        <button
          type="button"
          className={`view-mode-segment__cell ${value === 'preview' ? 'is-active' : ''}`}
          aria-pressed={value === 'preview'}
          onClick={() => onChange('preview')}
        >
          <span className="view-mode-segment__name">Preview</span>
          <span className="view-mode-segment__hint">Orbit 3D</span>
        </button>
      </div>
    </div>
  );
}

export default function App({ layers, selectedId, setLayers, setSelectedId }: AppProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [centerViewKey, setCenterViewKey] = useState(0);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 640 });

  useLayoutEffect(() => {
    const el = canvasHostRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedId) ?? layers[0],
    [layers, selectedId],
  );

  const reindexDepths = (list: CollageLayer[]): CollageLayer[] => list.map((layer, i) => ({ ...layer, depth: i }));

  const updateLayer = (id: string, patch: Partial<CollageLayer>) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  const addLayer = (image: string, patch: Partial<CollageLayer> = {}) => {
    setLayers((current) => {
      const nextLayer = makeLayer(image, current.length, patch);
      setSelectedId(nextLayer.id);
      return [...current, nextLayer];
    });
  };

  const removeSelectedLayer = () => {
    if (!selectedLayer) return;

    setLayers((current) => {
      const next = reindexDepths(current.filter((layer) => layer.id !== selectedLayer.id));
      setSelectedId(next.at(-1)?.id ?? '');
      return next;
    });
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addLayer(reader.result, { name: file.name.replace(/\.[^.]+$/, '') || 'Uploaded photo' });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      const target = direction === 'up' ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return reindexDepths(next);
    });
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <section className="workspace">
          <section className="preview-panel">
            <div className="preview-toolbar">
              <ViewModeSegment value={viewMode} onChange={setViewMode} />
              <div className="preview-toolbar__actions">
                {viewMode === 'preview' && (
                  <button
                    type="button"
                    className="secondary-action view-center-btn"
                    onClick={() => setCenterViewKey((k) => k + 1)}
                    title="Reset camera to straight-on view"
                  >
                    <Target size={16} />
                    Center view
                  </button>
                )}
                <button
                  className="primary-action"
                  onClick={() => addLayer(PHOTO_BANK[layers.length % PHOTO_BANK.length].src)}
                >
                  <Plus size={18} />
                  Add cutout
                </button>
              </div>
            </div>
            <div className="photobank-strip" aria-label="Photobank">
              <div className="photobank-strip__scroller">
                {PHOTO_BANK.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="photobank-strip__item"
                    onClick={() => addLayer(photo.src, { name: photo.name })}
                    title={photo.name}
                  >
                    <img src={photo.src} alt={photo.name} />
                  </button>
                ))}
              </div>
              <label className="photobank-strip__upload">
                <Upload size={18} aria-hidden />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleUpload} />
              </label>
            </div>

            <div className="canvas-area">
              <div className="canvas-area__board canvas-area__board--main" ref={canvasHostRef}>
                <ThreeCollagePreview
                  layers={layers}
                  selectedLayerId={selectedId}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  viewMode={viewMode}
                  centerViewKey={centerViewKey}
                  onSelectLayer={setSelectedId}
                  onUpdateLayer={updateLayer}
                />
                {!layerPanelOpen && (
                  <button
                    type="button"
                    className="layer-panel-reveal"
                    onClick={() => setLayerPanelOpen(true)}
                    title="Show layer panel"
                    aria-label="Show layer panel"
                  >
                    <Maximize2 size={18} />
                    <span>Layer</span>
                  </button>
                )}
                {layerPanelOpen && (
                  <aside
                    className="layer-floating"
                    aria-label="Layer options"
                  >
                    <div className="layer-floating__head">
                      <h2 className="layer-floating__title">
                        <SlidersVertical size={18} aria-hidden />
                        Layer
                      </h2>
                      <button
                        type="button"
                        className="layer-floating__hide"
                        onClick={() => setLayerPanelOpen(false)}
                        title="Hide layer panel"
                        aria-label="Hide layer panel"
                      >
                        <PanelLeft size={18} />
                      </button>
                    </div>
                    <div className="layer-floating__body">
                      {layers.length > 0 && (
                        <div className="layer-floating__section">
                          <h3 className="layer-floating__section-title">
                            <Layers size={16} aria-hidden />
                            Stack
                          </h3>
                          <div className="layer-list layer-list--floating">
                            {layers
                              .map((layer, index) => ({ layer, index }))
                              .reverse()
                              .map(({ layer, index }) => (
                                <div
                                  key={layer.id}
                                  className={`layer-item ${selectedId === layer.id ? 'active' : ''}`}
                                >
                                  <button
                                    className="layer-thumb"
                                    type="button"
                                    onClick={() => setSelectedId(layer.id)}
                                    aria-label={`Select ${layer.name}`}
                                  >
                                    {layer.fillMode === 'photo' ? (
                                      <img src={layer.image} alt="" />
                                    ) : (
                                      <span className="color-thumb" style={{ backgroundColor: layer.color }} />
                                    )}
                                  </button>
                                  <button
                                    className="layer-summary"
                                    type="button"
                                    onClick={() => setSelectedId(layer.id)}
                                  >
                                    <strong>{layer.name}</strong>
                                  </button>
                                  <div className="layer-buttons">
                                    <button
                                      type="button"
                                      onClick={() => moveLayer(layer.id, 'down')}
                                      disabled={index === 0}
                                      aria-label="Send backward"
                                    >
                                      <ArrowDown size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveLayer(layer.id, 'up')}
                                      disabled={index === layers.length - 1}
                                      aria-label="Bring forward"
                                    >
                                      <ArrowUp size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {selectedLayer ? (
                        <div className="layer-floating__section layer-floating__section--edit">
                          <h3 className="layer-floating__section-title">Properties</h3>
                          <LayerEditor
                            layer={selectedLayer}
                            layerIndex={layers.findIndex((layer) => layer.id === selectedLayer.id)}
                            layerCount={layers.length}
                            transformLocked={viewMode === 'preview'}
                            onDuplicate={() => addLayer(selectedLayer.image, { ...selectedLayer, id: undefined })}
                            onMove={(direction) => moveLayer(selectedLayer.id, direction)}
                            onRemove={removeSelectedLayer}
                            onUpdate={(patch) => updateLayer(selectedLayer.id, patch)}
                          />
                        </div>
                      ) : (
                        <p className="layer-floating__empty">Select a cutout on the board, or add one with Add cutout or from the strip above.</p>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

type LayerEditorProps = {
  layer: CollageLayer;
  layerIndex: number;
  layerCount: number;
  transformLocked: boolean;
  onDuplicate: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<CollageLayer>) => void;
};

function LayerEditor({
  layer,
  layerIndex,
  layerCount,
  transformLocked,
  onDuplicate,
  onMove,
  onRemove,
  onUpdate,
}: LayerEditorProps) {
  const t = transformLocked;
  return (
    <>
      <label className="text-control">
        Name
        <input value={layer.name} onChange={(event) => onUpdate({ name: event.target.value })} />
      </label>

      <div className="shape-grid shape-grid--masks">
        {SHAPE_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.id}
            className={`shape-option ${layer.shape === opt.id ? 'active' : ''}`}
            disabled={t}
            onClick={() => onUpdate({ shape: opt.id as ShapeKind })}
            title={opt.type === 'mask' ? 'SVG mask' : 'Rectangle'}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="mask-invert">
        <input
          type="checkbox"
          checked={layer.maskInverted}
          disabled={t}
          onChange={(e) => onUpdate({ maskInverted: e.target.checked })}
        />
        <span>Invert mask (show image outside the cutout)</span>
      </label>

      <div className="mode-switch">
        {(['photo', 'color'] as FillMode[]).map((mode) => (
          <button
            type="button"
            key={mode}
            className={layer.fillMode === mode ? 'active' : ''}
            disabled={t}
            onClick={() => onUpdate({ fillMode: mode })}
          >
            {mode === 'photo' ? 'Original photo' : 'Pure color'}
          </button>
        ))}
      </div>

      <div className="swatch-grid">
        {FILL_SWATCHES.map((color) => (
          <button
            type="button"
            key={color}
            className={`swatch-option ${layer.color === color ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            disabled={t}
            onClick={() => onUpdate({ fillMode: 'color', color })}
            aria-label={`Use ${color}`}
          />
        ))}
        <input
          type="color"
          value={layer.color}
          disabled={t}
          onChange={(event) => onUpdate({ fillMode: 'color', color: event.target.value })}
        />
      </div>

      <div className="range-group">
        <Range
          label="Rotation"
          value={layer.rotation}
          min={-180}
          max={180}
          step={0.5}
          suffix="deg"
          disabled={t}
          onChange={(rotation) => onUpdate({ rotation })}
        />
        <Range label="Horizontal" value={layer.x} min={-2.4} max={2.4} step={0.1} disabled={t} onChange={(x) => onUpdate({ x })} />
        <Range label="Vertical" value={layer.y} min={-1.6} max={1.6} step={0.1} disabled={t} onChange={(y) => onUpdate({ y })} />
      </div>

      <div className="action-row">
        <button className="secondary-action" onClick={() => onMove('down')} disabled={layerIndex === 0}>
          <ArrowDown size={16} />
          Back
        </button>
        <button className="secondary-action" onClick={() => onMove('up')} disabled={layerIndex === layerCount - 1}>
          <ArrowUp size={16} />
          Front
        </button>
        <button className="secondary-action" onClick={() => onUpdate({ rotation: 0 })}>
          <RotateCcw size={16} />
          Reset
        </button>
        <button className="secondary-action" onClick={onDuplicate}>
          <ImagePlus size={16} />
          Duplicate
        </button>
        <button className="secondary-action danger" onClick={onRemove}>
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </>
  );
}

type RangeProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function Range({ label, value, min, max, step, suffix = '', disabled, onChange }: RangeProps) {
  return (
    <div className="range-row">
      <label>
        <span>{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
