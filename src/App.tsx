import { ChangeEvent, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Box,
  ImagePlus,
  Images,
  Layers,
  PaintBucket,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
} from 'lucide-react';
import { PHOTO_BANK } from './photobank';
import { ThreeCollagePreview } from './ThreeCollagePreview';
import type { CollageLayer, FillMode, ShapeKind } from './types';

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'blob', 'star', 'hexagon'];
const COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4dabf7', '#9d4edd', '#f8f9fa', '#111827'];

type AppProps = {
  layers: CollageLayer[];
  selectedId: string;
  setLayers: React.Dispatch<React.SetStateAction<CollageLayer[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string>>;
};

const makeLayer = (image: string, index: number, patch: Partial<CollageLayer> = {}): CollageLayer => {
  const layer: CollageLayer = {
    id: crypto.randomUUID(),
    name: `Layer ${index + 1}`,
    image,
    shape: SHAPES[index % SHAPES.length],
    fillMode: 'photo',
    color: COLORS[index % COLORS.length],
    rotation: Math.round((Math.random() * 60 - 30) * 10) / 10,
    x: Math.round((Math.random() * 2 - 1) * 1.8 * 10) / 10,
    y: Math.round((Math.random() * 2 - 1) * 1.1 * 10) / 10,
    scale: 1,
    depth: index,
  };

  return { ...layer, ...patch, id: patch.id ?? layer.id, depth: patch.depth ?? layer.depth };
};

export const starterLayers = (): CollageLayer[] => [
  makeLayer(PHOTO_BANK[0].src, 0, { name: 'Sunset circle', x: -0.85, y: 0.35, scale: 0.98 }),
  makeLayer(PHOTO_BANK[1].src, 1, { name: 'Leaf star', shape: 'star', x: 0.82, y: 0.25, scale: 0.78, rotation: -14 }),
  makeLayer(PHOTO_BANK[2].src, 2, {
    name: 'Paper triangle',
    shape: 'triangle',
    fillMode: 'color',
    color: '#ffd166',
    x: -0.15,
    y: -0.72,
    scale: 0.9,
    rotation: 11,
  }),
];

export default function App({ layers, selectedId, setLayers, setSelectedId }: AppProps) {
  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedId) ?? layers[0],
    [layers, selectedId],
  );

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
      const next = current.filter((layer) => layer.id !== selectedLayer.id);
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
      return next;
    });
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <aside className="intro">
          <p className="eyebrow">Lightweight collage studio</p>
          <h1>Cut photo shapes, stack layers, and preview real 3D spacing.</h1>
          <p className="intro-text">
            Upload your own photos or start from the built-in photobank, then fill each cutout with
            the original image or a flat color. Three.js gives every layer a small z-distance so the
            finished board has a handmade sense of space.
          </p>
          <div className="feature-list">
            <Feature icon={<Scissors size={20} />} title="Shape cutouts" text="Circle, square, triangle, star, blob, and hexagon masks." />
            <Feature icon={<PaintBucket size={20} />} title="Photo or color fill" text="Keep the original image or switch to a pure color swatch." />
            <Feature icon={<Box size={20} />} title="30 degree rotation" text="Layer rotation is constrained from -30deg to 30deg." />
          </div>
        </aside>

        <section className="workspace">
          <section className="preview-panel">
            <div className="preview-toolbar">
              <div>
                <h2>Collage board</h2>
                <span className="hint">Drag the preview to tilt the finished board.</span>
              </div>
              <button className="primary-action" onClick={() => addLayer(PHOTO_BANK[layers.length % PHOTO_BANK.length].src)}>
                <Plus size={18} />
                Add cutout
              </button>
            </div>
            <ThreeCollagePreview layers={layers} selectedLayerId={selectedId} width={760} height={520} />
            {layers.length === 0 && (
              <div className="empty-board">
                <p>No cutouts yet. Choose a photobank image or upload a photo to begin.</p>
              </div>
            )}
          </section>

          <section className="studio-panel">
            <div className="controls-grid">
              <div className="control-card">
                <h3>
                  <Images size={18} />
                  Photobank
                </h3>
                <div className="photobank-grid">
                  {PHOTO_BANK.map((photo) => (
                    <button
                      key={photo.id}
                      className="photo-option"
                      onClick={() => addLayer(photo.src, { name: photo.name })}
                    >
                      <img src={photo.src} alt={photo.name} />
                    </button>
                  ))}
                </div>
                <label className="upload-button">
                  <Upload size={17} />
                  Upload photo
                  <input type="file" accept="image/*" onChange={handleUpload} />
                </label>
              </div>

              <div className="control-card">
                <h3>
                  <Layers size={18} />
                  Selected layer
                </h3>
                {selectedLayer ? (
                  <LayerEditor
                    layer={selectedLayer}
                    layerIndex={layers.findIndex((layer) => layer.id === selectedLayer.id)}
                    layerCount={layers.length}
                    onDuplicate={() => addLayer(selectedLayer.image, { ...selectedLayer, id: undefined })}
                    onMove={(direction) => moveLayer(selectedLayer.id, direction)}
                    onRemove={removeSelectedLayer}
                    onUpdate={(patch) => updateLayer(selectedLayer.id, patch)}
                  />
                ) : (
                  <p className="muted">Add a photo to start editing a cutout.</p>
                )}
              </div>

              <div className="control-card wide">
                <h3>
                  <Layers size={18} />
                  Layer stack
                </h3>
                <div className="layer-list">
                  {layers
                    .map((layer, index) => ({ layer, index }))
                    .reverse()
                    .map(({ layer, index }) => (
                      <div key={layer.id} className={`layer-item ${selectedId === layer.id ? 'active' : ''}`}>
                        <button className="layer-thumb" onClick={() => setSelectedId(layer.id)} aria-label={`Select ${layer.name}`}>
                          {layer.fillMode === 'photo' ? (
                            <img src={layer.image} alt="" />
                          ) : (
                            <span className="color-thumb" style={{ backgroundColor: layer.color }} />
                          )}
                        </button>
                        <button className="layer-summary" onClick={() => setSelectedId(layer.id)}>
                          <strong>{layer.name}</strong>
                          <span>
                            {layer.shape} / z {index + 1}
                          </span>
                        </button>
                        <div className="layer-buttons">
                          <button onClick={() => moveLayer(layer.id, 'down')} disabled={index === 0} aria-label="Send backward">
                            <ArrowDown size={15} />
                          </button>
                          <button onClick={() => moveLayer(layer.id, 'up')} disabled={index === layers.length - 1} aria-label="Bring forward">
                            <ArrowUp size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

type FeatureProps = {
  icon: React.ReactNode;
  title: string;
  text: string;
};

function Feature({ icon, title, text }: FeatureProps) {
  return (
    <div className="feature-card">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

type LayerEditorProps = {
  layer: CollageLayer;
  layerIndex: number;
  layerCount: number;
  onDuplicate: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<CollageLayer>) => void;
};

function LayerEditor({
  layer,
  layerIndex,
  layerCount,
  onDuplicate,
  onMove,
  onRemove,
  onUpdate,
}: LayerEditorProps) {
  return (
    <>
      <label className="text-control">
        Name
        <input value={layer.name} onChange={(event) => onUpdate({ name: event.target.value })} />
      </label>

      <div className="shape-grid">
        {SHAPES.map((shape) => (
          <button
            key={shape}
            className={`shape-option ${layer.shape === shape ? 'active' : ''}`}
            onClick={() => onUpdate({ shape })}
          >
            {shape}
          </button>
        ))}
      </div>

      <div className="mode-switch">
        {(['photo', 'color'] as FillMode[]).map((mode) => (
          <button key={mode} className={layer.fillMode === mode ? 'active' : ''} onClick={() => onUpdate({ fillMode: mode })}>
            {mode === 'photo' ? 'Original photo' : 'Pure color'}
          </button>
        ))}
      </div>

      <div className="swatch-grid">
        {COLORS.map((color) => (
          <button
            key={color}
            className={`swatch-option ${layer.color === color ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onUpdate({ fillMode: 'color', color })}
            aria-label={`Use ${color}`}
          />
        ))}
        <input type="color" value={layer.color} onChange={(event) => onUpdate({ fillMode: 'color', color: event.target.value })} />
      </div>

      <div className="range-group">
        <Range label="Rotation" value={layer.rotation} min={-30} max={30} step={1} suffix="deg" onChange={(rotation) => onUpdate({ rotation })} />
        <Range label="Horizontal" value={layer.x} min={-2.4} max={2.4} step={0.1} onChange={(x) => onUpdate({ x })} />
        <Range label="Vertical" value={layer.y} min={-1.6} max={1.6} step={0.1} onChange={(y) => onUpdate({ y })} />
        <Range label="Scale" value={layer.scale} min={0.45} max={1.7} step={0.05} onChange={(scale) => onUpdate({ scale })} />
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
  onChange: (value: number) => void;
};

function Range({ label, value, min, max, step, suffix = '', onChange }: RangeProps) {
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
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
